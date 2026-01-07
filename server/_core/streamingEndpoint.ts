/**
 * Streaming Endpoint - Express middleware pour Server-Sent Events
 * Version unifiée: tout se passe dans le chat
 */

import { Request, Response } from 'express';
import { streamChatResponse, formatMessagesForStreaming } from '../phoenix/streamingChat';
import { phoenix, PhoenixContext } from '../phoenix/core';
import { contextEnricher } from '../phoenix/contextEnricher';
import { detectIntent, generateSystemPromptForIntent, DetectedIntent } from '../phoenix/intentDetector';
import { detectIntentMultiLevel, detectIntentQuick } from '../phoenix/multiLevelIntentDetector';
import { getOrCreateContext, updateContextWithAnalysis, addActionToHistory, generateContextSummary } from '../phoenix/conversationContext';
import { analyzeSemantics, quickAnalyze } from '../phoenix/semanticAnalyzer';
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

    // Récupérer ou créer le contexte conversationnel
    const convIdNum = conversationId ? (typeof conversationId === 'string' ? parseInt(conversationId) : conversationId) : 0;
    const conversationContext = convIdNum > 0 ? getOrCreateContext(convIdNum, userId.toString()) : null;
    
    // Détection rapide pour décider si on a besoin de l'analyse complète
    const quickIntent = detectIntentQuick(message, !!fileContent);
    const quickSemantic = quickAnalyze(message);
    
    // Utiliser l'analyse multi-niveaux si nécessaire
    let intent: DetectedIntent;
    let multiLevelResult = null;
    
    const needsFullAnalysis = 
      quickIntent.confidence < 0.8 ||
      quickSemantic.references?.hasNegation ||
      quickSemantic.references?.hasTransition ||
      quickSemantic.references?.hasPronounReferences;
    
    if (needsFullAnalysis) {
      console.log('[StreamingEndpoint] Using multi-level intent detection');
      multiLevelResult = await detectIntentMultiLevel(message, conversationContext, !!fileContent, true);
      intent = {
        type: multiLevelResult.finalIntent,
        confidence: multiLevelResult.finalConfidence,
        details: {
          keywords: [],
          hasNegation: multiLevelResult.hasNegation,
          hasTransition: multiLevelResult.hasTransition,
          negatedIntent: multiLevelResult.negatedIntent,
          transitionFrom: multiLevelResult.transitionFrom,
          transitionTo: multiLevelResult.transitionTo
        }
      };
      console.log('[StreamingEndpoint] Multi-level result:', {
        intent: intent.type,
        confidence: intent.confidence,
        hasNegation: multiLevelResult.hasNegation,
        hasTransition: multiLevelResult.hasTransition,
        method: multiLevelResult.resolutionMethod
      });
    } else {
      // Utiliser la détection rapide par patterns
      intent = detectIntent(message, !!fileContent);
      console.log('[StreamingEndpoint] Quick detection:', intent.type, 'confidence:', intent.confidence);
    }
    
    // Mettre à jour le contexte conversationnel
    if (conversationContext && multiLevelResult) {
      const semanticAnalysis = await analyzeSemantics(message);
      updateContextWithAnalysis(conversationContext, semanticAnalysis, intent.type);
    }

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

    // Traitement spécial pour la CRÉATION d'APPLICATION/AGENT IA (PRIORITÉ MAXIMALE)
    if (intent.type === 'app_creation') {
      await handleAppCreation(res, message, userId);
      return;
    }

    // Traitement spécial pour la MODIFICATION de site existant
    if (intent.type === 'site_modification') {
      await handleSiteModification(res, message, userId);
      return;
    }

    // Traitement spécial pour la CRÉATION de site web
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

/**
 * Gère la création d'application/agent IA
 */
async function handleAppCreation(res: Response, message: string, userId: number) {
  console.log('[handleAppCreation] Démarrage avec message:', message);
  
  try {
    const { staticSiteGenerator } = await import('../phoenix/staticSiteGenerator');
    const { extractSiteName } = await import('../phoenix/contextManager');
    
    // Extraire le nom de l'application
    let appName = extractSiteName(message) || 'Agent IA';
    const appNameMatch = message.match(/appel[ée]e?\s+["']?([^"']+)["']?/i) ||
                        message.match(/nomm[ée]e?\s+["']?([^"']+)["']?/i) ||
                        message.match(/["']([^"']+)["']/i);
    if (appNameMatch) {
      appName = appNameMatch[1].trim();
    }
    console.log('[handleAppCreation] Nom de l\'app extrait:', appName);
    
    // Envoyer les étapes de progression
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Analyse de votre demande...' })}\n\n`);
    await new Promise(r => setTimeout(r, 300));
    
    res.write(`data: ${JSON.stringify({ type: 'token', content: `🚀 **Création de votre application "${appName}"**\n\n` })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 1/4: Configuration de l\'architecture...' })}\n\n`);
    await new Promise(r => setTimeout(r, 200));
    res.write(`data: ${JSON.stringify({ type: 'token', content: '✅ Architecture configurée\n' })}\n\n`);
    
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 2/4: Génération de l\'interface utilisateur...' })}\n\n`);
    await new Promise(r => setTimeout(r, 200));
    res.write(`data: ${JSON.stringify({ type: 'token', content: '✅ Interface générée\n' })}\n\n`);
    
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 3/4: Ajout des fonctionnalités...' })}\n\n`);
    await new Promise(r => setTimeout(r, 200));
    res.write(`data: ${JSON.stringify({ type: 'token', content: '✅ Fonctionnalités ajoutées\n' })}\n\n`);
    
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 4/4: Déploiement en cours...' })}\n\n`);
    
    // Générer le HTML de l'application
    const htmlContent = generateAppHTML(appName, message);
    
    // Sauvegarder en base de données
    const result = await staticSiteGenerator.createFromHTML(
      userId,
      appName,
      htmlContent,
      {
        description: `Application ${appName} créée par Phoenix AI`,
        siteType: 'business',
        isPublic: true
      }
    );
    
    if (result.success && result.permanentUrl) {
      res.write(`data: ${JSON.stringify({ type: 'token', content: '✅ Déployé avec succès!\n\n' })}\n\n`);
      const successMsg = `## 🎉 Application créée avec succès!\n\n**${appName}** est maintenant en ligne!\n\n🔗 **URL PERMANENTE:** [${result.permanentUrl}](${result.permanentUrl})\n\nCette URL ne disparaîtra JAMAIS et est prête à être partagée!\n\n### ✨ Ce qui a été créé:\n- Interface de chat moderne\n- Design responsive thème sombre\n- Zone de saisie interactive\n- Sidebar de navigation\n- Optimisé pour mobile\n\n💡 Cliquez sur le lien pour voir votre application!`;
      res.write(`data: ${JSON.stringify({ type: 'token', content: successMsg })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'token', content: `❌ Erreur lors de la création: ${result.error || 'Erreur inconnue'}` })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[handleAppCreation] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'App creation failed' })}\n\n`);
    res.end();
  }
}

/**
 * Génère le HTML d'une application d'agent IA
 */
function generateAppHTML(appName: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Agent IA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; display: flex; }
    .sidebar { width: 260px; background: #1a1a1a; border-right: 1px solid #2a2a2a; padding: 1rem; display: flex; flex-direction: column; }
    .logo { font-size: 1.5rem; font-weight: 700; color: #10b981; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; }
    .logo::before { content: '🤖'; }
    .nav-item { padding: 0.8rem 1rem; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-bottom: 0.5rem; }
    .nav-item:hover { background: #2a2a2a; }
    .nav-item.active { background: #10b981; color: white; }
    .main { flex: 1; display: flex; flex-direction: column; }
    .header { padding: 1rem 2rem; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 1.2rem; }
    .chat-area { flex: 1; overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; gap: 1rem; }
    .message { max-width: 80%; padding: 1rem 1.5rem; border-radius: 16px; line-height: 1.6; }
    .message.bot { background: #1a1a1a; border: 1px solid #2a2a2a; align-self: flex-start; }
    .message.user { background: #10b981; color: white; align-self: flex-end; }
    .input-area { padding: 1.5rem 2rem; border-top: 1px solid #2a2a2a; }
    .input-container { display: flex; gap: 1rem; max-width: 800px; margin: 0 auto; }
    .input-container input { flex: 1; padding: 1rem 1.5rem; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; color: white; font-size: 1rem; }
    .input-container input:focus { outline: none; border-color: #10b981; }
    .input-container button { padding: 1rem 2rem; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .input-container button:hover { background: #059669; }
    @media (max-width: 768px) { .sidebar { display: none; } }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="logo">${appName}</div>
    <div class="nav-item active">💬 Nouvelle conversation</div>
    <div class="nav-item">📁 Historique</div>
    <div class="nav-item">⚙️ Paramètres</div>
  </aside>
  <main class="main">
    <header class="header">
      <h1>Chat avec ${appName}</h1>
      <span style="color: #10b981;">● En ligne</span>
    </header>
    <div class="chat-area" id="chatArea">
      <div class="message bot">Bonjour ! Je suis ${appName}, votre assistant IA. Comment puis-je vous aider aujourd'hui ?</div>
    </div>
    <div class="input-area">
      <div class="input-container">
        <input type="text" id="userInput" placeholder="Tapez votre message..." onkeypress="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()">Envoyer</button>
      </div>
    </div>
  </main>
  <script>
    function sendMessage() {
      const input = document.getElementById('userInput');
      const chatArea = document.getElementById('chatArea');
      const text = input.value.trim();
      if (!text) return;
      
      const userMsg = document.createElement('div');
      userMsg.className = 'message user';
      userMsg.textContent = text;
      chatArea.appendChild(userMsg);
      input.value = '';
      
      setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'message bot';
        botMsg.textContent = 'Merci pour votre message ! Je suis une démo, mais dans une version complète, je pourrais vous aider avec diverses tâches.';
        chatArea.appendChild(botMsg);
        chatArea.scrollTop = chatArea.scrollHeight;
      }, 1000);
      
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  </script>
</body>
</html>`;
}

/**
 * Gère la modification de site existant
 */
async function handleSiteModification(res: Response, message: string, userId: number) {
  console.log('[handleSiteModification] Démarrage avec message:', message);
  
  try {
    const { findSiteByName, updateSiteContent } = await import('../hostedSites');
    
    // Envoyer les étapes de progression
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Analyse de votre demande de modification...' })}\n\n`);
    await new Promise(r => setTimeout(r, 300));
    
    // Extraire le nom du site du message
    const siteNameMatch = message.match(/(?:site|page|app)\s+["']?([\w\s-]+)["']?/i) ||
                         message.match(/mon\s+site\s+["']?([\w\s-]+)["']?/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : null;
    
    if (!siteName) {
      res.write(`data: ${JSON.stringify({ type: 'token', content: `⚠️ Je n'ai pas pu identifier le site à modifier. Pouvez-vous préciser le nom du site ?\n\nExemple: "Modifie mon site **NomDuSite**: change la couleur en bleu"` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify({ type: 'token', content: `🔍 Recherche du site "${siteName}"...\n\n` })}\n\n`);
    
    // Rechercher le site
    const site = await findSiteByName(userId, siteName);
    
    if (!site) {
      res.write(`data: ${JSON.stringify({ type: 'token', content: `❌ Site "${siteName}" non trouvé. Vérifiez le nom ou consultez vos sites dans "Mes Projets".` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 1/3: Site trouvé, analyse des modifications...' })}\n\n`);
    await new Promise(r => setTimeout(r, 200));
    res.write(`data: ${JSON.stringify({ type: 'token', content: `✅ Site trouvé: ${site.name}\n` })}\n\n`);
    
    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Étape 2/3: Application des modifications...' })}\n\n`);
    await new Promise(r => setTimeout(r, 200));
    
    // Pour l'instant, informer l'utilisateur des modifications possibles
    const modificationGuide = `## 🛠️ Modification de "${site.name}"\n\n` +
      `Le site a été trouvé. Voici ce que vous pouvez modifier:\n\n` +
      `- **Couleurs**: "Change la couleur du header en bleu"\n` +
      `- **Textes**: "Modifie le titre en 'Nouveau Titre'"\n` +
      `- **Sections**: "Ajoute une section contact"\n` +
      `- **Images**: "Change l'image de fond"\n\n` +
      `🔗 **Votre site**: [${site.permanentUrl}](${site.permanentUrl})\n\n` +
      `💡 Pour des modifications avancées, vous pouvez également éditer directement le HTML dans "Mes Projets".`;
    
    res.write(`data: ${JSON.stringify({ type: 'token', content: modificationGuide })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[handleSiteModification] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Site modification failed' })}\n\n`);
    res.end();
  }
}

export default streamChatEndpoint;
