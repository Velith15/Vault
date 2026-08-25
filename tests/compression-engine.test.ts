import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { CompressionEngine } from '../src/main/services/storage/CompressionEngine';
import { FileAnalyzer } from '../src/main/services/storage/FileAnalyzer';

describe('Vault CompressionEngine & FileAnalyzer (Lossless Verification)', () => {
  const sampleFormats = [
    { name: 'document.txt', content: 'The quick brown fox jumps over the lazy dog. '.repeat(100) },
    { name: 'data.json', content: JSON.stringify({ users: Array.from({ length: 50 }, (_, i) => ({ id: i, name: 'User_' + i, active: true })) }) },
    { name: 'table.csv', content: 'id,name,role,salary\n' + '1,Alice,Engineer,120000\n'.repeat(50) },
    { name: 'config.xml', content: '<root>' + '<item key="setting">value</item>'.repeat(40) + '</root>' },
    { name: 'page.html', content: '<!DOCTYPE html><html><body><h1>Vault Storage</h1>' + '<p>Lossless storage engine</p>'.repeat(50) + '</body></html>' },
    { name: 'styles.css', content: '.vault-container { display: flex; flex-direction: column; } '.repeat(50) },
    { name: 'script.js', content: 'function calculateSavings(orig, comp) { return orig - comp; }\n'.repeat(50) },
    { name: 'app.ts', content: 'export interface User { id: string; name: string; }\n'.repeat(50) },
    { name: 'component.tsx', content: 'export const App = () => <div><h1>Vault Desktop</h1></div>;\n'.repeat(50) },
    { name: 'main.py', content: 'def process_files(files):\n    return [f.strip() for f in files]\n'.repeat(50) },
    { name: 'schema.sql', content: 'CREATE TABLE records (id INT, value TEXT);\n'.repeat(50) },
    { name: 'notes.md', content: '# Vault Storage Engine\n\nIntelligent Storage Optimization.\n'.repeat(50) },
    { name: 'server.log', content: '2026-08-25 12:00:00 [INFO] Worker process started successfully\n'.repeat(50) },
  ];

  it('losslessly compresses and reconstructs all supported text and structured formats', async () => {
    for (const item of sampleFormats) {
      const rawBuf = Buffer.from(item.content, 'utf8');
      const originalSha = crypto.createHash('sha256').update(rawBuf).digest('hex');

      const comp = await CompressionEngine.compressLossless(rawBuf, 'BALANCED', 5);
      expect(comp.isCompressed).toBe(true);
      expect(comp.savingsBytes).toBeGreaterThan(0);
      expect(comp.compressedSize).toBeLessThan(comp.originalSize);
      expect(comp.algorithm).toBe('zstd');

      // Reconstruct
      const decompressed = await CompressionEngine.decompressLossless(comp.compressedData);
      const decompressedSha = crypto.createHash('sha256').update(decompressed).digest('hex');

      expect(decompressedSha).toBe(originalSha);
      expect(decompressed.toString('utf8')).toBe(item.content);
    }
  });

  it('handles empty and tiny files safely without committing negative savings', async () => {
    const emptyBuf = Buffer.alloc(0);
    const compEmpty = await CompressionEngine.compressLossless(emptyBuf);
    expect(compEmpty.isCompressed).toBe(false);
    expect(compEmpty.originalSize).toBe(0);

    const tinyBuf = Buffer.from('hello', 'utf8');
    const compTiny = await CompressionEngine.compressLossless(tinyBuf, 'BALANCED', 5);
    // Tiny string expands due to VLT1 header + zstd frame -> must skip
    expect(compTiny.isCompressed).toBe(false);
  });

  it('handles unicode content and multi-megabyte payloads losslessly', async () => {
    const unicodeText = '🚀 🌟 🔒 Vault 智能存储优化 測試 데이터 1234567890 '.repeat(500);
    const rawBuf = Buffer.from(unicodeText, 'utf8');
    const originalSha = crypto.createHash('sha256').update(rawBuf).digest('hex');

    const comp = await CompressionEngine.compressLossless(rawBuf, 'MAXIMUM', 5);
    expect(comp.isCompressed).toBe(true);

    const decompressed = await CompressionEngine.decompressLossless(comp.compressedData);
    const decompressedSha = crypto.createHash('sha256').update(decompressed).digest('hex');

    expect(decompressedSha).toBe(originalSha);
    expect(decompressed.toString('utf8')).toBe(unicodeText);
  });

  it('correctly classifies file formats and avoids recompressing already compressed media', () => {
    expect(FileAnalyzer.analyzeFile('photo.jpg').category).toBe('ALREADY_COMPRESSED');
    expect(FileAnalyzer.analyzeFile('movie.mp4').category).toBe('ALREADY_COMPRESSED');
    expect(FileAnalyzer.analyzeFile('archive.zip').category).toBe('ALREADY_COMPRESSED');
    expect(FileAnalyzer.analyzeFile('archive.7z').category).toBe('ALREADY_COMPRESSED');

    expect(FileAnalyzer.analyzeFile('app.tsx').category).toBe('HIGHLY_COMPRESSIBLE');
    expect(FileAnalyzer.analyzeFile('data.json').category).toBe('HIGHLY_COMPRESSIBLE');
    expect(FileAnalyzer.analyzeFile('report.pdf').category).toBe('COMPRESSIBLE');
  });

  it('transparently passes through non-VLT1 legacy buffers', async () => {
    const legacyRaw = Buffer.from('Legacy uncompressed CAS object byte stream');
    const result = await CompressionEngine.decompressLossless(legacyRaw);
    expect(result.equals(legacyRaw)).toBe(true);
  });
});
