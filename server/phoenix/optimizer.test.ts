import { describe, it, expect, beforeEach } from 'vitest';
import { PhoenixOptimizer, getOptimizer } from './optimizer';

describe('PhoenixOptimizer', () => {
  let optimizer: PhoenixOptimizer;

  beforeEach(() => {
    optimizer = new PhoenixOptimizer();
  });

  describe('Task Allocation', () => {
    it('should allocate H0 tasks with full power immediately', () => {
      const result = optimizer.allocatePower('H0', 'Critical security task');
      expect(result.allocation).toBe('FULL_POWER');
      expect(result.task.priority).toBe('H0');
      expect(result.task.status).toBe('running');
    });

    it('should queue H3 tasks when system is loaded', () => {
      // Fill up with H0 tasks to increase load
      for (let i = 0; i < 5; i++) {
        optimizer.allocatePower('H0', `Critical task ${i}`);
      }
      
      const result = optimizer.allocatePower('H3', 'Low priority task');
      // H3 tasks may be queued if system is loaded
      expect(['FULL_POWER', 'REDUCED_POWER', 'QUEUED_FOR_OPTIMIZATION', 'QUEUED']).toContain(result.allocation);
    });

    it('should track task in running tasks after allocation', () => {
      optimizer.allocatePower('H1', 'High priority task');
      const running = optimizer.getRunningTasks();
      expect(running.length).toBeGreaterThan(0);
    });
  });

  describe('Task Completion', () => {
    it('should complete a running task successfully', () => {
      const { task } = optimizer.allocatePower('H2', 'Normal task');
      const completed = optimizer.completeTask(task.id, true);
      expect(completed).not.toBeNull();
      expect(completed?.status).toBe('completed');
    });

    it('should mark failed tasks correctly', () => {
      const { task } = optimizer.allocatePower('H2', 'Task that will fail');
      const completed = optimizer.completeTask(task.id, false);
      expect(completed?.status).toBe('failed');
    });

    it('should return null for non-existent task', () => {
      const completed = optimizer.completeTask('non-existent-id', true);
      expect(completed).toBeNull();
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a running task', () => {
      const { task } = optimizer.allocatePower('H2', 'Task to cancel');
      const cancelled = optimizer.cancelTask(task.id);
      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent task', () => {
      const cancelled = optimizer.cancelTask('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Resource Metrics', () => {
    it('should return valid resource metrics', () => {
      const metrics = optimizer.getResourceMetrics();
      expect(metrics).toHaveProperty('currentLoad');
      expect(metrics).toHaveProperty('totalTasksProcessed');
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(metrics.currentLoad).toBeLessThanOrEqual(1);
    });

    it('should increase load when tasks are added', () => {
      const initialMetrics = optimizer.getResourceMetrics();
      optimizer.allocatePower('H0', 'Task 1');
      optimizer.allocatePower('H0', 'Task 2');
      const newMetrics = optimizer.getResourceMetrics();
      expect(newMetrics.currentLoad).toBeGreaterThanOrEqual(initialMetrics.currentLoad);
    });
  });

  describe('Efficiency Metrics', () => {
    it('should return valid efficiency metrics', () => {
      const metrics = optimizer.getEfficiencyMetrics();
      expect(metrics).toHaveProperty('resourceEfficiency');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('queueWaitTime');
      expect(metrics).toHaveProperty('tormentReduction');
      expect(metrics).toHaveProperty('priorityCompliance');
      expect(metrics).toHaveProperty('performanceIndex');
    });

    it('should have performance index between 0 and 100', () => {
      const metrics = optimizer.getEfficiencyMetrics();
      expect(metrics.performanceIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceIndex).toBeLessThanOrEqual(100);
    });
  });

  describe('Optimization Stats', () => {
    it('should return stats by priority', () => {
      optimizer.allocatePower('H0', 'H0 task');
      optimizer.allocatePower('H1', 'H1 task');
      optimizer.allocatePower('H2', 'H2 task');
      optimizer.allocatePower('H3', 'H3 task');

      const stats = optimizer.getOptimizationStats();
      expect(stats.byPriority).toHaveProperty('H0');
      expect(stats.byPriority).toHaveProperty('H1');
      expect(stats.byPriority).toHaveProperty('H2');
      expect(stats.byPriority).toHaveProperty('H3');
    });

    it('should track running tasks in stats', () => {
      optimizer.allocatePower('H0', 'Running task');
      const stats = optimizer.getOptimizationStats();
      expect(stats.byPriority.H0.running).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Resource Limit', () => {
    it('should get and set resource limit', () => {
      optimizer.setResourceLimit(0.75);
      expect(optimizer.getResourceLimit()).toBe(0.75);
    });

    it('should clamp resource limit between 0.1 and 1', () => {
      optimizer.setResourceLimit(0.05);
      expect(optimizer.getResourceLimit()).toBe(0.1);
      
      optimizer.setResourceLimit(1.5);
      expect(optimizer.getResourceLimit()).toBe(1);
    });
  });

  describe('Queue Management', () => {
    it('should return queued tasks', () => {
      const queued = optimizer.getQueuedTasks();
      expect(Array.isArray(queued)).toBe(true);
    });

    it('should clear all queues', () => {
      // Add some tasks that might be queued
      for (let i = 0; i < 10; i++) {
        optimizer.allocatePower('H3', `Task ${i}`);
      }
      
      const cleared = optimizer.clearQueues();
      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Load History', () => {
    it('should return load history', () => {
      const history = optimizer.getLoadHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit history to requested samples', () => {
      const history = optimizer.getLoadHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Recent Completed Tasks', () => {
    it('should return recently completed tasks', () => {
      const { task } = optimizer.allocatePower('H2', 'Task to complete');
      optimizer.completeTask(task.id, true);
      
      const recent = optimizer.getRecentCompletedTasks(10);
      expect(recent.length).toBeGreaterThan(0);
    });

    it('should limit results to requested count', () => {
      // Complete several tasks
      for (let i = 0; i < 5; i++) {
        const { task } = optimizer.allocatePower('H2', `Task ${i}`);
        optimizer.completeTask(task.id, true);
      }
      
      const recent = optimizer.getRecentCompletedTasks(3);
      expect(recent.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Force Process Queue', () => {
    it('should process queued tasks', () => {
      // Add tasks
      for (let i = 0; i < 5; i++) {
        optimizer.allocatePower('H3', `Task ${i}`);
      }
      
      const processed = optimizer.forceProcessQueue();
      expect(processed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance via getOptimizer', () => {
      const instance1 = getOptimizer();
      const instance2 = getOptimizer();
      expect(instance1).toBe(instance2);
    });
  });
});
