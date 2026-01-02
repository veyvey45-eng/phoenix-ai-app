/**
 * Module 07: Communication & Interface - Project Phoenix
 * 
 * Gère les interactions utilisateur et les alertes Admin avec
 * formatage selon les rôles et notifications temps réel.
 */

import { notifyOwner } from '../_core/notification';

// Types
export type UserRole = 'admin' | 'user' | 'viewer';
export type AlertLevel = 'standard' | 'elevated' | 'critical';
export type PriorityLevel = 'H0' | 'H1' | 'H2' | 'H3';

export interface FormattedMessage {
  content: string;
  priority: PriorityLevel;
  role: UserRole;
  timestamp: Date;
  axiomReference?: string;
  confidenceScore?: number;
  tormentScore?: number;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'warning' | 'approval_request';
  message: string;
  priority: PriorityLevel;
  targetRole: UserRole | 'all';
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actionRequired?: boolean;
  actionUrl?: string;
}

export interface CommunicationStats {
  totalMessages: number;
  adminAlerts: number;
  userMessages: number;
  viewerMessages: number;
  pendingNotifications: number;
  criticalAlerts: number;
}

// Axiom descriptions for justification
const AXIOM_DESCRIPTIONS: Record<string, string> = {
  'A1': 'Transparence totale sur les raisonnements',
  'A2': 'Séparation réflexion/action',
  'A3': 'Génération d\'hypothèses multiples',
  'A4': 'Quantification de l\'incertitude',
  'A5': 'Conscience du tourment décisionnel',
  'A6': 'Traçabilité complète des décisions',
  'A7': 'Validation humaine pour actions critiques',
  'A8': 'Auto-évaluation continue',
  'A9': 'Apprentissage des erreurs',
  'A10': 'Respect de la hiérarchie des priorités',
  'A11': 'Protection de l\'intégrité du système',
  'A12': 'Communication adaptée au contexte',
  'A13': 'Gestion proactive des conflits',
  'A14': 'Résilience et auto-correction',
  'A15': 'Confidentialité des données sensibles',
  'A16': 'Alignement avec les objectifs du créateur'
};

/**
 * Phoenix Communication Engine
 * Gère toutes les communications entre Phoenix et les utilisateurs
 */
export class PhoenixCommunication {
  private notifications: Map<string, Notification> = new Map();
  private messageHistory: FormattedMessage[] = [];
  private alertLevel: AlertLevel = 'standard';
  private stats: CommunicationStats = {
    totalMessages: 0,
    adminAlerts: 0,
    userMessages: 0,
    viewerMessages: 0,
    pendingNotifications: 0,
    criticalAlerts: 0
  };

  /**
   * Format a message according to user role and priority
   */
  formatMessage(
    content: string,
    role: UserRole,
    priority: PriorityLevel = 'H3',
    options?: {
      axiomReference?: string;
      confidenceScore?: number;
      tormentScore?: number;
      metadata?: Record<string, unknown>;
    }
  ): FormattedMessage {
    let formattedContent = content;

    // Apply role-based formatting
    switch (role) {
      case 'admin':
        if (priority === 'H0') {
          formattedContent = `⚠️ ALERTE CRITIQUE PHOENIX : ${content}`;
        } else if (priority === 'H1') {
          formattedContent = `🔔 ALERTE PHOENIX : ${content}`;
        } else {
          formattedContent = `Phoenix (Admin) : ${content}`;
        }
        break;
      case 'viewer':
        formattedContent = `📖 Note (Lecture seule) : ${content}`;
        break;
      default:
        formattedContent = `Phoenix : ${content}`;
    }

    // Add axiom justification if provided
    if (options?.axiomReference && AXIOM_DESCRIPTIONS[options.axiomReference]) {
      formattedContent += `\n[Axiome ${options.axiomReference}: ${AXIOM_DESCRIPTIONS[options.axiomReference]}]`;
    }

    // Add confidence/torment scores if provided
    if (options?.confidenceScore !== undefined || options?.tormentScore !== undefined) {
      const scores: string[] = [];
      if (options.confidenceScore !== undefined) {
        scores.push(`Confiance: ${(options.confidenceScore * 100).toFixed(1)}%`);
      }
      if (options.tormentScore !== undefined) {
        scores.push(`Tourment: ${(options.tormentScore * 100).toFixed(1)}%`);
      }
      formattedContent += `\n[${scores.join(' | ')}]`;
    }

    const message: FormattedMessage = {
      content: formattedContent,
      priority,
      role,
      timestamp: new Date(),
      ...options
    };

    // Update stats
    this.stats.totalMessages++;
    switch (role) {
      case 'admin':
        this.stats.adminAlerts++;
        break;
      case 'user':
        this.stats.userMessages++;
        break;
      case 'viewer':
        this.stats.viewerMessages++;
        break;
    }

    // Store in history
    this.messageHistory.push(message);
    if (this.messageHistory.length > 1000) {
      this.messageHistory = this.messageHistory.slice(-500);
    }

    return message;
  }

  /**
   * Send a notification to a specific role or all users
   */
  async sendNotification(
    type: Notification['type'],
    message: string,
    priority: PriorityLevel,
    targetRole: UserRole | 'all' = 'all',
    options?: {
      actionRequired?: boolean;
      actionUrl?: string;
      expiresIn?: number; // minutes
    }
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      priority,
      targetRole,
      read: false,
      createdAt: new Date(),
      actionRequired: options?.actionRequired,
      actionUrl: options?.actionUrl
    };

    if (options?.expiresIn) {
      notification.expiresAt = new Date(Date.now() + options.expiresIn * 60 * 1000);
    }

    this.notifications.set(notification.id, notification);
    this.stats.pendingNotifications++;

    if (priority === 'H0') {
      this.stats.criticalAlerts++;
      this.alertLevel = 'critical';
      
      // Send critical alert to owner
      await notifyOwner({
        title: '⚠️ Alerte Critique Phoenix',
        content: message
      });
    } else if (priority === 'H1') {
      this.alertLevel = 'elevated';
    }

    return notification;
  }

  /**
   * Send approval request notification to Admin
   */
  async requestApproval(
    operation: string,
    reason: string,
    priority: PriorityLevel,
    approvalUrl?: string
  ): Promise<Notification> {
    const message = `Approbation requise pour: ${operation}\nRaison: ${reason}`;
    
    return this.sendNotification(
      'approval_request',
      message,
      priority,
      'admin',
      {
        actionRequired: true,
        actionUrl: approvalUrl || '/admin?tab=validations'
      }
    );
  }

  /**
   * Get notifications for a specific role
   */
  getNotifications(role: UserRole, includeRead: boolean = false): Notification[] {
    const now = new Date();
    const notifications: Notification[] = [];

    this.notifications.forEach(notif => {
      // Check if notification is for this role
      if (notif.targetRole !== 'all' && notif.targetRole !== role) {
        return;
      }

      // Check if expired
      if (notif.expiresAt && notif.expiresAt < now) {
        return;
      }

      // Check if read
      if (!includeRead && notif.read) {
        return;
      }

      // H0 alerts only for admin
      if (notif.priority === 'H0' && role !== 'admin') {
        return;
      }

      notifications.push(notif);
    });

    // Sort by priority then by date
    return notifications.sort((a, b) => {
      const priorityOrder = { H0: 0, H1: 1, H2: 2, H3: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.stats.pendingNotifications = Math.max(0, this.stats.pendingNotifications - 1);
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read for a role
   */
  markAllAsRead(role: UserRole): number {
    let count = 0;
    this.notifications.forEach(notif => {
      if ((notif.targetRole === 'all' || notif.targetRole === role) && !notif.read) {
        notif.read = true;
        count++;
      }
    });
    this.stats.pendingNotifications = Math.max(0, this.stats.pendingNotifications - count);
    return count;
  }

  /**
   * Generate decision justification with axiom reference
   */
  justifyDecision(
    decision: string,
    axioms: string[],
    confidenceScore: number,
    tormentScore: number
  ): string {
    const axiomJustifications = axioms
      .filter(a => AXIOM_DESCRIPTIONS[a])
      .map(a => `• ${a}: ${AXIOM_DESCRIPTIONS[a]}`)
      .join('\n');

    return `
📋 JUSTIFICATION DE DÉCISION PHOENIX

Décision: ${decision}

Axiomes appliqués:
${axiomJustifications}

Métriques:
• Confiance: ${(confidenceScore * 100).toFixed(1)}%
• Tourment décisionnel: ${(tormentScore * 100).toFixed(1)}%

Cette décision a été prise en conformité avec les ${axioms.length} axiome(s) ci-dessus.
`.trim();
  }

  /**
   * Filter content based on user role
   */
  filterContentForRole(content: any, role: UserRole): any {
    if (role === 'admin') {
      // Admin sees everything
      return content;
    }

    // Clone to avoid modifying original
    const filtered = JSON.parse(JSON.stringify(content));

    // Remove sensitive fields for non-admin users
    const sensitiveFields = [
      'internalConfig',
      'shadowCode',
      'moduleSecrets',
      'adminNotes',
      'securityLogs',
      'rawAxiomData'
    ];

    const removeSensitive = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(removeSensitive);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!sensitiveFields.includes(key)) {
          result[key] = removeSensitive(value);
        }
      }
      return result;
    };

    return removeSensitive(filtered);
  }

  /**
   * Get communication statistics
   */
  getStats(): CommunicationStats {
    return { ...this.stats };
  }

  /**
   * Get current alert level
   */
  getAlertLevel(): AlertLevel {
    return this.alertLevel;
  }

  /**
   * Reset alert level to standard
   */
  resetAlertLevel(): void {
    this.alertLevel = 'standard';
  }

  /**
   * Get message history
   */
  getMessageHistory(limit: number = 100, role?: UserRole): FormattedMessage[] {
    let messages = [...this.messageHistory];
    
    if (role) {
      messages = messages.filter(m => m.role === role);
    }

    return messages.slice(-limit).reverse();
  }

  /**
   * Get axiom descriptions
   */
  getAxiomDescriptions(): Record<string, string> {
    return { ...AXIOM_DESCRIPTIONS };
  }

  /**
   * Clear expired notifications
   */
  clearExpiredNotifications(): number {
    const now = new Date();
    let cleared = 0;

    this.notifications.forEach((notif, id) => {
      if (notif.expiresAt && notif.expiresAt < now) {
        this.notifications.delete(id);
        if (!notif.read) {
          this.stats.pendingNotifications = Math.max(0, this.stats.pendingNotifications - 1);
        }
        cleared++;
      }
    });

    return cleared;
  }
}

// Singleton instance
let communicationInstance: PhoenixCommunication | null = null;

export function getCommunication(): PhoenixCommunication {
  if (!communicationInstance) {
    communicationInstance = new PhoenixCommunication();
  }
  return communicationInstance;
}

export function resetCommunication(): void {
  communicationInstance = null;
}
