/**
 * Visible Auto-Correction Module
 * 
 * Ce module permet à Phoenix de:
 * 1. Détecter les erreurs dans le code généré
 * 2. AFFICHER clairement l'erreur détectée à l'utilisateur
 * 3. Générer une correction et l'EXPLIQUER
 * 4. Réessayer avec le code corrigé
 * 5. Montrer le processus complet de correction
 */

import { invokeLLM } from '../_core/llm';
import { executeCode } from './smartCodeExecutor';

// Configuration
const CONFIG = {
  maxRetries: 3,
  showCorrectionProcess: true,
};

// Types
export interface CorrectionStep {
  step: number;
  type: 'error_detected' | 'analyzing' | 'correction_applied' | 'retry' | 'success' | 'final_failure';
  message: string;
  details?: {
    originalCode?: string;
    correctedCode?: string;
    error?: string;
    explanation?: string;
  };
}

export interface VisibleCorrectionResult {
  success: boolean;
  finalCode?: string;
  finalOutput?: string;
  correctionSteps: CorrectionStep[];
  totalAttempts: number;
  wasAutoCorrected: boolean;
  formattedResponse: string;
}

/**
 * Analyse une erreur d'exécution et génère une correction
 */
async function analyzeErrorAndCorrect(
  code: string,
  error: string,
  language: 'python' | 'javascript',
  userRequest: string,
  previousAttempts: number
): Promise<{ correctedCode: string; explanation: string } | null> {
  const systemPrompt = `Tu es un expert en débogage ${language}. Analyse l'erreur et corrige le code.

ERREUR RENCONTRÉE:
${error}

CODE ORIGINAL:
\`\`\`${language}
${code}
\`\`\`

DEMANDE UTILISATEUR:
${userRequest}

TENTATIVES PRÉCÉDENTES: ${previousAttempts}

RÈGLES STRICTES:
1. Identifie la CAUSE EXACTE de l'erreur
2. Corrige le code pour qu'il fonctionne
3. Garde la même logique/objectif
4. Ajoute les imports manquants si nécessaire
5. Gère les cas d'erreur (try/except, validation)
6. NE CHANGE PAS l'objectif du code

Réponds UNIQUEMENT avec un JSON:
{
  "correctedCode": "le code corrigé complet",
  "explanation": "Explication courte de la correction en français"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Corrige ce code qui a produit l'erreur: ${error}` }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      if (parsed.correctedCode && parsed.explanation) {
        return {
          correctedCode: parsed.correctedCode,
          explanation: parsed.explanation
        };
      }
    }
  } catch (e) {
    console.error('[VisibleAutoCorrection] Erreur analyse:', e);
  }

  return null;
}

/**
 * Exécute du code avec auto-correction VISIBLE
 */
export async function executeWithVisibleAutoCorrection(
  code: string,
  language: 'python' | 'javascript',
  userRequest: string
): Promise<VisibleCorrectionResult> {
  const correctionSteps: CorrectionStep[] = [];
  let currentCode = code;
  let wasAutoCorrected = false;

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    console.log(`[VisibleAutoCorrection] Tentative ${attempt}/${CONFIG.maxRetries}`);

    // Exécuter le code
    const result = await executeCode(currentCode, language);

    if (result.success && result.output && !result.error) {
      // Succès!
      if (wasAutoCorrected) {
        correctionSteps.push({
          step: correctionSteps.length + 1,
          type: 'success',
          message: `✅ Code corrigé exécuté avec succès!`,
          details: {
            correctedCode: currentCode
          }
        });
      }

      return {
        success: true,
        finalCode: currentCode,
        finalOutput: result.output,
        correctionSteps,
        totalAttempts: attempt,
        wasAutoCorrected,
        formattedResponse: formatSuccessResponse(currentCode, result.output, result.executionTime, correctionSteps, wasAutoCorrected, language)
      };
    }

    // Erreur détectée
    const errorMessage = result.error || 'Erreur inconnue lors de l\'exécution';
    
    correctionSteps.push({
      step: correctionSteps.length + 1,
      type: 'error_detected',
      message: `⚠️ Erreur détectée (tentative ${attempt}/${CONFIG.maxRetries})`,
      details: {
        originalCode: currentCode,
        error: errorMessage
      }
    });

    // Si c'est la dernière tentative, abandonner
    if (attempt === CONFIG.maxRetries) {
      correctionSteps.push({
        step: correctionSteps.length + 1,
        type: 'final_failure',
        message: `❌ Échec après ${attempt} tentatives de correction`
      });
      break;
    }

    // Analyser et corriger
    correctionSteps.push({
      step: correctionSteps.length + 1,
      type: 'analyzing',
      message: `🔍 Analyse de l'erreur en cours...`
    });

    const correction = await analyzeErrorAndCorrect(
      currentCode,
      errorMessage,
      language,
      userRequest,
      attempt
    );

    if (correction) {
      wasAutoCorrected = true;
      currentCode = correction.correctedCode;

      correctionSteps.push({
        step: correctionSteps.length + 1,
        type: 'correction_applied',
        message: `🔧 Correction appliquée: ${correction.explanation}`,
        details: {
          originalCode: code,
          correctedCode: correction.correctedCode,
          explanation: correction.explanation
        }
      });

      correctionSteps.push({
        step: correctionSteps.length + 1,
        type: 'retry',
        message: `🔄 Nouvelle tentative avec le code corrigé...`
      });
    } else {
      // Impossible de corriger
      correctionSteps.push({
        step: correctionSteps.length + 1,
        type: 'final_failure',
        message: `❌ Impossible de générer une correction automatique`
      });
      break;
    }
  }

  // Échec final
  return {
    success: false,
    finalCode: currentCode,
    correctionSteps,
    totalAttempts: CONFIG.maxRetries,
    wasAutoCorrected,
    formattedResponse: formatFailureResponse(code, correctionSteps, language)
  };
}

/**
 * Formate la réponse en cas de succès
 */
function formatSuccessResponse(
  code: string,
  output: string,
  executionTime: number | undefined,
  steps: CorrectionStep[],
  wasAutoCorrected: boolean,
  language: string
): string {
  let response = '';

  // Si auto-correction a eu lieu, montrer le processus
  if (wasAutoCorrected && steps.length > 0) {
    response += `### 🔄 Auto-Correction Appliquée\n\n`;
    
    for (const step of steps) {
      if (step.type === 'error_detected') {
        response += `**${step.message}**\n`;
        if (step.details?.error) {
          response += `\`\`\`\n${step.details.error}\n\`\`\`\n\n`;
        }
      } else if (step.type === 'correction_applied') {
        response += `**${step.message}**\n\n`;
      }
    }
    
    response += `---\n\n`;
  }

  response += `**Code ${wasAutoCorrected ? 'corrigé et ' : ''}exécuté:**\n\n`;
  response += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  response += `✅ **Résultat RÉEL de l'exécution${executionTime ? ` (${executionTime}ms)` : ''}:**\n\n`;
  response += `\`\`\`\n${output}\n\`\`\``;

  return response;
}

/**
 * Formate la réponse en cas d'échec
 */
function formatFailureResponse(
  originalCode: string,
  steps: CorrectionStep[],
  language: string
): string {
  let response = `### ❌ Échec de l'exécution\n\n`;
  
  response += `**Code original:**\n\n`;
  response += `\`\`\`${language}\n${originalCode}\n\`\`\`\n\n`;
  
  response += `**Historique des tentatives de correction:**\n\n`;
  
  for (const step of steps) {
    response += `${step.message}\n`;
    if (step.details?.error) {
      response += `> Erreur: ${step.details.error.substring(0, 200)}...\n`;
    }
    if (step.details?.explanation) {
      response += `> Correction: ${step.details.explanation}\n`;
    }
    response += `\n`;
  }

  response += `\n💡 **Suggestion:** Vérifiez la syntaxe du code ou reformulez votre demande.`;

  return response;
}

/**
 * Vérifie si un code contient des erreurs de syntaxe évidentes
 */
export function detectSyntaxIssues(code: string, language: 'python' | 'javascript'): {
  hasIssues: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (language === 'python') {
    // Vérifier les parenthèses non fermées
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push('Parenthèses non équilibrées');
    }

    // Vérifier les deux-points manquants après for/if/while/def
    if (/\b(for|if|while|def|class|elif|else|try|except|finally|with)\b[^:]*$/.test(code)) {
      issues.push('Deux-points manquants après une instruction de contrôle');
    }

    // Vérifier les guillemets non fermés
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
      issues.push('Guillemets non fermés');
    }
  }

  if (language === 'javascript') {
    // Vérifier les accolades
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push('Accolades non équilibrées');
    }

    // Vérifier les points-virgules manquants (basique)
    if (/\bconst\b.*[^;{]\s*$/.test(code) || /\blet\b.*[^;{]\s*$/.test(code)) {
      issues.push('Point-virgule potentiellement manquant');
    }
  }

  return {
    hasIssues: issues.length > 0,
    issues
  };
}

export default {
  executeWithVisibleAutoCorrection,
  detectSyntaxIssues
};
