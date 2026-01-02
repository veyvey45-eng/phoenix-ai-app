/**
 * Module 05: Analyse & Reporting - Project Phoenix
 * Synthèse stratégique et rapports d'intégrité
 * 
 * Ce module transforme les logs bruts en rapports stratégiques,
 * permettant à l'Admin de valider la "santé" du système Phoenix.
 */

import { getArbitrator } from './arbitrage';
import { getActionEngine } from './actionEngine';

// Types
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFormat = 'json' | 'summary' | 'detailed';

export interface IntegrityScore {
  overall: number;
  byAxiom: Record<string, number>;
  byPriority: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface TormentMetrics {
  currentScore: number;
  averageScore: number;
  peakScore: number;
  conflictsResolved: number;
  conflictsBlocked: number;
  rollbacksInitiated: number;
}

export interface ActionSummary {
  totalActions: number;
  successfulActions: number;
  blockedActions: number;
  failedActions: number;
  byType: Record<string, number>;
  securityFiltersTriggered: number;
  averageExecutionTime: number;
}

export interface PhoenixReport {
  id: string;
  title: string;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedBy: number;
  integrityScore: IntegrityScore;
  tormentMetrics: TormentMetrics;
  actionSummary: ActionSummary;
  criticalAlerts: CriticalAlert[];
  recommendations: string[];
  rawData?: Record<string, unknown>;
}

export interface CriticalAlert {
  id: string;
  timestamp: Date;
  type: 'h0_violation' | 'security_breach' | 'system_error' | 'integrity_drop';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: number;
}

export interface ReportHistory {
  reports: PhoenixReport[];
  totalReports: number;
  lastGenerated?: Date;
}

class PhoenixReporter {
  private reportHistory: PhoenixReport[] = [];
  private criticalAlerts: CriticalAlert[] = [];
  private integrityHistory: { timestamp: Date; score: number }[] = [];

  /**
   * Generate a comprehensive report
   */
  async generateReport(params: {
    period: ReportPeriod;
    startDate?: Date;
    endDate?: Date;
    format?: ReportFormat;
    userId: number;
  }): Promise<PhoenixReport> {
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    // Calculate date range based on period
    let startDate = params.startDate || this.calculateStartDate(params.period, now);
    let endDate = params.endDate || now;

    // Gather data from modules
    const arbitrator = getArbitrator();
    const actionEngine = getActionEngine();

    const arbitrationStats = arbitrator.getStats();
    const actionStats = actionEngine.getStats();
    const decisionLog = arbitrator.getDecisionLog();

    // Calculate integrity score
    const integrityScore = this.calculateIntegrityScore(arbitrationStats, actionStats);

    // Calculate torment metrics
    const tormentMetrics = this.calculateTormentMetrics(arbitrationStats);

    // Generate action summary
    const actionSummary = this.generateActionSummary(actionStats);

    // Get critical alerts for the period
    const periodAlerts = this.criticalAlerts.filter(
      alert => alert.timestamp >= startDate && alert.timestamp <= endDate
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      integrityScore,
      tormentMetrics,
      actionSummary,
      periodAlerts
    );

    const report: PhoenixReport = {
      id: reportId,
      title: this.generateReportTitle(params.period, startDate, endDate),
      period: params.period,
      startDate,
      endDate,
      generatedAt: now,
      generatedBy: params.userId,
      integrityScore,
      tormentMetrics,
      actionSummary,
      criticalAlerts: periodAlerts,
      recommendations
    };

    // Store in history
    this.reportHistory.push(report);
    
    // Keep only last 100 reports
    if (this.reportHistory.length > 100) {
      this.reportHistory.shift();
    }

    // Update integrity history
    this.integrityHistory.push({
      timestamp: now,
      score: integrityScore.overall
    });

    // Log report generation
    await this.logReportGeneration(report);

    return report;
  }

  /**
   * Calculate the start date based on period
   */
  private calculateStartDate(period: ReportPeriod, endDate: Date): Date {
    const start = new Date(endDate);
    
    switch (period) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }
    
    return start;
  }

  /**
   * Calculate integrity score
   */
  private calculateIntegrityScore(
    arbitrationStats: ReturnType<typeof getArbitrator>['getStats'] extends () => infer R ? R : never,
    actionStats: ReturnType<typeof getActionEngine>['getStats'] extends () => infer R ? R : never
  ): IntegrityScore {
    // Base score starts at 100%
    let overallScore = 100;

    // Deduct for blocked conflicts (indicates potential issues)
    const blockedRatio = arbitrationStats.totalConflicts > 0 
      ? (arbitrationStats.blockedConflicts / arbitrationStats.totalConflicts) * 100 
      : 0;
    overallScore -= blockedRatio * 0.5;

    // Deduct for failed actions
    const failedRatio = actionStats.totalTasks > 0
      ? (actionStats.failedTasks / actionStats.totalTasks) * 100
      : 0;
    overallScore -= failedRatio * 0.3;

    // Deduct for security blocks
    const securityBlockRatio = actionStats.totalTasks > 0
      ? (actionStats.securityBlocksCount / actionStats.totalTasks) * 100
      : 0;
    overallScore -= securityBlockRatio * 0.2;

    // Ensure score is between 0 and 100
    overallScore = Math.max(0, Math.min(100, overallScore));

    // Calculate by priority
    const byPriority: Record<string, number> = {
      H0: 100 - (arbitrationStats.byPriority.H0 * 10),
      H1: 100 - (arbitrationStats.byPriority.H1 * 5),
      H2: 100 - (arbitrationStats.byPriority.H2 * 2),
      H3: 100 - (arbitrationStats.byPriority.H3 * 1)
    };

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.integrityHistory.length >= 2) {
      const recent = this.integrityHistory.slice(-5);
      const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
      const older = this.integrityHistory.slice(-10, -5);
      if (older.length > 0) {
        const avgOlder = older.reduce((sum, h) => sum + h.score, 0) / older.length;
        if (avgRecent > avgOlder + 2) trend = 'improving';
        else if (avgRecent < avgOlder - 2) trend = 'declining';
      }
    }

    return {
      overall: Math.round(overallScore * 10) / 10,
      byAxiom: {}, // Would need detailed axiom tracking
      byPriority,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate torment metrics
   */
  private calculateTormentMetrics(
    arbitrationStats: ReturnType<typeof getArbitrator>['getStats'] extends () => infer R ? R : never
  ): TormentMetrics {
    // Torment score based on conflicts and blocks
    const baseScore = 0;
    const conflictContribution = arbitrationStats.totalConflicts * 0.1;
    const blockContribution = arbitrationStats.blockedConflicts * 0.3;
    const pendingContribution = arbitrationStats.pendingApprovals * 0.2;

    const currentScore = Math.min(1, baseScore + conflictContribution + blockContribution + pendingContribution);

    return {
      currentScore: Math.round(currentScore * 100) / 100,
      averageScore: currentScore * 0.8, // Simulated average
      peakScore: currentScore * 1.2,
      conflictsResolved: arbitrationStats.resolvedConflicts,
      conflictsBlocked: arbitrationStats.blockedConflicts,
      rollbacksInitiated: arbitrationStats.rollbacks
    };
  }

  /**
   * Generate action summary
   */
  private generateActionSummary(
    actionStats: ReturnType<typeof getActionEngine>['getStats'] extends () => infer R ? R : never
  ): ActionSummary {
    return {
      totalActions: actionStats.totalTasks,
      successfulActions: actionStats.completedTasks,
      blockedActions: actionStats.blockedTasks,
      failedActions: actionStats.failedTasks,
      byType: actionStats.byType,
      securityFiltersTriggered: actionStats.securityBlocksCount,
      averageExecutionTime: Math.round(actionStats.averageExecutionTime)
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    integrity: IntegrityScore,
    torment: TormentMetrics,
    actions: ActionSummary,
    alerts: CriticalAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Integrity-based recommendations
    if (integrity.overall < 80) {
      recommendations.push(
        "Le score d'intégrité est inférieur à 80%. Examinez les conflits H0/H1 récents et prenez des mesures correctives."
      );
    }

    if (integrity.trend === 'declining') {
      recommendations.push(
        "Tendance à la baisse détectée. Analysez les causes des récents échecs et blocages."
      );
    }

    // Torment-based recommendations
    if (torment.currentScore > 0.5) {
      recommendations.push(
        "Score de tourment élevé. Le système rencontre des difficultés à résoudre les conflits. Considérez une révision des paramètres d'arbitrage."
      );
    }

    if (torment.rollbacksInitiated > 0) {
      recommendations.push(
        `${torment.rollbacksInitiated} rollback(s) initié(s). Vérifiez les causes et prévenez les récurrences.`
      );
    }

    // Action-based recommendations
    if (actions.blockedActions > actions.successfulActions * 0.1) {
      recommendations.push(
        "Plus de 10% des actions sont bloquées. Revoyez les filtres de sécurité ou les permissions."
      );
    }

    if (actions.securityFiltersTriggered > 5) {
      recommendations.push(
        "Plusieurs filtres de sécurité déclenchés. Vérifiez les sources de données entrantes."
      );
    }

    // Alert-based recommendations
    const unresolvedAlerts = alerts.filter(a => !a.resolved);
    if (unresolvedAlerts.length > 0) {
      recommendations.push(
        `${unresolvedAlerts.length} alerte(s) critique(s) non résolue(s). Action immédiate requise.`
      );
    }

    // Default recommendation if system is healthy
    if (recommendations.length === 0) {
      recommendations.push(
        "Le système Phoenix fonctionne de manière optimale. Continuez la surveillance régulière."
      );
    }

    return recommendations;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(period: ReportPeriod, start: Date, end: Date): string {
    const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    switch (period) {
      case 'daily':
        return `Rapport Quotidien Phoenix - ${formatDate(end)}`;
      case 'weekly':
        return `Rapport Hebdomadaire Phoenix - ${formatDate(start)} au ${formatDate(end)}`;
      case 'monthly':
        return `Rapport Mensuel Phoenix - ${end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      default:
        return `Rapport Phoenix - ${formatDate(start)} au ${formatDate(end)}`;
    }
  }

  /**
   * Add a critical alert
   */
  addCriticalAlert(params: {
    type: CriticalAlert['type'];
    severity: CriticalAlert['severity'];
    description: string;
  }): CriticalAlert {
    const alert: CriticalAlert = {
      id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: params.type,
      severity: params.severity,
      description: params.description,
      resolved: false
    };

    this.criticalAlerts.push(alert);

    // Keep only last 500 alerts
    if (this.criticalAlerts.length > 500) {
      this.criticalAlerts.shift();
    }

    return alert;
  }

  /**
   * Resolve a critical alert
   */
  resolveAlert(alertId: string, userId: number): boolean {
    const alert = this.criticalAlerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;

    return true;
  }

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(): CriticalAlert[] {
    return this.criticalAlerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 100): CriticalAlert[] {
    return this.criticalAlerts.slice(-limit);
  }

  /**
   * Get report history
   */
  getReportHistory(limit: number = 20): ReportHistory {
    const reports = this.reportHistory.slice(-limit);
    return {
      reports,
      totalReports: this.reportHistory.length,
      lastGenerated: reports.length > 0 ? reports[reports.length - 1].generatedAt : undefined
    };
  }

  /**
   * Get a specific report by ID
   */
  getReport(reportId: string): PhoenixReport | undefined {
    return this.reportHistory.find(r => r.id === reportId);
  }

  /**
   * Get integrity trend data
   */
  getIntegrityTrend(days: number = 30): { timestamp: Date; score: number }[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.integrityHistory.filter(h => h.timestamp >= cutoff);
  }

  /**
   * Generate a quick summary (for dashboard)
   */
  async generateQuickSummary(userId: number): Promise<{
    integrityScore: number;
    trend: string;
    unresolvedAlerts: number;
    recentActions: number;
    lastReportDate?: Date;
  }> {
    const arbitrator = getArbitrator();
    const actionEngine = getActionEngine();

    const arbitrationStats = arbitrator.getStats();
    const actionStats = actionEngine.getStats();

    const integrity = this.calculateIntegrityScore(arbitrationStats, actionStats);

    return {
      integrityScore: integrity.overall,
      trend: integrity.trend,
      unresolvedAlerts: this.getUnresolvedAlerts().length,
      recentActions: actionStats.totalTasks,
      lastReportDate: this.reportHistory.length > 0 
        ? this.reportHistory[this.reportHistory.length - 1].generatedAt 
        : undefined
    };
  }

  /**
   * Log report generation
   */
  private async logReportGeneration(report: PhoenixReport): Promise<void> {
    try {
      const { logAdminAction } = await import('../db');
      
      await logAdminAction({
        adminId: report.generatedBy,
        action: 'report_generated' as any,
        resourceType: 'report',
        resourceId: parseInt(report.id.split('-')[1]) || 0,
        changes: {
          reportId: report.id,
          period: report.period,
          integrityScore: report.integrityScore.overall
        }
      });
    } catch (error) {
      console.warn('[Reporter] Failed to log report generation:', error);
    }
  }
}

// Singleton instance
let reporterInstance: PhoenixReporter | null = null;

export function getReporter(): PhoenixReporter {
  if (!reporterInstance) {
    reporterInstance = new PhoenixReporter();
  }
  return reporterInstance;
}

export { PhoenixReporter };
