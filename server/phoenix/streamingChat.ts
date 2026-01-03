/**
 * Streaming Chat Module - Réponses en temps réel avec SSE
 * Permet à Phoenix de générer des réponses en streaming
 */

import { invokeLLM } from '../_core/llm';

interface StreamingOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Stream chat response using Server-Sent Events
 */
export async function* streamChatResponse(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    // Use Groq for faster streaming when available
    const apiKey = process.env.GROG_API_KEY;
    
    if (apiKey) {
      yield* streamWithGroq(messages, options);
    } else {
      // Fallback to Google AI Studio
      yield* streamWithGoogleAI(messages, options);
    }
  } catch (error) {
    console.error('[StreamingChat] Error:', error);
    throw error;
  }
}

/**
 * Stream using Groq API
 */
async function* streamWithGroq(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
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
        stream: true,
        tools: [{
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for real-time information',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'The search query' }
              },
              required: ['query']
            }
          }
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
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
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete JSON
            }
          }
        }
      }

      // Process any remaining data
      if (buffer && buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('[StreamingChat] Groq streaming error:', error);
    throw error;
  }
}

/**
 * Stream using Google AI Studio (fallback)
 * Note: Google AI Studio doesn't have native streaming in the SDK,
 * so we'll use a simpler approach
 */
async function* streamWithGoogleAI(
  messages: Array<{ role: string; content: string }>,
  options?: StreamingOptions
): AsyncGenerator<string> {
  try {
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      tools: [{
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for real-time information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
          }
        }
      }]
    });

    // Simulate streaming by yielding chunks
    let text = response.choices?.[0]?.message?.content || '';
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }

    const chunkSize = 10; // Characters per chunk
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, i + chunkSize);
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    console.error('[StreamingChat] Google AI streaming error:', error);
    throw error;
  }
}

/**
 * Format messages for streaming
 */
export function formatMessagesForStreaming(
  systemPrompt: string,
  userMessage: string,
  context?: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

  if (context) {
    messages.push({
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${userMessage}`
    });
  } else {
    messages.push({
      role: 'user',
      content: userMessage
    });
  }

  return messages;
}
