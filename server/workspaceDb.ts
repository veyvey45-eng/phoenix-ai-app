/**
 * Workspace Database Helpers
 * Opérations CRUD pour le système de fichiers persistant
 */

import { eq, and, like, desc, asc } from "drizzle-orm";
import { getDb } from "./db";
import { workspaceFiles, workspaceFileHistory, InsertWorkspaceFile, InsertWorkspaceFileHistory } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { storagePut, storageGet } from "./storage";

// Taille max pour stocker le contenu directement en DB (64KB)
const MAX_INLINE_SIZE = 64 * 1024;

// Types MIME courants
const MIME_TYPES: Record<string, string> = {
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.py': 'text/x-python',
  '.sql': 'text/x-sql',
  '.sh': 'text/x-shellscript',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'text/xml',
  '.svg': 'image/svg+xml',
};

// Langages de programmation
const LANGUAGES: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.py': 'python',
  '.sql': 'sql',
  '.sh': 'bash',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
};

/**
 * Détecte le type MIME à partir de l'extension
 */
function detectMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'text/plain';
}

/**
 * Détecte le langage à partir de l'extension
 */
function detectLanguage(filename: string): string | null {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return LANGUAGES[ext] || null;
}

/**
 * Compte le nombre de lignes dans un texte
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Normalise un chemin de fichier
 */
function normalizePath(path: string): string {
  // Assurer que le chemin commence par /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  // Supprimer les doubles slashes
  path = path.replace(/\/+/g, '/');
  // Supprimer le slash final sauf pour la racine
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

/**
 * Extrait le nom du fichier d'un chemin
 */
function extractFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Extrait le répertoire parent d'un chemin
 */
function extractParentPath(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Créer un fichier dans le workspace
 */
export async function createWorkspaceFile(
  userId: number,
  path: string,
  content: string,
  options?: {
    fileType?: 'file' | 'directory';
    modifiedBy?: 'user' | 'agent';
  }
): Promise<{ success: boolean; file?: typeof workspaceFiles.$inferSelect; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedPath = normalizePath(path);
    const fileName = extractFileName(normalizedPath);
    const fileType = options?.fileType || 'file';
    const modifiedBy = options?.modifiedBy || 'agent';
    
    // Vérifier si le fichier existe déjà
    const existing = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return { success: false, error: `Le fichier ${normalizedPath} existe déjà` };
    }
    
    const fileId = nanoid();
    const size = Buffer.byteLength(content, 'utf-8');
    const mimeType = detectMimeType(fileName);
    const language = detectLanguage(fileName);
    const lineCount = countLines(content);
    
    let storageKey: string | null = null;
    let storageUrl: string | null = null;
    let inlineContent: string | null = content;
    
    // Si le fichier est trop gros, le stocker sur S3
    if (size > MAX_INLINE_SIZE) {
      const s3Key = `workspace/${userId}/${fileId}/${fileName}`;
      const result = await storagePut(s3Key, content, mimeType);
      storageKey = s3Key;
      storageUrl = result.url;
      inlineContent = null; // Ne pas stocker en DB
    }
    
    // Créer le fichier
    await db.insert(workspaceFiles).values({
      id: fileId,
      userId,
      path: normalizedPath,
      name: fileName,
      fileType,
      mimeType,
      size,
      content: inlineContent,
      storageKey,
      storageUrl,
      language,
      lineCount,
      version: 1,
      lastModifiedBy: modifiedBy,
    });
    
    // Créer l'entrée d'historique
    await db.insert(workspaceFileHistory).values({
      fileId,
      userId,
      content: inlineContent,
      storageKey,
      version: 1,
      changeType: 'create',
      changeDescription: `Fichier créé: ${normalizedPath}`,
      changedBy: modifiedBy,
    });
    
    // Récupérer le fichier créé
    const [file] = await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.id, fileId))
      .limit(1);
    
    return { success: true, file };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error creating file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lire un fichier du workspace
 */
export async function readWorkspaceFile(
  userId: number,
  path: string
): Promise<{ success: boolean; file?: typeof workspaceFiles.$inferSelect; content?: string; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedPath = normalizePath(path);
    
    const [file] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);
    
    if (!file) {
      return { success: false, error: `Fichier non trouvé: ${normalizedPath}` };
    }
    
    let content = file.content;
    
    // Si le contenu est sur S3, le récupérer
    if (!content && file.storageKey) {
      try {
        const { url } = await storageGet(file.storageKey);
        const response = await fetch(url);
        content = await response.text();
      } catch (e) {
        return { success: false, error: 'Erreur lors de la récupération du contenu depuis S3' };
      }
    }
    
    return { success: true, file, content: content || '' };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error reading file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Éditer un fichier du workspace
 */
export async function editWorkspaceFile(
  userId: number,
  path: string,
  newContent: string,
  options?: {
    modifiedBy?: 'user' | 'agent';
    changeDescription?: string;
  }
): Promise<{ success: boolean; file?: typeof workspaceFiles.$inferSelect; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedPath = normalizePath(path);
    const modifiedBy = options?.modifiedBy || 'agent';
    
    // Récupérer le fichier existant
    const [existing] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: `Fichier non trouvé: ${normalizedPath}` };
    }
    
    const size = Buffer.byteLength(newContent, 'utf-8');
    const lineCount = countLines(newContent);
    const newVersion = (existing.version || 1) + 1;
    
    let storageKey = existing.storageKey;
    let storageUrl = existing.storageUrl;
    let inlineContent: string | null = newContent;
    
    // Si le fichier est trop gros, le stocker sur S3
    if (size > MAX_INLINE_SIZE) {
      const s3Key = `workspace/${userId}/${existing.id}/${existing.name}`;
      const result = await storagePut(s3Key, newContent, existing.mimeType || 'text/plain');
      storageKey = s3Key;
      storageUrl = result.url;
      inlineContent = null;
    } else {
      // Si le fichier était sur S3 mais est maintenant petit, le garder inline
      storageKey = null;
      storageUrl = null;
    }
    
    // Mettre à jour le fichier
    await db
      .update(workspaceFiles)
      .set({
        content: inlineContent,
        storageKey,
        storageUrl,
        size,
        lineCount,
        version: newVersion,
        lastModifiedBy: modifiedBy,
      })
      .where(eq(workspaceFiles.id, existing.id));
    
    // Créer l'entrée d'historique
    await db.insert(workspaceFileHistory).values({
      fileId: existing.id,
      userId,
      content: inlineContent,
      storageKey,
      version: newVersion,
      changeType: 'edit',
      changeDescription: options?.changeDescription || `Fichier modifié: ${normalizedPath}`,
      changedBy: modifiedBy,
    });
    
    // Récupérer le fichier mis à jour
    const [file] = await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.id, existing.id))
      .limit(1);
    
    return { success: true, file };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error editing file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Supprimer un fichier du workspace
 */
export async function deleteWorkspaceFile(
  userId: number,
  path: string,
  options?: {
    modifiedBy?: 'user' | 'agent';
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedPath = normalizePath(path);
    const modifiedBy = options?.modifiedBy || 'agent';
    
    // Récupérer le fichier existant
    const [existing] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: `Fichier non trouvé: ${normalizedPath}` };
    }
    
    // Créer l'entrée d'historique avant suppression
    await db.insert(workspaceFileHistory).values({
      fileId: existing.id,
      userId,
      content: existing.content,
      storageKey: existing.storageKey,
      version: (existing.version || 1) + 1,
      changeType: 'delete',
      changeDescription: `Fichier supprimé: ${normalizedPath}`,
      changedBy: modifiedBy,
    });
    
    // Supprimer le fichier
    await db
      .delete(workspaceFiles)
      .where(eq(workspaceFiles.id, existing.id));
    
    return { success: true };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error deleting file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lister les fichiers du workspace
 */
export async function listWorkspaceFiles(
  userId: number,
  options?: {
    path?: string; // Filtrer par répertoire
    recursive?: boolean; // Inclure les sous-répertoires
    fileType?: 'file' | 'directory';
  }
): Promise<{ success: boolean; files?: Array<typeof workspaceFiles.$inferSelect>; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    let query = db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.userId, userId));
    
    const files = await query.orderBy(asc(workspaceFiles.path));
    
    let filteredFiles = files;
    
    // Filtrer par chemin si spécifié
    if (options?.path) {
      const basePath = normalizePath(options.path);
      if (options.recursive) {
        filteredFiles = files.filter((f: typeof workspaceFiles.$inferSelect) => f.path.startsWith(basePath));
      } else {
        filteredFiles = files.filter((f: typeof workspaceFiles.$inferSelect) => extractParentPath(f.path) === basePath);
      }
    }
    
    // Filtrer par type si spécifié
    if (options?.fileType) {
      filteredFiles = filteredFiles.filter((f: typeof workspaceFiles.$inferSelect) => f.fileType === options.fileType);
    }
    
    return { success: true, files: filteredFiles };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error listing files:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Créer un répertoire
 */
export async function createWorkspaceDirectory(
  userId: number,
  path: string
): Promise<{ success: boolean; file?: typeof workspaceFiles.$inferSelect; error?: string }> {
  return createWorkspaceFile(userId, path, '', { fileType: 'directory' });
}

/**
 * Vérifier si un fichier existe
 */
export async function workspaceFileExists(
  userId: number,
  path: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const normalizedPath = normalizePath(path);
  
  const [existing] = await db
    .select({ id: workspaceFiles.id })
    .from(workspaceFiles)
    .where(and(
      eq(workspaceFiles.userId, userId),
      eq(workspaceFiles.path, normalizedPath)
    ))
    .limit(1);
  
  return !!existing;
}

/**
 * Obtenir l'historique d'un fichier
 */
export async function getWorkspaceFileHistory(
  userId: number,
  path: string
): Promise<{ success: boolean; history?: Array<typeof workspaceFileHistory.$inferSelect>; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedPath = normalizePath(path);
    
    // Trouver le fichier
    const [file] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedPath)
      ))
      .limit(1);
    
    if (!file) {
      return { success: false, error: `Fichier non trouvé: ${normalizedPath}` };
    }
    
    // Récupérer l'historique
    const history = await db
      .select()
      .from(workspaceFileHistory)
      .where(eq(workspaceFileHistory.fileId, file.id))
      .orderBy(desc(workspaceFileHistory.version));
    
    return { success: true, history };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error getting file history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Renommer/déplacer un fichier
 */
export async function moveWorkspaceFile(
  userId: number,
  oldPath: string,
  newPath: string,
  options?: {
    modifiedBy?: 'user' | 'agent';
  }
): Promise<{ success: boolean; file?: typeof workspaceFiles.$inferSelect; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    const normalizedOldPath = normalizePath(oldPath);
    const normalizedNewPath = normalizePath(newPath);
    const newFileName = extractFileName(normalizedNewPath);
    const modifiedBy = options?.modifiedBy || 'agent';
    
    // Vérifier que le fichier source existe
    const [existing] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedOldPath)
      ))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: `Fichier non trouvé: ${normalizedOldPath}` };
    }
    
    // Vérifier que la destination n'existe pas
    const [destExists] = await db
      .select()
      .from(workspaceFiles)
      .where(and(
        eq(workspaceFiles.userId, userId),
        eq(workspaceFiles.path, normalizedNewPath)
      ))
      .limit(1);
    
    if (destExists) {
      return { success: false, error: `Un fichier existe déjà à: ${normalizedNewPath}` };
    }
    
    const newVersion = (existing.version || 1) + 1;
    
    // Mettre à jour le fichier
    await db
      .update(workspaceFiles)
      .set({
        path: normalizedNewPath,
        name: newFileName,
        version: newVersion,
        lastModifiedBy: modifiedBy,
      })
      .where(eq(workspaceFiles.id, existing.id));
    
    // Créer l'entrée d'historique
    await db.insert(workspaceFileHistory).values({
      fileId: existing.id,
      userId,
      content: existing.content,
      storageKey: existing.storageKey,
      version: newVersion,
      changeType: 'rename',
      changeDescription: `Fichier renommé: ${normalizedOldPath} → ${normalizedNewPath}`,
      changedBy: modifiedBy,
    });
    
    // Récupérer le fichier mis à jour
    const [file] = await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.id, existing.id))
      .limit(1);
    
    return { success: true, file };
  } catch (error: any) {
    console.error('[WorkspaceDB] Error moving file:', error);
    return { success: false, error: error.message };
  }
}
