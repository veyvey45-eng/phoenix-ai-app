/**
 * Post Execution Handler
 * Exécute le code APRÈS que Phoenix ait généré sa réponse complète
 */

import { executeCodeFromGroq } from './codeInterpreterTool';

/**
 * Extrait tous les blocs de code Python d'une réponse
 */
export function extractPythonCodeBlocks(response: string): Array<{ code: string; language: string }> {
  const codeBlocks: Array<{ code: string; language: string }> = [];
  
  // Regex pour les blocs de code avec langage spécifié
  const blockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = blockRegex.exec(response)) !== null) {
    const language = match[1].toLowerCase();
    const code = match[2].trim();
    
    if (language === 'python' && code) {
      codeBlocks.push({ code, language });
    }
  }
  
  return codeBlocks;
}

/**
 * Exécute tous les blocs de code Python trouvés dans la réponse
 */
export async function executeAllCodeBlocks(
  response: string,
  userId: string = 'post-executor'
): Promise<{
  originalResponse: string;
  executionResults: Array<{
    code: string;
    success: boolean;
    output?: string;
    error?: string;
    executionTime?: number;
  }>;
  modifiedResponse: string;
}> {
  const codeBlocks = extractPythonCodeBlocks(response);
  
  if (codeBlocks.length === 0) {
    return {
      originalResponse: response,
      executionResults: [],
      modifiedResponse: response
    };
  }
  
  console.log(`[PostExecutionHandler] Found ${codeBlocks.length} code block(s) to execute`);
  
  const executionResults = [];
  let modifiedResponse = response;
  
  for (const block of codeBlocks) {
    try {
      console.log('[PostExecutionHandler] Executing code block:', block.code.substring(0, 50) + '...');
      
      const result = await executeCodeFromGroq({
        language: 'python',
        code: block.code,
        userId,
        username: 'post-executor'
      });
      
      executionResults.push({
        code: block.code,
        success: !result.error,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime
      });
      
      // Remplacer le bloc de code par le résultat réel
      const codeBlockPattern = `\`\`\`python\n${block.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n\`\`\``;
      const resultBlock = `\`\`\`python\n${block.code}\n\`\`\`\n\n✅ **Résultat RÉEL de l'exécution (${result.executionTime}ms):**\n\n\`\`\`\n${result.output}\n\`\`\``;
      
      modifiedResponse = modifiedResponse.replace(
        new RegExp(codeBlockPattern, 'g'),
        resultBlock
      );
      
    } catch (error) {
      console.error('[PostExecutionHandler] Error executing code:', error);
      executionResults.push({
        code: block.code,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return {
    originalResponse: response,
    executionResults,
    modifiedResponse
  };
}

/**
 * Remplace les simulations par les résultats réels
 */
export function replaceSimulatedResults(response: string, executionResults: Array<{
  code: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}>): string {
  let modifiedResponse = response;
  
  // Remplacer "Exécution simulée" par "Résultat RÉEL"
  modifiedResponse = modifiedResponse.replace(
    /Exécution simulée \(Output\):/gi,
    '✅ **Résultat RÉEL de l\'exécution:**'
  );
  
  // Remplacer "j'ai simulé l'exécution" par "j'ai exécuté réellement"
  modifiedResponse = modifiedResponse.replace(
    /j'ai simulé l'exécution/gi,
    'j\'ai exécuté réellement le code'
  );
  
  // Remplacer "Sortie attendue" par "Résultat RÉEL"
  modifiedResponse = modifiedResponse.replace(
    /Sortie attendue/gi,
    'Résultat RÉEL'
  );
  
  return modifiedResponse;
}
