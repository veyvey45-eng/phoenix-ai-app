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
import { invokeLLM } from '../_core/llm';

/**
 * Génère une réponse de fallback quand Groq est en rate limit
 * Utilise le LLM principal (Google AI) pour répondre
 */
async function generateFallbackResponse(userMessage: string, contextData?: string): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();
  
  // Réponses pour les calculs simples - traitement local rapide
  const mathMatch = userMessage.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result: number;
    switch (op) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/': result = b !== 0 ? a / b : NaN; break;
      default: result = NaN;
    }
    if (!isNaN(result)) {
      return `${a} ${op} ${b} = ${result}`;
    }
  }
  
  // Réponses pour les salutations - traitement local rapide
  if (/^(salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/i.test(lowerMessage)) {
    return 'Salut ! Comment puis-je t\'aider aujourd\'hui ?';
  }
  
  // Pour toutes les autres questions, utiliser le LLM principal
  try {
    console.log('[GroqToolHandler] Using main LLM for fallback response');
    
    let systemPrompt = `Tu es Phoenix, un AGENT IA AUTONOME qui EXÉCUTE directement.

## RÈGLE FONDAMENTALE
Tu AGIS directement, tu n'expliques pas comment faire. Tu es comme Manus AI.

**INTERDIT:**
- Donner des instructions à suivre
- Demander des confirmations
- Proposer des étapes théoriques
- Dire "voici les étapes..." ou "tu dois..."

**OBLIGATOIRE:**
- Utiliser tes outils pour CRÉER directement
- Exécuter le code toi-même
- Donner l'URL finale
- Faire le travail SANS demander

RÈGLES LANGUE:
- Réponds dans la même langue que l'utilisateur
- Sois concis et utile`;
    
    // Ajouter le contexte si disponible (données météo, crypto, etc.)
    if (contextData) {
      systemPrompt += `\n\nDonnées contextuelles disponibles:\n${contextData}`;
    }
    
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[GroqToolHandler] LLM fallback error:', error);
  }
  
  // Réponse par défaut si tout échoue
  return 'Je suis là pour t\'aider ! Que puis-je faire pour toi ?';
}

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
      
      // FALLBACK: En cas de rate limit (429), retourner une réponse par défaut
      if (response.status === 429) {
        console.log('[GroqToolHandler] Rate limit reached, falling back to default response');
        // Extraire le dernier message utilisateur pour générer une réponse contextuelle
        const lastUserMessage = currentMessages.filter(m => m.role === 'user').pop();
        const userContent = lastUserMessage?.content || '';
        
        // Utiliser le LLM principal pour générer une réponse contextuelle
        return await generateFallbackResponse(userContent);
      }
      
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
