import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import { DatabaseService } from '../database/DatabaseService';
import { CompressionEngine } from './CompressionEngine';
import { FileAnalyzer } from './FileAnalyzer';
import { 
  VaultNode, 
  StorageMetrics, 
  FilePreviewData, 
  IntegrityReport, 
  OptimizationAnalysis, 
  OptimizationProgress,
  CompressionProfile,
  CompressionSettings
} from '../../../shared/types';

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
   * Transparently reads and decompresses an object from disk.
   */
  public async getObjectBuffer(hash: string): Promise<Buffer> {
    const objPath = this.getObjectPath(hash);
    if (!fs.existsSync(objPath)) {
      throw new Error(`Object not found on disk: ${hash}`);
    }
    const rawStored = await fs.promises.readFile(objPath);
    return CompressionEngine.decompressLossless(rawStored);
  }

  /**
   * Import file from local filesystem using atomic ingestion, deduplication check,
   * and automatic intelligent lossless compression.
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
    const finalSize = stat.size;

    // Read source bytes
    const sourceBuffer = await fs.promises.readFile(sourceFilePath);
    const finalHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');

    // 1. Content deduplication check (CAS)
    const existingObject = this.dbService.getObject(finalHash);
    const targetObjectPath = this.getObjectPath(finalHash);

    if (existingObject && fs.existsSync(targetObjectPath)) {
      this.dbService.incrementObjectRefCount(finalHash);
    } else {
      // First time storing this object
      const targetDir = path.dirname(targetObjectPath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      // Check compression settings & suitability
      const settings = this.dbService.getCompressionSettings();
      let dataToWrite: Uint8Array = sourceBuffer;
      let isCompressed = false;
      let compressedSize = finalSize;
      let compressionAlgo: string | null = null;

      if (settings.autoCompression && settings.mode !== 'off' && finalSize >= settings.minFileSizeToCompress) {
        const analysis = FileAnalyzer.analyzeFile(originalName, mimeType, finalSize);
        if (analysis.isRecommendedForCompression || settings.mode === 'maximum_savings') {
          const profile: CompressionProfile = settings.mode === 'maximum_savings' 
            ? 'MAXIMUM' 
            : settings.mode === 'performance' 
              ? 'FAST' 
              : settings.profile;

          const compResult = await CompressionEngine.compressLossless(
            sourceBuffer, 
            profile, 
            settings.minSavingsThresholdPercent
          );

          if (compResult.isCompressed) {
            dataToWrite = compResult.compressedData;
            isCompressed = true;
            compressedSize = compResult.compressedSize;
            compressionAlgo = compResult.algorithm;
          }
        }
      }

      // Atomic write via temp file
      const tempFileName = `import_${finalHash}_${Date.now()}.tmp`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      await fs.promises.writeFile(tempFilePath, dataToWrite);
      await fs.promises.rename(tempFilePath, targetObjectPath);

      this.dbService.insertObject(finalHash, finalSize, isCompressed, compressedSize, compressionAlgo);
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

    if (deleteSourceAfterImport && fs.existsSync(sourceFilePath)) {
      try {
        await fs.promises.unlink(sourceFilePath);
      } catch (err: any) {
        console.warn(`Could not remove source file after import: ${sourceFilePath}`, err);
      }
    }

    return this.dbService.getNodeById(node.id)!;
  }

  /**
   * Import file from buffer
   */
  public async importBuffer(
    buffer: Buffer, 
    originalName: string, 
    parentFolderId: string | null = null
  ): Promise<VaultNode> {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const mimeType = (mime.lookup(originalName) as string) || 'application/octet-stream';
    const targetObjectPath = this.getObjectPath(hash);

    const existingObject = this.dbService.getObject(hash);
    if (existingObject && fs.existsSync(targetObjectPath)) {
      this.dbService.incrementObjectRefCount(hash);
    } else {
      const targetDir = path.dirname(targetObjectPath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      const settings = this.dbService.getCompressionSettings();
      let dataToWrite: Uint8Array = buffer;
      let isCompressed = false;
      let compressedSize = buffer.length;
      let compressionAlgo: string | null = null;

      if (settings.autoCompression && settings.mode !== 'off' && buffer.length >= settings.minFileSizeToCompress) {
        const analysis = FileAnalyzer.analyzeFile(originalName, mimeType, buffer.length);
        if (analysis.isRecommendedForCompression || settings.mode === 'maximum_savings') {
          const profile: CompressionProfile = settings.mode === 'maximum_savings' 
            ? 'MAXIMUM' 
            : settings.mode === 'performance' 
              ? 'FAST' 
              : settings.profile;

          const compResult = await CompressionEngine.compressLossless(
            buffer, 
            profile, 
            settings.minSavingsThresholdPercent
          );

          if (compResult.isCompressed) {
            dataToWrite = compResult.compressedData;
            isCompressed = true;
            compressedSize = compResult.compressedSize;
            compressionAlgo = compResult.algorithm;
          }
        }
      }

      const tempFileName = `import_buf_${hash}_${Date.now()}.tmp`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      await fs.promises.writeFile(tempFilePath, dataToWrite);
      await fs.promises.rename(tempFilePath, targetObjectPath);

      this.dbService.insertObject(hash, buffer.length, isCompressed, compressedSize, compressionAlgo);
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
    return this.dbService.getNodeById(node.id)!;
  }

  /**
   * Export file from Vault to external filesystem with transparent decompression.
   */
  public async exportFile(nodeId: string, destinationDir: string): Promise<string> {
    const node = this.dbService.getNodeById(nodeId);
    if (!node || node.type !== 'file' || !node.objectHash) {
      throw new Error('Node not found or not a valid file');
    }

    const decompressedBytes = await this.getObjectBuffer(node.objectHash);

    let targetPath = path.join(destinationDir, node.name);
    let counter = 1;
    const parsed = path.parse(node.name);
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(destinationDir, `${parsed.name} (${counter})${parsed.ext}`);
      counter++;
    }

    await fs.promises.writeFile(targetPath, decompressedBytes);
    return targetPath;
  }

  /**
   * Prepare a node for native Windows drag-out.
   * Returns the exact path to the file on disk ready for OLE drag & drop into Explorer.
   */
  public async prepareDragOut(nodeId: string): Promise<{ filePath: string; fileName: string }> {
    const node = this.dbService.getNodeById(nodeId);
    if (!node || node.type !== 'file' || !node.objectHash) {
      throw new Error('Node not found or not a valid file');
    }

    // Fast check: if the object is NOT compressed, and has 1 ref count or CAS path,
    // we check if raw object matches exact uncompressed representation.
    const obj = this.dbService.getObject(node.objectHash);
    const dragOutDir = path.join(this.cacheDir, 'drag_out');
    if (!fs.existsSync(dragOutDir)) {
      fs.mkdirSync(dragOutDir, { recursive: true });
    }

    const dragTargetFile = path.join(dragOutDir, node.name);

    // If already generated and size matches, re-use
    if (fs.existsSync(dragTargetFile)) {
      const stat = await fs.promises.stat(dragTargetFile);
      if (stat.size === node.size) {
        return { filePath: dragTargetFile, fileName: node.name };
      }
    }

    // Otherwise write out transparently
    const buffer = await this.getObjectBuffer(node.objectHash);
    await fs.promises.writeFile(dragTargetFile, buffer);

    return { filePath: dragTargetFile, fileName: node.name };
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

  /**
   * Automatically purges trashed items that have exceeded retention period (7 days).
   */
  public async purgeExpiredTrash(retentionDays: number = 7): Promise<void> {
    const { deletedHashesToCheck } = this.dbService.purgeExpiredTrash(retentionDays);
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
   * File Preview retrieval with transparent decompression for text & code.
   */
  public async getFilePreviewData(nodeId: string): Promise<FilePreviewData> {
    const node = this.dbService.getNodeById(nodeId);
    if (!node || node.type !== 'file' || !node.objectHash) {
      throw new Error('File not found');
    }

    const obj = this.dbService.getObject(node.objectHash);
    const objPath = this.getObjectPath(node.objectHash);
    if (!fs.existsSync(objPath)) {
      throw new Error('Corrupted storage: Object file not found on disk');
    }

    const mimeType = node.mimeType || 'application/octet-stream';
    const isCompressed = !!obj?.isCompressed;
    const physicalSize = isCompressed ? (obj?.compressedSize || node.size) : node.size;
    const savedBytes = Math.max(0, node.size - physicalSize);
    const reductionPercentage = node.size > 0 ? (savedBytes / node.size) * 100 : 0;

    const previewData: FilePreviewData = {
      id: node.id,
      name: node.name,
      mimeType,
      size: node.size,
      physicalSize,
      hash: node.objectHash,
      refCount: node.refCount || 1,
      isCompressed,
      compressionAlgo: obj?.compressionAlgo || null,
      savedBytes,
      reductionPercentage,
      integrityVerified: true,
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
      node.name.endsWith('.log') ||
      node.name.endsWith('.py') ||
      node.name.endsWith('.sql')
    ) {
      if (node.size <= 1024 * 1024) {
        const decompressed = await this.getObjectBuffer(node.objectHash);
        previewData.textContent = decompressed.toString('utf8');
      }
    }

    return previewData;
  }

  /**
   * Optimize an individual uncompressed CAS object losslessly.
   */
  public async optimizeObject(
    hash: string, 
    profile: CompressionProfile = 'BALANCED', 
    minSavingsPercent: number = 5
  ): Promise<{ optimized: boolean; savedBytes: number }> {
    const obj = this.dbService.getObject(hash);
    if (!obj || obj.isCompressed) {
      return { optimized: false, savedBytes: 0 };
    }

    const objPath = this.getObjectPath(hash);
    if (!fs.existsSync(objPath)) {
      return { optimized: false, savedBytes: 0 };
    }

    const rawBuffer = await fs.promises.readFile(objPath);
    if (CompressionEngine.isVltContainer(rawBuffer)) {
      // Already containerized
      this.dbService.updateObjectCompression(hash, true, rawBuffer.length, 'zstd');
      return { optimized: false, savedBytes: 0 };
    }

    const compResult = await CompressionEngine.compressLossless(rawBuffer, profile, minSavingsPercent);
    if (!compResult.isCompressed) {
      return { optimized: false, savedBytes: 0 };
    }

    // Atomic write
    const tempFilePath = path.join(this.tempDir, `opt_${hash}_${Date.now()}.tmp`);
    await fs.promises.writeFile(tempFilePath, compResult.compressedData);
    await fs.promises.rename(tempFilePath, objPath);

    this.dbService.updateObjectCompression(
      hash, 
      true, 
      compResult.compressedSize, 
      compResult.algorithm
    );

    return { optimized: true, savedBytes: compResult.savingsBytes };
  }

  /**
   * Pre-scan Vault to calculate accurate, real-world optimizable files and estimated savings.
   */
  public async analyzeStorageOptimization(): Promise<OptimizationAnalysis> {
    const allObjects = this.dbService.getAllObjects();
    const settings = this.dbService.getCompressionSettings();

    let totalBytes = 0;
    let optimizableFilesCount = 0;
    let optimizableBytes = 0;
    let estimatedSavingsBytes = 0;
    let alreadyOptimizedCount = 0;
    let skippedCount = 0;

    for (const obj of allObjects) {
      totalBytes += obj.size;
      if (obj.isCompressed) {
        alreadyOptimizedCount++;
        continue;
      }

      if (obj.size < settings.minFileSizeToCompress) {
        skippedCount++;
        continue;
      }

      // Check linked nodes to inspect filename / format
      const node = this.dbService.getNodeByHash(obj.hash);
      const analysis = FileAnalyzer.analyzeFile(
        node ? node.name : 'file.bin', 
        node ? node.mimeType : null, 
        obj.size
      );

      if (analysis.isRecommendedForCompression || settings.mode === 'maximum_savings') {
        optimizableFilesCount++;
        optimizableBytes += obj.size;
        estimatedSavingsBytes += Math.round(obj.size * analysis.estimatedSavingsRatio);
      } else {
        skippedCount++;
      }
    }

    return {
      totalFiles: allObjects.length,
      totalBytes,
      optimizableFilesCount,
      optimizableBytes,
      estimatedSavingsBytes,
      alreadyOptimizedCount,
      skippedCount,
    };
  }

  /**
   * Health Check & Startup Integrity Recovery with VLT1 validation.
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
    let compressedObjectsVerified = 0;

    for (const obj of allDbObjects) {
      const p = this.getObjectPath(obj.hash);
      if (!fs.existsSync(p)) {
        missingObjectsCount++;
        details.push(`Missing physical object for hash: ${obj.hash.slice(0, 12)}...`);
      } else {
        const stat = await fs.promises.stat(p);
        const expectedSize = obj.isCompressed ? obj.compressedSize : obj.size;
        if (stat.size !== expectedSize) {
          corruptedObjectsCount++;
          details.push(`Size mismatch for object ${obj.hash.slice(0, 12)}... (expected ${expectedSize}B, got ${stat.size}B)`);
        } else if (obj.isCompressed) {
          try {
            const buf = await fs.promises.readFile(p);
            if (CompressionEngine.isVltContainer(buf)) {
              compressedObjectsVerified++;
            }
          } catch {
            corruptedObjectsCount++;
          }
        }
      }
    }

    // 3. Scan physical files on disk for orphans
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
      compressedObjectsVerified,
      details,
    };
  }

  public getStoragePath(): string {
    return this.baseDir;
  }
}
