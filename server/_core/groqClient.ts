/**
 * Client Groq - Remplace Gemini pour éviter les restrictions sur les recherches en ligne
 */

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string | object;
    };
  }>;
}

export async function callGroq({
  messages,
  response_format,
  temperature = 0.7,
  max_tokens = 2000,
}: {
  messages: Message[];
  response_format?: any;
  temperature?: number;
  max_tokens?: number;
}): Promise<LLMResponse> {
  const apiKey = process.env.GROG_API_KEY;
  if (!apiKey) {
    throw new Error('GROG_API_KEY not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature,
      max_tokens,
      ...(response_format && { response_format }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  return response.json();
}
