/**
 * REAL EXECUTOR - Exécution Réelle de Code, Recherche Web et Génération
 * 
 * Ce module exécute du code VRAI (pas simulation) en utilisant:
 * - E2B Sandbox pour l'exécution de code
 * - Serper API pour la recherche web
 * - Puppeteer pour l'extraction de données
 * - LLM pour la génération et correction
 */

import { e2bSandbox } from './e2bSandbox';
import { serperApi } from './serperApi';
import { webAutomationWorker } from './webAutomationWorker';
import { invokeLLM } from '../_core/llm';
import { ReasoningLoop } from './reasoningLoop';

export interface ExecutionRequest {
  type: 'code' | 'search' | 'browse' | 'generate';
  language?: 'python' | 'javascript' | 'shell';
  content: string;
  userId: number;
  username: string;
  context?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  result: string;
  error?: string;
  executionTime: number;
  type: 'code' | 'search' | 'browse' | 'generate';
  metadata?: Record<string, unknown>;
}

export class RealExecutor {
  /**
   * Exécute une requête réelle
   */
  static async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      switch (request.type) {
        case 'code':
          return await this.executeCode(request, startTime);

        case 'search':
          return await this.searchWeb(request, startTime);

        case 'browse':
          return await this.browseWeb(request, startTime);

        case 'generate':
          return await this.generateCode(request, startTime);

        default:
          return {
            success: false,
            result: '',
            error: `Type d'exécution inconnu: ${request.type}`,
            executionTime: Date.now() - startTime,
            type: request.type as any
          };
      }
    } catch (error) {
      console.error('[RealExecutor] Erreur:', error);
      return {
        success: false,
        result: '',
        error: String(error),
        executionTime: Date.now() - startTime,
        type: request.type
      };
    }
  }

  /**
   * Exécute du code réel
   */
  private static async executeCode(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    console.log(`[RealExecutor] Exécution de code ${request.language}`);

    try {
      let result;

      if (request.language === 'python') {
        result = await e2bSandbox.executePython(
          request.content,
          request.userId.toString(),
          request.username
        );
      } else if (request.language === 'javascript') {
        result = await e2bSandbox.executeJavaScript(
          request.content,
          request.userId.toString(),
          request.username
        );
      } else {
        throw new Error(`Langage non supporté: ${request.language}`);
      }

      if (result.success) {
        console.log(`[RealExecutor] ✅ Code exécuté avec succès`);
        return {
          success: true,
          result: result.output,
          executionTime: Date.now() - startTime,
          type: 'code',
          metadata: {
            language: request.language,
            filesGenerated: result.filesGenerated
          }
        };
      } else {
        // Essayer de corriger l'erreur automatiquement
        console.log(`[RealExecutor] ❌ Erreur détectée, tentative de correction...`);

        const correction = await ReasoningLoop.analyzeErrorAndCorrect(
          request.content,
          result.error || 'Erreur inconnue',
          request.language || 'python'
        );

        if (correction.confidence > 0.7) {
          console.log(`[RealExecutor] 🔧 Correction générée (confiance: ${correction.confidence})`);

          // Retry avec le code corrigé
          let retryResult;
          if (request.language === 'python') {
            retryResult = await e2bSandbox.executePython(
              correction.correctedCode,
              request.userId.toString(),
              request.username
            );
          } else if (request.language === 'javascript') {
            retryResult = await e2bSandbox.executeJavaScript(
              correction.correctedCode,
              request.userId.toString(),
              request.username
            );
          } else {
            retryResult = result;
          }

          if (retryResult.success) {
            console.log(`[RealExecutor] ✅ Correction réussie!`);
            return {
              success: true,
              result: retryResult.output,
              executionTime: Date.now() - startTime,
              type: 'code',
              metadata: {
                language: request.language,
                corrected: true,
                originalError: result.error,
                explanation: correction.explanation
              }
            };
          }
        }

        return {
          success: false,
          result: result.output,
          error: result.error,
          executionTime: Date.now() - startTime,
          type: 'code',
          metadata: {
            language: request.language,
            correctionAttempted: true,
            correctionConfidence: correction.confidence
          }
        };
      }
    } catch (error) {
      console.error('[RealExecutor] Erreur lors de l\'exécution:', error);
      return {
        success: false,
        result: '',
        error: String(error),
        executionTime: Date.now() - startTime,
        type: 'code'
      };
    }
  }

  /**
   * Recherche web réelle
   */
  private static async searchWeb(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    console.log(`[RealExecutor] Recherche web: ${request.content}`);

    try {
      const results = await serperApi.search(request.content);

      if (results.length > 0) {
        console.log(`[RealExecutor] ✅ ${results.length} résultats trouvés`);

        return {
          success: true,
          result: JSON.stringify(results, null, 2),
          executionTime: Date.now() - startTime,
          type: 'search',
          metadata: {
            resultCount: results.length,
            query: request.content
          }
        };
      } else {
        return {
          success: false,
          result: '',
          error: 'Aucun résultat trouvé',
          executionTime: Date.now() - startTime,
          type: 'search'
        };
      }
    } catch (error) {
      console.error('[RealExecutor] Erreur lors de la recherche:', error);
      return {
        success: false,
        result: '',
        error: String(error),
        executionTime: Date.now() - startTime,
        type: 'search'
      };
    }
  }

  /**
   * Navigation web réelle
   */
  private static async browseWeb(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    console.log(`[RealExecutor] Navigation web: ${request.content}`);

    try {
      // Parser l'URL et l'objectif
      const lines = request.content.split('\n');
      const url = lines[0];
      const objective = lines.slice(1).join('\n') || 'Extraire les données principales';

      // Créer une session de navigation
      const sessionId = await webAutomationWorker.createSession(
        `browse-${Date.now()}`,
        request.userId,
        url,
        objective
      );

      // Exécuter la session
      const result = await webAutomationWorker.executeSession(sessionId);

      if (result.success) {
        console.log(`[RealExecutor] ✅ Navigation réussie`);

        return {
          success: true,
          result: JSON.stringify(result.data, null, 2),
          executionTime: Date.now() - startTime,
          type: 'browse',
          metadata: {
            sessionId,
            url,
            objective
          }
        };
      } else {
        return {
          success: false,
          result: '',
          error: result.error,
          executionTime: Date.now() - startTime,
          type: 'browse'
        };
      }
    } catch (error) {
      console.error('[RealExecutor] Erreur lors de la navigation:', error);
      return {
        success: false,
        result: '',
        error: String(error),
        executionTime: Date.now() - startTime,
        type: 'browse'
      };
    }
  }

  /**
   * Génération de code réelle
   */
  private static async generateCode(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    console.log(`[RealExecutor] Génération de code: ${request.language}`);

    try {
      const prompt = `Tu es un expert en génération de code ${request.language}.

OBJECTIF: ${request.content}

Génère du code ${request.language} complet et fonctionnel.
Le code doit être:
- Prêt à exécuter
- Bien commenté
- Optimisé
- Sécurisé

Réponds UNIQUEMENT avec le code, sans explications.`;

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en génération de code ${request.language}. Tu génères du code de haute qualité, optimisé et sécurisé.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === 'string') {
        // Extraire le code si c'est dans un bloc de code
        let code = messageContent;
        const codeMatch = messageContent.match(/```[\w]*\n([\s\S]*?)\n```/);
        if (codeMatch) {
          code = codeMatch[1];
        }

        console.log(`[RealExecutor] ✅ Code généré (${code.length} caractères)`);

        // Essayer d'exécuter le code généré
        console.log(`[RealExecutor] Exécution du code généré...`);

        const execResult = await this.executeCode(
          {
            type: 'code',
            language: request.language as 'python' | 'javascript' | 'shell',
            content: code,
            userId: request.userId,
            username: request.username,
            context: request.context
          },
          startTime
        );

        return {
          success: execResult.success,
          result: execResult.success ? execResult.result : code,
          error: execResult.error,
          executionTime: Date.now() - startTime,
          type: 'generate',
          metadata: {
            language: request.language,
            codeLength: code.length,
            executed: true,
            executionSuccess: execResult.success
          }
        };
      } else {
        return {
          success: false,
          result: '',
          error: 'Impossible de générer le code',
          executionTime: Date.now() - startTime,
          type: 'generate'
        };
      }
    } catch (error) {
      console.error('[RealExecutor] Erreur lors de la génération:', error);
      return {
        success: false,
        result: '',
        error: String(error),
        executionTime: Date.now() - startTime,
        type: 'generate'
      };
    }
  }
}

export const realExecutor = RealExecutor;
