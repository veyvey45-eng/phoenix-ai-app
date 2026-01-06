/**
 * Document Generator Module for Phoenix AI
 */

import { invokeLLM } from '../_core/llm';

export interface DocumentRequest {
  type: 'pptx' | 'xlsx' | 'pdf' | 'docx' | 'markdown';
  title: string;
  content?: string;
  topic?: string;
  language?: string;
  style?: 'professional' | 'creative' | 'minimal' | 'academic';
  sections?: DocumentSection[];
}

export interface DocumentSection {
  title: string;
  content: string;
  type?: 'text' | 'list' | 'table' | 'chart' | 'image';
  data?: unknown;
}

export interface GeneratedDocument {
  filename: string;
  content: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
}

export function detectDocumentRequest(message: string): { type: 'pptx' | 'xlsx' | 'pdf' | 'docx' | 'markdown'; topic: string } | null {
  const lowerMessage = message.toLowerCase();
  
  const pptxTriggers = ['powerpoint', 'pptx', 'présentation', 'slides', 'diaporama'];
  const xlsxTriggers = ['excel', 'xlsx', 'tableau', 'spreadsheet', 'feuille de calcul'];
  const pdfTriggers = ['pdf', 'rapport pdf', 'document pdf'];
  const docxTriggers = ['word', 'docx', 'document word'];
  const mdTriggers = ['markdown', 'md'];
  
  let type: 'pptx' | 'xlsx' | 'pdf' | 'docx' | 'markdown' | null = null;
  
  if (pptxTriggers.some(t => lowerMessage.includes(t))) type = 'pptx';
  else if (xlsxTriggers.some(t => lowerMessage.includes(t))) type = 'xlsx';
  else if (pdfTriggers.some(t => lowerMessage.includes(t))) type = 'pdf';
  else if (docxTriggers.some(t => lowerMessage.includes(t))) type = 'docx';
  else if (mdTriggers.some(t => lowerMessage.includes(t))) type = 'markdown';
  
  if (!type) return null;
  
  const topicMatch = message.match(/(?:sur|about|concerning)\s+(.+?)(?:\.|$)/i);
  const topic = topicMatch ? topicMatch[1].trim() : message.slice(0, 100);
  
  return { type, topic };
}

export async function generateDocument(request: DocumentRequest): Promise<GeneratedDocument> {
  const { type, title, topic, language = 'fr' } = request;
  console.log(`[DocumentGenerator] Generating ${type} document: ${title}`);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en création de documents. Génère le contenu pour un document ${type}. Format JSON: {"title": "...", "sections": [{"title": "...", "content": "..."}]}`,
        },
        { role: 'user', content: `Titre: ${title}\nSujet: ${topic || title}\nLangue: ${language}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'document_content',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { title: { type: 'string' }, content: { type: 'string' } },
                  required: ['title', 'content'],
                  additionalProperties: false,
                },
              },
            },
            required: ['title', 'sections'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{"title": "", "sections": []}');
    
    let mdContent = `# ${parsed.title}\n\n`;
    parsed.sections.forEach((s: { title: string; content: string }) => {
      mdContent += `## ${s.title}\n\n${s.content}\n\n`;
    });
    
    return {
      filename: `${title.replace(/[^a-z0-9]/gi, '_')}.md`,
      content: mdContent,
      mimeType: 'text/markdown',
      size: mdContent.length,
    };
  } catch (error) {
    console.error('[DocumentGenerator] Error:', error);
    return {
      filename: 'error.md',
      content: '# Erreur\n\nImpossible de générer le document.',
      mimeType: 'text/markdown',
      size: 0,
    };
  }
}
