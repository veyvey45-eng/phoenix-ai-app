/**
 * Tests pour l'AgentCore - Moteur d'agent autonome Phoenix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createAgent, 
  getAgent, 
  listAgents, 
  deleteAgent,
  cancelAgent
} from './agentCore';

describe('AgentCore', () => {
  let testAgentId: string;

  beforeEach(() => {
    // Créer un agent de test
    const agent = createAgent('Test goal for unit testing');
    testAgentId = agent.id;
  });

  afterEach(() => {
    // Nettoyer l'agent de test
    if (testAgentId) {
      deleteAgent(testAgentId);
    }
  });

  describe('createAgent', () => {
    it('should create an agent with correct initial state', () => {
      const agent = createAgent('Rechercher des informations sur l\'IA');
      
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.goal).toBe('Rechercher des informations sur l\'IA');
      expect(agent.status).toBe('idle');
      expect(agent.steps).toEqual([]);
      expect(agent.context).toBeDefined();
      expect(agent.context.conversationHistory).toEqual([]);
      expect(agent.context.observations).toEqual([]);
      expect(agent.context.executedTools).toEqual([]);
      expect(agent.createdAt).toBeInstanceOf(Date);
      
      // Cleanup
      deleteAgent(agent.id);
    });

    it('should apply custom config', () => {
      const agent = createAgent('Test task', {
        maxIterations: 5,
        maxToolCalls: 10,
        verbose: false
      });
      
      expect(agent.config.maxIterations).toBe(5);
      expect(agent.config.maxToolCalls).toBe(10);
      expect(agent.config.verbose).toBe(false);
      
      // Cleanup
      deleteAgent(agent.id);
    });

    it('should use default config when not specified', () => {
      const agent = createAgent('Test task');
      
      expect(agent.config.maxIterations).toBe(15);
      expect(agent.config.maxToolCalls).toBe(20);
      expect(agent.config.verbose).toBe(true);
      
      // Cleanup
      deleteAgent(agent.id);
    });
  });

  describe('getAgent', () => {
    it('should retrieve an existing agent', () => {
      const agent = getAgent(testAgentId);
      
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(testAgentId);
    });

    it('should return undefined for non-existent agent', () => {
      const agent = getAgent('non-existent-id');
      
      expect(agent).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should return all active agents', () => {
      const agents = listAgents();
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      
      const testAgent = agents.find(a => a.id === testAgentId);
      expect(testAgent).toBeDefined();
    });
  });

  describe('deleteAgent', () => {
    it('should delete an existing agent', () => {
      const newAgent = createAgent('Agent to delete');
      const agentId = newAgent.id;
      
      expect(getAgent(agentId)).toBeDefined();
      
      const result = deleteAgent(agentId);
      
      expect(result).toBe(true);
      expect(getAgent(agentId)).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      const result = deleteAgent('non-existent-id');
      
      expect(result).toBe(false);
    });
  });

  describe('cancelAgent', () => {
    it('should cancel a running agent', () => {
      const agent = createAgent('Task to cancel');
      // Simuler un agent en cours d'exécution
      const agentState = getAgent(agent.id);
      if (agentState) {
        (agentState as any).status = 'executing';
      }
      
      const result = cancelAgent(agent.id);
      
      expect(result).toBe(true);
      
      const cancelledAgent = getAgent(agent.id);
      expect(cancelledAgent?.status).toBe('failed');
      expect(cancelledAgent?.error).toContain('Annulé');
      
      // Cleanup
      deleteAgent(agent.id);
    });

    it('should return false for already completed agent', () => {
      const agent = createAgent('Completed task');
      const agentState = getAgent(agent.id);
      if (agentState) {
        (agentState as any).status = 'completed';
      }
      
      const result = cancelAgent(agent.id);
      
      expect(result).toBe(false);
      
      // Cleanup
      deleteAgent(agent.id);
    });
  });

  describe('Agent context', () => {
    it('should have empty initial context', () => {
      const agent = getAgent(testAgentId);
      
      expect(agent?.context.conversationHistory).toEqual([]);
      expect(agent?.context.observations).toEqual([]);
      expect(agent?.context.executedTools).toEqual([]);
      expect(agent?.context.workingMemory).toEqual({});
      expect(agent?.context.artifacts).toEqual([]);
    });
  });

  describe('Agent ID generation', () => {
    it('should generate unique IDs', () => {
      const agent1 = createAgent('Task 1');
      const agent2 = createAgent('Task 2');
      
      expect(agent1.id).not.toBe(agent2.id);
      expect(agent1.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
      expect(agent2.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
      
      // Cleanup
      deleteAgent(agent1.id);
      deleteAgent(agent2.id);
    });
  });
});
