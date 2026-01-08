/**
 * E2B FILE SYNC - Synchronisation Bidirectionnelle avec E2B Sandbox
 * 
 * Ce module gère la synchronisation des fichiers entre:
 * - Le système de fichiers persistant de Phoenix (base de données + S3)
 * - Le sandbox E2B pour l'exécution de code
 * 
 * Fonctionnalités:
 * 1. Upload de fichiers vers E2B avant exécution
 * 2. Download des fichiers générés depuis E2B
 * 3. Synchronisation automatique du workspace
 * 4. Gestion des conflits et versions
 * 5. Cache local pour performances
 */

import { Sandbox } from '@e2b/code-interpreter';
import { FileSystemManager, FileInfo } from './fileSystemManager';
import { storagePut, storageGet } from '../storage';
import { EventEmitter } from 'events';
import * as path from 'path';

// Types
export interface SyncResult {
  success: boolean;
  filesUploaded: number;
  filesDownloaded: number;
  errors: string[];
  duration: number;
}

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  content?: string;
  size?: number;
}

export interface SyncOptions {
  uploadPaths?: string[];  // Chemins à uploader vers E2B
  downloadPaths?: string[]; // Chemins à télécharger depuis E2B
  excludePatterns?: string[]; // Patterns à exclure
  watchForChanges?: boolean; // Observer les changements
}

// Constantes
const DEFAULT_WORKSPACE_PATH = '/home/user/workspace';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max par fichier
const SYNC_TIMEOUT = 60000; // 1 minute timeout

/**
 * Classe E2BFileSync - Gère la synchronisation bidirectionnelle
 */
export class E2BFileSync extends EventEmitter {
  private fileSystem: FileSystemManager;
  private sandbox: InstanceType<typeof Sandbox> | null = null;
  private userId: number;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private fileCache: Map<string, { content: string; hash: string; timestamp: number }> = new Map();

  constructor(userId: number) {
    super();
    this.userId = userId;
    this.fileSystem = FileSystemManager.getInstance();
  }

  /**
   * Initialise la connexion avec le sandbox E2B
   */
  async connect(): Promise<boolean> {
    try {
      if (!process.env.E2B_API_KEY) {
        console.warn('[E2BFileSync] E2B API key not configured');
        return false;
      }

      console.log('[E2BFileSync] Connecting to E2B sandbox...');
      this.sandbox = await Sandbox.create();
      console.log('[E2BFileSync] ✅ Connected to E2B sandbox');

      // Créer le répertoire de workspace
      await this.ensureWorkspaceDir();

      this.emit('connected');
      return true;
    } catch (error) {
      console.error('[E2BFileSync] Failed to connect:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Ferme la connexion avec le sandbox
   */
  async disconnect(): Promise<void> {
    if (this.sandbox) {
      try {
        // E2B sandbox se ferme automatiquement après timeout
        this.sandbox = null;
        console.log('[E2BFileSync] Disconnected from E2B sandbox');
        this.emit('disconnected');
      } catch (error) {
        console.error('[E2BFileSync] Error disconnecting:', error);
      }
    }
  }

  /**
   * Assure que le répertoire de workspace existe
   */
  private async ensureWorkspaceDir(): Promise<void> {
    if (!this.sandbox) return;

    try {
      await this.sandbox.runCode(`
import os
os.makedirs('${DEFAULT_WORKSPACE_PATH}', exist_ok=True)
print('Workspace directory ready')
      `, { language: 'python' });
    } catch (error) {
      console.error('[E2BFileSync] Failed to create workspace dir:', error);
    }
  }

  /**
   * Synchronise les fichiers du workspace Phoenix vers E2B
   */
  async syncToE2B(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      filesUploaded: 0,
      filesDownloaded: 0,
      errors: [],
      duration: 0
    };

    if (this.syncInProgress) {
      result.errors.push('Sync already in progress');
      result.duration = Date.now() - startTime;
      return result;
    }

    if (!this.sandbox) {
      const connected = await this.connect();
      if (!connected) {
        result.errors.push('Failed to connect to E2B sandbox');
        result.duration = Date.now() - startTime;
        return result;
      }
    }

    this.syncInProgress = true;
    this.emit('syncStarted', { direction: 'toE2B' });

    try {
      // Lister les fichiers à synchroniser
      const files = await this.fileSystem.listFiles({
        userId: this.userId,
        recursive: true,
        fileType: 'file'
      });

      // Filtrer les fichiers selon les options
      const filesToSync = this.filterFiles(files, options);

      console.log(`[E2BFileSync] Syncing ${filesToSync.length} files to E2B...`);

      for (const file of filesToSync) {
        try {
          // Lire le contenu du fichier
          const fileContent = await this.fileSystem.readFile(file.id, this.userId);
          
          if (!fileContent.content) {
            continue;
          }

          // Vérifier la taille
          if (fileContent.content.length > MAX_FILE_SIZE) {
            result.errors.push(`File too large: ${file.path}`);
            continue;
          }

          // Uploader vers E2B
          const e2bPath = path.join(DEFAULT_WORKSPACE_PATH, file.path);
          await this.uploadFileToE2B(e2bPath, fileContent.content);
          
          result.filesUploaded++;
          this.emit('fileUploaded', { path: file.path });
        } catch (error) {
          result.errors.push(`Failed to sync ${file.path}: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      this.lastSyncTime = new Date();
      
    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
    } finally {
      this.syncInProgress = false;
      result.duration = Date.now() - startTime;
      this.emit('syncCompleted', result);
    }

    return result;
  }

  /**
   * Synchronise les fichiers depuis E2B vers Phoenix
   */
  async syncFromE2B(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      filesUploaded: 0,
      filesDownloaded: 0,
      errors: [],
      duration: 0
    };

    if (this.syncInProgress) {
      result.errors.push('Sync already in progress');
      result.duration = Date.now() - startTime;
      return result;
    }

    if (!this.sandbox) {
      result.errors.push('Not connected to E2B sandbox');
      result.duration = Date.now() - startTime;
      return result;
    }

    this.syncInProgress = true;
    this.emit('syncStarted', { direction: 'fromE2B' });

    try {
      // Lister les fichiers dans le workspace E2B
      const e2bFiles = await this.listE2BFiles(DEFAULT_WORKSPACE_PATH);

      console.log(`[E2BFileSync] Found ${e2bFiles.length} files in E2B workspace`);

      for (const e2bFile of e2bFiles) {
        try {
          // Télécharger le contenu
          const content = await this.downloadFileFromE2B(e2bFile.path);
          
          if (!content) {
            continue;
          }

          // Calculer le chemin relatif
          const relativePath = e2bFile.path.replace(DEFAULT_WORKSPACE_PATH, '');

          // Vérifier si le fichier existe déjà
          const existingFiles = await this.fileSystem.listFiles({
            userId: this.userId,
            directory: path.dirname(relativePath),
            fileType: 'file'
          });

          const existingFile = existingFiles.find(f => f.path === relativePath);

          if (existingFile) {
            // Mettre à jour le fichier existant
            await this.fileSystem.updateFile(existingFile.id, this.userId, {
              content,
              changeDescription: 'Synced from E2B sandbox'
            });
          } else {
            // Créer un nouveau fichier
            await this.fileSystem.createFile({
              userId: this.userId,
              path: relativePath,
              content
            });
          }

          result.filesDownloaded++;
          this.emit('fileDownloaded', { path: relativePath });
        } catch (error) {
          result.errors.push(`Failed to download ${e2bFile.path}: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      this.lastSyncTime = new Date();

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
    } finally {
      this.syncInProgress = false;
      result.duration = Date.now() - startTime;
      this.emit('syncCompleted', result);
    }

    return result;
  }

  /**
   * Synchronisation bidirectionnelle complète
   */
  async fullSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    // D'abord, sync vers E2B
    const toE2BResult = await this.syncToE2B(options);
    
    // Ensuite, sync depuis E2B
    const fromE2BResult = await this.syncFromE2B(options);

    return {
      success: toE2BResult.success && fromE2BResult.success,
      filesUploaded: toE2BResult.filesUploaded,
      filesDownloaded: fromE2BResult.filesDownloaded,
      errors: [...toE2BResult.errors, ...fromE2BResult.errors],
      duration: Date.now() - startTime
    };
  }

  /**
   * Upload un fichier vers E2B
   */
  private async uploadFileToE2B(e2bPath: string, content: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Not connected to E2B sandbox');
    }

    // Créer le répertoire parent si nécessaire
    const dir = path.dirname(e2bPath);
    
    // Encoder le contenu en base64 pour éviter les problèmes d'échappement
    const base64Content = Buffer.from(content).toString('base64');

    const code = `
import os
import base64

# Créer le répertoire parent
os.makedirs('${dir}', exist_ok=True)

# Décoder et écrire le fichier
content = base64.b64decode('${base64Content}').decode('utf-8')
with open('${e2bPath}', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'File written: ${e2bPath}')
`;

    const result = await this.sandbox.runCode(code, { language: 'python' });
    
    if (result.error) {
      throw new Error(result.error.value);
    }
  }

  /**
   * Télécharge un fichier depuis E2B
   */
  private async downloadFileFromE2B(e2bPath: string): Promise<string | null> {
    if (!this.sandbox) {
      throw new Error('Not connected to E2B sandbox');
    }

    const code = `
import base64

try:
    with open('${e2bPath}', 'r', encoding='utf-8') as f:
        content = f.read()
    # Encoder en base64 pour le transfert
    print(base64.b64encode(content.encode('utf-8')).decode('ascii'))
except Exception as e:
    print(f'ERROR: {e}')
`;

    const result = await this.sandbox.runCode(code, { language: 'python' });
    
    if (result.error) {
      console.error(`[E2BFileSync] Failed to read ${e2bPath}:`, result.error.value);
      return null;
    }

    const output = result.logs?.stdout?.join('') || '';
    
    if (output.startsWith('ERROR:')) {
      console.error(`[E2BFileSync] ${output}`);
      return null;
    }

    try {
      return Buffer.from(output.trim(), 'base64').toString('utf-8');
    } catch (error) {
      console.error(`[E2BFileSync] Failed to decode content from ${e2bPath}`);
      return null;
    }
  }

  /**
   * Liste les fichiers dans le workspace E2B
   */
  private async listE2BFiles(directory: string): Promise<Array<{ path: string; size: number }>> {
    if (!this.sandbox) {
      return [];
    }

    const code = `
import os
import json

files = []
for root, dirs, filenames in os.walk('${directory}'):
    for filename in filenames:
        filepath = os.path.join(root, filename)
        try:
            size = os.path.getsize(filepath)
            files.append({'path': filepath, 'size': size})
        except:
            pass

print(json.dumps(files))
`;

    const result = await this.sandbox.runCode(code, { language: 'python' });
    
    if (result.error) {
      console.error('[E2BFileSync] Failed to list E2B files:', result.error.value);
      return [];
    }

    const output = result.logs?.stdout?.join('') || '[]';
    
    try {
      return JSON.parse(output);
    } catch (error) {
      console.error('[E2BFileSync] Failed to parse file list');
      return [];
    }
  }

  /**
   * Filtre les fichiers selon les options
   */
  private filterFiles(files: FileInfo[], options: SyncOptions): FileInfo[] {
    let filtered = files;

    // Filtrer par chemins spécifiques
    if (options.uploadPaths && options.uploadPaths.length > 0) {
      filtered = filtered.filter(f => 
        options.uploadPaths!.some(p => f.path.startsWith(p))
      );
    }

    // Exclure les patterns
    if (options.excludePatterns && options.excludePatterns.length > 0) {
      filtered = filtered.filter(f => 
        !options.excludePatterns!.some(p => f.path.includes(p))
      );
    }

    return filtered;
  }

  /**
   * Exécute du code avec synchronisation automatique
   */
  async executeWithSync(
    code: string, 
    language: 'python' | 'javascript',
    syncBefore = true,
    syncAfter = true
  ): Promise<{
    execution: any;
    syncResult: SyncResult | null;
  }> {
    // Sync avant exécution
    let syncResult: SyncResult | null = null;
    
    if (syncBefore) {
      syncResult = await this.syncToE2B();
    }

    // Exécuter le code
    if (!this.sandbox) {
      await this.connect();
    }

    const execution = await this.sandbox?.runCode(code, { language });

    // Sync après exécution
    if (syncAfter) {
      const afterSync = await this.syncFromE2B();
      if (syncResult) {
        syncResult.filesDownloaded = afterSync.filesDownloaded;
        syncResult.errors.push(...afterSync.errors);
      } else {
        syncResult = afterSync;
      }
    }

    return { execution, syncResult };
  }

  /**
   * Retourne les statistiques de synchronisation
   */
  getStats(): {
    connected: boolean;
    lastSyncTime: Date | null;
    cacheSize: number;
    syncInProgress: boolean;
  } {
    return {
      connected: this.sandbox !== null,
      lastSyncTime: this.lastSyncTime,
      cacheSize: this.fileCache.size,
      syncInProgress: this.syncInProgress
    };
  }
}

// Gestionnaire global des instances de sync
const syncInstances = new Map<number, E2BFileSync>();

/**
 * Obtient ou crée une instance de sync pour un utilisateur
 */
export function getE2BFileSync(userId: number): E2BFileSync {
  if (!syncInstances.has(userId)) {
    syncInstances.set(userId, new E2BFileSync(userId));
  }
  return syncInstances.get(userId)!;
}

export default E2BFileSync;
