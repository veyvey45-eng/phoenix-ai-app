/**
 * Smart Error Corrector - Correction Intelligente d'Erreurs pour Phoenix
 * 
 * Ce module analyse les erreurs de code et propose des corrections automatiques,
 * similaire à la capacité de Manus à corriger intelligemment les erreurs.
 */

import { invokeLLM } from '../_core/llm';
import { e2bSandbox } from './e2bSandbox';

// Types
export interface ErrorAnalysis {
  errorType: string;
  errorMessage: string;
  lineNumber?: number;
  suggestedFix: string;
  confidence: number;
  explanation: string;
}

export interface CorrectionResult {
  success: boolean;
  originalCode: string;
  correctedCode: string;
  errorAnalysis: ErrorAnalysis;
  attempts: number;
  finalOutput?: string;
  finalError?: string;
}

export interface ErrorPattern {
  pattern: RegExp;
  errorType: string;
  fixStrategy: string;
  priority: number;
}

// Patterns d'erreurs connus avec stratégies de correction
const ERROR_PATTERNS: ErrorPattern[] = [
  // Python Errors
  {
    pattern: /SyntaxError: invalid syntax/i,
    errorType: 'syntax',
    fixStrategy: 'Vérifier la syntaxe Python: parenthèses, deux-points, indentation',
    priority: 1
  },
  {
    pattern: /IndentationError/i,
    errorType: 'indentation',
    fixStrategy: 'Corriger l\'indentation (utiliser 4 espaces par niveau)',
    priority: 1
  },
  {
    pattern: /NameError: name '(\w+)' is not defined/i,
    errorType: 'undefined_variable',
    fixStrategy: 'Définir la variable ou importer le module manquant',
    priority: 2
  },
  {
    pattern: /ModuleNotFoundError: No module named '(\w+)'/i,
    errorType: 'missing_module',
    fixStrategy: 'Installer le module avec pip install',
    priority: 2
  },
  {
    pattern: /TypeError: .* takes (\d+) positional arguments? but (\d+) (?:was|were) given/i,
    errorType: 'argument_count',
    fixStrategy: 'Ajuster le nombre d\'arguments de la fonction',
    priority: 2
  },
  {
    pattern: /TypeError: unsupported operand type/i,
    errorType: 'type_mismatch',
    fixStrategy: 'Convertir les types de données correctement',
    priority: 2
  },
  {
    pattern: /IndexError: list index out of range/i,
    errorType: 'index_error',
    fixStrategy: 'Vérifier les indices de liste et ajouter des vérifications de limites',
    priority: 2
  },
  {
    pattern: /KeyError: '(\w+)'/i,
    errorType: 'key_error',
    fixStrategy: 'Vérifier que la clé existe dans le dictionnaire',
    priority: 2
  },
  {
    pattern: /ZeroDivisionError/i,
    errorType: 'division_zero',
    fixStrategy: 'Ajouter une vérification pour éviter la division par zéro',
    priority: 2
  },
  {
    pattern: /FileNotFoundError/i,
    errorType: 'file_not_found',
    fixStrategy: 'Vérifier le chemin du fichier ou créer le fichier',
    priority: 2
  },
  {
    pattern: /AttributeError: '(\w+)' object has no attribute '(\w+)'/i,
    errorType: 'attribute_error',
    fixStrategy: 'Vérifier l\'attribut ou la méthode de l\'objet',
    priority: 2
  },
  {
    pattern: /ValueError/i,
    errorType: 'value_error',
    fixStrategy: 'Vérifier les valeurs passées aux fonctions',
    priority: 2
  },
  // JavaScript Errors
  {
    pattern: /ReferenceError: (\w+) is not defined/i,
    errorType: 'js_undefined',
    fixStrategy: 'Déclarer la variable ou importer le module',
    priority: 2
  },
  {
    pattern: /TypeError: Cannot read propert(?:y|ies) .* of (undefined|null)/i,
    errorType: 'js_null_access',
    fixStrategy: 'Ajouter une vérification null/undefined avant l\'accès',
    priority: 2
  },
  {
    pattern: /SyntaxError: Unexpected token/i,
    errorType: 'js_syntax',
    fixStrategy: 'Vérifier la syntaxe JavaScript: accolades, virgules, points-virgules',
    priority: 1
  }
];

// Historique des erreurs pour apprentissage
const errorHistory: Map<string, { count: number; lastFix: string; success: boolean }> = new Map();

/**
 * Classe principale de correction intelligente
 */
class SmartErrorCorrectorService {
  private maxAttempts: number = 5;
  private learningEnabled: boolean = true;

  /**
   * Analyse une erreur et identifie son type
   */
  analyzeError(error: string, code: string): ErrorAnalysis {
    // Chercher un pattern connu
    for (const pattern of ERROR_PATTERNS) {
      const match = error.match(pattern.pattern);
      if (match) {
        // Extraire le numéro de ligne si disponible
        const lineMatch = error.match(/line (\d+)/i);
        const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;

        return {
          errorType: pattern.errorType,
          errorMessage: error,
          lineNumber,
          suggestedFix: pattern.fixStrategy,
          confidence: 0.8,
          explanation: `Erreur de type "${pattern.errorType}" détectée. ${pattern.fixStrategy}`
        };
      }
    }

    // Erreur inconnue - analyse générique
    return {
      errorType: 'unknown',
      errorMessage: error,
      suggestedFix: 'Analyser l\'erreur et corriger le code',
      confidence: 0.5,
      explanation: 'Erreur non reconnue, analyse LLM nécessaire'
    };
  }

  /**
   * Génère une correction via LLM
   */
  async generateCorrection(
    code: string,
    error: string,
    language: 'python' | 'javascript',
    analysis: ErrorAnalysis
  ): Promise<string> {
    const systemPrompt = `Tu es un expert en débogage ${language === 'python' ? 'Python' : 'JavaScript'}.
Tu dois corriger le code suivant qui produit une erreur.

RÈGLES IMPORTANTES:
1. Retourne UNIQUEMENT le code corrigé, sans explications
2. Ne modifie que ce qui est nécessaire pour corriger l'erreur
3. Garde le même style et la même logique
4. Si un module est manquant, ajoute l'import au début
5. Assure-toi que le code est syntaxiquement correct

Type d'erreur détecté: ${analysis.errorType}
Stratégie suggérée: ${analysis.suggestedFix}`;

    const userPrompt = `CODE ORIGINAL:
\`\`\`${language}
${code}
\`\`\`

ERREUR:
${error}

Retourne le code corrigé:`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });

      const rawContent = response.choices[0]?.message?.content || '';
      const content = typeof rawContent === 'string' ? rawContent : '';
      
      // Extraire le code du markdown si présent
      const codeMatch = content.match(/```(?:python|javascript|js)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        return codeMatch[1].trim();
      }
      
      // Sinon retourner le contenu brut nettoyé
      return content.trim();
    } catch (error) {
      console.error('[SmartErrorCorrector] Erreur LLM:', error);
      return code; // Retourner le code original en cas d'échec
    }
  }

  /**
   * Tente de corriger et réexécuter le code
   */
  async correctAndExecute(
    code: string,
    error: string,
    language: 'python' | 'javascript',
    userId: string,
    sessionId: string
  ): Promise<CorrectionResult> {
    let currentCode = code;
    let currentError = error;
    let attempts = 0;

    console.log(`[SmartErrorCorrector] Début correction pour ${language}`);
    console.log(`[SmartErrorCorrector] Erreur initiale: ${error.substring(0, 200)}`);

    while (attempts < this.maxAttempts) {
      attempts++;
      console.log(`[SmartErrorCorrector] Tentative ${attempts}/${this.maxAttempts}`);

      // Analyser l'erreur
      const analysis = this.analyzeError(currentError, currentCode);
      console.log(`[SmartErrorCorrector] Type d'erreur: ${analysis.errorType}`);

      // Générer la correction
      const correctedCode = await this.generateCorrection(
        currentCode,
        currentError,
        language,
        analysis
      );

      // Si le code n'a pas changé, arrêter
      if (correctedCode === currentCode) {
        console.log('[SmartErrorCorrector] Code identique, arrêt');
        return {
          success: false,
          originalCode: code,
          correctedCode: currentCode,
          errorAnalysis: analysis,
          attempts,
          finalError: currentError
        };
      }

      // Exécuter le code corrigé
      console.log('[SmartErrorCorrector] Exécution du code corrigé...');
      const result = language === 'python'
        ? await e2bSandbox.executePython(correctedCode, userId, sessionId)
        : await e2bSandbox.executeJavaScript(correctedCode, userId, sessionId);

      if (result.success) {
        console.log('[SmartErrorCorrector] Correction réussie!');
        
        // Enregistrer le succès pour apprentissage
        if (this.learningEnabled) {
          this.recordSuccess(analysis.errorType, correctedCode);
        }

        return {
          success: true,
          originalCode: code,
          correctedCode,
          errorAnalysis: analysis,
          attempts,
          finalOutput: result.output
        };
      }

      // Mettre à jour pour la prochaine itération
      currentCode = correctedCode;
      currentError = result.error || 'Erreur inconnue';
      console.log(`[SmartErrorCorrector] Nouvelle erreur: ${currentError.substring(0, 200)}`);
    }

    // Échec après toutes les tentatives
    const finalAnalysis = this.analyzeError(currentError, currentCode);
    
    return {
      success: false,
      originalCode: code,
      correctedCode: currentCode,
      errorAnalysis: finalAnalysis,
      attempts,
      finalError: currentError
    };
  }

  /**
   * Enregistre un succès pour apprentissage
   */
  private recordSuccess(errorType: string, fix: string): void {
    const key = errorType;
    const existing = errorHistory.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastFix = fix;
      existing.success = true;
    } else {
      errorHistory.set(key, { count: 1, lastFix: fix, success: true });
    }
  }

  /**
   * Obtient des statistiques sur les corrections
   */
  getStats(): {
    totalPatterns: number;
    learnedFixes: number;
    successRate: number;
  } {
    let successCount = 0;
    let totalCount = 0;

    errorHistory.forEach((value) => {
      totalCount += value.count;
      if (value.success) successCount += value.count;
    });

    return {
      totalPatterns: ERROR_PATTERNS.length,
      learnedFixes: errorHistory.size,
      successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0
    };
  }

  /**
   * Réinitialise l'historique d'apprentissage
   */
  resetLearning(): void {
    errorHistory.clear();
    console.log('[SmartErrorCorrector] Historique d\'apprentissage réinitialisé');
  }
}

// Export singleton
export const smartErrorCorrector = new SmartErrorCorrectorService();

// Export pour tests
export { ERROR_PATTERNS, errorHistory };
