/**
 * Système de conversation multi-agents pour Phoenix
 */

import { invokeLLM } from '../_core/llm';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
}

export interface ConversationMessage {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: Date;
  type: 'message' | 'action' | 'result' | 'handoff';
}

export interface MultiAgentConfig {
  maxTurns: number;
  enableHandoff: boolean;
  coordinatorRole: string;
}

export const PREDEFINED_ROLES: AgentRole[] = [
  {
    id: 'coordinator',
    name: 'Coordinateur',
    description: 'Coordonne les autres agents et distribue les tâches',
    systemPrompt: `Tu es le coordinateur d'une équipe d'agents IA.`,
    capabilities: ['planning', 'delegation', 'synthesis']
  },
  {
    id: 'researcher',
    name: 'Chercheur',
    description: 'Spécialisé dans la recherche et l\'analyse d\'informations',
    systemPrompt: `Tu es un agent chercheur spécialisé.`,
    capabilities: ['web_search', 'analyze_data', 'summarize']
  },
  {
    id: 'coder',
    name: 'Développeur',
    description: 'Spécialisé dans l\'écriture et l\'exécution de code',
    systemPrompt: `Tu es un agent développeur.`,
    capabilities: ['execute_python', 'execute_javascript', 'write_file']
  },
  {
    id: 'writer',
    name: 'Rédacteur',
    description: 'Spécialisé dans la rédaction et la communication',
    systemPrompt: `Tu es un agent rédacteur.`,
    capabilities: ['summarize', 'translate', 'write_file']
  },
  {
    id: 'analyst',
    name: 'Analyste',
    description: 'Spécialisé dans l\'analyse de données et les insights',
    systemPrompt: `Tu es un agent analyste.`,
    capabilities: ['analyze_data', 'execute_python', 'summarize']
  }
];

interface SimpleAgent {
  id: string;
  role: AgentRole;
}

export class MultiAgentConversation {
  private agents: Map<string, SimpleAgent> = new Map();
  private roles: Map<string, AgentRole> = new Map();
  private conversation: ConversationMessage[] = [];
  private config: MultiAgentConfig;
  private currentTurn: number = 0;

  constructor(config?: Partial<MultiAgentConfig>) {
    this.config = {
      maxTurns: config?.maxTurns ?? 20,
      enableHandoff: config?.enableHandoff ?? true,
      coordinatorRole: config?.coordinatorRole ?? 'coordinator'
    };

    PREDEFINED_ROLES.forEach(role => {
      this.roles.set(role.id, role);
    });
  }

  addAgent(roleId: string): string {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Unknown role: ${roleId}`);
    }

    const agentId = `${roleId}-${Date.now()}`;
    this.agents.set(agentId, { id: agentId, role });
    console.log(`[MultiAgent] Added agent ${agentId} with role ${role.name}`);
    return agentId;
  }

  addCustomRole(role: AgentRole): void {
    this.roles.set(role.id, role);
  }

  async *execute(goal: string): AsyncGenerator<any> {
    console.log(`[MultiAgent] Starting conversation with goal: ${goal}`);
    
    yield { type: 'multi_agent_start', data: { goal, agentCount: this.agents.size } };

    if (!this.hasAgentWithRole(this.config.coordinatorRole)) {
      this.addAgent(this.config.coordinatorRole);
    }

    yield { type: 'coordination_start', data: { message: 'Le coordinateur analyse la tâche...' } };
    
    const plan = await this.coordinatorPlan(goal);
    yield { type: 'plan_created', data: { plan } };

    for (const subtask of plan.subtasks) {
      if (this.currentTurn >= this.config.maxTurns) {
        yield { type: 'max_turns_reached', data: { turn: this.currentTurn } };
        break;
      }

      this.currentTurn++;
      
      yield { type: 'subtask_start', data: {
        turn: this.currentTurn,
        subtask: subtask.description,
        assignedRole: subtask.role
      }};

      let agentId = this.findAgentByRole(subtask.role);
      if (!agentId) {
        agentId = this.addAgent(subtask.role);
      }

      const result = await this.executeSubtask(subtask.description);
      
      this.conversation.push({
        agentId,
        agentName: this.roles.get(subtask.role)?.name || subtask.role,
        content: result,
        timestamp: new Date(),
        type: 'result'
      });

      yield { type: 'subtask_complete', data: {
        turn: this.currentTurn,
        agentId,
        result: result.substring(0, 500)
      }};
    }

    yield { type: 'synthesis_start', data: { message: 'Synthèse des résultats...' } };
    
    const finalAnswer = await this.coordinatorSynthesize(goal);
    
    yield { type: 'multi_agent_complete', data: {
      turns: this.currentTurn,
      agentsUsed: this.agents.size,
      finalAnswer
    }};
  }

  private hasAgentWithRole(roleId: string): boolean {
    const keys = Array.from(this.agents.keys());
    return keys.some(agentId => agentId.startsWith(roleId));
  }

  private findAgentByRole(roleId: string): string | undefined {
    const keys = Array.from(this.agents.keys());
    return keys.find(agentId => agentId.startsWith(roleId));
  }

  private async coordinatorPlan(goal: string): Promise<{
    subtasks: Array<{ description: string; role: string; priority: number }>;
  }> {
    try {
      const availableRoles = Array.from(this.roles.values())
        .map(r => `- ${r.id}: ${r.description}`)
        .join('\n');

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Tu es un coordinateur d'équipe d'agents IA. Analyse l'objectif et crée un plan de sous-tâches.

RÔLES DISPONIBLES:
${availableRoles}

Réponds en JSON:
{
  "subtasks": [
    { "description": "description de la sous-tâche", "role": "id_du_role", "priority": 1 }
  ]
}`
          },
          { role: 'user', content: `Objectif: ${goal}` }
        ],
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '{}';
      const parsed = JSON.parse(content);

      return {
        subtasks: parsed.subtasks || [{ description: goal, role: 'researcher', priority: 1 }]
      };
    } catch (error) {
      console.error('[MultiAgent] Planning error:', error);
      return {
        subtasks: [{ description: goal, role: 'researcher', priority: 1 }]
      };
    }
  }

  private async executeSubtask(task: string): Promise<string> {
    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu es un agent spécialisé. Exécute la tâche demandée.' },
          { role: 'user', content: task }
        ]
      });
      const rawContent = response.choices[0]?.message?.content;
      return typeof rawContent === 'string' ? rawContent : 'Tâche complétée.';
    } catch (error) {
      return 'Erreur lors de l\'exécution de la tâche.';
    }
  }

  private async coordinatorSynthesize(goal: string): Promise<string> {
    try {
      const conversationSummary = this.conversation
        .map(m => `[${m.agentName}]: ${m.content.substring(0, 300)}`)
        .join('\n\n');

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu es un coordinateur. Synthétise les résultats de l\'équipe.' },
          { role: 'user', content: `Objectif: ${goal}\n\nRésultats:\n${conversationSummary}` }
        ]
      });

      const rawContent = response.choices[0]?.message?.content;
      return typeof rawContent === 'string' ? rawContent : 'Synthèse complétée.';
    } catch (error) {
      return 'Synthèse complétée avec les résultats disponibles.';
    }
  }

  getConversation(): ConversationMessage[] {
    return [...this.conversation];
  }

  getStats(): { totalTurns: number; agentCount: number; messageCount: number } {
    return {
      totalTurns: this.currentTurn,
      agentCount: this.agents.size,
      messageCount: this.conversation.length
    };
  }
}
