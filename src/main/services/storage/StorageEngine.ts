import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import mime from 'mime-types';
import { DatabaseService } from '../database/DatabaseService';
import { VaultNode, ImportResult, StorageMetrics, FilePreviewData, IntegrityReport } from '../../../shared/types';

export class StorageEngine {
  private baseDir: string;
  private objectsDir: string;
  private tempDir: string;
  private cacheDir: string;
  private dbService: DatabaseService;

  constructor(vaultDir: string, dbService: DatabaseService) {
    this.baseDir = vaultDir;
    this.objectsDir = path.join(vaultDir, 'objects');
    this.tempDir = path.join(vaultDir, 'temp');
    this.cacheDir = path.join(vaultDir, 'cache');
    this.dbService = dbService;

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [this.baseDir, this.objectsDir, this.tempDir, this.cacheDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public getObjectPath(hash: string): string {
    const prefix = hash.slice(0, 2);
    return path.join(this.objectsDir, prefix, hash);
  }

  /**
   * Import file from local filesystem using atomic stream copy & SHA-256 calculation.
   * Original user file is strictly untouched (read-only stream).
   */
  public async importLocalFile(
    sourceFilePath: string, 
    parentFolderId: string | null = null, 
    customName?: string,
    deleteSourceAfterImport: boolean = true
  ): Promise<VaultNode> {
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`File does not exist: ${sourceFilePath}`);
    }

    const stat = await fs.promises.stat(sourceFilePath);
    if (stat.isDirectory()) {
      throw new Error(`Cannot directly import directory as single file: ${sourceFilePath}`);
    }

    const originalName = customName || path.basename(sourceFilePath);
    const mimeType = (mime.lookup(originalName) as string) || 'application/octet-stream';

    // 1. Stage copy in temp directory while computing hash in single stream pass
    const tempFileName = `import_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.tmp`;
    const tempFilePath = path.join(this.tempDir, tempFileName);

    const hashStream = crypto.createHash('sha256');
    const readStream = fs.createReadStream(sourceFilePath);
    const writeStream = fs.createWriteStream(tempFilePath);

    const hashTransform = new Transform({
      transform(chunk, encoding, callback) {
        hashStream.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(readStream, hashTransform, writeStream);
    } catch (err: any) {
      // Clean up temp file on failure
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new Error(`Failed during atomic file ingestion: ${err.message}`);
    }

    const finalHash = hashStream.digest('hex');
    const finalSize = stat.size;

    // Check if object already exists in CAS store (Deduplication)
    const existingObject = this.dbService.getObject(finalHash);
    const targetObjectPath = this.getObjectPath(finalHash);

    if (existingObject && fs.existsSync(targetObjectPath)) {
      // Content deduplication: object already exists on disk
      this.dbService.incrementObjectRefCount(finalHash);
      // Remove temporary staging file since we already have the bytes
      await fs.promises.unlink(tempFilePath).catch(() => {});
    } else {
      // First time storing this object
      const targetDir = path.dirname(targetObjectPath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      // Atomic rename from temp to CAS destination
      await fs.promises.rename(tempFilePath, targetObjectPath);
      this.dbService.insertObject(finalHash, finalSize);
    }

    // 2. Create logical metadata node
    const now = new Date().toISOString();
    const node: VaultNode = {
      id: crypto.randomUUID(),
      parentId: parentFolderId,
      name: originalName,
      type: 'file',
      objectHash: finalHash,
      size: finalSize,
      mimeType,
      isStarred: false,
      isTrashed: false,
      trashedAt: null,
      createdAt: now,
      modifiedAt: now,
    };

    this.dbService.insertNode(node);

    // If configured to move file into Vault (delete from user's desktop/folder)
    if (deleteSourceAfterImport && fs.existsSync(sourceFilePath)) {
      try {
        await fs.promises.unlink(sourceFilePath);
      } catch (err: any) {
        console.warn(`Could not remove source file after import: ${sourceFilePath}`, err);
      }
    }

    return node;
  }

  /**
   * Import file from buffer (e.g. drag & drop from renderer or virtual buffer)
   */
  public async importBuffer(buffer: Buffer, originalName: string, parentFolderId: string | null = null): Promise<VaultNode> {
    const tempFileName = `import_buf_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.tmp`;
    const tempFilePath = path.join(this.tempDir, tempFileName);

    await fs.promises.writeFile(tempFilePath, buffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const mimeType = (mime.lookup(originalName) as string) || 'application/octet-stream';
    const targetObjectPath = this.getObjectPath(hash);

    const existingObject = this.dbService.getObject(hash);
    if (existingObject && fs.existsSync(targetObjectPath)) {
      this.dbService.incrementObjectRefCount(hash);
      await fs.promises.unlink(tempFilePath).catch(() => {});
    } else {
      const targetDir = path.dirname(targetObjectPath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }
      await fs.promises.rename(tempFilePath, targetObjectPath);
      this.dbService.insertObject(hash, buffer.length);
    }

    const now = new Date().toISOString();
    const node: VaultNode = {
      id: crypto.randomUUID(),
      parentId: parentFolderId,
      name: originalName,
      type: 'file',
      objectHash: hash,
      size: buffer.length,
      mimeType,
      isStarred: false,
      isTrashed: false,
      trashedAt: null,
      createdAt: now,
      modifiedAt: now,
    };

    this.dbService.insertNode(node);
    return node;
  }

  /**
   * Export file from Vault to external filesystem
   */
  public async exportFile(nodeId: string, destinationDir: string): Promise<string> {
    const node = this.dbService.getNodeById(nodeId);
    if (!node || node.type !== 'file' || !node.objectHash) {
      throw new Error(`Node not found or not a valid file`);
    }

    const sourceObjectPath = this.getObjectPath(node.objectHash);
    if (!fs.existsSync(sourceObjectPath)) {
      throw new Error(`Object data missing from Vault storage!`);
    }

    let targetPath = path.join(destinationDir, node.name);
    let counter = 1;
    const parsed = path.parse(node.name);
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(destinationDir, `${parsed.name} (${counter})${parsed.ext}`);
      counter++;
    }

    await fs.promises.copyFile(sourceObjectPath, targetPath);
    return targetPath;
  }

  /**
   * Create a logical folder
   */
  public createFolder(name: string, parentId: string | null = null): VaultNode {
    const now = new Date().toISOString();
    const node: VaultNode = {
      id: crypto.randomUUID(),
      parentId,
      name: name.trim(),
      type: 'folder',
      objectHash: null,
      size: 0,
      mimeType: null,
      isStarred: false,
      isTrashed: false,
      trashedAt: null,
      createdAt: now,
      modifiedAt: now,
    };

    this.dbService.insertNode(node);
    return node;
  }

  /**
   * Delete nodes permanently with safe reference-counted CAS cleanup
   */
  public async deletePermanently(nodeId: string): Promise<void> {
    const { deletedHashesToCheck } = this.dbService.deleteNodePermanently(nodeId);
    await this.cleanupUnreferencedHashes(deletedHashesToCheck);
  }

  public async emptyTrash(): Promise<void> {
    const { deletedHashesToCheck } = this.dbService.emptyTrash();
    await this.cleanupUnreferencedHashes(deletedHashesToCheck);
  }

  private async cleanupUnreferencedHashes(hashes: string[]): Promise<void> {
    for (const hash of hashes) {
      const remainingRefs = this.dbService.decrementObjectRefCount(hash);
      if (remainingRefs <= 0) {
        this.dbService.deleteObject(hash);
        const objPath = this.getObjectPath(hash);
        if (fs.existsSync(objPath)) {
          await fs.promises.unlink(objPath).catch(() => {});
        }
      }
    }
  }

  /**
   * File Preview retrieval
   */
  public async getFilePreviewData(nodeId: string): Promise<FilePreviewData> {
    const node = this.dbService.getNodeById(nodeId);
    if (!node || node.type !== 'file' || !node.objectHash) {
      throw new Error('File not found');
    }

    const objPath = this.getObjectPath(node.objectHash);
    if (!fs.existsSync(objPath)) {
      throw new Error('Corrupted storage: Object file not found on disk');
    }

    const mimeType = node.mimeType || 'application/octet-stream';
    const previewData: FilePreviewData = {
      id: node.id,
      name: node.name,
      mimeType,
      size: node.size,
      hash: node.objectHash,
      refCount: node.refCount || 1,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
    };

    // Text & code preview (up to 1MB)
    if (
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('javascript') ||
      mimeType.includes('typescript') ||
      mimeType.includes('markdown') ||
      node.name.endsWith('.md') ||
      node.name.endsWith('.txt') ||
      node.name.endsWith('.json') ||
      node.name.endsWith('.ts') ||
      node.name.endsWith('.js') ||
      node.name.endsWith('.css') ||
      node.name.endsWith('.html') ||
      node.name.endsWith('.csv') ||
      node.name.endsWith('.log')
    ) {
      if (node.size <= 1024 * 1024) {
        previewData.textContent = await fs.promises.readFile(objPath, 'utf8');
      }
    }

    return previewData;
  }

  /**
   * Health Check & Startup Integrity Recovery
   */
  public async runIntegrityCheck(): Promise<IntegrityReport> {
    const details: string[] = [];
    const dbValid = this.dbService.checkIntegrity();
    if (!dbValid) {
      details.push('CRITICAL: SQLite database failed integrity check!');
    }

    // 1. Clean stale temporary files
    try {
      const tempFiles = await fs.promises.readdir(this.tempDir);
      for (const tf of tempFiles) {
        const full = path.join(this.tempDir, tf);
        await fs.promises.unlink(full).catch(() => {});
      }
      if (tempFiles.length > 0) {
        details.push(`Cleaned up ${tempFiles.length} incomplete/interrupted temporary import file(s).`);
      }
    } catch {}

    // 2. Scan physical objects and check vs DB
    const allDbObjects = this.dbService.getAllObjects();
    let missingObjectsCount = 0;
    let corruptedObjectsCount = 0;

    for (const obj of allDbObjects) {
      const p = this.getObjectPath(obj.hash);
      if (!fs.existsSync(p)) {
        missingObjectsCount++;
        details.push(`Missing physical object for hash: ${obj.hash.slice(0, 12)}...`);
      } else {
        const stat = await fs.promises.stat(p);
        if (stat.size !== obj.size) {
          corruptedObjectsCount++;
          details.push(`Size mismatch for object ${obj.hash.slice(0, 12)}... (expected ${obj.size}B, got ${stat.size}B)`);
        }
      }
    }

    // 3. Scan physical files on disk for orphans (files on disk not in DB)
    let orphanedObjectsCount = 0;
    try {
      const prefixDirs = await fs.promises.readdir(this.objectsDir);
      for (const prefix of prefixDirs) {
        const prefixPath = path.join(this.objectsDir, prefix);
        const stat = await fs.promises.stat(prefixPath);
        if (stat.isDirectory()) {
          const files = await fs.promises.readdir(prefixPath);
          for (const f of files) {
            const fullHash = f;
            const dbObj = this.dbService.getObject(fullHash);
            if (!dbObj) {
              orphanedObjectsCount++;
              details.push(`Orphaned file object found on disk: ${fullHash.slice(0, 12)}...`);
            }
          }
        }
      }
    } catch {}

    return {
      timestamp: new Date().toISOString(),
      databaseValid: dbValid,
      orphanedObjectsCount,
      missingObjectsCount,
      repairedRecordsCount: 0,
      corruptedObjectsCount,
      details,
    };
  }

  public getStoragePath(): string {
    return this.baseDir;
  }
}
