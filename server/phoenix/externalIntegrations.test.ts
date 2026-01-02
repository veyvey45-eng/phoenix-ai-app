/**
 * Tests unitaires pour les Modules 18-24: Intégrations Externes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calendarIntegration,
  crmIntegration,
  ecommerceIntegration,
  analyticsIntegration,
  mediaGenerationIntegration,
  chatOpsIntegration,
  dataAPIIntegration
} from './externalIntegrations';

describe('Modules 18-24: Intégrations Externes', () => {
  // ========================================================================
  // Module 18: Calendar Integration
  // ========================================================================

  describe('Module 18: Calendar Integration', () => {
    it('devrait créer un événement', async () => {
      const event = await calendarIntegration.createEvent({
        title: 'Réunion Phoenix',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        description: 'Réunion de planification',
        attendees: ['user1@example.com'],
        location: 'Salle 1'
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.title).toBe('Réunion Phoenix');
    });

    it('devrait récupérer les événements', async () => {
      await calendarIntegration.createEvent({
        title: 'Événement 1',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        description: 'Test',
        attendees: [],
        location: 'Salle 1'
      });

      const events = await calendarIntegration.getEvents('user-123');
      expect(events.length).toBeGreaterThan(0);
    });

    it('devrait mettre à jour un événement', async () => {
      const event = await calendarIntegration.createEvent({
        title: 'Événement Original',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        description: 'Test',
        attendees: [],
        location: 'Salle 1'
      });

      const updated = await calendarIntegration.updateEvent(event.id, {
        title: 'Événement Modifié'
      });

      expect(updated?.title).toBe('Événement Modifié');
    });

    it('devrait supprimer un événement', async () => {
      const event = await calendarIntegration.createEvent({
        title: 'À Supprimer',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        description: 'Test',
        attendees: [],
        location: 'Salle 1'
      });

      const deleted = await calendarIntegration.deleteEvent(event.id);
      expect(deleted).toBe(true);
    });
  });

  // ========================================================================
  // Module 19: CRM Integration
  // ========================================================================

  describe('Module 19: CRM Integration', () => {
    it('devrait créer un contact', async () => {
      const contact = await crmIntegration.createContact({
        name: 'Jean Dupont',
        email: 'jean@example.com',
        phone: '+33123456789',
        company: 'TechCorp',
        lastInteraction: Date.now(),
        tags: ['vip', 'prospect']
      });

      expect(contact).toBeDefined();
      expect(contact.id).toBeDefined();
      expect(contact.name).toBe('Jean Dupont');
    });

    it('devrait rechercher des contacts', async () => {
      await crmIntegration.createContact({
        name: 'Alice Martin',
        email: 'alice@example.com',
        phone: '+33987654321',
        company: 'StartupXYZ',
        lastInteraction: Date.now(),
        tags: []
      });

      const results = await crmIntegration.searchContacts('Alice');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Alice');
    });

    it('devrait mettre à jour un contact', async () => {
      const contact = await crmIntegration.createContact({
        name: 'Bob',
        email: 'bob@example.com',
        phone: '+33111111111',
        company: 'Company',
        lastInteraction: Date.now(),
        tags: []
      });

      const updated = await crmIntegration.updateContact(contact.id, {
        company: 'NewCompany'
      });

      expect(updated?.company).toBe('NewCompany');
      expect(updated?.lastInteraction).toBeGreaterThanOrEqual(contact.lastInteraction);
    });
  });

  // ========================================================================
  // Module 20: E-commerce Integration
  // ========================================================================

  describe('Module 20: E-commerce Integration', () => {
    it('devrait créer une commande', async () => {
      const order = await ecommerceIntegration.createOrder('user-123', [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 }
      ]);

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.userId).toBe('user-123');
      expect(order.status).toBe('pending');
    });

    it('devrait récupérer les commandes d\'un utilisateur', async () => {
      await ecommerceIntegration.createOrder('user-456', [
        { productId: 'prod-1', quantity: 1 }
      ]);

      const orders = await ecommerceIntegration.getOrders('user-456');
      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0].userId).toBe('user-456');
    });

    it('devrait calculer le prix total de la commande', async () => {
      const order = await ecommerceIntegration.createOrder('user-789', [
        { productId: 'prod-1', quantity: 1 }
      ]);

      expect(order.totalPrice).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Module 21: Analytics Integration
  // ========================================================================

  describe('Module 21: Analytics Integration', () => {
    it('devrait tracker un événement', async () => {
      await analyticsIntegration.trackEvent('page_view', 1, {
        page: '/dashboard',
        userId: 'user-123'
      });

      const metrics = await analyticsIntegration.getMetrics('page_view', 0, Date.now() + 10000);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('devrait retourner les métriques agrégées', async () => {
      await analyticsIntegration.trackEvent('click', 1);
      await analyticsIntegration.trackEvent('click', 2);
      await analyticsIntegration.trackEvent('click', 3);

      const aggregated = await analyticsIntegration.getAggregatedMetrics('click');
      expect(aggregated.count).toBeGreaterThan(0);
      expect(aggregated.total).toBeGreaterThan(0);
      expect(aggregated.average).toBeGreaterThan(0);
    });

    it('devrait calculer min et max', async () => {
      await analyticsIntegration.trackEvent('response_time', 100);
      await analyticsIntegration.trackEvent('response_time', 200);
      await analyticsIntegration.trackEvent('response_time', 150);

      const aggregated = await analyticsIntegration.getAggregatedMetrics('response_time');
      expect(aggregated.min).toBeLessThanOrEqual(aggregated.max);
    });
  });

  // ========================================================================
  // Module 22: Media Generation Integration
  // ========================================================================

  describe('Module 22: Media Generation Integration', () => {
    it('devrait générer une image avec DALL-E', async () => {
      const image = await mediaGenerationIntegration.generateImage(
        'Un phénix doré se levant du feu',
        'dall-e'
      );

      expect(image).toBeDefined();
      expect(image.id).toBeDefined();
      expect(image.prompt).toBe('Un phénix doré se levant du feu');
      expect(image.model).toBe('dall-e');
      expect(image.url).toBeDefined();
    });

    it('devrait générer une image avec Midjourney', async () => {
      const image = await mediaGenerationIntegration.generateImage(
        'Paysage futuriste',
        'midjourney'
      );

      expect(image.model).toBe('midjourney');
    });

    it('devrait récupérer une image générée', async () => {
      const generated = await mediaGenerationIntegration.generateImage('Test');
      const retrieved = await mediaGenerationIntegration.getImage(generated.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(generated.id);
    });

    it('devrait supprimer une image', async () => {
      const image = await mediaGenerationIntegration.generateImage('À Supprimer');
      const deleted = await mediaGenerationIntegration.deleteImage(image.id);

      expect(deleted).toBe(true);
    });
  });

  // ========================================================================
  // Module 23: ChatOps Integration
  // ========================================================================

  describe('Module 23: ChatOps Integration', () => {
    it('devrait créer un canal', async () => {
      await chatOpsIntegration.createChannel('phoenix-team');
      // Pas d'erreur = succès
      expect(true).toBe(true);
    });

    it('devrait envoyer un message', async () => {
      await chatOpsIntegration.createChannel('general');
      const message = await chatOpsIntegration.sendMessage(
        'general',
        'user-123',
        'Bonjour Phoenix!'
      );

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.text).toBe('Bonjour Phoenix!');
    });

    it('devrait récupérer les messages d\'un canal', async () => {
      await chatOpsIntegration.createChannel('dev');
      await chatOpsIntegration.sendMessage('dev', 'user-1', 'Message 1');
      await chatOpsIntegration.sendMessage('dev', 'user-2', 'Message 2');

      const messages = await chatOpsIntegration.getMessages('dev');
      expect(messages.length).toBeGreaterThan(0);
    });

    it('devrait ajouter une réaction', async () => {
      await chatOpsIntegration.createChannel('reactions');
      const message = await chatOpsIntegration.sendMessage('reactions', 'user-1', 'Test');
      const updated = await chatOpsIntegration.addReaction(message.id, '👍');

      expect(updated?.reactions['👍']).toBe(1);
    });
  });

  // ========================================================================
  // Module 24: Data API Integration
  // ========================================================================

  describe('Module 24: Data API Integration', () => {
    it('devrait enregistrer une source de données', async () => {
      const source = await dataAPIIntegration.registerDataSource(
        'Google Analytics',
        'analytics',
        'https://www.googleapis.com/analytics/v3/data'
      );

      expect(source).toBeDefined();
      expect(source.id).toBeDefined();
      expect(source.name).toBe('Google Analytics');
      expect(source.status).toBe('active');
    });

    it('devrait récupérer les sources de données', async () => {
      await dataAPIIntegration.registerDataSource('Source 1', 'type1', 'endpoint1');
      await dataAPIIntegration.registerDataSource('Source 2', 'type2', 'endpoint2');

      const sources = await dataAPIIntegration.getDataSources();
      expect(sources.length).toBeGreaterThan(0);
    });

    it('devrait récupérer les données d\'une source', async () => {
      const source = await dataAPIIntegration.registerDataSource(
        'Test Source',
        'test',
        'https://example.com/api'
      );

      const data = await dataAPIIntegration.fetchData(source.id);
      expect(data).toBeDefined();
    });

    it('devrait mettre à jour le statut d\'une source', async () => {
      const source = await dataAPIIntegration.registerDataSource(
        'Source à Mettre à Jour',
        'test',
        'https://example.com'
      );

      const updated = await dataAPIIntegration.updateDataSourceStatus(source.id, 'inactive');
      expect(updated?.status).toBe('inactive');
    });

    it('devrait mettre en cache les données', async () => {
      const source = await dataAPIIntegration.registerDataSource(
        'Cache Test',
        'test',
        'https://example.com'
      );

      const data1 = await dataAPIIntegration.fetchData(source.id);
      const data2 = await dataAPIIntegration.fetchData(source.id);

      expect(data1).toEqual(data2);
    });
  });

  // ========================================================================
  // Tests d'intégration croisée
  // ========================================================================

  describe('Intégration croisée des modules', () => {
    it('devrait fonctionner ensemble', async () => {
      // Créer un contact CRM
      const contact = await crmIntegration.createContact({
        name: 'Client VIP',
        email: 'vip@example.com',
        phone: '+33123456789',
        company: 'BigCorp',
        lastInteraction: Date.now(),
        tags: ['vip']
      });

      // Créer une commande e-commerce
      const order = await ecommerceIntegration.createOrder(contact.id, [
        { productId: 'prod-premium', quantity: 1 }
      ]);

      // Tracker l'événement
      await analyticsIntegration.trackEvent('vip_purchase', 1, {
        contactId: contact.id,
        orderId: order.id
      });

      // Envoyer un message ChatOps
      await chatOpsIntegration.createChannel('sales');
      await chatOpsIntegration.sendMessage('sales', 'bot', `Nouvelle commande VIP: ${order.id}`);

      expect(contact).toBeDefined();
      expect(order).toBeDefined();
    });
  });
});
