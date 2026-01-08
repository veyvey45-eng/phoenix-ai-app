/**
 * FileSystemManager - Système de fichiers réel persistant pour Phoenix
 * 
 * Ce module implémente un vrai système de fichiers comme Manus:
 * - Fichiers persistants stockés en S3
 * - Métadonnées en base de données
 * - Arborescence de dossiers
 * - Versioning et historique
 * - Synchronisation avec E2B pour exécution
 */

import { getDb } from '../db';
import { workspaceFiles, workspaceFileHistory } from '../../drizzle/schema';
import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import { storagePut, storageGet } from '../storage';
import { nanoid } from 'nanoid';
import * as path from 'path';

// Types
export interface FileInfo {
  id: string;
  userId: number;
  path: string;
  name: string;
  fileType: 'file' | 'directory';
  mimeType: string | null;
  size: number;
  content: string | null;
  storageUrl: string | null;
  language: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileOptions {
  userId: number;
  path: string;
  content: string;
  mimeType?: string;
  language?: string;
}

export interface UpdateFileOptions {
  content: string;
  changeDescription?: string;
}

export interface ListFilesOptions {
  userId: number;
  directory?: string;
  recursive?: boolean;
  fileType?: 'file' | 'directory' | 'all';
}

// Constantes
const MAX_INLINE_SIZE = 64 * 1024; // 64KB - au-delà, on stocke en S3
const STORAGE_PREFIX = 'workspace-files';

/**
 * Classe FileSystemManager - Gère le système de fichiers persistant
 */
export class FileSystemManager {
  private static instance: FileSystemManager;

  private constructor() {
    console.log('[FileSystemManager] Initialized');
  }

  static getInstance(): FileSystemManager {
    if (!FileSystemManager.instance) {
      FileSystemManager.instance = new FileSystemManager();
    }
    return FileSystemManager.instance;
  }

  /**
   * Normalise un chemin de fichier
   */
  private normalizePath(filePath: string): string {
    // S'assurer que le chemin commence par /
    let normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
    // Supprimer les doubles slashes
    normalized = normalized.replace(/\/+/g, '/');
    // Supprimer le slash final sauf pour la racine
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Extrait le nom du fichier depuis un chemin
   */
  private getFileName(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Extrait le dossier parent depuis un chemin
   */
  private getParentDir(filePath: string): string {
    const dir = path.dirname(filePath);
    return dir === '.' ? '/' : dir;
  }

  /**
   * Détecte le type MIME depuis l'extension
   */
  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.jsx': 'text/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.rs': 'text/x-rust',
      '.go': 'text/x-go',
      '.rb': 'text/x-ruby',
      '.php': 'text/x-php',
      '.sh': 'text/x-shellscript',
      '.bash': 'text/x-shellscript',
      '.sql': 'text/x-sql',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Détecte le langage de programmation depuis l'extension
   */
  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const languages: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.rs': 'rust',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.sh': 'bash',
      '.bash': 'bash',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
    };
    return languages[ext] || null;
  }

  /**
   * Compte le nombre de lignes dans un contenu texte
   */
  private countLines(content: string): number {
    return content.split('\n').length;
  }

  /**
   * Génère une clé S3 unique pour un fichier
   */
  private generateStorageKey(userId: number, fileId: string, fileName: string): string {
    return `${STORAGE_PREFIX}/${userId}/${fileId}/${fileName}`;
  }

  /**
   * Crée les dossiers parents si nécessaire
   */
  private async ensureParentDirs(userId: number, filePath: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const parts = filePath.split('/').filter(p => p);
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i];
      
      // Vérifier si le dossier existe
      const existing = await db.select()
        .from(workspaceFiles)
        .where(and(
          eq(workspaceFiles.userId, userId),
          eq(workspaceFiles.path, currentPath),
          eq(workspaceFiles.fileType, 'directory')
        ))
        .limit(1);

      if (existing.length === 0) {
        // Créer le dossier
        await db.insert(workspaceFiles).values([{
          id: nanoid(),
          userId,
          path: currentPath,
          name: parts[i],
          fileType: 'directory',
          mimeType: null,
          size: 0,
          content: null,
          storageKey: null,
          storageUrl: null,
          language: null,
          encoding: 'utf-8',
          lineCount: null,
          version: 1,
          lastModifiedBy: 'agent'
        }]);
      }
    }
  }

  /**
   * Crée un nouveau fichier
   */
  async createFile(options: CreateFileOptions): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const normalizedPath = this.normalizePath(options.path);
    const fileName = this.getFileName(normalizedPath);
    const mimeType = options.mimeType || this.detectMimeType(normalizedPath);
    const language = options.language || this.detectLanguage(normalizedPath);
    const size = Buffer.byteLength(options.content, 'utf-8');
    const lineCount = this.countLines(options.content);
    const fileId = nanoid();

    // Créer les dossiers parents
    await this.ensureParentDirs(options.userId, normalizedPath);

    // Vérifier si le fichier existe déjà
    const existing = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, options.userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Mettre à jour le fichier existant
      return this.updateFile(existing[0].id, options.userId, {
        content: options.content,
        changeDescription: 'File overwritten'
      });
    }

    // Déterminer si on stocke en inline ou en S3
    let storageKey: string | null = null;
    let storageUrl: string | null = null;
    let content: string | null = options.content;

    if (size > MAX_INLINE_SIZE) {
      // Stocker en S3
      storageKey = this.generateStorageKey(options.userId, fileId, fileName);
      const result = await storagePut(storageKey, options.content, mimeType);
      storageUrl = result.url;
      content = null; // Ne pas stocker en DB
    }

    // Insérer le fichier
    await db.insert(workspaceFiles).values([{
      id: fileId,
      userId: options.userId,
      path: normalizedPath,
      name: fileName,
      fileType: 'file',
      mimeType,
      size,
      content,
      storageKey,
      storageUrl,
      language,
      encoding: 'utf-8',
      lineCount,
      version: 1,
      lastModifiedBy: 'agent'
    }]);

    // Enregistrer dans l'historique
    await db.insert(workspaceFileHistory).values([{
      fileId,
      userId: options.userId,
      content: content,
      storageKey,
      version: 1,
      changeType: 'create',
      changeDescription: 'File created',
      changedBy: 'agent'
    }]);

    console.log(`[FileSystemManager] Created file: ${normalizedPath}`);

    return {
      id: fileId,
      userId: options.userId,
      path: normalizedPath,
      name: fileName,
      fileType: 'file',
      mimeType,
      size,
      content,
      storageUrl,
      language,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Lit un fichier
   */
  async readFile(fileId: string, userId: number): Promise<FileInfo & { content: string }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const files = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.id, fileId),
        eq(workspaceFiles.userId, userId)
      ))
      .limit(1);

    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];

    // Récupérer le contenu
    let content = file.content;
    if (!content && file.storageKey) {
      // Télécharger depuis S3
      const { url } = await storageGet(file.storageKey);
      const response = await fetch(url);
      content = await response.text();
    }

    return {
      id: file.id,
      userId: file.userId,
      path: file.path,
      name: file.name,
      fileType: file.fileType as 'file' | 'directory',
      mimeType: file.mimeType,
      size: file.size || 0,
      content: content || '',
      storageUrl: file.storageUrl,
      language: file.language,
      version: file.version || 1,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    };
  }

  /**
   * Lit un fichier par son chemin
   */
  async readFileByPath(filePath: string, userId: number): Promise<FileInfo & { content: string }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const normalizedPath = this.normalizePath(filePath);

    const files = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.path, normalizedPath),
        eq(workspaceFiles.userId, userId)
      ))
      .limit(1);

    if (files.length === 0) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    return this.readFile(files[0].id, userId);
  }

  /**
   * Met à jour un fichier
   */
  async updateFile(fileId: string, userId: number, options: UpdateFileOptions): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Récupérer le fichier existant
    const files = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.id, fileId),
        eq(workspaceFiles.userId, userId)
      ))
      .limit(1);

    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];
    const newVersion = (file.version || 1) + 1;
    const size = Buffer.byteLength(options.content, 'utf-8');
    const lineCount = this.countLines(options.content);

    // Déterminer le stockage
    let storageKey = file.storageKey;
    let storageUrl = file.storageUrl;
    let content: string | null = options.content;

    if (size > MAX_INLINE_SIZE) {
      // Stocker en S3
      if (!storageKey) {
        storageKey = this.generateStorageKey(userId, fileId, file.name);
      }
      const result = await storagePut(storageKey, options.content, file.mimeType || 'text/plain');
      storageUrl = result.url;
      content = null;
    } else if (storageKey) {
      // Le fichier était en S3 mais est maintenant assez petit pour être inline
      // On garde le storageKey pour référence mais on stocke aussi inline
    }

    // Mettre à jour le fichier
    await db.update(workspaceFiles)
      .set({
        content,
        storageKey,
        storageUrl,
        size,
        lineCount,
        version: newVersion,
        lastModifiedBy: 'agent'
      })
      .where(eq(workspaceFiles.id, fileId));

    // Enregistrer dans l'historique
    await db.insert(workspaceFileHistory).values([{
      fileId,
      userId,
      content,
      storageKey,
      version: newVersion,
      changeType: 'edit',
      changeDescription: options.changeDescription || 'File updated',
      changedBy: 'agent'
    }]);

    console.log(`[FileSystemManager] Updated file: ${file.path} (v${newVersion})`);

    return {
      id: fileId,
      userId,
      path: file.path,
      name: file.name,
      fileType: file.fileType as 'file' | 'directory',
      mimeType: file.mimeType,
      size,
      content,
      storageUrl,
      language: file.language,
      version: newVersion,
      createdAt: file.createdAt,
      updatedAt: new Date()
    };
  }

  /**
   * Supprime un fichier
   */
  async deleteFile(fileId: string, userId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Récupérer le fichier
    const files = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.id, fileId),
        eq(workspaceFiles.userId, userId)
      ))
      .limit(1);

    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];

    // Enregistrer la suppression dans l'historique
    await db.insert(workspaceFileHistory).values([{
      fileId,
      userId,
      content: file.content,
      storageKey: file.storageKey,
      version: (file.version || 1) + 1,
      changeType: 'delete',
      changeDescription: 'File deleted',
      changedBy: 'agent'
    }]);

    // Supprimer le fichier
    await db.delete(workspaceFiles)
      .where(eq(workspaceFiles.id, fileId));

    console.log(`[FileSystemManager] Deleted file: ${file.path}`);
  }

  /**
   * Liste les fichiers dans un dossier
   */
  async listFiles(options: ListFilesOptions): Promise<FileInfo[]> {
    const db = await getDb();
    if (!db) return [];

    const directory = this.normalizePath(options.directory || '/');
    const fileType = options.fileType || 'all';

    let files;
    if (options.recursive) {
      // Récursif: tous les fichiers qui commencent par le chemin du dossier
      files = await db.select()
        .from(workspaceFiles)
        .where(and(
          eq(workspaceFiles.userId, options.userId),
          like(workspaceFiles.path, `${directory}%`)
        ))
        .orderBy(
          asc(workspaceFiles.fileType),
          asc(workspaceFiles.name)
        );
    } else {
      // Non récursif: seulement les fichiers directement dans le dossier
      const pathPattern = directory === '/' ? '/%' : `${directory}/%`;
      files = await db.select()
        .from(workspaceFiles)
        .where(and(
          eq(workspaceFiles.userId, options.userId),
          like(workspaceFiles.path, pathPattern),
          sql`${workspaceFiles.path} NOT LIKE CONCAT(${pathPattern}, '%/%')`
        ))
        .orderBy(
          asc(workspaceFiles.fileType),
          asc(workspaceFiles.name)
        );
    }

    // Filtrer par type si nécessaire
    let result = files;
    if (fileType !== 'all') {
      result = files.filter(f => f.fileType === fileType);
    }

    return result.map(f => ({
      id: f.id,
      userId: f.userId,
      path: f.path,
      name: f.name,
      fileType: f.fileType as 'file' | 'directory',
      mimeType: f.mimeType,
      size: f.size || 0,
      content: f.content,
      storageUrl: f.storageUrl,
      language: f.language,
      version: f.version || 1,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt
    }));
  }

  /**
   * Crée un dossier
   */
  async createDirectory(userId: number, dirPath: string): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const normalizedPath = this.normalizePath(dirPath);
    const dirName = this.getFileName(normalizedPath);
    const dirId = nanoid();

    // Créer les dossiers parents
    await this.ensureParentDirs(userId, normalizedPath + '/dummy');

    // Vérifier si le dossier existe déjà
    const existing = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].fileType === 'directory') {
        return {
          id: existing[0].id,
          userId: existing[0].userId,
          path: existing[0].path,
          name: existing[0].name,
          fileType: 'directory',
          mimeType: null,
          size: 0,
          content: null,
          storageUrl: null,
          language: null,
          version: 1,
          createdAt: existing[0].createdAt,
          updatedAt: existing[0].updatedAt
        };
      }
      throw new Error('A file with this name already exists');
    }

    // Créer le dossier
    await db.insert(workspaceFiles).values([{
      id: dirId,
      userId,
      path: normalizedPath,
      name: dirName,
      fileType: 'directory',
      mimeType: null,
      size: 0,
      content: null,
      storageKey: null,
      storageUrl: null,
      language: null,
      encoding: 'utf-8',
      lineCount: null,
      version: 1,
      lastModifiedBy: 'agent'
    }]);

    console.log(`[FileSystemManager] Created directory: ${normalizedPath}`);

    return {
      id: dirId,
      userId,
      path: normalizedPath,
      name: dirName,
      fileType: 'directory',
      mimeType: null,
      size: 0,
      content: null,
      storageUrl: null,
      language: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Supprime un dossier (et son contenu si récursif)
   */
  async deleteDirectory(userId: number, dirPath: string, recursive: boolean = false): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const normalizedPath = this.normalizePath(dirPath);

    // Vérifier si le dossier existe
    const dirs = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath),
        eq(workspaceFiles.fileType, 'directory')
      ))
      .limit(1);

    if (dirs.length === 0) {
      throw new Error('Directory not found');
    }

    // Vérifier si le dossier est vide
    const children = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        like(workspaceFiles.path, `${normalizedPath}/%`)
      ))
      .limit(1);

    if (children.length > 0 && !recursive) {
      throw new Error('Directory is not empty. Use recursive=true to delete contents.');
    }

    if (recursive) {
      // Supprimer tous les fichiers et sous-dossiers
      await db.delete(workspaceFiles)
        .where(and(
          eq(workspaceFiles.userId, userId),
          like(workspaceFiles.path, `${normalizedPath}/%`)
        ));
    }

    // Supprimer le dossier
    await db.delete(workspaceFiles)
      .where(eq(workspaceFiles.id, dirs[0].id));

    console.log(`[FileSystemManager] Deleted directory: ${normalizedPath}`);
  }

  /**
   * Déplace/renomme un fichier
   */
  async moveFile(fileId: string, userId: number, newPath: string): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const normalizedPath = this.normalizePath(newPath);
    const newName = this.getFileName(normalizedPath);

    // Récupérer le fichier
    const files = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.id, fileId),
        eq(workspaceFiles.userId, userId)
      ))
      .limit(1);

    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];
    const oldPath = file.path;

    // Créer les dossiers parents
    await this.ensureParentDirs(userId, normalizedPath);

    // Vérifier si la destination existe
    const existing = await db.select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('A file already exists at the destination');
    }

    // Mettre à jour le fichier
    await db.update(workspaceFiles)
      .set({
        path: normalizedPath,
        name: newName
      })
      .where(eq(workspaceFiles.id, fileId));

    // Enregistrer dans l'historique
    await db.insert(workspaceFileHistory).values([{
      fileId,
      userId,
      content: file.content,
      storageKey: file.storageKey,
      version: (file.version || 1) + 1,
      changeType: 'rename',
      changeDescription: `Moved from ${oldPath} to ${normalizedPath}`,
      changedBy: 'agent'
    }]);

    console.log(`[FileSystemManager] Moved file: ${oldPath} -> ${normalizedPath}`);

    return {
      id: fileId,
      userId,
      path: normalizedPath,
      name: newName,
      fileType: file.fileType as 'file' | 'directory',
      mimeType: file.mimeType,
      size: file.size || 0,
      content: file.content,
      storageUrl: file.storageUrl,
      language: file.language,
      version: (file.version || 1) + 1,
      createdAt: file.createdAt,
      updatedAt: new Date()
    };
  }

  /**
   * Copie un fichier
   */
  async copyFile(fileId: string, userId: number, newPath: string): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Lire le fichier source
    const source = await this.readFile(fileId, userId);

    // Créer une copie
    return this.createFile({
      userId,
      path: newPath,
      content: source.content,
      mimeType: source.mimeType || undefined,
      language: source.language || undefined
    });
  }

  /**
   * Récupère l'historique d'un fichier
   */
  async getFileHistory(fileId: string, userId: number, limit: number = 20): Promise<Array<{
    version: number;
    changeType: string;
    changeDescription: string | null;
    changedBy: string;
    createdAt: Date;
  }>> {
    const db = await getDb();
    if (!db) return [];

    const history = await db.select()
      .from(workspaceFileHistory)
      .where(and(
        eq(workspaceFileHistory.fileId, fileId),
        eq(workspaceFileHistory.userId, userId)
      ))
      .orderBy(desc(workspaceFileHistory.version))
      .limit(limit);

    return history.map(h => ({
      version: h.version,
      changeType: h.changeType,
      changeDescription: h.changeDescription,
      changedBy: h.changedBy || 'agent',
      createdAt: h.createdAt
    }));
  }

  /**
   * Restaure un fichier à une version précédente
   */
  async restoreVersion(fileId: string, userId: number, version: number): Promise<FileInfo> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Récupérer la version demandée
    const history = await db.select()
      .from(workspaceFileHistory)
      .where(and(
        eq(workspaceFileHistory.fileId, fileId),
        eq(workspaceFileHistory.userId, userId),
        eq(workspaceFileHistory.version, version)
      ))
      .limit(1);

    if (history.length === 0) {
      throw new Error('Version not found');
    }

    const versionData = history[0];

    // Récupérer le contenu
    let content = versionData.content;
    if (!content && versionData.storageKey) {
      const { url } = await storageGet(versionData.storageKey);
      const response = await fetch(url);
      content = await response.text();
    }

    if (!content) {
      throw new Error('Cannot restore: content not available');
    }

    // Mettre à jour le fichier
    return this.updateFile(fileId, userId, {
      content,
      changeDescription: `Restored to version ${version}`
    });
  }

  /**
   * Recherche des fichiers par nom ou contenu
   */
  async searchFiles(userId: number, query: string, options?: {
    searchContent?: boolean;
    directory?: string;
    fileTypes?: string[];
  }): Promise<FileInfo[]> {
    const db = await getDb();
    if (!db) return [];

    const searchPattern = `%${query}%`;
    const dir = options?.directory ? this.normalizePath(options.directory) : null;

    const conditions = [
      eq(workspaceFiles.userId, userId),
      eq(workspaceFiles.fileType, 'file'),
      like(workspaceFiles.name, searchPattern)
    ];

    if (dir) {
      conditions.push(like(workspaceFiles.path, `${dir}%`));
    }

    const files = await db.select()
      .from(workspaceFiles)
      .where(and(...conditions))
      .orderBy(asc(workspaceFiles.name))
      .limit(50);

    return files.map(f => ({
      id: f.id,
      userId: f.userId,
      path: f.path,
      name: f.name,
      fileType: f.fileType as 'file' | 'directory',
      mimeType: f.mimeType,
      size: f.size || 0,
      content: f.content,
      storageUrl: f.storageUrl,
      language: f.language,
      version: f.version || 1,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt
    }));
  }

  /**
   * Récupère les statistiques du workspace d'un utilisateur
   */
  async getWorkspaceStats(userId: number): Promise<{
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    languageBreakdown: Record<string, number>;
  }> {
    const db = await getDb();
    if (!db) return { totalFiles: 0, totalDirectories: 0, totalSize: 0, languageBreakdown: {} };

    const files = await db.select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.userId, userId));

    const stats = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      languageBreakdown: {} as Record<string, number>
    };

    for (const file of files) {
      if (file.fileType === 'directory') {
        stats.totalDirectories++;
      } else {
        stats.totalFiles++;
        stats.totalSize += file.size || 0;
        if (file.language) {
          stats.languageBreakdown[file.language] = (stats.languageBreakdown[file.language] || 0) + 1;
        }
      }
    }

    return stats;
  }
}

// Export singleton
export const fileSystemManager = FileSystemManager.getInstance();
export default fileSystemManager;
