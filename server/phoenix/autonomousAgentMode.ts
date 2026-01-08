/**
 * Mode Agent Autonome pour Phoenix
 * 
 * Permet à Phoenix d'enchaîner automatiquement plusieurs actions
 * comme Manus AI : recherche → résumé → image
 */

import { invokeLLM } from '../_core/llm';
import { generateImage } from '../_core/imageGeneration';

// Types pour le mode agent
export interface AgentAction {
  type: 'search' | 'summarize' | 'generate_image' | 'execute_code' | 'analyze' | 'create_site';
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  duration?: number;
}

export interface AgentPipeline {
  id: string;
  query: string;
  actions: AgentAction[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  finalResult?: string;
}

export interface AgentModeConfig {
  maxActions: number;
  enableAutoImage: boolean;
  enableAutoSummary: boolean;
  verboseMode: boolean;
}

// Patterns pour détecter les tâches multi-étapes
const MULTI_STEP_PATTERNS = [
  // Recherche + résumé
  /recherche.*(?:et|puis).*(?:résume|synthétise|explique)/i,
  /(?:trouve|cherche).*(?:et|puis).*(?:fais|génère|crée).*(?:résumé|synthèse)/i,
  
  // Recherche + image
  /recherche.*(?:et|puis).*(?:génère|crée|fais).*image/i,
  /(?:trouve|cherche).*(?:et|puis).*(?:illustre|dessine|montre)/i,
  /(?:trouve|cherche).*puis.*(?:crée|génère).*image/i,
  
  // Analyse complète
  /(?:analyse|étudie).*(?:complète|détaillée|approfondie)/i,
  /(?:fais|donne).*(?:une|un).*(?:analyse|étude).*(?:complète|détaillée)/i,
  
  // Création + illustration
  /(?:crée|génère).*(?:et|puis).*(?:illustre|ajoute.*image)/i,
  
  // Patterns explicites multi-actions
  /recherche.*résumé.*image/i,
];

// Patterns pour exclure les conversations simples (salutations, questions basiques)
const SIMPLE_CONVERSATION_PATTERNS = [
  // Salutations
  /^(bonjour|salut|hello|hi|hey|coucou|bonsoir|yo)[!?,.]?\s*(comment|ça|tu|vas|allez)?/i,
  /^(comment\s+)?(ça\s+va|vas-tu|allez-vous|tu\s+vas)[?!]?$/i,
  /^(merci|thanks|thank you|super|génial|parfait|ok|d'accord|bien)[!.]?$/i,
  /^(au revoir|bye|à bientôt|à plus|ciao)[!.]?$/i,
  
  // Questions simples sur Phoenix
  /^(qui\s+es-tu|tu\s+es\s+qui|c'est\s+quoi\s+phoenix|qu'est-ce\s+que\s+tu\s+peux\s+faire)[?]?$/i,
  /^(aide|help|sos)[!?]?$/i,
  
  // Réponses courtes
  /^(oui|non|peut-être|yes|no|maybe)[!?.]?$/i,
  /^(je\s+ne\s+sais\s+pas|aucune\s+idée)[!?.]?$/i,
  
  // Questions personnelles simples
  /^(quel\s+est\s+ton\s+nom|comment\s+tu\s+t'appelles)[?]?$/i,
  /^(tu\s+peux\s+m'aider)[?]?$/i,
];

// Patterns pour identifier le type de tâche finale souhaitée
const TASK_TYPE_PATTERNS = {
  search: [
    /recherche|cherche|trouve|google|actualités|news|infos sur/i,
  ],
  summarize: [
    /résume|synthétise|explique|simplifie|vulgarise/i,
  ],
  image: [
    /image|illustration|dessin|photo|visuel|montre|dessine/i,
  ],
  code: [
    /code|script|programme|calcule|exécute/i,
  ],
  site: [
    /site|page web|landing page|portfolio/i,
  ],
};

/**
 * Vérifie si la requête est une conversation simple
 */
export function isSimpleConversation(query: string): boolean {
  const trimmedQuery = query.trim();
  // Vérifier si c'est une conversation simple
  if (SIMPLE_CONVERSATION_PATTERNS.some(pattern => pattern.test(trimmedQuery))) {
    return true;
  }
  // Vérifier si c'est une requête très courte (moins de 20 caractères sans mots-clés d'action)
  if (trimmedQuery.length < 20 && !/(recherche|trouve|cherche|analyse|crée|génère|fais|exécute)/i.test(trimmedQuery)) {
    return true;
  }
  return false;
}

/**
 * Détecte si une requête nécessite plusieurs actions
 */
export function detectMultiStepTask(query: string): boolean {
  // D'abord exclure les conversations simples
  if (isSimpleConversation(query)) {
    return false;
  }
  return MULTI_STEP_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Analyse la requête et planifie les actions nécessaires
 */
export async function planAgentActions(query: string): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Détection des actions nécessaires
  const needsSearch = TASK_TYPE_PATTERNS.search.some(p => p.test(lowerQuery));
  const needsSummary = TASK_TYPE_PATTERNS.summarize.some(p => p.test(lowerQuery));
  const needsImage = TASK_TYPE_PATTERNS.image.some(p => p.test(lowerQuery));
  const needsCode = TASK_TYPE_PATTERNS.code.some(p => p.test(lowerQuery));
  const needsSite = TASK_TYPE_PATTERNS.site.some(p => p.test(lowerQuery));
  
  // Extraire le sujet principal
  const subject = extractSubject(query);
  
  // Construire le pipeline d'actions
  if (needsSearch || detectMultiStepTask(query)) {
    actions.push({
      type: 'search',
      input: subject,
      status: 'pending',
    });
  }
  
  if (needsSummary || detectMultiStepTask(query)) {
    actions.push({
      type: 'summarize',
      input: subject,
      status: 'pending',
    });
  }
  
  if (needsImage) {
    actions.push({
      type: 'generate_image',
      input: subject,
      status: 'pending',
    });
  }
  
  if (needsCode) {
    actions.push({
      type: 'execute_code',
      input: subject,
      status: 'pending',
    });
  }
  
  if (needsSite) {
    actions.push({
      type: 'create_site',
      input: subject,
      status: 'pending',
    });
  }
  
  // Si aucune action détectée mais c'est multi-step, utiliser LLM pour planifier
  if (actions.length === 0 && detectMultiStepTask(query)) {
    return await planWithLLM(query);
  }
  
  return actions;
}

/**
 * Extrait le sujet principal de la requête
 */
function extractSubject(query: string): string {
  // Retirer les verbes d'action courants
  let subject = query
    .replace(/^(recherche|cherche|trouve|fais|génère|crée|donne|explique|analyse|résume)\s+(moi\s+)?(une?\s+)?/i, '')
    .replace(/\s+(et|puis)\s+.*/i, '')
    .replace(/\s+(s'il te plaît|svp|please)/i, '')
    .trim();
  
  return subject || query;
}

/**
 * Utilise le LLM pour planifier les actions complexes
 */
async function planWithLLM(query: string): Promise<AgentAction[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un planificateur d'actions pour un agent IA. Analyse la requête et retourne un JSON avec les actions nécessaires.

Actions disponibles:
- search: Rechercher des informations sur le web
- summarize: Résumer/synthétiser des informations
- generate_image: Générer une image
- execute_code: Exécuter du code
- analyze: Analyser des données
- create_site: Créer un site web

Retourne UNIQUEMENT un JSON valide avec ce format:
{
  "actions": [
    {"type": "search", "input": "sujet à rechercher"},
    {"type": "summarize", "input": "ce qu'il faut résumer"},
    {"type": "generate_image", "input": "description de l'image"}
  ]
}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'action_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['search', 'summarize', 'generate_image', 'execute_code', 'analyze', 'create_site'] },
                    input: { type: 'string' }
                  },
                  required: ['type', 'input'],
                  additionalProperties: false
                }
              }
            },
            required: ['actions'],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const parsed = JSON.parse(content);
      return parsed.actions.map((a: { type: string; input: string }) => ({
        type: a.type as AgentAction['type'],
        input: a.input,
        status: 'pending' as const,
      }));
    }
  } catch (error) {
    console.error('[AgentMode] Erreur planification LLM:', error);
  }
  
  return [];
}

/**
 * Exécute une action de recherche
 */
async function executeSearch(input: string): Promise<string> {
  // Utiliser Serper API pour la recherche
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) {
    return `[Recherche simulée] Résultats pour "${input}": Information générale sur le sujet.`;
  }
  
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: input,
        gl: 'fr',
        hl: 'fr',
        num: 5,
      }),
    });
    
    const data = await response.json();
    const results = data.organic?.slice(0, 5) || [];
    
    let searchResults = `**Résultats de recherche pour "${input}":**\n\n`;
    results.forEach((r: { title: string; snippet: string; link: string }, i: number) => {
      searchResults += `${i + 1}. **${r.title}**\n   ${r.snippet}\n   [Source](${r.link})\n\n`;
    });
    
    return searchResults;
  } catch (error) {
    console.error('[AgentMode] Erreur recherche:', error);
    return `Erreur lors de la recherche pour "${input}"`;
  }
}

/**
 * Exécute une action de résumé
 */
async function executeSummarize(input: string, context?: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en synthèse. Résume les informations de manière claire, concise et structurée en français.'
        },
        {
          role: 'user',
          content: context 
            ? `Résume ces informations sur "${input}":\n\n${context}`
            : `Fais un résumé complet sur "${input}"`
        }
      ]
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : 'Résumé non disponible';
  } catch (error) {
    console.error('[AgentMode] Erreur résumé:', error);
    return `Erreur lors du résumé de "${input}"`;
  }
}

/**
 * Exécute une action de génération d'image
 */
async function executeGenerateImage(input: string): Promise<string> {
  try {
    const result = await generateImage({
      prompt: input,
    });
    
    return `![Image générée](${result.url})\n\n*Image générée pour: "${input}"*`;
  } catch (error) {
    console.error('[AgentMode] Erreur génération image:', error);
    return `Erreur lors de la génération d'image pour "${input}"`;
  }
}

/**
 * Exécute le pipeline d'actions complet
 */
export async function executeAgentPipeline(
  query: string,
  onProgress?: (action: AgentAction, index: number, total: number) => void
): Promise<AgentPipeline> {
  const startTime = Date.now();
  const pipelineId = `pipeline_${Date.now()}`;
  
  // Planifier les actions
  const actions = await planAgentActions(query);
  
  if (actions.length === 0) {
    return {
      id: pipelineId,
      query,
      actions: [],
      status: 'completed',
      startTime,
      endTime: Date.now(),
      finalResult: 'Aucune action multi-étapes détectée pour cette requête.',
    };
  }
  
  const pipeline: AgentPipeline = {
    id: pipelineId,
    query,
    actions,
    status: 'executing',
    startTime,
  };
  
  let previousOutput = '';
  
  // Exécuter chaque action séquentiellement
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    action.status = 'running';
    
    if (onProgress) {
      onProgress(action, i, actions.length);
    }
    
    const actionStart = Date.now();
    
    try {
      switch (action.type) {
        case 'search':
          action.output = await executeSearch(action.input);
          break;
          
        case 'summarize':
          action.output = await executeSummarize(action.input, previousOutput);
          break;
          
        case 'generate_image':
          action.output = await executeGenerateImage(action.input);
          break;
          
        case 'execute_code':
          // Utiliser le code executor existant
          action.output = `[Code execution pour: ${action.input}]`;
          break;
          
        case 'analyze':
          const analyzeResult = await executeSummarize(`Analyse de: ${action.input}`, previousOutput);
          action.output = analyzeResult;
          break;
          
        case 'create_site':
          action.output = `[Création de site pour: ${action.input}]`;
          break;
      }
      
      action.status = 'completed';
      action.duration = Date.now() - actionStart;
      previousOutput = action.output || '';
      
    } catch (error) {
      action.status = 'failed';
      action.error = error instanceof Error ? error.message : 'Erreur inconnue';
      action.duration = Date.now() - actionStart;
    }
    
    if (onProgress) {
      onProgress(action, i, actions.length);
    }
  }
  
  // Compiler le résultat final
  pipeline.status = 'completed';
  pipeline.endTime = Date.now();
  pipeline.finalResult = compileResults(pipeline);
  
  return pipeline;
}

/**
 * Compile les résultats de toutes les actions
 */
function compileResults(pipeline: AgentPipeline): string {
  let result = `## 🤖 Résultat de l'Agent Autonome\n\n`;
  result += `**Requête:** ${pipeline.query}\n\n`;
  result += `**Actions exécutées:** ${pipeline.actions.length}\n\n`;
  result += `**Durée totale:** ${((pipeline.endTime || Date.now()) - pipeline.startTime) / 1000}s\n\n`;
  result += `---\n\n`;
  
  for (const action of pipeline.actions) {
    const statusIcon = action.status === 'completed' ? '✅' : action.status === 'failed' ? '❌' : '⏳';
    result += `### ${statusIcon} ${getActionLabel(action.type)}\n\n`;
    
    if (action.output) {
      result += `${action.output}\n\n`;
    }
    
    if (action.error) {
      result += `⚠️ Erreur: ${action.error}\n\n`;
    }
    
    if (action.duration) {
      result += `*Durée: ${(action.duration / 1000).toFixed(2)}s*\n\n`;
    }
    
    result += `---\n\n`;
  }
  
  return result;
}

/**
 * Retourne le label lisible d'une action
 */
function getActionLabel(type: AgentAction['type']): string {
  const labels: Record<AgentAction['type'], string> = {
    search: '🔍 Recherche Web',
    summarize: '📝 Résumé',
    generate_image: '🎨 Génération d\'Image',
    execute_code: '💻 Exécution de Code',
    analyze: '📊 Analyse',
    create_site: '🌐 Création de Site',
  };
  return labels[type] || type;
}

/**
 * Singleton pour le mode agent
 */
class AutonomousAgentMode {
  private config: AgentModeConfig = {
    maxActions: 5,
    enableAutoImage: true,
    enableAutoSummary: true,
    verboseMode: true,
  };
  
  setConfig(config: Partial<AgentModeConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): AgentModeConfig {
    return { ...this.config };
  }
  
  async execute(
    query: string,
    onProgress?: (action: AgentAction, index: number, total: number) => void
  ): Promise<AgentPipeline> {
    return executeAgentPipeline(query, onProgress);
  }
  
  isMultiStepTask(query: string): boolean {
    return detectMultiStepTask(query);
  }
  
  async plan(query: string): Promise<AgentAction[]> {
    return planAgentActions(query);
  }
}

let agentModeInstance: AutonomousAgentMode | null = null;

export function getAutonomousAgentMode(): AutonomousAgentMode {
  if (!agentModeInstance) {
    agentModeInstance = new AutonomousAgentMode();
  }
  return agentModeInstance;
}

export { AutonomousAgentMode };
