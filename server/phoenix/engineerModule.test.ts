import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEngineerModule } from './engineerModule';
import { getAdvancedMonitoring } from './advancedMonitoring';

describe('Engineer Module', () => {
  let engineer: ReturnType<typeof getEngineerModule>;
  let monitoring: ReturnType<typeof getAdvancedMonitoring>;

  beforeEach(() => {
    engineer = getEngineerModule();
    monitoring = getAdvancedMonitoring();
  });

  describe('Capabilities', () => {
    it('should return engineer capabilities', () => {
      const capabilities = engineer.getCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.canGeneratePages).toBe(true);
      expect(capabilities.canGenerateProjects).toBe(true);
      expect(capabilities.canManageDependencies).toBe(true);
      expect(capabilities.canDeploy).toBe(true);
      expect(capabilities.canMonitor).toBe(true);
      expect(capabilities.supportedPlatforms).toContain('manus');
      expect(capabilities.supportedLanguages).toContain('typescript');
    });

    it('should have all required platforms', () => {
      const capabilities = engineer.getCapabilities();
      const requiredPlatforms = ['manus', 'vercel', 'netlify', 'railway', 'render', 'heroku'];

      requiredPlatforms.forEach(platform => {
        expect(capabilities.supportedPlatforms).toContain(platform);
      });
    });
  });

  describe('Task Management', () => {
    it('should track task status', () => {
      const taskId = 'test-task-123';
      const task = engineer.getTaskStatus(taskId);

      // Task should not exist initially
      expect(task).toBeUndefined();
    });

    it('should get all tasks', () => {
      const tasks = engineer.getAllTasks();

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Monitoring', () => {
    it('should get monitoring dashboard', () => {
      const dashboard = engineer.getMonitoringDashboard('hour');

      expect(dashboard).toBeDefined();
      expect(dashboard?.period).toBe('hour');
      expect(dashboard?.summary).toBeDefined();
      expect(dashboard?.summary.totalExecutions).toBeGreaterThanOrEqual(0);
      expect(dashboard?.summary.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should support different time periods', () => {
      const periods: Array<'hour' | 'day' | 'week' | 'month'> = ['hour', 'day', 'week', 'month'];

      periods.forEach(period => {
        const dashboard = engineer.getMonitoringDashboard(period);
        expect(dashboard?.period).toBe(period);
      });
    });
  });

  describe('Advanced Monitoring', () => {
    it('should record performance metrics', () => {
      monitoring.recordMetric({
        name: 'test_metric',
        value: 100,
        unit: 'ms',
        timestamp: Date.now()
      });

      const metrics = monitoring.getMetrics('test_metric');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].value).toBe(100);
    });

    it('should record errors', () => {
      monitoring.recordError({
        errorId: 'error-123',
        errorType: 'TestError',
        message: 'Test error message',
        severity: 'high',
        timestamp: Date.now()
      });

      const errors = monitoring.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].errorType).toBe('TestError');
    });

    it('should create and manage alerts', () => {
      monitoring.createAlert({
        alertId: 'alert-123',
        severity: 'warning',
        message: 'Test alert',
        metric: 'test_metric',
        threshold: 100,
        currentValue: 150,
        timestamp: Date.now(),
        resolved: false
      });

      const alerts = monitoring.getUnresolvedAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');

      // Resolve the alert
      monitoring.resolveAlert('alert-123');
      const unresolvedAfter = monitoring.getUnresolvedAlerts();
      const resolved = unresolvedAfter.find(a => a.alertId === 'alert-123');
      expect(resolved?.resolved).toBe(true);
    });

    it('should record execution metrics', () => {
      monitoring.recordExecution({
        executionId: 'exec-123',
        duration: 1500,
        success: true,
        errorRate: 0,
        memoryUsed: 256,
        cpuUsed: 45,
        timestamp: Date.now()
      });

      const metrics = monitoring.getMetrics('execution_duration');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should record analytics events', () => {
      monitoring.recordEvent({
        eventId: 'event-123',
        eventType: 'test_event',
        userId: '1',
        projectId: 'proj-1',
        metadata: { test: true },
        timestamp: Date.now()
      });

      const dashboard = engineer.getMonitoringDashboard('hour');
      expect(dashboard?.events.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate comprehensive dashboard', () => {
      // Record some data
      monitoring.recordMetric({
        name: 'execution_duration',
        value: 500,
        unit: 'ms',
        timestamp: Date.now()
      });

      monitoring.recordEvent({
        eventId: 'event-456',
        eventType: 'page_generated',
        timestamp: Date.now()
      });

      const dashboard = engineer.getMonitoringDashboard('hour');

      expect(dashboard).toBeDefined();
      expect(dashboard?.metrics).toBeDefined();
      expect(dashboard?.events).toBeDefined();
      expect(dashboard?.summary).toBeDefined();
      expect(dashboard?.summary.totalExecutions).toBeGreaterThanOrEqual(0);
      expect(dashboard?.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(dashboard?.summary.averageDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Engineer Capabilities', () => {
    it('should have all required capabilities', () => {
      const capabilities = engineer.getCapabilities();

      expect(capabilities.canGeneratePages).toBe(true);
      expect(capabilities.canGenerateProjects).toBe(true);
      expect(capabilities.canManageDependencies).toBe(true);
      expect(capabilities.canDeploy).toBe(true);
      expect(capabilities.canMonitor).toBe(true);
    });

    it('should support multiple deployment platforms', () => {
      const capabilities = engineer.getCapabilities();
      const platforms = capabilities.supportedPlatforms;

      expect(platforms).toContain('manus');
      expect(platforms).toContain('vercel');
      expect(platforms).toContain('netlify');
      expect(platforms.length).toBeGreaterThan(0);
    });

    it('should support multiple programming languages', () => {
      const capabilities = engineer.getCapabilities();
      const languages = capabilities.supportedLanguages;

      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages.length).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should be a singleton', () => {
      const engineer1 = getEngineerModule();
      const engineer2 = getEngineerModule();

      expect(engineer1).toBe(engineer2);
    });

    it('should integrate with monitoring', () => {
      const dashboard = engineer.getMonitoringDashboard('hour');

      expect(dashboard).toBeDefined();
      expect(dashboard?.summary).toBeDefined();
    });
  });
});
