/**
 * Phoenix Orchestrator - Coordonne les 4 modules avancés
 * 
 * Responsabilités:
 * 1. Détecte le type de tâche (calcul, OS, web, auto-correction)
 * 2. Routage vers le module approprié
 * 3. Gestion de la persistance d'état
 * 4. Boucle de rétroaction et auto-correction
 * 5. Logging et monitoring
 */

import { persistentState } from './persistentState';
import { autoCorrection } from './autoCorrection';
import { osAccess } from './osAccess';
import { webAutomation } from './webAutomation';

export interface TaskRequest {
  userId: string;
  conversationId: string;
  taskType: 'calculation' | 'os_command' | 'web_interaction' | 'code_execution' | 'auto_correction' | 'unknown';
  content: string;
  code?: string;
  language?: 'python' | 'javascript';
  context?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
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
    console.log('[Orchestrator] Initialized');
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
   * Exécute une tâche avec orchestration complète
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;
    let isCorrected = false;

    try {
      // Charger l'état persistant
      const state = await persistentState.getSession(request.userId, request.conversationId);
      console.log(`[Orchestrator] État chargé pour l'utilisateur ${request.userId}:`, state);

      // Boucle de rétroaction avec auto-correction
      while (attempts < this.maxAttempts) {
        attempts++;
        console.log(`[Orchestrator] Tentative ${attempts}/${this.maxAttempts}`);

        try {
          let result: string;

          // Routage vers le module approprié
          switch (request.taskType) {
            case 'os_command':
              console.log('[Orchestrator] Routage vers OS Access Manager');
              const osResult = await osAccess.executeCommand(request.content, request.userId);
              result = osResult.stdout || osResult.stderr;
              if (!osResult.success) {
                throw new Error(osResult.stderr);
              }
              break;

            case 'web_interaction':
              console.log('[Orchestrator] Routage vers Web Automation Engine');
              const sessionId = `session_${request.userId}_${Date.now()}`;
              const pageId = `page_${Date.now()}`;
              // Créer une session
              await webAutomation.createSession(request.userId, sessionId);
              // Naviguer vers une URL (placeholder pour maintenant)
              const webResult = await webAutomation.navigateTo(sessionId, pageId, 'about:blank');
              result = webResult.message || 'Web automation executed';
              if (!webResult.success) {
                throw new Error(webResult.message);
              }
              break;

            case 'code_execution':
              console.log('[Orchestrator] Routage vers Code Execution');
              result = await this.executeCode(request.code || request.content, request.language || 'python');
              break;

            default:
              console.log('[Orchestrator] Type de tâche inconnu, exécution comme code');
              result = await this.executeCode(request.content, 'python');
          }

          // Sauvegarder l'état persistant
          await persistentState.setVariable(request.userId, request.conversationId, 'lastResult', result);
          await persistentState.setVariable(request.userId, request.conversationId, 'lastExecution', new Date().toISOString());

          // Enregistrer dans le log
          this.executionLog.push({
            timestamp: new Date(),
            userId: request.userId,
            taskType: request.taskType,
            success: true,
            attempts,
          });

          const executionTime = Date.now() - startTime;
          console.log(`[Orchestrator] Tâche réussie en ${executionTime}ms après ${attempts} tentative(s)`);

          return {
            success: true,
            output: result,
            executionTime,
            attempts,
            isCorrected,
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error(`[Orchestrator] Erreur à la tentative ${attempts}:`, lastError);

          // Auto-correction si ce n'est pas la dernière tentative
          if (attempts < this.maxAttempts) {
            console.log(`[Orchestrator] Tentative d'auto-correction...`);
            try {
              const correctedCode = await autoCorrection.generateCorrection(
                request.content,
                request.code || request.content,
                lastError,
                attempts - 1
              );
              request.code = correctedCode;
              isCorrected = true;
              console.log('[Orchestrator] Code corrigé, nouvelle tentative...');
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
        taskType: request.taskType,
        success: false,
        attempts,
      });

      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: '',
        error: `Impossible de compléter la tâche après ${attempts} tentatives. Dernière erreur: ${lastError}`,
        executionTime,
        attempts,
        isCorrected,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Orchestrator] Erreur critique:', errorMessage);

      return {
        success: false,
        output: '',
        error: `Erreur critique: ${errorMessage}`,
        executionTime,
        attempts,
        isCorrected: false,
      };
    }
  }

  /**
   * Exécute du code Python ou JavaScript
   */
  private async executeCode(code: string, language: 'python' | 'javascript'): Promise<string> {
    // Cette méthode sera connectée à e2bSandbox.ts dans la prochaine étape
    console.log(`[Orchestrator] Exécution ${language}:`, code.substring(0, 100));
    
    // Placeholder pour maintenant - sera remplacé par l'intégration E2B
    if (language === 'python') {
      return `Résultat Python: ${code.substring(0, 50)}...`;
    } else {
      return `Résultat JavaScript: ${code.substring(0, 50)}...`;
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
    // Fermer toutes les sessions web
    // Les sessions sont fermées individuellement lors de la fermeture
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
