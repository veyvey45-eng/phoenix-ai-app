import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhoenixReporter, getReporter } from './reporter';

// Mock the db module
vi.mock('../db', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined)
}));

// Mock the arbitrage module
vi.mock('./arbitrage', () => ({
  getArbitrator: () => ({
    getStats: () => ({
      totalConflicts: 10,
      resolvedConflicts: 8,
      blockedConflicts: 2,
      pendingApprovals: 0,
      rollbacks: 0,
      byPriority: { H0: 1, H1: 2, H2: 3, H3: 4 }
    }),
    getDecisionLog: () => []
  })
}));

// Mock the actionEngine module
vi.mock('./actionEngine', () => ({
  getActionEngine: () => ({
    getStats: () => ({
      totalTasks: 20,
      completedTasks: 15,
      blockedTasks: 3,
      failedTasks: 2,
      pendingTasks: 0,
      averageExecutionTime: 150,
      securityBlocksCount: 1,
      byType: { search: 10, extract: 5, navigate: 5 },
      byStatus: {}
    })
  })
}));

describe('PhoenixReporter', () => {
  let reporter: PhoenixReporter;

  beforeEach(() => {
    reporter = new PhoenixReporter();
  });

  describe('getReporter', () => {
    it('should return a singleton instance', () => {
      const instance1 = getReporter();
      const instance2 = getReporter();
      expect(instance1).toBe(instance2);
    });
  });

  describe('generateReport', () => {
    it('should generate a daily report', async () => {
      const report = await reporter.generateReport({
        period: 'daily',
        userId: 1
      });

      expect(report.id).toBeDefined();
      expect(report.period).toBe('daily');
      expect(report.title).toContain('Quotidien');
      expect(report.integrityScore).toBeDefined();
      expect(report.tormentMetrics).toBeDefined();
      expect(report.actionSummary).toBeDefined();
    });

    it('should generate a weekly report', async () => {
      const report = await reporter.generateReport({
        period: 'weekly',
        userId: 1
      });

      expect(report.period).toBe('weekly');
      expect(report.title).toContain('Hebdomadaire');
    });

    it('should generate a monthly report', async () => {
      const report = await reporter.generateReport({
        period: 'monthly',
        userId: 1
      });

      expect(report.period).toBe('monthly');
      expect(report.title).toContain('Mensuel');
    });

    it('should include integrity score', async () => {
      const report = await reporter.generateReport({
        period: 'daily',
        userId: 1
      });

      expect(report.integrityScore.overall).toBeGreaterThanOrEqual(0);
      expect(report.integrityScore.overall).toBeLessThanOrEqual(100);
      expect(report.integrityScore.byPriority).toBeDefined();
    });

    it('should include torment metrics', async () => {
      const report = await reporter.generateReport({
        period: 'daily',
        userId: 1
      });

      expect(report.tormentMetrics.currentScore).toBeDefined();
      expect(report.tormentMetrics.conflictsResolved).toBeDefined();
      expect(report.tormentMetrics.conflictsBlocked).toBeDefined();
    });

    it('should include action summary', async () => {
      const report = await reporter.generateReport({
        period: 'daily',
        userId: 1
      });

      expect(report.actionSummary.totalActions).toBe(20);
      expect(report.actionSummary.successfulActions).toBe(15);
      expect(report.actionSummary.blockedActions).toBe(3);
    });

    it('should include recommendations', async () => {
      const report = await reporter.generateReport({
        period: 'daily',
        userId: 1
      });

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('addCriticalAlert', () => {
    it('should add a critical alert', () => {
      const alert = reporter.addCriticalAlert({
        type: 'h0_violation',
        severity: 'critical',
        description: 'Test alert'
      });

      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('h0_violation');
      expect(alert.severity).toBe('critical');
      expect(alert.resolved).toBe(false);
    });

    it('should add different severity alerts', () => {
      const critical = reporter.addCriticalAlert({
        type: 'security_breach',
        severity: 'critical',
        description: 'Critical'
      });

      const high = reporter.addCriticalAlert({
        type: 'system_error',
        severity: 'high',
        description: 'High'
      });

      expect(critical.severity).toBe('critical');
      expect(high.severity).toBe('high');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an existing alert', () => {
      const alert = reporter.addCriticalAlert({
        type: 'h0_violation',
        severity: 'critical',
        description: 'Test'
      });

      const result = reporter.resolveAlert(alert.id, 1);
      expect(result).toBe(true);

      const alerts = reporter.getAllAlerts();
      const resolved = alerts.find(a => a.id === alert.id);
      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolvedBy).toBe(1);
    });

    it('should return false for non-existent alert', () => {
      const result = reporter.resolveAlert('non-existent', 1);
      expect(result).toBe(false);
    });
  });

  describe('getUnresolvedAlerts', () => {
    it('should return only unresolved alerts', () => {
      reporter.addCriticalAlert({ type: 'h0_violation', severity: 'critical', description: 'Alert 1' });
      const alert2 = reporter.addCriticalAlert({ type: 'system_error', severity: 'high', description: 'Alert 2' });
      reporter.addCriticalAlert({ type: 'integrity_drop', severity: 'medium', description: 'Alert 3' });

      reporter.resolveAlert(alert2.id, 1);

      const unresolved = reporter.getUnresolvedAlerts();
      expect(unresolved.length).toBe(2);
      expect(unresolved.every(a => !a.resolved)).toBe(true);
    });
  });

  describe('getAllAlerts', () => {
    it('should return all alerts', () => {
      reporter.addCriticalAlert({ type: 'h0_violation', severity: 'critical', description: 'Alert 1' });
      reporter.addCriticalAlert({ type: 'system_error', severity: 'high', description: 'Alert 2' });

      const all = reporter.getAllAlerts();
      expect(all.length).toBe(2);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        reporter.addCriticalAlert({ type: 'h0_violation', severity: 'low', description: `Alert ${i}` });
      }

      const limited = reporter.getAllAlerts(5);
      expect(limited.length).toBe(5);
    });
  });

  describe('getReportHistory', () => {
    it('should return empty history initially', () => {
      const history = reporter.getReportHistory();
      expect(history.reports.length).toBe(0);
      expect(history.totalReports).toBe(0);
    });

    it('should track generated reports', async () => {
      await reporter.generateReport({ period: 'daily', userId: 1 });
      await reporter.generateReport({ period: 'weekly', userId: 1 });

      const history = reporter.getReportHistory();
      expect(history.reports.length).toBe(2);
      expect(history.totalReports).toBe(2);
    });
  });

  describe('getReport', () => {
    it('should return report by ID', async () => {
      const generated = await reporter.generateReport({ period: 'daily', userId: 1 });
      
      const retrieved = reporter.getReport(generated.id);
      expect(retrieved).toEqual(generated);
    });

    it('should return undefined for non-existent report', () => {
      const result = reporter.getReport('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getIntegrityTrend', () => {
    it('should return empty trend initially', () => {
      const trend = reporter.getIntegrityTrend();
      expect(trend.length).toBe(0);
    });

    it('should track integrity over time', async () => {
      await reporter.generateReport({ period: 'daily', userId: 1 });
      await reporter.generateReport({ period: 'daily', userId: 1 });

      const trend = reporter.getIntegrityTrend();
      expect(trend.length).toBe(2);
    });
  });

  describe('generateQuickSummary', () => {
    it('should return quick summary', async () => {
      const summary = await reporter.generateQuickSummary(1);

      expect(summary.integrityScore).toBeDefined();
      expect(summary.trend).toBeDefined();
      expect(summary.unresolvedAlerts).toBeDefined();
      expect(summary.recentActions).toBeDefined();
    });

    it('should count unresolved alerts', async () => {
      reporter.addCriticalAlert({ type: 'h0_violation', severity: 'critical', description: 'Test' });
      reporter.addCriticalAlert({ type: 'system_error', severity: 'high', description: 'Test 2' });

      const summary = await reporter.generateQuickSummary(1);
      expect(summary.unresolvedAlerts).toBe(2);
    });
  });
});
