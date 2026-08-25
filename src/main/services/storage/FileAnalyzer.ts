import path from 'path';

export type CompressibilityCategory = 
  | 'HIGHLY_COMPRESSIBLE' 
  | 'COMPRESSIBLE' 
  | 'LOW_BENEFIT' 
  | 'ALREADY_COMPRESSED' 
  | 'UNSUPPORTED';

export interface FileAnalysisResult {
  category: CompressibilityCategory;
  estimatedSavingsRatio: number; // e.g. 0.70 for 70% estimated reduction
  isRecommendedForCompression: boolean;
  reason: string;
}

export class FileAnalyzer {
  private static readonly HIGHLY_COMPRESSIBLE_EXTS = new Set([
    '.txt', '.json', '.csv', '.xml', '.log', '.md', '.markdown',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx',
    '.py', '.sql', '.sh', '.bash', '.bat', '.ps1', '.cmd',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.java', '.kt',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties',
    '.svg', '.rtf', '.tex', '.bib'
  ]);

  private static readonly COMPRESSIBLE_EXTS = new Set([
    '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp',
    '.epub', '.mobi', '.wasm', '.bin', '.dat', '.db', '.sqlite'
  ]);

  private static readonly ALREADY_COMPRESSED_EXTS = new Set([
    // Images
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif',
    // Video
    '.mp4', '.mkv', '.mov', '.avi', '.wmv', '.webm', '.flv', '.m4v',
    // Audio
    '.mp3', '.aac', '.ogg', '.m4a', '.flac', '.opus', '.wma',
    // Archives & Compressed Packages
    '.zip', '.rar', '.7z', '.tar.gz', '.tgz', '.gz', '.bz2', '.xz',
    '.zst', '.iso', '.dmg', '.pkg', '.apk', '.jar', '.war'
  ]);

  /**
   * Analyzes file characteristics and classifies compression suitability.
   */
  public static analyzeFile(fileName: string, mimeType?: string | null, size: number = 0): FileAnalysisResult {
    const ext = path.extname(fileName).toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    // 1. Files smaller than 128 bytes usually suffer header overhead
    if (size > 0 && size < 128) {
      return {
        category: 'LOW_BENEFIT',
        estimatedSavingsRatio: 0,
        isRecommendedForCompression: false,
        reason: 'File is smaller than minimal compression threshold (128 B)',
      };
    }

    // 2. High-confidence text & code extensions ALWAYS take precedence (e.g. .ts is TypeScript, not MPEG-2 transport stream)
    if (this.HIGHLY_COMPRESSIBLE_EXTS.has(ext)) {
      return {
        category: 'HIGHLY_COMPRESSIBLE',
        estimatedSavingsRatio: 0.65, // ~65% estimated average
        isRecommendedForCompression: true,
        reason: 'Structured text or source code format with high entropy redundancy',
      };
    }

    // 3. Check for known already compressed formats
    if (this.ALREADY_COMPRESSED_EXTS.has(ext)) {
      return {
        category: 'ALREADY_COMPRESSED',
        estimatedSavingsRatio: 0.02,
        isRecommendedForCompression: false,
        reason: 'File format is already internally compressed',
      };
    }

    if (
      mime.startsWith('image/jpeg') ||
      mime.startsWith('image/png') ||
      mime.startsWith('image/webp') ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      mime.includes('zip') ||
      mime.includes('compressed') ||
      mime.includes('7z')
    ) {
      return {
        category: 'ALREADY_COMPRESSED',
        estimatedSavingsRatio: 0.02,
        isRecommendedForCompression: false,
        reason: 'MIME type indicates already-compressed media or archive',
      };
    }

    // 3. Check for highly compressible text/code formats
    if (
      this.HIGHLY_COMPRESSIBLE_EXTS.has(ext) ||
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('javascript') ||
      mime.includes('typescript')
    ) {
      return {
        category: 'HIGHLY_COMPRESSIBLE',
        estimatedSavingsRatio: 0.65, // ~65% estimated average
        isRecommendedForCompression: true,
        reason: 'Structured text or source code format with high entropy redundancy',
      };
    }

    // 4. Check for structured documents
    if (
      this.COMPRESSIBLE_EXTS.has(ext) ||
      mime.includes('pdf') ||
      mime.includes('document') ||
      mime.includes('sheet') ||
      mime.includes('presentation')
    ) {
      return {
        category: 'COMPRESSIBLE',
        estimatedSavingsRatio: 0.25, // ~25% estimated average
        isRecommendedForCompression: true,
        reason: 'Structured document format with moderate compressibility',
      };
    }

    // 5. General fallback: allow attempt
    return {
      category: 'COMPRESSIBLE',
      estimatedSavingsRatio: 0.20,
      isRecommendedForCompression: true,
      reason: 'General binary or unstructured format',
    };
  }

  /**
   * Fast Shannon Entropy sampling to estimate buffer compressibility without running full compression.
   */
  public static calculateEntropy(sampleBuffer: Buffer): number {
    if (!sampleBuffer || sampleBuffer.length === 0) return 0;

    const sampleLen = Math.min(sampleBuffer.length, 64 * 1024); // 64KB sample
    const frequencies = new Uint32Array(256);

    for (let i = 0; i < sampleLen; i++) {
      frequencies[sampleBuffer[i]]++;
    }

    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const p = frequencies[i] / sampleLen;
        entropy -= p * Math.log2(p);
      }
    }

    return entropy; // Values between 0 (highly redundant) and 8 (maximum randomness/compressed)
  }
}
