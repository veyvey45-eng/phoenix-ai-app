/**
 * Real Project System - Système RÉEL de fichiers, preview et déploiement
 * 
 * Ce module permet à Phoenix de:
 * 1. Créer des fichiers RÉELS dans le sandbox E2B
 * 2. Démarrer un serveur HTTP pour servir les projets
 * 3. Exposer des ports publics avec des URLs accessibles
 * 4. Déployer les projets vers S3 pour persistance
 * 
 * PAS DE SIMULATION - Tout est réel!
 */

import { Sandbox } from '@e2b/code-interpreter';
import { storagePut, storageGet } from '../storage';
import {
  createProject as createDbProject,
  updateProject,
  syncFromSandbox,
  syncToSandbox,
  startAutoSave,
  stopAutoSave,
  saveProjectNow,
  getProject,
} from './projectPersistence';

// Types
export interface RealFile {
  path: string;
  content: string;
  mimeType: string;
}

export interface ProjectPreview {
  sandboxId: string;
  port: number;
  publicUrl: string;
  projectPath: string;
  files: string[];
  startedAt: Date;
}

export interface DeployedProject {
  projectId: string;
  name: string;
  files: { path: string; url: string }[];
  indexUrl: string;
  deployedAt: Date;
}

// Stockage des sandboxes actifs par session
const activeSandboxes: Map<string, {
  sandbox: InstanceType<typeof Sandbox>;
  previews: Map<number, ProjectPreview>;
  createdAt: Date;
  projectId?: number; // ID du projet dans la DB pour la persistance
}> = new Map();

/**
 * Service de gestion des projets réels
 */
class RealProjectSystemService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[RealProjectSystem] E2B API key not configured');
    }
  }

  /**
   * Obtenir ou créer un sandbox pour une session
   */
  async getOrCreateSandbox(sessionId: string): Promise<InstanceType<typeof Sandbox>> {
    const existing = activeSandboxes.get(sessionId);
    if (existing) {
      console.log(`[RealProjectSystem] Réutilisation du sandbox existant pour session ${sessionId}`);
      return existing.sandbox;
    }

    console.log(`[RealProjectSystem] Création d'un nouveau sandbox pour session ${sessionId}`);
    const sandbox = await Sandbox.create({
      timeoutMs: 30 * 60 * 1000, // 30 minutes
    });

    activeSandboxes.set(sessionId, {
      sandbox,
      previews: new Map(),
      createdAt: new Date()
    });

    return sandbox;
  }

  /**
   * Créer un fichier RÉEL dans le sandbox
   */
  async createRealFile(
    sessionId: string,
    filePath: string,
    content: string
  ): Promise<{ success: boolean; fullPath: string; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      
      // Assurer que le chemin est absolu
      const fullPath = filePath.startsWith('/') ? filePath : `/home/user/${filePath}`;
      
      // Créer les répertoires parents si nécessaire
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (dirPath) {
        await sandbox.commands.run(`mkdir -p "${dirPath}"`);
      }
      
      // Écrire le fichier via la commande cat avec heredoc
      // Échapper les caractères spéciaux pour le shell
      const escapedContent = content
        .replace(/\\/g, '\\\\')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');
      
      // Utiliser base64 pour éviter les problèmes d'échappement
      const base64Content = Buffer.from(content).toString('base64');
      await sandbox.commands.run(`echo "${base64Content}" | base64 -d > "${fullPath}"`);
      
      console.log(`[RealProjectSystem] Fichier créé: ${fullPath}`);
      
      return { success: true, fullPath };
    } catch (error: any) {
      console.error('[RealProjectSystem] Erreur création fichier:', error);
      return { success: false, fullPath: filePath, error: error.message };
    }
  }

  /**
   * Lire un fichier RÉEL depuis le sandbox
   */
  async readRealFile(
    sessionId: string,
    filePath: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const fullPath = filePath.startsWith('/') ? filePath : `/home/user/${filePath}`;
      
      const result = await sandbox.commands.run(`cat "${fullPath}"`);
      
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Fichier non trouvé' };
      }
      
      return { success: true, content: result.stdout };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Lister les fichiers d'un répertoire
   */
  async listFiles(
    sessionId: string,
    dirPath: string
  ): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const fullPath = dirPath.startsWith('/') ? dirPath : `/home/user/${dirPath}`;
      
      const result = await sandbox.commands.run(`find "${fullPath}" -type f 2>/dev/null | head -100`);
      
      if (result.exitCode !== 0 && !result.stdout) {
        return { success: false, error: 'Répertoire non trouvé' };
      }
      
      const files = result.stdout.split('\n').filter(f => f.trim());
      return { success: true, files };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Créer un projet complet avec plusieurs fichiers
   */
  async createProject(
    sessionId: string,
    projectName: string,
    files: RealFile[]
  ): Promise<{ success: boolean; projectPath: string; filesCreated: string[]; errors: string[] }> {
    const projectPath = `/home/user/projects/${projectName}`;
    const filesCreated: string[] = [];
    const errors: string[] = [];

    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      
      // Créer le répertoire du projet
      await sandbox.commands.run(`mkdir -p "${projectPath}"`);
      
      // Créer chaque fichier
      for (const file of files) {
        const filePath = `${projectPath}/${file.path}`;
        const result = await this.createRealFile(sessionId, filePath, file.content);
        
        if (result.success) {
          filesCreated.push(filePath);
        } else {
          errors.push(`${file.path}: ${result.error}`);
        }
      }
      
      console.log(`[RealProjectSystem] Projet créé: ${projectPath} avec ${filesCreated.length} fichiers`);
      
      return { success: errors.length === 0, projectPath, filesCreated, errors };
    } catch (error: any) {
      return { success: false, projectPath, filesCreated, errors: [error.message] };
    }
  }

  /**
   * Démarrer un serveur HTTP pour servir un projet
   * Retourne une URL PUBLIQUE accessible
   */
  async startPreviewServer(
    sessionId: string,
    projectPath: string,
    port: number = 8080
  ): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const fullPath = projectPath.startsWith('/') ? projectPath : `/home/user/${projectPath}`;
      
      // Vérifier que le répertoire existe
      const checkResult = await sandbox.commands.run(`test -d "${fullPath}" && echo "exists"`);
      if (!checkResult.stdout.includes('exists')) {
        return { success: false, error: `Répertoire non trouvé: ${fullPath}` };
      }
      
      // Obtenir l'URL publique AVANT de démarrer le serveur
      const host = sandbox.getHost(port);
      const publicUrl = `https://${host}`;
      console.log(`[RealProjectSystem] URL publique: ${publicUrl}`);
      
      // Démarrer le serveur HTTP Python en arrière-plan (selon la doc E2B officielle)
      // La commande avec { background: true } retourne immédiatement
      const serverProcess = await sandbox.commands.run(
        `cd "${fullPath}" && python3 -m http.server ${port}`,
        { background: true }
      );
      
      console.log(`[RealProjectSystem] Serveur démarré en arrière-plan`);
      
      // Attendre que le serveur démarre
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stocker les infos de preview
      const sessionData = activeSandboxes.get(sessionId);
      if (sessionData) {
        const listResult = await sandbox.commands.run(`find "${fullPath}" -type f | head -50`);
        const files = listResult.stdout.split('\n').filter(f => f.trim());
        
        sessionData.previews.set(port, {
          sandboxId: sandbox.sandboxId,
          port,
          publicUrl,
          projectPath: fullPath,
          files,
          startedAt: new Date()
        });
      }
      
      console.log(`[RealProjectSystem] Serveur démarré: ${publicUrl}`);
      
      return { success: true, publicUrl };
    } catch (error: any) {
      console.error('[RealProjectSystem] Erreur démarrage serveur:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Démarrer un serveur Node.js pour un projet
   */
  async startNodeServer(
    sessionId: string,
    projectPath: string,
    port: number = 3000,
    startCommand: string = 'npm start'
  ): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const fullPath = projectPath.startsWith('/') ? projectPath : `/home/user/${projectPath}`;
      
      // Installer les dépendances si package.json existe
      const packageCheck = await sandbox.commands.run(`test -f "${fullPath}/package.json" && echo "exists"`);
      if (packageCheck.stdout.includes('exists')) {
        console.log('[RealProjectSystem] Installation des dépendances npm...');
        await sandbox.commands.run(`cd "${fullPath}" && npm install`, { timeoutMs: 120000 });
      }
      
      // Tuer tout processus existant sur ce port
      await sandbox.commands.run(`pkill -f "node.*${port}" 2>/dev/null || true`);
      
      // Obtenir l'URL publique AVANT de démarrer le serveur
      const host = sandbox.getHost(port);
      const publicUrl = `https://${host}`;
      console.log(`[RealProjectSystem] URL publique Node: ${publicUrl}`);
      
      // Démarrer le serveur Node.js en arrière-plan (selon la doc E2B officielle)
      const serverProcess = await sandbox.commands.run(
        `cd "${fullPath}" && PORT=${port} ${startCommand}`,
        { background: true }
      );
      
      // Attendre que le serveur démarre
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`[RealProjectSystem] Serveur Node.js démarré: ${publicUrl}`);
      
      return { success: true, publicUrl };
    } catch (error: any) {
      console.error('[RealProjectSystem] Erreur démarrage Node.js:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Exposer un port avec une URL publique
   */
  async exposePort(
    sessionId: string,
    port: number
  ): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const host = sandbox.getHost(port);
      const publicUrl = `https://${host}`;
      
      console.log(`[RealProjectSystem] Port ${port} exposé: ${publicUrl}`);
      
      return { success: true, publicUrl };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Déployer un projet vers S3 pour persistance
   */
  async deployProject(
    sessionId: string,
    projectPath: string,
    projectName: string
  ): Promise<DeployedProject | { success: false; error: string }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      const fullPath = projectPath.startsWith('/') ? projectPath : `/home/user/${projectPath}`;
      
      // Lister tous les fichiers du projet
      const listResult = await sandbox.commands.run(`find "${fullPath}" -type f`);
      const filePaths = listResult.stdout.split('\n').filter(f => f.trim());
      
      if (filePaths.length === 0) {
        return { success: false, error: 'Aucun fichier trouvé dans le projet' };
      }
      
      const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const deployedFiles: { path: string; url: string }[] = [];
      let indexUrl = '';
      
      // Uploader chaque fichier vers S3
      for (const filePath of filePaths) {
        const relativePath = filePath.replace(fullPath + '/', '');
        const readResult = await sandbox.commands.run(`base64 "${filePath}"`);
        
        if (readResult.exitCode === 0 && readResult.stdout) {
          const content = Buffer.from(readResult.stdout.trim(), 'base64');
          const mimeType = this.getMimeType(relativePath);
          
          const s3Key = `deployed-projects/${projectId}/${relativePath}`;
          const { url } = await storagePut(s3Key, content, mimeType);
          
          deployedFiles.push({ path: relativePath, url });
          
          // Identifier l'URL de l'index
          if (relativePath === 'index.html' || relativePath.endsWith('/index.html')) {
            indexUrl = url;
          }
        }
      }
      
      // Si pas d'index.html, utiliser le premier fichier HTML
      if (!indexUrl) {
        const htmlFile = deployedFiles.find(f => f.path.endsWith('.html'));
        if (htmlFile) {
          indexUrl = htmlFile.url;
        } else {
          indexUrl = deployedFiles[0]?.url || '';
        }
      }
      
      console.log(`[RealProjectSystem] Projet déployé: ${projectId} avec ${deployedFiles.length} fichiers`);
      
      return {
        projectId,
        name: projectName,
        files: deployedFiles,
        indexUrl,
        deployedAt: new Date()
      };
    } catch (error: any) {
      console.error('[RealProjectSystem] Erreur déploiement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Exécuter une commande shell dans le sandbox
   */
  async executeCommand(
    sessionId: string,
    command: string,
    cwd?: string
  ): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      
      let fullCommand = command;
      if (cwd) {
        fullCommand = `cd "${cwd}" && ${command}`;
      }
      
      const result = await sandbox.commands.run(fullCommand, { timeoutMs: 60000 });
      
      return {
        success: result.exitCode === 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1
      };
    }
  }

  /**
   * Obtenir les previews actifs pour une session
   */
  getActivePreviews(sessionId: string): ProjectPreview[] {
    const sessionData = activeSandboxes.get(sessionId);
    if (!sessionData) return [];
    return Array.from(sessionData.previews.values());
  }

  /**
   * Arrêter un serveur de preview
   */
  async stopPreview(sessionId: string, port: number): Promise<boolean> {
    try {
      const sandbox = await this.getOrCreateSandbox(sessionId);
      await sandbox.commands.run(`pkill -f "http.server ${port}" 2>/dev/null || true`);
      
      const sessionData = activeSandboxes.get(sessionId);
      if (sessionData) {
        sessionData.previews.delete(port);
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fermer le sandbox d'une session
   */
  async closeSandbox(sessionId: string): Promise<void> {
    const sessionData = activeSandboxes.get(sessionId);
    if (sessionData) {
      try {
        // E2B gère automatiquement la fermeture après timeout
        activeSandboxes.delete(sessionId);
        console.log(`[RealProjectSystem] Sandbox fermé pour session ${sessionId}`);
      } catch (error) {
        console.error('[RealProjectSystem] Erreur fermeture sandbox:', error);
      }
    }
  }

  /**
   * Obtenir le type MIME d'un fichier
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ============================================================================
  // PERSISTENCE INTEGRATION
  // ============================================================================

  /**
   * Créer un projet avec persistance en base de données
   */
  async createProjectWithPersistence(
    sessionId: string,
    userId: number,
    projectName: string,
    files: RealFile[],
    projectType: "static" | "nodejs" | "python" | "react" | "nextjs" | "other" = "static",
    description?: string
  ): Promise<{
    success: boolean;
    projectId?: number;
    projectPath: string;
    filesCreated: string[];
    errors: string[];
  }> {
    try {
      // 1. Créer le projet dans la DB
      const dbProject = await createDbProject(userId, projectName, projectType, description);
      if (!dbProject) {
        return {
          success: false,
          projectPath: '',
          filesCreated: [],
          errors: ['Failed to create project in database'],
        };
      }

      // 2. Créer le projet dans le sandbox
      const result = await this.createProject(sessionId, projectName, files);

      // 3. Associer le projectId au sandbox
      const sessionData = activeSandboxes.get(sessionId);
      if (sessionData) {
        sessionData.projectId = dbProject.id;

        // 4. Démarrer la sauvegarde automatique
        startAutoSave(dbProject.id, sessionData.sandbox, result.projectPath);
      }

      // 5. Synchroniser les fichiers vers la DB
      if (sessionData) {
        await syncFromSandbox(dbProject.id, sessionData.sandbox, result.projectPath);
      }

      // 6. Mettre à jour le projet avec le sandboxId
      await updateProject(dbProject.id, {
        sandboxId: sessionData?.sandbox.sandboxId,
        sandboxExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      return {
        success: result.success,
        projectId: dbProject.id,
        projectPath: result.projectPath,
        filesCreated: result.filesCreated,
        errors: result.errors,
      };
    } catch (error: any) {
      return {
        success: false,
        projectPath: '',
        filesCreated: [],
        errors: [error.message],
      };
    }
  }

  /**
   * Restaurer un projet depuis la DB vers un nouveau sandbox
   */
  async restoreProjectFromDb(
    sessionId: string,
    projectId: number
  ): Promise<{
    success: boolean;
    projectPath?: string;
    filesRestored?: number;
    error?: string;
  }> {
    try {
      const project = await getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const sandbox = await this.getOrCreateSandbox(sessionId);
      const projectPath = `/home/user/projects/${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Synchroniser les fichiers depuis la DB
      const result = await syncToSandbox(projectId, sandbox, projectPath);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Associer le projectId au sandbox
      const sessionData = activeSandboxes.get(sessionId);
      if (sessionData) {
        sessionData.projectId = projectId;

        // Démarrer la sauvegarde automatique
        startAutoSave(projectId, sandbox, projectPath);
      }

      // Mettre à jour le projet
      await updateProject(projectId, {
        sandboxId: sandbox.sandboxId,
        sandboxExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      return {
        success: true,
        projectPath,
        filesRestored: result.filesAdded,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sauvegarder le projet actuel vers la DB
   */
  async saveProjectToDb(sessionId: string): Promise<{
    success: boolean;
    filesAdded?: number;
    filesUpdated?: number;
    error?: string;
  }> {
    const sessionData = activeSandboxes.get(sessionId);
    if (!sessionData || !sessionData.projectId) {
      return { success: false, error: 'No project associated with this session' };
    }

    const project = await getProject(sessionData.projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const projectPath = `/home/user/projects/${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const result = await syncFromSandbox(sessionData.projectId, sessionData.sandbox, projectPath);

    return {
      success: result.success,
      filesAdded: result.filesAdded,
      filesUpdated: result.filesUpdated,
      error: result.error,
    };
  }

  /**
   * Fermer le sandbox avec sauvegarde automatique
   */
  async closeSandboxWithSave(sessionId: string): Promise<void> {
    const sessionData = activeSandboxes.get(sessionId);
    if (sessionData && sessionData.projectId) {
      const project = await getProject(sessionData.projectId);
      if (project) {
        const projectPath = `/home/user/projects/${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Sauvegarder avant de fermer
        await saveProjectNow(sessionData.projectId, sessionData.sandbox, projectPath);
        
        // Mettre à jour le statut
        await updateProject(sessionData.projectId, {
          sandboxId: null,
          sandboxExpiresAt: null,
          isPreviewActive: false,
          previewUrl: null,
        });
      }
    }
    
    await this.closeSandbox(sessionId);
  }

  /**
   * Obtenir le projectId associé à une session
   */
  getSessionProjectId(sessionId: string): number | undefined {
    return activeSandboxes.get(sessionId)?.projectId;
  }
}

// Instance singleton
export const realProjectSystem = new RealProjectSystemService();

export default realProjectSystem;
