import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { DatabaseService } from '../src/main/services/database/DatabaseService';
import { StorageEngine } from '../src/main/services/storage/StorageEngine';

describe('Vault Storage Engine & Database Service', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let storageEngine: StorageEngine;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `vault_test_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'metadata', 'vault.db');
    dbService = new DatabaseService(dbPath);
    storageEngine = new StorageEngine(tempDir, dbService);
  });

  afterEach(async () => {
    dbService.close();
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates folders and handles hierarchy navigation', () => {
    const rootFolder = storageEngine.createFolder('Projects');
    expect(rootFolder.name).toBe('Projects');
    expect(rootFolder.type).toBe('folder');

    const subFolder = storageEngine.createFolder('Vault Core', rootFolder.id);
    expect(subFolder.parentId).toBe(rootFolder.id);

    const rootNodes = dbService.getNodes({ parentId: null });
    expect(rootNodes.length).toBe(1);
    expect(rootNodes[0].id).toBe(rootFolder.id);

    const subNodes = dbService.getNodes({ parentId: rootFolder.id });
    expect(subNodes.length).toBe(1);
    expect(subNodes[0].id).toBe(subFolder.id);

    const ancestors = dbService.getFolderAncestors(subFolder.id);
    expect(ancestors.length).toBe(2);
    expect(ancestors[0].name).toBe('Projects');
    expect(ancestors[1].name).toBe('Vault Core');
  });

  it('imports a local file, computes SHA-256 and creates CAS object', async () => {
    const sampleFilePath = path.join(tempDir, 'sample.txt');
    const content = 'Hello Vault Storage Engine! Safe and local-first.';
    await fs.promises.writeFile(sampleFilePath, content, 'utf8');

    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

    const node = await storageEngine.importLocalFile(sampleFilePath);
    expect(node.name).toBe('sample.txt');
    expect(node.size).toBe(Buffer.byteLength(content));
    expect(node.objectHash).toBe(expectedHash);

    const casPath = storageEngine.getObjectPath(expectedHash);
    expect(fs.existsSync(casPath)).toBe(true);

    const storedContent = await fs.promises.readFile(casPath, 'utf8');
    expect(storedContent).toBe(content);
  });

  it('deduplicates identical files without writing extra disk objects', async () => {
    const file1 = path.join(tempDir, 'fileA.txt');
    const file2 = path.join(tempDir, 'fileB_copy.txt');
    const duplicateContent = 'Exact duplicate bytes to verify deduplication.';

    await fs.promises.writeFile(file1, duplicateContent, 'utf8');
    await fs.promises.writeFile(file2, duplicateContent, 'utf8');

    const node1 = await storageEngine.importLocalFile(file1);
    const node2 = await storageEngine.importLocalFile(file2);

    expect(node1.objectHash).toBe(node2.objectHash);

    const casObject = dbService.getObject(node1.objectHash!);
    expect(casObject?.refCount).toBe(2);

    const metrics = dbService.getMetricsSummary();
    expect(metrics.totalFiles).toBe(2);
    expect(metrics.totalObjects).toBe(1);
    expect(metrics.deduplicatedSavingsBytes).toBe(Buffer.byteLength(duplicateContent));
  });

  it('trashes, restores, and safely reference-count deletes objects', async () => {
    const file1 = path.join(tempDir, 'test1.txt');
    const file2 = path.join(tempDir, 'test2.txt');
    const content = 'Shared reference lifecycle testing';

    await fs.promises.writeFile(file1, content);
    await fs.promises.writeFile(file2, content);

    const node1 = await storageEngine.importLocalFile(file1);
    const node2 = await storageEngine.importLocalFile(file2);
    const hash = node1.objectHash!;

    // Trash node1
    dbService.trashNode(node1.id, true);
    let activeNodes = dbService.getNodes({ parentId: null });
    expect(activeNodes.length).toBe(1);
    expect(activeNodes[0].id).toBe(node2.id);

    // Restore node1
    dbService.trashNode(node1.id, false);
    activeNodes = dbService.getNodes({ parentId: null });
    expect(activeNodes.length).toBe(2);

    // Permanently delete node1 (node2 still points to object, so CAS file remains)
    await storageEngine.deletePermanently(node1.id);
    let obj = dbService.getObject(hash);
    expect(obj?.refCount).toBe(1);
    expect(fs.existsSync(storageEngine.getObjectPath(hash))).toBe(true);

    // Permanently delete node2 (refCount reaches 0, CAS file must be unlinked)
    await storageEngine.deletePermanently(node2.id);
    obj = dbService.getObject(hash);
    expect(obj).toBeNull();
    expect(fs.existsSync(storageEngine.getObjectPath(hash))).toBe(false);
  });

  it('runs startup integrity check and cleans interrupted staging files', async () => {
    const tempFile = path.join(tempDir, 'temp', 'import_interrupted_123.tmp');
    await fs.promises.writeFile(tempFile, 'half written junk data');

    const report = await storageEngine.runIntegrityCheck();
    expect(report.databaseValid).toBe(true);
    expect(fs.existsSync(tempFile)).toBe(false);
    expect(report.details.some((d) => d.includes('Cleaned up 1'))).toBe(true);
  });

  it('prepares seamless native drag-out files with transparent integrity', async () => {
    const sampleFilePath = path.join(tempDir, 'document_drag.pdf');
    const content = 'PDF dummy payload for native Windows drag and drop test';
    await fs.promises.writeFile(sampleFilePath, content, 'utf8');

    const node = await storageEngine.importLocalFile(sampleFilePath);
    const dragInfo = await storageEngine.prepareDragOut(node.id);

    expect(dragInfo.fileName).toBe('document_drag.pdf');
    expect(fs.existsSync(dragInfo.filePath)).toBe(true);
    const diskContent = await fs.promises.readFile(dragInfo.filePath, 'utf8');
    expect(diskContent).toBe(content);
  });

  it('purges expired trash items older than 7 days', async () => {
    const sampleFilePath = path.join(tempDir, 'expired.txt');
    await fs.promises.writeFile(sampleFilePath, 'test content', 'utf8');
    const node = await storageEngine.importLocalFile(sampleFilePath);

    // Trash node with timestamp 8 days in the past
    const pastDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    dbService.trashNode(node.id, true);
    (dbService as any).db.prepare('UPDATE nodes SET trashed_at = ? WHERE id = ?').run(pastDate, node.id);

    await storageEngine.purgeExpiredTrash(7);
    const fetched = dbService.getNodeById(node.id);
    expect(fetched).toBeNull();
  });
});
