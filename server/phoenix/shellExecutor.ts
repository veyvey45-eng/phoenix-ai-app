/**
 * SHELL EXECUTOR - Exécution de Commandes Shell Complètes
 * 
 * Ce module étend les capacités shell de Phoenix pour:
 * 1. Exécuter des commandes shell arbitraires (avec sécurité)
 * 2. Gérer des sessions shell persistantes
 * 3. Supporter les commandes interactives
 * 4. Capturer stdout, stderr et codes de retour
 * 5. Gérer les timeouts et interruptions
 */

import { Sandbox } from '@e2b/code-interpreter';
import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

// Types
export interface ShellSession {
  id: string;
  userId: number;
  workingDir: string;
  environment: Record<string, string>;
  history: ShellCommand[];
  createdAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'idle' | 'terminated';
}

export interface ShellCommand {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
}

export interface ExecuteOptions {
  timeout?: number;           // Timeout en ms (défaut: 30000)
  workingDir?: string;        // Répertoire de travail
  environment?: Record<string, string>; // Variables d'environnement
  stdin?: string;             // Entrée standard
  shell?: string;             // Shell à utiliser (défaut: /bin/bash)
  captureOutput?: boolean;    // Capturer la sortie (défaut: true)
  streamOutput?: boolean;     // Streamer la sortie en temps réel
}

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  command: string;
  error?: string;
}

// Constantes
const DEFAULT_TIMEOUT = 30000; // 30 secondes
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB max
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes d'inactivité

// Commandes dangereuses à bloquer
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'dd if=/dev/zero',
  'mkfs',
  ':(){ :|:& };:',  // Fork bomb
  'chmod -R 777 /',
  'chown -R',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init 0',
  'init 6',
];

// Patterns de commandes à surveiller
const SENSITIVE_PATTERNS = [
  /rm\s+-rf?\s+\/(?!home\/user)/,  // rm sur répertoires système
  /sudo\s+rm/,
  />\s*\/dev\/sd[a-z]/,  // Écriture sur disques
  /curl.*\|\s*(?:bash|sh)/,  // Pipe curl vers shell
  /wget.*\|\s*(?:bash|sh)/,
];

/**
 * Classe ShellExecutor - Gère l'exécution des commandes shell
 */
export class ShellExecutor extends EventEmitter {
  private sessions: Map<string, ShellSession> = new Map();
  private sandbox: InstanceType<typeof Sandbox> | null = null;
  private useE2B: boolean;
  private tempDir: string;

  constructor(useE2B = true) {
    super();
    this.useE2B = useE2B && !!process.env.E2B_API_KEY;
    this.tempDir = path.join(os.tmpdir(), 'phoenix-shell');
    
    // Créer le répertoire temporaire
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Nettoyer les sessions inactives périodiquement
    setInterval(() => this.cleanupSessions(), 60000);
  }

  /**
   * Crée une nouvelle session shell
   */
  createSession(userId: number, workingDir?: string): ShellSession {
    const sessionId = `shell-${userId}-${Date.now()}`;
    const session: ShellSession = {
      id: sessionId,
      userId,
      workingDir: workingDir || '/home/user',
      environment: { ...process.env } as Record<string, string>,
      history: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active'
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionCreated', { sessionId, userId });

    return session;
  }

  /**
   * Récupère une session existante ou en crée une nouvelle
   */
  getOrCreateSession(userId: number): ShellSession {
    // Chercher une session active pour cet utilisateur
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.status === 'active') {
        session.lastActivityAt = new Date();
        return session;
      }
    }
    return this.createSession(userId);
  }

  /**
   * Exécute une commande shell
   */
  async execute(
    command: string,
    userId: number,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> {
    const startTime = Date.now();
    const session = this.getOrCreateSession(userId);

    // Valider la commande
    const validationError = this.validateCommand(command);
    if (validationError) {
      return {
        success: false,
        stdout: '',
        stderr: validationError,
        exitCode: 1,
        duration: Date.now() - startTime,
        command,
        error: validationError
      };
    }

    console.log(`[ShellExecutor] Executing: ${command}`);

    // Créer l'entrée dans l'historique
    const cmdEntry: ShellCommand = {
      id: `cmd-${Date.now()}`,
      command,
      stdout: '',
      stderr: '',
      exitCode: null,
      startedAt: new Date(),
      completedAt: null,
      duration: null,
      status: 'running'
    };
    session.history.push(cmdEntry);

    try {
      let result: ExecuteResult;

      if (this.useE2B) {
        result = await this.executeInE2B(command, session, options);
      } else {
        result = await this.executeNative(command, session, options);
      }

      // Mettre à jour l'entrée de l'historique
      cmdEntry.stdout = result.stdout;
      cmdEntry.stderr = result.stderr;
      cmdEntry.exitCode = result.exitCode;
      cmdEntry.completedAt = new Date();
      cmdEntry.duration = result.duration;
      cmdEntry.status = result.success ? 'completed' : 'failed';

      session.lastActivityAt = new Date();
      this.emit('commandCompleted', { sessionId: session.id, command: cmdEntry });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      cmdEntry.stderr = errorMessage;
      cmdEntry.exitCode = 1;
      cmdEntry.completedAt = new Date();
      cmdEntry.duration = Date.now() - startTime;
      cmdEntry.status = 'failed';

      return {
        success: false,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        duration: Date.now() - startTime,
        command,
        error: errorMessage
      };
    }
  }

  /**
   * Exécute une commande dans E2B
   */
  private async executeInE2B(
    command: string,
    session: ShellSession,
    options: ExecuteOptions
  ): Promise<ExecuteResult> {
    const startTime = Date.now();

    try {
      // Créer ou réutiliser le sandbox
      if (!this.sandbox) {
        this.sandbox = await Sandbox.create();
        console.log('[ShellExecutor] Created E2B sandbox');
      }

      // Construire le code Python pour exécuter la commande shell
      const workingDir = options.workingDir || session.workingDir;
      const timeout = options.timeout || DEFAULT_TIMEOUT;

      const pythonCode = `
import subprocess
import os
import json

# Changer de répertoire
os.chdir('${workingDir}')

# Exécuter la commande
try:
    result = subprocess.run(
        '''${command.replace(/'/g, "\\'")}''',
        shell=True,
        capture_output=True,
        text=True,
        timeout=${Math.floor(timeout / 1000)},
        env={**os.environ, **${JSON.stringify(options.environment || {})}}
    )
    
    output = {
        'stdout': result.stdout,
        'stderr': result.stderr,
        'exitCode': result.returncode
    }
    print(json.dumps(output))
except subprocess.TimeoutExpired as e:
    print(json.dumps({
        'stdout': e.stdout or '',
        'stderr': 'Command timed out',
        'exitCode': -1
    }))
except Exception as e:
    print(json.dumps({
        'stdout': '',
        'stderr': str(e),
        'exitCode': 1
    }))
`;

      const execution = await this.sandbox.runCode(pythonCode, { language: 'python' });

      const duration = Date.now() - startTime;

      if (execution.error) {
        return {
          success: false,
          stdout: '',
          stderr: execution.error.value,
          exitCode: 1,
          duration,
          command,
          error: execution.error.value
        };
      }

      // Parser la sortie JSON
      const output = execution.logs?.stdout?.join('') || '{}';
      
      try {
        const parsed = JSON.parse(output);
        return {
          success: parsed.exitCode === 0,
          stdout: parsed.stdout || '',
          stderr: parsed.stderr || '',
          exitCode: parsed.exitCode,
          duration,
          command
        };
      } catch (parseError) {
        return {
          success: false,
          stdout: output,
          stderr: 'Failed to parse command output',
          exitCode: 1,
          duration,
          command
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        duration,
        command,
        error: errorMessage
      };
    }
  }

  /**
   * Exécute une commande en natif
   */
  private async executeNative(
    command: string,
    session: ShellSession,
    options: ExecuteOptions
  ): Promise<ExecuteResult> {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const workingDir = options.workingDir || session.workingDir;
    const shell = options.shell || '/bin/bash';

    return new Promise((resolve) => {
      const child = spawn(shell, ['-c', command], {
        cwd: workingDir,
        env: { ...process.env, ...options.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, timeout);

      // Capturer stdout
      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (stdout.length > MAX_OUTPUT_SIZE) {
          stdout = stdout.slice(-MAX_OUTPUT_SIZE);
        }
        if (options.streamOutput) {
          this.emit('stdout', { sessionId: session.id, data: chunk });
        }
      });

      // Capturer stderr
      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (stderr.length > MAX_OUTPUT_SIZE) {
          stderr = stderr.slice(-MAX_OUTPUT_SIZE);
        }
        if (options.streamOutput) {
          this.emit('stderr', { sessionId: session.id, data: chunk });
        }
      });

      // Envoyer stdin si fourni
      if (options.stdin) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      }

      // Gérer la fin du processus
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        resolve({
          success: code === 0 && !killed,
          stdout,
          stderr: killed ? 'Command timed out' : stderr,
          exitCode: killed ? -1 : code,
          duration,
          command,
          error: killed ? 'Command timed out' : undefined
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
          duration,
          command,
          error: error.message
        });
      });
    });
  }

  /**
   * Valide une commande pour la sécurité
   */
  private validateCommand(command: string): string | null {
    // Vérifier les commandes dangereuses exactes
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (command.includes(dangerous)) {
        return `Commande dangereuse bloquée: ${dangerous}`;
      }
    }

    // Vérifier les patterns sensibles
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(command)) {
        return `Commande potentiellement dangereuse détectée`;
      }
    }

    return null;
  }

  /**
   * Exécute plusieurs commandes en séquence
   */
  async executeSequence(
    commands: string[],
    userId: number,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult[]> {
    const results: ExecuteResult[] = [];

    for (const command of commands) {
      const result = await this.execute(command, userId, options);
      results.push(result);

      // Arrêter si une commande échoue (sauf si continueOnError)
      if (!result.success && !(options as any).continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Exécute un script shell
   */
  async executeScript(
    script: string,
    userId: number,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> {
    // Sauvegarder le script dans un fichier temporaire
    const scriptPath = path.join(this.tempDir, `script-${userId}-${Date.now()}.sh`);
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });

    try {
      const result = await this.execute(`bash "${scriptPath}"`, userId, options);
      return result;
    } finally {
      // Nettoyer le fichier temporaire
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
    }
  }

  /**
   * Récupère l'historique d'une session
   */
  getSessionHistory(sessionId: string): ShellCommand[] {
    const session = this.sessions.get(sessionId);
    return session?.history || [];
  }

  /**
   * Termine une session
   */
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'terminated';
      this.emit('sessionTerminated', { sessionId });
      return true;
    }
    return false;
  }

  /**
   * Nettoie les sessions inactives
   */
  private cleanupSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT) {
        session.status = 'terminated';
        this.sessions.delete(sessionId);
        this.emit('sessionExpired', { sessionId });
      }
    }
  }

  /**
   * Ferme le sandbox E2B
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      this.sandbox = null;
    }
    this.sessions.clear();
  }

  /**
   * Retourne les statistiques
   */
  getStats(): {
    activeSessions: number;
    totalCommands: number;
    useE2B: boolean;
  } {
    let totalCommands = 0;
    for (const session of this.sessions.values()) {
      totalCommands += session.history.length;
    }

    return {
      activeSessions: this.sessions.size,
      totalCommands,
      useE2B: this.useE2B
    };
  }
}

// Singleton
let shellExecutorInstance: ShellExecutor | null = null;

/**
 * Obtient l'instance du ShellExecutor
 */
export function getShellExecutor(): ShellExecutor {
  if (!shellExecutorInstance) {
    shellExecutorInstance = new ShellExecutor();
  }
  return shellExecutorInstance;
}

export default ShellExecutor;
