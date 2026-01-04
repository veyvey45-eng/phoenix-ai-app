/**
 * Advanced Monitoring - Monitoring et métriques avancées
 * 
 * Collecte:
 * - Métriques de performance
 * - Erreurs et exceptions
 * - Utilisation des ressources
 * - Analytics d'utilisation
 * - Alertes
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface ExecutionMetric {
  executionId: string;
  duration: number;
  success: boolean;
  errorRate: number;
  memoryUsed: number;
  cpuUsed: number;
  timestamp: number;
}

export interface ErrorMetric {
  errorId: string;
  errorType: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context?: Record<string, any>;
}

export interface ResourceMetric {
  timestamp: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
}

export interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface Alert {
  alertId: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
}

export interface MonitoringDashboard {
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: PerformanceMetric[];
  errors: ErrorMetric[];
  resources: ResourceMetric[];
  events: AnalyticsEvent[];
  alerts: Alert[];
  summary: {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorCount: number;
    alertCount: number;
  };
}

class AdvancedMonitoring {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private errors: ErrorMetric[] = [];
  private resources: ResourceMetric[] = [];
  private events: AnalyticsEvent[] = [];
  private alerts: Alert[] = [];
  private maxHistorySize: number = 10000;

  constructor() {
    console.log('[AdvancedMonitoring] Initialized');
    this.startResourceMonitoring();
  }

  /**
   * Enregistre une métrique de performance
   */
  recordMetric(metric: PerformanceMetric): void {
    try {
      const key = metric.name;
      if (!this.metrics.has(key)) {
        this.metrics.set(key, []);
      }

      const list = this.metrics.get(key)!;
      list.push(metric);

      // Limiter la taille de l'historique
      if (list.length > this.maxHistorySize) {
        list.shift();
      }

      console.log(`[AdvancedMonitoring] Metric recorded: ${metric.name} = ${metric.value}${metric.unit}`);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error recording metric:', error);
    }
  }

  /**
   * Enregistre une erreur
   */
  recordError(error: ErrorMetric): void {
    try {
      this.errors.push(error);

      if (this.errors.length > this.maxHistorySize) {
        this.errors.shift();
      }

      // Créer une alerte si l'erreur est critique
      if (error.severity === 'critical' || error.severity === 'high') {
        this.createAlert({
          alertId: `alert-${Date.now()}`,
          severity: error.severity === 'critical' ? 'critical' : 'error',
          message: `Error: ${error.message}`,
          metric: error.errorType,
          threshold: 0,
          currentValue: 1,
          timestamp: error.timestamp,
          resolved: false
        });
      }

      console.log(`[AdvancedMonitoring] Error recorded: ${error.errorType} - ${error.message}`);
    } catch (err) {
      console.error('[AdvancedMonitoring] Error recording error:', err);
    }
  }

  /**
   * Enregistre une métrique d'exécution
   */
  recordExecution(metric: ExecutionMetric): void {
    try {
      this.recordMetric({
        name: 'execution_duration',
        value: metric.duration,
        unit: 'ms',
        timestamp: metric.timestamp,
        tags: {
          success: String(metric.success),
          executionId: metric.executionId
        }
      });

      this.recordMetric({
        name: 'memory_used',
        value: metric.memoryUsed,
        unit: 'MB',
        timestamp: metric.timestamp,
        tags: { executionId: metric.executionId }
      });

      this.recordMetric({
        name: 'cpu_used',
        value: metric.cpuUsed,
        unit: '%',
        timestamp: metric.timestamp,
        tags: { executionId: metric.executionId }
      });

      console.log(`[AdvancedMonitoring] Execution recorded: ${metric.duration}ms, success=${metric.success}`);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error recording execution:', error);
    }
  }

  /**
   * Enregistre un événement d'analytics
   */
  recordEvent(event: AnalyticsEvent): void {
    try {
      this.events.push(event);

      if (this.events.length > this.maxHistorySize) {
        this.events.shift();
      }

      console.log(`[AdvancedMonitoring] Event recorded: ${event.eventType}`);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error recording event:', error);
    }
  }

  /**
   * Crée une alerte
   */
  createAlert(alert: Alert): void {
    try {
      this.alerts.push(alert);

      if (this.alerts.length > this.maxHistorySize) {
        this.alerts.shift();
      }

      console.log(`[AdvancedMonitoring] Alert created: ${alert.severity} - ${alert.message}`);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error creating alert:', error);
    }
  }

  /**
   * Résout une alerte
   */
  resolveAlert(alertId: string): void {
    try {
      const alert = this.alerts.find(a => a.alertId === alertId);
      if (alert) {
        alert.resolved = true;
        console.log(`[AdvancedMonitoring] Alert resolved: ${alertId}`);
      }
    } catch (error) {
      console.error('[AdvancedMonitoring] Error resolving alert:', error);
    }
  }

  /**
   * Obtient les métriques pour une période donnée
   */
  getMetrics(name: string, period: number = 3600000): PerformanceMetric[] {
    try {
      const now = Date.now();
      const metrics = this.metrics.get(name) || [];
      return metrics.filter(m => m.timestamp >= now - period);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error getting metrics:', error);
      return [];
    }
  }

  /**
   * Obtient les erreurs pour une période donnée
   */
  getErrors(period: number = 3600000): ErrorMetric[] {
    try {
      const now = Date.now();
      return this.errors.filter(e => e.timestamp >= now - period);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error getting errors:', error);
      return [];
    }
  }

  /**
   * Obtient les alertes non résolues
   */
  getUnresolvedAlerts(): Alert[] {
    try {
      return this.alerts.filter(a => !a.resolved);
    } catch (error) {
      console.error('[AdvancedMonitoring] Error getting alerts:', error);
      return [];
    }
  }

  /**
   * Obtient le dashboard de monitoring
   */
  getDashboard(period: 'hour' | 'day' | 'week' | 'month' = 'hour'): MonitoringDashboard {
    try {
      const periodMs = this.getPeriodMs(period);
      const now = Date.now();

      const metrics: PerformanceMetric[] = [];
      this.metrics.forEach(list => {
        metrics.push(...list.filter(m => m.timestamp >= now - periodMs));
      });

      const errors = this.errors.filter(e => e.timestamp >= now - periodMs);
      const resources = this.resources.filter(r => r.timestamp >= now - periodMs);
      const events = this.events.filter(e => e.timestamp >= now - periodMs);
      const alerts = this.alerts.filter(a => a.timestamp >= now - periodMs);

      // Calculer les statistiques
      const executionMetrics = metrics.filter(m => m.name === 'execution_duration');
      const successCount = executionMetrics.filter(m => m.tags?.success === 'true').length;
      const totalExecutions = executionMetrics.length;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
      const averageDuration = executionMetrics.length > 0
        ? executionMetrics.reduce((sum, m) => sum + m.value, 0) / executionMetrics.length
        : 0;

      return {
        period,
        metrics,
        errors,
        resources,
        events,
        alerts,
        summary: {
          totalExecutions,
          successRate,
          averageDuration,
          errorCount: errors.length,
          alertCount: alerts.filter(a => !a.resolved).length
        }
      };
    } catch (error) {
      console.error('[AdvancedMonitoring] Error getting dashboard:', error);
      return {
        period,
        metrics: [],
        errors: [],
        resources: [],
        events: [],
        alerts: [],
        summary: {
          totalExecutions: 0,
          successRate: 0,
          averageDuration: 0,
          errorCount: 0,
          alertCount: 0
        }
      };
    }
  }

  /**
   * Démarre le monitoring des ressources
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      try {
        const metric: ResourceMetric = {
          timestamp: Date.now(),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpuUsage: 0, // À implémenter avec os.cpus()
          diskUsage: 0, // À implémenter
          networkIn: 0, // À implémenter
          networkOut: 0 // À implémenter
        };

        this.resources.push(metric);

        if (this.resources.length > this.maxHistorySize) {
          this.resources.shift();
        }

        // Vérifier les seuils d'alerte
        if (metric.memoryUsage > 1024) { // 1GB
          this.createAlert({
            alertId: `alert-${Date.now()}`,
            severity: 'warning',
            message: `High memory usage: ${metric.memoryUsage.toFixed(2)}MB`,
            metric: 'memory_usage',
            threshold: 1024,
            currentValue: metric.memoryUsage,
            timestamp: metric.timestamp,
            resolved: false
          });
        }
      } catch (error) {
        console.error('[AdvancedMonitoring] Error in resource monitoring:', error);
      }
    }, 60000); // Toutes les minutes
  }

  /**
   * Convertit une période en millisecondes
   */
  private getPeriodMs(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour':
        return 3600000;
      case 'day':
        return 86400000;
      case 'week':
        return 604800000;
      case 'month':
        return 2592000000;
      default:
        return 3600000;
    }
  }
}

/**
 * Singleton global
 */
let instance: AdvancedMonitoring;

export function getAdvancedMonitoring(): AdvancedMonitoring {
  if (!instance) {
    instance = new AdvancedMonitoring();
  }
  return instance;
}
