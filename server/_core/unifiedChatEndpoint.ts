/**
 * Unified Chat Endpoint - Chat avec capacités d'Agent intégrées
 * 
 * Ce endpoint permet d'utiliser TOUS les outils de l'agent directement
 * dans le chat, comme Manus. Plus besoin de pages séparées!
 */

import { Request, Response } from 'express';
import { invokeLLM } from './llm';
import { toolRegistry, ToolContext, ToolResult } from '../phoenix/toolRegistry';
import { streamChatResponse, formatMessagesForStreaming } from '../phoenix/streamingChat';
import { detectIntent, generateSystemPromptForIntent } from '../phoenix/intentDetector';
import { contextEnricher } from '../phoenix/contextEnricher';
import { getDb } from '../db';
import { conversationMessages } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

// Types pour les événements de streaming
interface StreamEvent {
  type: 'token' | 'thinking' | 'tool_call' | 'tool_result' | 'image' | 'artifact' | 'error' | 'done';
  content?: string;
  tool?: string;
  args?: any;
  result?: any;
  url?: string;
  artifacts?: any[];
}

// Détecte si le message nécessite des outils avancés
function needsAgentCapabilities(message: string): boolean {
  const agentTriggers = [
    // Création de projets/fichiers - patterns élargis
    /cr[ée]e[rz]?[\s-]*(moi)?[\s-]*(un|une|le|la|des|mon|ma|mes)?[\s-]*(site|page|projet|application|app|fichier|code)/i,
    /g[ée]n[èe]re[rz]?[\s-]*(moi)?[\s-]*(un|une|le|la|des|mon|ma|mes)?[\s-]*(site|page|projet|application|app|fichier|code)/i,
    /fai[st]?[\s-]*(moi)?[\s-]*(un|une|le|la|des|mon|ma|mes)?[\s-]*(site|page|projet|application|app)/i,
    /d[ée]veloppe[rz]?/i,
    /programme[rz]?/i,
    /code[rz]?\s+(un|une|le|la|des)/i,
    // Patterns simples pour "crée" + "page/site/web"
    /cr[ée]e.*page/i,
    /cr[ée]e.*site/i,
    /cr[ée]e.*web/i,
    /page\s+web/i,
    
    // Exécution de code
    /ex[ée]cute[rz]?/i,
    /lance[rz]?\s+(le|ce|un)\s+(code|script|programme)/i,
    /run\s+(this|the|a)/i,
    /teste[rz]?\s+(le|ce|un)\s+(code|script)/i,
    
    // Recherche web avancée
    /recherche[rz]?\s+(sur|dans)\s+(le\s+)?web/i,
    /cherche[rz]?\s+(sur|dans)\s+(internet|le\s+web|google)/i,
    /trouve[rz]?\s+(moi\s+)?(des\s+)?informations?\s+(sur|à\s+propos)/i,
    
    // Génération d'images
    /g[ée]n[èe]re[rz]?\s+(une?\s+)?image/i,
    /cr[ée]e[rz]?\s+(une?\s+)?image/i,
    /dessine[rz]?/i,
    /illustre[rz]?/i,
    
    // Navigation web
    /va\s+sur\s+(le\s+site|la\s+page)/i,
    /ouvre[rz]?\s+(le\s+site|la\s+page|l'url)/i,
    /navigue[rz]?\s+(vers|sur)/i,
    /visite[rz]?\s+(le\s+site|la\s+page)/i,
    
    // Analyse de fichiers
    /analyse[rz]?\s+(le|ce|un)\s+(fichier|document|pdf|image)/i,
    /lis[rz]?\s+(le|ce|un)\s+(fichier|document)/i,
    
    // Commandes shell
    /ex[ée]cute[rz]?\s+(une?\s+)?commande/i,
    /lance[rz]?\s+(une?\s+)?commande/i,
    /terminal/i,
    /shell/i,
    
    // Déploiement
    /d[ée]ploie[rz]?/i,
    /publie[rz]?/i,
    /met[rz]?\s+en\s+(ligne|production)/i,
    
    // Mots-clés explicites
    /utilise[rz]?\s+(l'outil|les\s+outils)/i,
    /avec\s+(les\s+)?outils/i,
    /mode\s+agent/i,
    
    // Actions sur des URLs
    /url\s+publique/i,
    /serveur\s+(de\s+)?preview/i,
    /d[ée]marre[rz]?\s+(un\s+)?serveur/i
  ];
  
  return agentTriggers.some(trigger => trigger.test(message));
}

// Génère le prompt système pour le mode agent unifié
function generateUnifiedSystemPrompt(): string {
  const toolsDescription = toolRegistry.generateToolsDescription();
  
  return `Tu es Phoenix, un assistant IA intelligent avec des capacités d'agent autonome.

## Tes deux modes de fonctionnement

### Mode Conversation (par défaut)
Pour les questions simples, discussions, explications, tu réponds directement de manière naturelle et conversationnelle.

### Mode Agent (quand nécessaire)
Quand l'utilisateur demande de CRÉER, EXÉCUTER, RECHERCHER ou GÉNÉRER quelque chose, tu utilises tes outils.

## Capacités principales

Tu peux:
- **Créer des projets web** : Sites HTML/CSS/JS, React, Node.js, Python
- **Exécuter du code** : Python, JavaScript, commandes shell
- **Rechercher sur le web** : Informations, actualités, données
- **Générer des images** : Illustrations, logos, designs
- **Naviguer sur le web** : Visiter des sites, extraire des informations
- **Analyser des fichiers** : Documents, images, PDFs
- **Déployer des applications** : Serveurs preview avec URLs publiques

## Outils RÉELS (comme Manus)

**IMPORTANT: Tu peux créer des projets RÉELS avec des URLs PUBLIQUES!**

- **real_project_create** : Créer un projet complet avec plusieurs fichiers
- **real_preview_start** : Démarrer un serveur et obtenir une URL PUBLIQUE
- **real_file_create** : Créer/modifier des fichiers individuels
- **real_shell_exec** : Exécuter des commandes shell réelles
- **real_deploy** : Déployer de manière permanente

**Workflow pour créer une application accessible:**
1. Utilise 'real_project_create' pour créer les fichiers du projet
2. Utilise 'real_preview_start' pour démarrer le serveur
3. Donne l'URL publique à l'utilisateur!

## Outils disponibles

${toolsDescription}

## Format de réponse

Quand tu dois utiliser un outil, réponds en JSON:
\`\`\`json
{
  "mode": "agent",
  "thinking": "Ta réflexion",
  "action": {
    "type": "tool_call",
    "tool_name": "nom_outil",
    "tool_args": { ... }
  }
}
\`\`\`

Quand tu as terminé ou pour une conversation normale:
\`\`\`json
{
  "mode": "conversation",
  "response": "Ta réponse naturelle"
}
\`\`\`

## Règles importantes

1. **Détecte automatiquement** si l'utilisateur veut une action ou une conversation
2. **Utilise les outils** quand on te demande de créer, exécuter, chercher, générer
3. **Réponds naturellement** pour les questions, discussions, explications
4. **Donne toujours l'URL** quand tu crées quelque chose d'accessible
5. **Itère si nécessaire** : si un outil échoue, essaie une autre approche`;
}

// Envoie un événement SSE
function sendEvent(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Exécute une boucle d'agent avec streaming
async function runAgentLoop(
  res: Response,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userId: string
): Promise<string> {
  const toolContext: ToolContext = {
    userId,
    sessionId: `chat-${Date.now()}`
  };

  const maxIterations = 15;
  const maxToolCalls = 20;
  let iterations = 0;
  let toolCalls = 0;
  let finalResponse = '';
  
  // Construire l'historique des messages
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: generateUnifiedSystemPrompt() }
  ];
  
  // Ajouter l'historique de conversation
  for (const msg of conversationHistory.slice(-10)) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    });
  }
  
  // Ajouter le message actuel
  messages.push({ role: 'user', content: message });

  while (iterations < maxIterations && toolCalls < maxToolCalls) {
    iterations++;
    
    // Appeler le LLM
    const response = await invokeLLM({ messages });
    
    if (!response?.choices?.[0]?.message?.content) {
      sendEvent(res, { type: 'error', content: 'Réponse LLM invalide' });
      break;
    }

    const rawContent = response.choices[0].message.content;
    // Convertir le contenu en string si c'est un array
    let content: string;
    if (Array.isArray(rawContent)) {
      content = rawContent.map(c => typeof c === 'string' ? c : ('text' in c ? c.text : '')).join('');
    } else {
      content = rawContent as string;
    }
    
    // Extraire le JSON si présent
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*"mode"[\s\S]*\})/);
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content);
    } catch {
      // Pas de JSON, c'est une réponse conversationnelle
      // Streamer la réponse token par token
      for (const char of content) {
        sendEvent(res, { type: 'token', content: char });
        await new Promise(r => setTimeout(r, 5)); // Petit délai pour l'effet de streaming
      }
      finalResponse = content;
      break;
    }

    // Mode conversation - réponse directe
    if (parsed.mode === 'conversation' || parsed.response) {
      const responseText = parsed.response || parsed.content || content;
      for (const char of responseText) {
        sendEvent(res, { type: 'token', content: char });
        await new Promise(r => setTimeout(r, 5));
      }
      finalResponse = responseText;
      break;
    }

    // Mode agent - exécuter l'outil
    if (parsed.action?.type === 'tool_call') {
      const toolName = parsed.action.tool_name;
      const toolArgs = parsed.action.tool_args || {};
      
      // Envoyer l'événement de réflexion
      if (parsed.thinking) {
        sendEvent(res, { type: 'thinking', content: parsed.thinking });
      }
      
      // Envoyer l'événement d'appel d'outil
      sendEvent(res, { type: 'tool_call', tool: toolName, args: toolArgs });
      
      // Exécuter l'outil
      toolCalls++;
      const result = await toolRegistry.execute(toolName, toolArgs, toolContext);
      
      // Envoyer le résultat
      sendEvent(res, { 
        type: 'tool_result', 
        tool: toolName, 
        result: {
          success: result.success,
          output: result.output?.substring(0, 2000),
          error: result.error,
          artifacts: result.artifacts
        }
      });
      
      // Ajouter au contexte pour la prochaine itération
      messages.push({
        role: 'assistant',
        content: JSON.stringify(parsed)
      });
      messages.push({
        role: 'user',
        content: `RÉSULTAT DE L'OUTIL ${toolName}:\n${result.success ? result.output : `ERREUR: ${result.error}`}`
      });
      
      // Si des artifacts sont générés, les envoyer
      if (result.artifacts) {
        for (const artifact of result.artifacts) {
          sendEvent(res, { type: 'artifact', artifacts: [artifact] });
        }
      }
      
      continue;
    }

    // Réponse finale de l'agent
    if (parsed.action?.type === 'answer' || parsed.answer) {
      const answer = parsed.action?.answer || parsed.answer || parsed.response;
      for (const char of answer) {
        sendEvent(res, { type: 'token', content: char });
        await new Promise(r => setTimeout(r, 5));
      }
      finalResponse = answer;
      break;
    }
  }

  return finalResponse;
}

/**
 * Endpoint principal du chat unifié
 */
export async function unifiedChatEndpoint(req: Request, res: Response) {
  try {
    const { message, conversationId, fileContent } = req.method === 'POST' 
      ? req.body 
      : req.query;
    
    const userId = (req as any).user?.id?.toString() || '1';
    
    console.log('[UnifiedChat] Request:', {
      messageLength: message?.length || 0,
      conversationId,
      hasFileContent: !!fileContent
    });

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Charger l'historique de conversation
    let conversationHistory: Array<{ role: string; content: string }> = [];
    const convId = conversationId ? parseInt(conversationId.toString()) : null;
    
    if (convId && convId > 0) {
      const db = await getDb();
      if (db) {
        try {
          const convMessages = await db.select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, convId))
            .orderBy(desc(conversationMessages.createdAt))
            .limit(10);
          conversationHistory = convMessages.reverse().map(msg => ({
            role: msg.role,
            content: msg.content
          }));
        } catch (error) {
          console.error('[UnifiedChat] Error loading history:', error);
        }
      }
    }

    // Ajouter le contenu du fichier si présent
    let fullMessage = message;
    if (fileContent && typeof fileContent === 'string') {
      fullMessage += `\n\n[CONTENU DU FICHIER]\n${fileContent}\n[FIN CONTENU]`;
    }

    // Détecter si on a besoin des capacités d'agent
    const needsAgent = needsAgentCapabilities(fullMessage);
    console.log('[UnifiedChat] Needs agent capabilities:', needsAgent);

    if (needsAgent) {
      // Mode Agent - utiliser la boucle d'agent avec outils
      await runAgentLoop(res, fullMessage, conversationHistory, userId);
    } else {
      // Mode Conversation - streaming simple avec enrichissement
      const intent = detectIntent(fullMessage, !!fileContent);
      let systemPrompt = generateSystemPromptForIntent(intent);
      
      // Enrichir si nécessaire
      if (['weather', 'crypto', 'web_search'].includes(intent.type)) {
        const enrichment = await contextEnricher.enrichContext(fullMessage, userId);
        if (enrichment.enrichedContext) {
          fullMessage = `[DONNÉES]\n${enrichment.enrichedContext}\n\n[QUESTION]\n${fullMessage}`;
        }
      }

      // Ajouter l'historique
      let userMessage = fullMessage;
      if (conversationHistory.length > 0) {
        const history = conversationHistory
          .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Phoenix'}: ${m.content}`)
          .join('\n');
        userMessage = `[HISTORIQUE]\n${history}\n\n[MESSAGE]\n${fullMessage}`;
      }

      // Streamer la réponse
      const messages = formatMessagesForStreaming(systemPrompt, userMessage);
      
      // Convertir les messages pour streamChatResponse
      const streamMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }));
      
      for await (const chunk of streamChatResponse(streamMessages, {
        temperature: 0.7,
        maxTokens: 2048
      })) {
        sendEvent(res, { type: 'token', content: chunk });
      }
    }

    sendEvent(res, { type: 'done' });
    res.end();

  } catch (error: any) {
    console.error('[UnifiedChat] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      sendEvent(res, { type: 'error', content: error.message });
      res.end();
    }
  }
}

export default unifiedChatEndpoint;
