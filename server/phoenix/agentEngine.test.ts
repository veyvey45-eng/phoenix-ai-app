/**
 * Tests pour le système d'agent autonome
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createAgentTask, 
  getAgentTask, 
  listAgentTasks, 
  cancelAgentTask,
  deleteAgentTask
} from './agentEngine';

describe('Agent Engine', () => {
  beforeEach(() => {
    // Nettoyer les tâches entre les tests
    const tasks = listAgentTasks();
    tasks.forEach(task => deleteAgentTask(task.id));
  });

  describe('createAgentTask', () => {
    it('should create a new task with pending status', async () => {
      const task = await createAgentTask('Test goal', 'user-123');
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.goal).toBe('Test goal');
      expect(task.status).toBe('pending');
      expect(task.steps).toEqual([]);
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique task IDs', async () => {
      const task1 = await createAgentTask('Goal 1', 'user-123');
      const task2 = await createAgentTask('Goal 2', 'user-123');
      
      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('getAgentTask', () => {
    it('should retrieve an existing task', async () => {
      const created = await createAgentTask('Test goal', 'user-123');
      const retrieved = getAgentTask(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.goal).toBe('Test goal');
    });

    it('should return undefined for non-existent task', () => {
      const task = getAgentTask('non-existent-id');
      expect(task).toBeUndefined();
    });
  });

  describe('listAgentTasks', () => {
    it('should return empty array when no tasks exist', () => {
      const tasks = listAgentTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all created tasks', async () => {
      await createAgentTask('Goal 1', 'user-123');
      await createAgentTask('Goal 2', 'user-123');
      await createAgentTask('Goal 3', 'user-123');
      
      const tasks = listAgentTasks();
      expect(tasks).toHaveLength(3);
    });
  });

  describe('cancelAgentTask', () => {
    it('should cancel an existing task', async () => {
      const task = await createAgentTask('Test goal', 'user-123');
      const result = cancelAgentTask(task.id);
      
      expect(result).toBe(true);
      
      const cancelled = getAgentTask(task.id);
      expect(cancelled?.status).toBe('failed');
    });

    it('should return false for non-existent task', () => {
      const result = cancelAgentTask('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteAgentTask', () => {
    it('should delete an existing task', async () => {
      const task = await createAgentTask('Test goal', 'user-123');
      const result = deleteAgentTask(task.id);
      
      expect(result).toBe(true);
      expect(getAgentTask(task.id)).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const result = deleteAgentTask('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Task Context', () => {
    it('should initialize with empty context', async () => {
      const task = await createAgentTask('Test goal', 'user-123');
      
      expect(task.context).toBeDefined();
      expect(task.context.conversationHistory).toEqual([]);
      expect(task.context.executedActions).toEqual([]);
      expect(task.context.observations).toEqual([]);
    });
  });
});
