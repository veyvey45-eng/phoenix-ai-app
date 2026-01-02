import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PhoenixActionEngine, 
  getActionEngine,
  SECURITY_FILTERS,
  TRUSTED_DOMAINS
} from './actionEngine';

// Mock the db module
vi.mock('../db', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined)
}));

// Mock the arbitrage module
vi.mock('./arbitrage', () => ({
  getArbitrator: () => ({
    evaluateAction: vi.fn().mockReturnValue({
      violations: [],
      canProceed: true,
      riskScore: 0.1
    }),
    resolveConflict: vi.fn().mockResolvedValue({
      status: 'approved',
      selectedOption: { id: 'test' },
      requiresAdminApproval: false,
      conflictId: 'ARB-123'
    })
  })
}));

describe('PhoenixActionEngine', () => {
  let engine: PhoenixActionEngine;

  beforeEach(() => {
    engine = new PhoenixActionEngine();
  });

  describe('getActionEngine', () => {
    it('should return a singleton instance', () => {
      const instance1 = getActionEngine();
      const instance2 = getActionEngine();
      expect(instance1).toBe(instance2);
    });
  });

  describe('SECURITY_FILTERS', () => {
    it('should have security filters defined', () => {
      expect(SECURITY_FILTERS.length).toBeGreaterThan(0);
    });

    it('should have API key filter', () => {
      const apiKeyFilter = SECURITY_FILTERS.find(f => f.name === 'API Keys');
      expect(apiKeyFilter).toBeDefined();
      expect(apiKeyFilter?.action).toBe('block');
      expect(apiKeyFilter?.priority).toBe('H0');
    });
  });

  describe('TRUSTED_DOMAINS', () => {
    it('should have trusted domains defined', () => {
      expect(TRUSTED_DOMAINS.length).toBeGreaterThan(0);
    });

    it('should include manus domains', () => {
      expect(TRUSTED_DOMAINS.some(d => d.includes('manus'))).toBe(true);
    });
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const task = await engine.createTask({
        description: 'Test task',
        taskType: 'search',
        userId: 1
      });

      expect(task.id).toBeDefined();
      expect(task.description).toBe('Test task');
      expect(task.taskType).toBe('search');
      expect(task.status).toBe('pending');
    });

    it('should set default priority to medium', async () => {
      const task = await engine.createTask({
        description: 'Test task',
        taskType: 'search',
        userId: 1
      });

      expect(task.priority).toBe('medium');
    });

    it('should accept custom priority', async () => {
      const task = await engine.createTask({
        description: 'Critical task',
        taskType: 'interact',
        priority: 'critical',
        userId: 1
      });

      expect(task.priority).toBe('critical');
    });
  });

  describe('checkSecurityFilters', () => {
    it('should pass safe content', () => {
      const result = engine.checkSecurityFilters('This is safe content');
      
      expect(result.blocked).toBe(false);
      expect(result.redacted).toBe(false);
      expect(result.triggeredFilters.length).toBe(0);
    });

    it('should block content with API keys', () => {
      const result = engine.checkSecurityFilters('api_key=sk_live_abcdefghijklmnopqrstuvwxyz');
      
      expect(result.blocked).toBe(true);
      expect(result.triggeredFilters).toContain('API Keys');
    });

    it('should block content with database URLs', () => {
      const result = engine.checkSecurityFilters('mysql://user:password@localhost:3306/db');
      
      expect(result.blocked).toBe(true);
      expect(result.triggeredFilters).toContain('Database Credentials');
    });

    it('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = engine.checkSecurityFilters(`Token: ${jwt}`);
      
      expect(result.redacted).toBe(true);
      expect(result.triggeredFilters).toContain('JWT Tokens');
    });

    it('should warn about email addresses', () => {
      const result = engine.checkSecurityFilters('Contact: test@example.com');
      
      expect(result.blocked).toBe(false);
      expect(result.triggeredFilters).toContain('Email Addresses');
    });
  });

  describe('validateDomain', () => {
    it('should trust localhost', () => {
      const result = engine.validateDomain('http://localhost:3000');
      
      expect(result.trusted).toBe(true);
      expect(result.domain).toBe('localhost');
    });

    it('should trust manus.computer domains', () => {
      const result = engine.validateDomain('https://app.manus.computer');
      
      expect(result.trusted).toBe(true);
    });

    it('should not trust external domains', () => {
      const result = engine.validateDomain('https://evil.com');
      
      expect(result.trusted).toBe(false);
      expect(result.domain).toBe('evil.com');
    });

    it('should handle invalid URLs', () => {
      const result = engine.validateDomain('not-a-url');
      
      expect(result.trusted).toBe(false);
      expect(result.domain).toBe('invalid');
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const created = await engine.createTask({
        description: 'Test',
        taskType: 'search',
        userId: 1
      });

      const retrieved = engine.getTask(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent task', () => {
      const result = engine.getTask('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getTasksByUser', () => {
    it('should return tasks for specific user', async () => {
      await engine.createTask({ description: 'User 1 task', taskType: 'search', userId: 1 });
      await engine.createTask({ description: 'User 2 task', taskType: 'search', userId: 2 });
      await engine.createTask({ description: 'User 1 task 2', taskType: 'extract', userId: 1 });

      const user1Tasks = engine.getTasksByUser(1);
      expect(user1Tasks.length).toBe(2);
      expect(user1Tasks.every(t => t.userId === 1)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats object with expected properties', () => {
      const stats = engine.getStats();
      
      expect(stats).toHaveProperty('totalTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('blockedTasks');
      expect(stats).toHaveProperty('pendingTasks');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('byStatus');
    });

    it('should increment stats after task creation', async () => {
      const statsBefore = engine.getStats();
      const totalBefore = statsBefore.totalTasks;
      
      await engine.createTask({ description: 'Stats test', taskType: 'monitor', userId: 999 });
      
      const statsAfter = engine.getStats();
      expect(statsAfter.totalTasks).toBeGreaterThan(totalBefore);
    });
  });

  describe('cancelTask', () => {
    it('should cancel pending task', async () => {
      const task = await engine.createTask({
        description: 'Test',
        taskType: 'search',
        userId: 1
      });

      const result = await engine.cancelTask(task.id, 1);
      expect(result).toBe(true);

      const cancelled = engine.getTask(task.id);
      expect(cancelled?.status).toBe('failed');
    });

    it('should not cancel task for different user', async () => {
      const task = await engine.createTask({
        description: 'Test',
        taskType: 'search',
        userId: 1
      });

      const result = await engine.cancelTask(task.id, 2);
      expect(result).toBe(false);
    });
  });

  describe('getSecurityFilters', () => {
    it('should return all security filters', () => {
      const filters = engine.getSecurityFilters();
      expect(filters.length).toBeGreaterThan(0);
    });
  });

  describe('getTrustedDomains', () => {
    it('should return all trusted domains', () => {
      const domains = engine.getTrustedDomains();
      expect(domains.length).toBeGreaterThan(0);
    });
  });
});
