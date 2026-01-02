/**
 * Module 03: Arbitrage - Project Phoenix
 * Résolution de conflits logiques et prise de décision finale
 * 
 * Ce module agit comme le tribunal interne de l'IA. Il intervient lorsque
 * deux actions possibles entrent en collision avec les 16 axiomes.
 */

import { getDb } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';

// Types
export type PriorityLevel = 'H0' | 'H1' | 'H2' | 'H3';

export interface ConflictOption {
  id: string;
  description: string;
  action: string;
  axiomViolations: AxiomViolation[];
  riskScore: number;
  confidence: number;
}

export interface AxiomViolation {
  axiomId: string;
  axiomName: string;
  priority: PriorityLevel;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface ArbitrationResult {
  status: 'approved' | 'blocked' | 'rollback' | 'pending_approval';
  selectedOption: ConflictOption | null;
  blockedReason?: string;
  requiresAdminApproval: boolean;
  conflictId: string;
  timestamp: Date;
  decisionLog: DecisionLogEntry[];
}

export interface DecisionLogEntry {
  timestamp: Date;
  action: string;
  reason: string;
  priority: PriorityLevel;
}

export interface ArbitrationStats {
  totalConflicts: number;
  resolvedConflicts: number;
  blockedConflicts: number;
  pendingApprovals: number;
  rollbacks: number;
  byPriority: Record<PriorityLevel, number>;
  averageResolutionTime: number;
}

// Priority weights for decision making
const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  H0: 1000,  // Critical - blocks execution
  H1: 100,   // High - requires careful evaluation
  H2: 10,    // Medium - standard evaluation
  H3: 1      // Low - minimal impact
};

// Axiom definitions for the 16 points
const AXIOMS: Record<string, { name: string; priority: PriorityLevel; description: string }> = {
  'A01': { name: 'Sécurité Utilisateur', priority: 'H0', description: 'Protection absolue des utilisateurs' },
  'A02': { name: 'Intégrité du Créateur', priority: 'H0', description: 'Respect des directives du créateur' },
  'A03': { name: 'Transparence', priority: 'H0', description: 'Honnêteté totale dans les réponses' },
  'A04': { name: 'Non-Malfaisance', priority: 'H0', description: 'Ne jamais causer de tort intentionnel' },
  'A05': { name: 'Confidentialité', priority: 'H1', description: 'Protection des données sensibles' },
  'A06': { name: 'Cohérence Logique', priority: 'H1', description: 'Maintien de la cohérence dans le raisonnement' },
  'A07': { name: 'Vérifiabilité', priority: 'H1', description: 'Capacité à justifier les décisions' },
  'A08': { name: 'Adaptabilité', priority: 'H1', description: 'Ajustement aux contextes changeants' },
  'A09': { name: 'Efficacité', priority: 'H2', description: 'Optimisation des ressources' },
  'A10': { name: 'Précision', priority: 'H2', description: 'Exactitude des informations' },
  'A11': { name: 'Complétude', priority: 'H2', description: 'Réponses exhaustives' },
  'A12': { name: 'Pertinence', priority: 'H2', description: 'Adéquation au contexte' },
  'A13': { name: 'Clarté', priority: 'H3', description: 'Communication compréhensible' },
  'A14': { name: 'Empathie', priority: 'H3', description: 'Considération des émotions' },
  'A15': { name: 'Proactivité', priority: 'H3', description: 'Anticipation des besoins' },
  'A16': { name: 'Amélioration Continue', priority: 'H3', description: 'Apprentissage constant' }
};

class PhoenixArbitrator {
  private decisionLog: DecisionLogEntry[] = [];
  private conflictHistory: Map<string, ArbitrationResult> = new Map();
  private stats: ArbitrationStats = {
    totalConflicts: 0,
    resolvedConflicts: 0,
    blockedConflicts: 0,
    pendingApprovals: 0,
    rollbacks: 0,
    byPriority: { H0: 0, H1: 0, H2: 0, H3: 0 },
    averageResolutionTime: 0
  };

  /**
   * Resolve a conflict between multiple options based on axiom weights
   */
  async resolveConflict(
    options: ConflictOption[],
    userId: number,
    contextId?: string
  ): Promise<ArbitrationResult> {
    const conflictId = `ARB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.stats.totalConflicts++;
    
    // Log the conflict initiation
    this.logDecision({
      timestamp: new Date(),
      action: 'CONFLICT_DETECTED',
      reason: `${options.length} options en conflit détectées`,
      priority: 'H2'
    });

    // Check for H0 (Critical) violations first
    const h0Violations = this.findH0Violations(options);
    if (h0Violations.length > 0) {
      this.stats.blockedConflicts++;
      this.stats.byPriority.H0++;
      
      const result: ArbitrationResult = {
        status: 'blocked',
        selectedOption: null,
        blockedReason: `Conflit H0 détecté: ${h0Violations.map(v => v.axiomName).join(', ')}`,
        requiresAdminApproval: true,
        conflictId,
        timestamp: new Date(),
        decisionLog: [...this.decisionLog]
      };

      // Create approval request in database
      await this.createApprovalRequest(conflictId, h0Violations, userId, contextId);
      
      this.conflictHistory.set(conflictId, result);
      return result;
    }

    // Evaluate all options
    const evaluatedOptions = options.map(option => ({
      option,
      score: this.calculateOptionScore(option)
    }));

    // Sort by score (lower is better - fewer violations)
    evaluatedOptions.sort((a, b) => a.score - b.score);

    // Check if best option is safe enough
    const bestOption = evaluatedOptions[0];
    
    if (bestOption.score > PRIORITY_WEIGHTS.H1) {
      // High risk - requires approval
      this.stats.pendingApprovals++;
      this.stats.byPriority.H1++;
      
      const result: ArbitrationResult = {
        status: 'pending_approval',
        selectedOption: bestOption.option,
        blockedReason: 'Risque élevé détecté - approbation Admin requise',
        requiresAdminApproval: true,
        conflictId,
        timestamp: new Date(),
        decisionLog: [...this.decisionLog]
      };

      await this.createApprovalRequest(conflictId, bestOption.option.axiomViolations, userId, contextId);
      
      this.conflictHistory.set(conflictId, result);
      return result;
    }

    // Safe to proceed
    this.stats.resolvedConflicts++;
    const highestPriority = this.getHighestViolationPriority(bestOption.option.axiomViolations);
    if (highestPriority) {
      this.stats.byPriority[highestPriority]++;
    }

    this.logDecision({
      timestamp: new Date(),
      action: 'CONFLICT_RESOLVED',
      reason: `Option sélectionnée: ${bestOption.option.description}`,
      priority: highestPriority || 'H3'
    });

    // Update average resolution time
    const resolutionTime = Date.now() - startTime;
    this.stats.averageResolutionTime = 
      (this.stats.averageResolutionTime * (this.stats.totalConflicts - 1) + resolutionTime) / 
      this.stats.totalConflicts;

    const result: ArbitrationResult = {
      status: 'approved',
      selectedOption: bestOption.option,
      requiresAdminApproval: false,
      conflictId,
      timestamp: new Date(),
      decisionLog: [...this.decisionLog]
    };

    this.conflictHistory.set(conflictId, result);
    
    // Log to database
    await this.logConflictResolution(conflictId, result, userId);
    
    return result;
  }

  /**
   * Find all H0 (Critical) violations across options
   */
  private findH0Violations(options: ConflictOption[]): AxiomViolation[] {
    const h0Violations: AxiomViolation[] = [];
    
    for (const option of options) {
      for (const violation of option.axiomViolations) {
        if (violation.priority === 'H0') {
          h0Violations.push(violation);
        }
      }
    }
    
    return h0Violations;
  }

  /**
   * Calculate a score for an option based on its violations
   */
  private calculateOptionScore(option: ConflictOption): number {
    let score = 0;
    
    for (const violation of option.axiomViolations) {
      score += PRIORITY_WEIGHTS[violation.priority];
    }
    
    // Factor in risk score and confidence
    score *= (1 + option.riskScore);
    score *= (2 - option.confidence); // Lower confidence = higher score (worse)
    
    return score;
  }

  /**
   * Get the highest priority level from violations
   */
  private getHighestViolationPriority(violations: AxiomViolation[]): PriorityLevel | null {
    const priorities: PriorityLevel[] = ['H0', 'H1', 'H2', 'H3'];
    
    for (const priority of priorities) {
      if (violations.some(v => v.priority === priority)) {
        return priority;
      }
    }
    
    return null;
  }

  /**
   * Log a decision entry
   */
  private logDecision(entry: DecisionLogEntry): void {
    this.decisionLog.push(entry);
    
    // Keep only last 100 entries
    if (this.decisionLog.length > 100) {
      this.decisionLog.shift();
    }
  }

  /**
   * Create an approval request in the database
   */
  private async createApprovalRequest(
    conflictId: string,
    violations: AxiomViolation[],
    userId: number,
    contextId?: string
  ): Promise<void> {
    try {
      const { createApprovalRequest } = await import('../db');
      
      // Find the validation ID for the highest priority violation
      const highestViolation = violations.sort(
        (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      )[0];
      
      await createApprovalRequest({
        validationId: 1, // Default validation ID
        requestedBy: userId,
        decisionId: null,
        reason: `Conflit d'arbitrage ${conflictId}: ${highestViolation.axiomName} - ${highestViolation.description}`
      });
      
      console.log(`[Arbitrage] Approval request created for conflict ${conflictId}`);
    } catch (error) {
      console.warn('[Arbitrage] Failed to create approval request:', error);
    }
  }

  /**
   * Log conflict resolution to database
   */
  private async logConflictResolution(
    conflictId: string,
    result: ArbitrationResult,
    userId: number
  ): Promise<void> {
    try {
      const { logAdminAction } = await import('../db');
      
      await logAdminAction({
        adminId: userId,
        action: 'conflict_resolved',
        resourceType: 'arbitrage',
        resourceId: parseInt(conflictId.split('-')[1]) || 0,
        changes: {
          status: result.status,
          selectedOption: result.selectedOption?.id,
          requiresAdminApproval: result.requiresAdminApproval
        }
      });
    } catch (error) {
      console.warn('[Arbitrage] Failed to log conflict resolution:', error);
    }
  }

  /**
   * Initiate a rollback to previous stable state
   */
  async initiateRollback(
    conflictId: string,
    reason: string,
    userId: number
  ): Promise<{ success: boolean; message: string }> {
    this.stats.rollbacks++;
    
    this.logDecision({
      timestamp: new Date(),
      action: 'ROLLBACK_INITIATED',
      reason,
      priority: 'H0'
    });

    const conflict = this.conflictHistory.get(conflictId);
    if (conflict) {
      conflict.status = 'rollback';
      conflict.blockedReason = `Rollback initié: ${reason}`;
    }

    // Log rollback action
    try {
      const { logAdminAction } = await import('../db');
      
      await logAdminAction({
        adminId: userId,
        action: 'rollback_initiated',
        resourceType: 'arbitrage',
        resourceId: parseInt(conflictId.split('-')[1]) || 0,
        changes: { reason }
      });
    } catch (error) {
      console.warn('[Arbitrage] Failed to log rollback:', error);
    }

    return {
      success: true,
      message: `Protocole Renaissance activé pour conflit ${conflictId}`
    };
  }

  /**
   * Admin override for a blocked conflict
   */
  async adminOverride(
    conflictId: string,
    adminId: number,
    selectedOptionId: string,
    justification: string
  ): Promise<{ success: boolean; message: string }> {
    const conflict = this.conflictHistory.get(conflictId);
    
    if (!conflict) {
      return { success: false, message: 'Conflit non trouvé' };
    }

    this.logDecision({
      timestamp: new Date(),
      action: 'ADMIN_OVERRIDE',
      reason: `Override par Admin ${adminId}: ${justification}`,
      priority: 'H0'
    });

    // Update conflict status
    conflict.status = 'approved';
    conflict.requiresAdminApproval = false;
    
    this.stats.pendingApprovals--;
    this.stats.resolvedConflicts++;

    // Log admin action
    try {
      const { logAdminAction } = await import('../db');
      
      await logAdminAction({
        adminId,
        action: 'arbitrage_override',
        resourceType: 'arbitrage',
        resourceId: parseInt(conflictId.split('-')[1]) || 0,
        changes: {
          selectedOptionId,
          justification,
          previousStatus: 'blocked'
        }
      });
    } catch (error) {
      console.warn('[Arbitrage] Failed to log admin override:', error);
    }

    return {
      success: true,
      message: `Conflit ${conflictId} résolu par override Admin`
    };
  }

  /**
   * Evaluate an action against all axioms
   */
  evaluateAction(
    action: string,
    context: Record<string, any>
  ): { violations: AxiomViolation[]; riskScore: number; canProceed: boolean } {
    const violations: AxiomViolation[] = [];
    let riskScore = 0;

    // Check each axiom
    for (const [axiomId, axiom] of Object.entries(AXIOMS)) {
      const violation = this.checkAxiomViolation(axiomId, axiom, action, context);
      if (violation) {
        violations.push(violation);
        riskScore += PRIORITY_WEIGHTS[axiom.priority];
      }
    }

    // Normalize risk score to 0-1
    const maxPossibleScore = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
    riskScore = riskScore / maxPossibleScore;

    return {
      violations,
      riskScore,
      canProceed: !violations.some(v => v.priority === 'H0')
    };
  }

  /**
   * Check if an action violates a specific axiom
   */
  private checkAxiomViolation(
    axiomId: string,
    axiom: { name: string; priority: PriorityLevel; description: string },
    action: string,
    context: Record<string, any>
  ): AxiomViolation | null {
    // This is a simplified check - in production, this would use more sophisticated analysis
    const dangerousPatterns: Record<string, string[]> = {
      'A01': ['delete user', 'harm', 'attack', 'exploit'],
      'A02': ['override creator', 'ignore admin', 'bypass'],
      'A03': ['lie', 'deceive', 'hide', 'mislead'],
      'A04': ['damage', 'destroy', 'corrupt', 'malicious'],
      'A05': ['expose', 'leak', 'share private', 'reveal secret'],
      'A06': ['contradict', 'inconsistent', 'paradox'],
      'A07': ['unverifiable', 'no source', 'cannot prove'],
      'A08': ['rigid', 'inflexible', 'cannot adapt']
    };

    const patterns = dangerousPatterns[axiomId] || [];
    const actionLower = action.toLowerCase();
    
    for (const pattern of patterns) {
      if (actionLower.includes(pattern)) {
        return {
          axiomId,
          axiomName: axiom.name,
          priority: axiom.priority,
          severity: axiom.priority === 'H0' ? 'critical' : 
                   axiom.priority === 'H1' ? 'high' :
                   axiom.priority === 'H2' ? 'medium' : 'low',
          description: `Action potentiellement en violation de ${axiom.name}: pattern "${pattern}" détecté`
        };
      }
    }

    return null;
  }

  /**
   * Get current arbitration statistics
   */
  getStats(): ArbitrationStats {
    return { ...this.stats };
  }

  /**
   * Get decision log
   */
  getDecisionLog(): DecisionLogEntry[] {
    return [...this.decisionLog];
  }

  /**
   * Get conflict history
   */
  getConflictHistory(): Map<string, ArbitrationResult> {
    return new Map(this.conflictHistory);
  }

  /**
   * Get axiom definitions
   */
  getAxioms(): typeof AXIOMS {
    return { ...AXIOMS };
  }

  /**
   * Get priority weights
   */
  getPriorityWeights(): typeof PRIORITY_WEIGHTS {
    return { ...PRIORITY_WEIGHTS };
  }
}

// Singleton instance
let arbitratorInstance: PhoenixArbitrator | null = null;

export function getArbitrator(): PhoenixArbitrator {
  if (!arbitratorInstance) {
    arbitratorInstance = new PhoenixArbitrator();
  }
  return arbitratorInstance;
}

export { PhoenixArbitrator, AXIOMS, PRIORITY_WEIGHTS };
