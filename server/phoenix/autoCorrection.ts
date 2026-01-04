/**
 * Auto-Correction Manager
 * Permet à Phoenix de corriger son code automatiquement sans intervention utilisateur
 * Implémente une boucle de rétroaction itérative
 */

import { invokeLLM } from '../_core/llm';

interface IterationResult {
  iteration: number;
  code: string;
  output: string;
  error?: string;
  success: boolean;
  timestamp: number;
}

interface CorrectionSession {
  sessionId: string;
  userId: string;
  originalRequest: string;
  iterations: IterationResult[];
  maxIterations: number;
  createdAt: number;
  status: 'in_progress' | 'completed' | 'failed';
}

class AutoCorrectionManager {
  private sessions: Map<string, CorrectionSession> = new Map();
  private maxIterations: number = 5;
  private iterationDelay: number = 1000; // 1 seconde entre les itérations

  constructor() {
    console.log('[AutoCorrection] Initialized');
  }

  /**
   * Créer une session de correction
   */
  createSession(userId: string, sessionId: string, originalRequest: string): CorrectionSession {
    const session: CorrectionSession = {
      sessionId,
      userId,
      originalRequest,
      iterations: [],
      maxIterations: this.maxIterations,
      createdAt: Date.now(),
      status: 'in_progress',
    };
    
    this.sessions.set(sessionId, session);
    
    console.log('[AutoCorrection] Created session:', sessionId);
    
    return session;
  }

  /**
   * Ajouter une itération à la session
   */
  addIteration(sessionId: string, iteration: IterationResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.iterations.push(iteration);
    
    console.log('[AutoCorrection] Added iteration', iteration.iteration, 'to session:', sessionId);
  }

  /**
   * Générer une correction basée sur l'erreur
   */
  async generateCorrection(
    originalRequest: string,
    previousCode: string,
    error: string,
    previousAttempts: number
  ): Promise<string> {
    const prompt = `
Tu es Phoenix, un système d'IA capable d'auto-correction itérative.

Demande originale: ${originalRequest}

Code précédent qui a échoué:
\`\`\`
${previousCode}
\`\`\`

Erreur rencontrée:
${error}

Nombre de tentatives précédentes: ${previousAttempts}

Génère du code CORRIGÉ qui résout le problème. 
- Analyse l'erreur
- Corrige le code
- Assure-toi que le code est exécutable
- Retourne UNIQUEMENT le code, sans explications

Génère le code dans les balises \`\`\`python ou \`\`\`javascript selon le contexte.
    `;
    
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en correction de code. Tu analyses les erreurs et génères du code corrigé.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      
      // Extraire le code des balises
      const content = response.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        const codeMatch = content.match(/```(?:python|javascript)?\n([\s\S]*?)\n```/);
        if (codeMatch && codeMatch[1]) {
          return codeMatch[1].trim();
        }
        return content;
      }
      
      return '';
    } catch (error) {
      console.error('[AutoCorrection] Error generating correction:', error);
      throw error;
    }
  }

  /**
   * Analyser une erreur pour déterminer le type
   */
  analyzeError(error: string): {
    type: string;
    severity: 'low' | 'medium' | 'high';
    recoverable: boolean;
    suggestion?: string;
  } {
    // Erreurs de syntaxe
    if (error.includes('SyntaxError') || error.includes('syntax error')) {
      return {
        type: 'syntax_error',
        severity: 'high',
        recoverable: true,
        suggestion: 'Vérifier la syntaxe du code',
      };
    }
    
    // Erreurs d'importation
    if (error.includes('ImportError') || error.includes('ModuleNotFoundError') || error.includes('Cannot find module')) {
      return {
        type: 'import_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Installer le module manquant',
      };
    }
    
    // Erreurs de type
    if (error.includes('TypeError') || error.includes('type error')) {
      return {
        type: 'type_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Vérifier les types de données',
      };
    }
    
    // Erreurs de valeur
    if (error.includes('ValueError') || error.includes('value error')) {
      return {
        type: 'value_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Vérifier les valeurs utilisées',
      };
    }
    
    // Erreurs d'index
    if (error.includes('IndexError') || error.includes('index out of range')) {
      return {
        type: 'index_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Vérifier les limites des tableaux',
      };
    }
    
    // Erreurs de clé
    if (error.includes('KeyError') || error.includes('key error')) {
      return {
        type: 'key_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Vérifier les clés du dictionnaire',
      };
    }
    
    // Erreurs de fichier
    if (error.includes('FileNotFoundError') || error.includes('file not found')) {
      return {
        type: 'file_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Vérifier le chemin du fichier',
      };
    }
    
    // Erreurs de permission
    if (error.includes('PermissionError') || error.includes('permission denied')) {
      return {
        type: 'permission_error',
        severity: 'high',
        recoverable: false,
        suggestion: 'Vérifier les permissions d\'accès',
      };
    }
    
    // Erreurs de timeout
    if (error.includes('TimeoutError') || error.includes('timeout')) {
      return {
        type: 'timeout_error',
        severity: 'medium',
        recoverable: true,
        suggestion: 'Optimiser le code ou augmenter le timeout',
      };
    }
    
    // Erreurs inconnues
    return {
      type: 'unknown_error',
      severity: 'high',
      recoverable: false,
      suggestion: 'Erreur inconnue',
    };
  }

  /**
   * Déterminer si une correction est possible
   */
  canRecover(error: string, attemptCount: number): boolean {
    const analysis = this.analyzeError(error);
    
    // Si l'erreur n'est pas récupérable, arrêter
    if (!analysis.recoverable) {
      return false;
    }
    
    // Si on a atteint le nombre max d'itérations, arrêter
    if (attemptCount >= this.maxIterations) {
      return false;
    }
    
    return true;
  }

  /**
   * Obtenir les détails d'une session
   */
  getSession(sessionId: string): CorrectionSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Terminer une session
   */
  completeSession(sessionId: string, status: 'completed' | 'failed'): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      console.log('[AutoCorrection] Completed session:', sessionId, 'with status:', status);
    }
  }

  /**
   * Obtenir les statistiques d'une session
   */
  getSessionStats(sessionId: string): Record<string, any> | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    const successfulIterations = session.iterations.filter(i => i.success).length;
    const failedIterations = session.iterations.filter(i => !i.success).length;
    
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      originalRequest: session.originalRequest,
      totalIterations: session.iterations.length,
      successfulIterations,
      failedIterations,
      status: session.status,
      createdAt: session.createdAt,
      duration: Date.now() - session.createdAt,
      iterations: session.iterations.map(i => ({
        iteration: i.iteration,
        success: i.success,
        error: i.error,
        timestamp: i.timestamp,
      })),
    };
  }

  /**
   * Obtenir les statistiques globales
   */
  getStats(): Record<string, any> {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const failedSessions = sessions.filter(s => s.status === 'failed').length;
    const totalIterations = sessions.reduce((sum, s) => sum + s.iterations.length, 0);
    
    return {
      totalSessions: sessions.length,
      completedSessions,
      failedSessions,
      totalIterations,
      averageIterationsPerSession: sessions.length > 0 ? totalIterations / sessions.length : 0,
      maxIterations: this.maxIterations,
    };
  }
}

// Export singleton instance
export const autoCorrection = new AutoCorrectionManager();
