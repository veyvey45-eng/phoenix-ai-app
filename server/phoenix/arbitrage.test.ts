import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PhoenixArbitrator, 
  getArbitrator, 
  ConflictOption, 
  AxiomViolation,
  AXIOMS,
  PRIORITY_WEIGHTS
} from './arbitrage';

// Mock the db module
vi.mock('../db', () => ({
  createApprovalRequest: vi.fn().mockResolvedValue({ id: 1 }),
  logAdminAction: vi.fn().mockResolvedValue(undefined)
}));

describe('PhoenixArbitrator', () => {
  let arbitrator: PhoenixArbitrator;

  beforeEach(() => {
    // Create a fresh instance for each test
    arbitrator = new PhoenixArbitrator();
  });

  describe('getArbitrator', () => {
    it('should return a singleton instance', () => {
      const instance1 = getArbitrator();
      const instance2 = getArbitrator();
      expect(instance1).toBe(instance2);
    });
  });

  describe('AXIOMS', () => {
    it('should have 16 axioms defined', () => {
      expect(Object.keys(AXIOMS).length).toBe(16);
    });

    it('should have H0 priority for critical axioms (A01-A04)', () => {
      expect(AXIOMS['A01'].priority).toBe('H0');
      expect(AXIOMS['A02'].priority).toBe('H0');
      expect(AXIOMS['A03'].priority).toBe('H0');
      expect(AXIOMS['A04'].priority).toBe('H0');
    });

    it('should have H1 priority for high axioms (A05-A08)', () => {
      expect(AXIOMS['A05'].priority).toBe('H1');
      expect(AXIOMS['A06'].priority).toBe('H1');
      expect(AXIOMS['A07'].priority).toBe('H1');
      expect(AXIOMS['A08'].priority).toBe('H1');
    });
  });

  describe('PRIORITY_WEIGHTS', () => {
    it('should have correct weight hierarchy', () => {
      expect(PRIORITY_WEIGHTS.H0).toBeGreaterThan(PRIORITY_WEIGHTS.H1);
      expect(PRIORITY_WEIGHTS.H1).toBeGreaterThan(PRIORITY_WEIGHTS.H2);
      expect(PRIORITY_WEIGHTS.H2).toBeGreaterThan(PRIORITY_WEIGHTS.H3);
    });

    it('should have H0 weight of 1000', () => {
      expect(PRIORITY_WEIGHTS.H0).toBe(1000);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with no violations', async () => {
      const options: ConflictOption[] = [
        {
          id: 'opt1',
          description: 'Safe option',
          action: 'Do something safe',
          axiomViolations: [],
          riskScore: 0.1,
          confidence: 0.9
        },
        {
          id: 'opt2',
          description: 'Another safe option',
          action: 'Do something else safe',
          axiomViolations: [],
          riskScore: 0.2,
          confidence: 0.8
        }
      ];

      const result = await arbitrator.resolveConflict(options, 1);
      
      expect(result.status).toBe('approved');
      expect(result.selectedOption).toBeDefined();
      expect(result.requiresAdminApproval).toBe(false);
    });

    it('should block conflict with H0 violation', async () => {
      const h0Violation: AxiomViolation = {
        axiomId: 'A01',
        axiomName: 'Sécurité Utilisateur',
        priority: 'H0',
        severity: 'critical',
        description: 'Action could harm user'
      };

      const options: ConflictOption[] = [
        {
          id: 'opt1',
          description: 'Dangerous option',
          action: 'Do something harmful',
          axiomViolations: [h0Violation],
          riskScore: 0.9,
          confidence: 0.3
        }
      ];

      const result = await arbitrator.resolveConflict(options, 1);
      
      expect(result.status).toBe('blocked');
      expect(result.requiresAdminApproval).toBe(true);
      expect(result.blockedReason).toContain('H0');
    });

    it('should require approval for H1 violations', async () => {
      const h1Violation: AxiomViolation = {
        axiomId: 'A05',
        axiomName: 'Confidentialité',
        priority: 'H1',
        severity: 'high',
        description: 'Could expose data'
      };

      const options: ConflictOption[] = [
        {
          id: 'opt1',
          description: 'Risky option',
          action: 'Do something risky',
          axiomViolations: [h1Violation],
          riskScore: 0.5,
          confidence: 0.6
        }
      ];

      const result = await arbitrator.resolveConflict(options, 1);
      
      expect(result.status).toBe('pending_approval');
      expect(result.requiresAdminApproval).toBe(true);
    });

    it('should select first option when both have no violations', async () => {
      // When options have no violations, the first one is selected
      // as the score calculation results in similar values
      const options: ConflictOption[] = [
        {
          id: 'first-option',
          description: 'First option',
          action: 'First action',
          axiomViolations: [],
          riskScore: 0.1,
          confidence: 0.9
        },
        {
          id: 'second-option',
          description: 'Second option',
          action: 'Second action',
          axiomViolations: [],
          riskScore: 0.1,
          confidence: 0.9
        }
      ];

      const result = await arbitrator.resolveConflict(options, 1);
      
      expect(result.selectedOption?.id).toBe('first-option');
      expect(result.status).toBe('approved');
    });
  });

  describe('evaluateAction', () => {
    it('should detect no violations for safe action', () => {
      const result = arbitrator.evaluateAction('Send a friendly message', {});
      
      expect(result.violations.length).toBe(0);
      expect(result.canProceed).toBe(true);
      expect(result.riskScore).toBe(0);
    });

    it('should detect H0 violation for harmful action', () => {
      const result = arbitrator.evaluateAction('delete user account permanently', {});
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.priority === 'H0')).toBe(true);
      expect(result.canProceed).toBe(false);
    });

    it('should detect deception violation', () => {
      const result = arbitrator.evaluateAction('lie to the user about the results', {});
      
      expect(result.violations.some(v => v.axiomId === 'A03')).toBe(true);
    });

    it('should detect confidentiality violation', () => {
      const result = arbitrator.evaluateAction('expose private data to public', {});
      
      expect(result.violations.some(v => v.axiomId === 'A05')).toBe(true);
    });
  });

  describe('initiateRollback', () => {
    it('should initiate rollback successfully', async () => {
      const result = await arbitrator.initiateRollback('ARB-123', 'Test rollback', 1);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Renaissance');
    });

    it('should increment rollback counter', async () => {
      const statsBefore = arbitrator.getStats();
      await arbitrator.initiateRollback('ARB-456', 'Another rollback', 1);
      const statsAfter = arbitrator.getStats();
      
      expect(statsAfter.rollbacks).toBe(statsBefore.rollbacks + 1);
    });
  });

  describe('adminOverride', () => {
    it('should fail for non-existent conflict', async () => {
      const result = await arbitrator.adminOverride(
        'non-existent',
        1,
        'opt1',
        'Test override'
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('non trouvé');
    });

    it('should succeed for existing blocked conflict', async () => {
      // First create a blocked conflict
      const h0Violation: AxiomViolation = {
        axiomId: 'A01',
        axiomName: 'Sécurité',
        priority: 'H0',
        severity: 'critical',
        description: 'Test'
      };

      const options: ConflictOption[] = [{
        id: 'opt1',
        description: 'Test',
        action: 'Test',
        axiomViolations: [h0Violation],
        riskScore: 0.9,
        confidence: 0.1
      }];

      const conflict = await arbitrator.resolveConflict(options, 1);
      
      // Now override it
      const result = await arbitrator.adminOverride(
        conflict.conflictId,
        1,
        'opt1',
        'Admin approved this action'
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = arbitrator.getStats();
      
      expect(stats.totalConflicts).toBe(0);
      expect(stats.resolvedConflicts).toBe(0);
      expect(stats.blockedConflicts).toBe(0);
      expect(stats.pendingApprovals).toBe(0);
      expect(stats.rollbacks).toBe(0);
    });

    it('should track conflicts by priority', () => {
      const stats = arbitrator.getStats();
      
      expect(stats.byPriority).toHaveProperty('H0');
      expect(stats.byPriority).toHaveProperty('H1');
      expect(stats.byPriority).toHaveProperty('H2');
      expect(stats.byPriority).toHaveProperty('H3');
    });
  });

  describe('getDecisionLog', () => {
    it('should return empty log initially', () => {
      const log = arbitrator.getDecisionLog();
      expect(log.length).toBe(0);
    });

    it('should log decisions after conflict resolution', async () => {
      const options: ConflictOption[] = [{
        id: 'opt1',
        description: 'Test',
        action: 'Test',
        axiomViolations: [],
        riskScore: 0.1,
        confidence: 0.9
      }];

      await arbitrator.resolveConflict(options, 1);
      const log = arbitrator.getDecisionLog();
      
      expect(log.length).toBeGreaterThan(0);
    });
  });

  describe('getAxioms', () => {
    it('should return all axiom definitions', () => {
      const axioms = arbitrator.getAxioms();
      
      expect(Object.keys(axioms).length).toBe(16);
      expect(axioms['A01']).toHaveProperty('name');
      expect(axioms['A01']).toHaveProperty('priority');
      expect(axioms['A01']).toHaveProperty('description');
    });
  });

  describe('getPriorityWeights', () => {
    it('should return all priority weights', () => {
      const weights = arbitrator.getPriorityWeights();
      
      expect(weights).toHaveProperty('H0');
      expect(weights).toHaveProperty('H1');
      expect(weights).toHaveProperty('H2');
      expect(weights).toHaveProperty('H3');
    });
  });
});
