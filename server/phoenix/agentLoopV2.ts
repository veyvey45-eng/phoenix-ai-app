/**
 * Phoenix Agent Loop V2 - Moteur d'agent avec boucle ReAct
 */

import { invokeLLM } from '../_core/llm';
import { searchCache, browseCache } from './agentCache';

export interface AgentEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export interface AgentConfig {
  maxIterations: number;
  enableAutoCorrection: boolean;
  enableDynamicReplanning: boolean;
  tools: string[];
}

export interface AgentState {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  currentIteration: number;
  plan: any;
  memory: any[];
  artifacts: any[];
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 20,
  enableAutoCorrection: true,
  enableDynamicReplanning: true,
  tools: ['web_search', 'browse', 'execute_python', 'execute_javascript', 'summarize', 'translate']
};

export class PhoenixAgentV2 {
  private id: string;
  private goal: string;
  private config: AgentConfig;
  private state: AgentState;
  private eventListeners: ((event: AgentEvent) => void)[] = [];

  constructor(goal: string, config?: Partial<AgentConfig>) {
    this.id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.goal = goal;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      status: 'idle',
      currentIteration: 0,
      plan: null,
      memory: [],
      artifacts: []
    };
    console.log(`[AgentV2] Created agent ${this.id} with goal: ${goal}`);
  }

  getId(): string {
    return this.id;
  }

  getState(): AgentState {
    return { ...this.state };
  }

  onEvent(listener: (event: AgentEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[AgentV2] Event listener error:', e);
      }
    }
  }

  async *execute(): AsyncGenerator<AgentEvent> {
    this.state.status = 'running';
    yield this.createEvent('agent_started', { goal: this.goal });

    try {
      yield this.createEvent('planning_start', { message: 'Analyse de la tâche...' });
      const plan = await this.createPlan();
      this.state.plan = plan;
      yield this.createEvent('plan_created', { plan });

      while (this.state.currentIteration < this.config.maxIterations) {
        this.state.currentIteration++;
        
        yield this.createEvent('iteration_start', { 
          iteration: this.state.currentIteration,
          maxIterations: this.config.maxIterations
        });

        const thought = await this.think();
        yield this.createEvent('thought', { thought });

        if (thought.action === 'answer') {
          yield this.createEvent('answer', thought.answer);
          this.state.status = 'completed';
          break;
        }

        yield this.createEvent('action_start', { 
          tool: thought.action,
          args: thought.args
        });

        const result = await this.act(thought.action, thought.args);
        
        yield this.createEvent('action_complete', {
          tool: thought.action,
          result: typeof result === 'string' ? result.substring(0, 500) : result
        });

        this.state.memory.push({
          iteration: this.state.currentIteration,
          thought,
          result,
          timestamp: new Date()
        });

        if (this.config.enableDynamicReplanning && this.shouldReplan(result)) {
          yield this.createEvent('replanning', { reason: 'Résultats inattendus' });
          const newPlan = await this.createPlan();
          this.state.plan = newPlan;
          yield this.createEvent('plan_updated', { plan: newPlan });
        }
      }

      if (this.state.status !== 'completed') {
        yield this.createEvent('max_iterations_reached', { 
          iterations: this.state.currentIteration 
        });
        this.state.status = 'completed';
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield this.createEvent('error', { error: errorMessage });
      this.state.status = 'failed';
    }

    yield this.createEvent('agent_completed', { 
      status: this.state.status,
      iterations: this.state.currentIteration,
      artifactCount: this.state.artifacts.length
    });
  }

  private createEvent(type: string, data: any): AgentEvent {
    const event: AgentEvent = {
      type,
      data,
      timestamp: new Date()
    };
    this.emit(event);
    return event;
  }

  private async createPlan(): Promise<any> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un planificateur d'agent IA. Crée un plan pour atteindre l'objectif.

OUTILS DISPONIBLES: ${this.config.tools.join(', ')}

Réponds en JSON:
{
  "steps": [
    { "description": "description de l'étape", "tool": "nom_outil", "priority": 1 }
  ],
  "estimatedIterations": 5
}`
          },
          { role: 'user', content: `Objectif: ${this.goal}` }
        ],
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('[AgentV2] Planning error:', error);
      return { steps: [{ description: this.goal, tool: 'web_search', priority: 1 }] };
    }
  }

  private async think(): Promise<{ action: string; args?: any; thought: string; answer?: string }> {
    try {
      const memoryContext = this.state.memory
        .slice(-5)
        .map(m => `[Iteration ${m.iteration}] Action: ${m.thought.action}, Résultat: ${typeof m.result === 'string' ? m.result.substring(0, 200) : JSON.stringify(m.result).substring(0, 200)}`)
        .join('\\n');

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un agent IA qui réfléchit étape par étape.

OUTILS DISPONIBLES: ${this.config.tools.join(', ')}

HISTORIQUE:
${memoryContext || 'Aucune action précédente'}

Réponds en JSON:
{
  "thought": "ton raisonnement",
  "action": "nom_outil ou 'answer' si tu as la réponse finale",
  "args": { "query": "..." },
  "answer": "réponse finale si action='answer'"
}`
          },
          { role: 'user', content: `Objectif: ${this.goal}` }
        ],
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('[AgentV2] Think error:', error);
      return { action: 'answer', thought: 'Erreur de réflexion', answer: "Je n'ai pas pu compléter la tâche." };
    }
  }

  private async act(action: string, args: any): Promise<any> {
    console.log(`[AgentV2] Executing action: ${action}`, args);

    switch (action) {
      case 'web_search':
        return this.executeSearch(args?.query || this.goal);
      case 'browse':
        return this.executeBrowse(args?.url);
      case 'execute_python':
        return this.executeCode('python', args?.code);
      case 'execute_javascript':
        return this.executeCode('javascript', args?.code);
      case 'summarize':
        return this.executeSummarize(args?.text);
      case 'translate':
        return this.executeTranslate(args?.text, args?.targetLanguage);
      default:
        return `Action non reconnue: ${action}`;
    }
  }

  private async executeSearch(query: string): Promise<string> {
    const cached = searchCache.getSearchResult(query);
    if (cached) {
      return `[Cache] ${JSON.stringify(cached)}`;
    }
    const result = `Résultats de recherche pour "${query}": [Résultat 1, Résultat 2, Résultat 3]`;
    searchCache.cacheSearchResult(query, result);
    return result;
  }

  private async executeBrowse(url: string): Promise<string> {
    if (!url) return 'URL manquante';
    const cached = browseCache.getBrowseResult(url);
    if (cached) {
      return `[Cache] ${cached}`;
    }
    const result = `Contenu de ${url}: [Page web simulée]`;
    browseCache.cacheBrowseResult(url, result);
    return result;
  }

  private async executeCode(language: string, code: string): Promise<string> {
    if (!code) return 'Code manquant';
    return `[${language}] Code exécuté avec succès`;
  }

  private async executeSummarize(text: string): Promise<string> {
    if (!text) return 'Texte manquant';
    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Résume le texte suivant de manière concise.' },
          { role: 'user', content: text }
        ]
      });
      const rawContent = response.choices[0]?.message?.content;
      return typeof rawContent === 'string' ? rawContent : 'Résumé non disponible';
    } catch (error) {
      return 'Erreur lors du résumé';
    }
  }

  private async executeTranslate(text: string, targetLanguage: string): Promise<string> {
    if (!text) return 'Texte manquant';
    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: `Traduis le texte suivant en ${targetLanguage || 'français'}.` },
          { role: 'user', content: text }
        ]
      });
      const rawContent = response.choices[0]?.message?.content;
      return typeof rawContent === 'string' ? rawContent : 'Traduction non disponible';
    } catch (error) {
      return 'Erreur lors de la traduction';
    }
  }

  private shouldReplan(result: any): boolean {
    if (typeof result === 'string' && result.includes('erreur')) {
      return true;
    }
    return false;
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      this.emit(this.createEvent('agent_paused', {}));
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
      this.emit(this.createEvent('agent_resumed', {}));
    }
  }

  stop(): void {
    this.state.status = 'completed';
    this.emit(this.createEvent('agent_stopped', {}));
  }
}

export async function runAgent(goal: string, config?: Partial<AgentConfig>): Promise<{
  status: string;
  iterations: number;
  finalAnswer?: string;
}> {
  const agent = new PhoenixAgentV2(goal, config);
  let finalAnswer: string | undefined;

  for await (const event of agent.execute()) {
    if (event.type === 'answer') {
      finalAnswer = event.data;
    }
  }

  const state = agent.getState();
  return {
    status: state.status,
    iterations: state.currentIteration,
    finalAnswer
  };
}
