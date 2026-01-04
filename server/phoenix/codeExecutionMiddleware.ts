/**
 * Code Execution Middleware
 * Intègre le Code Interpreter à l'orchestrateur Phoenix
 * Permet à Groq d'utiliser le tool execute_code
 */

import { groqApi } from './groqApi';
import {
  CODE_INTERPRETER_TOOL_DEFINITION,
  executeCodeFromGroq,
  isCodeExecutionToolCall,
  parseCodeExecutionToolCall,
  formatCodeExecutionResult,
  CodeExecutionRequest,
} from './codeInterpreterTool';
import { detectCodeExecutionNeed } from './codeDetector';

export interface GroqToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface CodeExecutionGroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: GroqToolCall[];
}

/**
 * Ajoute la Tool Definition à la liste des messages pour Groq
 */
export function addCodeInterpreterTool(tools: any[] = []): any[] {
  return [...tools, CODE_INTERPRETER_TOOL_DEFINITION];
}

/**
 * Traite les tool calls de Groq et exécute le code si nécessaire
 */
export async function processGroqToolCalls(
  response: any,
  userId: string,
  username: string
): Promise<{ hasToolCalls: boolean; results: any[] }> {
  const results = [];

  // Vérifier si Groq a appelé des tools
  if (!response.choices || !response.choices[0].message.tool_calls) {
    return { hasToolCalls: false, results: [] };
  }

  const toolCalls = response.choices[0].message.tool_calls;

  for (const toolCall of toolCalls) {
    if (isCodeExecutionToolCall(toolCall)) {
      console.log('[CodeExecutionMiddleware] Groq called execute_code tool');

      const request = parseCodeExecutionToolCall(toolCall);
      if (!request) {
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: 'Failed to parse code execution request',
        });
        continue;
      }

      // Ajouter les infos utilisateur
      request.userId = userId;
      request.username = username;

      // Exécuter le code
      const executionResult = await executeCodeFromGroq(request);

      results.push({
        toolCallId: toolCall.id,
        ...executionResult,
      });
    }
  }

  return {
    hasToolCalls: results.length > 0,
    results,
  };
}

/**
 * Construit un message tool pour retourner à Groq
 */
export function buildToolResultMessage(
  toolCallId: string,
  result: any
): CodeExecutionGroqMessage {
  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: formatCodeExecutionResult(result),
  };
}

/**
 * Orchestration complète: détecte, exécute, et retourne les résultats
 */
export async function executeCodeIfNeeded(
  userMessage: string,
  conversationHistory: CodeExecutionGroqMessage[],
  userId: string,
  username: string
): Promise<{
  shouldExecuteCode: boolean;
  codeExecuted: boolean;
  result?: any;
  updatedHistory: CodeExecutionGroqMessage[];
}> {
  // Détecte si la question nécessite du code
  const detection = detectCodeExecutionNeed(userMessage);

  if (!detection.shouldExecuteCode) {
    return {
      shouldExecuteCode: false,
      codeExecuted: false,
      updatedHistory: conversationHistory,
    };
  }

  console.log(
    `[CodeExecutionMiddleware] Code execution needed: ${detection.language}`
  );

  // Ajouter la Tool Definition à la requête Groq
  const tools = [CODE_INTERPRETER_TOOL_DEFINITION];

  // Appeler Groq avec la Tool Definition
  try {
    // Créer le message pour Groq
    const messages: CodeExecutionGroqMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // Appeler Groq avec les tools
    const response = await groqApi.generateText(messages, {
      tools,
      temperature: 0.3, // Plus bas pour plus de précision
      maxTokens: 4096,
    });

    // Parser la réponse pour voir si Groq a appelé le tool
    let groqResponse;
    try {
      groqResponse = JSON.parse(response);
    } catch {
      // Si ce n'est pas du JSON, c'est une réponse normale
      return {
        shouldExecuteCode: true,
        codeExecuted: false,
        result: response,
        updatedHistory: [...conversationHistory, { role: 'user', content: userMessage }],
      };
    }

    // Traiter les tool calls
    const { hasToolCalls, results } = await processGroqToolCalls(
      groqResponse,
      userId,
      username
    );

    if (!hasToolCalls) {
      return {
        shouldExecuteCode: true,
        codeExecuted: false,
        result: response,
        updatedHistory: [...conversationHistory, { role: 'user', content: userMessage }],
      };
    }

    // Construire l'historique mis à jour
    const updatedHistory: CodeExecutionGroqMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      groqResponse.choices[0].message as any,
      ...results.map((r) => buildToolResultMessage(r.toolCallId, r)),
    ];

    return {
      shouldExecuteCode: true,
      codeExecuted: true,
      result: results[0], // Retourner le premier résultat
      updatedHistory,
    };
  } catch (error) {
    console.error('[CodeExecutionMiddleware] Error:', error);
    return {
      shouldExecuteCode: true,
      codeExecuted: false,
      result: { error: error instanceof Error ? error.message : 'Unknown error' },
      updatedHistory: conversationHistory,
    };
  }
}
