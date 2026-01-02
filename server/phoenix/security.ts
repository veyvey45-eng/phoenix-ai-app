/**
 * Module 09: Sécurité Avancée & Chiffrement - Project Phoenix
 * 
 * Ce module assure la protection des données et l'intégrité du système.
 * Il gère le chiffrement, le filtrage de sortie, et l'audit immuable.
 */

import crypto from 'crypto';
import { notifyOwner } from '../_core/notification';

// Types
export type SecurityLevel = 'public' | 'internal' | 'confidential' | 'restricted';
export type ViolationType = 'unauthorized_access' | 'data_leak_attempt' | 'axiom_modification' | 'brute_force' | 'injection_attempt';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'access' | 'encryption' | 'filter' | 'violation' | 'lockdown';
  severity: 'info' | 'warning' | 'critical';
  userId?: string;
  action: string;
  details: string;
  blocked: boolean;
  hash: string; // Hash pour l'immutabilité
}

export interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
  algorithm: string;
  timestamp: number;
}

export interface FilterResult {
  original: string;
  filtered: string;
  blocked: boolean;
  reason?: string;
  matches: string[];
}

export interface SecurityStatus {
  isLocked: boolean;
  lockReason?: string;
  lockTimestamp?: Date;
  violationCount: number;
  lastViolation?: Date;
  encryptionEnabled: boolean;
  filterEnabled: boolean;
  auditEnabled: boolean;
}

export interface SecurityMetrics {
  totalEvents: number;
  blockedAttempts: number;
  encryptionOperations: number;
  filterOperations: number;
  violationsDetected: number;
  lockdownsTriggered: number;
  integrityScore: number;
}

// Patterns sensibles à filtrer (données techniques, pas de codes secrets)
const SENSITIVE_PATTERNS = [
  // Clés API et tokens
  /api[_-]?key[s]?\s*[:=]\s*['"]?[\w-]{20,}/gi,
  /bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,
  /token[s]?\s*[:=]\s*['"]?[\w-]{20,}/gi,
  /secret[s]?\s*[:=]\s*['"]?[\w-]{20,}/gi,
  
  // Credentials
  /password[s]?\s*[:=]\s*['"]?[^'"}\s]{8,}/gi,
  /credential[s]?\s*[:=]\s*['"]?[^'"}\s]{8,}/gi,
  
  // Clés privées
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
  /-----BEGIN\s+ENCRYPTED\s+PRIVATE\s+KEY-----/gi,
  
  // Variables d'environnement sensibles
  /DATABASE_URL\s*=\s*[^\s]+/gi,
  /JWT_SECRET\s*=\s*[^\s]+/gi,
  /ENCRYPTION_KEY\s*=\s*[^\s]+/gi,
  
  // Informations de connexion
  /mysql:\/\/[^@]+@[^\s]+/gi,
  /postgres:\/\/[^@]+@[^\s]+/gi,
  /mongodb:\/\/[^@]+@[^\s]+/gi,
];

// Mots-clés de sécurité interne
const INTERNAL_KEYWORDS = [
  'axiom_modification',
  'security_bypass',
  'admin_override',
  'system_lockdown',
  'encryption_key',
];

/**
 * PhoenixSecurity - Gestionnaire de sécurité avancée
 */
export class PhoenixSecurity {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';
  private auditLog: SecurityEvent[] = [];
  private status: SecurityStatus;
  private violationThreshold = 5;
  private metrics: SecurityMetrics;

  constructor() {
    // Générer une clé de chiffrement dérivée de l'environnement
    const secret = process.env.JWT_SECRET || 'phoenix-default-key';
    this.encryptionKey = crypto.scryptSync(secret, 'phoenix-salt', 32);

    this.status = {
      isLocked: false,
      violationCount: 0,
      encryptionEnabled: true,
      filterEnabled: true,
      auditEnabled: true,
    };

    this.metrics = {
      totalEvents: 0,
      blockedAttempts: 0,
      encryptionOperations: 0,
      filterOperations: 0,
      violationsDetected: 0,
      lockdownsTriggered: 0,
      integrityScore: 100,
    };
  }

  /**
   * Chiffre des données sensibles
   */
  encrypt(data: string): EncryptedData {
    if (!this.status.encryptionEnabled) {
      throw new Error('Encryption is disabled');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    this.metrics.encryptionOperations++;
    this.logEvent('encryption', 'info', 'Data encrypted', 'Encryption operation completed', false);

    return {
      iv: iv.toString('hex'),
      data: encrypted,
      tag: tag.toString('hex'),
      algorithm: this.algorithm,
      timestamp: Date.now(),
    };
  }

  /**
   * Déchiffre des données
   */
  decrypt(encrypted: EncryptedData): string {
    if (!this.status.encryptionEnabled) {
      throw new Error('Encryption is disabled');
    }

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encrypted.iv, 'hex')
    ) as crypto.DecipherGCM;
    
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    this.metrics.encryptionOperations++;
    this.logEvent('encryption', 'info', 'Data decrypted', 'Decryption operation completed', false);

    return decrypted;
  }

  /**
   * Filtre le contenu pour empêcher les fuites de données sensibles
   */
  filterOutput(content: string, userId?: string): FilterResult {
    if (!this.status.filterEnabled) {
      return {
        original: content,
        filtered: content,
        blocked: false,
        matches: [],
      };
    }

    let filtered = content;
    const matches: string[] = [];
    let blocked = false;

    // Vérifier les patterns sensibles
    for (const pattern of SENSITIVE_PATTERNS) {
      const found = content.match(pattern);
      if (found) {
        matches.push(...found);
        filtered = filtered.replace(pattern, '[DONNÉES SENSIBLES MASQUÉES]');
        blocked = true;
      }
    }

    // Vérifier les mots-clés internes
    for (const keyword of INTERNAL_KEYWORDS) {
      if (content.toLowerCase().includes(keyword)) {
        matches.push(keyword);
        filtered = filtered.replace(new RegExp(keyword, 'gi'), '[ACCÈS RESTREINT]');
      }
    }

    this.metrics.filterOperations++;

    if (blocked) {
      this.metrics.blockedAttempts++;
      this.logEvent(
        'filter',
        'warning',
        'Sensitive data filtered',
        `Filtered ${matches.length} sensitive patterns`,
        true,
        userId
      );
    }

    return {
      original: content,
      filtered,
      blocked,
      reason: blocked ? 'Sensitive data detected' : undefined,
      matches,
    };
  }

  /**
   * Vérifie si une action est autorisée
   */
  checkAuthorization(
    userId: string,
    action: string,
    resourceType: string,
    isAdmin: boolean
  ): { authorized: boolean; reason?: string } {
    // Si le système est verrouillé, seul l'admin peut agir
    if (this.status.isLocked && !isAdmin) {
      this.recordViolation('unauthorized_access', userId, `Attempted ${action} during lockdown`);
      return {
        authorized: false,
        reason: 'System is locked. Admin authorization required.',
      };
    }

    // Actions sur les axiomes réservées à l'admin
    if (resourceType === 'axiom' && !isAdmin) {
      this.recordViolation('axiom_modification', userId, `Attempted to modify axiom`);
      return {
        authorized: false,
        reason: 'Axiom modifications require Admin privileges.',
      };
    }

    // Actions de sécurité réservées à l'admin
    if (resourceType === 'security' && !isAdmin) {
      this.recordViolation('unauthorized_access', userId, `Attempted security action: ${action}`);
      return {
        authorized: false,
        reason: 'Security operations require Admin privileges.',
      };
    }

    this.logEvent('access', 'info', 'Access granted', `${action} on ${resourceType}`, false, userId);
    return { authorized: true };
  }

  /**
   * Enregistre une violation de sécurité
   */
  recordViolation(type: ViolationType, userId: string, details: string): void {
    this.status.violationCount++;
    this.status.lastViolation = new Date();
    this.metrics.violationsDetected++;

    // Réduire le score d'intégrité
    this.metrics.integrityScore = Math.max(0, this.metrics.integrityScore - 5);

    this.logEvent('violation', 'critical', type, details, true, userId);

    // Vérifier si le seuil de verrouillage est atteint
    if (this.status.violationCount >= this.violationThreshold) {
      this.triggerLockdown(`Too many violations (${this.status.violationCount})`);
    }

    // Notifier l'admin
    notifyOwner({
      title: `⚠️ Violation de sécurité Phoenix: ${type}`,
      content: `Utilisateur: ${userId}\nDétails: ${details}\nViolations totales: ${this.status.violationCount}`,
    }).catch(console.error);
  }

  /**
   * Déclenche le verrouillage du système
   */
  triggerLockdown(reason: string): void {
    this.status.isLocked = true;
    this.status.lockReason = reason;
    this.status.lockTimestamp = new Date();
    this.metrics.lockdownsTriggered++;

    this.logEvent('lockdown', 'critical', 'System locked', reason, true);

    // Notifier l'admin
    notifyOwner({
      title: '🔒 VERROUILLAGE SYSTÈME PHOENIX',
      content: `Le système a été verrouillé automatiquement.\nRaison: ${reason}\nAction requise: Déverrouillage manuel via /admin`,
    }).catch(console.error);
  }

  /**
   * Déverrouille le système (Admin uniquement)
   */
  unlock(adminId: string): boolean {
    if (!this.status.isLocked) {
      return false;
    }

    this.status.isLocked = false;
    this.status.lockReason = undefined;
    this.status.lockTimestamp = undefined;
    this.status.violationCount = 0;

    // Restaurer partiellement le score d'intégrité
    this.metrics.integrityScore = Math.min(100, this.metrics.integrityScore + 20);

    this.logEvent('lockdown', 'info', 'System unlocked', `Unlocked by admin ${adminId}`, false, adminId);

    return true;
  }

  /**
   * Enregistre un événement dans le journal d'audit immuable
   */
  private logEvent(
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    action: string,
    details: string,
    blocked: boolean,
    userId?: string
  ): void {
    if (!this.status.auditEnabled) return;

    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      severity,
      userId,
      action,
      details,
      blocked,
      hash: '', // Sera calculé ci-dessous
    };

    // Calculer le hash pour l'immutabilité (chaîne de hachage)
    const previousHash = this.auditLog.length > 0 
      ? this.auditLog[this.auditLog.length - 1].hash 
      : '0';
    
    const dataToHash = `${previousHash}|${event.id}|${event.timestamp.toISOString()}|${event.type}|${event.action}`;
    event.hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    this.auditLog.push(event);
    this.metrics.totalEvents++;

    // Limiter la taille du log en mémoire (garder les 1000 derniers)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Vérifie l'intégrité du journal d'audit
   */
  verifyAuditIntegrity(): { valid: boolean; brokenAt?: number } {
    for (let i = 0; i < this.auditLog.length; i++) {
      const event = this.auditLog[i];
      const previousHash = i > 0 ? this.auditLog[i - 1].hash : '0';
      
      const dataToHash = `${previousHash}|${event.id}|${event.timestamp.toISOString()}|${event.type}|${event.action}`;
      const expectedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      if (event.hash !== expectedHash) {
        return { valid: false, brokenAt: i };
      }
    }

    return { valid: true };
  }

  /**
   * Obtient le statut de sécurité actuel
   */
  getStatus(): SecurityStatus {
    return { ...this.status };
  }

  /**
   * Obtient les métriques de sécurité
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtient le journal d'audit
   */
  getAuditLog(limit = 100): SecurityEvent[] {
    return this.auditLog.slice(-limit).reverse();
  }

  /**
   * Obtient les événements par type
   */
  getEventsByType(type: SecurityEvent['type'], limit = 50): SecurityEvent[] {
    return this.auditLog
      .filter(e => e.type === type)
      .slice(-limit)
      .reverse();
  }

  /**
   * Obtient les violations récentes
   */
  getRecentViolations(limit = 20): SecurityEvent[] {
    return this.auditLog
      .filter(e => e.type === 'violation')
      .slice(-limit)
      .reverse();
  }

  /**
   * Active/désactive le chiffrement
   */
  setEncryptionEnabled(enabled: boolean, adminId: string): void {
    this.status.encryptionEnabled = enabled;
    this.logEvent(
      'encryption',
      'warning',
      enabled ? 'Encryption enabled' : 'Encryption disabled',
      `Changed by admin ${adminId}`,
      false,
      adminId
    );
  }

  /**
   * Active/désactive le filtrage
   */
  setFilterEnabled(enabled: boolean, adminId: string): void {
    this.status.filterEnabled = enabled;
    this.logEvent(
      'filter',
      'warning',
      enabled ? 'Filter enabled' : 'Filter disabled',
      `Changed by admin ${adminId}`,
      false,
      adminId
    );
  }

  /**
   * Génère un hash sécurisé pour les signatures
   */
  generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Vérifie une signature
   */
  verifySignature(data: string, signature: string): boolean {
    const expected = this.generateSignature(data);
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Réinitialise les métriques (Admin uniquement)
   */
  resetMetrics(adminId: string): void {
    this.metrics = {
      totalEvents: this.metrics.totalEvents, // Garder le total
      blockedAttempts: 0,
      encryptionOperations: 0,
      filterOperations: 0,
      violationsDetected: 0,
      lockdownsTriggered: 0,
      integrityScore: 100,
    };

    this.logEvent(
      'access',
      'warning',
      'Metrics reset',
      `Reset by admin ${adminId}`,
      false,
      adminId
    );
  }
}

// Singleton
let securityInstance: PhoenixSecurity | null = null;

export function getSecurity(): PhoenixSecurity {
  if (!securityInstance) {
    securityInstance = new PhoenixSecurity();
  }
  return securityInstance;
}

export function createSecurity(): PhoenixSecurity {
  return new PhoenixSecurity();
}
