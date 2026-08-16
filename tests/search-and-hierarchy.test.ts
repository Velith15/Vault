import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from '../src/main/services/database/DatabaseService';
import { StorageEngine } from '../src/main/services/storage/StorageEngine';

describe('Vault End-to-End Search & Hierarchy Lifecycle', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let storageEngine: StorageEngine;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `vault_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const dbPath = path.join(tempDir, 'metadata', 'vault.db');
    dbService = new DatabaseService(dbPath);
    storageEngine = new StorageEngine(tempDir, dbService);
  });

  afterEach(async () => {
    dbService.close();
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('supports search by term, starred filter, and category filter', async () => {
    const f1 = path.join(tempDir, 'Financial_Report_2026.pdf');
    const f2 = path.join(tempDir, 'Architecture_Diagram.png');
    const f3 = path.join(tempDir, 'vacation_video.mp4');

    await fs.promises.writeFile(f1, '%PDF-1.4 financial data');
    await fs.promises.writeFile(f2, 'PNG fake image bytes');
    await fs.promises.writeFile(f3, 'MP4 video stream bytes');

    const node1 = await storageEngine.importLocalFile(f1);
    const node2 = await storageEngine.importLocalFile(f2);
    const node3 = await storageEngine.importLocalFile(f3);

    // Star node1
    dbService.toggleStarred(node1.id);

    // 1. Search term
    const searchResults = dbService.getNodes({ term: 'financial' });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].name).toBe('Financial_Report_2026.pdf');

    // 2. Starred search
    const starredResults = dbService.getNodes({ isStarred: true });
    expect(starredResults.length).toBe(1);
    expect(starredResults[0].id).toBe(node1.id);

    // 3. Document filter
    const docResults = dbService.getNodes({ type: 'document' });
    expect(docResults.length).toBe(1);
    expect(docResults[0].name).toBe('Financial_Report_2026.pdf');

    // 4. Image filter
    const imgResults = dbService.getNodes({ type: 'image' });
    expect(imgResults.length).toBe(1);
    expect(imgResults[0].name).toBe('Architecture_Diagram.png');
  });

  it('supports renaming, moving folders and recursive trashing', async () => {
    const parentFolder = storageEngine.createFolder('Documents');
    const childFolder = storageEngine.createFolder('Confidential', parentFolder.id);

    const f1 = path.join(tempDir, 'secrets.txt');
    await fs.promises.writeFile(f1, 'classified virtual storage blueprint');
    const fileNode = await storageEngine.importLocalFile(f1, childFolder.id);

    // Rename file
    dbService.renameNode(fileNode.id, 'secrets_v2.txt');
    const renamed = dbService.getNodeById(fileNode.id);
    expect(renamed?.name).toBe('secrets_v2.txt');

    // Move file to parent folder
    dbService.moveNode(fileNode.id, parentFolder.id);
    let checkMoved = dbService.getNodeById(fileNode.id);
    expect(checkMoved?.parentId).toBe(parentFolder.id);

    // Trash parent folder -> should recursively trash all contents
    dbService.trashNode(parentFolder.id, true);
    const rootNodes = dbService.getNodes({ parentId: null });
    expect(rootNodes.length).toBe(0);

    const trashedNodes = dbService.getNodes({ isTrashed: true });
    expect(trashedNodes.length).toBe(3); // parentFolder + childFolder + fileNode
  });
});
