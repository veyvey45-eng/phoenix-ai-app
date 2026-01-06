/**
 * Task Agent Module for Phoenix AI
 */

import { invokeLLM } from '../_core/llm';

export interface TaskPlan {
  id: string;
  objective: string;
  steps: TaskStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  results: TaskResult[];
}

export interface TaskStep {
  id: string;
  description: string;
  type: 'research' | 'code' | 'document' | 'email' | 'image' | 'analysis' | 'custom';
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
}

export interface TaskResult {
  stepId: string;
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
}

export function shouldUseTaskAgent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const triggers = [
    'puis', 'ensuite', 'après', 'et ensuite', 'automatiquement', 'workflow', 'processus',
    'étapes', 'séquence', 'chaîne', 'tout faire', 'fais tout', 'exécute tout',
    'then', 'after', 'workflow', 'process',
  ];
  return triggers.some(t => lowerMessage.includes(t));
}

export async function createTaskPlan(objective: string): Promise<TaskPlan> {
  console.log(`[TaskAgent] Creating plan for: ${objective}`);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'Tu es un agent de planification. Décompose l\'objectif en étapes. Format JSON: {"steps": [{"id": "step1", "description": "...", "type": "research|code|document|email|image|analysis|custom", "dependencies": []}]}',
        },
        { role: 'user', content: `Objectif: ${objective}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string' },
                    dependencies: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['id', 'description', 'type', 'dependencies'],
                  additionalProperties: false,
                },
              },
            },
            required: ['steps'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '';
    const parsed = JSON.parse(contentStr || '{"steps": []}');
    
    return {
      id: `plan_${Date.now()}`,
      objective,
      steps: parsed.steps.map((s: { id: string; description: string; type: string; dependencies: string[] }) => ({
        ...s,
        status: 'pending' as const,
      })),
      status: 'pending',
      createdAt: new Date(),
      results: [],
    };
  } catch (error) {
    console.error('[TaskAgent] Error creating plan:', error);
    return {
      id: `plan_${Date.now()}`,
      objective,
      steps: [{ id: 'step1', description: objective, type: 'custom', dependencies: [], status: 'pending' }],
      status: 'pending',
      createdAt: new Date(),
      results: [],
    };
  }
}

export async function executeTaskPlan(
  plan: TaskPlan,
  onProgress?: (progress: { stepId: string; status: string; result?: unknown }) => void
): Promise<TaskPlan> {
  console.log(`[TaskAgent] Executing plan: ${plan.id}`);
  plan.status = 'running';
  
  for (const step of plan.steps) {
    const dependenciesMet = step.dependencies.every(depId => {
      const dep = plan.steps.find(s => s.id === depId);
      return dep?.status === 'completed';
    });
    
    if (!dependenciesMet) {
      step.status = 'skipped';
      onProgress?.({ stepId: step.id, status: 'skipped' });
      continue;
    }
    
    step.status = 'running';
    onProgress?.({ stepId: step.id, status: 'running' });
    
    const startTime = Date.now();
    
    try {
      const result = await executeStep(step, plan);
      step.status = 'completed';
      step.result = result;
      plan.results.push({ stepId: step.id, success: true, output: result, duration: Date.now() - startTime });
      onProgress?.({ stepId: step.id, status: 'completed', result });
    } catch (error) {
      step.status = 'failed';
      plan.results.push({
        stepId: step.id,
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      onProgress?.({ stepId: step.id, status: 'failed' });
    }
  }
  
  plan.status = plan.steps.every(s => s.status === 'completed' || s.status === 'skipped') ? 'completed' : 'failed';
  plan.completedAt = new Date();
  return plan;
}

async function executeStep(step: TaskStep, plan: TaskPlan): Promise<unknown> {
  console.log(`[TaskAgent] Executing step: ${step.id} (${step.type})`);
  
  const previousResults = plan.results.filter(r => step.dependencies.includes(r.stepId));
  const context = previousResults.map(r => String(r.output)).join('\n');
  
  const response = await invokeLLM({
    messages: [
      { role: 'system', content: 'Tu es un assistant qui exécute des tâches. Exécute cette étape et retourne le résultat.' },
      { role: 'user', content: `Étape: ${step.description}\n\nContexte:\n${context || 'Aucun'}` },
    ],
  });
  
  return typeof response.choices[0]?.message?.content === 'string'
    ? response.choices[0].message.content
    : 'Étape exécutée.';
}
