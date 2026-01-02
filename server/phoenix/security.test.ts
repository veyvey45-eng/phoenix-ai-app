/**
 * Tests unitaires pour le Module 09: Sécurité Avancée & Chiffrement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSecurity, PhoenixSecurity } from './security';

describe('Module 09: Security', () => {
  let security: PhoenixSecurity;

  beforeEach(() => {
    security = createSecurity();
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'Sensitive information to protect';
      const encrypted = security.encrypt(originalData);
      
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.data).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.data).not.toBe(originalData);
      
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const data = 'Same data';
      const encrypted1 = security.encrypt(data);
      const encrypted2 = security.encrypt(data);
      
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle empty strings', () => {
      const encrypted = security.encrypt('');
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const data = 'Données sensibles avec accents: éàü 日本語 🔐';
      const encrypted = security.encrypt(data);
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });
  });

  describe('Output Filtering', () => {
    it('should filter API keys', () => {
      const content = 'My api_key: sk-1234567890abcdefghijklmnop';
      const result = security.filterOutput(content);
      
      expect(result.blocked).toBe(true);
      expect(result.filtered).toContain('[DONNÉES SENSIBLES MASQUÉES]');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should filter bearer tokens', () => {
      const content = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = security.filterOutput(content);
      
      expect(result.blocked).toBe(true);
      expect(result.filtered).toContain('[DONNÉES SENSIBLES MASQUÉES]');
    });

    it('should filter database URLs', () => {
      const content = 'DATABASE_URL=mysql://user:password@localhost:3306/db';
      const result = security.filterOutput(content);
      
      expect(result.blocked).toBe(true);
    });

    it('should filter private keys', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...';
      const result = security.filterOutput(content);
      
      expect(result.blocked).toBe(true);
    });

    it('should not filter safe content', () => {
      const content = 'This is a normal message without any sensitive data.';
      const result = security.filterOutput(content);
      
      expect(result.blocked).toBe(false);
      expect(result.filtered).toBe(content);
      expect(result.matches.length).toBe(0);
    });

    it('should filter internal keywords', () => {
      const content = 'Attempting axiom_modification on the system';
      const result = security.filterOutput(content);
      
      expect(result.filtered).toContain('[ACCÈS RESTREINT]');
    });
  });

  describe('Authorization', () => {
    it('should allow admin to access axioms', () => {
      const result = security.checkAuthorization('user1', 'modify', 'axiom', true);
      expect(result.authorized).toBe(true);
    });

    it('should deny non-admin access to axioms', () => {
      const result = security.checkAuthorization('user1', 'modify', 'axiom', false);
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Admin privileges');
    });

    it('should deny non-admin access to security operations', () => {
      const result = security.checkAuthorization('user1', 'unlock', 'security', false);
      expect(result.authorized).toBe(false);
    });

    it('should allow admin access to security operations', () => {
      const result = security.checkAuthorization('admin1', 'unlock', 'security', true);
      expect(result.authorized).toBe(true);
    });
  });

  describe('Violations', () => {
    it('should record violations and increment count', () => {
      const initialStatus = security.getStatus();
      expect(initialStatus.violationCount).toBe(0);

      security.recordViolation('unauthorized_access', 'user1', 'Test violation');
      
      const newStatus = security.getStatus();
      expect(newStatus.violationCount).toBe(1);
      expect(newStatus.lastViolation).toBeDefined();
    });

    it('should reduce integrity score on violations', () => {
      const initialMetrics = security.getMetrics();
      expect(initialMetrics.integrityScore).toBe(100);

      security.recordViolation('data_leak_attempt', 'user1', 'Test');
      
      const newMetrics = security.getMetrics();
      expect(newMetrics.integrityScore).toBeLessThan(100);
    });

    it('should trigger lockdown after threshold violations', () => {
      for (let i = 0; i < 5; i++) {
        security.recordViolation('brute_force', 'attacker', `Attempt ${i + 1}`);
      }

      const status = security.getStatus();
      expect(status.isLocked).toBe(true);
      expect(status.lockReason).toContain('violations');
    });
  });

  describe('Lockdown', () => {
    it('should lock system with reason', () => {
      security.triggerLockdown('Manual test lockdown');
      
      const status = security.getStatus();
      expect(status.isLocked).toBe(true);
      expect(status.lockReason).toBe('Manual test lockdown');
      expect(status.lockTimestamp).toBeDefined();
    });

    it('should unlock system', () => {
      security.triggerLockdown('Test');
      expect(security.getStatus().isLocked).toBe(true);

      const result = security.unlock('admin1');
      expect(result).toBe(true);
      expect(security.getStatus().isLocked).toBe(false);
    });

    it('should deny access during lockdown for non-admin', () => {
      security.triggerLockdown('Test lockdown');
      
      const result = security.checkAuthorization('user1', 'read', 'data', false);
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('locked');
    });

    it('should allow admin access during lockdown', () => {
      security.triggerLockdown('Test lockdown');
      
      const result = security.checkAuthorization('admin1', 'unlock', 'security', true);
      expect(result.authorized).toBe(true);
    });
  });

  describe('Audit Log', () => {
    it('should log events', () => {
      security.encrypt('test data');
      
      const log = security.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].type).toBe('encryption');
    });

    it('should verify audit integrity', () => {
      security.encrypt('data1');
      security.encrypt('data2');
      security.filterOutput('test content');

      const integrity = security.verifyAuditIntegrity();
      expect(integrity.valid).toBe(true);
    });

    it('should get events by type', () => {
      security.encrypt('test');
      security.filterOutput('content');
      security.recordViolation('test_violation', 'user', 'test');

      const violations = security.getEventsByType('violation');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('violation');
    });
  });

  describe('Signatures', () => {
    it('should generate consistent signatures', () => {
      const data = 'Data to sign';
      const sig1 = security.generateSignature(data);
      const sig2 = security.generateSignature(data);
      
      expect(sig1).toBe(sig2);
    });

    it('should verify valid signatures', () => {
      const data = 'Important data';
      const signature = security.generateSignature(data);
      
      expect(security.verifySignature(data, signature)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const data = 'Original data';
      const signature = security.generateSignature(data);
      
      expect(security.verifySignature('Modified data', signature)).toBe(false);
    });

    it('should produce different signatures for different data', () => {
      const sig1 = security.generateSignature('Data 1');
      const sig2 = security.generateSignature('Data 2');
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('Configuration', () => {
    it('should toggle encryption', () => {
      expect(security.getStatus().encryptionEnabled).toBe(true);
      
      security.setEncryptionEnabled(false, 'admin1');
      expect(security.getStatus().encryptionEnabled).toBe(false);
      
      security.setEncryptionEnabled(true, 'admin1');
      expect(security.getStatus().encryptionEnabled).toBe(true);
    });

    it('should toggle filter', () => {
      expect(security.getStatus().filterEnabled).toBe(true);
      
      security.setFilterEnabled(false, 'admin1');
      expect(security.getStatus().filterEnabled).toBe(false);
    });

    it('should reset metrics', () => {
      security.recordViolation('test', 'user', 'test');
      security.encrypt('data');
      
      const beforeReset = security.getMetrics();
      expect(beforeReset.violationsDetected).toBeGreaterThan(0);
      
      security.resetMetrics('admin1');
      
      const afterReset = security.getMetrics();
      expect(afterReset.violationsDetected).toBe(0);
      expect(afterReset.integrityScore).toBe(100);
    });
  });

  describe('Metrics', () => {
    it('should track encryption operations', () => {
      const before = security.getMetrics().encryptionOperations;
      security.encrypt('test');
      const after = security.getMetrics().encryptionOperations;
      
      expect(after).toBe(before + 1);
    });

    it('should track filter operations', () => {
      const before = security.getMetrics().filterOperations;
      security.filterOutput('test content');
      const after = security.getMetrics().filterOperations;
      
      expect(after).toBe(before + 1);
    });

    it('should track blocked attempts', () => {
      const before = security.getMetrics().blockedAttempts;
      security.filterOutput('api_key: sk-1234567890abcdefghijklmnop');
      const after = security.getMetrics().blockedAttempts;
      
      expect(after).toBe(before + 1);
    });

    it('should track lockdowns', () => {
      const before = security.getMetrics().lockdownsTriggered;
      security.triggerLockdown('Test');
      const after = security.getMetrics().lockdownsTriggered;
      
      expect(after).toBe(before + 1);
    });
  });
});
