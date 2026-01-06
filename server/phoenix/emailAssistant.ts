/**
 * Email Assistant Module for Phoenix AI
 */

import { invokeLLM } from '../_core/llm';

export interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
  language: string;
}

export interface EmailSummary {
  subject: string;
  sender: string;
  mainPoints: string[];
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  suggestedResponse?: string;
}

export interface EmailContext {
  purpose: 'professional' | 'personal' | 'sales' | 'support' | 'follow-up' | 'introduction';
  tone: 'formal' | 'friendly' | 'casual' | 'urgent' | 'apologetic' | 'grateful';
  recipient?: string;
  recipientRole?: string;
  previousContext?: string;
}

export interface ResponseSuggestion {
  type: 'accept' | 'decline' | 'request-info' | 'acknowledge' | 'follow-up';
  subject: string;
  body: string;
  tone: string;
}

export function detectEmailRequest(message: string): {
  type: 'compose' | 'summarize' | 'improve' | 'respond' | null;
  context?: string;
} {
  const lowerMessage = message.toLowerCase();
  
  const composeTriggers = ['rédige', 'écris', 'compose', 'crée un email', 'email pour', 'mail pour'];
  const summarizeTriggers = ['résume', 'résumé', 'synthèse', 'summarize'];
  const improveTriggers = ['améliore', 'corrige', 'reformule', 'improve'];
  const respondTriggers = ['réponds', 'répondre', 'response', 'reply'];
  
  if (composeTriggers.some(t => lowerMessage.includes(t))) {
    return { type: 'compose', context: message };
  }
  if (summarizeTriggers.some(t => lowerMessage.includes(t))) {
    return { type: 'summarize', context: message };
  }
  if (improveTriggers.some(t => lowerMessage.includes(t))) {
    return { type: 'improve', context: message };
  }
  if (respondTriggers.some(t => lowerMessage.includes(t))) {
    return { type: 'respond', context: message };
  }
  
  return { type: null };
}

export async function composeEmail(
  topic: string,
  context: EmailContext,
  additionalInstructions?: string
): Promise<EmailDraft> {
  console.log(`[EmailAssistant] Composing email about: ${topic}`);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en communication. Rédige un email professionnel. Ton: ${context.tone}, But: ${context.purpose}. Format JSON: {"subject": "...", "body": "...", "tone": "...", "language": "fr"}`,
        },
        { role: 'user', content: `Sujet: ${topic}\n${additionalInstructions || ''}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'email_draft',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              body: { type: 'string' },
              tone: { type: 'string' },
              language: { type: 'string' },
            },
            required: ['subject', 'body', 'tone', 'language'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    return JSON.parse(contentStr || '{"subject": "", "body": "", "tone": "", "language": "fr"}');
  } catch (error) {
    console.error('[EmailAssistant] Error:', error);
    return { subject: 'Email', body: '', tone: context.tone, language: 'fr' };
  }
}

export async function summarizeEmail(emailContent: string): Promise<EmailSummary> {
  console.log('[EmailAssistant] Summarizing email');
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Résume cet email. Format JSON: {"subject": "...", "sender": "...", "mainPoints": [...], "actionItems": [...], "sentiment": "positive|neutral|negative|urgent"}',
        },
        { role: 'user', content: emailContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'email_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              sender: { type: 'string' },
              mainPoints: { type: 'array', items: { type: 'string' } },
              actionItems: { type: 'array', items: { type: 'string' } },
              sentiment: { type: 'string' },
            },
            required: ['subject', 'sender', 'mainPoints', 'actionItems', 'sentiment'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{}');
    return {
      subject: parsed.subject || '',
      sender: parsed.sender || '',
      mainPoints: parsed.mainPoints || [],
      actionItems: parsed.actionItems || [],
      sentiment: (parsed.sentiment as EmailSummary['sentiment']) || 'neutral',
    };
  } catch (error) {
    console.error('[EmailAssistant] Error:', error);
    return { subject: '', sender: '', mainPoints: [], actionItems: [], sentiment: 'neutral' };
  }
}

export async function generateResponseSuggestions(originalEmail: string, _context?: string): Promise<ResponseSuggestion[]> {
  console.log('[EmailAssistant] Generating response suggestions');
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Génère 3 suggestions de réponses. Format JSON: {"suggestions": [{"type": "...", "subject": "...", "body": "...", "tone": "..."}]}',
        },
        { role: 'user', content: `Email original:\n${originalEmail}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response_suggestions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    subject: { type: 'string' },
                    body: { type: 'string' },
                    tone: { type: 'string' },
                  },
                  required: ['type', 'subject', 'body', 'tone'],
                  additionalProperties: false,
                },
              },
            },
            required: ['suggestions'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{"suggestions": []}');
    return parsed.suggestions as ResponseSuggestion[];
  } catch (error) {
    console.error('[EmailAssistant] Error:', error);
    return [];
  }
}

export async function improveEmail(email: string): Promise<{ improved: EmailDraft; suggestions: string[] }> {
  console.log('[EmailAssistant] Improving email');
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Améliore cet email. Format JSON: {"improved": {"subject": "...", "body": "...", "tone": "...", "language": "fr"}, "suggestions": [...]}',
        },
        { role: 'user', content: email },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'improved_email',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              improved: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  body: { type: 'string' },
                  tone: { type: 'string' },
                  language: { type: 'string' },
                },
                required: ['subject', 'body', 'tone', 'language'],
                additionalProperties: false,
              },
              suggestions: { type: 'array', items: { type: 'string' } },
            },
            required: ['improved', 'suggestions'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    return JSON.parse(contentStr || '{"improved": {}, "suggestions": []}');
  } catch (error) {
    console.error('[EmailAssistant] Error:', error);
    return { improved: { subject: '', body: email, tone: '', language: 'fr' }, suggestions: [] };
  }
}
