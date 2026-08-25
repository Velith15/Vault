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
      if (typeof fs.statfs === 'function') {
        const stats = await fs.promises.statfs(this.baseDir);
        const bsize = stats.bsize || 4096;
        totalDiskSpace = stats.blocks * bsize;
        availableDiskSpace = stats.bavail * bsize;
        usedDiskSpace = totalDiskSpace - availableDiskSpace;
      }
    } catch {}

    return {
      totalDiskSpace,
      availableDiskSpace,
      usedDiskSpace,
      vaultManagedBytes: dbSummary.vaultManagedBytes,
      vaultRawLogicalBytes: dbSummary.vaultRawLogicalBytes,
      vaultUniqueLogicalBytes: dbSummary.vaultUniqueLogicalBytes,
      deduplicatedSavingsBytes: dbSummary.deduplicatedSavingsBytes,
      compressionSavingsBytes: dbSummary.compressionSavingsBytes,
      totalSavingsBytes: dbSummary.totalSavingsBytes,
      overallReductionPercentage: dbSummary.overallReductionPercentage,
      totalFiles: dbSummary.totalFiles,
      totalFolders: dbSummary.totalFolders,
      totalObjects: dbSummary.totalObjects,
      compressedObjectsCount: dbSummary.compressedObjectsCount,
      vaultPath: this.baseDir,
      categorySavings: dbSummary.categorySavings,
    };
  }
}
