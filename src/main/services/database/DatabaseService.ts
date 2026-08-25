import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VaultNode, StorageObject, SearchQuery, CompressionSettings, CategorySavings } from '../../../shared/types';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS objects (
        hash TEXT PRIMARY KEY,
        size INTEGER NOT NULL,
        ref_count INTEGER NOT NULL DEFAULT 1,
        stored_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL,
        is_compressed INTEGER NOT NULL DEFAULT 0,
        compressed_size INTEGER NOT NULL DEFAULT 0,
        compression_algo TEXT
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
        object_hash TEXT,
        size INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT,
        is_starred INTEGER NOT NULL DEFAULT 0,
        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (object_hash) REFERENCES objects(hash) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id, is_trashed);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_starred ON nodes(is_starred) WHERE is_starred = 1;
      CREATE INDEX IF NOT EXISTS idx_nodes_trashed ON nodes(is_trashed);
      CREATE INDEX IF NOT EXISTS idx_nodes_hash ON nodes(object_hash);
      CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS storage_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Run safe migrations for existing databases that lack new columns
    this.runMigrations();
  }

  private runMigrations(): void {
    try {
      const columns = this.db.pragma('table_info(objects)') as Array<{ name: string }>;
      const colNames = new Set(columns.map(c => c.name));

      if (!colNames.has('is_compressed')) {
        this.db.exec('ALTER TABLE objects ADD COLUMN is_compressed INTEGER NOT NULL DEFAULT 0;');
      }
      if (!colNames.has('compressed_size')) {
        this.db.exec('ALTER TABLE objects ADD COLUMN compressed_size INTEGER NOT NULL DEFAULT 0;');
      }
      if (!colNames.has('compression_algo')) {
        this.db.exec('ALTER TABLE objects ADD COLUMN compression_algo TEXT;');
      }
    } catch (err) {
      console.error('[DatabaseService] Migration notice:', err);
    }
  }

  public checkIntegrity(): boolean {
    const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    return result.length > 0 && result[0].integrity_check === 'ok';
  }

  // --- Physical Object CAS operations ---

  public getObject(hash: string): StorageObject | null {
    const row = this.db.prepare('SELECT * FROM objects WHERE hash = ?').get(hash) as any;
    if (!row) return null;
    return {
      hash: row.hash,
      size: row.size,
      refCount: row.ref_count,
      storedAt: row.stored_at,
      lastVerifiedAt: row.last_verified_at,
      isCompressed: row.is_compressed === 1,
      compressedSize: row.compressed_size || row.size,
      compressionAlgo: row.compression_algo || null,
    };
  }

  public getAllObjects(): StorageObject[] {
    const rows = this.db.prepare('SELECT * FROM objects').all() as any[];
    return rows.map((row) => ({
      hash: row.hash,
      size: row.size,
      refCount: row.ref_count,
      storedAt: row.stored_at,
      lastVerifiedAt: row.last_verified_at,
      isCompressed: row.is_compressed === 1,
      compressedSize: row.compressed_size || row.size,
      compressionAlgo: row.compression_algo || null,
    }));
  }

  public insertObject(
    hash: string, 
    size: number, 
    isCompressed: boolean = false, 
    compressedSize: number = 0, 
    compressionAlgo: string | null = null
  ): void {
    const now = new Date().toISOString();
    const actualCompressedSize = isCompressed ? compressedSize : size;

    this.db.prepare(`
      INSERT INTO objects (hash, size, ref_count, stored_at, last_verified_at, is_compressed, compressed_size, compression_algo)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET
        ref_count = ref_count + 1,
        last_verified_at = excluded.last_verified_at
    `).run(
      hash, 
      size, 
      now, 
      now, 
      isCompressed ? 1 : 0, 
      actualCompressedSize, 
      compressionAlgo
    );
  }

  public updateObjectCompression(
    hash: string, 
    isCompressed: boolean, 
    compressedSize: number, 
    compressionAlgo: string | null
  ): void {
    this.db.prepare(`
      UPDATE objects 
      SET is_compressed = ?, compressed_size = ?, compression_algo = ?, last_verified_at = ?
      WHERE hash = ?
    `).run(
      isCompressed ? 1 : 0, 
      compressedSize, 
      compressionAlgo, 
      new Date().toISOString(), 
      hash
    );
  }

  public incrementObjectRefCount(hash: string): void {
    this.db.prepare('UPDATE objects SET ref_count = ref_count + 1 WHERE hash = ?').run(hash);
  }

  public decrementObjectRefCount(hash: string): number {
    const stmt = this.db.prepare('UPDATE objects SET ref_count = ref_count - 1 WHERE hash = ?');
    stmt.run(hash);
    const obj = this.getObject(hash);
    return obj ? obj.refCount : 0;
  }

  public deleteObject(hash: string): void {
    this.db.prepare('DELETE FROM objects WHERE hash = ?').run(hash);
  }

  public updateObjectVerification(hash: string): void {
    this.db.prepare('UPDATE objects SET last_verified_at = ? WHERE hash = ?').run(new Date().toISOString(), hash);
  }

  // --- Compression & Storage Settings ---

  public getCompressionSettings(): CompressionSettings {
    const defaults: CompressionSettings = {
      autoCompression: true,
      mode: 'automatic',
      profile: 'BALANCED',
      minSavingsThresholdPercent: 5,
      minFileSizeToCompress: 1024,
      backgroundCpuLimitPercent: 50,
    };

    try {
      const row = this.db.prepare("SELECT value FROM storage_settings WHERE key = 'compression'").get() as any;
      if (row && row.value) {
        return { ...defaults, ...JSON.parse(row.value) };
      }
    } catch {}

    return defaults;
  }

  public setCompressionSettings(settings: Partial<CompressionSettings>): CompressionSettings {
    const current = this.getCompressionSettings();
    const updated = { ...current, ...settings };
    this.db.prepare(`
      INSERT INTO storage_settings (key, value)
      VALUES ('compression', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(updated));
    return updated;
  }

  // --- Logical Nodes Operations ---

  public getNodeById(id: string): VaultNode | null {
    const row = this.db.prepare(`
      SELECT n.*, o.ref_count, o.is_compressed, o.compressed_size, o.compression_algo
      FROM nodes n 
      LEFT JOIN objects o ON n.object_hash = o.hash 
      WHERE n.id = ?
    `).get(id) as any;
    if (!row) return null;
    return this.mapNode(row);
  }

  public getNodeByHash(hash: string): VaultNode | null {
    const row = this.db.prepare(`
      SELECT n.*, o.ref_count, o.is_compressed, o.compressed_size, o.compression_algo
      FROM nodes n 
      LEFT JOIN objects o ON n.object_hash = o.hash 
      WHERE n.object_hash = ?
      LIMIT 1
    `).get(hash) as any;
    if (!row) return null;
    return this.mapNode(row);
  }

  public getNodes(query: SearchQuery): VaultNode[] {
    let sql = `
      SELECT n.*, o.ref_count, o.is_compressed, o.compressed_size, o.compression_algo
      FROM nodes n 
      LEFT JOIN objects o ON n.object_hash = o.hash 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query.isTrashed !== undefined) {
      sql += ' AND n.is_trashed = ?';
      params.push(query.isTrashed ? 1 : 0);
    } else {
      sql += ' AND n.is_trashed = 0';
    }

    if (query.isStarred !== undefined) {
      sql += ' AND n.is_starred = ?';
      params.push(query.isStarred ? 1 : 0);
    }

    if (query.parentId !== undefined) {
      if (query.parentId === null) {
        sql += ' AND n.parent_id IS NULL';
      } else {
        sql += ' AND n.parent_id = ?';
        params.push(query.parentId);
      }
    }

    if (query.type && query.type !== 'all') {
      if (query.type === 'folder') {
        sql += " AND n.type = 'folder'";
      } else if (query.type === 'image') {
        sql += " AND n.mime_type LIKE 'image/%'";
      } else if (query.type === 'video') {
        sql += " AND n.mime_type LIKE 'video/%'";
      } else if (query.type === 'audio') {
        sql += " AND n.mime_type LIKE 'audio/%'";
      } else if (query.type === 'document') {
        sql += " AND (n.mime_type LIKE 'text/%' OR n.mime_type LIKE 'application/pdf%' OR n.mime_type LIKE '%document%' OR n.mime_type LIKE '%sheet%' OR n.name LIKE '%.md' OR n.name LIKE '%.txt' OR n.name LIKE '%.json')";
      } else if (query.type === 'archive') {
        sql += " AND (n.mime_type LIKE '%zip%' OR n.mime_type LIKE '%tar%' OR n.mime_type LIKE '%rar%' OR n.mime_type LIKE '%7z%' OR n.name LIKE '%.zip' OR n.name LIKE '%.tar.gz')";
      }
    }

    if (query.term && query.term.trim().length > 0) {
      sql += ' AND n.name LIKE ?';
      params.push(`%${query.term.trim()}%`);
    }

    const sortField = query.sortBy || 'name';
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    if (query.parentId !== undefined) {
      sql += ` ORDER BY CASE WHEN n.type = 'folder' THEN 0 ELSE 1 END, `;
    } else {
      sql += ' ORDER BY ';
    }

    switch (sortField) {
      case 'size':
        sql += `n.size ${sortOrder}`;
        break;
      case 'modifiedAt':
        sql += `n.modified_at ${sortOrder}`;
        break;
      case 'createdAt':
        sql += `n.created_at ${sortOrder}`;
        break;
      case 'name':
      default:
        sql += `n.name COLLATE NOCASE ${sortOrder}`;
        break;
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapNode(r));
  }

  public insertNode(node: VaultNode): void {
    this.db.prepare(`
      INSERT INTO nodes (
        id, parent_id, name, type, object_hash, size, mime_type,
        is_starred, is_trashed, trashed_at, created_at, modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      node.id,
      node.parentId,
      node.name,
      node.type,
      node.objectHash,
      node.size,
      node.mimeType,
      node.isStarred ? 1 : 0,
      node.isTrashed ? 1 : 0,
      node.trashedAt,
      node.createdAt,
      node.modifiedAt
    );
  }

  public renameNode(id: string, newName: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE nodes SET name = ?, modified_at = ? WHERE id = ?').run(newName, now, id);
  }

  public moveNode(id: string, newParentId: string | null): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE nodes SET parent_id = ?, modified_at = ? WHERE id = ?').run(newParentId, now, id);
  }

  public toggleStarred(id: string): boolean {
    const current = this.getNodeById(id);
    if (!current) return false;
    const newVal = current.isStarred ? 0 : 1;
    this.db.prepare('UPDATE nodes SET is_starred = ? WHERE id = ?').run(newVal, id);
    return newVal === 1;
  }

  public trashNode(id: string, trashed: boolean): void {
    const now = trashed ? new Date().toISOString() : null;
    const targetIds = this.getDescendantIds(id);
    targetIds.push(id);

    const stmt = this.db.prepare('UPDATE nodes SET is_trashed = ?, trashed_at = ? WHERE id = ?');
    const trans = this.db.transaction((ids: string[]) => {
      for (const nid of ids) {
        stmt.run(trashed ? 1 : 0, now, nid);
      }
    });
    trans(targetIds);
  }

  public deleteNodePermanently(id: string): { deletedHashesToCheck: string[] } {
    const targetIds = this.getDescendantIds(id);
    targetIds.push(id);

    const placeholders = targetIds.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT object_hash FROM nodes WHERE id IN (${placeholders}) AND object_hash IS NOT NULL`).all(...targetIds) as any[];
    const hashesToCheck = rows.map(r => r.object_hash);

    const deleteStmt = this.db.prepare(`DELETE FROM nodes WHERE id IN (${placeholders})`);
    deleteStmt.run(...targetIds);

    return { deletedHashesToCheck: hashesToCheck };
  }

  public emptyTrash(): { deletedHashesToCheck: string[] } {
    const rows = this.db.prepare('SELECT object_hash FROM nodes WHERE is_trashed = 1 AND object_hash IS NOT NULL').all() as any[];
    const hashesToCheck = rows.map(r => r.object_hash);

    this.db.prepare('DELETE FROM nodes WHERE is_trashed = 1').run();
    return { deletedHashesToCheck: hashesToCheck };
  }

  public purgeExpiredTrash(retentionDays: number = 7): { deletedHashesToCheck: string[] } {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.db.prepare(`
      SELECT object_hash FROM nodes 
      WHERE is_trashed = 1 AND trashed_at IS NOT NULL AND trashed_at <= ? AND object_hash IS NOT NULL
    `).all(cutoffDate) as any[];
    const hashesToCheck = rows.map(r => r.object_hash);

    this.db.prepare(`
      DELETE FROM nodes 
      WHERE is_trashed = 1 AND trashed_at IS NOT NULL AND trashed_at <= ?
    `).run(cutoffDate);

    return { deletedHashesToCheck: hashesToCheck };
  }

  public getDescendantIds(folderId: string): string[] {
    const ids: string[] = [];
    const queue = [folderId];
    const stmt = this.db.prepare('SELECT id, type FROM nodes WHERE parent_id = ?');

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = stmt.all(current) as any[];
      for (const child of children) {
        ids.push(child.id);
        if (child.type === 'folder') {
          queue.push(child.id);
        }
      }
    }

    return ids;
  }

  public getFolderAncestors(nodeId: string): Array<{ id: string; name: string }> {
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentId: string | null = nodeId;
    const stmt = this.db.prepare('SELECT id, parent_id, name FROM nodes WHERE id = ?');

    while (currentId) {
      const row = stmt.get(currentId) as any;
      if (!row) break;
      breadcrumbs.unshift({ id: row.id, name: row.name });
      currentId = row.parent_id;
    }

    return breadcrumbs;
  }

  // --- Metrics & Analytics Breakdown ---

  public getMetricsSummary() {
    const totalFiles = (this.db.prepare("SELECT COUNT(*) as c FROM nodes WHERE type = 'file' AND is_trashed = 0").get() as any).c;
    const totalFolders = (this.db.prepare("SELECT COUNT(*) as c FROM nodes WHERE type = 'folder' AND is_trashed = 0").get() as any).c;
    const totalObjects = (this.db.prepare("SELECT COUNT(*) as c FROM objects").get() as any).c;
    const compressedObjectsCount = (this.db.prepare("SELECT COUNT(*) as c FROM objects WHERE is_compressed = 1").get() as any).c;

    const vaultRawLogicalBytes = (this.db.prepare("SELECT COALESCE(SUM(size), 0) as s FROM nodes WHERE type = 'file' AND is_trashed = 0").get() as any).s;
    const vaultUniqueLogicalBytes = (this.db.prepare("SELECT COALESCE(SUM(size), 0) as s FROM objects").get() as any).s;
    const vaultManagedBytes = (this.db.prepare("SELECT COALESCE(SUM(CASE WHEN is_compressed = 1 THEN compressed_size ELSE size END), 0) as s FROM objects").get() as any).s;

    const deduplicatedSavingsBytes = Math.max(0, vaultRawLogicalBytes - vaultUniqueLogicalBytes);
    const compressionSavingsBytes = Math.max(0, vaultUniqueLogicalBytes - vaultManagedBytes);
    const totalSavingsBytes = deduplicatedSavingsBytes + compressionSavingsBytes;
    const overallReductionPercentage = vaultRawLogicalBytes > 0 
      ? Math.min(100, Math.max(0, (totalSavingsBytes / vaultRawLogicalBytes) * 100))
      : 0;

    const categorySavings = this.getCategorySavings();

    return {
      totalFiles,
      totalFolders,
      totalObjects,
      compressedObjectsCount,
      vaultRawLogicalBytes,
      vaultUniqueLogicalBytes,
      vaultManagedBytes,
      deduplicatedSavingsBytes,
      compressionSavingsBytes,
      totalSavingsBytes,
      overallReductionPercentage,
      categorySavings,
    };
  }

  public getCategorySavings(): CategorySavings[] {
    const categories: { [cat: string]: { logical: number; physical: number; count: number } } = {
      'Documents': { logical: 0, physical: 0, count: 0 },
      'Code': { logical: 0, physical: 0, count: 0 },
      'Images': { logical: 0, physical: 0, count: 0 },
      'Videos': { logical: 0, physical: 0, count: 0 },
      'Archives': { logical: 0, physical: 0, count: 0 },
      'Other': { logical: 0, physical: 0, count: 0 },
    };

    const rows = this.db.prepare(`
      SELECT n.name, n.mime_type, n.size as logical_size, 
             COALESCE(CASE WHEN o.is_compressed = 1 THEN o.compressed_size ELSE o.size END, n.size) as physical_size,
             COALESCE(o.ref_count, 1) as ref_count
      FROM nodes n
      LEFT JOIN objects o ON n.object_hash = o.hash
      WHERE n.type = 'file' AND n.is_trashed = 0
    `).all() as any[];

    for (const r of rows) {
      const name = (r.name || '').toLowerCase();
      const mime = (r.mime_type || '').toLowerCase();
      const ext = path.extname(name);

      let catKey = 'Other';
      if (
        ['.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.c', '.cpp', '.h', '.cs', '.java', '.kt', '.sql', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.sh'].includes(ext)
      ) {
        catKey = 'Code';
      } else if (
        ['.txt', '.md', '.pdf', '.docx', '.xlsx', '.pptx', '.rtf', '.log', '.csv'].includes(ext) ||
        mime.startsWith('text/') || mime.includes('pdf') || mime.includes('document') || mime.includes('sheet')
      ) {
        catKey = 'Documents';
      } else if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'].includes(ext)) {
        catKey = 'Images';
      } else if (mime.startsWith('video/') || ['.mp4', '.mkv', '.mov', '.avi', '.webm'].includes(ext)) {
        catKey = 'Videos';
      } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) {
        catKey = 'Archives';
      }

      // Attribute logical size to file, and physical size shared proportionally among refs
      const refCount = Math.max(1, r.ref_count);
      categories[catKey].logical += r.logical_size;
      categories[catKey].physical += Math.round(r.physical_size / refCount);
      categories[catKey].count++;
    }

    return Object.entries(categories).map(([category, stats]) => {
      const savedBytes = Math.max(0, stats.logical - stats.physical);
      const reductionPercentage = stats.logical > 0 
        ? Math.min(100, Math.max(0, (savedBytes / stats.logical) * 100))
        : 0;
      return {
        category,
        logicalBytes: stats.logical,
        physicalBytes: stats.physical,
        savedBytes,
        reductionPercentage,
        fileCount: stats.count,
      };
    });
  }

  public close(): void {
    this.db.close();
  }

  private mapNode(row: any): VaultNode {
    const isCompressed = row.is_compressed === 1;
    const originalSize = row.size;
    const compressedSize = isCompressed ? (row.compressed_size || row.size) : row.size;
    const compressionRatio = isCompressed && originalSize > 0 
      ? Number((originalSize / compressedSize).toFixed(2)) 
      : 1;

    return {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      type: row.type,
      objectHash: row.object_hash,
      size: row.size,
      mimeType: row.mime_type,
      isStarred: row.is_starred === 1,
      isTrashed: row.is_trashed === 1,
      trashedAt: row.trashed_at,
      createdAt: row.created_at,
      modifiedAt: row.modified_at,
      refCount: row.ref_count || 1,
      isCompressed,
      compressedSize,
      compressionRatio,
      compressionAlgo: row.compression_algo || null,
    };
  }
}
