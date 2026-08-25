import { EventEmitter } from 'events';
import { StorageEngine } from './StorageEngine';
import { DatabaseService } from '../database/DatabaseService';
import { OptimizationProgress, CompressionProfile } from '../../../shared/types';

export class OptimizationQueue extends EventEmitter {
  private storageEngine: StorageEngine;
  private dbService: DatabaseService;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private shouldCancel: boolean = false;

  private progress: OptimizationProgress = {
    status: 'idle',
    totalToProcess: 0,
    processedCount: 0,
    optimizedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    bytesProcessed: 0,
    bytesSaved: 0,
    currentFileName: '',
    speedBytesPerSec: 0,
    percent: 0,
    error: null,
    integrityVerified: true,
  };

  constructor(storageEngine: StorageEngine, dbService: DatabaseService) {
    super();
    this.storageEngine = storageEngine;
    this.dbService = dbService;
  }

  public getProgress(): OptimizationProgress {
    return { ...this.progress };
  }

  public async startOptimization(profile?: CompressionProfile): Promise<OptimizationProgress> {
    if (this.isRunning) {
      if (this.isPaused) {
        this.resume();
      }
      return this.getProgress();
    }

    this.isRunning = true;
    this.isPaused = false;
    this.shouldCancel = false;

    const settings = this.dbService.getCompressionSettings();
    const effectiveProfile = profile || settings.profile;

    const uncompressedObjects = this.dbService.getAllObjects().filter(o => !o.isCompressed);

    this.progress = {
      status: 'optimizing',
      totalToProcess: uncompressedObjects.length,
      processedCount: 0,
      optimizedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      bytesProcessed: 0,
      bytesSaved: 0,
      currentFileName: '',
      speedBytesPerSec: 0,
      percent: 0,
      error: null,
      integrityVerified: true,
    };

    this.emitProgress();

    // Asynchronously process in background
    this.processQueue(uncompressedObjects, effectiveProfile, settings.minSavingsThresholdPercent);
    return this.getProgress();
  }

  private async processQueue(objects: any[], profile: CompressionProfile, minSavings: number) {
    const startTime = Date.now();
    let totalBytesInRun = 0;

    for (let i = 0; i < objects.length; i++) {
      if (this.shouldCancel) {
        this.progress.status = 'cancelled';
        this.isRunning = false;
        this.emitProgress();
        return;
      }

      while (this.isPaused) {
        await new Promise(r => setTimeout(r, 200));
        if (this.shouldCancel) {
          this.progress.status = 'cancelled';
          this.isRunning = false;
          this.emitProgress();
          return;
        }
      }

      const obj = objects[i];
      const node = this.dbService.getNodeByHash(obj.hash);
      this.progress.currentFileName = node ? node.name : obj.hash.slice(0, 8);

      try {
        const res = await this.storageEngine.optimizeObject(obj.hash, profile, minSavings);
        if (res.optimized) {
          this.progress.optimizedCount++;
          this.progress.bytesSaved += res.savedBytes;
        } else {
          this.progress.skippedCount++;
        }
      } catch (err: any) {
        this.progress.failedCount++;
        console.error(`[OptimizationQueue] Error optimizing ${obj.hash}:`, err);
      }

      this.progress.processedCount++;
      this.progress.bytesProcessed += obj.size;
      totalBytesInRun += obj.size;

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      this.progress.speedBytesPerSec = Math.round(totalBytesInRun / elapsedSec);
      this.progress.percent = Math.min(100, Math.round((this.progress.processedCount / this.progress.totalToProcess) * 100));

      this.emitProgress();

      // CPU Throttling yield (delay to avoid maxing out 100% CPU on low priority)
      const settings = this.dbService.getCompressionSettings();
      const cpuLimit = settings.backgroundCpuLimitPercent || 50;
      if (cpuLimit < 100) {
        const sleepMs = Math.round((100 - cpuLimit) / 5);
        if (sleepMs > 0) await new Promise(r => setTimeout(r, sleepMs));
      }
    }

    this.progress.status = 'completed';
    this.isRunning = false;
    this.progress.currentFileName = '';
    this.emitProgress();
  }

  public pause(): void {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.progress.status = 'paused';
      this.emitProgress();
    }
  }

  public resume(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.progress.status = 'optimizing';
      this.emitProgress();
    }
  }

  public cancel(): void {
    if (this.isRunning) {
      this.shouldCancel = true;
      this.isPaused = false;
    }
  }

  private emitProgress(): void {
    this.emit('progress', this.getProgress());
  }
}
