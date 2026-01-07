/**
 * Agent Loop RÉEL pour Phoenix
 * 
 * Ce module permet à Phoenix d'exécuter des tâches multi-étapes automatiquement,
 * exactement comme Manus. Pas de simulation - tout est RÉEL.
 * 
 * Outils RÉELS intégrés:
 * - Browserless.io: Vrai Chrome dans le cloud
 * - E2B Sandbox: Vraie exécution Python/JS
 * - Serper API: Vraie recherche Google
 * - Groq/Google AI: Vrais LLMs
 */

import { browserless } from './browserless';
import { serperApi } from './serperApi';
import { invokeLLM } from '../_core/llm';
import { e2bSandbox } from './e2bSandbox';

// Types pour l'Agent Loop
export interface AgentTask {
  id: string;
  type: 'browse' | 'search' | 'code' | 'analyze' | 'generate' | 'save';
  description: string;
  input: string;
  dependencies?: string[];
}

export interface AgentPlan {
  goal: string;
  tasks: AgentTask[];
  currentTaskIndex: number;
  results: Map<string, AgentTaskResult>;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export interface AgentTaskResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface AgentLoopConfig {
  maxIterations: number;
  maxTasksPerPlan: number;
  timeoutPerTask: number;
  onProgress?: (message: string, progress: number) => void;
}

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxIterations: 30,
  maxTasksPerPlan: 10,
  timeoutPerTask: 60000,
};

/**
 * Décompose un objectif complexe en sous-tâches via LLM
 */
export async function decomposeTask(
  goal: string,
  context: string = ''
): Promise<AgentTask[]> {
  const systemPrompt = `Tu es un planificateur de tâches expert. Tu dois décomposer un objectif complexe en sous-tâches exécutables.

Chaque tâche doit avoir:
- type: "search" (recherche web Google), "browse" (extraire contenu d'une URL spécifique), "code" (exécuter du code), "analyze" (synthétiser des résultats), "generate" (créer du contenu)
- description: ce que la tâche doit accomplir
- input: l'entrée nécessaire

RÈGLES CRITIQUES:
1. TOUJOURS commencer par "search" pour trouver des informations - c'est une vraie recherche Google via Serper API
2. "search" input = mots-clés simples (ex: "news intelligence artificielle 2025", "bitcoin price today")
3. "browse" = UNIQUEMENT si tu as une URL spécifique à visiter (ex: "https://example.com/article")
4. NE JAMAIS utiliser "browse" pour chercher des informations - utilise "search"
5. Maximum 5 tâches pour être efficace

EXEMPLE CORRECT:
- Objectif: "Trouve les news sur l'IA"
- Tâche 1: {"type": "search", "input": "artificial intelligence news 2025"}
- Tâche 2: {"type": "analyze", "input": "{{result_1}}"}

EXEMPLE INCORRECT:
- Tâche 1: {"type": "browse", "input": "https://bbc.com/search?q=AI"} ← FAUX! Utilise "search"

Réponds UNIQUEMENT avec un JSON valide:
{
  "tasks": [
    {"id": "1", "type": "search", "description": "...", "input": "mots clés simples"},
    {"id": "2", "type": "analyze", "description": "...", "input": "{{result_1}}", "dependencies": ["1"]}
  ]
}`;

  const userPrompt = `Objectif: ${goal}

${context ? `Contexte: ${context}` : ''}

Décompose cet objectif en sous-tâches exécutables.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '{"tasks": []}';
    const parsed = JSON.parse(content);
    
    return parsed.tasks || [];
  } catch (error) {
    console.error('[AgentLoop] Erreur décomposition:', error);
    return [{
      id: '1',
      type: 'analyze',
      description: goal,
      input: goal
    }];
  }
}

/**
 * Exécute une tâche individuelle avec les vrais outils
 */
export async function executeTask(
  task: AgentTask,
  previousResults: Map<string, AgentTaskResult>,
  config: AgentLoopConfig
): Promise<AgentTaskResult> {
  const startTime = Date.now();
  
  let input = task.input;
  previousResults.forEach((result, taskId) => {
    input = input.replace(`{{result_${taskId}}}`, result.output);
  });

  try {
    let output = '';

    switch (task.type) {
      case 'browse': {
        console.log(`[AgentLoop] 🌐 Browsing: ${input}`);
        const browseResult = await browserless.getContent(input);
        if (browseResult.success) {
          output = `Page: ${browseResult.title}\n\nContenu:\n${browseResult.content?.substring(0, 5000) || 'Pas de contenu'}`;
        } else {
          throw new Error(browseResult.error || 'Échec du browsing');
        }
        break;
      }

      case 'search': {
        console.log(`[AgentLoop] 🔍 Recherche SERPER API: ${input}`);
        console.log(`[AgentLoop] ⏱️ Appel API Serper en cours...`);
        const searchResults = await serperApi.search(input);
        if (searchResults && searchResults.length > 0) {
          output = searchResults
            .slice(0, 5)
            .map((r: { title: string; link: string; snippet: string }, i: number) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
            .join('\n\n');
        } else {
          const newsResults = await serperApi.searchNews(input);
          if (newsResults && newsResults.length > 0) {
            output = newsResults
              .slice(0, 5)
              .map((r: { title: string; link: string; snippet: string }, i: number) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
              .join('\n\n');
          } else {
            throw new Error('Aucun résultat de recherche');
          }
        }
        break;
      }

      case 'code': {
        console.log(`[AgentLoop] 💻 Exécution code`);
        const codeResult = await e2bSandbox.executePython(input, 'agent-loop', 'Phoenix Agent');
        output = codeResult.output || codeResult.error || 'Pas de sortie';
        break;
      }

      case 'analyze': {
        console.log(`[AgentLoop] 🧠 Analyse`);
        const analysisResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'Tu es un analyste expert. Analyse les données fournies et donne une synthèse claire et structurée.' },
            { role: 'user', content: input }
          ]
        });
        const analysisContent = analysisResponse.choices[0]?.message?.content;
        output = typeof analysisContent === 'string' ? analysisContent : 'Analyse non disponible';
        break;
      }

      case 'generate': {
        console.log(`[AgentLoop] ✨ Génération`);
        const generateResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'Tu es un rédacteur expert. Génère le contenu demandé de manière professionnelle et structurée.' },
            { role: 'user', content: input }
          ]
        });
        const generateContent = generateResponse.choices[0]?.message?.content;
        output = typeof generateContent === 'string' ? generateContent : 'Contenu non généré';
        break;
      }

      case 'save': {
        console.log(`[AgentLoop] 💾 Sauvegarde`);
        output = `Contenu à sauvegarder:\n${input}`;
        break;
      }

      default:
        throw new Error(`Type de tâche inconnu: ${task.type}`);
    }

    return {
      taskId: task.id,
      success: true,
      output,
      duration: Date.now() - startTime
    };

  } catch (error) {
    console.error(`[AgentLoop] Erreur tâche ${task.id}:`, error);
    return {
      taskId: task.id,
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  }
}

/**
 * Exécute la boucle d'agent complète
 */
export async function runAgentLoop(
  goal: string,
  context: string = '',
  config: Partial<AgentLoopConfig> = {},
  onProgress?: (message: string, progress: number) => void
): Promise<{
  success: boolean;
  finalOutput: string;
  tasks: AgentTaskResult[];
  totalDuration: number;
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config, onProgress };
  const startTime = Date.now();
  const results: AgentTaskResult[] = [];
  const resultsMap = new Map<string, AgentTaskResult>();

  onProgress?.('🎯 Décomposition de la tâche...', 0);

  const tasks = await decomposeTask(goal, context);
  
  if (tasks.length === 0) {
    return {
      success: false,
      finalOutput: 'Impossible de décomposer la tâche',
      tasks: [],
      totalDuration: Date.now() - startTime
    };
  }

  console.log(`[AgentLoop] Plan créé avec ${tasks.length} tâches`);
  onProgress?.(`📋 Plan créé: ${tasks.length} tâches`, 10);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const progress = 10 + ((i / tasks.length) * 80);
    
    onProgress?.(`⚡ Exécution: ${task.description}`, progress);
    console.log(`[AgentLoop] Exécution tâche ${i + 1}/${tasks.length}: ${task.type} - ${task.description}`);

    if (task.dependencies) {
      for (const depId of task.dependencies) {
        const depResult = resultsMap.get(depId);
        if (!depResult || !depResult.success) {
          console.log(`[AgentLoop] Dépendance ${depId} non satisfaite, skip tâche ${task.id}`);
          continue;
        }
      }
    }

    const result = await executeTask(task, resultsMap, fullConfig);
    results.push(result);
    resultsMap.set(task.id, result);

    if (!result.success) {
      console.log(`[AgentLoop] Tâche ${task.id} échouée: ${result.error}`);
    }
  }

  onProgress?.('🔄 Synthèse des résultats...', 90);

  const successfulResults = results.filter(r => r.success);
  const combinedOutput = successfulResults.map(r => r.output).join('\n\n---\n\n');

  let finalOutput = '';
  if (combinedOutput) {
    try {
      const synthesisResponse = await invokeLLM({
        messages: [
          { 
            role: 'system', 
            content: `Tu es un assistant qui synthétise les résultats d'une recherche multi-étapes.
Objectif initial: ${goal}

Présente les résultats de manière claire, structurée et utile pour l'utilisateur.
Utilise des titres, des listes et des paragraphes pour organiser l'information.` 
          },
          { role: 'user', content: `Voici les résultats des différentes étapes:\n\n${combinedOutput}\n\nSynthétise ces informations.` }
        ]
      });
      const synthesisContent = synthesisResponse.choices[0]?.message?.content;
      finalOutput = typeof synthesisContent === 'string' ? synthesisContent : combinedOutput;
    } catch (error) {
      console.error('[AgentLoop] Erreur synthèse:', error);
      finalOutput = combinedOutput;
    }
  } else {
    finalOutput = 'Aucun résultat obtenu.';
  }

  onProgress?.('✅ Terminé!', 100);

  return {
    success: successfulResults.length > 0,
    finalOutput,
    tasks: results,
    totalDuration: Date.now() - startTime
  };
}

/**
 * Détecte si une requête nécessite l'Agent Loop (tâche complexe multi-étapes)
 */
export function shouldUseAgentLoop(message: string): boolean {
  const complexPatterns = [
    /recherche.*et.*(analyse|résume|compare|synthétise)/i,
    /analyse.*les.*news/i,
    /fais.*un.*rapport/i,
    /compare.*plusieurs/i,
    /va.*sur.*plusieurs/i,
    /visite.*différents/i,
    /parcours.*les.*sites/i,
    /d'abord.*puis/i,
    /puis.*ensuite/i,
    /étape.*1.*étape.*2/i,
    /premièrement.*deuxièmement/i,
    /collecte.*données/i,
    /récupère.*informations.*de.*plusieurs/i,
    /rassemble.*les/i,
    /génère.*un.*rapport/i,
    /crée.*une.*synthèse/i,
    /génère.*synthèse/i,
    /produis.*un.*document/i,
    /compare.*et.*analyse/i,
    /évalue.*différentes/i,
    /benchmark/i
  ];

  return complexPatterns.some(pattern => pattern.test(message));
}

/**
 * Point d'entrée principal pour l'Agent Loop
 */
export async function processWithAgentLoop(
  message: string,
  context: string = '',
  onProgress?: (message: string, progress: number) => void
): Promise<string> {
  console.log('[AgentLoop] Démarrage pour:', message.substring(0, 100));
  
  const result = await runAgentLoop(message, context, {}, onProgress);
  
  if (result.success) {
    return result.finalOutput;
  } else {
    return `⚠️ L'Agent Loop a rencontré des difficultés.\n\n${result.finalOutput}`;
  }
}
