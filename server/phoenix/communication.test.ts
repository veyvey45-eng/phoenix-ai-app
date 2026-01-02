/**
 * Tests for Module 07: Communication & Interface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PhoenixCommunication,
  getCommunication,
  resetCommunication,
  UserRole,
  PriorityLevel
} from './communication';

// Mock the notification module
vi.mock('../_core/notification', () => ({
  notifyOwner: vi.fn().mockResolvedValue(true)
}));

describe('Module 07: Communication & Interface', () => {
  let comms: PhoenixCommunication;

  beforeEach(() => {
    resetCommunication();
    comms = new PhoenixCommunication();
  });

  describe('Message Formatting', () => {
    it('should format admin messages with H0 priority as critical alerts', () => {
      const message = comms.formatMessage('System failure detected', 'admin', 'H0');
      expect(message.content).toContain('⚠️ ALERTE CRITIQUE PHOENIX');
      expect(message.content).toContain('System failure detected');
      expect(message.priority).toBe('H0');
      expect(message.role).toBe('admin');
    });

    it('should format admin messages with H1 priority as alerts', () => {
      const message = comms.formatMessage('Warning detected', 'admin', 'H1');
      expect(message.content).toContain('🔔 ALERTE PHOENIX');
      expect(message.content).toContain('Warning detected');
    });

    it('should format viewer messages as read-only notes', () => {
      const message = comms.formatMessage('Information', 'viewer', 'H3');
      expect(message.content).toContain('📖 Note (Lecture seule)');
    });

    it('should format user messages with standard prefix', () => {
      const message = comms.formatMessage('Hello', 'user', 'H3');
      expect(message.content).toContain('Phoenix :');
    });

    it('should include axiom reference when provided', () => {
      const message = comms.formatMessage('Decision made', 'admin', 'H2', {
        axiomReference: 'A1'
      });
      expect(message.content).toContain('[Axiome A1');
      expect(message.content).toContain('Transparence');
    });

    it('should include confidence and torment scores when provided', () => {
      const message = comms.formatMessage('Decision', 'admin', 'H2', {
        confidenceScore: 0.85,
        tormentScore: 0.3
      });
      expect(message.content).toContain('Confiance: 85.0%');
      expect(message.content).toContain('Tourment: 30.0%');
    });

    it('should update stats when formatting messages', () => {
      comms.formatMessage('Test', 'admin', 'H3');
      comms.formatMessage('Test', 'user', 'H3');
      comms.formatMessage('Test', 'viewer', 'H3');

      const stats = comms.getStats();
      expect(stats.totalMessages).toBe(3);
      expect(stats.adminAlerts).toBe(1);
      expect(stats.userMessages).toBe(1);
      expect(stats.viewerMessages).toBe(1);
    });
  });

  describe('Notifications', () => {
    it('should send notifications and store them', async () => {
      const notif = await comms.sendNotification('info', 'Test message', 'H3');
      expect(notif.id).toBeDefined();
      expect(notif.message).toBe('Test message');
      expect(notif.priority).toBe('H3');
      expect(notif.read).toBe(false);
    });

    it('should set critical alert level for H0 notifications', async () => {
      await comms.sendNotification('alert', 'Critical issue', 'H0');
      expect(comms.getAlertLevel()).toBe('critical');
    });

    it('should set elevated alert level for H1 notifications', async () => {
      await comms.sendNotification('warning', 'High priority', 'H1');
      expect(comms.getAlertLevel()).toBe('elevated');
    });

    it('should filter notifications by role', async () => {
      await comms.sendNotification('info', 'For all', 'H3', 'all');
      await comms.sendNotification('alert', 'Admin only', 'H1', 'admin');
      await comms.sendNotification('info', 'User only', 'H3', 'user');

      const adminNotifs = comms.getNotifications('admin');
      const userNotifs = comms.getNotifications('user');

      // Admin sees all (1) + admin-only (1) = 2
      expect(adminNotifs.length).toBe(2);
      // User sees all (1) + user-only (1) = 2
      expect(userNotifs.length).toBe(2);
    });

    it('should mark notifications as read', async () => {
      const notif = await comms.sendNotification('info', 'Test', 'H3');
      expect(comms.getStats().pendingNotifications).toBe(1);

      comms.markAsRead(notif.id);
      expect(comms.getStats().pendingNotifications).toBe(0);
    });

    it('should mark all notifications as read for a role', async () => {
      await comms.sendNotification('info', 'Test 1', 'H3', 'all');
      await comms.sendNotification('info', 'Test 2', 'H3', 'all');
      await comms.sendNotification('info', 'Test 3', 'H3', 'all');

      const count = comms.markAllAsRead('admin');
      expect(count).toBe(3);
      expect(comms.getStats().pendingNotifications).toBe(0);
    });

    it('should sort notifications by priority then date', async () => {
      await comms.sendNotification('info', 'Low', 'H3');
      await comms.sendNotification('alert', 'High', 'H1');
      await comms.sendNotification('warning', 'Medium', 'H2');

      const notifs = comms.getNotifications('admin');
      expect(notifs[0].priority).toBe('H1');
      expect(notifs[1].priority).toBe('H2');
      expect(notifs[2].priority).toBe('H3');
    });
  });

  describe('Approval Requests', () => {
    it('should create approval request notifications', async () => {
      const notif = await comms.requestApproval(
        'Delete user data',
        'User requested account deletion',
        'H1'
      );

      expect(notif.type).toBe('approval_request');
      expect(notif.actionRequired).toBe(true);
      expect(notif.targetRole).toBe('admin');
      expect(notif.message).toContain('Delete user data');
    });
  });

  describe('Decision Justification', () => {
    it('should generate decision justification with axioms', () => {
      const justification = comms.justifyDecision(
        'Approved user request',
        ['A1', 'A7', 'A12'],
        0.9,
        0.2
      );

      expect(justification).toContain('Approved user request');
      expect(justification).toContain('A1');
      expect(justification).toContain('A7');
      expect(justification).toContain('A12');
      expect(justification).toContain('90.0%');
      expect(justification).toContain('20.0%');
    });
  });

  describe('Content Filtering', () => {
    it('should not filter content for admin role', () => {
      const content = {
        data: 'public',
        internalConfig: 'secret',
        moduleSecrets: 'hidden'
      };

      const filtered = comms.filterContentForRole(content, 'admin');
      expect(filtered.internalConfig).toBe('secret');
      expect(filtered.moduleSecrets).toBe('hidden');
    });

    it('should filter sensitive fields for non-admin roles', () => {
      const content = {
        data: 'public',
        internalConfig: 'secret',
        moduleSecrets: 'hidden',
        shadowCode: 'forbidden'
      };

      const filtered = comms.filterContentForRole(content, 'user');
      expect(filtered.data).toBe('public');
      expect(filtered.internalConfig).toBeUndefined();
      expect(filtered.moduleSecrets).toBeUndefined();
      expect(filtered.shadowCode).toBeUndefined();
    });

    it('should handle nested objects', () => {
      const content = {
        level1: {
          data: 'visible',
          internalConfig: 'hidden'
        }
      };

      const filtered = comms.filterContentForRole(content, 'user');
      expect(filtered.level1.data).toBe('visible');
      expect(filtered.level1.internalConfig).toBeUndefined();
    });
  });

  describe('Alert Level Management', () => {
    it('should start with standard alert level', () => {
      expect(comms.getAlertLevel()).toBe('standard');
    });

    it('should reset alert level', async () => {
      await comms.sendNotification('alert', 'Critical', 'H0');
      expect(comms.getAlertLevel()).toBe('critical');

      comms.resetAlertLevel();
      expect(comms.getAlertLevel()).toBe('standard');
    });
  });

  describe('Message History', () => {
    it('should store message history', () => {
      comms.formatMessage('Message 1', 'admin', 'H3');
      comms.formatMessage('Message 2', 'user', 'H2');
      comms.formatMessage('Message 3', 'viewer', 'H1');

      const history = comms.getMessageHistory(10);
      expect(history.length).toBe(3);
    });

    it('should filter history by role', () => {
      comms.formatMessage('Admin msg', 'admin', 'H3');
      comms.formatMessage('User msg', 'user', 'H3');
      comms.formatMessage('Viewer msg', 'viewer', 'H3');

      const adminHistory = comms.getMessageHistory(10, 'admin');
      expect(adminHistory.length).toBe(1);
      expect(adminHistory[0].role).toBe('admin');
    });

    it('should limit history results', () => {
      for (let i = 0; i < 20; i++) {
        comms.formatMessage(`Message ${i}`, 'user', 'H3');
      }

      const history = comms.getMessageHistory(5);
      expect(history.length).toBe(5);
    });
  });

  describe('Axiom Descriptions', () => {
    it('should return all 16 axiom descriptions', () => {
      const descriptions = comms.getAxiomDescriptions();
      expect(Object.keys(descriptions).length).toBe(16);
      expect(descriptions['A1']).toBeDefined();
      expect(descriptions['A16']).toBeDefined();
    });
  });

  describe('Expired Notifications', () => {
    it('should clear expired notifications', async () => {
      // Create notification that expires immediately
      await comms.sendNotification('info', 'Expiring', 'H3', 'all', {
        expiresIn: -1 // Already expired
      });

      const cleared = comms.clearExpiredNotifications();
      expect(cleared).toBe(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getCommunication', () => {
      const instance1 = getCommunication();
      const instance2 = getCommunication();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetCommunication', () => {
      const instance1 = getCommunication();
      instance1.formatMessage('Test', 'admin', 'H3');

      resetCommunication();
      const instance2 = getCommunication();

      expect(instance2.getStats().totalMessages).toBe(0);
    });
  });
});
