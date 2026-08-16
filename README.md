# Vault — Local-First Virtual Storage Desktop Application

**Vault** is a local-first virtual storage desktop application designed as a quiet, robust, private storage infrastructure layer.

---

## 1. Architecture

```
User (Desktop UI — React 18 / TypeScript / TailwindCSS / Lucide)
   │ IPC (Safe contextBridge)
   ▼
Vault Application Backend (Main Process)
   ├── StorageEngine (CAS physical storage in objects/ab/c123...)
   ├── DatabaseService (SQLite metadata, indexes, WAL transactions in metadata/vault.db)
   ├── StorageMetricsService (Real local drive stats & deduplication savings)
   └── RecoveryService (Startup self-healing, integrity checks, orphan scanning)
   ▼
Managed Vault Data Directory:
   ├── objects/ (2-character sharded SHA-256 CAS physical files)
   ├── metadata/ (vault.db, sqlite WAL logs)
   ├── index/ (auxiliary search indices)
   ├── cache/ (previews & thumbnails)
   ├── temp/ (atomic ingestion staging)
   └── config/ (storage configuration)
```

---

## 2. Core Features Implemented

1. **Content-Addressed Storage (CAS) Engine**:
   - Streaming SHA-256 computation during atomic ingestion into temporary staging directory.
   - 2-level directory sharding (`objects/ab/c123...`).
   - Content deduplication: files with identical hash share the same physical object with reference counting (`ref_count`).
   - Safe physical object shredding only when reference count drops to 0 upon permanent deletion.

2. **SQLite Metadata & Virtual Hierarchy**:
   - Stores logical files and directory trees independently of physical CAS hashes.
   - Real SQLite indexing for instant search by name, file extension, category (Documents, Images, Videos, Archives), and starred items.
   - Folder creation, rename, move, star/unstar, trash, restore, and recursive operations.

3. **Data Integrity & Startup Self-Healing**:
   - Database `PRAGMA integrity_check` on startup.
   - Automatic cleanup of interrupted or partial temporary uploads.
   - Orphaned object scanning and missing physical object detection.

4. **Inspector & Previews**:
   - Inline preview for Images, Video, Audio, and Text/Code files.
   - Fallback "Open with system app" and "Export copy" functionality.
   - SHA-256 hash display, file size, timestamps, and deduplication badge.

5. **Real Local Storage Inspection**:
   - Real host drive capacity and free space measurement.
   - Vault managed storage size vs raw logical size and exact deduplication savings.

---

## 3. Running & Development

### Automated Tests
```bash
npm test
```

### Build Production Bundle
```bash
npm run build
```

### Launch Desktop Application
```bash
npm run dev
```
