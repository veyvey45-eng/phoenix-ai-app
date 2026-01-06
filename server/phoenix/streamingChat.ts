/**
 * Streaming Chat Module - Réponses en temps réel avec SSE
 * Permet à Phoenix de générer des réponses en streaming
 */

import { invokeLLM } from '../_core/llm';
import { streamWithToolHandling } from './groqToolHandler';
import { generateAndExecuteCompleteFlow, isCodeRequest } from './smartCodeExecutor';
import { analyzeAndExecuteAutomatically, createEnrichedSystemPrompt } from './autoExecutionEngine';
import { generateCryptoExpertContext, getCryptoExpertSystemPrompt, detectCryptoExpertQuery } from './cryptoExpertIntegration';
import { multiSourceIntegration } from './multiSourceIntegration';

interface StreamingOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Format messages for streaming
 */
export function formatMessagesForStreaming(
  systemPrompt: string,
  userMessage: string,
  context?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];
  if (context) {
    messages.push({ role: 'system', content: `Context: ${context}` });
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function* streamChatResponse(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions,
  userId?: number,
  username?: string
): AsyncGenerator<string> {
  try {
    // Get the user message (last message)
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // NOUVEAU: Vérifier si c'est une demande d'analyse crypto experte
    const cryptoDetection = detectCryptoExpertQuery(userMessage);
    if (cryptoDetection.needsExpert) {
      console.log('[StreamingChat] Crypto expert query detected:', cryptoDetection.analysisType);
      const cryptoContext = await generateCryptoExpertContext(userMessage);
      
      if (cryptoContext.enrichedContext) {
        // Ajouter le contexte crypto au message système
        const cryptoSystemPrompt = getCryptoExpertSystemPrompt();
        messages[0] = {
          role: 'system',
          content: messages[0].content + '\n\n' + cryptoSystemPrompt + '\n\n## DONNÉES CRYPTO EN TEMPS RÉEL\n' + cryptoContext.enrichedContext
        };
        console.log('[StreamingChat] Crypto context added to system prompt');
      }
    }
    
    // NOUVEAU: Vérifier si c'est une demande météo ou recherche web
    const queryDetection = multiSourceIntegration.detectQueryType(userMessage);
    if (queryDetection.types.includes('weather') || queryDetection.types.includes('news') || queryDetection.types.includes('search')) {
      console.log('[StreamingChat] Multi-source query detected:', queryDetection.types);
      try {
        const enrichedData = await multiSourceIntegration.generateEnrichedContext(userMessage);
        if (enrichedData.context) {
          messages[0] = {
            role: 'system',
            content: messages[0].content + '\n\n## DONNÉES EN TEMPS RÉEL (Sources: ' + enrichedData.sources.join(', ') + ')\n' + enrichedData.context
          };
          console.log('[StreamingChat] Multi-source context added');
        }
      } catch (error) {
        console.error('[StreamingChat] Multi-source error:', error);
      }
    }
    
    // NOUVEAU: Vérifier si c'est une demande de code et l'exécuter DIRECTEMENT
    if (isCodeRequest(userMessage)) {
      console.log('[StreamingChat] Code request detected, executing directly');
      const codeResult = await generateAndExecuteCompleteFlow(userMessage);
      if (codeResult.success && codeResult.fullResponse) {
        // Retourner UNIQUEMENT le code et le résultat, pas la réponse de Phoenix
        console.log('[StreamingChat] Code execution successful, returning result');
        yield codeResult.fullResponse;
        return;
      } else {
        console.log('[StreamingChat] Code execution failed:', codeResult.error);
        // Continuer avec Phoenix si le code échoue
      }
    }
    
    // NOUVEAU: Auto-exécution intelligente
    console.log('[StreamingChat] Analyzing for auto-execution...');
    const conversationHistory = messages.slice(0, -1).map(m => m.role + ': ' + m.content).join('\n');
    const autoExecResult = await analyzeAndExecuteAutomatically({
      userMessage,
      phoenixResponse: '',
      conversationHistory,
      userId: userId || 0,
      username: username || 'User'
    });
    
    if (autoExecResult.shouldExecute) {
      console.log('[StreamingChat] Auto-execution triggered:', autoExecResult.executionType);
      yield autoExecResult.suggestion + '\n\n';
    }
    
    // Use Groq for faster streaming when available
    const apiKey = process.env.GROG_API_KEY;
    console.log('[StreamingChat] Groq API key available:', !!apiKey);
    
    // Enrichir le system prompt avec les 16 Points
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const enrichedPrompt = createEnrichedSystemPrompt(systemPrompt);
    const enrichedMessages = [
      { role: 'system', content: enrichedPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];
    
    if (apiKey) {
      console.log('[StreamingChat] Using Groq API with tool support');
      yield* streamWithGroq(enrichedMessages, options);
    } else {
      // Fallback to Google AI Studio
      console.log('[StreamingChat] Using Google AI fallback');
      yield* streamWithGoogleAI(enrichedMessages, options);
    }
  } catch (error) {
    console.error('[StreamingChat] Error:', error);
    throw error;
  }
}

/**
 * Stream using Groq API with tool support
 */
async function* streamWithGroq(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Groq: Using tool handler for code execution');
    // Utiliser le tool handler qui gère les tool calls ET le streaming
    yield* streamWithToolHandling(messages as any, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[StreamingChat] Tool handler error:', errorMessage);
    
    // Check if it's a rate limit error
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      console.log('[StreamingChat] Groq rate limit detected, using Google AI fallback');
      yield* streamWithGoogleAI(messages, options);
    } else {
      // Fallback au streaming normal sans tools
      yield* streamWithGroqFallback(messages, options);
    }
  }
}

/**
 * Fallback streaming without tools
 */
async function* streamWithGroqFallback(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Groq: Fallback streaming without tools');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROG_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options?.model || 'llama-3.3-70b-versatile',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true
      })
    });
    console.log('[StreamingChat] Groq: Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[StreamingChat] Groq error response:', errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }
    if (!response.body) {
      throw new Error('No response body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('[StreamingChat] Groq: Stream complete');
              return;
            }
            try {
              const json = JSON.parse(data);
              const chunk = json.choices?.[0]?.delta?.content || '';
              if (chunk) {
                yield chunk;
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('[StreamingChat] Groq fallback error:', error);
    yield* streamWithGoogleAI(messages, options);
  }
}

/**
 * Stream with Google AI
 */
async function* streamWithGoogleAI(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    console.log('[StreamingChat] Google AI: Sending request WITHOUT tools');
    
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content
      }))
    });

    // Yield the response in chunks to simulate streaming
    let contentRaw = response.choices?.[0]?.message?.content;
    let content = typeof contentRaw === 'string' ? contentRaw : '';
    
    if (!content) {
      console.warn('[StreamingChat] Google AI returned empty response');
      yield 'Désolé, je n\'arrive pas à générer une réponse en ce moment. Veuillez réessayer.';
      return;
    }
    
    console.log('[StreamingChat] Google AI response received, streaming...');
    
    // Stream the complete response
    const chunkSize = 50;
    for (let i = 0; i < content.length; i += chunkSize) {
      yield content.substring(i, i + chunkSize);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    console.log('[StreamingChat] Google AI streaming complete');
  } catch (error) {
    console.error('[StreamingChat] Google AI error:', error);
    throw error;
  }
}
