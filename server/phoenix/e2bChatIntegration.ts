/**
 * E2B Chat Integration - Intégration automatique d'E2B au chat Phoenix
 */

import { detectCodeExecutionNeed, extractCodeFromResponse } from './codeDetector';
import { getE2BAdapter } from './e2bAdapter';
import { getExecutionHistoryService } from './executionHistoryService';
import { getE2BWebhookManager } from './e2bWebhookManager';

export interface ChatExecutionRequest {
  userId: number;
  conversationId: string;
  message: string;
  preferredLanguage?: 'python' | 'node' | 'shell';
}

export interface ChatExecutionResult {
  success: boolean;
  executionId: string;
  language: 'python' | 'node' | 'shell';
  code: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
  error?: string;
}

export class E2BChatIntegration {
  private e2bAdapter = getE2BAdapter();
  private historyService = getExecutionHistoryService();
  private webhookManager = getE2BWebhookManager();

  constructor() {
    console.log('[E2BChatIntegration] Initialized');
  }

  /**
   * Traiter un message de chat et exécuter le code si détecté
   */
  async processMessage(request: ChatExecutionRequest): Promise<ChatExecutionResult | null> {
    // Détecter le code dans le message
    const detectionResult = detectCodeExecutionNeed(request.message);

    if (!detectionResult.shouldExecuteCode) {
      console.log('[E2BChatIntegration] No code execution needed');
      return null;
    }

    console.log('[E2BChatIntegration] Code execution detected:', {
      language: detectionResult.language,
      reason: detectionResult.reason,
    });

    // Extraire le code du message
    const code = extractCodeFromResponse(request.message) || request.message;
    const language = (detectionResult.language === 'javascript' ? 'node' : detectionResult.language) as 'python' | 'node' | 'shell';

    if (!code || !language) {
      console.log('[E2BChatIntegration] No executable code found');
      return null;
    }

    // Exécuter le code
    return await this.executeCode(
      request.userId,
      request.conversationId,
      code,
      language
    );
  }

  /**
   * Exécuter du code et enregistrer le résultat
   */
  async executeCode(
    userId: number,
    conversationId: string,
    code: string,
    language: 'python' | 'node' | 'shell'
  ): Promise<ChatExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Obtenir ou créer une sandbox
      const sandboxId = `${userId}-${conversationId}`;

      console.log('[E2BChatIntegration] Executing code:', {
        executionId,
        sandboxId,
        language,
        codeLength: code.length,
      });

      // Déclencher l'événement de démarrage
      this.webhookManager.triggerEvent(userId, executionId, 'execution_started', {
        language,
        codeLength: code.length,
      });

      // Exécuter le code
      let result;
      if (language === 'python') {
        result = await this.e2bAdapter.executePython(sandboxId, code);
      } else if (language === 'node') {
        result = await this.e2bAdapter.executeNode(sandboxId, code);
      } else {
        result = await this.e2bAdapter.executeShell(sandboxId, code);
      }

      const duration = Date.now() - startTime;

      // Enregistrer dans l'historique
      const record = this.historyService.recordExecution(
        userId,
        conversationId,
        sandboxId,
        language,
        code,
        result.success,
        result.stdout,
        result.stderr,
        result.exitCode,
        duration
      );

      console.log('[E2BChatIntegration] Execution completed:', {
        executionId,
        success: result.success,
        duration,
      });

      // Déclencher l'événement de complétion
      const eventType = result.success ? 'execution_completed' : 'execution_failed';
      this.webhookManager.triggerEvent(userId, executionId, eventType, {
        success: result.success,
        duration,
        exitCode: result.exitCode,
        stdoutLength: result.stdout?.length || 0,
        stderrLength: result.stderr?.length || 0,
      });

      return {
        success: result.success,
        executionId: record.id,
        language,
        code,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error('[E2BChatIntegration] Execution failed:', {
        executionId,
        error: String(error),
        duration,
      });

      // Déclencher l'événement d'erreur
      this.webhookManager.triggerEvent(userId, executionId, 'execution_failed', {
        error: String(error),
        duration,
      });

      return {
        success: false,
        executionId,
        language,
        code,
        duration,
        error: String(error),
      };
    }
  }

  /**
   * Obtenir les résultats d'exécution récents
   */
  getRecentResults(userId: number, limit: number = 5) {
    return this.historyService.getRecentExecutions(userId, limit);
  }

  /**
   * Rejouer une exécution précédente
   */
  async replayExecution(userId: number, executionId: string): Promise<ChatExecutionResult | null> {
    const execution = this.historyService.getExecution(executionId);

    if (!execution || execution.userId !== userId) {
      console.log('[E2BChatIntegration] Execution not found for replay');
      return null;
    }

    console.log('[E2BChatIntegration] Replaying execution:', executionId);

    return await this.executeCode(
      userId,
      execution.conversationId || 'replay',
      execution.code,
      execution.language
    );
  }

  /**
   * Obtenir les suggestions de code basées sur l'historique
   */
  getSuggestions(userId: number, language: 'python' | 'node' | 'shell', limit: number = 3) {
    const records = this.historyService.getHistory({
      userId,
      language,
      limit: 100,
    });

    // Filtrer les exécutions réussies
    const successful = records.filter(r => r.success);

    // Trier par durée (les plus rapides d'abord)
    successful.sort((a, b) => a.duration - b.duration);

    // Retourner les suggestions
    return successful.slice(0, limit).map(r => ({
      code: r.code,
      duration: r.duration,
      tags: r.tags,
    }));
  }

  /**
   * Analyser les patterns d'utilisation
   */
  analyzePatterns(userId: number) {
    const records = this.historyService.getHistory({ userId, limit: 1000 });

    const patterns: Record<string, any> = {
      totalExecutions: records.length,
      successRate: records.length > 0 ? records.filter(r => r.success).length / records.length : 0,
      averageDuration: records.length > 0 ? records.reduce((sum, r) => sum + r.duration, 0) / records.length : 0,
      byLanguage: {
        python: records.filter(r => r.language === 'python').length,
        node: records.filter(r => r.language === 'node').length,
        shell: records.filter(r => r.language === 'shell').length,
      },
      topPatterns: this.extractTopPatterns(records),
      errorPatterns: this.extractErrorPatterns(records),
    };

    return patterns;
  }

  /**
   * Extraire les patterns les plus courants
   */
  private extractTopPatterns(records: any[]) {
    const patterns: Record<string, number> = {};

    records.forEach(r => {
      if (r.tags) {
        r.tags.forEach((tag: string) => {
          patterns[tag] = (patterns[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  /**
   * Extraire les patterns d'erreur
   */
  private extractErrorPatterns(records: any[]) {
    const errors: Record<string, number> = {};

    records.filter(r => !r.success && r.stderr).forEach(r => {
      const errorType = r.stderr.split('\n')[0].split(':')[0];
      errors[errorType] = (errors[errorType] || 0) + 1;
    });

    return Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }
}

// Singleton global
let chatIntegration: E2BChatIntegration | null = null;

export function getE2BChatIntegration(): E2BChatIntegration {
  if (!chatIntegration) {
    chatIntegration = new E2BChatIntegration();
  }
  return chatIntegration;
}
