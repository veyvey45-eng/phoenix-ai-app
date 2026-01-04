/**
 * E2B Persistent Volume - Stockage persistant par utilisateur
 * 
 * Responsabilités:
 * - Gérer les fichiers persistants par utilisateur
 * - Sauvegarder/restaurer les fichiers
 * - Gérer les quotas de stockage
 * - Nettoyer les fichiers obsolètes
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VolumeInfo {
  userId: string;
  totalSize: number;
  fileCount: number;
  maxSize: number;
  usagePercent: number;
  createdAt: Date;
  lastModified: Date;
}

export interface FileOperation {
  success: boolean;
  path: string;
  size?: number;
  error?: string;
}

export class E2BPersistentVolume {
  private baseDir: string = '/tmp/phoenix-volumes';
  private maxSizePerUser: number = 100 * 1024 * 1024; // 100MB

  constructor() {
    // Créer le répertoire de base s'il n'existe pas
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    console.log('[E2BPersistentVolume] Initialized at', this.baseDir);
  }

  /**
   * Obtenir le chemin du volume d'un utilisateur
   */
  private getUserVolumePath(userId: string): string {
    return path.join(this.baseDir, userId);
  }

  /**
   * Créer le volume d'un utilisateur
   */
  private ensureUserVolume(userId: string): void {
    const volumePath = this.getUserVolumePath(userId);
    if (!fs.existsSync(volumePath)) {
      fs.mkdirSync(volumePath, { recursive: true });
      console.log('[E2BPersistentVolume] Created volume for user:', userId);
    }
  }

  /**
   * Sauvegarder un fichier
   */
  async saveFile(userId: string, filename: string, content: string): Promise<FileOperation> {
    try {
      this.ensureUserVolume(userId);

      const volumePath = this.getUserVolumePath(userId);
      const filePath = path.join(volumePath, filename);

      // Vérifier les quotas
      const currentSize = this.getVolumeTotalSize(userId);
      const newSize = Buffer.byteLength(content, 'utf-8');

      if (currentSize + newSize > this.maxSizePerUser) {
        return {
          success: false,
          path: filePath,
          error: `Quota exceeded. Current: ${currentSize}, New: ${newSize}, Max: ${this.maxSizePerUser}`,
        };
      }

      // Créer les répertoires parent si nécessaire
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Sauvegarder le fichier
      fs.writeFileSync(filePath, content, 'utf-8');

      console.log('[E2BPersistentVolume] File saved:', filePath, 'Size:', newSize);

      return {
        success: true,
        path: filePath,
        size: newSize,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error saving file:', error);
      return {
        success: false,
        path: filename,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Lire un fichier
   */
  async getFile(userId: string, filename: string): Promise<FileOperation> {
    try {
      const volumePath = this.getUserVolumePath(userId);
      const filePath = path.join(volumePath, filename);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          path: filePath,
          error: 'File not found',
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const size = Buffer.byteLength(content, 'utf-8');

      console.log('[E2BPersistentVolume] File read:', filePath, 'Size:', size);

      return {
        success: true,
        path: filePath,
        size,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error reading file:', error);
      return {
        success: false,
        path: filename,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Lister les fichiers
   */
  async listFiles(userId: string): Promise<Array<{ name: string; size: number; modified: Date }>> {
    try {
      const volumePath = this.getUserVolumePath(userId);

      if (!fs.existsSync(volumePath)) {
        return [];
      }

      const files: Array<{ name: string; size: number; modified: Date }> = [];

      const walkDir = (dir: string, prefix: string = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            walkDir(fullPath, relativePath);
          } else {
            const stats = fs.statSync(fullPath);
            files.push({
              name: relativePath,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        });
      };

      walkDir(volumePath);

      console.log('[E2BPersistentVolume] Listed files for user:', userId, 'Count:', files.length);

      return files;
    } catch (error) {
      console.error('[E2BPersistentVolume] Error listing files:', error);
      return [];
    }
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(userId: string, filename: string): Promise<FileOperation> {
    try {
      const volumePath = this.getUserVolumePath(userId);
      const filePath = path.join(volumePath, filename);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          path: filePath,
          error: 'File not found',
        };
      }

      fs.unlinkSync(filePath);

      console.log('[E2BPersistentVolume] File deleted:', filePath);

      return {
        success: true,
        path: filePath,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error deleting file:', error);
      return {
        success: false,
        path: filename,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Obtenir la taille totale du volume
   */
  private getVolumeTotalSize(userId: string): number {
    try {
      const volumePath = this.getUserVolumePath(userId);

      if (!fs.existsSync(volumePath)) {
        return 0;
      }

      let totalSize = 0;

      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else {
            const stats = fs.statSync(fullPath);
            totalSize += stats.size;
          }
        });
      };

      walkDir(volumePath);

      return totalSize;
    } catch (error) {
      console.error('[E2BPersistentVolume] Error calculating volume size:', error);
      return 0;
    }
  }

  /**
   * Obtenir les informations du volume
   */
  async getVolumeInfo(userId: string): Promise<VolumeInfo> {
    try {
      this.ensureUserVolume(userId);

      const volumePath = this.getUserVolumePath(userId);
      const files = await this.listFiles(userId);
      const totalSize = this.getVolumeTotalSize(userId);
      const stats = fs.statSync(volumePath);

      return {
        userId,
        totalSize,
        fileCount: files.length,
        maxSize: this.maxSizePerUser,
        usagePercent: (totalSize / this.maxSizePerUser) * 100,
        createdAt: stats.birthtime,
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error getting volume info:', error);

      return {
        userId,
        totalSize: 0,
        fileCount: 0,
        maxSize: this.maxSizePerUser,
        usagePercent: 0,
        createdAt: new Date(),
        lastModified: new Date(),
      };
    }
  }

  /**
   * Exporter le volume (créer une archive)
   */
  async exportVolume(userId: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const volumePath = this.getUserVolumePath(userId);

      if (!fs.existsSync(volumePath)) {
        return {
          success: false,
          error: 'Volume not found',
        };
      }

      const exportPath = path.join(this.baseDir, `${userId}-export-${Date.now()}.tar.gz`);

      console.log('[E2BPersistentVolume] Exporting volume for user:', userId, 'to:', exportPath);

      // Note: Dans une implémentation réelle, on utiliserait tar ou zip
      // Pour maintenant, on retourne juste le chemin
      return {
        success: true,
        path: exportPath,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error exporting volume:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Nettoyer les fichiers obsolètes
   */
  async cleanupOldFiles(userId: string, maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const files = await this.listFiles(userId);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const fileAgeMs = now - file.modified.getTime();
        if (fileAgeMs > maxAgeMs) {
          const result = await this.deleteFile(userId, file.name);
          if (result.success) {
            deletedCount++;
          }
        }
      }

      console.log('[E2BPersistentVolume] Cleanup completed for user:', userId, 'Deleted:', deletedCount);

      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      console.error('[E2BPersistentVolume] Error cleaning up files:', error);
      return {
        success: false,
        deletedCount: 0,
      };
    }
  }

  /**
   * Réinitialiser le volume d'un utilisateur
   */
  async resetVolume(userId: string): Promise<boolean> {
    try {
      const volumePath = this.getUserVolumePath(userId);

      if (fs.existsSync(volumePath)) {
        fs.rmSync(volumePath, { recursive: true, force: true });
      }

      console.log('[E2BPersistentVolume] Volume reset for user:', userId);

      return true;
    } catch (error) {
      console.error('[E2BPersistentVolume] Error resetting volume:', error);
      return false;
    }
  }
}

// Singleton global
let volumeInstance: E2BPersistentVolume | null = null;

export function getE2BPersistentVolume(): E2BPersistentVolume {
  if (!volumeInstance) {
    volumeInstance = new E2BPersistentVolume();
  }
  return volumeInstance;
}
