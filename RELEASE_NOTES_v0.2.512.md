# Vault v0.2.512 — Intelligent Storage Optimization & Native Drag & Drop

## 🚀 What's New

### 1. ⚡ Intelligent Storage Optimization (Lossless Zstandard Engine)
- **VLT1 Binary Container Specification**: Packaged with lossless Zstd compression and custom binary header verification metadata.
- **Zero Quality Loss Guarantee**: Mandatory SHA-256 integrity verification (`hash(decompressed) === hash(original)`) executed on every compression before committing to disk.
- **Format Intelligence & Entropy Analysis**: Automatically identifies already-compressed media formats (JPEG, PNG, WebP, MP4, MP3, ZIP, 7Z, RAR) and skips them to eliminate CPU waste and prevent container bloat.
- **5% Minimum Savings Threshold**: Discards inefficient compressions to ensure only meaningful byte reductions are stored.
- **Background Optimization Queue**: Pause, resume, and cancel background compression runs with live progress, CPU throttling, and real-time disk savings metrics.

### 2. 🗂️ Native Windows Drag-and-Drop
- Drag any file directly from Vault into Windows Explorer, desktop folders, web browsers, Discord, Slack, VS Code, or other applications without exporting or creating temporary copies first.
- Compact & crisp drag previews: 48x48 thumbnail previews for image files and 32x32 minimal icons for documents and code.

### 3. 🗑️ 7-Day Trash Retention & Auto-Purge
- Deleting files now safely moves them to the **Trash** with an automatic **7-day retention period**.
- Added background auto-purge cleanup on application startup for expired items and unreferenced Content-Addressed Storage objects.
- Permanent deletion and instant shredding remain available inside the Trash view.

### 4. 🎨 Polished Desktop Experience & Typography
- Upgraded entire system typography to the **Inter & Apple SF Pro** font stack.
- Converted the right-hand **Get Info** drawer into a centered, sleek modal overlay with transparent decompression previews and side-by-side logical vs. physical disk storage stats.
- Added visible compressed physical size indicators and reduction badges in both list and grid views.
