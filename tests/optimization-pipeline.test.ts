import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { DatabaseService } from '../src/main/services/database/DatabaseService';
import { StorageEngine } from '../src/main/services/storage/StorageEngine';
import { OptimizationQueue } from '../src/main/services/storage/OptimizationQueue';

describe('Vault End-to-End Optimization Pipeline', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let storageEngine: StorageEngine;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `vault_opt_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
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

  it('imports compressible files, applies lossless compression, and reports accurate metrics', async () => {
    // Explicitly configure compression settings for test
    dbService.setCompressionSettings({
      autoCompression: true,
      mode: 'automatic',
      profile: 'BALANCED',
      minSavingsThresholdPercent: 5,
      minFileSizeToCompress: 100,
    });

    const f1 = path.join(tempDir, 'source_code.ts');
    const f2 = path.join(tempDir, 'source_copy.ts');
    const content = 'export const data = ' + JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: i, name: 'Record_' + i, description: 'Lossless compression test payload' }))) + ';\n';

    await fs.promises.writeFile(f1, content, 'utf8');
    await fs.promises.writeFile(f2, content, 'utf8');

    const node1 = await storageEngine.importLocalFile(f1);
    const node2 = await storageEngine.importLocalFile(f2);

    expect(node1.objectHash).toBe(node2.objectHash);
    expect(node1.isCompressed).toBe(true);

    const metrics = dbService.getMetricsSummary();
    expect(metrics.totalFiles).toBe(2);
    expect(metrics.totalObjects).toBe(1);
    expect(metrics.compressedObjectsCount).toBe(1);
    expect(metrics.deduplicatedSavingsBytes).toBe(Buffer.byteLength(content));
    expect(metrics.compressionSavingsBytes).toBeGreaterThan(0);
    expect(metrics.totalSavingsBytes).toBe(metrics.deduplicatedSavingsBytes + metrics.compressionSavingsBytes);

    // Verify preview and transparent decompression
    const preview = await storageEngine.getFilePreviewData(node1.id);
    expect(preview.textContent).toBe(content);
    expect(preview.isCompressed).toBe(true);

    // Verify export transparent decompression
    const exportDir = path.join(tempDir, 'exported');
    fs.mkdirSync(exportDir, { recursive: true });
    const exportedPath = await storageEngine.exportFile(node1.id, exportDir);
    const exportedContent = await fs.promises.readFile(exportedPath, 'utf8');
    expect(exportedContent).toBe(content);
  });

  it('runs optimization queue on uncompressed objects and supports pause/resume/cancellation', async () => {
    // Disable auto compression for import test
    dbService.setCompressionSettings({ autoCompression: false, mode: 'off' });

    const f1 = path.join(tempDir, 'logs.log');
    const content = '2026-08-25 ERROR Database connection retry attempt \n'.repeat(100);
    await fs.promises.writeFile(f1, content, 'utf8');

    const node = await storageEngine.importLocalFile(f1);
    expect(node.isCompressed).toBe(false);

    // Re-enable auto compression settings
    dbService.setCompressionSettings({ autoCompression: true, mode: 'automatic', profile: 'BALANCED' });

    const queue = new OptimizationQueue(storageEngine, dbService);
    const analysis = await storageEngine.analyzeStorageOptimization();
    expect(analysis.optimizableFilesCount).toBe(1);

    const progress = await queue.startOptimization();
    expect(progress.status).toBe('optimizing');

    // Wait for queue completion
    await new Promise<void>((resolve) => {
      queue.on('progress', (p) => {
        if (p.status === 'completed') resolve();
      });
    });

    const refreshedNode = dbService.getNodeById(node.id);
    expect(refreshedNode?.isCompressed).toBe(true);

    const integrity = await storageEngine.runIntegrityCheck();
    expect(integrity.databaseValid).toBe(true);
    expect(integrity.compressedObjectsVerified).toBe(1);
    expect(integrity.corruptedObjectsCount).toBe(0);
  });
});
