/**
 * Groq Tool Handler
 * Gère les tool calls de Groq et exécute le code réellement
 */

import { CODE_INTERPRETER_TOOL_DEFINITION, executeCodeFromGroq, isCodeExecutionToolCall, parseCodeExecutionToolCall } from './codeInterpreterTool';
import { CodeExecutionGroqMessage } from './codeExecutionMiddleware';

export interface GroqToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export type GroqMessage = CodeExecutionGroqMessage;

/**
 * Appelle Groq avec les tools et gère les tool calls
 */
export async function callGroqWithTools(
  messages: any[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): Promise<string> {
  const apiKey = process.env.GROG_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key not configured');
  }

  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 5; // Éviter les boucles infinies

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[GroqToolHandler] Iteration ${iterations}`);

    // Appeler Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'llama-3.3-70b-versatile',
        messages: currentMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        tools: [CODE_INTERPRETER_TOOL_DEFINITION],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GroqToolHandler] Groq error:', error);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    console.log('[GroqToolHandler] Assistant message:', {
      role: assistantMessage.role,
      hasContent: !!assistantMessage.content,
      hasToolCalls: !!assistantMessage.tool_calls,
    });

    // Ajouter la réponse de l'assistant
    currentMessages.push(assistantMessage);

    // Vérifier s'il y a des tool calls
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // Pas de tool calls, retourner le contenu
      return assistantMessage.content || 'No response';
    }

    // Traiter les tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      if (isCodeExecutionToolCall(toolCall)) {
        console.log('[GroqToolHandler] Executing code tool call');

        const request = parseCodeExecutionToolCall(toolCall);
        if (!request) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Failed to parse code execution request',
          });
          continue;
        }

        // Exécuter le code
        const executionResult = await executeCodeFromGroq(request);

        // Ajouter le résultat
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: executionResult.success
            ? `Code executed successfully (${executionResult.executionTime}ms):\n\n${executionResult.output}`
            : `Code execution failed (${executionResult.executionTime}ms):\nError: ${executionResult.error}`,
        });
      }
    }

    // Continuer la boucle pour que Groq formule la réponse finale
  }

  throw new Error('Max iterations reached');
}

/**
 * Stream avec gestion des tools
 */
export async function* streamWithToolHandling(
  messages: any[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): AsyncGenerator<string> {
  try {
    console.log('[StreamWithToolHandling] Starting tool handling');
    // D'abord, appeler Groq avec les tools
    const result = await callGroqWithTools(messages, options);
    console.log('[StreamWithToolHandling] Got result:', { resultLength: result.length });

    // Ensuite, streamer le résultat
    // Diviser en chunks pour simuler le streaming
    const chunkSize = 50;
    for (let i = 0; i < result.length; i += chunkSize) {
      yield result.substring(i, i + chunkSize);
      // Petite pause pour simuler le streaming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    console.error('[GroqToolHandler] Error:', error);
    throw error;
  }
}
