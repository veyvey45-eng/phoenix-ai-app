/**
 * Phoenix Orchestrator - Coordonne les 4 modules avancés + E2B
 * 
 * Responsabilités:
 * 1. Détecte le type de tâche (calcul, OS, web, auto-correction)
 * 2. Routage vers le module approprié
 * 3. Gestion de la persistance d'état
 * 4. Boucle de rétroaction et auto-correction
 * 5. Exécution via E2B Sandbox réel
 * 6. Logging et monitoring
 */

import { persistentState } from './persistentState';
import { autoCorrection } from './autoCorrection';
import { osAccess } from './osAccess';
import { webAutomation } from './webAutomation';
import { getE2BAdapter } from './e2bAdapter';

export interface TaskRequest {
  userId: string;
  conversationId: string;
  taskType: 'calculation' | 'os_command' | 'web_interaction' | 'code_execution' | 'auto_correction' | 'unknown';
  content: string;
  code?: string;
  language?: 'python' | 'javascript' | 'bash';
  context?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  attempts: number;
  isCorrected: boolean;
  metadata?: Record<string, any>;
}

export class PhoenixOrchestrator {
  private maxAttempts = 3;
  private executionLog: Array<{
    timestamp: Date;
    userId: string;
    taskType: string;
    success: boolean;
    attempts: number;
  }> = [];

  constructor() {
    console.log('[Orchestrator] Initialized with E2B integration');
  }

  /**
   * Détecte le type de tâche basé sur le contenu
   */
  detectTaskType(content: string): TaskRequest['taskType'] {
    const lowerContent = content.toLowerCase();

    // Détection des commandes OS
    if (
      lowerContent.includes('shell') ||
      lowerContent.includes('bash') ||
      lowerContent.includes('command') ||
      lowerContent.includes('install') ||
      lowerContent.includes('pip') ||
      lowerContent.includes('npm') ||
      lowerContent.includes('apt-get') ||
      lowerContent.includes('chmod') ||
      lowerContent.includes('ls ') ||
      lowerContent.includes('mkdir')
    ) {
      return 'os_command';
    }

    // Détection des interactions web
    if (
      lowerContent.includes('browser') ||
      lowerContent.includes('navigate') ||
      lowerContent.includes('click') ||
      lowerContent.includes('screenshot') ||
      lowerContent.includes('puppeteer') ||
      lowerContent.includes('playwright') ||
      lowerContent.includes('website') ||
      lowerContent.includes('form') ||
      lowerContent.includes('scrape')
    ) {
      return 'web_interaction';
    }

    // Détection des calculs et exécution de code
    if (
      lowerContent.includes('calculate') ||
      lowerContent.includes('compute') ||
      lowerContent.includes('python') ||
      lowerContent.includes('javascript') ||
      lowerContent.includes('code') ||
      lowerContent.includes('execute') ||
      lowerContent.includes('run')
    ) {
      return 'code_execution';
    }

    return 'unknown';
  }

  /**
   * Exécute une tâche avec orchestration complète et E2B
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;
    let isCorrected = false;

    try {
      // Détecter le type si nécessaire
      const taskType = request.taskType === 'unknown' ? this.detectTaskType(request.content) : request.taskType;
      request.taskType = taskType;

      // Charger l'état persistant
      const state = persistentState.getSession(request.userId, request.conversationId);
      console.log(`[Orchestrator] État chargé pour l'utilisateur ${request.userId}`);

      // Obtenir l'adaptateur E2B
      const e2bAdapter = getE2BAdapter();

      // Boucle de rétroaction avec auto-correction
      while (attempts < this.maxAttempts) {
        attempts++;
        console.log(`[Orchestrator] Tentative ${attempts}/${this.maxAttempts} - Type: ${taskType}`);

        try {
          let result: TaskResult;

          // Routage vers le module approprié
          switch (taskType) {
            case 'code_execution':
              result = await this.executeCodeWithE2B(e2bAdapter, request);
              break;

            case 'os_command':
              result = await this.executeOSCommandWithE2B(e2bAdapter, request);
              break;

            case 'web_interaction':
              result = await this.executeWebInteraction(request);
              break;

            default:
              result = await this.executeCodeWithE2B(e2bAdapter, request);
          }

          // Si succès, sauvegarder et retourner
          if (result.success) {
            // Sauvegarder l'état persistant
            await persistentState.setVariable(request.userId, request.conversationId, 'lastResult', result.output);
            await persistentState.setVariable(request.userId, request.conversationId, 'lastExecution', new Date().toISOString());

            // Enregistrer dans le log
            this.executionLog.push({
              timestamp: new Date(),
              userId: request.userId,
              taskType: taskType,
              success: true,
              attempts,
            });

            const duration = Date.now() - startTime;
            console.log(`[Orchestrator] ✅ Tâche réussie en ${duration}ms après ${attempts} tentative(s)`);

            return {
              ...result,
              duration,
              attempts,
              isCorrected,
            };
          }

          // Si erreur, préparer pour auto-correction
          lastError = result.error;
          throw new Error(lastError);
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error(`[Orchestrator] ❌ Erreur à la tentative ${attempts}:`, lastError);

          // Auto-correction si ce n'est pas la dernière tentative
          if (attempts < this.maxAttempts) {
            console.log(`[Orchestrator] 🔄 Tentative d'auto-correction...`);
            try {
              const correctedCode = await autoCorrection.generateCorrection(
                request.content,
                request.code || request.content,
                lastError,
                attempts
              );
              request.code = correctedCode;
              isCorrected = true;
              console.log('[Orchestrator] ✏️ Code corrigé, nouvelle tentative...');
            } catch (correctionError) {
              console.error('[Orchestrator] Erreur lors de la correction:', correctionError);
              // Continuer quand même à la prochaine tentative
            }
          }
        }
      }

      // Toutes les tentatives ont échoué
      this.executionLog.push({
        timestamp: new Date(),
        userId: request.userId,
        taskType: taskType,
        success: false,
        attempts,
      });

      const duration = Date.now() - startTime;
      return {
        success: false,
        output: '',
        error: `Impossible de compléter la tâche après ${attempts} tentatives. Dernière erreur: ${lastError}`,
        duration,
        attempts,
        isCorrected,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Orchestrator] 🚨 Erreur critique:', errorMessage);

      return {
        success: false,
        output: '',
        error: `Erreur critique: ${errorMessage}`,
        duration,
        attempts,
        isCorrected: false,
      };
    }
  }

  /**
   * Exécute du code via E2B Sandbox
   */
  private async executeCodeWithE2B(e2bAdapter: ReturnType<typeof getE2BAdapter>, request: TaskRequest): Promise<TaskResult> {
    const sandboxId = `${request.userId}-${request.conversationId}`;
    const language = request.language || 'python';
    const code = request.code || request.content;

    console.log(`[Orchestrator] Exécution ${language} via E2B Sandbox`);

    let e2bResult;
    if (language === 'python') {
      e2bResult = await e2bAdapter.executePython(sandboxId, code);
    } else if (language === 'javascript') {
      e2bResult = await e2bAdapter.executeNode(sandboxId, code);
    } else {
      e2bResult = await e2bAdapter.executeShell(sandboxId, code);
    }

    return {
      success: e2bResult.success,
      output: e2bResult.stdout,
      error: e2bResult.stderr || undefined,
      duration: e2bResult.duration,
      attempts: 1,
      isCorrected: false,
      metadata: {
        sandboxId: e2bResult.sandboxId,
        language,
        exitCode: e2bResult.exitCode,
      },
    };
  }

  /**
   * Exécute une commande OS via E2B Sandbox
   */
  private async executeOSCommandWithE2B(e2bAdapter: ReturnType<typeof getE2BAdapter>, request: TaskRequest): Promise<TaskResult> {
    const sandboxId = `${request.userId}-${request.conversationId}`;
    const command = request.content;

    console.log(`[Orchestrator] Exécution commande OS via E2B Sandbox:`, command);

    const e2bResult = await e2bAdapter.executeShell(sandboxId, command);

    return {
      success: e2bResult.success,
      output: e2bResult.stdout,
      error: e2bResult.stderr || undefined,
      duration: e2bResult.duration,
      attempts: 1,
      isCorrected: false,
      metadata: {
        sandboxId: e2bResult.sandboxId,
        exitCode: e2bResult.exitCode,
      },
    };
  }

  /**
   * Exécute une interaction web
   */
  private async executeWebInteraction(request: TaskRequest): Promise<TaskResult> {
    console.log(`[Orchestrator] Exécution interaction web`);

    try {
      const sessionId = `session_${request.userId}_${Date.now()}`;
      const pageId = `page_${Date.now()}`;

      // Créer une session
      await webAutomation.createSession(request.userId, sessionId);

      // Naviguer vers une URL (placeholder pour maintenant)
      const webResult = await webAutomation.navigateTo(sessionId, pageId, 'about:blank');

      return {
        success: webResult.success,
        output: webResult.message || 'Web automation executed',
        error: webResult.success ? undefined : webResult.message,
        duration: 0,
        attempts: 1,
        isCorrected: false,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: 0,
        attempts: 1,
        isCorrected: false,
      };
    }
  }

  /**
   * Récupère le log d'exécution
   */
  getExecutionLog(): Array<{
    timestamp: Date;
    userId: string;
    taskType: string;
    success: boolean;
    attempts: number;
  }> {
    return this.executionLog.map(log => ({ ...log }));
  }

  /**
   * Réinitialise l'orchestrateur
   */
  async reset(): Promise<void> {
    console.log('[Orchestrator] Réinitialisation...');
    this.executionLog = [];
  }
}

// Singleton global
let orchestratorInstance: PhoenixOrchestrator | null = null;

export function getOrchestrator(): PhoenixOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PhoenixOrchestrator();
  }
  return orchestratorInstance;
}
