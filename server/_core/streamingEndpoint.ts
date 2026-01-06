/**
 * Streaming Endpoint - Express middleware pour Server-Sent Events
 * Version unifiée: tout se passe dans le chat
 */

import { Request, Response } from 'express';
import { streamChatResponse, formatMessagesForStreaming } from '../phoenix/streamingChat';
import { phoenix, PhoenixContext } from '../phoenix/core';
import { contextEnricher } from '../phoenix/contextEnricher';
import { detectIntent, generateSystemPromptForIntent, DetectedIntent } from '../phoenix/intentDetector';
import { autonomousBrowser } from '../phoenix/autonomousBrowser';
import { getMemoriesByUser, getRecentUtterances, getActiveIssues, getActiveCriteria, getOrCreatePhoenixState, getDb } from '../db';
import { getFileProcessor } from '../phoenix/fileProcessor';
import { phoenixState, conversationMessages } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChatEndpoint(req: Request, res: Response) {
  try {
    // Support both GET (query params) and POST (body) requests
    const { message, contextId, conversationId, fileContent } = req.method === 'POST' 
      ? req.body 
      : req.query;
    
    const fast = true;
    const userId = (req as any).user?.id || 1;
    
    console.log('[StreamingEndpoint] Request:', {
      hasFileContent: !!fileContent,
      messageLength: message ? message.length : 0,
      conversationId
    });

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Détecter l'intention de l'utilisateur
    const intent = detectIntent(message, !!fileContent);
    console.log('[StreamingEndpoint] Detected intent:', intent.type, 'confidence:', intent.confidence);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Get conversation history if conversationId is provided
    let recentUtterances: any[] = [];
    const convId = conversationId ? (typeof conversationId === 'string' ? parseInt(conversationId) : conversationId) : null;
    
    if (convId && convId > 0) {
      const db = await getDb();
      if (db) {
        try {
          const convMessages = await db.select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, convId))
            .orderBy(desc(conversationMessages.createdAt))
            .limit(10);
          recentUtterances = convMessages.reverse().map(msg => ({
            role: msg.role,
            content: msg.content,
            confidence: 1.0
          }));
          console.log(`[StreamingEndpoint] Loaded ${recentUtterances.length} messages from conversation ${convId}`);
        } catch (error) {
          console.error('[StreamingEndpoint] Error loading conversation history:', error);
        }
      }
    }

    // Enrichir le contexte si nécessaire (météo, crypto, recherche web)
    let enrichedContext = '';
    if (['weather', 'crypto', 'web_search'].includes(intent.type) || intent.type === 'conversation') {
      const enrichment = await contextEnricher.enrichContext(message, userId.toString());
      enrichedContext = enrichment.enrichedContext || '';
      console.log(`[StreamingEndpoint] Enrichment:`, { category: enrichment.category, hasContext: !!enrichedContext });
    }

    // Générer le prompt système adapté à l'intention
    let systemPrompt = generateSystemPromptForIntent(intent);

    // Ajouter le contenu du fichier si présent
    if (fileContent && typeof fileContent === 'string') {
      systemPrompt += `

[CONTENU DU FICHIER]
${fileContent}
[FIN CONTENU DU FICHIER]

Utilise ce contenu pour répondre aux questions de l'utilisateur.`;
    }

    // Construire le message utilisateur avec contexte
    let userMessageWithContext = message;
    
    // Ajouter l'historique de conversation
    if (recentUtterances && recentUtterances.length > 0) {
      const history = recentUtterances
        .map(u => `${u.role === 'user' ? 'Utilisateur' : 'Phoenix'}: ${u.content}`)
        .join('\n');
      userMessageWithContext = `[HISTORIQUE]\n${history}\n\n[MESSAGE ACTUEL]\n${message}`;
    }
    
    // Ajouter les données enrichies
    if (enrichedContext) {
      userMessageWithContext = `[DONNEES ENRICHIES]\n${enrichedContext}\n\n${userMessageWithContext}`;
    }

    // Traitement spécial pour la génération d'images
    if (intent.type === 'image_generation') {
      await handleImageGeneration(res, intent, message);
      return;
    }

    // Traitement spécial pour la navigation web
    if (intent.type === 'web_browse') {
      await handleWebBrowse(res, message);
      return;
    }

    // Stream la réponse
    try {
      const messages = formatMessagesForStreaming(systemPrompt, userMessageWithContext);
      console.log('[StreamingEndpoint] Streaming with intent:', intent.type);

      for await (const chunk of streamChatResponse(messages, {
        temperature: fast ? 0.5 : 0.7,
        maxTokens: fast ? 1024 : 2048
      })) {
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('[StreamingEndpoint] Error during streaming:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming error' })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[StreamingEndpoint] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
}

/**
 * Gère la génération d'images directement dans le chat
 */
async function handleImageGeneration(res: Response, intent: DetectedIntent, message: string) {
  try {
    const imagePrompt = intent.details.imagePrompt || message;
    
    // Envoyer un message indiquant que l'image est en cours de génération
    res.write(`data: ${JSON.stringify({ type: 'token', content: '🎨 Je génère ton image...\n\n' })}\n\n`);
    
    // Importer et utiliser le générateur d'images
    const { generateImage } = await import('../_core/imageGeneration');
    
    try {
      const result = await generateImage({ prompt: imagePrompt });
      
      if (result.url) {
        // Envoyer l'URL de l'image générée
        res.write(`data: ${JSON.stringify({ 
          type: 'image', 
          url: result.url,
          prompt: imagePrompt 
        })}\n\n`);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'token', 
          content: `\n\nVoici ton image ! 🖼️\n\n![Image générée](${result.url})\n\n*Prompt utilisé: "${imagePrompt}"*` 
        })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ 
          type: 'token', 
          content: "Désolé, je n'ai pas pu générer l'image. Réessaie avec une description différente." 
        })}\n\n`);
      }
    } catch (imageError) {
      console.error('[StreamingEndpoint] Image generation error:', imageError);
      res.write(`data: ${JSON.stringify({ 
        type: 'token', 
        content: "Désolé, une erreur s'est produite lors de la génération de l'image. Réessaie plus tard." 
      })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[StreamingEndpoint] Error in image generation handler:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Image generation failed' })}\n\n`);
    res.end();
  }
}

/**
 * Gère la navigation web directe
 */
async function handleWebBrowse(res: Response, message: string) {
  console.log('[handleWebBrowse] Démarrage avec message:', message);
  
  try {
    // Extraire l'URL du message
    const urlMatch = message.match(/https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i);
    let url = urlMatch ? urlMatch[0] : '';
    
    console.log('[handleWebBrowse] URL extraite:', url);
    
    // Ajouter https:// si nécessaire
    if (url && !url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    if (!url) {
      res.write(`data: ${JSON.stringify({ type: 'token', content: "Je n'ai pas trouvé d'URL dans ta demande. Peux-tu préciser le site web ?" })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    // Envoyer le message initial
    const initialMsg = `🌐 Navigation vers ${url} avec Browserless.io (vrai Chrome cloud)...\n\n`;
    res.write(`data: ${JSON.stringify({ type: 'token', content: initialMsg })}\n\n`);
    console.log('[handleWebBrowse] Message initial envoyé');
    
    const startTime = Date.now();
    
    try {
      console.log('[handleWebBrowse] Appel de executeBrowsingSession...');
      
      // Utiliser Browserless pour naviguer (signature: url, extractionGoal, userId, takeScreenshot)
      const result = await autonomousBrowser.executeBrowsingSession(
        url,
        `Extraire le contenu principal de ${url}`,
        'default',
        false
      );
      
      console.log('[handleWebBrowse] Résultat reçu:', { success: result.success, method: result.method, contentLength: result.content?.length });
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (result.success && result.content) {
        const content = result.content.slice(0, 8000); // Limiter la taille
        const responseMsg = `${content}\n\n---\n*Extrait via ${result.method} en ${duration}s*`;
        console.log('[handleWebBrowse] Envoi du contenu, longueur:', responseMsg.length);
        res.write(`data: ${JSON.stringify({ type: 'token', content: responseMsg })}\n\n`);
        console.log('[handleWebBrowse] Contenu envoyé');
      } else {
        const errorMsg = `⚠️ Impossible d'accéder à ${url}. ${result.error || 'Le site peut être inaccessible.'}`;
        console.log('[handleWebBrowse] Erreur:', errorMsg);
        res.write(`data: ${JSON.stringify({ type: 'token', content: errorMsg })}\n\n`);
      }
    } catch (browseError) {
      console.error('[handleWebBrowse] Browse error:', browseError);
      res.write(`data: ${JSON.stringify({ type: 'token', content: `⚠️ Erreur lors de la navigation: ${browseError instanceof Error ? browseError.message : 'Erreur inconnue'}` })}\n\n`);
    }
    
    console.log('[handleWebBrowse] Envoi de [DONE]');
    res.write('data: [DONE]\n\n');
    res.end();
    console.log('[handleWebBrowse] Terminé');
  } catch (error) {
    console.error('[handleWebBrowse] Error in web browse handler:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Web browse failed' })}\n\n`);
    res.end();
  }
}

export default streamChatEndpoint;
