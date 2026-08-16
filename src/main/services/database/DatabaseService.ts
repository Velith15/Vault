import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VaultNode, StorageObject, SearchQuery } from '../../../shared/types';

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
        last_verified_at TEXT NOT NULL
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

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
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
    }));
  }

  public insertObject(hash: string, size: number): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO objects (hash, size, ref_count, stored_at, last_verified_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET
        ref_count = ref_count + 1,
        last_verified_at = excluded.last_verified_at
    `).run(hash, size, now, now);
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

  // --- Logical Nodes Operations ---

  public getNodeById(id: string): VaultNode | null {
    const row = this.db.prepare(`
      SELECT n.*, o.ref_count 
      FROM nodes n 
      LEFT JOIN objects o ON n.object_hash = o.hash 
      WHERE n.id = ?
    `).get(id) as any;
    if (!row) return null;
    return this.mapNode(row);
  }

  public getNodeByHash(hash: string): VaultNode | null {
    const row = this.db.prepare(`
      SELECT n.*, o.ref_count 
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
      SELECT n.*, o.ref_count 
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

    // Sort
    const sortField = query.sortBy || 'name';
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    // In folder views, usually folders come first
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
    // Recursively trash all descendants if it's a folder
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

    // Find all object hashes associated with these nodes
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

  public getMetricsSummary() {
    const totalFiles = (this.db.prepare("SELECT COUNT(*) as c FROM nodes WHERE type = 'file' AND is_trashed = 0").get() as any).c;
    const totalFolders = (this.db.prepare("SELECT COUNT(*) as c FROM nodes WHERE type = 'folder' AND is_trashed = 0").get() as any).c;
    const totalObjects = (this.db.prepare("SELECT COUNT(*) as c FROM objects").get() as any).c;
    const vaultManagedBytes = (this.db.prepare("SELECT COALESCE(SUM(size), 0) as s FROM objects").get() as any).s;
    const vaultRawLogicalBytes = (this.db.prepare("SELECT COALESCE(SUM(size), 0) as s FROM nodes WHERE type = 'file' AND is_trashed = 0").get() as any).s;

    return {
      totalFiles,
      totalFolders,
      totalObjects,
      vaultManagedBytes,
      vaultRawLogicalBytes,
      deduplicatedSavingsBytes: Math.max(0, vaultRawLogicalBytes - vaultManagedBytes),
    };
  }

  public close(): void {
    this.db.close();
  }

  private mapNode(row: any): VaultNode {
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
    };
  }
}
