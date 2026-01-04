/**
 * E2B Monitoring - Suivi des exécutions et métriques
 * 
 * Responsabilités:
 * - Enregistrer les exécutions
 * - Calculer les statistiques par utilisateur
 * - Tracker les erreurs
 * - Générer des rapports de performance
 */

export interface ExecutionMetric {
  timestamp: Date;
  language: 'python' | 'node' | 'shell';
  success: boolean;
  duration: number;
  error?: string;
}

export interface UserMetrics {
  userId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  totalDuration: number;
  executionsByLanguage: Record<string, number>;
  lastExecution?: Date;
  errors: Array<{
    timestamp: Date;
    language: string;
    error: string;
  }>;
}

export class E2BMonitoring {
  private metrics: Map<string, ExecutionMetric[]> = new Map();
  private maxMetricsPerUser: number = 1000;

  constructor() {
    console.log('[E2BMonitoring] Initialized');
  }

  /**
   * Enregistrer le début d'une exécution
   */
  recordExecutionStart(userId: string, language: 'python' | 'node' | 'shell'): void {
    console.log(`[E2BMonitoring] Execution started for user ${userId} (${language})`);
  }

  /**
   * Enregistrer la fin d'une exécution réussie
   */
  recordExecutionEnd(userId: string, language: 'python' | 'node' | 'shell', success: boolean, duration: number): void {
    const metric: ExecutionMetric = {
      timestamp: new Date(),
      language,
      success,
      duration,
    };

    this.addMetric(userId, metric);

    console.log(
      `[E2BMonitoring] Execution ended for user ${userId} (${language}): ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`
    );
  }

  /**
   * Enregistrer une erreur d'exécution
   */
  recordExecutionError(userId: string, language: 'python' | 'node' | 'shell', error: string): void {
    const metric: ExecutionMetric = {
      timestamp: new Date(),
      language,
      success: false,
      duration: 0,
      error,
    };

    this.addMetric(userId, metric);

    console.log(`[E2BMonitoring] Execution error for user ${userId} (${language}): ${error}`);
  }

  /**
   * Ajouter une métrique
   */
  private addMetric(userId: string, metric: ExecutionMetric): void {
    if (!this.metrics.has(userId)) {
      this.metrics.set(userId, []);
    }

    const userMetrics = this.metrics.get(userId)!;
    userMetrics.push(metric);

    // Garder seulement les dernières N métriques
    if (userMetrics.length > this.maxMetricsPerUser) {
      userMetrics.shift();
    }
  }

  /**
   * Obtenir les métriques d'un utilisateur
   */
  getUserMetrics(userId: string): UserMetrics {
    const userMetrics = this.metrics.get(userId) || [];

    const totalExecutions = userMetrics.length;
    const successfulExecutions = userMetrics.filter(m => m.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const totalDuration = userMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

    const executionsByLanguage: Record<string, number> = {};
    userMetrics.forEach(m => {
      executionsByLanguage[m.language] = (executionsByLanguage[m.language] || 0) + 1;
    });

    const errors = userMetrics
      .filter(m => m.error)
      .map(m => ({
        timestamp: m.timestamp,
        language: m.language,
        error: m.error!,
      }));

    const lastExecution = userMetrics.length > 0 ? userMetrics[userMetrics.length - 1].timestamp : undefined;

    return {
      userId,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration,
      totalDuration,
      executionsByLanguage,
      lastExecution,
      errors,
    };
  }

  /**
   * Obtenir les métriques globales
   */
  getGlobalMetrics(): Record<string, any> {
    let totalExecutions = 0;
    let totalSuccessful = 0;
    let totalDuration = 0;
    const userCount = this.metrics.size;

    this.metrics.forEach(userMetrics => {
      totalExecutions += userMetrics.length;
      totalSuccessful += userMetrics.filter(m => m.success).length;
      totalDuration += userMetrics.reduce((sum, m) => sum + m.duration, 0);
    });

    return {
      userCount,
      totalExecutions,
      totalSuccessful,
      totalFailed: totalExecutions - totalSuccessful,
      averageDuration: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      totalDuration,
      successRate: totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0,
    };
  }

  /**
   * Réinitialiser les métriques d'un utilisateur
   */
  resetUserMetrics(userId: string): void {
    this.metrics.delete(userId);
    console.log(`[E2BMonitoring] Metrics reset for user ${userId}`);
  }

  /**
   * Réinitialiser toutes les métriques
   */
  resetAllMetrics(): void {
    this.metrics.clear();
    console.log('[E2BMonitoring] All metrics reset');
  }

  /**
   * Obtenir les statistiques de performance
   */
  getPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {
      byLanguage: {},
      byUser: {},
    };

    // Statistiques par langage
    this.metrics.forEach(userMetrics => {
      userMetrics.forEach(metric => {
        if (!stats.byLanguage[metric.language]) {
          stats.byLanguage[metric.language] = {
            count: 0,
            successful: 0,
            failed: 0,
            totalDuration: 0,
            averageDuration: 0,
          };
        }

        const langStats = stats.byLanguage[metric.language];
        langStats.count++;
        if (metric.success) {
          langStats.successful++;
        } else {
          langStats.failed++;
        }
        langStats.totalDuration += metric.duration;
        langStats.averageDuration = langStats.totalDuration / langStats.count;
      });
    });

    // Statistiques par utilisateur
    this.metrics.forEach((userMetrics, userId) => {
      const userStats = this.getUserMetrics(userId);
      stats.byUser[userId] = {
        totalExecutions: userStats.totalExecutions,
        successRate: (userStats.successfulExecutions / userStats.totalExecutions) * 100,
        averageDuration: userStats.averageDuration,
        lastExecution: userStats.lastExecution,
      };
    });

    return stats;
  }
}

// Singleton global
let monitoringInstance: E2BMonitoring | null = null;

export function getE2BMonitoring(): E2BMonitoring {
  if (!monitoringInstance) {
    monitoringInstance = new E2BMonitoring();
  }
  return monitoringInstance;
}
