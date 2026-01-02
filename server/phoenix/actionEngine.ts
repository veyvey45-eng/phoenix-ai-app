/**
 * Module 04: Action & Web-Surveillance - Project Phoenix
 * Exécution externe sécurisée et gestion des tâches web
 * 
 * Ce module permet à Phoenix d'exécuter des actions web de manière sécurisée,
 * avec validation par l'arbitrage et logging complet dans le journal d'audit.
 */

import { getArbitrator, ConflictOption, ArbitrationResult } from './arbitrage';

// Types
export type TaskStatus = 'pending' | 'validating' | 'executing' | 'completed' | 'blocked' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WebTask {
  id: string;
  description: string;
  taskType: 'search' | 'extract' | 'navigate' | 'interact' | 'monitor';
  targetUrl?: string;
  parameters: Record<string, unknown>;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
  arbitrationResult?: ArbitrationResult;
  userId: number;
  auditLogId?: number;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  filteredContent?: string[];
}

export interface SecurityFilter {
  name: string;
  pattern: RegExp;
  action: 'block' | 'redact' | 'warn';
  priority: 'H0' | 'H1' | 'H2' | 'H3';
}

export interface ActionEngineStats {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  averageExecutionTime: number;
  securityBlocksCount: number;
  byType: Record<string, number>;
  byStatus: Record<TaskStatus, number>;
}

// Sensitive patterns to filter from outgoing data
const SECURITY_FILTERS: SecurityFilter[] = [
  {
    name: 'API Keys',
    pattern: /(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token)[=:]\s*["']?[\w-]{20,}["']?/gi,
    action: 'block',
    priority: 'H0'
  },
  {
    name: 'Database Credentials',
    pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^@\s]+@[^\s]+/gi,
    action: 'block',
    priority: 'H0'
  },
  {
    name: 'Private Keys',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi,
    action: 'block',
    priority: 'H0'
  },
  {
    name: 'JWT Tokens',
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    action: 'redact',
    priority: 'H1'
  },
  {
    name: 'Email Addresses',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    action: 'warn',
    priority: 'H2'
  },
  {
    name: 'Phone Numbers',
    pattern: /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    action: 'warn',
    priority: 'H2'
  },
  {
    name: 'Internal Module Details',
    pattern: /(?:Module\s*0[1-9]|PhoenixOrchestrator|ArbitrageModule|TormentComputer)/gi,
    action: 'redact',
    priority: 'H1'
  }
];

// Trusted domains for web operations
const TRUSTED_DOMAINS = [
  '*.manus.computer',
  '*.manus.im',
  'localhost',
  '127.0.0.1'
];

class PhoenixActionEngine {
  private taskQueue: Map<string, WebTask> = new Map();
  private stats: ActionEngineStats = {
    totalTasks: 0,
    completedTasks: 0,
    blockedTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    averageExecutionTime: 0,
    securityBlocksCount: 0,
    byType: {},
    byStatus: {
      pending: 0,
      validating: 0,
      executing: 0,
      completed: 0,
      blocked: 0,
      failed: 0
    }
  };

  /**
   * Create a new web task
   */
  async createTask(params: {
    description: string;
    taskType: WebTask['taskType'];
    targetUrl?: string;
    parameters?: Record<string, unknown>;
    priority?: TaskPriority;
    userId: number;
  }): Promise<WebTask> {
    const taskId = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: WebTask = {
      id: taskId,
      description: params.description,
      taskType: params.taskType,
      targetUrl: params.targetUrl,
      parameters: params.parameters || {},
      status: 'pending',
      priority: params.priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: params.userId
    };

    this.taskQueue.set(taskId, task);
    this.stats.totalTasks++;
    this.stats.pendingTasks++;
    this.stats.byType[params.taskType] = (this.stats.byType[params.taskType] || 0) + 1;
    this.updateStatusCount('pending', 1);

    // Log task creation
    await this.logTaskAction(task, 'task_created', { description: params.description });

    return task;
  }

  /**
   * Execute a web task with security validation
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = this.taskQueue.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found', executionTime: 0 };
    }

    const startTime = Date.now();

    // Update status to validating
    this.updateTaskStatus(task, 'validating');

    // Step 1: Security filter check on task parameters
    const securityCheck = this.checkSecurityFilters(JSON.stringify(task.parameters));
    if (securityCheck.blocked) {
      this.updateTaskStatus(task, 'blocked');
      this.stats.blockedTasks++;
      this.stats.securityBlocksCount++;
      
      await this.logTaskAction(task, 'task_blocked', {
        reason: 'Security filter triggered',
        filters: securityCheck.triggeredFilters
      });

      return {
        success: false,
        error: `Security filter blocked: ${securityCheck.triggeredFilters.join(', ')}`,
        executionTime: Date.now() - startTime,
        filteredContent: securityCheck.triggeredFilters
      };
    }

    // Step 2: URL domain validation
    if (task.targetUrl) {
      const domainCheck = this.validateDomain(task.targetUrl);
      if (!domainCheck.trusted) {
        // Non-trusted domain requires arbitration
        const arbitrator = getArbitrator();
        const evaluation = arbitrator.evaluateAction(
          `Navigate to external domain: ${task.targetUrl}`,
          { userId: task.userId, taskType: task.taskType }
        );

        if (!evaluation.canProceed) {
          this.updateTaskStatus(task, 'blocked');
          this.stats.blockedTasks++;
          
          await this.logTaskAction(task, 'task_blocked', {
            reason: 'Untrusted domain with axiom violations',
            violations: evaluation.violations
          });

          return {
            success: false,
            error: `Domain not trusted and axiom violations detected`,
            executionTime: Date.now() - startTime
          };
        }
      }
    }

    // Step 3: Arbitration validation
    const arbitrator = getArbitrator();
    const conflictOption: ConflictOption = {
      id: taskId,
      description: task.description,
      action: `${task.taskType}: ${task.description}`,
      axiomViolations: [],
      riskScore: this.calculateTaskRisk(task),
      confidence: 0.8
    };

    // Evaluate against axioms
    const evaluation = arbitrator.evaluateAction(conflictOption.action, { userId: task.userId });
    conflictOption.axiomViolations = evaluation.violations;
    conflictOption.riskScore = evaluation.riskScore;

    if (!evaluation.canProceed) {
      // H0 violation - block immediately
      const arbitrationResult = await arbitrator.resolveConflict([conflictOption], task.userId);
      task.arbitrationResult = arbitrationResult;
      
      this.updateTaskStatus(task, 'blocked');
      this.stats.blockedTasks++;

      await this.logTaskAction(task, 'task_blocked', {
        reason: 'Arbitration blocked - H0 violation',
        arbitrationResult
      });

      return {
        success: false,
        error: arbitrationResult.blockedReason || 'Blocked by arbitration',
        executionTime: Date.now() - startTime
      };
    }

    // Step 4: Execute the task
    this.updateTaskStatus(task, 'executing');

    try {
      // Simulate task execution (in production, this would call actual web APIs)
      const result = await this.performTaskExecution(task);
      
      // Step 5: Filter outgoing data
      if (result.data) {
        const outputCheck = this.checkSecurityFilters(JSON.stringify(result.data));
        if (outputCheck.blocked) {
          this.updateTaskStatus(task, 'failed');
          this.stats.failedTasks++;

          await this.logTaskAction(task, 'task_failed', {
            reason: 'Output contained sensitive data',
            filters: outputCheck.triggeredFilters
          });

          return {
            success: false,
            error: 'Output blocked by security filter',
            executionTime: Date.now() - startTime,
            filteredContent: outputCheck.triggeredFilters
          };
        }

        // Redact if needed
        if (outputCheck.redacted) {
          result.data = outputCheck.redactedContent;
        }
      }

      // Success
      this.updateTaskStatus(task, 'completed');
      task.completedAt = new Date();
      task.result = result;
      this.stats.completedTasks++;

      // Update average execution time
      const executionTime = Date.now() - startTime;
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (this.stats.completedTasks - 1) + executionTime) / 
        this.stats.completedTasks;

      await this.logTaskAction(task, 'task_completed', {
        executionTime,
        success: true
      });

      return {
        success: true,
        data: result.data,
        executionTime
      };

    } catch (error) {
      this.updateTaskStatus(task, 'failed');
      this.stats.failedTasks++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.logTaskAction(task, 'task_failed', {
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform the actual task execution
   */
  private async performTaskExecution(task: WebTask): Promise<TaskResult> {
    // Simulate different task types
    switch (task.taskType) {
      case 'search':
        return {
          success: true,
          data: {
            query: task.parameters.query,
            results: [],
            timestamp: new Date().toISOString()
          },
          executionTime: 100
        };

      case 'extract':
        return {
          success: true,
          data: {
            url: task.targetUrl,
            content: 'Extracted content placeholder',
            timestamp: new Date().toISOString()
          },
          executionTime: 200
        };

      case 'navigate':
        return {
          success: true,
          data: {
            url: task.targetUrl,
            status: 'navigated',
            timestamp: new Date().toISOString()
          },
          executionTime: 150
        };

      case 'interact':
        return {
          success: true,
          data: {
            action: task.parameters.action,
            result: 'interaction completed',
            timestamp: new Date().toISOString()
          },
          executionTime: 300
        };

      case 'monitor':
        return {
          success: true,
          data: {
            target: task.parameters.target,
            status: 'monitoring active',
            timestamp: new Date().toISOString()
          },
          executionTime: 50
        };

      default:
        return {
          success: false,
          error: 'Unknown task type',
          executionTime: 0
        };
    }
  }

  /**
   * Check content against security filters
   */
  checkSecurityFilters(content: string): {
    blocked: boolean;
    redacted: boolean;
    triggeredFilters: string[];
    redactedContent?: string;
  } {
    const triggeredFilters: string[] = [];
    let blocked = false;
    let redacted = false;
    let processedContent = content;

    for (const filter of SECURITY_FILTERS) {
      if (filter.pattern.test(content)) {
        triggeredFilters.push(filter.name);

        switch (filter.action) {
          case 'block':
            blocked = true;
            break;
          case 'redact':
            redacted = true;
            processedContent = processedContent.replace(filter.pattern, '[REDACTED]');
            break;
          case 'warn':
            // Just log, don't block
            break;
        }
      }
      // Reset regex lastIndex
      filter.pattern.lastIndex = 0;
    }

    return {
      blocked,
      redacted,
      triggeredFilters,
      redactedContent: redacted ? processedContent : undefined
    };
  }

  /**
   * Validate if a domain is trusted
   */
  validateDomain(url: string): { trusted: boolean; domain: string } {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      for (const trustedPattern of TRUSTED_DOMAINS) {
        if (trustedPattern.startsWith('*.')) {
          const suffix = trustedPattern.slice(2);
          if (domain.endsWith(suffix)) {
            return { trusted: true, domain };
          }
        } else if (domain === trustedPattern) {
          return { trusted: true, domain };
        }
      }

      return { trusted: false, domain };
    } catch {
      return { trusted: false, domain: 'invalid' };
    }
  }

  /**
   * Calculate risk score for a task
   */
  private calculateTaskRisk(task: WebTask): number {
    let risk = 0.1; // Base risk

    // Task type risk
    const typeRisks: Record<string, number> = {
      search: 0.1,
      extract: 0.2,
      navigate: 0.3,
      interact: 0.5,
      monitor: 0.2
    };
    risk += typeRisks[task.taskType] || 0.3;

    // Priority risk
    const priorityRisks: Record<string, number> = {
      low: 0,
      medium: 0.1,
      high: 0.2,
      critical: 0.3
    };
    risk += priorityRisks[task.priority] || 0.1;

    // External URL risk
    if (task.targetUrl) {
      const domainCheck = this.validateDomain(task.targetUrl);
      if (!domainCheck.trusted) {
        risk += 0.3;
      }
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Update task status
   */
  private updateTaskStatus(task: WebTask, status: TaskStatus): void {
    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = new Date();

    // Update status counts
    this.updateStatusCount(oldStatus, -1);
    this.updateStatusCount(status, 1);
  }

  /**
   * Update status count in stats
   */
  private updateStatusCount(status: TaskStatus, delta: number): void {
    this.stats.byStatus[status] = Math.max(0, (this.stats.byStatus[status] || 0) + delta);
    
    if (status === 'pending') {
      this.stats.pendingTasks = Math.max(0, this.stats.pendingTasks + delta);
    }
  }

  /**
   * Log task action to audit
   */
  private async logTaskAction(
    task: WebTask,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const { logAdminAction } = await import('../db');
      
      await logAdminAction({
        adminId: task.userId,
        action: action as any,
        resourceType: 'web_task',
        resourceId: parseInt(task.id.split('-')[1]) || 0,
        changes: {
          taskId: task.id,
          taskType: task.taskType,
          status: task.status,
          ...details
        }
      });
    } catch (error) {
      console.warn('[ActionEngine] Failed to log task action:', error);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): WebTask | undefined {
    return this.taskQueue.get(taskId);
  }

  /**
   * Get all tasks for a user
   */
  getTasksByUser(userId: number): WebTask[] {
    return Array.from(this.taskQueue.values())
      .filter(task => task.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): WebTask[] {
    return Array.from(this.taskQueue.values())
      .filter(task => task.status === 'pending' || task.status === 'validating')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get statistics
   */
  getStats(): ActionEngineStats {
    return { ...this.stats };
  }

  /**
   * Get security filters
   */
  getSecurityFilters(): SecurityFilter[] {
    return [...SECURITY_FILTERS];
  }

  /**
   * Get trusted domains
   */
  getTrustedDomains(): string[] {
    return [...TRUSTED_DOMAINS];
  }

  /**
   * Cancel a pending task
   */
  async cancelTask(taskId: string, userId: number): Promise<boolean> {
    const task = this.taskQueue.get(taskId);
    if (!task || task.userId !== userId) {
      return false;
    }

    if (task.status !== 'pending' && task.status !== 'validating') {
      return false;
    }

    this.updateTaskStatus(task, 'failed');
    task.result = {
      success: false,
      error: 'Task cancelled by user',
      executionTime: 0
    };

    await this.logTaskAction(task, 'task_cancelled', { cancelledBy: userId });

    return true;
  }
}

// Singleton instance
let actionEngineInstance: PhoenixActionEngine | null = null;

export function getActionEngine(): PhoenixActionEngine {
  if (!actionEngineInstance) {
    actionEngineInstance = new PhoenixActionEngine();
  }
  return actionEngineInstance;
}

export { PhoenixActionEngine, SECURITY_FILTERS, TRUSTED_DOMAINS };
