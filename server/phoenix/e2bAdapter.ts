/**
 * E2B Adapter pour Phoenix
 * 
 * Intègre E2B Sandbox réel pour l'exécution isolée et sécurisée du code
 * - Gestion des sandboxes
 * - Exécution de code Python, Node.js, Shell
 * - Gestion des fichiers
 * - Streaming de sortie
 */

import { Sandbox } from 'e2b';
import * as fs from 'fs';
import * as path from 'path';

export interface E2BExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  sandboxId?: string;
}

export interface E2BFileOperation {
  success: boolean;
  path: string;
  content?: string;
  size?: number;
  error?: string;
}

export class E2BAdapter {
  private apiKey: string;
  private sandboxes: Map<string, Sandbox> = new Map();
  private maxConcurrentSandboxes: number = 5;
  private executionTimeout: number = 60000; // 60 secondes

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('[E2BAdapter] Initialized with API key');
  }

  /**
   * Créer une nouvelle sandbox E2B
   */
  async createSandbox(sandboxId: string): Promise<Sandbox> {
    try {
      // Vérifier le nombre de sandboxes actives
      if (this.sandboxes.size >= this.maxConcurrentSandboxes) {
        throw new Error(`Maximum concurrent sandboxes (${this.maxConcurrentSandboxes}) reached`);
      }

      // Créer la sandbox
      const sandbox = await Sandbox.create({
        apiKey: this.apiKey,
      });

      this.sandboxes.set(sandboxId, sandbox);

      console.log('[E2BAdapter] Created sandbox:', sandboxId, 'ID:', sandbox.sandboxId);

      return sandbox;
    } catch (error) {
      console.error('[E2BAdapter] Error creating sandbox:', error);
      throw error;
    }
  }

  /**
   * Obtenir une sandbox existante
   */
  getSandbox(sandboxId: string): Sandbox | null {
    return this.sandboxes.get(sandboxId) || null;
  }

  /**
   * Obtenir ou créer une sandbox
   */
  async getOrCreateSandbox(sandboxId: string): Promise<Sandbox> {
    const existing = this.getSandbox(sandboxId);
    if (existing) {
      return existing;
    }
    return this.createSandbox(sandboxId);
  }

  /**
   * Exécuter du code Python
   */
  async executePython(
    sandboxId: string,
    code: string,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<E2BExecutionResult> {
    try {
      const startTime = Date.now();
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Executing Python code in sandbox:', sandboxId);

      // Exécuter le code Python
      const result = await sandbox.commands.run(`python3 -c '${code.replace(/'/g, "'\\''")}'`);

      const duration = Date.now() - startTime;

      if (onStdout && result.stdout) onStdout(result.stdout);
      if (onStderr && result.stderr) onStderr(result.stderr);

      console.log('[E2BAdapter] Python execution completed in', duration, 'ms');

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
        sandboxId: sandbox.sandboxId,
      };
    } catch (error) {
      console.error('[E2BAdapter] Error executing Python:', error);
      return {
        success: false,
        stdout: '',
        stderr: String(error),
        exitCode: 1,
        duration: 0,
      };
    }
  }

  /**
   * Exécuter du code Node.js
   */
  async executeNode(
    sandboxId: string,
    code: string,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<E2BExecutionResult> {
    try {
      const startTime = Date.now();
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Executing Node.js code in sandbox:', sandboxId);

      // Exécuter le code Node.js
      const result = await sandbox.commands.run(`node -e '${code.replace(/'/g, "'\\''")}'`);

      const duration = Date.now() - startTime;

      if (onStdout && result.stdout) onStdout(result.stdout);
      if (onStderr && result.stderr) onStderr(result.stderr);

      console.log('[E2BAdapter] Node.js execution completed in', duration, 'ms');

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
        sandboxId: sandbox.sandboxId,
      };
    } catch (error) {
      console.error('[E2BAdapter] Error executing Node.js:', error);
      return {
        success: false,
        stdout: '',
        stderr: String(error),
        exitCode: 1,
        duration: 0,
      };
    }
  }

  /**
   * Exécuter une commande shell
   */
  async executeShell(
    sandboxId: string,
    command: string,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<E2BExecutionResult> {
    try {
      const startTime = Date.now();
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Executing shell command in sandbox:', sandboxId, 'Command:', command);

      // Exécuter la commande
      const result = await sandbox.commands.run(command);

      const duration = Date.now() - startTime;

      if (onStdout && result.stdout) onStdout(result.stdout);
      if (onStderr && result.stderr) onStderr(result.stderr);

      console.log('[E2BAdapter] Shell execution completed in', duration, 'ms');

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
        sandboxId: sandbox.sandboxId,
      };
    } catch (error) {
      console.error('[E2BAdapter] Error executing shell:', error);
      return {
        success: false,
        stdout: '',
        stderr: String(error),
        exitCode: 1,
        duration: 0,
      };
    }
  }

  /**
   * Sauvegarder un fichier dans la sandbox
   */
  async writeFile(sandboxId: string, filePath: string, content: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Writing file:', filePath, 'in sandbox:', sandboxId);

      // Créer les répertoires parent si nécessaire
      const dir = path.dirname(filePath);
      if (dir !== '.' && dir !== '/') {
        await sandbox.commands.run(`mkdir -p "${dir}"`);
      }

      // Écrire le fichier
      await sandbox.files.write(filePath, content);

      console.log('[E2BAdapter] File written successfully:', filePath);

      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      console.error('[E2BAdapter] Error writing file:', error);
      return {
        success: false,
        path: filePath,
        error: String(error),
      };
    }
  }

  /**
   * Lire un fichier de la sandbox
   */
  async readFile(sandboxId: string, filePath: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Reading file:', filePath, 'from sandbox:', sandboxId);

      // Lire le fichier
      const content = await sandbox.files.read(filePath);

      console.log('[E2BAdapter] File read successfully:', filePath);

      return {
        success: true,
        path: filePath,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      console.error('[E2BAdapter] Error reading file:', error);
      return {
        success: false,
        path: filePath,
        error: String(error),
      };
    }
  }

  /**
   * Lister les fichiers dans un répertoire
   */
  async listFiles(sandboxId: string, dirPath: string = '/'): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Listing files in:', dirPath, 'sandbox:', sandboxId);

      // Lister les fichiers
      const result = await sandbox.commands.run(`ls -la "${dirPath}"`);

      console.log('[E2BAdapter] Files listed successfully');

      return {
        success: true,
        path: dirPath,
        content: result.stdout,
      };
    } catch (error) {
      console.error('[E2BAdapter] Error listing files:', error);
      return {
        success: false,
        path: dirPath,
        error: String(error),
      };
    }
  }

  /**
   * Télécharger un fichier de la sandbox
   */
  async downloadFile(sandboxId: string, sandboxPath: string, localPath: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Downloading file:', sandboxPath, 'to:', localPath);

      // Lire le fichier de la sandbox
      const content = await sandbox.files.read(sandboxPath);

      // Créer les répertoires locaux si nécessaire
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Écrire le fichier localement
      fs.writeFileSync(localPath, content);

      console.log('[E2BAdapter] File downloaded successfully:', localPath);

      return {
        success: true,
        path: localPath,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      console.error('[E2BAdapter] Error downloading file:', error);
      return {
        success: false,
        path: localPath,
        error: String(error),
      };
    }
  }

  /**
   * Télécharger un fichier vers la sandbox
   */
  async uploadFile(sandboxId: string, localPath: string, sandboxPath: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Uploading file:', localPath, 'to:', sandboxPath);

      // Lire le fichier local
      const content = fs.readFileSync(localPath, 'utf-8');

      // Créer les répertoires parent si nécessaire
      const dir = path.dirname(sandboxPath);
      if (dir !== '.' && dir !== '/') {
        await sandbox.commands.run(`mkdir -p "${dir}"`);
      }

      // Écrire le fichier dans la sandbox
      await sandbox.files.write(sandboxPath, content);

      console.log('[E2BAdapter] File uploaded successfully:', sandboxPath);

      return {
        success: true,
        path: sandboxPath,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      console.error('[E2BAdapter] Error uploading file:', error);
      return {
        success: false,
        path: sandboxPath,
        error: String(error),
      };
    }
  }

  /**
   * Installer des packages dans la sandbox
   */
  async installPackages(sandboxId: string, language: 'python' | 'node', packages: string[]): Promise<E2BExecutionResult> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);

      console.log('[E2BAdapter] Installing packages:', packages, 'for', language);

      let result;

      if (language === 'python') {
        const cmd = `pip install ${packages.join(' ')}`;
        result = await sandbox.commands.run(cmd);
      } else if (language === 'node') {
        const cmd = `npm install ${packages.join(' ')}`;
        result = await sandbox.commands.run(cmd);
      } else {
        throw new Error(`Unsupported language: ${language}`);
      }

      console.log('[E2BAdapter] Packages installed successfully');

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: 0,
        sandboxId: sandbox.sandboxId,
      };
    } catch (error) {
      console.error('[E2BAdapter] Error installing packages:', error);
      return {
        success: false,
        stdout: '',
        stderr: String(error),
        exitCode: 1,
        duration: 0,
      };
    }
  }

  /**
   * Obtenir les informations de la sandbox
   */
  async getSandboxInfo(sandboxId: string): Promise<Record<string, any>> {
    try {
      const sandbox = this.getSandbox(sandboxId);

      if (!sandbox) {
        return { error: 'Sandbox not found' };
      }

      return {
        sandboxId: sandbox.sandboxId,
        isActive: true,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('[E2BAdapter] Error getting sandbox info:', error);
      return { error: String(error) };
    }
  }

  /**
   * Fermer une sandbox
   */
  async closeSandbox(sandboxId: string): Promise<boolean> {
    try {
      const sandbox = this.sandboxes.get(sandboxId);

      if (!sandbox) {
        console.log('[E2BAdapter] Sandbox not found:', sandboxId);
        return false;
      }

      await sandbox.kill();
      this.sandboxes.delete(sandboxId);

      console.log('[E2BAdapter] Sandbox closed:', sandboxId);

      return true;
    } catch (error) {
      console.error('[E2BAdapter] Error closing sandbox:', error);
      return false;
    }
  }

  /**
   * Fermer toutes les sandboxes
   */
  async closeAllSandboxes(): Promise<void> {
    try {
      const promises = Array.from(this.sandboxes.entries()).map(([sandboxId, sandbox]) =>
        sandbox.kill().catch((err: Error) => console.error('[E2BAdapter] Error closing sandbox:', sandboxId, err))
      );

      await Promise.all(promises);

      this.sandboxes.clear();

      console.log('[E2BAdapter] All sandboxes closed');
    } catch (error) {
      console.error('[E2BAdapter] Error closing all sandboxes:', error);
    }
  }

  /**
   * Obtenir le nombre de sandboxes actives
   */
  getActiveSandboxCount(): number {
    return this.sandboxes.size;
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): Record<string, any> {
    return {
      activeSandboxes: this.sandboxes.size,
      maxConcurrentSandboxes: this.maxConcurrentSandboxes,
      executionTimeout: this.executionTimeout,
      sandboxIds: Array.from(this.sandboxes.keys()),
    };
  }
}

// Singleton global
let e2bAdapterInstance: E2BAdapter | null = null;

export function getE2BAdapter(): E2BAdapter {
  if (!e2bAdapterInstance) {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error('E2B_API_KEY environment variable is not set');
    }
    e2bAdapterInstance = new E2BAdapter(apiKey);
  }
  return e2bAdapterInstance;
}
