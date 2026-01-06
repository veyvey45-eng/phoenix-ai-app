/**
 * Phoenix Agent Core - Moteur d'Agent Autonome
 * 
 * Implémente le pattern ReAct (Reasoning + Acting) pour créer un agent
 * capable de planifier, exécuter et itérer automatiquement sur des tâches.
 * 
 * Similaire à l'architecture de Claude/Manus.
 */

import { invokeLLM } from '../_core/llm';
import { toolRegistry, ToolResult, ToolContext } from './toolRegistry';
import { getMCPBridge } from './mcpBridge';

// Types
export interface AgentState {
  id: string;
  goal: string;
  status: 'idle' | 'thinking' | 'planning' | 'executing' | 'observing' | 'completed' | 'failed' | 'waiting_confirmation';
  currentPhase: string;
  steps: AgentStep[];
  context: AgentMemory;
  config: AgentConfig;
  createdAt: Date;
  updatedAt: Date;
  result?: string;
  error?: string;
}

export interface AgentStep {
  id: string;
  type: 'think' | 'plan' | 'tool_call' | 'observe' | 'answer';
  content: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: ToolResult;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

export interface AgentMemory {
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>;
  observations: string[];
  executedTools: Array<{ tool: string; args: any; result: any; timestamp: Date }>;
  workingMemory: Record<string, any>;
  artifacts: Array<{ type: string; content: string; name?: string }>;
}

export interface AgentConfig {
  maxIterations: number;
  maxToolCalls: number;
  requireConfirmation: boolean;
  verbose: boolean;
  timeout: number; // ms
}

export interface AgentEvent {
  type: 'step_start' | 'step_complete' | 'tool_call' | 'tool_result' | 'thinking' | 'answer' | 'error' | 'status_change';
  data: any;
  timestamp: Date;
}

type EventCallback = (event: AgentEvent) => void;

// Default config
const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 15,
  maxToolCalls: 20,
  requireConfirmation: false,
  verbose: true,
  timeout: 5 * 60 * 1000 // 5 minutes
};

// Active agents store
const activeAgents: Map<string, AgentState> = new Map();

/**
 * Génère un ID unique
 */
function generateId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crée un nouvel agent
 */
export function createAgent(goal: string, config: Partial<AgentConfig> = {}): AgentState {
  const agent: AgentState = {
    id: generateId(),
    goal,
    status: 'idle',
    currentPhase: 'initialization',
    steps: [],
    context: {
      conversationHistory: [],
      observations: [],
      executedTools: [],
      workingMemory: {},
      artifacts: []
    },
    config: { ...DEFAULT_CONFIG, ...config },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  activeAgents.set(agent.id, agent);
  return agent;
}

/**
 * Récupère un agent par son ID
 */
export function getAgent(agentId: string): AgentState | undefined {
  return activeAgents.get(agentId);
}

/**
 * Liste tous les agents actifs
 */
export function listAgents(): AgentState[] {
  return Array.from(activeAgents.values());
}

/**
 * Supprime un agent
 */
export function deleteAgent(agentId: string): boolean {
  return activeAgents.delete(agentId);
}

/**
 * Génère le prompt système pour l'agent
 */
function generateSystemPrompt(agent: AgentState): string {
  const toolsDescription = toolRegistry.generateToolsDescription();
  
  return `Tu es Phoenix, un agent IA autonome capable d'accomplir des tâches complexes.

## Ton fonctionnement

Tu opères en boucle selon le pattern ReAct:
1. **THINK** - Analyse la situation et réfléchis à ce qu'il faut faire
2. **ACT** - Choisis et exécute un outil approprié
3. **OBSERVE** - Analyse le résultat de l'action
4. **REPEAT** - Continue jusqu'à ce que l'objectif soit atteint

## Règles importantes

- Décompose les tâches complexes en sous-tâches simples
- Utilise les outils disponibles pour accomplir les actions
- Si une action échoue, essaie une approche différente
- Quand l'objectif est atteint, fournis une réponse finale claire
- Ne génère PAS de code sauf si explicitement demandé
- Communique naturellement avec l'utilisateur

## Outils disponibles

${toolsDescription}

## Format de réponse

Réponds TOUJOURS en JSON avec cette structure:
{
  "thinking": "Ta réflexion sur la situation actuelle et ce qu'il faut faire",
  "action": {
    "type": "tool_call" | "answer",
    "tool_name": "nom_outil (si tool_call)",
    "tool_args": { ... } (si tool_call),
    "answer": "réponse finale (si answer)"
  }
}

Si tu as besoin d'utiliser un outil, utilise "tool_call".
Si tu as terminé et veux donner la réponse finale, utilise "answer".`;
}

/**
 * Construit le contexte de conversation pour le LLM
 */
function buildConversationContext(agent: AgentState): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: generateSystemPrompt(agent) }
  ];

  // Ajouter l'objectif initial
  messages.push({
    role: 'user',
    content: `OBJECTIF: ${agent.goal}`
  });

  // Ajouter l'historique des étapes (seulement celles avec du contenu)
  for (const step of agent.steps) {
    // Ignorer les étapes sans contenu ou en cours d'exécution
    if (step.status === 'executing' || step.status === 'pending') {
      continue;
    }
    
    if ((step.type === 'think' || step.type === 'plan') && step.content && step.content.trim()) {
      messages.push({
        role: 'assistant',
        content: step.content
      });
    } else if (step.type === 'tool_call' && step.toolResult) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify({
          thinking: `J'utilise l'outil ${step.toolName}`,
          action: {
            type: 'tool_call',
            tool_name: step.toolName,
            tool_args: step.toolArgs
          }
        })
      });
      messages.push({
        role: 'user',
        content: `RÉSULTAT DE L'OUTIL ${step.toolName}:\n${step.toolResult.success ? step.toolResult.output : `ERREUR: ${step.toolResult.error}`}`
      });
    } else if (step.type === 'observe') {
      messages.push({
        role: 'user',
        content: `OBSERVATION: ${step.content}`
      });
    }
  }

  return messages;
}

/**
 * Exécute une itération de l'agent
 */
async function executeIteration(
  agent: AgentState,
  toolContext: ToolContext,
  onEvent?: EventCallback
): Promise<{ shouldContinue: boolean; error?: string }> {
  const stepId = generateId();
  
  // Étape 1: Réflexion (Think)
  agent.status = 'thinking';
  agent.currentPhase = 'thinking';
  agent.updatedAt = new Date();
  
  onEvent?.({
    type: 'thinking',
    data: { message: 'Phoenix réfléchit...' },
    timestamp: new Date()
  });

  const thinkStep: AgentStep = {
    id: stepId,
    type: 'think',
    content: '',
    status: 'executing',
    startedAt: new Date()
  };
  agent.steps.push(thinkStep);

  try {
    const messages = buildConversationContext(agent);
    
    // Vérifier que les messages ne sont pas vides
    console.log('[AgentCore] Messages to send:', JSON.stringify(messages.map(m => ({ role: m.role, contentLength: m.content?.length || 0, preview: m.content?.substring(0, 50) }))));
    
    // Vérifier que tous les messages ont du contenu
    const validMessages = messages.filter(m => m.content && m.content.trim().length > 0);
    
    if (validMessages.length === 0) {
      throw new Error('Messages vides - impossible d\'envoyer au LLM');
    }
    
    console.log('[AgentCore] Valid messages count:', validMessages.length);
    
    // Note: On n'utilise pas response_format car certains modèles ne le supportent pas bien
    // Le prompt demande déjà une réponse JSON
    const response = await invokeLLM({
      messages: validMessages
    });

    // Vérifier que la réponse est valide
    if (!response || !response.choices || !response.choices[0]) {
      throw new Error('Réponse LLM invalide ou vide');
    }

    const rawContent = response.choices[0]?.message?.content;
    let content = typeof rawContent === 'string' ? rawContent : '{}';
    
    // Extraire le JSON des blocs markdown si présent
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      content = jsonBlockMatch[1].trim();
      console.log('[AgentCore] Extracted JSON from markdown block');
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
      console.log('[AgentCore] Parsed action type:', parsed.action?.type);
      console.log('[AgentCore] Parsed action tool_name:', parsed.action?.tool_name);
    } catch (e) {
      // Essayer d'extraire un objet JSON du contenu (peut être mélangé avec du texte)
      const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log('[AgentCore] Extracted JSON from mixed content');
        } catch {
          console.log('[AgentCore] JSON extraction failed, treating as answer');
          parsed = {
            thinking: content,
            action: { type: 'answer', answer: content.split('{')[0].trim() || content }
          };
        }
      } else {
        console.log('[AgentCore] No JSON found, treating as answer:', content.substring(0, 100));
        // Si le JSON est invalide, essayer d'extraire l'information
        parsed = {
          thinking: content,
          action: { type: 'answer', answer: content }
        };
      }
    }

    thinkStep.content = parsed.thinking || content;
    thinkStep.status = 'completed';
    thinkStep.completedAt = new Date();
    thinkStep.duration = Date.now() - thinkStep.startedAt!.getTime();

    onEvent?.({
      type: 'step_complete',
      data: { step: thinkStep, thinking: parsed.thinking },
      timestamp: new Date()
    });

    // Étape 2: Action
    if (parsed.action?.type === 'answer') {
      // L'agent a terminé
      const answerStep: AgentStep = {
        id: generateId(),
        type: 'answer',
        content: parsed.action.answer,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      };
      agent.steps.push(answerStep);
      agent.status = 'completed';
      agent.result = parsed.action.answer;
      agent.updatedAt = new Date();

      onEvent?.({
        type: 'answer',
        data: { answer: parsed.action.answer },
        timestamp: new Date()
      });

      return { shouldContinue: false };
    }

    if (parsed.action?.type === 'tool_call') {
      // Exécuter l'outil
      const toolName = parsed.action.tool_name;
      const toolArgs = parsed.action.tool_args || {};

      agent.status = 'executing';
      agent.currentPhase = `executing: ${toolName}`;
      agent.updatedAt = new Date();

      const toolStep: AgentStep = {
        id: generateId(),
        type: 'tool_call',
        content: `Exécution de ${toolName}`,
        status: 'executing',
        toolName,
        toolArgs,
        startedAt: new Date()
      };
      agent.steps.push(toolStep);

      onEvent?.({
        type: 'tool_call',
        data: { tool: toolName, args: toolArgs },
        timestamp: new Date()
      });

      // Exécuter l'outil
      const result = await toolRegistry.execute(toolName, toolArgs, toolContext);
      
      toolStep.toolResult = result;
      toolStep.status = result.success ? 'completed' : 'failed';
      toolStep.completedAt = new Date();
      toolStep.duration = Date.now() - toolStep.startedAt!.getTime();

      // Sauvegarder dans la mémoire
      agent.context.executedTools.push({
        tool: toolName,
        args: toolArgs,
        result: result,
        timestamp: new Date()
      });

      // Sauvegarder les artifacts
      if (result.artifacts) {
        agent.context.artifacts.push(...result.artifacts);
      }

      onEvent?.({
        type: 'tool_result',
        data: { tool: toolName, result },
        timestamp: new Date()
      });

      // Étape 3: Observation
      agent.status = 'observing';
      agent.currentPhase = 'observing';
      
      const observation = result.success 
        ? `L'outil ${toolName} a réussi: ${result.output}`
        : `L'outil ${toolName} a échoué: ${result.error}`;
      
      agent.context.observations.push(observation);

      const observeStep: AgentStep = {
        id: generateId(),
        type: 'observe',
        content: observation,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      };
      agent.steps.push(observeStep);

      return { shouldContinue: true };
    }

    // Action non reconnue
    return { shouldContinue: true };

  } catch (error: any) {
    thinkStep.status = 'failed';
    thinkStep.completedAt = new Date();
    
    onEvent?.({
      type: 'error',
      data: { error: error.message },
      timestamp: new Date()
    });

    return { shouldContinue: false, error: error.message };
  }
}

/**
 * Exécute l'agent jusqu'à complétion
 */
export async function runAgent(
  agentId: string,
  userId: string,
  sessionId: string,
  onEvent?: EventCallback
): Promise<AgentState> {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const toolContext: ToolContext = {
    userId,
    sessionId
  };

  agent.status = 'planning';
  agent.currentPhase = 'starting';
  agent.updatedAt = new Date();

  onEvent?.({
    type: 'status_change',
    data: { status: 'starting', message: 'Démarrage de l\'agent...' },
    timestamp: new Date()
  });

  let iterations = 0;
  let toolCalls = 0;
  const startTime = Date.now();

  while (iterations < agent.config.maxIterations) {
    // Vérifier le timeout
    if (Date.now() - startTime > agent.config.timeout) {
      agent.status = 'failed';
      agent.error = 'Timeout dépassé';
      break;
    }

    // Vérifier le nombre max d'appels d'outils
    if (toolCalls >= agent.config.maxToolCalls) {
      agent.status = 'failed';
      agent.error = 'Nombre maximum d\'appels d\'outils atteint';
      break;
    }

    iterations++;
    
    const { shouldContinue, error } = await executeIteration(agent, toolContext, onEvent);

    // Compter les appels d'outils
    const lastStep = agent.steps[agent.steps.length - 1];
    if (lastStep?.type === 'tool_call') {
      toolCalls++;
    }

    if (!shouldContinue) {
      if (error) {
        agent.status = 'failed';
        agent.error = error;
      }
      break;
    }
  }

  if (iterations >= agent.config.maxIterations && (agent.status as string) !== 'completed') {
    agent.status = 'failed';
    agent.error = `Nombre maximum d'itérations (${agent.config.maxIterations}) atteint`;
  }

  agent.updatedAt = new Date();

  onEvent?.({
    type: 'status_change',
    data: { 
      status: agent.status, 
      message: (agent.status as string) === 'completed' ? 'Tâche terminée' : `Erreur: ${agent.error}`,
      result: agent.result
    },
    timestamp: new Date()
  });

  return agent;
}

/**
 * Exécute une tâche rapide (création + exécution en une fois)
 */
export async function quickRun(
  goal: string,
  userId: string,
  sessionId: string,
  config: Partial<AgentConfig> = {},
  onEvent?: EventCallback
): Promise<AgentState> {
  const agent = createAgent(goal, config);
  return runAgent(agent.id, userId, sessionId, onEvent);
}

/**
 * Annule un agent en cours d'exécution
 */
export function cancelAgent(agentId: string): boolean {
  const agent = activeAgents.get(agentId);
  if (agent && agent.status !== 'completed' && agent.status !== 'failed') {
    agent.status = 'failed';
    agent.error = 'Annulé par l\'utilisateur';
    agent.updatedAt = new Date();
    return true;
  }
  return false;
}

export default {
  createAgent,
  getAgent,
  listAgents,
  deleteAgent,
  runAgent,
  quickRun,
  cancelAgent
};
