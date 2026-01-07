/**
 * E2B Manager - Gestion intelligente des sandboxes E2B
 * 
 * Fonctionnalités:
 * 1. Rotation de clés API (fallback si limite atteinte)
 * 2. Nettoyage automatique des sandboxes inutilisés
 * 3. Pool de sandboxes réutilisables
 * 4. Métriques et monitoring
 */

import { Sandbox } from '@e2b/code-interpreter';

// Configuration des clés API E2B
interface E2BApiKey {
  key: string;
  name: string;
  isActive: boolean;
  lastError?: string;
  lastErrorTime?: Date;
  usageCount: number;
  failureCount: number;
}

// État d'un sandbox
interface SandboxState {
  sandbox: InstanceType<typeof Sandbox>;
  sessionId: string;
  createdAt: Date;
  lastUsedAt: Date;
  apiKeyUsed: string;
  isActive: boolean;
}

/**
 * Gestionnaire centralisé des sandboxes E2B
 */
class E2BManagerService {
  private apiKeys: E2BApiKey[] = [];
  private currentKeyIndex: number = 0;
  private activeSandboxes: Map<string, SandboxState> = new Map();
  private maxSandboxAge: number = 25 * 60 * 1000; // 25 minutes (avant le timeout E2B de 30 min)
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxSandboxesPerKey: number = 18; // Garder une marge de sécurité (limite E2B = 20)

  constructor() {
    this.initializeApiKeys();
    this.startCleanupLoop();
  }

  /**
   * Initialise les clés API depuis les variables d'environnement
   */
  private initializeApiKeys() {
    // Clé principale
    const primaryKey = process.env.E2B_API_KEY;
    if (primaryKey) {
      this.apiKeys.push({
        key: primaryKey,
        name: 'primary',
        isActive: true,
        usageCount: 0,
        failureCount: 0
      });
    }

    // Clé secondaire (fallback)
    const secondaryKey = process.env.E2B_API_KEY_SECONDARY;
    if (secondaryKey) {
      this.apiKeys.push({
        key: secondaryKey,
        name: 'secondary',
        isActive: true,
        usageCount: 0,
        failureCount: 0
      });
    }

    // Clé tertiaire (fallback supplémentaire)
    const tertiaryKey = process.env.E2B_API_KEY_TERTIARY;
    if (tertiaryKey) {
      this.apiKeys.push({
        key: tertiaryKey,
        name: 'tertiary',
        isActive: true,
        usageCount: 0,
        failureCount: 0
      });
    }

    console.log(`[E2BManager] ${this.apiKeys.length} clé(s) API configurée(s)`);
  }

  /**
   * Démarre la boucle de nettoyage automatique
   */
  private startCleanupLoop() {
    // Nettoyer toutes les 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSandboxes();
    }, 5 * 60 * 1000);

    console.log('[E2BManager] Boucle de nettoyage démarrée (intervalle: 5 min)');
  }

  /**
   * Nettoie les sandboxes trop vieux ou inutilisés
   */
  async cleanupOldSandboxes(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, state] of Array.from(this.activeSandboxes.entries())) {
      const age = now - state.createdAt.getTime();
      const idleTime = now - state.lastUsedAt.getTime();

      // Supprimer si trop vieux ou inutilisé depuis 10 minutes
      if (age > this.maxSandboxAge || idleTime > 10 * 60 * 1000) {
        try {
          await state.sandbox.kill();
          this.activeSandboxes.delete(sessionId);
          cleanedCount++;
          console.log(`[E2BManager] Sandbox nettoyé: ${sessionId} (âge: ${Math.round(age / 1000)}s)`);
        } catch (error) {
          console.error(`[E2BManager] Erreur nettoyage sandbox ${sessionId}:`, error);
          // Supprimer quand même de la map
          this.activeSandboxes.delete(sessionId);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`[E2BManager] ${cleanedCount} sandbox(es) nettoyé(s). Actifs: ${this.activeSandboxes.size}`);
    }

    return cleanedCount;
  }

  /**
   * Obtient la prochaine clé API disponible (rotation)
   */
  private getNextApiKey(): E2BApiKey | null {
    if (this.apiKeys.length === 0) {
      return null;
    }

    // Essayer de trouver une clé active
    for (let i = 0; i < this.apiKeys.length; i++) {
      const index = (this.currentKeyIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[index];

      // Réactiver les clés après 5 minutes
      if (!key.isActive && key.lastErrorTime) {
        const timeSinceError = Date.now() - key.lastErrorTime.getTime();
        if (timeSinceError > 5 * 60 * 1000) {
          key.isActive = true;
          key.lastError = undefined;
          console.log(`[E2BManager] Clé ${key.name} réactivée après cooldown`);
        }
      }

      if (key.isActive) {
        this.currentKeyIndex = (index + 1) % this.apiKeys.length;
        return key;
      }
    }

    // Aucune clé active, réactiver la première
    this.apiKeys[0].isActive = true;
    return this.apiKeys[0];
  }

  /**
   * Marque une clé comme ayant échoué
   */
  private markKeyAsFailed(key: E2BApiKey, error: string) {
    key.isActive = false;
    key.lastError = error;
    key.lastErrorTime = new Date();
    key.failureCount++;
    console.log(`[E2BManager] Clé ${key.name} désactivée: ${error}`);
  }

  /**
   * Crée ou récupère un sandbox pour une session
   */
  async getOrCreateSandbox(sessionId: string): Promise<{
    sandbox: InstanceType<typeof Sandbox> | null;
    error?: string;
    usedFallback?: boolean;
  }> {
    // Vérifier si un sandbox existe déjà pour cette session
    const existing = this.activeSandboxes.get(sessionId);
    if (existing && existing.isActive) {
      existing.lastUsedAt = new Date();
      return { sandbox: existing.sandbox };
    }

    // Nettoyer les vieux sandboxes avant d'en créer un nouveau
    if (this.activeSandboxes.size >= this.maxSandboxesPerKey) {
      await this.cleanupOldSandboxes();
    }

    // Essayer de créer un sandbox avec rotation de clés
    let lastError = '';
    let usedFallback = false;

    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const apiKey = this.getNextApiKey();
      if (!apiKey) {
        return { sandbox: null, error: 'Aucune clé API E2B configurée' };
      }

      if (attempt > 0) {
        usedFallback = true;
        console.log(`[E2BManager] Tentative avec clé fallback: ${apiKey.name}`);
      }

      try {
        // Définir temporairement la clé API
        const originalKey = process.env.E2B_API_KEY;
        process.env.E2B_API_KEY = apiKey.key;

        const sandbox = await Sandbox.create({
          timeoutMs: 30 * 60 * 1000, // 30 minutes
        });

        // Restaurer la clé originale
        process.env.E2B_API_KEY = originalKey;

        // Enregistrer le sandbox
        this.activeSandboxes.set(sessionId, {
          sandbox,
          sessionId,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          apiKeyUsed: apiKey.name,
          isActive: true
        });

        apiKey.usageCount++;
        console.log(`[E2BManager] Sandbox créé avec clé ${apiKey.name} pour session ${sessionId}`);

        return { sandbox, usedFallback };
      } catch (error: any) {
        lastError = error.message || 'Erreur inconnue';

        // Vérifier si c'est une erreur de limite
        if (lastError.includes('Rate limit') || lastError.includes('maximum number')) {
          this.markKeyAsFailed(apiKey, lastError);
        } else {
          // Autre erreur, ne pas désactiver la clé
          console.error(`[E2BManager] Erreur création sandbox avec ${apiKey.name}:`, lastError);
        }
      }
    }

    return { sandbox: null, error: lastError };
  }

  /**
   * Libère un sandbox
   */
  async releaseSandbox(sessionId: string): Promise<void> {
    const state = this.activeSandboxes.get(sessionId);
    if (state) {
      try {
        await state.sandbox.kill();
      } catch (error) {
        console.error(`[E2BManager] Erreur libération sandbox ${sessionId}:`, error);
      }
      this.activeSandboxes.delete(sessionId);
    }
  }

  /**
   * Force le nettoyage de tous les sandboxes
   */
  async releaseAllSandboxes(): Promise<void> {
    console.log(`[E2BManager] Libération de ${this.activeSandboxes.size} sandboxes...`);
    
    for (const [sessionId, state] of Array.from(this.activeSandboxes.entries())) {
      try {
        await state.sandbox.kill();
      } catch (error) {
        // Ignorer les erreurs
      }
    }
    
    this.activeSandboxes.clear();
  }

  /**
   * Obtient les statistiques du manager
   */
  getStats(): {
    activeSandboxes: number;
    apiKeys: Array<{ name: string; isActive: boolean; usageCount: number; failureCount: number }>;
    oldestSandboxAge: number;
  } {
    let oldestAge = 0;
    const now = Date.now();

    for (const state of Array.from(this.activeSandboxes.values())) {
      const age = now - state.createdAt.getTime();
      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      activeSandboxes: this.activeSandboxes.size,
      apiKeys: this.apiKeys.map(k => ({
        name: k.name,
        isActive: k.isActive,
        usageCount: k.usageCount,
        failureCount: k.failureCount
      })),
      oldestSandboxAge: Math.round(oldestAge / 1000)
    };
  }

  /**
   * Vérifie si E2B est disponible
   */
  isAvailable(): boolean {
    return this.apiKeys.some(k => k.isActive);
  }

  /**
   * Arrête le manager proprement
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.releaseAllSandboxes();
  }
}

// Singleton
export const e2bManager = new E2BManagerService();
export default e2bManager;
