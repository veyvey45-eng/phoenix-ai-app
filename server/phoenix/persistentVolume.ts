/**
 * E2B Persistent Volume Manager
 * 
 * Gère un volume persistant dédié pour Phoenix:
 * - Création et montage du volume
 * - Gestion des fichiers persistants
 * - Cycle de vie du volume
 * - Sauvegarde et synchronisation
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VolumeFile {
  path: string;
  content: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  isDirectory: boolean;
}

export interface VolumeStats {
  totalFiles: number;
  totalSize: number;
  createdAt: Date;
  lastModified: Date;
  filesCount: Record<string, number>; // Par type
}

export class PersistentVolumeManager {
  private volumePath: string;
  private volumeId: string;
  private files: Map<string, VolumeFile> = new Map();
  private maxVolumeSize: number = 1024 * 1024 * 100; // 100MB
  private createdAt: Date;

  constructor(volumeId: string) {
    this.volumeId = volumeId;
    this.volumePath = path.join(process.cwd(), '.volumes', volumeId);
    this.createdAt = new Date();

    // Créer le répertoire du volume
    if (!fs.existsSync(this.volumePath)) {
      fs.mkdirSync(this.volumePath, { recursive: true });
      console.log('[PersistentVolume] Created volume:', volumeId);
    } else {
      // Charger les fichiers existants
      this.loadExistingFiles();
    }
  }

  /**
   * Charger les fichiers existants du volume
   */
  private loadExistingFiles(): void {
    try {
      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir);
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          const relativePath = path.relative(this.volumePath, fullPath);

          if (stat.isDirectory()) {
            this.files.set(relativePath, {
              path: relativePath,
              content: '',
              size: 0,
              createdAt: stat.birthtime || new Date(),
              updatedAt: stat.mtime || new Date(),
              isDirectory: true,
            });
            walkDir(fullPath);
          } else {
            const content = fs.readFileSync(fullPath, 'utf-8');
            this.files.set(relativePath, {
              path: relativePath,
              content,
              size: stat.size,
              createdAt: stat.birthtime || new Date(),
              updatedAt: stat.mtime || new Date(),
              isDirectory: false,
            });
          }
        });
      };

      walkDir(this.volumePath);
      console.log('[PersistentVolume] Loaded', this.files.size, 'existing files from volume:', this.volumeId);
    } catch (error) {
      console.error('[PersistentVolume] Error loading existing files:', error);
    }
  }

  /**
   * Sauvegarder un fichier dans le volume
   */
  async saveFile(filePath: string, content: string): Promise<VolumeFile> {
    try {
      // Vérifier la taille totale
      const newSize = Buffer.byteLength(content, 'utf-8');
      let currentSize = 0;

      this.files.forEach(f => {
        currentSize += f.size;
      });

      if (currentSize + newSize > this.maxVolumeSize) {
        throw new Error(`Volume size limit exceeded. Max: ${this.maxVolumeSize}, Current: ${currentSize}, New: ${newSize}`);
      }

      // Créer les répertoires parent
      const fullPath = path.join(this.volumePath, filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Écrire le fichier
      fs.writeFileSync(fullPath, content, 'utf-8');

      const now = new Date();
      const file: VolumeFile = {
        path: filePath,
        content,
        size: newSize,
        createdAt: this.files.has(filePath) ? this.files.get(filePath)!.createdAt : now,
        updatedAt: now,
        isDirectory: false,
      };

      this.files.set(filePath, file);

      console.log('[PersistentVolume] Saved file:', filePath, `(${newSize} bytes)`);

      return file;
    } catch (error) {
      console.error('[PersistentVolume] Error saving file:', error);
      throw error;
    }
  }

  /**
   * Récupérer un fichier du volume
   */
  async getFile(filePath: string): Promise<VolumeFile | null> {
    try {
      const file = this.files.get(filePath);

      if (!file) {
        console.log('[PersistentVolume] File not found:', filePath);
        return null;
      }

      // Si le fichier n'est pas en mémoire, le charger
      if (!file.content && !file.isDirectory) {
        const fullPath = path.join(this.volumePath, filePath);
        if (fs.existsSync(fullPath)) {
          file.content = fs.readFileSync(fullPath, 'utf-8');
        }
      }

      console.log('[PersistentVolume] Retrieved file:', filePath);

      return file;
    } catch (error) {
      console.error('[PersistentVolume] Error getting file:', error);
      return null;
    }
  }

  /**
   * Lister les fichiers du volume
   */
  async listFiles(dirPath: string = ''): Promise<VolumeFile[]> {
    try {
      const result: VolumeFile[] = [];

      this.files.forEach((file, filePath) => {
        if (dirPath === '' || filePath.startsWith(dirPath)) {
          result.push(file);
        }
      });

      console.log('[PersistentVolume] Listed', result.length, 'files in directory:', dirPath);

      return result;
    } catch (error) {
      console.error('[PersistentVolume] Error listing files:', error);
      return [];
    }
  }

  /**
   * Supprimer un fichier du volume
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.volumePath, filePath);

      if (fs.existsSync(fullPath)) {
        if (fs.statSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      }

      this.files.delete(filePath);

      console.log('[PersistentVolume] Deleted file:', filePath);

      return true;
    } catch (error) {
      console.error('[PersistentVolume] Error deleting file:', error);
      return false;
    }
  }

  /**
   * Créer un répertoire dans le volume
   */
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.volumePath, dirPath);

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      const now = new Date();
      this.files.set(dirPath, {
        path: dirPath,
        content: '',
        size: 0,
        createdAt: now,
        updatedAt: now,
        isDirectory: true,
      });

      console.log('[PersistentVolume] Created directory:', dirPath);

      return true;
    } catch (error) {
      console.error('[PersistentVolume] Error creating directory:', error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques du volume
   */
  async getStats(): Promise<VolumeStats> {
    try {
      let totalSize = 0;
      let totalFiles = 0;
      const filesCount: Record<string, number> = {};
      let lastModified = this.createdAt;

      this.files.forEach((file) => {
        if (!file.isDirectory) {
          totalSize += file.size;
          totalFiles++;

          // Compter par extension
          const ext = path.extname(file.path) || 'no-extension';
          filesCount[ext] = (filesCount[ext] || 0) + 1;

          if (file.updatedAt > lastModified) {
            lastModified = file.updatedAt;
          }
        }
      });

      const stats: VolumeStats = {
        totalFiles,
        totalSize,
        createdAt: this.createdAt,
        lastModified,
        filesCount,
      };

      console.log('[PersistentVolume] Stats:', stats);

      return stats;
    } catch (error) {
      console.error('[PersistentVolume] Error getting stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        createdAt: this.createdAt,
        lastModified: this.createdAt,
        filesCount: {},
      };
    }
  }

  /**
   * Exporter le contenu du volume
   */
  async exportVolume(): Promise<Record<string, string>> {
    try {
      const exported: Record<string, string> = {};

      this.files.forEach((file, filePath) => {
        if (!file.isDirectory) {
          exported[filePath] = file.content;
        }
      });

      console.log('[PersistentVolume] Exported', Object.keys(exported).length, 'files');

      return exported;
    } catch (error) {
      console.error('[PersistentVolume] Error exporting volume:', error);
      return {};
    }
  }

  /**
   * Importer du contenu dans le volume
   */
  async importVolume(data: Record<string, string>): Promise<number> {
    try {
      let imported = 0;

      const entries = Object.entries(data);
      for (const [filePath, content] of entries) {
        await this.saveFile(filePath, content);
        imported++;
      }

      console.log('[PersistentVolume] Imported', imported, 'files');

      return imported;
    } catch (error) {
      console.error('[PersistentVolume] Error importing volume:', error);
      return 0;
    }
  }

  /**
   * Nettoyer le volume
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.volumePath)) {
        fs.rmSync(this.volumePath, { recursive: true });
      }

      this.files.clear();

      console.log('[PersistentVolume] Cleaned up volume:', this.volumeId);
    } catch (error) {
      console.error('[PersistentVolume] Error cleaning up volume:', error);
    }
  }

  /**
   * Obtenir le chemin du volume
   */
  getVolumePath(): string {
    return this.volumePath;
  }

  /**
   * Obtenir l'ID du volume
   */
  getVolumeId(): string {
    return this.volumeId;
  }
}

// Gestionnaire global des volumes
class VolumeManager {
  private volumes: Map<string, PersistentVolumeManager> = new Map();

  /**
   * Créer ou obtenir un volume
   */
  getOrCreateVolume(volumeId: string): PersistentVolumeManager {
    if (!this.volumes.has(volumeId)) {
      this.volumes.set(volumeId, new PersistentVolumeManager(volumeId));
    }
    return this.volumes.get(volumeId)!;
  }

  /**
   * Obtenir un volume existant
   */
  getVolume(volumeId: string): PersistentVolumeManager | null {
    return this.volumes.get(volumeId) || null;
  }

  /**
   * Supprimer un volume
   */
  async deleteVolume(volumeId: string): Promise<void> {
    const volume = this.volumes.get(volumeId);
    if (volume) {
      await volume.cleanup();
      this.volumes.delete(volumeId);
    }
  }

  /**
   * Lister tous les volumes
   */
  listVolumes(): string[] {
    const result: string[] = [];
    this.volumes.forEach((_, volumeId) => {
      result.push(volumeId);
    });
    return result;
  }
}

// Singleton global
let volumeManagerInstance: VolumeManager | null = null;

export function getVolumeManager(): VolumeManager {
  if (!volumeManagerInstance) {
    volumeManagerInstance = new VolumeManager();
  }
  return volumeManagerInstance;
}
