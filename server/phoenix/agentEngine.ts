/**
 * Phoenix Agent Engine - Moteur d'Agent Autonome
 * 
 * Ce module implémente la boucle d'agent (Agent Loop) qui permet à Phoenix
 * de planifier, exécuter et itérer automatiquement sur des tâches complexes.
 * 
 * Inspiré par le pattern ReAct (Reasoning + Acting)
 */

import { invokeLLM } from "../_core/llm";
import { getMCPBridge, MCPTool as MCPBridgeTool } from "./mcpBridge";
import { getActionTypeFromTool, assessRisk, RiskLevel } from "./mcpSecurity";

// Helper functions pour le MCP Bridge
async function listMCPTools(): Promise<{ success: boolean; tools?: MCPTool[] }> {
  try {
    const bridge = getMCPBridge();
    const status = bridge.getStatus();
    if (!status.connected || !status.authenticated) {
      return { success: false };
    }
    
    const tools: MCPTool[] = [];
    // activeMCPs est un tableau de strings (IDs de serveurs)
    for (const serverId of status.activeMCPs) {
      const serverTools = await bridge.listTools(serverId);
      tools.push(...serverTools.map(t => ({
        name: t.name,
        description: t.description || 'No description',
        inputSchema: t.inputSchema || { type: 'object' },
        serverId: serverId,
        serverName: serverId
      })));
    }
    return { success: true, tools };
  } catch (error) {
    return { success: false };
  }
}

async function callMCPTool(toolName: string, args: Record<string, any>): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const bridge = getMCPBridge();
    const status = bridge.getStatus();
    if (!status.connected || !status.authenticated) {
      return { success: false, error: 'MCP Bridge not connected' };
    }
    
    // Trouver le serveur qui a cet outil
    for (const serverId of status.activeMCPs) {
      const tools = await bridge.listTools(serverId);
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        const result = await bridge.callTool(serverId, toolName, args);
        return { success: true, result };
      }
    }
    
    return { success: false, error: `Tool ${toolName} not found` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Types pour l'Agent
export interface AgentTask {
  id: string;
  goal: string;
  status: 'pending' | 'planning' | 'executing' | 'waiting_confirmation' | 'completed' | 'failed';
  steps: AgentStep[];
  currentStepIndex: number;
  context: AgentContext;
  createdAt: Date;
  updatedAt: Date;
  result?: string;
  error?: string;
}

export interface AgentStep {
  id: string;
  type: 'think' | 'plan' | 'action' | 'observe' | 'confirm';
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  input?: any;
  output?: any;
  toolName?: string;
  toolArgs?: Record<string, any>;
  securityAnalysis?: { riskLevel: string; warnings: string[] };
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentContext {
  conversationHistory: Array<{ role: string; content: string }>;
  availableTools: MCPTool[];
  executedActions: Array<{ tool: string; args: any; result: any }>;
  observations: string[];
  userPreferences?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverId: string;
  serverName: string;
}

export interface AgentConfig {
  maxIterations: number;
  requireConfirmationForHighRisk: boolean;
  autoExecuteLowRisk: boolean;
  verbose: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 30,
  requireConfirmationForHighRisk: true,
  autoExecuteLowRisk: true,
  verbose: true
};

// Store des tâches en cours
const activeTasks: Map<string, AgentTask> = new Map();

/**
 * Génère un ID unique
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crée une nouvelle tâche d'agent
 */
export async function createAgentTask(goal: string, userId: string): Promise<AgentTask> {
  const taskId = generateId();
  
  // Récupérer les outils MCP disponibles
  let availableTools: MCPTool[] = [];
  try {
    const toolsResult = await listMCPTools();
    if (toolsResult.success && toolsResult.tools) {
      availableTools = toolsResult.tools;
    }
  } catch (error) {
    console.log('[AgentEngine] Pas de connexion MCP Bridge, mode limité');
  }
  
  const task: AgentTask = {
    id: taskId,
    goal,
    status: 'pending',
    steps: [],
    currentStepIndex: 0,
    context: {
      conversationHistory: [],
      availableTools,
      executedActions: [],
      observations: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  activeTasks.set(taskId, task);
  return task;
}

/**
 * Récupère une tâche par son ID
 */
export function getAgentTask(taskId: string): AgentTask | undefined {
  return activeTasks.get(taskId);
}

/**
 * Liste toutes les tâches actives
 */
export function listAgentTasks(): AgentTask[] {
  return Array.from(activeTasks.values());
}

/**
 * Exécute la boucle d'agent pour une tâche
 */
export async function runAgentLoop(
  taskId: string, 
  config: Partial<AgentConfig> = {},
  onStepComplete?: (step: AgentStep) => void,
  onConfirmationNeeded?: (step: AgentStep) => Promise<boolean>
): Promise<AgentTask> {
  const task = activeTasks.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let iterations = 0;
  
  task.status = 'executing';
  task.updatedAt = new Date();
  
  // Étape 1: Planification initiale
  const planStep = await planTask(task, finalConfig);
  task.steps.push(planStep);
  onStepComplete?.(planStep);
  
  // Boucle principale de l'agent
  let shouldContinue = true;
  while (iterations < finalConfig.maxIterations && shouldContinue) {
    const currentStatus = task.status as string;
    if (currentStatus === 'completed' || currentStatus === 'failed') {
      shouldContinue = false;
      break;
    }
    iterations++;
    
    // Étape 2: Réflexion - Qu'est-ce qu'on doit faire ensuite?
    const thinkStep = await think(task, finalConfig);
    task.steps.push(thinkStep);
    onStepComplete?.(thinkStep);
    
    if (thinkStep.output?.isComplete) {
      task.status = 'completed';
      task.result = thinkStep.output.finalAnswer;
      break;
    }
    
    // Étape 3: Action - Exécuter l'outil choisi
    if (thinkStep.output?.nextAction) {
      const actionStep = await executeAction(
        task, 
        thinkStep.output.nextAction,
        finalConfig,
        onConfirmationNeeded
      );
      task.steps.push(actionStep);
      onStepComplete?.(actionStep);
      
      // Étape 4: Observation - Analyser le résultat
      const observeStep = await observe(task, actionStep, finalConfig);
      task.steps.push(observeStep);
      onStepComplete?.(observeStep);
    }
    
    task.currentStepIndex = task.steps.length - 1;
    task.updatedAt = new Date();
  }
  
  if (iterations >= finalConfig.maxIterations && task.status !== 'completed') {
    task.status = 'failed';
    task.error = `Maximum iterations (${finalConfig.maxIterations}) reached without completing the task`;
  }
  
  return task;
}

/**
 * Étape de planification - Crée un plan pour atteindre l'objectif
 */
async function planTask(task: AgentTask, config: AgentConfig): Promise<AgentStep> {
  const step: AgentStep = {
    id: generateId(),
    type: 'plan',
    description: 'Création du plan pour atteindre l\'objectif',
    status: 'executing',
    startedAt: new Date()
  };
  
  const toolsDescription = task.context.availableTools.length > 0
    ? task.context.availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')
    : 'Aucun outil MCP disponible. Utiliser uniquement les capacités de base.';
  
  const prompt = `Tu es Phoenix, un agent IA autonome. Tu dois créer un plan pour accomplir cette tâche.

OBJECTIF: ${task.goal}

OUTILS DISPONIBLES:
${toolsDescription}

Crée un plan détaillé avec les étapes nécessaires. Réponds en JSON:
{
  "plan": [
    { "step": 1, "action": "description de l'action", "tool": "nom_outil ou null", "reasoning": "pourquoi cette étape" }
  ],
  "estimatedSteps": number,
  "complexity": "low" | "medium" | "high"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'Tu es un agent IA qui planifie des tâches. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });
    
    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '{}';
    step.output = JSON.parse(content);
    step.status = 'completed';
  } catch (error: any) {
    step.status = 'failed';
    step.output = { error: error.message };
  }
  
  step.completedAt = new Date();
  return step;
}

/**
 * Étape de réflexion - Décide de la prochaine action
 */
async function think(task: AgentTask, config: AgentConfig): Promise<AgentStep> {
  const step: AgentStep = {
    id: generateId(),
    type: 'think',
    description: 'Analyse de la situation et décision de la prochaine action',
    status: 'executing',
    startedAt: new Date()
  };
  
  const recentObservations = task.context.observations.slice(-5).join('\n');
  const executedActionsStr = task.context.executedActions
    .slice(-5)
    .map(a => `- ${a.tool}(${JSON.stringify(a.args)}) → ${JSON.stringify(a.result).substring(0, 200)}`)
    .join('\n');
  
  const toolsDescription = task.context.availableTools.length > 0
    ? task.context.availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')
    : 'Aucun outil disponible';
  
  const prompt = `Tu es Phoenix, un agent IA autonome en train d'exécuter une tâche.

OBJECTIF: ${task.goal}

ACTIONS DÉJÀ EXÉCUTÉES:
${executedActionsStr || 'Aucune action exécutée'}

OBSERVATIONS RÉCENTES:
${recentObservations || 'Aucune observation'}

OUTILS DISPONIBLES:
${toolsDescription}

Analyse la situation et décide:
1. Est-ce que l'objectif est atteint? Si oui, fournis la réponse finale.
2. Sinon, quelle est la prochaine action à exécuter?

Réponds en JSON:
{
  "thinking": "ton raisonnement",
  "isComplete": boolean,
  "finalAnswer": "réponse finale si isComplete=true",
  "nextAction": {
    "tool": "nom_outil",
    "args": { ... },
    "reasoning": "pourquoi cette action"
  } ou null si isComplete=true
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'Tu es un agent IA autonome. Analyse et décide. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });
    
    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '{}';
    step.output = JSON.parse(content);
    step.status = 'completed';
  } catch (error: any) {
    step.status = 'failed';
    step.output = { error: error.message, isComplete: false };
  }
  
  step.completedAt = new Date();
  return step;
}

/**
 * Étape d'action - Exécute un outil MCP
 */
async function executeAction(
  task: AgentTask,
  action: { tool: string; args: Record<string, any>; reasoning: string },
  config: AgentConfig,
  onConfirmationNeeded?: (step: AgentStep) => Promise<boolean>
): Promise<AgentStep> {
  const step: AgentStep = {
    id: generateId(),
    type: 'action',
    description: `Exécution de ${action.tool}`,
    status: 'executing',
    toolName: action.tool,
    toolArgs: action.args,
    startedAt: new Date()
  };
  
  // Analyse de sécurité
  const actionType = getActionTypeFromTool(action.tool, action.args);
  const securityAnalysis = assessRisk(actionType, action.tool, action.args);
  step.securityAnalysis = { riskLevel: securityAnalysis.riskLevel, warnings: securityAnalysis.warnings };
  
  // Vérifier si une confirmation est nécessaire
  if (config.requireConfirmationForHighRisk && 
      (securityAnalysis.riskLevel === 'high' || securityAnalysis.riskLevel === 'critical')) {
    step.status = 'pending';
    step.type = 'confirm';
    step.description = `Confirmation requise pour ${action.tool} (risque: ${securityAnalysis.riskLevel})`;
    
    if (onConfirmationNeeded) {
      const confirmed = await onConfirmationNeeded(step);
      if (!confirmed) {
        step.status = 'skipped';
        step.output = { skipped: true, reason: 'User declined' };
        step.completedAt = new Date();
        return step;
      }
    } else {
      // Pas de callback de confirmation, on attend
      task.status = 'waiting_confirmation';
      step.completedAt = new Date();
      return step;
    }
  }
  
  // Exécuter l'action
  step.status = 'executing';
  step.type = 'action';
  
  try {
    const result = await callMCPTool(action.tool, action.args);
    step.output = result;
    step.status = result.success ? 'completed' : 'failed';
    
    // Enregistrer l'action exécutée
    task.context.executedActions.push({
      tool: action.tool,
      args: action.args,
      result: result
    });
  } catch (error: any) {
    step.status = 'failed';
    step.output = { error: error.message };
  }
  
  step.completedAt = new Date();
  return step;
}

/**
 * Étape d'observation - Analyse le résultat d'une action
 */
async function observe(task: AgentTask, actionStep: AgentStep, config: AgentConfig): Promise<AgentStep> {
  const step: AgentStep = {
    id: generateId(),
    type: 'observe',
    description: 'Analyse du résultat de l\'action',
    status: 'executing',
    startedAt: new Date()
  };
  
  const observation = actionStep.status === 'completed'
    ? `Action ${actionStep.toolName} réussie: ${JSON.stringify(actionStep.output).substring(0, 500)}`
    : `Action ${actionStep.toolName} échouée: ${actionStep.output?.error || 'Erreur inconnue'}`;
  
  task.context.observations.push(observation);
  
  step.output = { observation };
  step.status = 'completed';
  step.completedAt = new Date();
  
  return step;
}

/**
 * Confirme une action en attente
 */
export async function confirmAgentAction(taskId: string, stepId: string, confirmed: boolean): Promise<AgentTask | null> {
  const task = activeTasks.get(taskId);
  if (!task) return null;
  
  const step = task.steps.find(s => s.id === stepId);
  if (!step || step.type !== 'confirm') return null;
  
  if (confirmed) {
    // Exécuter l'action
    try {
      const result = await callMCPTool(step.toolName!, step.toolArgs!);
      step.output = result;
      step.status = result.success ? 'completed' : 'failed';
      
      task.context.executedActions.push({
        tool: step.toolName!,
        args: step.toolArgs!,
        result: result
      });
      
      task.status = 'executing';
    } catch (error: any) {
      step.status = 'failed';
      step.output = { error: error.message };
    }
  } else {
    step.status = 'skipped';
    step.output = { skipped: true, reason: 'User declined' };
  }
  
  task.updatedAt = new Date();
  return task;
}

/**
 * Annule une tâche
 */
export function cancelAgentTask(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  if (!task) return false;
  
  task.status = 'failed';
  task.error = 'Task cancelled by user';
  task.updatedAt = new Date();
  return true;
}

/**
 * Supprime une tâche terminée
 */
export function deleteAgentTask(taskId: string): boolean {
  return activeTasks.delete(taskId);
}

/**
 * Exécute une tâche simple en une seule itération (mode rapide)
 */
export async function executeQuickTask(
  goal: string,
  userId: string,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; result?: string; error?: string }> {
  onProgress?.('Création de la tâche...');
  const task = await createAgentTask(goal, userId);
  
  onProgress?.('Exécution de l\'agent...');
  
  try {
    const completedTask = await runAgentLoop(
      task.id,
      { maxIterations: 5, autoExecuteLowRisk: true },
      (step) => {
        onProgress?.(`${step.type}: ${step.description}`);
      }
    );
    
    if (completedTask.status === 'completed') {
      return { success: true, result: completedTask.result };
    } else {
      return { success: false, error: completedTask.error || 'Task did not complete' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export default {
  createAgentTask,
  getAgentTask,
  listAgentTasks,
  runAgentLoop,
  confirmAgentAction,
  cancelAgentTask,
  deleteAgentTask,
  executeQuickTask
};
