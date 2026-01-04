/**
 * Code Interpreter Tool Definition
 * Permet à Groq/Gemini d'utiliser le Code Interpreter
 */

import { e2bSandbox } from './e2bSandbox';
import { validateCodeSafety } from './codeDetector';

export interface CodeExecutionRequest {
  language: 'python' | 'javascript';
  code: string;
  userId: string;
  username: string;
}

export interface CodeExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: 'python' | 'javascript';
}

/**
 * Tool Definition pour Groq/Gemini
 * Décrit ce que Groq peut faire avec le Code Interpreter
 */
export const CODE_INTERPRETER_TOOL_DEFINITION = {
  type: 'function',
  function: {
    name: 'execute_code',
    description: 'Execute Python or JavaScript code in a secure E2B Sandbox. Use this when the user asks for calculations, data analysis, code execution, or any computational task.',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['python', 'javascript'],
          description: 'Programming language: "python" for Python 3.11 or "javascript" for Node.js 20',
        },
        code: {
          type: 'string',
          description: 'The code to execute. Must be complete and executable. Include all necessary imports and print/console.log the results.',
        },
      },
      required: ['language', 'code'],
    },
  },
};

/**
 * Exécute le code demandé par Groq
 */
export async function executeCodeFromGroq(
  request: CodeExecutionRequest
): Promise<CodeExecutionResponse> {
  try {
    // Valider la sécurité du code
    const validation = validateCodeSafety(request.code, request.language);
    if (!validation.safe) {
      return {
        success: false,
        output: '',
        error: `Code validation failed: ${validation.issues.join(', ')}`,
        executionTime: 0,
        language: request.language,
      };
    }

    // Exécuter le code
    if (request.language === 'python') {
      const result = await e2bSandbox.executePython(
        request.code,
        request.userId,
        request.username
      );
      return result;
    } else {
      const result = await e2bSandbox.executeJavaScript(
        request.code,
        request.userId,
        request.username
      );
      return result;
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0,
      language: request.language,
    };
  }
}

/**
 * Génère un message de résultat pour Groq
 */
export function formatCodeExecutionResult(response: CodeExecutionResponse): string {
  if (!response.success) {
    return `Code execution failed (${response.executionTime}ms):\nError: ${response.error}`;
  }

  return `Code executed successfully (${response.executionTime}ms):\n\n${response.output}`;
}

/**
 * Détecte si Groq a appelé le tool execute_code
 */
export function isCodeExecutionToolCall(toolCall: any): boolean {
  return toolCall?.function?.name === 'execute_code';
}

/**
 * Parse les arguments du tool call
 */
export function parseCodeExecutionToolCall(toolCall: any): CodeExecutionRequest | null {
  try {
    const args = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    if (!args.language || !args.code) {
      return null;
    }

    return {
      language: args.language,
      code: args.code,
      userId: 'groq-execution',
      username: 'groq-ai',
    };
  } catch (error) {
    console.error('[CodeInterpreter] Error parsing tool call:', error);
    return null;
  }
}
