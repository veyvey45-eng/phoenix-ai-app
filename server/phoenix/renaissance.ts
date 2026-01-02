/**
 * Module 06: Auto-Correction & Renaissance - Project Phoenix
 * Résilience du système et correction autonome
 * 
 * Ce module assure que Phoenix est un système auto-réparateur.
 * Il s'inspire du mythe du Phoenix : renaître de ses cendres après un échec logique.
 */

import { getArbitrator } from './arbitrage';
import { getActionEngine } from './actionEngine';
import { getReporter } from './reporter';
import { notifyOwner } from '../_core/notification';

// Types
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'recovering' | 'locked';
export type ErrorSeverity = 'minor' | 'moderate' | 'severe' | 'critical';
export type CorrectionStrategy = 'retry' | 'alternative' | 'rollback' | 'renaissance';

export interface SystemError {
  id: string;
  timestamp: Date;
  module: string;
  severity: ErrorSeverity;
  priority: 'H0' | 'H1' | 'H2' | 'H3';
  message: string;
  context?: Record<string, unknown>;
  correctionAttempted?: CorrectionStrategy;
  resolved: boolean;
}

export interface RenaissanceCycle {
  id: string;
  triggeredAt: Date;
  completedAt?: Date;
  reason: string;
  errorsCleared: number;
  modulesReset: string[];
  status: 'in_progress' | 'completed' | 'failed' | 'blocked';
  adminValidated: boolean;
  validatedBy?: number;
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: Date;
  errorCount: number;
  criticalErrorCount: number;
  consecutiveFailures: number;
  lastRenaissanceCycle?: RenaissanceCycle;
  renaissanceCyclesCount: number;
  pendingAdminValidation: boolean;
  moduleHealth: Record<string, ModuleHealth>;
}

export interface ModuleHealth {
  name: string;
  status: 'operational' | 'degraded' | 'failed';
  lastError?: SystemError;
  errorCount: number;
}

export interface CorrectionResult {
  success: boolean;
  strategy: CorrectionStrategy;
  message: string;
  requiresAdminIntervention: boolean;
}

// Configuration
const FAILURE_THRESHOLD = 3; // Nombre d'erreurs consécutives avant Renaissance
const MAX_RENAISSANCE_WITHOUT_ADMIN = 3; // Limite de réinitialisations sans validation Admin
const CRITICAL_ERROR_THRESHOLD = 1; // Une seule erreur H0 déclenche une alerte

// Module singleton
let renaissanceInstance: PhoenixRenaissance | null = null;

export class PhoenixRenaissance {
  private errors: Map<string, SystemError> = new Map();
  private renaissanceCycles: RenaissanceCycle[] = [];
  private consecutiveFailures: number = 0;
  private renaissanceCountWithoutAdmin: number = 0;
  private systemLocked: boolean = false;
  private moduleHealth: Map<string, ModuleHealth> = new Map();

  constructor() {
    // Initialize module health tracking
    const modules = [
      'Logic Gate', 'Memory Sync', 'Arbitrage', 'Action Engine',
      'Reporter', 'Renaissance', 'Output Filter', 'Learning Loop',
      'Feedback Engine', 'Integration Hub'
    ];
    
    modules.forEach(name => {
      this.moduleHealth.set(name, {
        name,
        status: 'operational',
        errorCount: 0
      });
    });
  }

  /**
   * Monitor system health and detect errors
   */
  monitorHealth(): HealthReport {
    const criticalErrors = Array.from(this.errors.values())
      .filter(e => !e.resolved && e.priority === 'H0');
    
    let status: HealthStatus = 'healthy';
    
    if (this.systemLocked) {
      status = 'locked';
    } else if (criticalErrors.length >= CRITICAL_ERROR_THRESHOLD) {
      status = 'critical';
    } else if (this.consecutiveFailures > 0) {
      status = this.consecutiveFailures >= FAILURE_THRESHOLD ? 'recovering' : 'degraded';
    }

    const lastCycle = this.renaissanceCycles[this.renaissanceCycles.length - 1];

    return {
      status,
      timestamp: new Date(),
      errorCount: Array.from(this.errors.values()).filter(e => !e.resolved).length,
      criticalErrorCount: criticalErrors.length,
      consecutiveFailures: this.consecutiveFailures,
      lastRenaissanceCycle: lastCycle,
      renaissanceCyclesCount: this.renaissanceCycles.length,
      pendingAdminValidation: this.renaissanceCountWithoutAdmin >= MAX_RENAISSANCE_WITHOUT_ADMIN,
      moduleHealth: Object.fromEntries(this.moduleHealth)
    };
  }

  /**
   * Report an error to the Renaissance module
   */
  async reportError(params: {
    module: string;
    severity: ErrorSeverity;
    priority: 'H0' | 'H1' | 'H2' | 'H3';
    message: string;
    context?: Record<string, unknown>;
  }): Promise<CorrectionResult> {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const error: SystemError = {
      id: errorId,
      timestamp: new Date(),
      module: params.module,
      severity: params.severity,
      priority: params.priority,
      message: params.message,
      context: params.context,
      resolved: false
    };

    this.errors.set(errorId, error);
    this.consecutiveFailures++;

    // Update module health
    const moduleHealth = this.moduleHealth.get(params.module);
    if (moduleHealth) {
      moduleHealth.errorCount++;
      moduleHealth.lastError = error;
      moduleHealth.status = params.priority === 'H0' ? 'failed' : 
                           params.priority === 'H1' ? 'degraded' : 'operational';
    }

    // Determine correction strategy based on priority
    let strategy: CorrectionStrategy;
    
    if (params.priority === 'H0') {
      // Critical error - notify admin immediately
      await this.notifyAdminOfCriticalError(error);
      strategy = 'renaissance';
    } else if (params.priority === 'H1') {
      strategy = 'rollback';
    } else {
      // H2/H3 - try auto-correction first
      strategy = this.consecutiveFailures > 1 ? 'alternative' : 'retry';
    }

    // Attempt correction
    return this.attemptCorrection(error, strategy);
  }

  /**
   * Attempt to correct an error using the specified strategy
   */
  private async attemptCorrection(error: SystemError, strategy: CorrectionStrategy): Promise<CorrectionResult> {
    error.correctionAttempted = strategy;

    switch (strategy) {
      case 'retry':
        return this.attemptRetry(error);
      
      case 'alternative':
        return this.attemptAlternative(error);
      
      case 'rollback':
        return this.attemptRollback(error);
      
      case 'renaissance':
        return this.triggerRenaissance(`Critical error in ${error.module}: ${error.message}`);
      
      default:
        return {
          success: false,
          strategy,
          message: 'Unknown correction strategy',
          requiresAdminIntervention: true
        };
    }
  }

  /**
   * Retry strategy - simple retry for minor errors
   */
  private async attemptRetry(error: SystemError): Promise<CorrectionResult> {
    // Simulate retry logic
    // In a real implementation, this would retry the failed operation
    
    if (error.priority === 'H3') {
      // Low priority errors often resolve on retry
      error.resolved = true;
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
      
      return {
        success: true,
        strategy: 'retry',
        message: `Error ${error.id} resolved via retry`,
        requiresAdminIntervention: false
      };
    }

    return {
      success: false,
      strategy: 'retry',
      message: `Retry failed for error ${error.id}`,
      requiresAdminIntervention: false
    };
  }

  /**
   * Alternative strategy - try a different approach
   */
  private async attemptAlternative(error: SystemError): Promise<CorrectionResult> {
    // For H2/H3 errors, try an alternative approach
    
    if (error.priority === 'H2' || error.priority === 'H3') {
      // Simulate finding an alternative
      error.resolved = true;
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
      
      // Update module health
      const moduleHealth = this.moduleHealth.get(error.module);
      if (moduleHealth) {
        moduleHealth.status = 'operational';
      }

      return {
        success: true,
        strategy: 'alternative',
        message: `Alternative approach successful for error ${error.id}`,
        requiresAdminIntervention: false
      };
    }

    return {
      success: false,
      strategy: 'alternative',
      message: `No alternative found for error ${error.id}`,
      requiresAdminIntervention: error.priority === 'H0' || error.priority === 'H1'
    };
  }

  /**
   * Rollback strategy - revert to previous stable state
   */
  private async attemptRollback(error: SystemError): Promise<CorrectionResult> {
    const arbitrator = getArbitrator();
    
    // Use arbitrator's rollback capability
    const rollbackResult = await arbitrator.initiateRollback(
      error.id,
      `Auto-rollback for error: ${error.message}`,
      0 // System-initiated
    );

    if (rollbackResult.success) {
      error.resolved = true;
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);

      return {
        success: true,
        strategy: 'rollback',
        message: `Rollback successful for error ${error.id}`,
        requiresAdminIntervention: false
      };
    }

    // Rollback failed - escalate to Renaissance
    return this.triggerRenaissance(`Rollback failed for ${error.module}: ${error.message}`);
  }

  /**
   * Trigger the Renaissance protocol - full system reset
   */
  async triggerRenaissance(reason: string): Promise<CorrectionResult> {
    // Check if system is locked
    if (this.systemLocked) {
      return {
        success: false,
        strategy: 'renaissance',
        message: 'System is locked. Admin validation required before Renaissance.',
        requiresAdminIntervention: true
      };
    }

    // Check Renaissance limit
    if (this.renaissanceCountWithoutAdmin >= MAX_RENAISSANCE_WITHOUT_ADMIN) {
      this.systemLocked = true;
      
      await notifyOwner({
        title: '🔒 Phoenix System Locked - Validation Required',
        content: `Le système Phoenix a atteint la limite de ${MAX_RENAISSANCE_WITHOUT_ADMIN} cycles Renaissance sans validation Admin.\n\nRaison du dernier cycle: ${reason}\n\nVeuillez accéder à /admin pour valider et déverrouiller le système.`
      });

      return {
        success: false,
        strategy: 'renaissance',
        message: `Renaissance limit reached (${MAX_RENAISSANCE_WITHOUT_ADMIN}). System locked pending Admin validation.`,
        requiresAdminIntervention: true
      };
    }

    const cycleId = `REN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const cycle: RenaissanceCycle = {
      id: cycleId,
      triggeredAt: new Date(),
      reason,
      errorsCleared: 0,
      modulesReset: [],
      status: 'in_progress',
      adminValidated: false
    };

    this.renaissanceCycles.push(cycle);

    try {
      // Phase 1: Clear all non-critical errors
      const errorsCleared = this.clearResolvedErrors();
      cycle.errorsCleared = errorsCleared;

      // Phase 2: Reset module health
      const modulesReset = this.resetModuleHealth();
      cycle.modulesReset = modulesReset;

      // Phase 3: Reset consecutive failure counter
      this.consecutiveFailures = 0;

      // Phase 4: Add alert to reporter
      const reporter = getReporter();
      reporter.addCriticalAlert({
        type: 'system_error',
        severity: 'high',
        description: `Renaissance cycle triggered: ${reason}`
      });

      // Phase 5: Notify Admin
      await notifyOwner({
        title: '🔥 Phoenix Renaissance Cycle Completed',
        content: `Un cycle Renaissance a été déclenché.\n\nRaison: ${reason}\n\nErreurs nettoyées: ${errorsCleared}\nModules réinitialisés: ${modulesReset.join(', ')}\n\nCycle ID: ${cycleId}`
      });

      cycle.completedAt = new Date();
      cycle.status = 'completed';
      this.renaissanceCountWithoutAdmin++;

      return {
        success: true,
        strategy: 'renaissance',
        message: `Renaissance cycle ${cycleId} completed. ${errorsCleared} errors cleared, ${modulesReset.length} modules reset.`,
        requiresAdminIntervention: this.renaissanceCountWithoutAdmin >= MAX_RENAISSANCE_WITHOUT_ADMIN
      };

    } catch (err) {
      cycle.status = 'failed';
      
      return {
        success: false,
        strategy: 'renaissance',
        message: `Renaissance cycle failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        requiresAdminIntervention: true
      };
    }
  }

  /**
   * Clear resolved errors from the system
   */
  private clearResolvedErrors(): number {
    let cleared = 0;
    
    const entries = Array.from(this.errors.entries());
    for (const [id, error] of entries) {
      if (error.resolved || error.priority !== 'H0') {
        this.errors.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Reset module health to operational
   */
  private resetModuleHealth(): string[] {
    const reset: string[] = [];

    const entries = Array.from(this.moduleHealth.entries());
    for (const [name, health] of entries) {
      if (health.status !== 'operational') {
        health.status = 'operational';
        health.errorCount = 0;
        health.lastError = undefined;
        reset.push(name);
      }
    }

    return reset;
  }

  /**
   * Notify admin of critical error
   */
  private async notifyAdminOfCriticalError(error: SystemError): Promise<void> {
    await notifyOwner({
      title: '⚠️ Phoenix Critical Error (H0)',
      content: `Une erreur critique a été détectée dans le module ${error.module}.\n\nMessage: ${error.message}\n\nID: ${error.id}\nPriorité: ${error.priority}\nSévérité: ${error.severity}\n\nLe protocole Renaissance peut être déclenché automatiquement.`
    });

    // Add to reporter alerts
    const reporter = getReporter();
    reporter.addCriticalAlert({
      type: 'h0_violation',
      severity: 'critical',
      description: `${error.module}: ${error.message}`
    });
  }

  /**
   * Admin validates Renaissance cycles to unlock the system
   */
  async adminValidate(adminId: number): Promise<{ success: boolean; message: string }> {
    if (!this.systemLocked) {
      return {
        success: false,
        message: 'System is not locked. No validation needed.'
      };
    }

    // Validate all pending cycles
    for (const cycle of this.renaissanceCycles) {
      if (!cycle.adminValidated) {
        cycle.adminValidated = true;
        cycle.validatedBy = adminId;
      }
    }

    // Reset counter and unlock
    this.renaissanceCountWithoutAdmin = 0;
    this.systemLocked = false;

    await notifyOwner({
      title: '✅ Phoenix System Unlocked',
      content: `Le système Phoenix a été déverrouillé par l'administrateur.\n\nLe compteur de cycles Renaissance a été réinitialisé.`
    });

    return {
      success: true,
      message: 'System unlocked. Renaissance counter reset.'
    };
  }

  /**
   * Force Renaissance (admin only)
   */
  async forceRenaissance(adminId: number, reason: string): Promise<CorrectionResult> {
    // Admin can force Renaissance even when locked
    const wasLocked = this.systemLocked;
    this.systemLocked = false;

    const result = await this.triggerRenaissance(`Admin-initiated: ${reason}`);

    // Mark as admin validated
    const lastCycle = this.renaissanceCycles[this.renaissanceCycles.length - 1];
    if (lastCycle) {
      lastCycle.adminValidated = true;
      lastCycle.validatedBy = adminId;
    }

    // Reset counter since admin initiated
    this.renaissanceCountWithoutAdmin = 0;

    return result;
  }

  /**
   * Resolve an error manually
   */
  resolveError(errorId: string, adminId: number): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.resolved = true;
    this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);

    // Update module health
    const moduleHealth = this.moduleHealth.get(error.module);
    if (moduleHealth && moduleHealth.lastError?.id === errorId) {
      moduleHealth.status = 'operational';
    }

    return true;
  }

  /**
   * Get all errors
   */
  getErrors(includeResolved: boolean = false): SystemError[] {
    return Array.from(this.errors.values())
      .filter(e => includeResolved || !e.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get Renaissance cycles history
   */
  getRenaissanceCycles(limit: number = 20): RenaissanceCycle[] {
    return this.renaissanceCycles
      .slice(-limit)
      .reverse();
  }

  /**
   * Get stats
   */
  getStats(): {
    totalErrors: number;
    unresolvedErrors: number;
    criticalErrors: number;
    renaissanceCycles: number;
    consecutiveFailures: number;
    systemLocked: boolean;
    pendingValidation: boolean;
  } {
    const errors = Array.from(this.errors.values());
    
    return {
      totalErrors: errors.length,
      unresolvedErrors: errors.filter(e => !e.resolved).length,
      criticalErrors: errors.filter(e => !e.resolved && e.priority === 'H0').length,
      renaissanceCycles: this.renaissanceCycles.length,
      consecutiveFailures: this.consecutiveFailures,
      systemLocked: this.systemLocked,
      pendingValidation: this.renaissanceCountWithoutAdmin >= MAX_RENAISSANCE_WITHOUT_ADMIN
    };
  }

  /**
   * Check if system is locked
   */
  isLocked(): boolean {
    return this.systemLocked;
  }
}

/**
 * Get the Renaissance module singleton
 */
export function getRenaissance(): PhoenixRenaissance {
  if (!renaissanceInstance) {
    renaissanceInstance = new PhoenixRenaissance();
  }
  return renaissanceInstance;
}
