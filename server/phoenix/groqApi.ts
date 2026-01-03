/**
 * Groq API Module - LLM haute performance via Groq
 * Fournit une alternative à Google AI Studio avec des modèles rapides
 */

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class GroqApiService {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1';
  private model = 'llama-3.3-70b-versatile'; // Fast and capable model

  constructor() {
    this.apiKey = process.env.GROG_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Groq] API key not found. Groq LLM will not be available.');
    }
  }

  /**
   * Check if Groq API is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate text using Groq
   */
  async generateText(
    messages: GroqMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Groq API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          top_p: 1,
          stop: null
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Groq] API error:', response.status, error);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data: GroqResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Groq API');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('[Groq] Error generating text:', error);
      throw error;
    }
  }

  /**
   * Generate text with streaming (for real-time responses)
   */
  async *generateTextStream(
    messages: GroqMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): AsyncGenerator<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Groq API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body from Groq API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
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
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('[Groq] Error in stream generation:', error);
      throw error;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      if (!this.apiKey) {
        return [];
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.map((m: any) => m.id) || [];
    } catch (error) {
      console.error('[Groq] Error listing models:', error);
      return [];
    }
  }

  /**
   * Get model info
   */
  getModelInfo(): { model: string; description: string } {
    return {
      model: this.model,
      description: 'Mixtral 8x7B - Fast and capable LLM optimized for speed'
    };
  }
}

export const groqApi = new GroqApiService();
