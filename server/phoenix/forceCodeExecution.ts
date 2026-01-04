/**
 * Force Code Execution Module
 * Oblige Phoenix à exécuter le code qu'il génère, pas le simuler
 * 
 * Flux:
 * 1. Utilisateur demande du code
 * 2. Phoenix génère le code
 * 3. Ce module EXTRAIT le code de la réponse de Phoenix
 * 4. Ce module EXÉCUTE le code réellement via E2B
 * 5. Ce module REMPLACE la réponse simulée par les résultats réels
 */

import { executeCodeFromGroq } from './codeInterpreterTool';

/**
 * Extrait le code d'une réponse Phoenix
 */
export function extractCodeFromPhoenixResponse(response: string): Array<{
  language: 'python' | 'javascript';
  code: string;
}> {
  const codeBlocks: Array<{ language: 'python' | 'javascript'; code: string }> = [];

  // Pattern pour les blocs Python (avec ou sans newline avant la fermeture)
  const pythonMatches = Array.from(response.matchAll(/```python\s*\n([\s\S]*?)\n?```/g));
  for (const match of pythonMatches) {
    const code = match[1].trim();
    if (code) {
      codeBlocks.push({
        language: 'python',
        code,
      });
    }
  }

  // Pattern pour les blocs JavaScript
  const jsMatches = Array.from(response.matchAll(/```(?:javascript|js)\s*\n([\s\S]*?)\n?```/g));
  for (const match of jsMatches) {
    const code = match[1].trim();
    if (code) {
      codeBlocks.push({
        language: 'javascript',
        code,
      });
    }
  }

  // Pattern générique pour les blocs sans langage
  const genericMatches = Array.from(response.matchAll(/```\s*\n([\s\S]*?)\n?```/g));
  for (const match of genericMatches) {
    const code = match[1].trim();
    if (code) {
      // Essayer de déterminer le langage
      if (code.includes('import ') || code.includes('print(') || code.includes('def ') || code.includes('#')) {
        // Vérifier que ce n'est pas déjà ajouté
        if (!codeBlocks.some(b => b.code === code)) {
          codeBlocks.push({
            language: 'python',
            code,
          });
        }
      } else if (code.includes('console.log') || code.includes('const ') || code.includes('let ') || code.includes('function ')) {
        if (!codeBlocks.some(b => b.code === code)) {
          codeBlocks.push({
            language: 'javascript',
            code,
          });
        }
      }
    }
  }

  return codeBlocks;
}

/**
 * Exécute tous les blocs de code trouvés dans la réponse
 */
export async function executeAllCodeBlocks(
  response: string,
  userId: string = 'phoenix'
): Promise<Array<{
  language: 'python' | 'javascript';
  code: string;
  output?: string;
  error?: string;
  executionTime?: number;
}>> {
  const codeBlocks = extractCodeFromPhoenixResponse(response);
  console.log('[ForceCodeExecution] Found code blocks:', codeBlocks.length);

  const results = [];

  for (const block of codeBlocks) {
    try {
      console.log(`[ForceCodeExecution] Executing ${block.language} code (${block.code.length} chars)`);
      const result = await executeCodeFromGroq({
        language: block.language,
        code: block.code,
        userId,
        username: 'phoenix-auto-executor',
      });

      results.push({
        language: block.language,
        code: block.code,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
      });
    } catch (error) {
      console.error(`[ForceCodeExecution] Error executing ${block.language}:`, error);
      results.push({
        language: block.language,
        code: block.code,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Remplace les résultats simulés par les résultats réels
 */
export function replaceSimulatedWithRealResults(
  response: string,
  executionResults: Array<{
    language: 'python' | 'javascript';
    code: string;
    output?: string;
    error?: string;
    executionTime?: number;
  }>
): string {
  let result = response;

  // Remplacer les sections "Exécution simulée" par les résultats réels
  for (const execResult of executionResults) {
    if (execResult.error) {
      // Remplacer par une erreur réelle
      const errorMessage = `❌ **Erreur lors de l'exécution du code ${execResult.language}:**\n\n${execResult.error}`;
      result = result.replace(
        /Exécution simulée \(Output\)[\s\S]*?(?=\n\n|$)/,
        `✅ **Résultat RÉEL de l'exécution ${execResult.language} (${execResult.executionTime}ms):**\n\n${errorMessage}`
      );
    } else if (execResult.output) {
      // Remplacer par le résultat réel
      result = result.replace(
        /Exécution simulée \(Output\)[\s\S]*?(?=\n\n|$)/,
        `✅ **Résultat RÉEL de l'exécution ${execResult.language} (${execResult.executionTime}ms):**\n\n${execResult.output}`
      );
    }
  }

  // Remplacer "simulée" par "RÉELLE"
  result = result.replace(/Exécution simulée/g, 'Exécution RÉELLE');
  result = result.replace(/simuler et vous montrer/g, 'exécuter RÉELLEMENT');
  result = result.replace(/Je peux seulement simuler/g, 'Je peux exécuter RÉELLEMENT');

  return result;
}

/**
 * Flux complet: Exécute le code de la réponse et remplace les résultats simulés
 */
export async function forceRealCodeExecution(
  response: string,
  userId: string = 'phoenix'
): Promise<string> {
  try {
    console.log('[ForceCodeExecution] Starting real code execution');

    // Exécuter tous les blocs de code
    const executionResults = await executeAllCodeBlocks(response, userId);

    if (executionResults.length === 0) {
      console.log('[ForceCodeExecution] No code blocks found');
      return response;
    }

    console.log('[ForceCodeExecution] Execution results:', executionResults.length);

    // Remplacer les résultats simulés par les résultats réels
    const updatedResponse = replaceSimulatedWithRealResults(response, executionResults);

    return updatedResponse;
  } catch (error) {
    console.error('[ForceCodeExecution] Error:', error);
    // En cas d'erreur, retourner la réponse originale
    return response;
  }
}
