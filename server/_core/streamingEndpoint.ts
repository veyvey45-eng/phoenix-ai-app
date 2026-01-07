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

    // Traitement spécial pour la CRÉATION de site web (PRIORITÉ HAUTE)
    if (intent.type === 'site_creation') {
      await handleSiteCreation(res, message, userId);
      return;
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
 * Gère la création de site web directement
 */
async function handleSiteCreation(res: Response, message: string, userId: number) {
  console.log('[handleSiteCreation] Démarrage avec message:', message);
  
  try {
    // Importer les modules nécessaires
    const { staticSiteGenerator } = await import('../phoenix/staticSiteGenerator');
    const { extractSiteName } = await import('../phoenix/contextManager');
    
    // Extraire le nom du site
    const siteName = extractSiteName(message) || 'Site Professionnel';
    console.log('[handleSiteCreation] Nom du site extrait:', siteName);
    
    // Détecter le type de site
    const lowerMessage = message.toLowerCase();
    let siteType = 'custom';
    if (/h[ôo]tel/i.test(lowerMessage)) siteType = 'hotel';
    else if (/restaurant|resto|caf[ée]/i.test(lowerMessage)) siteType = 'restaurant';
    else if (/portfolio|cv|r[ée]sum[ée]/i.test(lowerMessage)) siteType = 'portfolio';
    else if (/landing|accueil|promo/i.test(lowerMessage)) siteType = 'landing';
    else if (/entreprise|business|soci[ée]t[ée]|commerce|startup/i.test(lowerMessage)) siteType = 'business';
    
    // Envoyer le message initial
    res.write(`data: ${JSON.stringify({ type: 'token', content: `🎨 Je crée votre site ${siteType}...\n\n` })}\n\n`);
    
    // Générer le HTML du site
    const htmlContent = generateSiteHTML(siteName, siteType, message);
    
    // Sauvegarder en base de données
    const result = await staticSiteGenerator.createFromHTML(
      userId,
      siteName,
      htmlContent,
      {
        description: `Site ${siteType} créé par Phoenix AI`,
        siteType: 'business',
        isPublic: true
      }
    );
    
    if (result.success && result.permanentUrl) {
      const successMsg = `## 🎉 Site créé avec succès!\n\n**${siteName}** est maintenant en ligne!\n\n🔗 **URL PERMANENTE:** [${result.permanentUrl}](${result.permanentUrl})\n\nCette URL ne disparaîtra JAMAIS et est prête à être partagée!\n\n### ✨ Ce qui a été créé:\n- Design moderne et responsive\n- Page de présentation professionnelle\n- Section contact\n- Optimisé pour mobile\n\n\n\n💡 Cliquez sur le lien pour voir votre site!`;
      res.write(`data: ${JSON.stringify({ type: 'token', content: successMsg })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'token', content: `❌ Erreur lors de la création du site: ${result.error || 'Erreur inconnue'}` })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[handleSiteCreation] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Site creation failed' })}\n\n`);
    res.end();
  }
}

/**
 * Génère le HTML d'un site selon le type
 */
function generateSiteHTML(siteName: string, siteType: string, originalMessage: string): string {
  // Template HTML moderne et responsive
  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; }
        .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 100px 20px; text-align: center; }
        .hero h1 { font-size: 3rem; margin-bottom: 20px; }
        .hero p { font-size: 1.3rem; opacity: 0.9; max-width: 600px; margin: 0 auto; }
        .container { max-width: 1200px; margin: 0 auto; padding: 60px 20px; }
        .section { margin-bottom: 60px; }
        .section h2 { font-size: 2rem; margin-bottom: 30px; color: #667eea; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; }
        .service-card { background: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; transition: transform 0.3s, box-shadow 0.3s; }
        .service-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .service-card h3 { color: #667eea; margin-bottom: 15px; }
        .contact { background: #f8f9fa; padding: 60px 20px; text-align: center; }
        .contact h2 { margin-bottom: 30px; }
        .contact-info { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
        .contact-item { display: flex; align-items: center; gap: 10px; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 15px 40px; border-radius: 30px; text-decoration: none; font-weight: 600; transition: background 0.3s; }
        .btn:hover { background: #764ba2; }
        footer { background: #333; color: white; text-align: center; padding: 30px; }
        @media (max-width: 768px) { .hero h1 { font-size: 2rem; } .hero p { font-size: 1rem; } }
    </style>
</head>
<body>
    <section class="hero">
        <h1>${siteName}</h1>
        <p>Bienvenue ! Découvrez nos services professionnels et notre expertise.</p>
        <br><br>
        <a href="#contact" class="btn">Contactez-nous</a>
    </section>
    
    <div class="container">
        <section class="section">
            <h2>À Propos</h2>
            <p>Nous sommes une équipe passionnée dédiée à fournir des services de qualité supérieure. Notre mission est de vous accompagner dans tous vos projets avec professionnalisme et dévouement.</p>
        </section>
        
        <section class="section">
            <h2>Nos Services</h2>
            <div class="services">
                <div class="service-card">
                    <h3>🌟 Service Premium</h3>
                    <p>Un service d'exception pour répondre à tous vos besoins avec la plus grande attention.</p>
                </div>
                <div class="service-card">
                    <h3>💼 Conseil Expert</h3>
                    <p>Bénéficiez de notre expertise pour optimiser vos projets et atteindre vos objectifs.</p>
                </div>
                <div class="service-card">
                    <h3>🤝 Accompagnement</h3>
                    <p>Un suivi personnalisé tout au long de votre parcours pour garantir votre satisfaction.</p>
                </div>
            </div>
        </section>
    </div>
    
    <section class="contact" id="contact">
        <h2>Contact</h2>
        <div class="contact-info">
            <div class="contact-item">
                <span>📞</span>
                <span>+352 000 000 000</span>
            </div>
            <div class="contact-item">
                <span>📧</span>
                <span>contact@${siteName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com</span>
            </div>
            <div class="contact-item">
                <span>📍</span>
                <span>Luxembourg</span>
            </div>
        </div>
    </section>
    
    <footer>
        <p>&copy; ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
        <p style="margin-top: 10px; opacity: 0.7; font-size: 0.9rem;">Créé avec ❤️ par Phoenix AI</p>
    </footer>
</body>
</html>`;
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
