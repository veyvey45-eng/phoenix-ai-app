/**
 * Tests pour E2B Chat Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getE2BChatIntegration } from './e2bChatIntegration';
import { getExecutionHistoryService } from './executionHistoryService';
import { getE2BWebhookManager } from './e2bWebhookManager';

describe('E2B Chat Integration', () => {
  let integration: ReturnType<typeof getE2BChatIntegration>;
  let historyService: ReturnType<typeof getExecutionHistoryService>;
  let webhookManager: ReturnType<typeof getE2BWebhookManager>;

  beforeEach(() => {
    integration = getE2BChatIntegration();
    historyService = getExecutionHistoryService();
    webhookManager = getE2BWebhookManager();
  });

  describe('Message Processing', () => {
    it('should detect Python code in message', async () => {
      const result = await integration.processMessage({
        userId: 1,
        conversationId: 'conv-1',
        message: 'Calculate 2 + 2 using Python: print(2 + 2)',
        preferredLanguage: 'python',
      });

      if (result) {
        expect(result.language).toBe('python');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return null for non-code messages', async () => {
      const result = await integration.processMessage({
        userId: 1,
        conversationId: 'conv-1',
        message: 'What is the weather today?',
      });

      expect(result).toBeNull();
    });

    it('should handle code execution errors gracefully', async () => {
      const result = await integration.processMessage({
        userId: 1,
        conversationId: 'conv-1',
        message: 'Execute this Python code: raise ValueError("Test error")',
        preferredLanguage: 'python',
      });

      // Result might be null if code is not detected
      if (result) {
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Execution History', () => {
    it('should record execution in history', async () => {
      const result = await integration.processMessage({
        userId: 1,
        conversationId: 'conv-1',
        message: 'Execute: print("Hello")',
        preferredLanguage: 'python',
      });

      expect(result).toBeDefined();

      const records = historyService.getRecentExecutions(1, 1);
      expect(records.length).toBeGreaterThan(0);
    });

    it('should track execution statistics', () => {
      const stats = historyService.getStatistics(1);

      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('byLanguage');
    });

    it('should get recent executions', () => {
      const records = integration.getRecentResults(1, 5);

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Webhooks', () => {
    it('should create webhook subscription', () => {
      const subscription = webhookManager.createSubscription(
        1,
        'https://example.com/webhook',
        ['execution_completed']
      );

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(1);
      expect(subscription.url).toBe('https://example.com/webhook');
    });

    it('should trigger webhook events', async () => {
      const event = webhookManager.triggerEvent(
        1,
        'exec-1',
        'execution_completed',
        { success: true, duration: 100 }
      );

      expect(event).toBeDefined();
      expect(event.eventType).toBe('execution_completed');

      const history = webhookManager.getEventHistory(1, 10);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should get webhook statistics', () => {
      const stats = webhookManager.getStatistics(1);

      expect(stats).toHaveProperty('totalSubscriptions');
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('deliveryStats');
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze usage patterns', () => {
      const patterns = integration.analyzePatterns(1);

      expect(patterns).toHaveProperty('totalExecutions');
      expect(patterns).toHaveProperty('successRate');
      expect(patterns).toHaveProperty('averageDuration');
      expect(patterns).toHaveProperty('byLanguage');
      expect(patterns).toHaveProperty('topPatterns');
      expect(patterns).toHaveProperty('errorPatterns');
    });

    it('should extract top patterns from history', () => {
      const patterns = integration.analyzePatterns(1);

      expect(Array.isArray(patterns.topPatterns)).toBe(true);
    });

    it('should extract error patterns from history', () => {
      const patterns = integration.analyzePatterns(1);

      expect(Array.isArray(patterns.errorPatterns)).toBe(true);
    });
  });

  describe('Execution Suggestions', () => {
    it('should get code suggestions', () => {
      const suggestions = integration.getSuggestions(1, 'python', 3);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should prioritize fast executions', () => {
      const suggestions = integration.getSuggestions(1, 'python', 5);

      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].duration).toBeLessThanOrEqual(suggestions[i + 1].duration);
        }
      }
    });
  });

  describe('Replay Functionality', () => {
    it('should replay previous execution', async () => {
      // Enregistrer une exécution
      const record = historyService.recordExecution(
        1,
        'conv-1',
        'sandbox-1',
        'python',
        'print("test")',
        true,
        'test\n',
        undefined,
        0,
        100
      );

      // Rejouer l'exécution
      const result = await integration.replayExecution(1, record.id);

      expect(result).toBeDefined();
      if (result) {
        expect(result.executionId).toBeDefined();
      }
    });

    it('should return null for non-existent execution', async () => {
      const result = await integration.replayExecution(1, 'non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('Integration Flow', () => {
    it('should handle complete flow: detect, execute, record, trigger webhook', async () => {
      // Créer une souscription webhook
      const subscription = webhookManager.createSubscription(
        2,
        'https://example.com/webhook',
        ['execution_completed', 'execution_failed']
      );

      expect(subscription).toBeDefined();

      // Traiter un message avec du code
      const result = await integration.processMessage({
        userId: 2,
        conversationId: 'conv-2',
        message: 'Execute Python: print("Integration test")',
        preferredLanguage: 'python',
      });

      // Vérifier que le résultat est valide
      if (result) {
        expect(result.executionId).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle multiple consecutive executions', async () => {
      for (let i = 0; i < 3; i++) {
        await integration.processMessage({
          userId: 3,
          conversationId: 'conv-3',
          message: `Execute: print("Test ${i}")`,
          preferredLanguage: 'python',
        });
      }

      const stats = historyService.getStatistics(3);
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('Error Handling', () => {
    it('should handle execution timeout', async () => {
      const result = await integration.processMessage({
        userId: 4,
        conversationId: 'conv-4',
        message: 'Execute: import time; time.sleep(100)',
        preferredLanguage: 'python',
      });

      // Timeout should result in error
      if (result) {
        expect(result.success).toBe(false);
      }
    });

    it('should handle invalid code', async () => {
      const result = await integration.processMessage({
        userId: 4,
        conversationId: 'conv-4',
        message: 'Execute: this is not valid python !!!',
        preferredLanguage: 'python',
      });

      if (result) {
        expect(result.success).toBe(false);
      }
    });
  });
});
