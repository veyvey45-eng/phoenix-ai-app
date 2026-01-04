/**
 * OS Access Manager
 * Permet à Phoenix d'exécuter des commandes shell sécurisées
 * Avec contrôles de sécurité pour les opérations dangereuses
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface SecurityPolicy {
  allowedCommands: string[];
  blockedPatterns: RegExp[];
  maxExecutionTime: number;
  maxOutputSize: number;
}

class OSAccessManager {
  private securityPolicy: SecurityPolicy;
  private executionHistory: Map<string, CommandResult[]> = new Map();

  constructor() {
    this.securityPolicy = {
      allowedCommands: [
        'python3',
        'node',
        'npm',
        'pnpm',
        'pip',
        'pip3',
        'ls',
        'cat',
        'grep',
        'find',
        'curl',
        'wget',
        'git',
        'docker',
        'mkdir',
        'rm',
        'cp',
        'mv',
        'chmod',
        'chown',
        'tar',
        'zip',
        'unzip',
        'gzip',
        'gunzip',
        'apt-get',
        'apt',
        'yum',
        'brew',
        'which',
        'whereis',
        'file',
        'head',
        'tail',
        'wc',
        'sort',
        'uniq',
        'cut',
        'awk',
        'sed',
        'tr',
        'echo',
        'pwd',
        'cd',
        'date',
        'time',
        'uptime',
        'whoami',
        'uname',
      ],
      blockedPatterns: [
        /sudo/i,
        /rm\s+-rf\s+\//,
        /dd\s+if=\/dev\/zero/,
        /fork\s*\(\s*\)/,
        /:\(\)\s*{\s*:\|:\s*&\s*\}/,
        /\|\s*bash/,
        />\s*\/dev\/sda/,
        /mkfs/,
        /shred/,
      ],
      maxExecutionTime: 60000, // 60 secondes
      maxOutputSize: 10 * 1024 * 1024, // 10MB
    };
    
    console.log('[OSAccess] Initialized with security policy');
  }

  /**
   * Valider une commande pour la sécurité
   */
  private validateCommand(command: string): { valid: boolean; reason?: string } {
    // Vérifier les patterns bloqués
    for (const pattern of this.securityPolicy.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          reason: `Blocked pattern detected: ${pattern.source}`,
        };
      }
    }
    
    // Extraire la commande principale
    const mainCommand = command.split(/\s+/)[0];
    
    // Vérifier si la commande est autorisée
    if (!this.securityPolicy.allowedCommands.includes(mainCommand)) {
      return {
        valid: false,
        reason: `Command not in whitelist: ${mainCommand}`,
      };
    }
    
    return { valid: true };
  }

  /**
   * Exécuter une commande shell sécurisée
   */
  async executeCommand(command: string, userId: string, options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }): Promise<CommandResult> {
    const startTime = Date.now();
    
    // Valider la commande
    const validation = this.validateCommand(command);
    if (!validation.valid) {
      return {
        success: false,
        stdout: '',
        stderr: validation.reason || 'Command validation failed',
        exitCode: 1,
        executionTime: 0,
      };
    }
    
    try {
      console.log('[OSAccess] Executing command:', command);
      
      // Exécuter la commande
      const timeout = options?.timeout || this.securityPolicy.maxExecutionTime;
      const cwd = options?.cwd || process.cwd();
      
      const stdout = execSync(command, {
        encoding: 'utf-8',
        timeout,
        cwd,
        maxBuffer: this.securityPolicy.maxOutputSize,
        env: {
          ...process.env,
          ...options?.env,
        },
      });
      
      const executionTime = Date.now() - startTime;
      
      const result: CommandResult = {
        success: true,
        stdout: stdout.trim(),
        stderr: '',
        exitCode: 0,
        executionTime,
      };
      
      // Enregistrer dans l'historique
      this.recordExecution(userId, result);
      
      console.log('[OSAccess] Command executed successfully in', executionTime, 'ms');
      
      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      const result: CommandResult = {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.status || 1,
        executionTime,
      };
      
      // Enregistrer dans l'historique
      this.recordExecution(userId, result);
      
      console.error('[OSAccess] Command execution error:', error.message);
      
      return result;
    }
  }

  /**
   * Installer un package via pip
   */
  async installPythonPackage(packageName: string, userId: string): Promise<CommandResult> {
    return this.executeCommand(`pip3 install ${packageName}`, userId);
  }

  /**
   * Installer un package via npm
   */
  async installNodePackage(packageName: string, userId: string): Promise<CommandResult> {
    return this.executeCommand(`npm install ${packageName}`, userId);
  }

  /**
   * Lister les fichiers d'un répertoire
   */
  async listDirectory(dirPath: string, userId: string): Promise<CommandResult> {
    return this.executeCommand(`ls -la ${dirPath}`, userId);
  }

  /**
   * Lire le contenu d'un fichier
   */
  async readFile(filePath: string, userId: string): Promise<CommandResult> {
    return this.executeCommand(`cat ${filePath}`, userId);
  }

  /**
   * Vérifier si un fichier existe
   */
  async fileExists(filePath: string, userId: string): Promise<boolean> {
    const result = await this.executeCommand(`test -f ${filePath} && echo "exists"`, userId);
    return result.success && result.stdout.includes('exists');
  }

  /**
   * Obtenir des informations sur le système
   */
  async getSystemInfo(userId: string): Promise<Record<string, any>> {
    const uname = await this.executeCommand('uname -a', userId);
    const uptime = await this.executeCommand('uptime', userId);
    const whoami = await this.executeCommand('whoami', userId);
    const pwd = await this.executeCommand('pwd', userId);
    
    return {
      uname: uname.stdout,
      uptime: uptime.stdout,
      user: whoami.stdout,
      workingDirectory: pwd.stdout,
    };
  }

  /**
   * Enregistrer l'exécution dans l'historique
   */
  private recordExecution(userId: string, result: CommandResult): void {
    if (!this.executionHistory.has(userId)) {
      this.executionHistory.set(userId, []);
    }
    
    const history = this.executionHistory.get(userId)!;
    history.push(result);
    
    // Garder seulement les 100 dernières exécutions
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Obtenir l'historique d'exécution
   */
  getExecutionHistory(userId: string): CommandResult[] {
    return this.executionHistory.get(userId) || [];
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalUsers: this.executionHistory.size,
      allowedCommands: this.securityPolicy.allowedCommands.length,
      blockedPatterns: this.securityPolicy.blockedPatterns.length,
      maxExecutionTime: this.securityPolicy.maxExecutionTime,
      maxOutputSize: this.securityPolicy.maxOutputSize,
    };
    
    return stats;
  }
}

// Export singleton instance
export const osAccess = new OSAccessManager();
