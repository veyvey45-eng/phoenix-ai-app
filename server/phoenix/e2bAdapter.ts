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
  private sandboxTimestamps: Map<string, number> = new Map();
  private maxConcurrentSandboxes: number = 5;
  private executionTimeout: number = 60000; // 60 secondes
  private sandboxIdleTimeout: number = 300000; // 5 minutes d'inactivité

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('[E2BAdapter] Initialized with API key');
    
    // Nettoyer les sandboxes inactives toutes les 2 minutes
    setInterval(() => this.cleanupIdleSandboxes(), 120000);
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
      }) as any;

      this.sandboxes.set(sandboxId, sandbox);
      this.sandboxTimestamps.set(sandboxId, Date.now());

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
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      // Mettre à jour le timestamp d'accès
      this.sandboxTimestamps.set(sandboxId, Date.now());
    }
    return sandbox || null;
  }

  /**
   * Nettoyer les sandboxes inactives
   */
  async cleanupIdleSandboxes(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    this.sandboxTimestamps.forEach((timestamp, sandboxId) => {
      if (now - timestamp > this.sandboxIdleTimeout) {
        toDelete.push(sandboxId);
      }
    });

    for (const sandboxId of toDelete) {
      try {
        const sandbox = this.sandboxes.get(sandboxId);
        if (sandbox) {
          (sandbox as any).close?.();
          console.log('[E2BAdapter] Closed idle sandbox:', sandboxId);
        }
        this.sandboxes.delete(sandboxId);
        this.sandboxTimestamps.delete(sandboxId);
      } catch (error) {
        console.error('[E2BAdapter] Error cleaning up sandbox:', sandboxId, error);
      }
    }
  }

  /**
   * Obtenir ou créer une sandbox
   */
  async getOrCreateSandbox(sandboxId: string): Promise<Sandbox> {
    const existing = this.getSandbox(sandboxId);
    if (existing) {
      try {
        // Vérifier que la sandbox est toujours active en envoyant une commande simple
        await existing.commands.run('echo "ping"');
        return existing;
      } catch (error) {
        console.log('[E2BAdapter] Sandbox is dead, removing:', sandboxId);
        this.sandboxes.delete(sandboxId);
        this.sandboxTimestamps.delete(sandboxId);
      }
    }

    // Nettoyer les sandboxes inactives avant d'en créer une nouvelle
    await this.cleanupIdleSandboxes();

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

      // Exécuter le code Python avec timeout
      const result = await Promise.race([
        sandbox.commands.run(`python3 -c '${code.replace(/'/g, "'\\''")}'`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), this.executionTimeout)
        ),
      ]) as any;

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
      // Supprimer la sandbox en cas d'erreur
      this.sandboxes.delete(sandboxId);
      this.sandboxTimestamps.delete(sandboxId);
      throw error;
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

      // Exécuter le code Node.js avec timeout
      const result = await Promise.race([
        sandbox.commands.run(`node -e '${code.replace(/'/g, "'\\''")}'`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), this.executionTimeout)
        ),
      ]) as any;

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
      // Supprimer la sandbox en cas d'erreur
      this.sandboxes.delete(sandboxId);
      this.sandboxTimestamps.delete(sandboxId);
      throw error;
    }
  }

  /**
   * Exécuter une commande Shell
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

      console.log('[E2BAdapter] Executing shell command in sandbox:', sandboxId);

      // Exécuter la commande avec timeout
      const result = await Promise.race([
        sandbox.commands.run(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), this.executionTimeout)
        ),
      ]) as any;

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
      // Supprimer la sandbox en cas d'erreur
      this.sandboxes.delete(sandboxId);
      this.sandboxTimestamps.delete(sandboxId);
      throw error;
    }
  }

  /**
   * Fermer une sandbox
   */
  async closeSandbox(sandboxId: string): Promise<void> {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (sandbox) {
        (sandbox as any).close?.();
        this.sandboxes.delete(sandboxId);
        this.sandboxTimestamps.delete(sandboxId);
        console.log('[E2BAdapter] Closed sandbox:', sandboxId);
      }
    } catch (error) {
      console.error('[E2BAdapter] Error closing sandbox:', error);
    }
  }

  /**
   * Fermer toutes les sandboxes
   */
  async closeAllSandboxes(): Promise<void> {
    const sandboxIds = Array.from(this.sandboxes.keys());
    for (const sandboxId of sandboxIds) {
      await this.closeSandbox(sandboxId);
    }
  }

  /**
   * Lire un fichier
   */
  async readFile(sandboxId: string, filePath: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);
      const content = await sandbox.files.read(filePath);
      return {
        success: true,
        path: filePath,
        content,
      };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: String(error),
      };
    }
  }

  /**
   * Écrire un fichier
   */
  async writeFile(sandboxId: string, filePath: string, content: string): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);
      await sandbox.files.write(filePath, content);
      return {
        success: true,
        path: filePath,
      };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: String(error),
      };
    }
  }

  /**
   * Lister les fichiers
   */
  async listFiles(sandboxId: string, dirPath: string = '/'): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);
      const result = await sandbox.commands.run(`ls -la ${dirPath}`);
      return {
        success: true,
        path: dirPath,
        content: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        path: dirPath,
        error: String(error),
      };
    }
  }

  /**
   * Installer un package
   */
  async installPackage(sandboxId: string, packageName: string, language: 'python' | 'node' = 'python'): Promise<E2BFileOperation> {
    try {
      const sandbox = await this.getOrCreateSandbox(sandboxId);
      let command: string;

      if (language === 'python') {
        command = `pip install ${packageName}`;
      } else {
        command = `npm install ${packageName}`;
      }

      const result = await sandbox.commands.run(command);
      return {
        success: result.exitCode === 0,
        path: packageName,
        content: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        path: packageName,
        error: String(error),
      };
    }
  }

  /**
   * Obtenir les statistiques des sandboxes
   */
  getStatistics() {
    return {
      activeSandboxes: this.sandboxes.size,
      maxConcurrentSandboxes: this.maxConcurrentSandboxes,
      sandboxIds: Array.from(this.sandboxes.keys()),
    };
  }
}

// Singleton global
let adapter: E2BAdapter | null = null;

export function getE2BAdapter(): E2BAdapter {
  if (!adapter) {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error('E2B_API_KEY environment variable is not set');
    }
    adapter = new E2BAdapter(apiKey);
  }
  return adapter;
}
