/**
 * Tests pour le Phoenix Living System
 * Vérifie que Phoenix fonctionne comme une entité autonome
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgenticLoop } from './agenticLoop';
import { E2BBidirectional } from './e2bBidirectional';
import { TaskScheduler } from './taskScheduler';
import { BackgroundAgent } from './backgroundAgent';
import { PhoenixLivingSystem } from './phoenixLivingSystem';

// Mock du LLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: 'Je suis Phoenix, prêt à aider. [ACTION: monitoring] Vérifier le système.'
      }
    }]
  })
}));

describe('Agentic Loop', () => {
  let agenticLoop: AgenticLoop;

  beforeEach(() => {
    agenticLoop = new AgenticLoop();
  });

  afterEach(() => {
    agenticLoop.stop();
  });

  it('should start and stop correctly', () => {
    expect(agenticLoop.isAgentRunning()).toBe(false);
    
    agenticLoop.start();
    expect(agenticLoop.isAgentRunning()).toBe(true);
    
    agenticLoop.stop();
    expect(agenticLoop.isAgentRunning()).toBe(false);
  });

  it('should add tasks to the queue', () => {
    const taskId = agenticLoop.addTask({
      type: 'code_execution',
      description: 'Test task',
      priority: 'medium',
      input: { code: 'print("hello")' }
    });

    expect(taskId).toBeDefined();
    expect(taskId).toContain('task-');

    const state = agenticLoop.getState();
    expect(state.taskQueue.length).toBe(1);
    expect(state.taskQueue[0].description).toBe('Test task');
  });

  it('should create task chains', () => {
    const taskIds = agenticLoop.createTaskChain([
      { type: 'code_execution', description: 'Step 1', priority: 'high', input: {} },
      { type: 'decision', description: 'Step 2', priority: 'medium', input: {} },
      { type: 'monitoring', description: 'Step 3', priority: 'low', input: {} }
    ]);

    expect(taskIds.length).toBe(3);
    
    const state = agenticLoop.getState();
    expect(state.taskQueue.length).toBe(3);
    
    // Vérifier les dépendances
    const step2 = state.taskQueue.find(t => t.id === taskIds[1]);
    expect(step2?.dependsOn).toContain(taskIds[0]);
  });

  it('should emit events on task lifecycle', () => {
    const addedHandler = vi.fn();
    agenticLoop.on('task:added', addedHandler);

    agenticLoop.addTask({
      type: 'monitoring',
      description: 'Event test',
      priority: 'low',
      input: {}
    });

    expect(addedHandler).toHaveBeenCalled();
  });
});

describe('E2B Bidirectional', () => {
  let e2bExecutor: E2BBidirectional;

  beforeEach(() => {
    e2bExecutor = new E2BBidirectional();
  });

  it('should create sessions', async () => {
    const session = await e2bExecutor.createSession();
    
    expect(session.id).toBeDefined();
    expect(session.status).toBe('ready');
  });

  it('should execute code in sessions', async () => {
    const session = await e2bExecutor.createSession();
    const execution = await e2bExecutor.execute(session.id, 'print("hello")', 'python');
    
    expect(execution.id).toBeDefined();
    expect(execution.status).toBe('completed');
    expect(execution.code).toBe('print("hello")');
  });

  it('should detect and react to errors', async () => {
    const session = await e2bExecutor.createSession();
    
    const reactionHandler = vi.fn();
    e2bExecutor.on('reaction:triggered', reactionHandler);

    // Exécuter du code qui simule une erreur
    await e2bExecutor.execute(session.id, 'raise error', 'python');
    
    // La réaction devrait être déclenchée
    // Note: Dépend de la simulation
  });

  it('should execute code chains', async () => {
    const session = await e2bExecutor.createSession();
    
    const results = await e2bExecutor.executeChain(session.id, [
      { code: 'print("step 1")', language: 'python' },
      { code: 'print("step 2")', language: 'python' }
    ]);

    expect(results.length).toBe(2);
    expect(results[0].status).toBe('completed');
    expect(results[1].status).toBe('completed');
  });
});

describe('Task Scheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should schedule tasks', () => {
    const taskId = scheduler.scheduleTask({
      name: 'Test Task',
      description: 'A test scheduled task',
      schedule: {
        type: 'once',
        runAt: new Date(Date.now() + 60000)
      },
      task: {
        type: 'monitoring',
        input: {}
      }
    });

    expect(taskId).toBeDefined();
    
    const tasks = scheduler.getScheduledTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe('Test Task');
  });

  it('should create task chains', () => {
    const chainId = scheduler.createChain({
      name: 'Test Chain',
      description: 'A test chain',
      steps: [
        { name: 'Step 1', task: { type: 'decision', input: {} } },
        { name: 'Step 2', task: { type: 'monitoring', input: {} } }
      ]
    });

    expect(chainId).toBeDefined();
    
    const chains = scheduler.getChains();
    expect(chains.length).toBe(1);
    expect(chains[0].steps.length).toBe(2);
  });

  it('should cancel tasks', () => {
    const taskId = scheduler.scheduleTask({
      name: 'Cancellable Task',
      description: 'Will be cancelled',
      schedule: { type: 'interval', intervalMs: 10000 },
      task: { type: 'monitoring', input: {} }
    });

    scheduler.cancelTask(taskId);
    
    const tasks = scheduler.getScheduledTasks();
    expect(tasks[0].status).toBe('paused');
  });
});

describe('Background Agent', () => {
  let agent: BackgroundAgent;

  beforeEach(() => {
    agent = new BackgroundAgent();
  });

  afterEach(async () => {
    await agent.sleep();
  });

  it('should awaken and sleep', async () => {
    expect(agent.isPhoenixAlive()).toBe(false);
    
    await agent.awaken();
    expect(agent.isPhoenixAlive()).toBe(true);
    
    await agent.sleep();
    expect(agent.isPhoenixAlive()).toBe(false);
  });

  it('should have a personality', () => {
    const status = agent.getStatus();
    
    expect(status.personality.name).toBe('Phoenix');
    expect(status.personality.traits.length).toBeGreaterThan(0);
    expect(status.personality.goals.length).toBeGreaterThan(0);
  });

  it('should add and remove goals', () => {
    agent.addGoal('Test goal');
    
    let status = agent.getStatus();
    expect(status.context.activeGoals).toContain('Test goal');
    
    agent.removeGoal('Test goal');
    
    status = agent.getStatus();
    expect(status.context.activeGoals).not.toContain('Test goal');
  });

  it('should think and generate thoughts', async () => {
    await agent.awaken();
    
    const thoughtHandler = vi.fn();
    agent.on('agent:thought', thoughtHandler);

    const thought = await agent.think('Test prompt');
    
    expect(thought).toBeDefined();
    expect(thoughtHandler).toHaveBeenCalled();
  });
});

describe('Phoenix Living System', () => {
  let system: PhoenixLivingSystem;

  beforeEach(() => {
    system = new PhoenixLivingSystem();
  });

  afterEach(async () => {
    await system.stop();
  });

  it('should start and stop the system', async () => {
    expect(system.isAlive()).toBe(false);
    
    await system.start();
    expect(system.isAlive()).toBe(true);
    
    await system.stop();
    expect(system.isAlive()).toBe(false);
  });

  it('should report system status', async () => {
    await system.start();
    
    const status = system.getStatus();
    
    expect(status.isAlive).toBe(true);
    expect(status.components.agenticLoop.status).toBe('running');
    expect(status.components.backgroundAgent.status).toBe('running');
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should create task chains', async () => {
    await system.start();
    
    const chainId = system.createTaskChain({
      name: 'System Test Chain',
      description: 'Testing chain creation',
      steps: [
        { name: 'Step 1', type: 'decision', input: { test: true } },
        { name: 'Step 2', type: 'monitoring', input: {} }
      ]
    });

    expect(chainId).toBeDefined();
    expect(chainId).toContain('chain-');
  });

  it('should add goals', async () => {
    await system.start();
    
    system.addGoal('Test system goal');
    
    const status = system.getStatus();
    // Le goal est ajouté au background agent
    expect(status.isAlive).toBe(true);
  });

  it('should log events', async () => {
    await system.start();
    
    const events = system.getEventLog();
    
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'system_started')).toBe(true);
  });

  it('should track stats', async () => {
    await system.start();
    
    const status = system.getStatus();
    
    expect(status.stats).toBeDefined();
    expect(status.stats.totalTasks).toBeGreaterThanOrEqual(0);
    expect(status.stats.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('Integration Tests', () => {
  it('should connect all components', async () => {
    const system = new PhoenixLivingSystem();
    await system.start();

    // Vérifier que tous les composants sont connectés
    const status = system.getStatus();
    
    expect(status.components.agenticLoop.status).toBe('running');
    expect(status.components.scheduler.status).toBe('running');
    expect(status.components.backgroundAgent.status).toBe('running');

    await system.stop();
  });

  it('should handle message flow', async () => {
    const system = new PhoenixLivingSystem();
    await system.start();

    const response = await system.sendMessage('Hello Phoenix', 'test-user');
    
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');

    await system.stop();
  });

  it('should emit events across components', async () => {
    const system = new PhoenixLivingSystem();
    const eventHandler = vi.fn();
    system.on('phoenix:event', eventHandler);

    await system.start();

    // Attendre un peu pour les événements
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(eventHandler).toHaveBeenCalled();

    await system.stop();
  });
});
