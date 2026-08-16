import fs from 'fs';
import { DatabaseService } from '../database/DatabaseService';
import { StorageMetrics } from '../../../shared/types';

export class StorageMetricsService {
  private baseDir: string;
  private dbService: DatabaseService;

  constructor(vaultDir: string, dbService: DatabaseService) {
    this.baseDir = vaultDir;
    this.dbService = dbService;
  }

  public async getMetrics(): Promise<StorageMetrics> {
    const dbSummary = this.dbService.getMetricsSummary();

    let totalDiskSpace = 512 * 1024 * 1024 * 1024; // fallback 512 GB
    let availableDiskSpace = 256 * 1024 * 1024 * 1024; // fallback 256 GB
    let usedDiskSpace = 256 * 1024 * 1024 * 1024;

    try {
      // Node.js v18.15+ supports fs.statfs
      if (typeof fs.statfs === 'function') {
        const stats = await fs.promises.statfs(this.baseDir);
        const bsize = stats.bsize || 4096;
        totalDiskSpace = stats.blocks * bsize;
        availableDiskSpace = stats.bavail * bsize;
        usedDiskSpace = totalDiskSpace - availableDiskSpace;
      }
    } catch {
      // Keep sensible fallbacks if statfs fails on specific permissions
    }

    return {
      totalDiskSpace,
      availableDiskSpace,
      usedDiskSpace,
      vaultManagedBytes: dbSummary.vaultManagedBytes,
      vaultRawLogicalBytes: dbSummary.vaultRawLogicalBytes,
      deduplicatedSavingsBytes: dbSummary.deduplicatedSavingsBytes,
      totalFiles: dbSummary.totalFiles,
      totalFolders: dbSummary.totalFolders,
      totalObjects: dbSummary.totalObjects,
      vaultPath: this.baseDir,
    };
  }
}
