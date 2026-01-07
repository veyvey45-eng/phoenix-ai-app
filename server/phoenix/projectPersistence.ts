/**
 * Project Persistence Service
 * 
 * Gère la sauvegarde et la restauration des projets Phoenix.
 * Synchronise les fichiers entre E2B Sandbox et la base de données.
 */

import { getDb } from "../db";
import { 
  phoenixProjects, 
  phoenixProjectFiles, 
  phoenixProjectSnapshots,
  phoenixProjectLogs,
  type PhoenixProject,
  type PhoenixProjectFile,
  type InsertPhoenixProject,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { Sandbox } from "e2b";

// ============================================================================
// Types
// ============================================================================

export interface ProjectFile {
  path: string;
  content: string;
  mimeType?: string;
  size?: number;
}

export interface ProjectInfo {
  id: number;
  name: string;
  description?: string;
  projectType: string;
  status: string;
  sandboxId?: string;
  previewUrl?: string;
  isPreviewActive: boolean;
  totalFiles: number;
  totalSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  success: boolean;
  filesAdded: number;
  filesUpdated: number;
  filesDeleted: number;
  totalSize: number;
  error?: string;
}

// ============================================================================
// Project CRUD Operations
// ============================================================================

/**
 * Crée un nouveau projet dans la base de données
 */
export async function createProject(
  userId: number,
  name: string,
  projectType: "static" | "nodejs" | "python" | "react" | "nextjs" | "other" = "static",
  description?: string
): Promise<PhoenixProject | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [project] = await db.insert(phoenixProjects).values({
    userId,
    name,
    description,
    projectType,
    status: "active",
    totalFiles: 0,
    totalSize: 0,
    isPreviewActive: false,
  });
  
  // Récupérer le projet créé
  const [created] = await db
    .select()
    .from(phoenixProjects)
    .where(eq(phoenixProjects.id, project.insertId))
    .limit(1);
  
  // Log l'action
  if (created) {
    await logProjectAction(created.id, userId, "create", { name, projectType });
  }
  
  return created || null;
}

/**
 * Récupère un projet par son ID
 */
export async function getProject(projectId: number): Promise<PhoenixProject | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [project] = await db
    .select()
    .from(phoenixProjects)
    .where(eq(phoenixProjects.id, projectId))
    .limit(1);
  
  return project || null;
}

/**
 * Récupère tous les projets d'un utilisateur
 */
export async function getUserProjects(userId: number): Promise<PhoenixProject[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(phoenixProjects)
    .where(and(
      eq(phoenixProjects.userId, userId),
      eq(phoenixProjects.status, "active")
    ))
    .orderBy(desc(phoenixProjects.updatedAt));
}

/**
 * Met à jour un projet
 */
export async function updateProject(
  projectId: number,
  updates: Partial<InsertPhoenixProject>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(phoenixProjects)
    .set(updates)
    .where(eq(phoenixProjects.id, projectId));
}

/**
 * Archive un projet (soft delete)
 */
export async function archiveProject(projectId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(phoenixProjects)
    .set({ status: "archived" })
    .where(eq(phoenixProjects.id, projectId));
  
  await logProjectAction(projectId, userId, "delete", { archived: true });
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Sauvegarde un fichier dans la base de données
 */
export async function saveProjectFile(
  projectId: number,
  path: string,
  content: string,
  mimeType?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Vérifier si le fichier existe déjà
  const [existing] = await db
    .select()
    .from(phoenixProjectFiles)
    .where(and(
      eq(phoenixProjectFiles.projectId, projectId),
      eq(phoenixProjectFiles.path, path)
    ))
    .limit(1);
  
  const size = Buffer.byteLength(content, "utf-8");
  const fileType = getFileType(path, mimeType);
  
  if (existing) {
    // Mettre à jour le fichier existant
    await db
      .update(phoenixProjectFiles)
      .set({
        content,
        mimeType: mimeType || existing.mimeType,
        size,
        version: (existing.version || 1) + 1,
      })
      .where(eq(phoenixProjectFiles.id, existing.id));
  } else {
    // Créer un nouveau fichier
    await db.insert(phoenixProjectFiles).values({
      projectId,
      path,
      content,
      mimeType: mimeType || getMimeType(path),
      size,
      fileType,
      version: 1,
      isDeleted: false,
    });
  }
}

/**
 * Récupère un fichier du projet
 */
export async function getProjectFile(
  projectId: number,
  path: string
): Promise<PhoenixProjectFile | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [file] = await db
    .select()
    .from(phoenixProjectFiles)
    .where(and(
      eq(phoenixProjectFiles.projectId, projectId),
      eq(phoenixProjectFiles.path, path),
      eq(phoenixProjectFiles.isDeleted, false)
    ))
    .limit(1);
  
  return file || null;
}

/**
 * Récupère tous les fichiers d'un projet
 */
export async function getProjectFiles(projectId: number): Promise<PhoenixProjectFile[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(phoenixProjectFiles)
    .where(and(
      eq(phoenixProjectFiles.projectId, projectId),
      eq(phoenixProjectFiles.isDeleted, false)
    ));
}

/**
 * Supprime un fichier (soft delete)
 */
export async function deleteProjectFile(projectId: number, path: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(phoenixProjectFiles)
    .set({ isDeleted: true })
    .where(and(
      eq(phoenixProjectFiles.projectId, projectId),
      eq(phoenixProjectFiles.path, path)
    ));
}

// ============================================================================
// E2B Sandbox Sync
// ============================================================================

/**
 * Synchronise les fichiers du sandbox E2B vers la base de données
 */
export async function syncFromSandbox(
  projectId: number,
  sandbox: Sandbox,
  projectPath: string
): Promise<SyncResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      filesAdded: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      totalSize: 0,
      error: "Database not available",
    };
  }
  
  try {
    // Lister tous les fichiers du projet dans le sandbox
    const result = await sandbox.commands.run(`find ${projectPath} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null || true`);
    
    if (!result.stdout) {
      return {
        success: true,
        filesAdded: 0,
        filesUpdated: 0,
        filesDeleted: 0,
        totalSize: 0,
      };
    }
    
    const filePaths = result.stdout.trim().split("\n").filter(Boolean);
    let filesAdded = 0;
    let filesUpdated = 0;
    let totalSize = 0;
    
    for (const fullPath of filePaths) {
      try {
        // Lire le contenu du fichier
        const content = await sandbox.files.read(fullPath);
        const relativePath = fullPath.replace(projectPath + "/", "");
        
        // Vérifier si le fichier existe déjà
        const existing = await getProjectFile(projectId, relativePath);
        
        // Sauvegarder le fichier
        await saveProjectFile(projectId, relativePath, content);
        
        if (existing) {
          filesUpdated++;
        } else {
          filesAdded++;
        }
        
        totalSize += Buffer.byteLength(content, "utf-8");
      } catch (err) {
        console.error(`[ProjectPersistence] Error reading file ${fullPath}:`, err);
      }
    }
    
    // Mettre à jour les métadonnées du projet
    await updateProject(projectId, {
      totalFiles: filePaths.length,
      totalSize,
      lastSyncedAt: new Date(),
    });
    
    return {
      success: true,
      filesAdded,
      filesUpdated,
      filesDeleted: 0,
      totalSize,
    };
  } catch (error) {
    console.error("[ProjectPersistence] Sync from sandbox failed:", error);
    return {
      success: false,
      filesAdded: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      totalSize: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Restaure les fichiers de la base de données vers un nouveau sandbox E2B
 */
export async function syncToSandbox(
  projectId: number,
  sandbox: Sandbox,
  projectPath: string
): Promise<SyncResult> {
  try {
    // Créer le répertoire du projet
    await sandbox.commands.run(`mkdir -p ${projectPath}`);
    
    // Récupérer tous les fichiers du projet
    const files = await getProjectFiles(projectId);
    
    let filesAdded = 0;
    let totalSize = 0;
    
    for (const file of files) {
      try {
        const fullPath = `${projectPath}/${file.path}`;
        
        // Créer les répertoires parents si nécessaire
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dirPath) {
          await sandbox.commands.run(`mkdir -p "${dirPath}"`);
        }
        
        // Écrire le fichier
        if (file.content) {
          await sandbox.files.write(fullPath, file.content);
          filesAdded++;
          totalSize += file.size || 0;
        }
      } catch (err) {
        console.error(`[ProjectPersistence] Error writing file ${file.path}:`, err);
      }
    }
    
    return {
      success: true,
      filesAdded,
      filesUpdated: 0,
      filesDeleted: 0,
      totalSize,
    };
  } catch (error) {
    console.error("[ProjectPersistence] Sync to sandbox failed:", error);
    return {
      success: false,
      filesAdded: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      totalSize: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Snapshots
// ============================================================================

/**
 * Crée un snapshot du projet
 */
export async function createSnapshot(
  projectId: number,
  name?: string,
  description?: string
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Récupérer tous les fichiers
  const files = await getProjectFiles(projectId);
  
  const filesJson = files.map(f => ({
    path: f.path,
    content: f.content || "",
    mimeType: f.mimeType || "text/plain",
    size: f.size || 0,
  }));
  
  const totalSize = filesJson.reduce((sum, f) => sum + f.size, 0);
  
  const [result] = await db.insert(phoenixProjectSnapshots).values({
    projectId,
    name: name || `Snapshot ${new Date().toISOString()}`,
    description,
    filesJson,
    totalFiles: files.length,
    totalSize,
  });
  
  // Log l'action
  const project = await getProject(projectId);
  if (project) {
    await logProjectAction(projectId, project.userId, "create_snapshot", { 
      snapshotId: result.insertId,
      name,
      totalFiles: files.length,
    });
  }
  
  return result.insertId;
}

/**
 * Restaure un projet depuis un snapshot
 */
export async function restoreFromSnapshot(
  projectId: number,
  snapshotId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Récupérer le snapshot
  const [snapshot] = await db
    .select()
    .from(phoenixProjectSnapshots)
    .where(eq(phoenixProjectSnapshots.id, snapshotId))
    .limit(1);
  
  if (!snapshot || !snapshot.filesJson) {
    return false;
  }
  
  // Supprimer les fichiers existants
  await db
    .update(phoenixProjectFiles)
    .set({ isDeleted: true })
    .where(eq(phoenixProjectFiles.projectId, projectId));
  
  // Restaurer les fichiers du snapshot
  for (const file of snapshot.filesJson) {
    await saveProjectFile(projectId, file.path, file.content, file.mimeType);
  }
  
  // Mettre à jour les métadonnées du projet
  await updateProject(projectId, {
    totalFiles: snapshot.totalFiles || 0,
    totalSize: snapshot.totalSize || 0,
  });
  
  // Log l'action
  const project = await getProject(projectId);
  if (project) {
    await logProjectAction(projectId, project.userId, "restore_snapshot", { snapshotId });
  }
  
  return true;
}

/**
 * Récupère les snapshots d'un projet
 */
export async function getProjectSnapshots(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      id: phoenixProjectSnapshots.id,
      name: phoenixProjectSnapshots.name,
      description: phoenixProjectSnapshots.description,
      totalFiles: phoenixProjectSnapshots.totalFiles,
      totalSize: phoenixProjectSnapshots.totalSize,
      createdAt: phoenixProjectSnapshots.createdAt,
    })
    .from(phoenixProjectSnapshots)
    .where(eq(phoenixProjectSnapshots.projectId, projectId))
    .orderBy(desc(phoenixProjectSnapshots.createdAt));
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log une action sur un projet
 */
async function logProjectAction(
  projectId: number,
  userId: number | null,
  action: "create" | "update" | "delete" | "restore" | "start_preview" | "stop_preview" | "sync_to_db" | "sync_from_db" | "create_snapshot" | "restore_snapshot" | "download" | "upload",
  details?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(phoenixProjectLogs).values({
    projectId,
    userId,
    action,
    details,
    status: "success",
  });
}

// ============================================================================
// Helpers
// ============================================================================

function getFileType(path: string, mimeType?: string): "text" | "binary" | "image" | "other" {
  const ext = path.split(".").pop()?.toLowerCase();
  
  if (mimeType?.startsWith("image/")) return "image";
  
  const textExtensions = ["txt", "md", "json", "js", "ts", "jsx", "tsx", "html", "css", "scss", "less", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp", "xml", "yaml", "yml", "toml", "ini", "cfg", "sh", "bash", "zsh", "fish", "sql", "graphql", "vue", "svelte"];
  
  if (ext && textExtensions.includes(ext)) return "text";
  
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
  if (ext && imageExtensions.includes(ext)) return "image";
  
  const binaryExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "zip", "tar", "gz", "rar", "7z", "exe", "dll", "so", "dylib"];
  if (ext && binaryExtensions.includes(ext)) return "binary";
  
  return "other";
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "ts": "application/typescript",
    "json": "application/json",
    "md": "text/markdown",
    "txt": "text/plain",
    "py": "text/x-python",
    "jsx": "text/jsx",
    "tsx": "text/tsx",
    "xml": "application/xml",
    "yaml": "application/yaml",
    "yml": "application/yaml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "webp": "image/webp",
    "ico": "image/x-icon",
  };
  
  return mimeTypes[ext || ""] || "application/octet-stream";
}

// ============================================================================
// Export Download
// ============================================================================

/**
 * Génère une archive JSON du projet
 */
export async function exportProjectAsJson(projectId: number): Promise<{ filename: string; content: string } | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  
  const files = await getProjectFiles(projectId);
  if (files.length === 0) return null;
  
  const exportData = {
    project: {
      name: project.name,
      description: project.description,
      projectType: project.projectType,
      createdAt: project.createdAt,
    },
    files: files.map(f => ({
      path: f.path,
      content: f.content,
      mimeType: f.mimeType,
    })),
  };
  
  const content = Buffer.from(JSON.stringify(exportData, null, 2)).toString("base64");
  
  return {
    filename: `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.json`,
    content,
  };
}

// ============================================================================
// Auto-Save Timer
// ============================================================================

// Map pour stocker les timers de sauvegarde automatique
const autoSaveTimers = new Map<number, NodeJS.Timeout>();

/**
 * Démarre la sauvegarde automatique pour un projet
 * Sauvegarde toutes les 5 minutes pour éviter la perte de données
 */
export function startAutoSave(
  projectId: number,
  sandbox: Sandbox,
  projectPath: string,
  intervalMs: number = 5 * 60 * 1000 // 5 minutes par défaut
): void {
  // Arrêter le timer existant si présent
  stopAutoSave(projectId);
  
  const timer = setInterval(async () => {
    console.log(`[AutoSave] Saving project ${projectId}...`);
    const result = await syncFromSandbox(projectId, sandbox, projectPath);
    if (result.success) {
      console.log(`[AutoSave] Project ${projectId} saved: ${result.filesAdded} added, ${result.filesUpdated} updated`);
    } else {
      console.error(`[AutoSave] Failed to save project ${projectId}:`, result.error);
    }
  }, intervalMs);
  
  autoSaveTimers.set(projectId, timer);
  console.log(`[AutoSave] Started for project ${projectId} (interval: ${intervalMs}ms)`);
}

/**
 * Arrête la sauvegarde automatique pour un projet
 */
export function stopAutoSave(projectId: number): void {
  const timer = autoSaveTimers.get(projectId);
  if (timer) {
    clearInterval(timer);
    autoSaveTimers.delete(projectId);
    console.log(`[AutoSave] Stopped for project ${projectId}`);
  }
}

/**
 * Sauvegarde immédiate d'un projet (avant fermeture du sandbox)
 */
export async function saveProjectNow(
  projectId: number,
  sandbox: Sandbox,
  projectPath: string
): Promise<SyncResult> {
  console.log(`[SaveNow] Saving project ${projectId} immediately...`);
  stopAutoSave(projectId);
  return syncFromSandbox(projectId, sandbox, projectPath);
}
