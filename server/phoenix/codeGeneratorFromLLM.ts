/**
 * Code Generator from LLM Module
 * Demande à Google AI de générer du code APPROPRIÉ basé sur la question de l'utilisateur
 * Puis exécute ce code réellement via E2B Sandbox
 */

import { invokeLLM } from '../_core/llm';
import { executeCodeFromGroq } from './codeInterpreterTool';

/**
 * Demande à Google AI de générer du code approprié pour la question
 */
export async function generateCodeFromLLM(
  userMessage: string,
  language: 'python' | 'javascript' = 'python'
): Promise<string | null> {
  try {
    console.log('[CodeGeneratorFromLLM] Generating code for:', userMessage);
    
    const prompt = `L'utilisateur demande: "${userMessage}"

Tu DOIS générer du code ${language} qui répond EXACTEMENT à cette demande.

RÈGLES STRICTES:
1. Le code doit être COMPLET et EXÉCUTABLE immédiatement
2. Le code doit utiliser print() pour afficher les résultats
3. Retourne UNIQUEMENT le code, SANS explications
4. Entoure le code avec les balises \`\`\`${language}\`\`\`
5. Ne mets RIEN d'autre que le code entre les balises

EXEMPLE DE FORMAT REQUIS:
\`\`\`${language}
# Ton code ici
result = 5 + 3
print(result)
\`\`\``;

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en programmation. Tu génères du code EXÉCUTABLE. Tu retournes UNIQUEMENT le code entre balises ```python``` ou ```javascript```, SANS explications.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let contentRaw = response.choices?.[0]?.message?.content;
    const content = typeof contentRaw === 'string' ? contentRaw : '';

    if (!content) {
      console.warn('[CodeGeneratorFromLLM] Empty response from LLM');
      return null;
    }

    console.log('[CodeGeneratorFromLLM] Raw response:', content.substring(0, 200));

    // Extraire le code entre les balises ``` (très flexible)
    // Cherche d'abord ```python ou ```javascript
    let codeMatch = content.match(/```(?:python|javascript|py|js)?\s*\n([\s\S]*?)\n```/);
    
    if (!codeMatch) {
      // Essayer sans le \n avant les balises
      codeMatch = content.match(/```(?:python|javascript|py|js)?([\s\S]*?)```/);
    }

    if (codeMatch) {
      const code = codeMatch[1].trim();
      console.log('[CodeGeneratorFromLLM] Extracted code:', code.substring(0, 150));
      return code;
    }

    // Si pas de balises, essayer de trouver du code Python/JavaScript dans le texte
    // Chercher des patterns comme "def ", "import ", "print(", "function ", "console.log"
    const pythonMatch = content.match(/((?:import|from|def|class|print|for|while|if|try)[\s\S]*?)(?:\n\n|$)/);
    if (pythonMatch) {
      const code = pythonMatch[1].trim();
      if (code.length > 10) {
        console.log('[CodeGeneratorFromLLM] Extracted Python from text:', code.substring(0, 150));
        return code;
      }
    }

    // Fallback: retourner le contenu brut si c'est du code
    if (content.includes('print(') || content.includes('def ') || content.includes('import ')) {
      console.log('[CodeGeneratorFromLLM] Using raw content as code');
      return content.trim();
    }

    console.warn('[CodeGeneratorFromLLM] Could not extract code from response');
    console.log('[CodeGeneratorFromLLM] Full response:', content);
    return null;
  } catch (error) {
    console.error('[CodeGeneratorFromLLM] Error generating code:', error);
    return null;
  }
}

/**
 * Génère et exécute du code pour une question
 */
export async function generateAndExecuteCode(
  userMessage: string,
  language: 'python' | 'javascript' = 'python',
  userId: string = 'code-generator'
): Promise<{
  success: boolean;
  code?: string;
  output?: string;
  error?: string;
  executionTime?: number;
}> {
  try {
    // Générer le code
    const code = await generateCodeFromLLM(userMessage, language);
    if (!code) {
      console.warn('[CodeGeneratorFromLLM] No code generated');
      return { success: false, error: 'Could not generate code from LLM' };
    }

    console.log('[CodeGeneratorFromLLM] Generated code:', code.substring(0, 150));

    // Exécuter le code
    console.log('[CodeGeneratorFromLLM] Executing code...');
    const result = await executeCodeFromGroq({
      language,
      code,
      userId,
      username: 'code-generator'
    });

    console.log('[CodeGeneratorFromLLM] Execution result:', {
      success: !result.error,
      hasOutput: !!result.output,
      executionTime: result.executionTime,
      error: result.error?.substring(0, 100)
    });

    return {
      success: !result.error,
      code,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime
    };
  } catch (error) {
    console.error('[CodeGeneratorFromLLM] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Formate la réponse avec le code et le résultat réel
 */
export function formatGeneratedCodeResponse(result: {
  success: boolean;
  code?: string;
  output?: string;
  error?: string;
  executionTime?: number;
}): string {
  if (!result.success || !result.code) {
    return '';
  }

  let response = `**Code généré et exécuté:**\n\n\`\`\`python\n${result.code}\n\`\`\`\n\n`;

  if (result.error) {
    response += `❌ **Erreur lors de l'exécution (${result.executionTime}ms):**\n\n${result.error}`;
  } else {
    response += `✅ **Résultat RÉEL de l'exécution (${result.executionTime}ms):**\n\n\`\`\`\n${result.output}\`\`\``;
  }

  return response;
}
