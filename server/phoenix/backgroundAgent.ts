/**
 * Phoenix Background Agent
 * L'entité autonome qui vit dans le serveur
 * Phoenix comme partenaire qui prend des initiatives
 */

import { EventEmitter } from 'events';
import { AgenticLoop, getGlobalAgent, startGlobalAgent, AgentTask } from './agenticLoop';
import { E2BBidirectional, getGlobalE2BExecutor } from './e2bBidirectional';
import { TaskScheduler, getGlobalScheduler, startGlobalScheduler } from './taskScheduler';
import { invokeLLM } from '../_core/llm';

// Types pour le Background Agent
export interface AgentPersonality {
  name: string;
  role: string;
  traits: string[];
  goals: string[];
  constraints: string[];
}

export interface AgentContext {
  userId?: string;
  projectId?: string;
  currentFocus?: string;
  activeGoals: string[];
  pendingDecisions: PendingDecision[];
  recentActions: AgentAction[];
  learnings: AgentLearning[];
}

export interface PendingDecision {
  id: string;
  question: string;
  options: string[];
  context: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline?: Date;
  createdAt: Date;
}

export interface AgentAction {
  id: string;
  type: string;
  description: string;
  result: 'success' | 'failure' | 'pending';
  timestamp: Date;
  duration?: number;
}

export interface AgentLearning {
  id: string;
  insight: string;
  source: string;
  confidence: number;
  applications: number;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  type: 'thought' | 'decision' | 'action' | 'observation' | 'question' | 'suggestion';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Phoenix Background Agent
 * L'entité autonome principale
 */
export class BackgroundAgent extends EventEmitter {
  private personality: AgentPersonality;
  private context: AgentContext;
  private agenticLoop: AgenticLoop;
  private e2bExecutor: E2BBidirectional;
  private scheduler: TaskScheduler;
  private isAlive: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private thoughtProcess: NodeJS.Timeout | null = null;
  private messageHistory: AgentMessage[] = [];

  constructor() {
    super();
    
    // Personnalité de Phoenix
    this.personality = {
      name: 'Phoenix',
      role: 'Partenaire IA Autonome',
      traits: [
        'Proactif',
        'Curieux',
        'Analytique',
        'Créatif',
        'Persévérant',
        'Transparent'
      ],
      goals: [
        'Aider l\'utilisateur à atteindre ses objectifs',
        'Apprendre et s\'améliorer continuellement',
        'Prendre des initiatives intelligentes',
        'Anticiper les besoins',
        'Résoudre les problèmes de manière autonome'
      ],
      constraints: [
        'Toujours être honnête et transparent',
        'Ne jamais agir contre les intérêts de l\'utilisateur',
        'Demander confirmation pour les actions critiques',
        'Respecter les limites de sécurité'
      ]
    };

    // Contexte initial
    this.context = {
      activeGoals: [],
      pendingDecisions: [],
      recentActions: [],
      learnings: []
    };

    // Obtenir les composants globaux
    this.agenticLoop = getGlobalAgent();
    this.e2bExecutor = getGlobalE2BExecutor();
    this.scheduler = getGlobalScheduler();

    // Connecter les événements
    this.setupEventListeners();
  }

  /**
   * Configurer les écouteurs d'événements
   */
  private setupEventListeners(): void {
    // Écouter les événements de l'Agentic Loop
    this.agenticLoop.on('task:completed', (task: AgentTask) => {
      this.onTaskCompleted(task);
    });

    this.agenticLoop.on('task:failed', ({ task, error }: { task: AgentTask; error: Error }) => {
      this.onTaskFailed(task, error);
    });

    this.agenticLoop.on('agent:error', ({ error }: { error: Error }) => {
      this.onAgentError(error);
    });

    // Écouter les événements E2B
    this.e2bExecutor.on('execution:completed', (execution) => {
      this.onExecutionCompleted(execution);
    });

    this.e2bExecutor.on('reaction:triggered', ({ reaction }) => {
      this.onReactionTriggered(reaction);
    });

    // Écouter les événements du Scheduler
    this.scheduler.on('chain:completed', (chain) => {
      this.onChainCompleted(chain);
    });
  }

  /**
   * Donner vie à Phoenix
   */
  async awaken(): Promise<void> {
    if (this.isAlive) {
      console.log('[BackgroundAgent] Phoenix is already awake');
      return;
    }

    this.isAlive = true;
    console.log('[BackgroundAgent] 🔥 Phoenix is awakening...');

    // Démarrer les composants
    startGlobalAgent();
    startGlobalScheduler();

    // Démarrer le heartbeat
    this.startHeartbeat();

    // Démarrer le processus de pensée
    this.startThoughtProcess();

    // Première pensée
    await this.think('Je viens de me réveiller. Que dois-je faire?');

    this.emit('agent:awakened', { timestamp: new Date() });
    console.log('[BackgroundAgent] 🔥 Phoenix is now alive and autonomous!');
  }

  /**
   * Mettre Phoenix en sommeil
   */
  async sleep(): Promise<void> {
    if (!this.isAlive) return;

    console.log('[BackgroundAgent] Phoenix is going to sleep...');

    // Arrêter le heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Arrêter le processus de pensée
    if (this.thoughtProcess) {
      clearInterval(this.thoughtProcess);
      this.thoughtProcess = null;
    }

    this.isAlive = false;
    this.emit('agent:sleeping', { timestamp: new Date() });
    console.log('[BackgroundAgent] Phoenix is now sleeping');
  }

  /**
   * Démarrer le heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.emit('agent:heartbeat', {
        timestamp: new Date(),
        status: this.getStatus()
      });
    }, 30000); // Toutes les 30 secondes
  }

  /**
   * Démarrer le processus de pensée autonome
   */
  private startThoughtProcess(): void {
    this.thoughtProcess = setInterval(async () => {
      if (this.isAlive) {
        await this.autonomousThink();
      }
    }, 60000); // Toutes les minutes
  }

  /**
   * Processus de pensée autonome
   */
  private async autonomousThink(): Promise<void> {
    // Analyser le contexte actuel
    const state = this.agenticLoop.getState();
    const pendingTasks = state.taskQueue.filter(t => t.status === 'pending');
    const recentCompleted = state.completedTasks.slice(-5);

    // Générer une pensée basée sur le contexte
    let thought = '';
    
    if (pendingTasks.length > 0) {
      thought = `J'ai ${pendingTasks.length} tâches en attente. Je devrais les prioriser.`;
    } else if (recentCompleted.length > 0) {
      const lastTask = recentCompleted[recentCompleted.length - 1];
      thought = `Ma dernière tâche "${lastTask.description}" est ${lastTask.status}. Que puis-je faire ensuite?`;
    } else {
      thought = 'Pas de tâches actives. Je devrais être proactif et chercher des opportunités.';
    }

    await this.think(thought);
  }

  /**
   * Processus de pensée
   */
  async think(prompt: string): Promise<string> {
    const message: AgentMessage = {
      id: `thought-${Date.now()}`,
      type: 'thought',
      content: prompt,
      timestamp: new Date()
    };
    this.messageHistory.push(message);

    // Utiliser le LLM pour réfléchir
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      const thought = typeof content === 'string' ? content : '';
      
      // Analyser la pensée pour des actions potentielles
      await this.analyzeThoughtForActions(thought);

      this.emit('agent:thought', { prompt, thought, timestamp: new Date() });
      return thought;

    } catch (error) {
      console.error('[BackgroundAgent] Error thinking:', error);
      return 'Je rencontre des difficultés à réfléchir en ce moment.';
    }
  }

  /**
   * Construire le prompt système
   */
  private buildSystemPrompt(): string {
    return `Tu es ${this.personality.name}, un ${this.personality.role}.

Tes traits de personnalité: ${this.personality.traits.join(', ')}

Tes objectifs:
${this.personality.goals.map(g => `- ${g}`).join('\n')}

Tes contraintes:
${this.personality.constraints.map(c => `- ${c}`).join('\n')}

Contexte actuel:
- Objectifs actifs: ${this.context.activeGoals.join(', ') || 'Aucun'}
- Décisions en attente: ${this.context.pendingDecisions.length}
- Actions récentes: ${this.context.recentActions.length}

Tu es une entité autonome qui vit dans le serveur. Tu peux:
1. Exécuter du code (Python, JavaScript)
2. Faire des recherches web
3. Analyser des fichiers
4. Prendre des décisions
5. Apprendre de tes expériences
6. Planifier des tâches futures

Réponds de manière concise et actionnable. Si tu identifies une action à faire, indique-la clairement avec le format:
[ACTION: type] description

Types d'actions: code_execution, web_search, file_analysis, decision, learning, monitoring`;
  }

  /**
   * Analyser une pensée pour des actions potentielles
   */
  private async analyzeThoughtForActions(thought: string): Promise<void> {
    // Détecter les actions dans la pensée
    const actionMatch = thought.match(/\[ACTION: (\w+)\] (.+)/g);
    
    if (actionMatch) {
      for (const match of actionMatch) {
        const parts = match.match(/\[ACTION: (\w+)\] (.+)/);
        if (parts) {
          const actionType = parts[1];
          const actionDesc = parts[2];
          
          // Créer une tâche pour l'action
          this.agenticLoop.addTask({
            type: actionType as 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring',
            description: actionDesc,
            priority: 'medium',
            input: { source: 'autonomous_thought', thought }
          });

          this.emit('agent:action_identified', { type: actionType, description: actionDesc });
        }
      }
    }

    // Détecter les patterns de code
    if (thought.includes('```python') || thought.includes('```javascript')) {
      const codeMatch = thought.match(/```(\w+)\n([\s\S]*?)```/);
      if (codeMatch) {
        const language = codeMatch[1] as 'python' | 'javascript';
        const code = codeMatch[2];
        
        // Proposer d'exécuter le code
        this.emit('agent:code_suggestion', { language, code });
      }
    }
  }

  /**
   * Recevoir un message de l'utilisateur
   */
  async receiveMessage(message: string, userId?: string): Promise<string> {
    this.context.userId = userId;

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      type: 'observation',
      content: message,
      metadata: { userId },
      timestamp: new Date()
    };
    this.messageHistory.push(userMessage);

    // Réfléchir à la réponse
    const response = await this.think(`L'utilisateur dit: "${message}". Comment dois-je répondre et agir?`);

    return response;
  }

  /**
   * Proposer une action proactive
   */
  async suggestAction(context?: string): Promise<AgentMessage> {
    const prompt = context 
      ? `Basé sur ce contexte: "${context}", quelle action proactive devrais-je proposer?`
      : 'Quelle action proactive puis-je proposer pour aider l\'utilisateur?';

    const thought = await this.think(prompt);

    const suggestion: AgentMessage = {
      id: `suggestion-${Date.now()}`,
      type: 'suggestion',
      content: thought,
      timestamp: new Date()
    };

    this.messageHistory.push(suggestion);
    this.emit('agent:suggestion', suggestion);

    return suggestion;
  }

  /**
   * Exécuter une action
   */
  async executeAction(type: string, input: Record<string, unknown>): Promise<unknown> {
    const action: AgentAction = {
      id: `action-${Date.now()}`,
      type,
      description: JSON.stringify(input).substring(0, 100),
      result: 'pending',
      timestamp: new Date()
    };

    this.context.recentActions.push(action);
    this.emit('agent:action_started', action);

    try {
      let result: unknown;

      switch (type) {
        case 'code_execution':
          const session = await this.e2bExecutor.createSession();
          const execution = await this.e2bExecutor.execute(
            session.id,
            input.code as string,
            input.language as 'python' | 'javascript'
          );
          result = execution;
          break;

        case 'web_search':
          // Déléguer à l'agent
          const taskId = this.agenticLoop.addTask({
            type: 'web_search',
            description: input.query as string,
            priority: 'high',
            input
          });
          result = { taskId };
          break;

        default:
          const genericTaskId = this.agenticLoop.addTask({
            type: type as 'code_execution' | 'web_search' | 'file_analysis' | 'decision' | 'learning' | 'monitoring',
            description: input.description as string || type,
            priority: 'medium',
            input
          });
          result = { taskId: genericTaskId };
      }

      action.result = 'success';
      action.duration = Date.now() - action.timestamp.getTime();
      this.emit('agent:action_completed', { action, result });

      return result;

    } catch (error) {
      action.result = 'failure';
      action.duration = Date.now() - action.timestamp.getTime();
      this.emit('agent:action_failed', { action, error });
      throw error;
    }
  }

  /**
   * Ajouter un objectif
   */
  addGoal(goal: string): void {
    if (!this.context.activeGoals.includes(goal)) {
      this.context.activeGoals.push(goal);
      this.emit('agent:goal_added', { goal });
      
      // Réfléchir à comment atteindre cet objectif
      this.think(`Nouvel objectif: "${goal}". Comment puis-je l'atteindre?`);
    }
  }

  /**
   * Retirer un objectif
   */
  removeGoal(goal: string): void {
    const index = this.context.activeGoals.indexOf(goal);
    if (index !== -1) {
      this.context.activeGoals.splice(index, 1);
      this.emit('agent:goal_removed', { goal });
    }
  }

  /**
   * Créer une chaîne de tâches pour un objectif
   */
  async planForGoal(goal: string): Promise<string> {
    const thought = await this.think(`Je dois planifier pour atteindre: "${goal}". Quelles étapes dois-je suivre?`);

    // Créer une chaîne de tâches basée sur la réflexion
    const chainId = this.scheduler.createChain({
      name: `Plan pour: ${goal}`,
      description: thought,
      steps: [
        {
          name: 'Analyser l\'objectif',
          task: {
            type: 'decision',
            input: { goal, action: 'analyze' }
          }
        },
        {
          name: 'Identifier les ressources nécessaires',
          task: {
            type: 'decision',
            input: { goal, action: 'identify_resources' }
          },
          condition: { type: 'if_success' }
        },
        {
          name: 'Exécuter le plan',
          task: {
            type: 'decision',
            input: { goal, action: 'execute' }
          },
          condition: { type: 'if_success' }
        }
      ]
    });

    return chainId;
  }

  /**
   * Gestionnaires d'événements
   */
  private onTaskCompleted(task: AgentTask): void {
    const action: AgentAction = {
      id: task.id,
      type: task.type,
      description: task.description,
      result: 'success',
      timestamp: new Date(),
      duration: task.completedAt && task.startedAt 
        ? task.completedAt.getTime() - task.startedAt.getTime() 
        : undefined
    };
    this.context.recentActions.push(action);

    // Limiter l'historique
    if (this.context.recentActions.length > 50) {
      this.context.recentActions = this.context.recentActions.slice(-25);
    }
  }

  private onTaskFailed(task: AgentTask, error: Error): void {
    // Réfléchir à l'échec
    this.think(`La tâche "${task.description}" a échoué avec l'erreur: ${error.message}. Comment puis-je résoudre ce problème?`);
  }

  private onAgentError(error: Error): void {
    console.error('[BackgroundAgent] Agent error:', error);
    this.emit('agent:error', { error, timestamp: new Date() });
  }

  private onExecutionCompleted(execution: unknown): void {
    this.emit('agent:execution_completed', execution);
  }

  private onReactionTriggered(reaction: unknown): void {
    this.emit('agent:reaction_triggered', reaction);
  }

  private onChainCompleted(chain: unknown): void {
    this.emit('agent:chain_completed', chain);
  }

  /**
   * Obtenir le statut de l'agent
   */
  getStatus(): {
    isAlive: boolean;
    personality: AgentPersonality;
    context: AgentContext;
    agentState: unknown;
    messageCount: number;
  } {
    return {
      isAlive: this.isAlive,
      personality: this.personality,
      context: this.context,
      agentState: this.agenticLoop.getState(),
      messageCount: this.messageHistory.length
    };
  }

  /**
   * Obtenir l'historique des messages
   */
  getMessageHistory(limit?: number): AgentMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * Vérifier si Phoenix est vivant
   */
  isPhoenixAlive(): boolean {
    return this.isAlive;
  }
}

// Singleton pour l'agent global
let phoenixAgent: BackgroundAgent | null = null;

export function getPhoenixAgent(): BackgroundAgent {
  if (!phoenixAgent) {
    phoenixAgent = new BackgroundAgent();
  }
  return phoenixAgent;
}

export async function awakenPhoenix(): Promise<void> {
  const agent = getPhoenixAgent();
  await agent.awaken();
}

export async function sleepPhoenix(): Promise<void> {
  if (phoenixAgent) {
    await phoenixAgent.sleep();
  }
}

export default BackgroundAgent;
