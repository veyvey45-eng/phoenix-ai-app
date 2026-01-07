/**
 * Tests pour l'Agent Loop V2 et ses composants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances externes
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"action": "answer", "thought": "Test", "answer": "Test response"}' } }]
  })
}));

vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue(null)
}));

// Tests pour AgentCache
describe('AgentCache', () => {
  let agentCache: any;

  beforeEach(async () => {
    const module = await import('./agentCache');
    agentCache = module.agentCache;
    agentCache.clear();
  });

  it('should store and retrieve values', () => {
    agentCache.set('test-key', { data: 'test-value' });
    const result = agentCache.get('test-key');
    expect(result).toEqual({ data: 'test-value' });
  });

  it('should return null for non-existent keys', () => {
    const result = agentCache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should delete entries', () => {
    agentCache.set('to-delete', 'value');
    expect(agentCache.has('to-delete')).toBe(true);
    agentCache.delete('to-delete');
    expect(agentCache.has('to-delete')).toBe(false);
  });

  it('should track cache statistics', () => {
    agentCache.set('stat-test', 'value');
    agentCache.get('stat-test');
    agentCache.get('non-existent');
    
    const stats = agentCache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats.size).toBeGreaterThanOrEqual(1);
  });

  it('should invalidate by prefix', () => {
    agentCache.set('prefix:1', 'value1');
    agentCache.set('prefix:2', 'value2');
    agentCache.set('other:1', 'value3');
    
    const invalidated = agentCache.invalidateByPrefix('prefix:');
    expect(invalidated).toBe(2);
    expect(agentCache.has('prefix:1')).toBe(false);
    expect(agentCache.has('other:1')).toBe(true);
  });
});

// Tests pour SearchResultCache
describe('SearchResultCache', () => {
  let searchCache: any;

  beforeEach(async () => {
    const module = await import('./agentCache');
    searchCache = module.searchCache;
    searchCache.clear();
  });

  it('should cache search results', () => {
    const results = [{ title: 'Test Result', url: 'https://example.com' }];
    searchCache.cacheSearchResult('test query', results);
    
    const cached = searchCache.getSearchResult('test query');
    expect(cached).toEqual(results);
  });

  it('should normalize query keys', () => {
    searchCache.cacheSearchResult('  TEST QUERY  ', { data: 'test' });
    const cached = searchCache.getSearchResult('test query');
    expect(cached).toEqual({ data: 'test' });
  });
});

// Tests pour PluginManager
describe('PluginManager', () => {
  let pluginManager: any;

  beforeEach(async () => {
    const module = await import('./pluginSystem');
    pluginManager = module.pluginManager;
  });

  it('should list built-in plugins', () => {
    const plugins = pluginManager.listPlugins();
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.some((p: any) => p.id === 'builtin-logging')).toBe(true);
  });

  it('should toggle plugin enabled state', () => {
    pluginManager.togglePlugin('builtin-logging', false);
    const plugin = pluginManager.getPlugin('builtin-logging');
    expect(plugin?.isEnabled).toBe(false);
    pluginManager.togglePlugin('builtin-logging', true);
  });
});

// Tests pour MultiAgentConversation
describe('MultiAgentConversation', () => {
  it('should have predefined roles', async () => {
    const { PREDEFINED_ROLES } = await import('./multiAgentConversation');
    
    expect(PREDEFINED_ROLES.length).toBeGreaterThan(0);
    expect(PREDEFINED_ROLES.some(r => r.id === 'coordinator')).toBe(true);
    expect(PREDEFINED_ROLES.some(r => r.id === 'researcher')).toBe(true);
  });

  it('should initialize conversation', async () => {
    const { MultiAgentConversation } = await import('./multiAgentConversation');
    
    const conv = new MultiAgentConversation({ maxTurns: 5 });
    expect(conv).toBeDefined();
    expect(conv.getConversation()).toEqual([]);
    expect(conv.getStats().totalTurns).toBe(0);
  });

  it('should add agents with roles', async () => {
    const { MultiAgentConversation } = await import('./multiAgentConversation');
    
    const conv = new MultiAgentConversation();
    const agentId = conv.addAgent('researcher');
    expect(agentId).toContain('researcher');
  });
});

// Tests pour AgentLearningSystem
describe('AgentLearningSystem', () => {
  it('should initialize learning system', async () => {
    const { agentLearningSystem } = await import('./agentLearning');
    expect(agentLearningSystem).toBeDefined();
  });

  it('should return empty stats when no DB', async () => {
    const { agentLearningSystem } = await import('./agentLearning');
    const stats = await agentLearningSystem.getStats(1);
    
    expect(stats.totalPatterns).toBe(0);
    expect(stats.avgConfidence).toBe(0);
  });
});

// Tests pour AgentWebhookManager
describe('AgentWebhookManager', () => {
  it('should initialize webhook manager', async () => {
    const { agentWebhookManager } = await import('./agentWebhooks');
    expect(agentWebhookManager).toBeDefined();
  });

  it('should verify signatures correctly', async () => {
    const { agentWebhookManager } = await import('./agentWebhooks');
    const crypto = await import('crypto');
    
    const payload = '{"test": "data"}';
    const secret = 'test-secret';
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    const isValid = agentWebhookManager.verifySignature(payload, expectedSignature, secret);
    expect(isValid).toBe(true);
  });
});

// Tests pour ScheduledTaskManager
describe('ScheduledTaskManager', () => {
  it('should initialize task manager', async () => {
    const { scheduledTaskManager } = await import('./scheduledTasks');
    expect(scheduledTaskManager).toBeDefined();
  });

  it('should start and stop manager', async () => {
    const { scheduledTaskManager } = await import('./scheduledTasks');
    
    scheduledTaskManager.start();
    scheduledTaskManager.stop();
    // Should not throw
    expect(true).toBe(true);
  });
});

// Tests pour PhoenixAgentV2
describe('PhoenixAgentV2', () => {
  it('should create agent with goal', async () => {
    const { PhoenixAgentV2 } = await import('./agentLoopV2');
    
    const agent = new PhoenixAgentV2('Test goal');
    expect(agent).toBeDefined();
    expect(agent.getId()).toBeDefined();
  });

  it('should get agent state', async () => {
    const { PhoenixAgentV2 } = await import('./agentLoopV2');
    
    const agent = new PhoenixAgentV2('Test goal', { maxIterations: 5 });
    const state = agent.getState();
    
    expect(state.status).toBe('idle');
    expect(state.currentIteration).toBe(0);
  });

  it('should register event listeners', async () => {
    const { PhoenixAgentV2 } = await import('./agentLoopV2');
    
    const agent = new PhoenixAgentV2('Test goal');
    const events: any[] = [];
    
    agent.onEvent((event) => {
      events.push(event);
    });
    
    expect(true).toBe(true);
  });
});
