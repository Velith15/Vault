import crypto from 'crypto';
import { compress as zstdCompress, decompress as zstdDecompress } from '@mongodb-js/zstd';
import { CompressionProfile } from '../../../shared/types';

export const VLT_MAGIC = Buffer.from('VLT1', 'ascii'); // 4 bytes magic header
export const VLT_VERSION = 1;

export interface VltHeader {
  version: number;
  algorithm: 'zstd';
  level: number;
  originalSize: number;
  compressedSize: number;
  originalSha256: string;
  compressedSha256: string;
  createdAt: string;
}

export interface CompressionResult {
  isCompressed: boolean;
  compressedData: Buffer;
  originalSize: number;
  compressedSize: number;
  savingsBytes: number;
  savingsPercentage: number;
  algorithm: string | null;
  level: number;
  originalSha256: string;
  compressedSha256: string | null;
}

export class CompressionEngine {
  /**
   * Map profiles to Zstandard compression levels.
   */
  public static getLevelForProfile(profile: CompressionProfile): number {
    switch (profile) {
      case 'FAST':
        return 1;
      case 'MAXIMUM':
        return 9;
      case 'BALANCED':
      default:
        return 3;
    }
  }

  /**
   * Checks if buffer contains the Vault VLT1 storage container magic header.
   */
  public static isVltContainer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 6) return false;
    return buffer.subarray(0, 4).equals(VLT_MAGIC);
  }

  /**
   * Packs raw payload into a versioned VLT1 binary container with JSON metadata.
   */
  public static packVltContainer(header: VltHeader, payload: Buffer): Buffer {
    const headerJson = Buffer.from(JSON.stringify(header), 'utf8');
    if (headerJson.length > 65535) {
      throw new Error('VLT container header exceeds maximum 64KB limit');
    }

    const headerLengthBuf = Buffer.alloc(2);
    headerLengthBuf.writeUInt16BE(headerJson.length, 0);

    return Buffer.concat([
      VLT_MAGIC,
      headerLengthBuf,
      headerJson,
      payload,
    ]);
  }

  /**
   * Unpacks a VLT1 container into header metadata and compressed payload.
   */
  public static unpackVltContainer(containerBuffer: Buffer): { header: VltHeader; payload: Buffer } {
    if (!this.isVltContainer(containerBuffer)) {
      throw new Error('Not a valid VLT1 container');
    }

    const headerLen = containerBuffer.readUInt16BE(4);
    if (containerBuffer.length < 6 + headerLen) {
      throw new Error('Corrupt VLT1 container: truncated header');
    }

    const headerJsonStr = containerBuffer.subarray(6, 6 + headerLen).toString('utf8');
    const header: VltHeader = JSON.parse(headerJsonStr);
    const payload = containerBuffer.subarray(6 + headerLen);

    return { header, payload };
  }

  /**
   * Losslessly compresses buffer with atomic byte-for-byte SHA-256 verification.
   * If savings are lower than minSavingsPercent or verification fails, returns isCompressed: false.
   */
  public static async compressLossless(
    rawBuffer: Buffer,
    profile: CompressionProfile = 'BALANCED',
    minSavingsPercent: number = 5
  ): Promise<CompressionResult> {
    const originalSize = rawBuffer.length;
    const originalSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    // Never compress empty files into container overhead
    if (originalSize === 0) {
      return {
        isCompressed: false,
        compressedData: rawBuffer,
        originalSize: 0,
        compressedSize: 0,
        savingsBytes: 0,
        savingsPercentage: 0,
        algorithm: null,
        level: 0,
        originalSha256,
        compressedSha256: null,
      };
    }

    const level = this.getLevelForProfile(profile);
    const compressedPayload = await zstdCompress(rawBuffer, level);

    const compressedSha256 = crypto.createHash('sha256').update(compressedPayload).digest('hex');
    const header: VltHeader = {
      version: VLT_VERSION,
      algorithm: 'zstd',
      level,
      originalSize,
      compressedSize: compressedPayload.length,
      originalSha256,
      compressedSha256,
      createdAt: new Date().toISOString(),
    };

    const vltContainer = this.packVltContainer(header, compressedPayload);
    const totalStoredSize = vltContainer.length;
    const savingsBytes = originalSize - totalStoredSize;
    const savingsPercentage = (savingsBytes / originalSize) * 100;

    // Check threshold: never commit if savings are below threshold or if file grew
    if (savingsPercentage < minSavingsPercent || savingsBytes <= 0) {
      return {
        isCompressed: false,
        compressedData: rawBuffer,
        originalSize,
        compressedSize: originalSize,
        savingsBytes: 0,
        savingsPercentage: 0,
        algorithm: null,
        level,
        originalSha256,
        compressedSha256: null,
      };
    }

    // MANDATORY LOSSLESS VERIFICATION: decompress & match SHA-256
    const decompressed = await zstdDecompress(compressedPayload);
    const decompressedSha256 = crypto.createHash('sha256').update(decompressed).digest('hex');

    if (decompressedSha256 !== originalSha256) {
      console.error('[CompressionEngine] CRITICAL: Hash mismatch during verification! Aborting compression.');
      return {
        isCompressed: false,
        compressedData: rawBuffer,
        originalSize,
        compressedSize: originalSize,
        savingsBytes: 0,
        savingsPercentage: 0,
        algorithm: null,
        level,
        originalSha256,
        compressedSha256: null,
      };
    }

    return {
      isCompressed: true,
      compressedData: vltContainer,
      originalSize,
      compressedSize: totalStoredSize,
      savingsBytes,
      savingsPercentage,
      algorithm: 'zstd',
      level,
      originalSha256,
      compressedSha256,
    };
  }

  /**
   * Transparently decompresses a storage object buffer.
   * If not a VLT1 container, returns original buffer untouched (backward-compatible).
   */
  public static async decompressLossless(storedBuffer: Buffer): Promise<Buffer> {
    if (!storedBuffer || storedBuffer.length === 0) {
      return storedBuffer;
    }

    if (!this.isVltContainer(storedBuffer)) {
      // Legacy uncompressed CAS object
      return storedBuffer;
    }

    const { header, payload } = this.unpackVltContainer(storedBuffer);
    const decompressed = await zstdDecompress(payload);

    // Verify integrity
    const computedSha = crypto.createHash('sha256').update(decompressed).digest('hex');
    if (computedSha !== header.originalSha256) {
      throw new Error(`Data corruption detected: SHA-256 hash mismatch on decompression (expected ${header.originalSha256}, got ${computedSha})`);
    }

    return decompressed;
  }
}
