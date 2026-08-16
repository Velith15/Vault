# 🛡️ Vault — Local-First Content-Addressed Storage & Virtual File System

[![Version](https://img.shields.io/github/v/release/Velith15/Vault?color=09090B&label=Release&style=flat-square)](https://github.com/Velith15/Vault/releases)
[![License](https://img.shields.io/github/license/Velith15/Vault?color=2563EB&style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-emerald?style=flat-square)](https://github.com/Velith15/Vault/releases)
[![Electron](https://img.shields.io/badge/Electron-v34.2.0-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-v18.3.1-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

**Vault** is a modern, high-performance, local-first virtual file system and storage manager for desktop operating systems. Built on a zero-telemetry architecture, Vault organizes your files using a Content-Addressed Storage (CAS) engine with SHA-256 deduplication, atomic stream ingestion, and high-speed SQLite metadata indexing.

---

## ✨ Key Highlights & Features

- 🔒 **100% Local & Privacy-First**: Zero cloud dependencies, zero analytics, zero external network egress. All data, checksums, and indexing run strictly in-process on your machine.
- ⚡ **Atomic Streaming Ingestion**: Native backpressure-managed Node.js stream pipelines process multi-gigabyte files (1GB, 10GB, 50GB+) with under **1 MB of RAM overhead**.
- 💎 **Content-Addressed Storage (CAS)**: Computes streaming SHA-256 checksums upon file ingestion. Duplicate files across virtual directories point to the same physical object, saving disk space automatically with reference counting.
- 🎯 **Marquee Drag-to-Select & Range Selection**: Pro-grade canvas rubberband box selection, `Shift + Click` range selection, `Ctrl / Cmd + Click` toggle selection, and `Ctrl + A` shortcuts.
- 🎨 **Minimalist Apple-Inspired UI**: Beautiful glassmorphism aesthetic, typography, dark/light modes, floating bulk action bars, and custom modal confirmation dialogs.
- 🔍 **Instant Search & Intelligent Categories**: Virtual folder hierarchy indexed in SQLite for real-time name, extension, MIME type, and category filtering (Documents, Images, Videos, Archives).
- 🛠️ **Startup Self-Healing & Integrity Scan**: Automatic database verification (`PRAGMA integrity_check`), partial upload staging cleanup, and physical orphan object detection.
- 🔄 **Seamless Auto-Updates**: Built-in non-intrusive background updater integrated directly with GitHub Releases via `electron-updater`.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               User Desktop UI (React 18 / TailwindCSS)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Safe contextBridge)
┌───────────────────────────────────▼────────────────────────────────────┐
│                Vault Core Backend Process (Electron Main)              │
│                                                                        │
│  ├── StorageEngine        ► SHA-256 CAS Streaming Pipeline             │
│  ├── DatabaseService      ► SQLite Metadata WAL Database               │
│  ├── StorageMetricsService ► Real Drive Statistics & Deduplication Savings│
│  └── UpdateService        ► GitHub Releases Background Auto-Updater   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Native File I/O
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Managed Vault Storage Directory                     │
│                                                                        │
│  ├── objects/             ► Sharded CAS Objects (objects/ab/c123...)   │
│  ├── metadata/            ► SQLite database (vault.db & WAL log)       │
│  ├── cache/               ► Thumbnail & preview data cache             │
│  └── temp/                ► Atomic ingestion staging directory         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Download Pre-built Executables
Download the latest installer or portable executable directly from the [GitHub Releases](https://github.com/Velith15/Vault/releases) page.

### Building from Source

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

#### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Velith15/Vault.git
   cd Vault
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Compile & Build Production Bundle**:
   ```bash
   npm run build
   ```

5. **Package Executables for Windows / Distribution**:
   ```bash
   npm run dist
   ```

---

## 🎮 Multi-Selection & Controls

| Action | Shortcut / Input |
| :--- | :--- |
| **Marquee Box Select** | Click and drag across empty background area |
| **Range Select** | Click item, hold `Shift`, click target item |
| **Toggle Select** | Hold `Ctrl` (or `Cmd`) and click items |
| **Select All** | `Ctrl + A` / `Cmd + A` |
| **Clear Selection** | Press `Escape` or click `X` on floating bar |
| **Permanent Delete** | Context Menu -> **Delete Permanently** |

---

## 🧰 Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/)
- **Database**: [SQLite 3 (`better-sqlite3`)](https://github.com/WiseLibs/better-sqlite3)
- **Auto Update**: [electron-updater](https://www.electron.build/auto-update)
- **Bundler & Packaging**: [electron-builder](https://www.electron.build/)

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.



