/**
 * Direct Code Executor
 * Exécute le code directement si détecté, sans passer par les tools
 * Cela résout le problème où Google AI ne peut pas utiliser les tools
 */

import { detectCodeExecutionNeed } from './codeDetector';
import { executeCodeFromGroq } from './codeInterpreterTool';
import { validateCodeSafety } from './codeDetector';

export interface DirectCodeExecutionResult {
  executed: boolean;
  language?: 'python' | 'javascript';
  output?: string;
  error?: string;
  executionTime?: number;
}

/**
 * Extrait le code d'un message utilisateur
 */
export function extractCodeFromMessage(message: string): string | null {
  // Pattern pour les blocs de code avec ``` - handle different line endings
  const codeBlockMatch = message.match(/```(?:python|javascript|js)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch && codeBlockMatch[1].trim()) {
    return codeBlockMatch[1].trim();
  }

  // Pattern pour les blocs de code sans langage spécifié
  const genericCodeMatch = message.match(/```\s*\n?([\s\S]*?)\n?```/);
  if (genericCodeMatch && genericCodeMatch[1].trim()) {
    return genericCodeMatch[1].trim();
  }

  // Pattern pour le code inline
  const inlineMatch = message.match(/`([^`]+)`/);
  if (inlineMatch && inlineMatch[1].trim()) {
    return inlineMatch[1].trim();
  }

  return null;
}

/**
 * Détecte et exécute le code directement si présent
 */
export async function executeCodeDirectly(
  userMessage: string,
  userId: string = 'direct-execution'
): Promise<DirectCodeExecutionResult> {
  try {
    // Déterminer si du code doit être exécuté
    const detection = detectCodeExecutionNeed(userMessage);
    console.log('[DirectCodeExecutor] Detection:', detection);
    
    if (!detection.shouldExecuteCode) {
      console.log('[DirectCodeExecutor] No code execution needed');
      return { executed: false };
    }

    // Essayer d'extraire le code du message
    const extractedCode = extractCodeFromMessage(userMessage);
    console.log('[DirectCodeExecutor] Extracted code:', extractedCode ? extractedCode.substring(0, 50) : 'null');
    
    if (!extractedCode) {
      // Pas de code trouvé, mais la détection pense qu'il en faut
      // Cela signifie que l'utilisateur demande du code mais ne l'a pas fourni
      return { executed: false };
    }

    // Valider la sécurité du code
    const language = detection.language || 'python';
    const validation = validateCodeSafety(extractedCode, language);
    
    if (!validation.safe) {
      return {
        executed: false,
        error: `Code validation failed: ${validation.issues.join(', ')}`
      };
    }

    // Exécuter le code
    console.log('[DirectCodeExecutor] Executing code directly:', { language, codeLength: extractedCode.length });
    
    const result = await executeCodeFromGroq({
      language,
      code: extractedCode,
      userId,
      username: 'direct-executor'
    });

    return {
      executed: true,
      language,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime
    };
  } catch (error) {
    console.error('[DirectCodeExecutor] Error:', error);
    return {
      executed: false,
      error: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Crée une réponse formatée pour le code exécuté
 */
export function formatCodeExecutionResponse(result: DirectCodeExecutionResult): string {
  if (!result.executed) {
    return '';
  }

  if (result.error) {
    return `❌ **Erreur lors de l'exécution du code ${result.language}:**\n\n${result.error}`;
  }

  return `✅ **Résultat de l'exécution ${result.language} (${result.executionTime}ms):**\n\n${result.output}`;
}
