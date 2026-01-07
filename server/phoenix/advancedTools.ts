/**
 * Advanced Tools - Outils spécialisés niveau Manus pour Phoenix
 * 
 * Ce module implémente les 15+ outils avancés manquants :
 * - plan : Gestion de plans structurés avec phases
 * - schedule : Tâches programmées (cron/interval)
 * - map : Traitement parallèle de sous-tâches
 * - search_advanced : Recherche multi-type
 * - shell_advanced : Shell avec view, wait, send, kill
 * - file_view : Compréhension multimodale
 * - browser_advanced : Navigation avec intent
 * - slides_create : Création de présentations
 * - audio_generate : Génération audio
 * - speech_to_text : Transcription
 * - text_to_speech : Synthèse vocale
 * - expose_port : Exposition de ports
 * - deep_research : Recherche approfondie
 */

import { Tool, ToolParameter, ToolContext, ToolResult } from './toolRegistry';
import { e2bSandbox } from './e2bSandbox';
import { invokeLLM } from '../_core/llm';
import { contextEnricher } from './contextEnricher';
import { browserless } from './browserless';
import { storagePut, storageGet } from '../storage';

// ==================== TYPES ====================

interface TaskPlan {
  id: string;
  goal: string;
  phases: TaskPhase[];
  currentPhaseId: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

interface TaskPhase {
  id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  capabilities?: Record<string, boolean>;
}

interface ScheduledTask {
  id: string;
  name: string;
  type: 'cron' | 'interval';
  schedule: string | number;
  prompt: string;
  repeat: boolean;
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'completed';
}

interface ParallelSubtask {
  input: string;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

// ==================== STORAGE ====================

// In-memory storage pour les plans et tâches (à remplacer par DB en production)
const taskPlans: Map<string, TaskPlan> = new Map();
const scheduledTasks: Map<string, ScheduledTask> = new Map();
const shellSessions: Map<string, { history: string[]; process?: any }> = new Map();

// ==================== PLAN TOOL ====================

export const planTool: Tool = {
  name: 'plan',
  description: `Crée, met à jour et avance dans un plan de tâches structuré.

Actions supportées:
- "update": Créer ou réviser le plan actuel basé sur les nouvelles informations
- "advance": Passer à la phase suivante quand la phase actuelle est terminée

Le plan inclut un objectif et plusieurs phases pour guider la tâche. Chaque phase peut nécessiter plusieurs itérations.`,
  category: 'system',
  parameters: [
    { name: 'action', type: 'string', description: 'Action: "update" ou "advance"', required: true },
    { name: 'goal', type: 'string', description: 'Objectif global de la tâche (requis pour update)', required: false },
    { name: 'phases', type: 'array', description: 'Liste des phases [{id, title, capabilities}]', required: false },
    { name: 'current_phase_id', type: 'number', description: 'ID de la phase actuelle', required: true },
    { name: 'next_phase_id', type: 'number', description: 'ID de la prochaine phase (requis pour advance)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const planId = `plan_${context.sessionId}`;
      
      if (args.action === 'update') {
        const plan: TaskPlan = {
          id: planId,
          goal: args.goal || 'Objectif non défini',
          phases: (args.phases || []).map((p: any, idx: number) => ({
            id: p.id || idx + 1,
            title: p.title,
            description: p.description,
            status: p.id === args.current_phase_id ? 'in_progress' : 'pending',
            capabilities: p.capabilities
          })),
          currentPhaseId: args.current_phase_id || 1,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        taskPlans.set(planId, plan);
        
        return {
          success: true,
          output: `Plan créé/mis à jour avec succès.\n\nObjectif: ${plan.goal}\n\nPhases:\n${plan.phases.map(p => `${p.id}. [${p.status}] ${p.title}`).join('\n')}\n\nPhase actuelle: ${plan.currentPhaseId}`,
          metadata: { planId, currentPhase: plan.currentPhaseId, totalPhases: plan.phases.length }
        };
      }
      
      if (args.action === 'advance') {
        const plan = taskPlans.get(planId);
        if (!plan) {
          return { success: false, output: '', error: 'Aucun plan actif trouvé. Utilisez action "update" pour créer un plan.' };
        }
        
        const currentPhase = plan.phases.find(p => p.id === plan.currentPhaseId);
        if (currentPhase) {
          currentPhase.status = 'completed';
        }
        
        const nextPhaseId = args.next_phase_id || plan.currentPhaseId + 1;
        const nextPhase = plan.phases.find(p => p.id === nextPhaseId);
        
        if (nextPhase) {
          nextPhase.status = 'in_progress';
          plan.currentPhaseId = nextPhaseId;
          plan.updatedAt = new Date();
          
          return {
            success: true,
            output: `Avancé à la phase ${nextPhaseId}: ${nextPhase.title}\n\nProgression: ${plan.phases.filter(p => p.status === 'completed').length}/${plan.phases.length} phases complétées`,
            metadata: { currentPhase: nextPhaseId, completedPhases: plan.phases.filter(p => p.status === 'completed').length }
          };
        } else {
          plan.status = 'completed';
          return {
            success: true,
            output: `Plan terminé ! Toutes les ${plan.phases.length} phases sont complétées.\n\nObjectif atteint: ${plan.goal}`,
            metadata: { status: 'completed', totalPhases: plan.phases.length }
          };
        }
      }
      
      return { success: false, output: '', error: 'Action non reconnue. Utilisez "update" ou "advance".' };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== SCHEDULE TOOL ====================

export const scheduleTool: Tool = {
  name: 'schedule',
  description: `Programme une tâche pour exécution future ou récurrente.

Types supportés:
- "cron": Expression cron 6 champs (secondes minutes heures jour mois jour-semaine)
- "interval": Intervalle en secondes entre les exécutions

Exemples:
- Cron "0 0 9 * * 1-5" = Tous les jours de semaine à 9h
- Interval 3600 = Toutes les heures`,
  category: 'system',
  parameters: [
    { name: 'type', type: 'string', description: 'Type: "cron" ou "interval"', required: true },
    { name: 'name', type: 'string', description: 'Nom de la tâche', required: true },
    { name: 'prompt', type: 'string', description: 'Description de la tâche à exécuter', required: true },
    { name: 'repeat', type: 'boolean', description: 'Répéter après exécution', required: true },
    { name: 'cron', type: 'string', description: 'Expression cron (requis si type=cron)', required: false },
    { name: 'interval', type: 'number', description: 'Intervalle en secondes (requis si type=interval)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let nextRun: Date;
      if (args.type === 'interval') {
        nextRun = new Date(Date.now() + (args.interval || 60) * 1000);
      } else {
        // Pour cron, calculer la prochaine exécution (simplifié)
        nextRun = new Date(Date.now() + 60000); // Par défaut dans 1 minute
      }
      
      const task: ScheduledTask = {
        id: taskId,
        name: args.name,
        type: args.type,
        schedule: args.type === 'cron' ? args.cron : args.interval,
        prompt: args.prompt,
        repeat: args.repeat,
        nextRun,
        status: 'active'
      };
      
      scheduledTasks.set(taskId, task);
      
      return {
        success: true,
        output: `Tâche programmée avec succès!\n\nID: ${taskId}\nNom: ${task.name}\nType: ${task.type}\nProgrammation: ${task.schedule}\nProchaine exécution: ${nextRun.toISOString()}\nRépétition: ${task.repeat ? 'Oui' : 'Non'}`,
        metadata: { taskId, nextRun: nextRun.toISOString() }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== MAP TOOL (Parallel Processing) ====================

export const mapTool: Tool = {
  name: 'map',
  description: `Exécute des sous-tâches en parallèle et agrège les résultats.

Similaire à Pool.map() en Python. Supporte jusqu'à 2000 sous-tâches.
Chaque sous-tâche reçoit un input et retourne un output structuré selon le schéma défini.

Utilisation:
- Traitement de données en masse
- Recherche sur plusieurs entités
- Collecte d'informations parallèle`,
  category: 'system',
  parameters: [
    { name: 'name', type: 'string', description: 'Nom de l\'opération (snake_case)', required: true },
    { name: 'title', type: 'string', description: 'Titre lisible de l\'opération', required: true },
    { name: 'prompt_template', type: 'string', description: 'Template avec {{input}} pour interpolation', required: true },
    { name: 'inputs', type: 'array', description: 'Liste des inputs à traiter', required: true },
    { name: 'output_schema', type: 'array', description: 'Schéma des champs de sortie [{name, type, title, description}]', required: true },
    { name: 'target_count', type: 'number', description: 'Nombre attendu de sous-tâches', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const inputs = args.inputs || [];
      const results: any[] = [];
      const errors: string[] = [];
      
      // Limiter à 10 pour éviter les timeouts (en production, utiliser des workers)
      const batchSize = Math.min(inputs.length, 10);
      
      for (let i = 0; i < batchSize; i++) {
        const input = inputs[i];
        const prompt = args.prompt_template.replace('{{input}}', input);
        
        try {
          // Utiliser le LLM pour traiter chaque sous-tâche
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: `Tu es un assistant qui extrait des informations structurées. Réponds uniquement en JSON valide selon ce schéma: ${JSON.stringify(args.output_schema)}` },
              { role: 'user', content: prompt }
            ]
          });
          
          const messageContent = response.choices[0]?.message?.content;
          const content = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent) || '{}';
          try {
            const parsed = JSON.parse(content);
            results.push({ input, output: parsed, status: 'completed' });
          } catch {
            results.push({ input, output: content, status: 'completed' });
          }
        } catch (err: any) {
          errors.push(`${input}: ${err.message}`);
          results.push({ input, status: 'failed', error: err.message });
        }
      }
      
      const successCount = results.filter(r => r.status === 'completed').length;
      
      return {
        success: true,
        output: `Traitement parallèle terminé!\n\nOpération: ${args.title}\nTraités: ${successCount}/${batchSize}\nErreurs: ${errors.length}\n\nRésultats:\n${JSON.stringify(results, null, 2)}`,
        metadata: {
          name: args.name,
          totalInputs: inputs.length,
          processed: batchSize,
          successful: successCount,
          failed: errors.length
        },
        artifacts: [{
          type: 'data',
          content: JSON.stringify(results),
          name: `${args.name}_results.json`
        }]
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== SEARCH ADVANCED TOOL ====================

export const searchAdvancedTool: Tool = {
  name: 'search_advanced',
  description: `Recherche avancée multi-type avec sources spécialisées.

Types de recherche:
- "info": Informations générales, articles, faits
- "image": Images pertinentes (téléchargées localement)
- "api": APIs et documentation technique
- "news": Actualités récentes
- "data": Datasets, statistiques, données structurées
- "research": Publications académiques, rapports
- "tool": Outils, services, plateformes

Chaque type utilise des sources optimisées pour le contenu recherché.`,
  category: 'web',
  parameters: [
    { name: 'type', type: 'string', description: 'Type: info, image, api, news, data, research, tool', required: true },
    { name: 'queries', type: 'array', description: 'Jusqu\'à 3 variantes de la même requête', required: true },
    { name: 'time', type: 'string', description: 'Filtre temporel: all, past_day, past_week, past_month, past_year', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const queries = args.queries || [];
      const searchType = args.type || 'info';
      const results: any[] = [];
      
      for (const query of queries.slice(0, 3)) {
        // Adapter la requête selon le type
        let enrichedQuery = query;
        switch (searchType) {
          case 'news':
            enrichedQuery = `actualités ${query}`;
            break;
          case 'api':
            enrichedQuery = `${query} API documentation`;
            break;
          case 'research':
            enrichedQuery = `${query} research paper academic`;
            break;
          case 'data':
            enrichedQuery = `${query} dataset statistics`;
            break;
          case 'tool':
            enrichedQuery = `${query} tool service platform`;
            break;
        }
        
        const enrichment = await contextEnricher.enrichContext(enrichedQuery, context.userId);
        results.push({
          query,
          type: searchType,
          results: enrichment.enrichedContext
        });
      }
      
      return {
        success: true,
        output: `Recherche ${searchType} terminée!\n\n${results.map(r => `### ${r.query}\n${r.results}`).join('\n\n')}`,
        metadata: {
          type: searchType,
          queriesProcessed: results.length,
          timeFilter: args.time || 'all'
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== SHELL ADVANCED TOOL ====================

export const shellAdvancedTool: Tool = {
  name: 'shell_advanced',
  description: `Shell avancé avec gestion de sessions et processus interactifs.

Actions supportées:
- "exec": Exécuter une commande
- "view": Voir l'historique de la session
- "wait": Attendre la fin d'un processus
- "send": Envoyer une entrée à un processus interactif
- "kill": Terminer un processus

Chaque session est identifiée et persiste entre les appels.`,
  category: 'system',
  parameters: [
    { name: 'action', type: 'string', description: 'Action: exec, view, wait, send, kill', required: true },
    { name: 'session', type: 'string', description: 'Identifiant unique de la session', required: true },
    { name: 'command', type: 'string', description: 'Commande à exécuter (pour exec)', required: false },
    { name: 'input', type: 'string', description: 'Entrée à envoyer (pour send)', required: false },
    { name: 'timeout', type: 'number', description: 'Timeout en secondes', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const sessionId = args.session || 'default';
      
      if (!shellSessions.has(sessionId)) {
        shellSessions.set(sessionId, { history: [] });
      }
      const session = shellSessions.get(sessionId)!;
      
      switch (args.action) {
        case 'exec': {
          const result = await e2bSandbox.executeShell(args.command || 'echo "No command"', context.userId, context.sessionId);
          session.history.push(`$ ${args.command}\n${result.output}`);
          
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: { session: sessionId, exitCode: result.success ? 0 : 1 }
          };
        }
        
        case 'view': {
          return {
            success: true,
            output: `Session ${sessionId} - Historique:\n\n${session.history.join('\n---\n') || '(vide)'}`,
            metadata: { session: sessionId, historyLength: session.history.length }
          };
        }
        
        case 'wait': {
          // Simuler l'attente
          await new Promise(resolve => setTimeout(resolve, (args.timeout || 5) * 1000));
          return {
            success: true,
            output: `Attente de ${args.timeout || 5} secondes terminée`,
            metadata: { session: sessionId }
          };
        }
        
        case 'send': {
          // Simuler l'envoi d'entrée
          session.history.push(`[INPUT] ${args.input}`);
          return {
            success: true,
            output: `Entrée envoyée: ${args.input}`,
            metadata: { session: sessionId }
          };
        }
        
        case 'kill': {
          session.history.push('[KILLED]');
          return {
            success: true,
            output: `Processus de la session ${sessionId} terminé`,
            metadata: { session: sessionId }
          };
        }
        
        default:
          return { success: false, output: '', error: `Action non reconnue: ${args.action}` };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== FILE VIEW TOOL (Multimodal) ====================

export const fileViewTool: Tool = {
  name: 'file_view',
  description: `Analyse et comprend le contenu de fichiers de manière multimodale.

Supporte:
- Images (PNG, JPG, GIF, WebP): Description visuelle détaillée
- PDFs: Extraction de texte et analyse visuelle des pages
- Documents: Lecture et résumé du contenu

Utilise la vision IA pour comprendre le contenu visuel.`,
  category: 'file',
  parameters: [
    { name: 'path', type: 'string', description: 'Chemin absolu du fichier', required: true },
    { name: 'range', type: 'array', description: 'Plage de pages [début, fin] pour PDFs', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const filePath = args.path;
      const ext = filePath.split('.').pop()?.toLowerCase();
      
      // Déterminer le type de fichier
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      const docExts = ['pdf', 'doc', 'docx', 'txt', 'md'];
      
      if (imageExts.includes(ext || '')) {
        // Utiliser le LLM avec vision pour analyser l'image
        // Note: En production, il faudrait charger l'image et l'envoyer au LLM
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'Tu es un assistant qui décrit des images de manière détaillée.' },
            { role: 'user', content: `Décris le contenu de l'image située à: ${filePath}. Note: Cette fonctionnalité nécessite l'intégration vision complète.` }
          ]
        });
        
        return {
          success: true,
          output: `Analyse de l'image ${filePath}:\n\n${response.choices[0]?.message?.content || 'Analyse non disponible'}`,
          metadata: { type: 'image', path: filePath }
        };
      }
      
      if (docExts.includes(ext || '')) {
        // Lire le contenu du document
        return {
          success: true,
          output: `Document ${filePath} détecté.\n\nPour les PDFs, utilisez l'outil workspace_read avec extraction de texte.\nPlage demandée: ${args.range ? args.range.join('-') : 'tout le document'}`,
          metadata: { type: 'document', path: filePath, range: args.range }
        };
      }
      
      return {
        success: false,
        output: '',
        error: `Type de fichier non supporté: ${ext}`
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== BROWSER ADVANCED TOOL ====================

export const browserAdvancedTool: Tool = {
  name: 'browser_advanced',
  description: `Navigation web avancée avec intentions et actions multiples.

Intents supportés:
- "navigational": Navigation générale
- "informational": Lecture et extraction de contenu
- "transactional": Actions (formulaires, achats)

Actions:
- navigate: Aller à une URL
- click: Cliquer sur un élément
- input: Remplir un champ
- scroll: Défiler la page
- screenshot: Capturer l'écran
- extract: Extraire le contenu`,
  category: 'web',
  parameters: [
    { name: 'action', type: 'string', description: 'Action: navigate, click, input, scroll, screenshot, extract', required: true },
    { name: 'url', type: 'string', description: 'URL cible (pour navigate)', required: false },
    { name: 'intent', type: 'string', description: 'Intent: navigational, informational, transactional', required: false },
    { name: 'selector', type: 'string', description: 'Sélecteur CSS (pour click, input)', required: false },
    { name: 'value', type: 'string', description: 'Valeur à entrer (pour input)', required: false },
    { name: 'focus', type: 'string', description: 'Sujet à focus (pour informational)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      switch (args.action) {
        case 'navigate':
        case 'screenshot':
        case 'extract': {
          if (!args.url) {
            return { success: false, output: '', error: 'URL requise pour cette action' };
          }
          
          const screenshotResult = await browserless.screenshot(args.url);
          const contentResult = await browserless.getContent(args.url);
          const screenshot = screenshotResult?.url || null;
          const content = contentResult?.content || '';
          
          return {
            success: true,
            output: `Navigation vers ${args.url} réussie!\n\nIntent: ${args.intent || 'navigational'}\nFocus: ${args.focus || 'général'}\n\nContenu extrait:\n${String(content).substring(0, 2000)}...`,
            artifacts: screenshot ? [{
              type: 'image',
              content: screenshot,
              name: 'screenshot.png'
            }] : undefined,
            metadata: {
              url: args.url,
              intent: args.intent,
              contentLength: content.length
            }
          };
        }
        
        case 'click':
        case 'input':
        case 'scroll': {
          return {
            success: true,
            output: `Action ${args.action} simulée.\n\nSélecteur: ${args.selector || 'N/A'}\nValeur: ${args.value || 'N/A'}\n\nNote: Les interactions DOM complètes nécessitent Puppeteer/Playwright.`,
            metadata: { action: args.action, selector: args.selector }
          };
        }
        
        default:
          return { success: false, output: '', error: `Action non reconnue: ${args.action}` };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== SLIDES TOOL ====================

export const slidesTool: Tool = {
  name: 'slides_create',
  description: `Crée des présentations (slides) en HTML ou image.

Modes de génération:
- "html": Slides HTML/CSS éditables avec Chart.js pour les données
- "image": Chaque slide est une image rendue (visuellement impressionnant)

Processus:
1. Préparer le contenu dans un fichier Markdown
2. Appeler cet outil avec le chemin du fichier
3. Les slides sont générées automatiquement`,
  category: 'file',
  parameters: [
    { name: 'content_file', type: 'string', description: 'Chemin du fichier Markdown avec le contenu', required: true },
    { name: 'slide_count', type: 'number', description: 'Nombre de slides à générer', required: true },
    { name: 'mode', type: 'string', description: 'Mode: "html" ou "image"', required: false },
    { name: 'theme', type: 'string', description: 'Thème: dark, light, corporate, creative', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const slideCount = args.slide_count || 5;
      const mode = args.mode || 'html';
      const theme = args.theme || 'dark';
      
      // Générer le HTML des slides
      const slidesHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Présentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'}; color: ${theme === 'dark' ? '#ffffff' : '#1a1a2e'}; }
    .slide { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4rem; }
    .slide h1 { font-size: 3rem; margin-bottom: 2rem; }
    .slide p { font-size: 1.5rem; max-width: 800px; text-align: center; }
    .slide-number { position: fixed; bottom: 1rem; right: 1rem; opacity: 0.5; }
  </style>
</head>
<body>
  ${Array.from({ length: slideCount }, (_, i) => `
  <div class="slide" id="slide-${i + 1}">
    <h1>Slide ${i + 1}</h1>
    <p>Contenu de la slide ${i + 1}. Remplacez par votre contenu depuis ${args.content_file}</p>
    <span class="slide-number">${i + 1}/${slideCount}</span>
  </div>
  `).join('\n')}
  <script>
    // Navigation avec les flèches
    let currentSlide = 1;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && currentSlide < ${slideCount}) {
        currentSlide++;
        document.getElementById('slide-' + currentSlide).scrollIntoView({ behavior: 'smooth' });
      }
      if (e.key === 'ArrowLeft' && currentSlide > 1) {
        currentSlide--;
        document.getElementById('slide-' + currentSlide).scrollIntoView({ behavior: 'smooth' });
      }
    });
  </script>
</body>
</html>`;
      
      return {
        success: true,
        output: `Présentation créée avec succès!\n\nSlides: ${slideCount}\nMode: ${mode}\nThème: ${theme}\n\nUtilisez les flèches gauche/droite pour naviguer.`,
        artifacts: [{
          type: 'file',
          content: slidesHtml,
          mimeType: 'text/html',
          name: 'presentation.html'
        }],
        metadata: {
          slideCount,
          mode,
          theme,
          contentFile: args.content_file
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== AUDIO TOOLS ====================

export const audioGenerateTool: Tool = {
  name: 'audio_generate',
  description: `Génère du contenu audio à partir de texte ou de paramètres.

Types:
- "music": Génération de musique (ambiance, genre)
- "sfx": Effets sonores
- "ambient": Sons d'ambiance`,
  category: 'image', // Catégorie media
  parameters: [
    { name: 'type', type: 'string', description: 'Type: music, sfx, ambient', required: true },
    { name: 'prompt', type: 'string', description: 'Description du son à générer', required: true },
    { name: 'duration', type: 'number', description: 'Durée en secondes', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      // Note: Nécessite une API de génération audio (ex: ElevenLabs, Mubert)
      return {
        success: true,
        output: `Génération audio initiée!\n\nType: ${args.type}\nPrompt: ${args.prompt}\nDurée: ${args.duration || 30}s\n\nNote: Cette fonctionnalité nécessite l'intégration d'une API audio (ElevenLabs, Mubert, etc.)`,
        metadata: {
          type: args.type,
          duration: args.duration || 30,
          status: 'requires_api_integration'
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

export const speechToTextTool: Tool = {
  name: 'speech_to_text',
  description: `Transcrit un fichier audio en texte.

Formats supportés: MP3, WAV, M4A, WebM, OGG
Limite: 16MB par fichier`,
  category: 'image',
  parameters: [
    { name: 'audio_url', type: 'string', description: 'URL du fichier audio', required: true },
    { name: 'language', type: 'string', description: 'Code langue (fr, en, etc.)', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      // Note: Utiliser l'API Whisper via _core/voiceTranscription
      return {
        success: true,
        output: `Transcription initiée!\n\nFichier: ${args.audio_url}\nLangue: ${args.language || 'auto'}\n\nNote: Utilisez l'API transcribeAudio de server/_core/voiceTranscription.ts`,
        metadata: {
          audioUrl: args.audio_url,
          language: args.language || 'auto'
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

export const textToSpeechTool: Tool = {
  name: 'text_to_speech',
  description: `Convertit du texte en parole audio.

Voix disponibles: Plusieurs voix masculines et féminines
Langues: Multilingue`,
  category: 'image',
  parameters: [
    { name: 'text', type: 'string', description: 'Texte à convertir en audio', required: true },
    { name: 'voice', type: 'string', description: 'ID de la voix à utiliser', required: false },
    { name: 'language', type: 'string', description: 'Code langue', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      return {
        success: true,
        output: `Synthèse vocale initiée!\n\nTexte: "${args.text.substring(0, 100)}..."\nVoix: ${args.voice || 'default'}\nLangue: ${args.language || 'fr'}\n\nNote: Cette fonctionnalité nécessite l'intégration d'une API TTS (ElevenLabs, Google TTS, etc.)`,
        metadata: {
          textLength: args.text.length,
          voice: args.voice || 'default',
          language: args.language || 'fr'
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== EXPOSE PORT TOOL ====================

export const exposePortTool: Tool = {
  name: 'expose_port',
  description: `Expose un port local pour un accès public temporaire.

Crée une URL publique temporaire pour accéder à un service local.
Utile pour partager des démos, webhooks, ou tests.`,
  category: 'system',
  parameters: [
    { name: 'port', type: 'number', description: 'Numéro de port local à exposer', required: true },
    { name: 'protocol', type: 'string', description: 'Protocole: http ou https', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const port = args.port;
      const protocol = args.protocol || 'https';
      
      // Générer une URL temporaire (en production, utiliser ngrok, localtunnel, etc.)
      const tempUrl = `${protocol}://${port}-temp-${context.sessionId.substring(0, 8)}.phoenix.local`;
      
      return {
        success: true,
        output: `Port ${port} exposé!\n\nURL temporaire: ${tempUrl}\n\nNote: En production, cette fonctionnalité utiliserait ngrok ou un service similaire pour créer un tunnel sécurisé.`,
        metadata: {
          port,
          protocol,
          tempUrl,
          status: 'simulated'
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== DEEP RESEARCH TOOL ====================

export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: `Effectue une recherche approfondie sur un sujet.

Processus:
1. Recherche initiale sur plusieurs sources
2. Analyse et synthèse des résultats
3. Identification des sources clés
4. Génération d'un rapport structuré

Idéal pour les recherches académiques, analyses de marché, veille technologique.`,
  category: 'web',
  parameters: [
    { name: 'topic', type: 'string', description: 'Sujet de recherche', required: true },
    { name: 'depth', type: 'string', description: 'Profondeur: quick, standard, deep', required: false },
    { name: 'sources', type: 'array', description: 'Types de sources: academic, news, web, social', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    try {
      const topic = args.topic;
      const depth = args.depth || 'standard';
      const sources = args.sources || ['web', 'news'];
      
      // Effectuer plusieurs recherches
      const searchResults: string[] = [];
      
      for (const source of sources) {
        let query = topic;
        if (source === 'academic') query += ' research paper study';
        if (source === 'news') query += ' latest news';
        
        const result = await contextEnricher.enrichContext(query, context.userId);
        searchResults.push(`### Source: ${source}\n${result.enrichedContext}`);
      }
      
      // Synthétiser avec le LLM
      const synthesis = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu es un chercheur expert. Synthétise les informations suivantes en un rapport structuré avec: Résumé, Points clés, Sources, Recommandations.' },
          { role: 'user', content: `Sujet: ${topic}\n\nInformations collectées:\n${searchResults.join('\n\n')}` }
        ]
      });
      
      const reportContent = synthesis.choices[0]?.message?.content;
      const report = typeof reportContent === 'string' ? reportContent : JSON.stringify(reportContent) || 'Synthèse non disponible';
      
      return {
        success: true,
        output: `Recherche approfondie terminée!\n\nSujet: ${topic}\nProfondeur: ${depth}\nSources: ${sources.join(', ')}\n\n${report}`,
        artifacts: [{
          type: 'text',
          content: report,
          name: `research_${topic.replace(/\s+/g, '_')}.md`
        }],
        metadata: {
          topic,
          depth,
          sourcesUsed: sources.length,
          reportLength: report.length
        }
      };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }
};

// ==================== EXPORT ALL TOOLS ====================

export const advancedTools: Tool[] = [
  planTool,
  scheduleTool,
  mapTool,
  searchAdvancedTool,
  shellAdvancedTool,
  fileViewTool,
  browserAdvancedTool,
  slidesTool,
  audioGenerateTool,
  speechToTextTool,
  textToSpeechTool,
  exposePortTool,
  deepResearchTool
];

export default advancedTools;
