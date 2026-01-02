/**
 * Module 08: Optimisation des Ressources - Project Phoenix
 * 
 * Gère l'allocation intelligente des ressources et la priorisation
 * des tâches pour maximiser l'efficacité du système.
 */

import { notifyOwner } from '../_core/notification';

// Types
export type PriorityLevel = 'H0' | 'H1' | 'H2' | 'H3';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type PowerAllocation = 'FULL_POWER' | 'HIGH_POWER' | 'NORMAL_POWER' | 'LOW_POWER' | 'QUEUED';

export interface QueuedTask {
  id: string;
  priority: PriorityLevel;
  description: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: TaskStatus;
  resourceUsage: number; // 0-1
  estimatedDuration: number; // seconds
  actualDuration?: number;
  metadata?: Record<string, unknown>;
}

export interface ResourceMetrics {
  currentLoad: number; // 0-1
  peakLoad: number;
  averageLoad: number;
  totalTasksProcessed: number;
  totalTasksQueued: number;
  totalTasksFailed: number;
  uptime: number; // seconds
  lastUpdated: Date;
}

export interface EfficiencyMetrics {
  performanceIndex: number; // 0-100
  throughput: number; // tasks per minute
  averageLatency: number; // seconds
  queueWaitTime: number; // average seconds in queue
  resourceEfficiency: number; // 0-1
  tormentReduction: number; // 0-1
  priorityCompliance: number; // 0-1
}

export interface OptimizationStats {
  byPriority: Record<PriorityLevel, {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    averageWaitTime: number;
  }>;
  resourceAllocation: {
    H0: number;
    H1: number;
    H2: number;
    H3: number;
  };
}

/**
 * Phoenix Resource Optimizer
 * Gère l'allocation des ressources et la priorisation des tâches
 */
export class PhoenixOptimizer {
  private resourceLimit: number = 0.85; // 85% max to avoid saturation
  private priorityQueues: Map<PriorityLevel, QueuedTask[]> = new Map([
    ['H0', []],
    ['H1', []],
    ['H2', []],
    ['H3', []]
  ]);
  private runningTasks: Map<string, QueuedTask> = new Map();
  private completedTasks: QueuedTask[] = [];
  private currentLoad: number = 0;
  private peakLoad: number = 0;
  private loadHistory: number[] = [];
  private startTime: Date = new Date();
  private taskCounter: number = 0;

  // Priority weights for resource allocation
  private priorityWeights: Record<PriorityLevel, number> = {
    'H0': 1.0,   // Full resources
    'H1': 0.75,  // 75% resources
    'H2': 0.5,   // 50% resources
    'H3': 0.25   // 25% resources
  };

  /**
   * Allocate resources for a task based on priority
   */
  allocatePower(
    priority: PriorityLevel,
    description: string,
    estimatedDuration: number = 30,
    metadata?: Record<string, unknown>
  ): { allocation: PowerAllocation; task: QueuedTask } {
    const taskId = `task_${Date.now()}_${++this.taskCounter}`;
    
    const task: QueuedTask = {
      id: taskId,
      priority,
      description,
      createdAt: new Date(),
      status: 'queued',
      resourceUsage: this.priorityWeights[priority],
      estimatedDuration,
      metadata
    };

    // H0 tasks get immediate execution
    if (priority === 'H0') {
      task.status = 'running';
      task.startedAt = new Date();
      this.runningTasks.set(taskId, task);
      this.updateLoad(task.resourceUsage);
      
      // Notify admin for H0 tasks
      notifyOwner({
        title: '⚡ Tâche Critique H0 Lancée',
        content: `Exécution immédiate: ${description}`
      }).catch(() => {});

      return { allocation: 'FULL_POWER', task };
    }

    // Check if we can run immediately based on current load
    const projectedLoad = this.currentLoad + task.resourceUsage;
    
    if (projectedLoad <= this.resourceLimit) {
      // Can run immediately
      task.status = 'running';
      task.startedAt = new Date();
      this.runningTasks.set(taskId, task);
      this.updateLoad(task.resourceUsage);

      const allocation = this.getAllocationLevel(priority);
      return { allocation, task };
    }

    // Queue the task
    const queue = this.priorityQueues.get(priority)!;
    queue.push(task);

    return { allocation: 'QUEUED', task };
  }

  /**
   * Complete a running task
   */
  completeTask(taskId: string, success: boolean = true): QueuedTask | null {
    const task = this.runningTasks.get(taskId);
    if (!task) return null;

    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date();
    task.actualDuration = task.startedAt 
      ? (task.completedAt.getTime() - task.startedAt.getTime()) / 1000 
      : 0;

    this.runningTasks.delete(taskId);
    this.updateLoad(-task.resourceUsage);
    this.completedTasks.push(task);

    // Keep only last 1000 completed tasks
    if (this.completedTasks.length > 1000) {
      this.completedTasks = this.completedTasks.slice(-500);
    }

    // Process next task from queue
    this.processNextFromQueue();

    return task;
  }

  /**
   * Cancel a task (queued or running)
   */
  cancelTask(taskId: string): boolean {
    // Check running tasks
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = 'cancelled';
      runningTask.completedAt = new Date();
      this.runningTasks.delete(taskId);
      this.updateLoad(-runningTask.resourceUsage);
      this.completedTasks.push(runningTask);
      this.processNextFromQueue();
      return true;
    }

    // Check queued tasks
    const entries = Array.from(this.priorityQueues.entries());
    for (let i = 0; i < entries.length; i++) {
      const [priority, queue] = entries[i];
      const index = queue.findIndex((t: QueuedTask) => t.id === taskId);
      if (index !== -1) {
        const task = queue.splice(index, 1)[0];
        task.status = 'cancelled';
        task.completedAt = new Date();
        this.completedTasks.push(task);
        return true;
      }
    }

    return false;
  }

  /**
   * Process next task from priority queue
   */
  private processNextFromQueue(): void {
    // Process in priority order: H0 -> H1 -> H2 -> H3
    const priorities: PriorityLevel[] = ['H0', 'H1', 'H2', 'H3'];

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority)!;
      if (queue.length === 0) continue;

      const task = queue[0];
      const projectedLoad = this.currentLoad + task.resourceUsage;

      if (projectedLoad <= this.resourceLimit) {
        queue.shift();
        task.status = 'running';
        task.startedAt = new Date();
        this.runningTasks.set(task.id, task);
        this.updateLoad(task.resourceUsage);
        return;
      }
    }
  }

  /**
   * Update current load and track history
   */
  private updateLoad(delta: number): void {
    this.currentLoad = Math.max(0, Math.min(1, this.currentLoad + delta));
    this.peakLoad = Math.max(this.peakLoad, this.currentLoad);
    this.loadHistory.push(this.currentLoad);

    // Keep only last 1000 load samples
    if (this.loadHistory.length > 1000) {
      this.loadHistory = this.loadHistory.slice(-500);
    }
  }

  /**
   * Get allocation level based on priority
   */
  private getAllocationLevel(priority: PriorityLevel): PowerAllocation {
    switch (priority) {
      case 'H0': return 'FULL_POWER';
      case 'H1': return 'HIGH_POWER';
      case 'H2': return 'NORMAL_POWER';
      case 'H3': return 'LOW_POWER';
    }
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    const averageLoad = this.loadHistory.length > 0
      ? this.loadHistory.reduce((a, b) => a + b, 0) / this.loadHistory.length
      : 0;

    let totalQueued = 0;
    this.priorityQueues.forEach(queue => {
      totalQueued += queue.length;
    });

    const totalFailed = this.completedTasks.filter(t => t.status === 'failed').length;

    return {
      currentLoad: this.currentLoad,
      peakLoad: this.peakLoad,
      averageLoad,
      totalTasksProcessed: this.completedTasks.length,
      totalTasksQueued: totalQueued,
      totalTasksFailed: totalFailed,
      uptime: (Date.now() - this.startTime.getTime()) / 1000,
      lastUpdated: new Date()
    };
  }

  /**
   * Get efficiency metrics
   */
  getEfficiencyMetrics(): EfficiencyMetrics {
    const completedCount = this.completedTasks.filter(t => t.status === 'completed').length;
    const uptimeMinutes = (Date.now() - this.startTime.getTime()) / 60000;
    const throughput = uptimeMinutes > 0 ? completedCount / uptimeMinutes : 0;

    // Calculate average latency
    const completedWithDuration = this.completedTasks.filter(t => t.actualDuration !== undefined);
    const averageLatency = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / completedWithDuration.length
      : 0;

    // Calculate queue wait time
    const tasksWithWait = this.completedTasks.filter(t => t.startedAt);
    const queueWaitTime = tasksWithWait.length > 0
      ? tasksWithWait.reduce((sum, t) => {
          const wait = t.startedAt ? (t.startedAt.getTime() - t.createdAt.getTime()) / 1000 : 0;
          return sum + wait;
        }, 0) / tasksWithWait.length
      : 0;

    // Resource efficiency (inverse of average load)
    const resourceEfficiency = 1 - (this.loadHistory.length > 0
      ? this.loadHistory.reduce((a, b) => a + b, 0) / this.loadHistory.length
      : 0);

    // Torment reduction (based on queue wait time and failed tasks)
    const failedRatio = this.completedTasks.length > 0
      ? this.completedTasks.filter(t => t.status === 'failed').length / this.completedTasks.length
      : 0;
    const tormentReduction = 1 - (failedRatio * 0.5 + (queueWaitTime / 60) * 0.5);

    // Priority compliance (H0 tasks should have minimal wait time)
    const h0Tasks = this.completedTasks.filter(t => t.priority === 'H0' && t.startedAt);
    const h0Compliance = h0Tasks.length > 0
      ? h0Tasks.filter(t => {
          const wait = t.startedAt ? (t.startedAt.getTime() - t.createdAt.getTime()) / 1000 : 0;
          return wait < 1; // H0 should start within 1 second
        }).length / h0Tasks.length
      : 1;

    // Performance index (0-100)
    const performanceIndex = Math.round(
      (throughput * 10 + resourceEfficiency * 30 + tormentReduction * 30 + h0Compliance * 30)
    );

    return {
      performanceIndex: Math.min(100, Math.max(0, performanceIndex)),
      throughput,
      averageLatency,
      queueWaitTime,
      resourceEfficiency,
      tormentReduction: Math.max(0, tormentReduction),
      priorityCompliance: h0Compliance
    };
  }

  /**
   * Get optimization statistics by priority
   */
  getOptimizationStats(): OptimizationStats {
    const stats: OptimizationStats = {
      byPriority: {
        'H0': { queued: 0, running: 0, completed: 0, failed: 0, averageWaitTime: 0 },
        'H1': { queued: 0, running: 0, completed: 0, failed: 0, averageWaitTime: 0 },
        'H2': { queued: 0, running: 0, completed: 0, failed: 0, averageWaitTime: 0 },
        'H3': { queued: 0, running: 0, completed: 0, failed: 0, averageWaitTime: 0 }
      },
      resourceAllocation: {
        'H0': 0,
        'H1': 0,
        'H2': 0,
        'H3': 0
      }
    };

    // Count queued tasks
    Array.from(this.priorityQueues.entries()).forEach(([priority, queue]) => {
      stats.byPriority[priority].queued = queue.length;
    });

    // Count running tasks
    this.runningTasks.forEach(task => {
      stats.byPriority[task.priority].running++;
      stats.resourceAllocation[task.priority] += task.resourceUsage;
    });

    // Count completed/failed tasks and calculate wait times
    const waitTimesByPriority: Record<PriorityLevel, number[]> = {
      'H0': [], 'H1': [], 'H2': [], 'H3': []
    };

    this.completedTasks.forEach((task: QueuedTask) => {
      if (task.status === 'completed') {
        stats.byPriority[task.priority].completed++;
      } else if (task.status === 'failed') {
        stats.byPriority[task.priority].failed++;
      }

      if (task.startedAt) {
        const waitTime = (task.startedAt.getTime() - task.createdAt.getTime()) / 1000;
        waitTimesByPriority[task.priority].push(waitTime);
      }
    });

    // Calculate average wait times
    for (const priority of ['H0', 'H1', 'H2', 'H3'] as PriorityLevel[]) {
      const waitTimes = waitTimesByPriority[priority];
      stats.byPriority[priority].averageWaitTime = waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;
    }

    return stats;
  }

  /**
   * Get all queued tasks
   */
  getQueuedTasks(): QueuedTask[] {
    const tasks: QueuedTask[] = [];
    this.priorityQueues.forEach((queue, priority) => {
      tasks.push(...queue);
    });
    return tasks.sort((a, b) => {
      const priorityOrder = { H0: 0, H1: 1, H2: 2, H3: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): QueuedTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get recent completed tasks
   */
  getRecentCompletedTasks(limit: number = 50): QueuedTask[] {
    return this.completedTasks.slice(-limit).reverse();
  }

  /**
   * Set resource limit
   */
  setResourceLimit(limit: number): void {
    this.resourceLimit = Math.max(0.1, Math.min(1, limit));
  }

  /**
   * Get current resource limit
   */
  getResourceLimit(): number {
    return this.resourceLimit;
  }

  /**
   * Force process queue (admin action)
   */
  forceProcessQueue(): number {
    let processed = 0;
    while (this.currentLoad < this.resourceLimit) {
      const beforeLoad = this.currentLoad;
      this.processNextFromQueue();
      if (this.currentLoad === beforeLoad) break; // No more tasks to process
      processed++;
    }
    return processed;
  }

  /**
   * Clear all queues (admin action)
   */
  clearQueues(): number {
    let cleared = 0;
    this.priorityQueues.forEach((queue, priority) => {
      cleared += queue.length;
      queue.forEach(task => {
        task.status = 'cancelled';
        task.completedAt = new Date();
        this.completedTasks.push(task);
      });
      queue.length = 0;
    });
    return cleared;
  }

  /**
   * Get load history for charts
   */
  getLoadHistory(samples: number = 100): number[] {
    return this.loadHistory.slice(-samples);
  }
}

// Singleton instance
let optimizerInstance: PhoenixOptimizer | null = null;

export function getOptimizer(): PhoenixOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new PhoenixOptimizer();
  }
  return optimizerInstance;
}

export function resetOptimizer(): void {
  optimizerInstance = null;
}
