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
import { shouldUseAgentLoop, processWithAgentLoop } from './agentLoop';
import { autonomousBrowser } from './autonomousBrowser';

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
    
    // NOUVEAU: Vérifier si c'est une demande de navigation web directe
    const browseRequest = detectBrowseRequest(userMessage);
    if (browseRequest.shouldBrowse) {
      console.log('[StreamingChat] Browse request detected:', browseRequest.url || 'general browse');
      yield '🌐 Navigation web en cours avec Browserless.io (vrai Chrome cloud)...\n\n';
      
      try {
        const browseResult = await executeBrowseRequest(browseRequest, userMessage);
        yield browseResult;
        return;
      } catch (error) {
        console.error('[StreamingChat] Browse error:', error);
        yield `⚠️ Erreur de navigation: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n`;
      }
    }
    
    // NOUVEAU: Vérifier si c'est une tâche complexe multi-étapes (Agent Loop)
    if (shouldUseAgentLoop(userMessage)) {
      console.log('[StreamingChat] Complex task detected, using Agent Loop');
      yield '🧠 Tâche complexe détectée. Je décompose et exécute automatiquement...\n\n';
      
      try {
        const result = await processWithAgentLoop(
          userMessage,
          messages[0]?.content || '',
          (message, progress) => {
            console.log(`[AgentLoop] Progress ${progress}%: ${message}`);
          }
        );
        
        yield result;
        return;
      } catch (error) {
        console.error('[StreamingChat] Agent Loop error:', error);
        yield `⚠️ Erreur lors de l'exécution de la tâche complexe: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n`;
      }
    }
    
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


/**
 * Détecte si le message est une demande de navigation web
 */
interface BrowseRequest {
  shouldBrowse: boolean;
  url?: string;
  action: 'visit' | 'extract' | 'screenshot' | 'search';
  query?: string;
}

function detectBrowseRequest(message: string): BrowseRequest {
  const lowerMessage = message.toLowerCase();
  
  // Patterns pour détecter une demande de navigation
  const browsePatterns = [
    /va\s+sur|vas\s+sur|aller\s+sur|visite|visiter|ouvre|ouvrir|navigue|naviguer/i,
    /go\s+to|visit|open|navigate\s+to|browse/i,
    /montre[\s-]moi|show\s+me|affiche/i,
    /regarde|regarder|voir|check|vérifier|vérifie/i,
    /page\s+web|site\s+web|website|webpage/i,
    /sur\s+internet|on\s+the\s+web/i,
    // NOUVEAU: Patterns pour demandes naturelles sans URL
    /(?:ouvre|ouvrir|fais|faire|fasses)\s+(?:une|un)?\s*(?:page|site|web)/i,
    /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu)?\s*(?:ouvres?|visites?|navigues?|ailles?)/i,
    /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:ouvrir|visiter|naviguer|aller\s+sur)/i,
    /(?:accède|accéder|acceder)\s+(?:à|a)\s+(?:un|une)?\s*(?:page|site|web)/i
  ];
  
  // Patterns pour extraire une URL
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(com|fr|org|net|io|ai|dev|co|app)\b/i;
  
  // Patterns pour détecter une demande de screenshot
  const screenshotPatterns = [
    /capture|screenshot|écran|screen|image\s+de/i
  ];
  
  // Vérifier si c'est une demande de navigation
  const isBrowseRequest = browsePatterns.some(p => p.test(message));
  const urlMatch = message.match(urlPattern);
  const isScreenshotRequest = screenshotPatterns.some(p => p.test(message));
  
  // Si on détecte une URL ou une demande de navigation explicite
  if (isBrowseRequest || urlMatch) {
    let url = urlMatch ? urlMatch[0] : undefined;
    
    // Normaliser l'URL
    if (url && !url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    return {
      shouldBrowse: true,
      url,
      action: isScreenshotRequest ? 'screenshot' : (url ? 'visit' : 'search'),
      query: !url ? message : undefined
    };
  }
  
  return {
    shouldBrowse: false,
    action: 'visit'
  };
}

/**
 * Exécute une demande de navigation web avec Browserless
 */
async function executeBrowseRequest(request: BrowseRequest, originalMessage: string): Promise<string> {
  console.log('[StreamingChat] Executing browse request:', request);
  
  // Si pas d'URL spécifique, proposer des sites populaires ou demander une URL
  if (!request.url) {
    // Détecter le type de site demandé
    const lowerMessage = originalMessage.toLowerCase();
    
    // Détecter les catégories de sites
    if (/news|actualit|info|journal/i.test(lowerMessage)) {
      request.url = 'https://www.bbc.com';
      console.log('[StreamingChat] Auto-selecting news site: bbc.com');
    } else if (/météo|weather|temps/i.test(lowerMessage)) {
      request.url = 'https://www.meteofrance.com';
      console.log('[StreamingChat] Auto-selecting weather site: meteofrance.com');
    } else if (/sport/i.test(lowerMessage)) {
      request.url = 'https://www.lequipe.fr';
      console.log('[StreamingChat] Auto-selecting sports site: lequipe.fr');
    } else if (/tech|technologie|informatique/i.test(lowerMessage)) {
      request.url = 'https://www.theverge.com';
      console.log('[StreamingChat] Auto-selecting tech site: theverge.com');
    } else if (/recherche|search|google/i.test(lowerMessage)) {
      request.url = 'https://www.google.com';
      console.log('[StreamingChat] Auto-selecting search site: google.com');
    } else {
      // Proposer des options
      return `## 🌐 Navigation Web

Je peux naviguer sur n'importe quel site web pour vous! Voici quelques suggestions:

**Actualités:**
- "Va sur bbc.com" - BBC News
- "Ouvre lemonde.fr" - Le Monde

**Technologie:**
- "Visite theverge.com" - The Verge
- "Ouvre github.com" - GitHub

**Recherche:**
- "Va sur google.com" - Google
- "Ouvre wikipedia.org" - Wikipedia

**Ou donnez-moi une URL spécifique:**
- "Va sur https://example.com"
- "Ouvre le site monsite.fr"

Quel site voulez-vous que j'ouvre?`;
    }
  }
  
  try {
    // Utiliser autonomousBrowser.executeBrowsingSession pour naviguer
    const result = await autonomousBrowser.executeBrowsingSession(
      request.url,
      `Extraire le contenu principal de la page pour répondre à: ${originalMessage}`,
      'default',
      request.action === 'screenshot'
    );
    
    if (!result.success) {
      return `❌ Erreur lors de la navigation vers ${request.url}: ${result.error || 'Erreur inconnue'}`;
    }
    
    // Formater la réponse
    let response = `## 🌐 Navigation vers ${request.url}\n\n`;
    response += `**Méthode utilisée:** ${result.method === 'browserless-chrome' ? 'Browserless.io (Chrome cloud réel)' : result.method}\n\n`;
    
    if (result.extraction?.title) {
      response += `**Titre:** ${result.extraction.title}\n\n`;
    }
    
    if (result.content) {
      // Limiter le contenu à 3000 caractères
      const content = result.content.length > 3000 
        ? result.content.substring(0, 3000) + '...\n\n*[Contenu tronqué]*'
        : result.content;
      response += `### Contenu extrait:\n\n${content}\n\n`;
    }
    
    if (result.extraction?.links && result.extraction.links.length > 0) {
      response += `### Liens trouvés (${result.extraction.links.length}):\n`;
      result.extraction.links.slice(0, 5).forEach((link: { text: string; href: string }) => {
        response += `- [${link.text || link.href}](${link.href})\n`;
      });
      if (result.extraction.links.length > 5) {
        response += `- ... et ${result.extraction.links.length - 5} autres liens\n`;
      }
      response += '\n';
    }
    
    if (result.screenshot) {
      response += `### Screenshot:\n![Screenshot](${result.screenshot})\n\n`;
    }
    
    response += `---\n*Navigation effectuée avec ${result.method === 'browserless-chrome' ? 'Browserless.io - Vrai Chrome dans le cloud' : result.method}*`;
    
    return response;
    
  } catch (error) {
    console.error('[StreamingChat] Browse execution error:', error);
    return `❌ Erreur lors de la navigation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
}
