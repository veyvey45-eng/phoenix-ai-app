/**
 * E2B Webhook Manager - Gestion des webhooks asynchrones
 */

import { randomUUID } from 'crypto';

export interface WebhookEvent {
  id: string;
  userId: number;
  executionId: string;
  eventType: 'execution_started' | 'execution_completed' | 'execution_failed' | 'timeout';
  payload: Record<string, any>;
  timestamp: Date;
}

export interface WebhookSubscription {
  id: string;
  userId: number;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: 'pending' | 'delivered' | 'failed';
  retries: number;
  maxRetries: number;
  nextRetryAt?: Date;
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

export class E2BWebhookManager {
  private events: Map<string, WebhookEvent> = new Map();
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private userSubscriptions: Map<number, string[]> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('[E2BWebhookManager] Initialized');
    this.startProcessing();
  }

  /**
   * Créer une souscription webhook
   */
  createSubscription(userId: number, url: string, events: string[]): WebhookSubscription {
    const id = randomUUID();
    const subscription: WebhookSubscription = {
      id,
      userId,
      url,
      events,
      active: true,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, subscription);

    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, []);
    }
    this.userSubscriptions.get(userId)!.push(id);

    console.log('[E2BWebhookManager] Subscription created:', {
      id,
      userId,
      url,
      events,
    });

    return subscription;
  }

  /**
   * Obtenir les souscriptions d'un utilisateur
   */
  getSubscriptions(userId: number): WebhookSubscription[] {
    const subscriptionIds = this.userSubscriptions.get(userId) || [];
    return subscriptionIds
      .map(id => this.subscriptions.get(id)!)
      .filter(s => s !== undefined);
  }

  /**
   * Supprimer une souscription
   */
  deleteSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.subscriptions.delete(subscriptionId);

    const userSubs = this.userSubscriptions.get(subscription.userId) || [];
    const index = userSubs.indexOf(subscriptionId);
    if (index > -1) {
      userSubs.splice(index, 1);
    }

    console.log('[E2BWebhookManager] Subscription deleted:', subscriptionId);
    return true;
  }

  /**
   * Déclencher un événement webhook
   */
  triggerEvent(
    userId: number,
    executionId: string,
    eventType: 'execution_started' | 'execution_completed' | 'execution_failed' | 'timeout',
    payload: Record<string, any>
  ): WebhookEvent {
    const id = randomUUID();
    const event: WebhookEvent = {
      id,
      userId,
      executionId,
      eventType,
      payload,
      timestamp: new Date(),
    };

    this.events.set(id, event);
    this.eventQueue.push(event);

    console.log('[E2BWebhookManager] Event triggered:', {
      id,
      userId,
      eventType,
    });

    return event;
  }

  /**
   * Obtenir l'historique des événements
   */
  getEventHistory(userId: number, limit: number = 50): WebhookEvent[] {
    const allEvents = Array.from(this.events.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return allEvents.slice(0, limit);
  }

  /**
   * Démarrer le traitement des événements
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 5000); // Traiter toutes les 5 secondes
  }

  /**
   * Arrêter le traitement
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Traiter la file d'attente des événements
   */
  private async processEventQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) break;

      await this.deliverEvent(event);
    }
  }

  /**
   * Livrer un événement aux webhooks
   */
  private async deliverEvent(event: WebhookEvent): Promise<void> {
    const subscriptions = this.getSubscriptions(event.userId);

    for (const subscription of subscriptions) {
      if (!subscription.active) continue;
      if (!subscription.events.includes(event.eventType)) continue;

      // Créer une livraison
      const deliveryId = randomUUID();
      const delivery: WebhookDelivery = {
        id: deliveryId,
        webhookId: subscription.id,
        eventId: event.id,
        status: 'pending',
        retries: 0,
        maxRetries: 3,
        createdAt: new Date(),
      };

      this.deliveries.set(deliveryId, delivery);

      // Essayer de livrer
      await this.attemptDelivery(delivery, subscription, event);
    }
  }

  /**
   * Essayer de livrer un événement
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    subscription: WebhookSubscription,
    event: WebhookEvent
  ): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event.eventType,
          'X-Webhook-ID': event.id,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        subscription.lastTriggeredAt = new Date();

        console.log('[E2BWebhookManager] Webhook delivered:', {
          deliveryId: delivery.id,
          webhookId: subscription.id,
          eventType: event.eventType,
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      delivery.retries++;

      if (delivery.retries < delivery.maxRetries) {
        // Planifier une nouvelle tentative
        const backoffMs = Math.pow(2, delivery.retries) * 1000;
        delivery.nextRetryAt = new Date(Date.now() + backoffMs);
        delivery.status = 'pending';

        console.log('[E2BWebhookManager] Webhook delivery failed, retrying:', {
          deliveryId: delivery.id,
          retries: delivery.retries,
          nextRetryAt: delivery.nextRetryAt,
        });

        // Remettre en queue après le délai
        setTimeout(() => {
          this.eventQueue.push(event);
        }, backoffMs);
      } else {
        delivery.status = 'failed';
        delivery.error = String(error);

        console.log('[E2BWebhookManager] Webhook delivery failed permanently:', {
          deliveryId: delivery.id,
          error: String(error),
        });
      }
    }
  }

  /**
   * Obtenir les statistiques des webhooks
   */
  getStatistics(userId: number): Record<string, any> {
    const subscriptions = this.getSubscriptions(userId);
    const events = this.getEventHistory(userId, 1000);

    const deliveries = Array.from(this.deliveries.values()).filter(d => {
      const event = this.events.get(d.eventId);
      return event && event.userId === userId;
    });

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.active).length,
      totalEvents: events.length,
      eventsByType: {
        execution_started: events.filter(e => e.eventType === 'execution_started').length,
        execution_completed: events.filter(e => e.eventType === 'execution_completed').length,
        execution_failed: events.filter(e => e.eventType === 'execution_failed').length,
        timeout: events.filter(e => e.eventType === 'timeout').length,
      },
      deliveryStats: {
        total: deliveries.length,
        delivered: deliveries.filter(d => d.status === 'delivered').length,
        failed: deliveries.filter(d => d.status === 'failed').length,
        pending: deliveries.filter(d => d.status === 'pending').length,
      },
    };
  }

  /**
   * Nettoyer les anciens événements
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.events.forEach((event, id) => {
      if (now - event.timestamp.getTime() > maxAgeMs) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.events.delete(id));

    console.log('[E2BWebhookManager] Cleanup completed:', {
      deletedEvents: toDelete.length,
    });
  }
}

// Singleton global
let webhookManager: E2BWebhookManager | null = null;

export function getE2BWebhookManager(): E2BWebhookManager {
  if (!webhookManager) {
    webhookManager = new E2BWebhookManager();
  }
  return webhookManager;
}
