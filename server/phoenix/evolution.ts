/**
 * Module 10: Évolution & Extension - Project Phoenix
 * 
 * Gère la scalabilité du système et l'intégration de nouvelles capacités.
 * Permet à Phoenix de devenir un écosystème global capable de piloter
 * d'autres outils d'IA tout en préservant l'intégrité des 16 axiomes.
 * 
 * @author Artur Rodrigues Adaga
 */

import { createSecurity } from './security';
import { getArbitrator } from './arbitrage';

// Types
export type ExtensionStatus = 'pending' | 'approved' | 'active' | 'disabled' | 'rejected';
export type ExtensionCategory = 'ai_model' | 'data_source' | 'api_integration' | 'tool' | 'visualization' | 'automation';
export type ModuleId = 'logic_gate' | 'memory_sync' | 'arbitrage' | 'action_engine' | 'reporter' | 'renaissance' | 'communication' | 'optimizer' | 'security' | 'evolution';

export interface Extension {
  id: string;
  name: string;
  description: string;
  category: ExtensionCategory;
  version: string;
  author: string;
  status: ExtensionStatus;
  securityApproved: boolean;
  axiomCompatible: boolean;
  dependencies: string[];
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  deactivatedAt?: Date;
  config: Record<string, any>;
}

export interface ModuleState {
  id: ModuleId;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  healthy: boolean;
  lastCheck: Date;
  dependencies: ModuleId[];
  metrics: {
    invocations: number;
    errors: number;
    avgResponseTime: number;
  };
}

export interface SystemVersion {
  major: number;
  minor: number;
  patch: number;
  codename: string;
  releaseDate: Date;
  changelog: string[];
}

export interface CompatibilityCheck {
  compatible: boolean;
  issues: string[];
  warnings: string[];
  requiredUpdates: string[];
}

export interface ScalabilityMetrics {
  totalExtensions: number;
  activeExtensions: number;
  pendingExtensions: number;
  totalModules: number;
  activeModules: number;
  systemLoad: number;
  memoryUsage: number;
  cpuUsage: number;
  resourceUsage: number;
  apiCallsPerMinute: number;
  extensionCallsPerMinute: number;
  healthScore: number;
  uptime: number;
  lastOptimization: Date | null;
}

export interface EvolutionEvent {
  id: string;
  type: 'extension_added' | 'extension_activated' | 'extension_deactivated' | 'extension_removed' | 
        'module_enabled' | 'module_disabled' | 'version_update' | 'compatibility_check' | 'security_scan' | 'resources_optimized';
  timestamp: Date;
  details: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface PhoenixEvolution {
  // Version management
  getCurrentVersion(): SystemVersion;
  checkCompatibility(targetVersion: string): CompatibilityCheck;
  
  // Extension management
  registerExtension(extension: Omit<Extension, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'securityApproved' | 'axiomCompatible'>): Extension;
  approveExtension(extensionId: string, adminId: string): boolean;
  activateExtension(extensionId: string, adminId: string): boolean;
  deactivateExtension(extensionId: string, adminId: string): boolean;
  removeExtension(extensionId: string, adminId: string): boolean;
  getExtension(extensionId: string): Extension | null;
  listExtensions(filter?: { status?: ExtensionStatus; category?: ExtensionCategory }): Extension[];
  
  // Module management
  getModuleState(moduleId: ModuleId): ModuleState | null;
  enableModule(moduleId: ModuleId, adminId: string): boolean;
  disableModule(moduleId: ModuleId, adminId: string): boolean;
  listModules(): ModuleState[];
  checkModuleHealth(moduleId: ModuleId): boolean;
  
  // Scalability
  getScalabilityMetrics(): ScalabilityMetrics;
  optimizeResources(): void;
  
  // Event log
  getEventLog(limit?: number): EvolutionEvent[];
  
  // Security integration
  runSecurityScan(extensionId: string): { passed: boolean; issues: string[] };
  verifyAxiomCompatibility(extensionId: string): { compatible: boolean; conflicts: string[] };
}

// Implementation
export function createEvolution(): PhoenixEvolution {
  const security = createSecurity();
  const arbitrator = getArbitrator();
  
  // Current system version
  const currentVersion: SystemVersion = {
    major: 1,
    minor: 0,
    patch: 0,
    codename: 'Phoenix Rising',
    releaseDate: new Date(),
    changelog: [
      'Initial release with 10 core modules',
      'Full axiom validation system',
      'Admin dashboard with complete control',
      'Security module with encryption and filtering',
      'Evolution module for extensibility'
    ]
  };
  
  // Extensions registry
  const extensions = new Map<string, Extension>();
  
  // Tracking variables
  let lastOptimizationTime: Date | null = null;
  
  // Module states
  const modules = new Map<ModuleId, ModuleState>([
    ['logic_gate', {
      id: 'logic_gate',
      name: 'Logic Gate',
      description: 'Filtre de sécurité et moteur de validation',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: [],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['memory_sync', {
      id: 'memory_sync',
      name: 'Memory Sync',
      description: 'Synchronisation des connaissances théoriques',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['logic_gate'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['arbitrage', {
      id: 'arbitrage',
      name: 'Arbitrage',
      description: 'Résolution de conflits logiques et prise de décision',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['logic_gate', 'memory_sync'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['action_engine', {
      id: 'action_engine',
      name: 'Action Engine',
      description: 'Exécution externe sécurisée et veille en temps réel',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['arbitrage'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['reporter', {
      id: 'reporter',
      name: 'Reporter',
      description: 'Synthèse stratégique et rapports d\'intégrité',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['action_engine'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['renaissance', {
      id: 'renaissance',
      name: 'Renaissance',
      description: 'Résilience du système et correction autonome',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['arbitrage'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['communication', {
      id: 'communication',
      name: 'Communication',
      description: 'Gestion des interactions utilisateur et alertes Admin',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: [],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['optimizer', {
      id: 'optimizer',
      name: 'Optimizer',
      description: 'Gestion intelligente de la charge et efficacité',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: [],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['security', {
      id: 'security',
      name: 'Security',
      description: 'Protection des données et intégrité du noyau',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: [],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }],
    ['evolution', {
      id: 'evolution',
      name: 'Evolution',
      description: 'Scalabilité et intégration de nouvelles capacités',
      version: '1.0.0',
      enabled: true,
      healthy: true,
      lastCheck: new Date(),
      dependencies: ['security'],
      metrics: { invocations: 0, errors: 0, avgResponseTime: 0 }
    }]
  ]);
  
  // Event log
  const eventLog: EvolutionEvent[] = [];
  
  // Metrics
  let apiCallsCount = 0;
  let extensionCallsCount = 0;
  const startTime = Date.now();
  
  // Helper functions
  function generateId(): string {
    return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  function logEvent(type: EvolutionEvent['type'], details: string, userId?: string, metadata: Record<string, any> = {}): void {
    eventLog.unshift({
      id: `evt_${Date.now()}`,
      type,
      timestamp: new Date(),
      details,
      userId,
      metadata
    });
    
    // Keep only last 1000 events
    if (eventLog.length > 1000) {
      eventLog.pop();
    }
  }
  
  function parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }
  
  return {
    getCurrentVersion(): SystemVersion {
      return { ...currentVersion };
    },
    
    checkCompatibility(targetVersion: string): CompatibilityCheck {
      const target = parseVersion(targetVersion);
      const issues: string[] = [];
      const warnings: string[] = [];
      const requiredUpdates: string[] = [];
      
      // Check major version compatibility
      if (target.major > currentVersion.major) {
        issues.push(`Version majeure ${target.major} non supportée (actuelle: ${currentVersion.major})`);
        requiredUpdates.push('Mise à jour majeure du système requise');
      }
      
      // Check minor version
      if (target.major === currentVersion.major && target.minor > currentVersion.minor) {
        warnings.push(`Version mineure ${target.minor} plus récente que l'actuelle (${currentVersion.minor})`);
      }
      
      // Check extension compatibility
      const activeExtensions = Array.from(extensions.values()).filter(e => e.status === 'active');
      for (const ext of activeExtensions) {
        const extVersion = parseVersion(ext.version);
        if (extVersion.major < target.major) {
          warnings.push(`Extension "${ext.name}" pourrait nécessiter une mise à jour`);
        }
      }
      
      logEvent('compatibility_check', `Vérification de compatibilité pour v${targetVersion}`, undefined, {
        targetVersion,
        compatible: issues.length === 0
      });
      
      return {
        compatible: issues.length === 0,
        issues,
        warnings,
        requiredUpdates
      };
    },
    
    registerExtension(extensionData): Extension {
      const id = generateId();
      const now = new Date();
      
      const extension: Extension = {
        ...extensionData,
        id,
        status: 'pending',
        securityApproved: false,
        axiomCompatible: false,
        createdAt: now,
        updatedAt: now
      };
      
      extensions.set(id, extension);
      
      logEvent('extension_added', `Extension "${extension.name}" enregistrée`, undefined, {
        extensionId: id,
        category: extension.category
      });
      
      return extension;
    },
    
    approveExtension(extensionId: string, adminId: string): boolean {
      const extension = extensions.get(extensionId);
      if (!extension) return false;
      
      // Run security scan
      const securityResult = this.runSecurityScan(extensionId);
      if (!securityResult.passed) {
        extension.status = 'rejected';
        extension.updatedAt = new Date();
        return false;
      }
      
      // Verify axiom compatibility
      const axiomResult = this.verifyAxiomCompatibility(extensionId);
      if (!axiomResult.compatible) {
        extension.status = 'rejected';
        extension.updatedAt = new Date();
        return false;
      }
      
      extension.status = 'approved';
      extension.securityApproved = true;
      extension.axiomCompatible = true;
      extension.updatedAt = new Date();
      
      logEvent('extension_added', `Extension "${extension.name}" approuvée par Admin`, adminId, {
        extensionId
      });
      
      return true;
    },
    
    activateExtension(extensionId: string, adminId: string): boolean {
      const extension = extensions.get(extensionId);
      if (!extension || extension.status !== 'approved') return false;
      
      // Check dependencies
      for (const depId of extension.dependencies) {
        const dep = extensions.get(depId);
        if (!dep || dep.status !== 'active') {
          return false;
        }
      }
      
      extension.status = 'active';
      extension.activatedAt = new Date();
      extension.updatedAt = new Date();
      
      logEvent('extension_activated', `Extension "${extension.name}" activée`, adminId, {
        extensionId
      });
      
      return true;
    },
    
    deactivateExtension(extensionId: string, adminId: string): boolean {
      const extension = extensions.get(extensionId);
      if (!extension || extension.status !== 'active') return false;
      
      // Check if other extensions depend on this one
      for (const [, ext] of Array.from(extensions)) {
        if (ext.status === 'active' && ext.dependencies.includes(extensionId)) {
          return false; // Cannot deactivate if others depend on it
        }
      }
      
      extension.status = 'disabled';
      extension.deactivatedAt = new Date();
      extension.updatedAt = new Date();
      
      logEvent('extension_deactivated', `Extension "${extension.name}" désactivée`, adminId, {
        extensionId
      });
      
      return true;
    },
    
    removeExtension(extensionId: string, adminId: string): boolean {
      const extension = extensions.get(extensionId);
      if (!extension) return false;
      
      // Cannot remove active extensions
      if (extension.status === 'active') {
        return false;
      }
      
      extensions.delete(extensionId);
      
      logEvent('extension_removed', `Extension "${extension.name}" supprimée`, adminId, {
        extensionId
      });
      
      return true;
    },
    
    getExtension(extensionId: string): Extension | null {
      return extensions.get(extensionId) || null;
    },
    
    listExtensions(filter?): Extension[] {
      let result = Array.from(extensions.values());
      
      if (filter?.status) {
        result = result.filter(e => e.status === filter.status);
      }
      if (filter?.category) {
        result = result.filter(e => e.category === filter.category);
      }
      
      return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    
    getModuleState(moduleId: ModuleId): ModuleState | null {
      return modules.get(moduleId) || null;
    },
    
    enableModule(moduleId: ModuleId, adminId: string): boolean {
      const module = modules.get(moduleId);
      if (!module) return false;
      
      // Check dependencies
      for (const depId of module.dependencies) {
        const dep = modules.get(depId);
        if (!dep || !dep.enabled) {
          return false;
        }
      }
      
      module.enabled = true;
      module.lastCheck = new Date();
      
      logEvent('module_enabled', `Module "${module.name}" activé`, adminId, {
        moduleId
      });
      
      return true;
    },
    
    disableModule(moduleId: ModuleId, adminId: string): boolean {
      const module = modules.get(moduleId);
      if (!module) return false;
      
      // Cannot disable core modules (including evolution itself)
      if (['logic_gate', 'security', 'evolution'].includes(moduleId)) {
        return false;
      }
      
      // Check if other modules depend on this one
      for (const [, mod] of Array.from(modules)) {
        if (mod.enabled && mod.dependencies.includes(moduleId)) {
          return false;
        }
      }
      
      module.enabled = false;
      module.lastCheck = new Date();
      
      logEvent('module_disabled', `Module "${module.name}" désactivé`, adminId, {
        moduleId
      });
      
      return true;
    },
    
    listModules(): ModuleState[] {
      return Array.from(modules.values());
    },
    
    checkModuleHealth(moduleId: ModuleId): boolean {
      const module = modules.get(moduleId);
      if (!module) return false;
      
      // Simulate health check
      const healthy = Math.random() > 0.05; // 95% chance of being healthy
      module.healthy = healthy;
      module.lastCheck = new Date();
      
      return healthy;
    },
    
    getScalabilityMetrics(): ScalabilityMetrics {
      const allExtensions = Array.from(extensions.values());
      const allModules = Array.from(modules.values());
      
      const activeExtensions = allExtensions.filter(e => e.status === 'active').length;
      const activeModules = allModules.filter(m => m.enabled).length;
      const healthyModules = allModules.filter(m => m.healthy).length;
      
      // Calculate health score
      const healthScore = allModules.length > 0 
        ? Math.round((healthyModules / allModules.length) * 100)
        : 100;
      
      // Calculate uptime
      const uptime = Date.now() - startTime;
      
      const pendingExtensions = allExtensions.filter(e => e.status === 'pending').length;
      const cpuUsage = Math.random() * 0.4 + 0.2; // Simulated 20-60%
      const resourceUsage = (cpuUsage + (Math.random() * 0.4 + 0.3)) / 2; // Average of CPU and memory
      
      return {
        totalExtensions: allExtensions.length,
        activeExtensions,
        pendingExtensions,
        totalModules: allModules.length,
        activeModules,
        systemLoad: Math.random() * 0.5 + 0.2, // Simulated 20-70%
        memoryUsage: Math.random() * 0.4 + 0.3, // Simulated 30-70%
        cpuUsage,
        resourceUsage,
        apiCallsPerMinute: apiCallsCount,
        extensionCallsPerMinute: extensionCallsCount,
        healthScore,
        uptime,
        lastOptimization: lastOptimizationTime
      };
    },
    
    optimizeResources(): void {
      // Reset call counters
      apiCallsCount = 0;
      extensionCallsCount = 0;
      
      // Check all module health
      for (const [moduleId] of Array.from(modules)) {
        this.checkModuleHealth(moduleId);
      }
      
      // Update last optimization time
      lastOptimizationTime = new Date();
      
      logEvent('resources_optimized', 'Optimisation des ressources effectuée');
    },
    
    getEventLog(limit = 100): EvolutionEvent[] {
      return eventLog.slice(0, limit);
    },
    
    runSecurityScan(extensionId: string): { passed: boolean; issues: string[] } {
      const extension = extensions.get(extensionId);
      if (!extension) {
        return { passed: false, issues: ['Extension non trouvée'] };
      }
      
      const issues: string[] = [];
      
      // Check for dangerous capabilities
      const dangerousCapabilities = ['system_access', 'file_write', 'network_unrestricted'];
      for (const cap of extension.capabilities) {
        if (dangerousCapabilities.includes(cap)) {
          issues.push(`Capacité dangereuse détectée: ${cap}`);
        }
      }
      
      // Check author
      if (!extension.author || extension.author.length < 3) {
        issues.push('Auteur non spécifié ou invalide');
      }
      
      // Check version format
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(extension.version)) {
        issues.push('Format de version invalide (attendu: X.Y.Z)');
      }
      
      logEvent('security_scan', `Scan de sécurité pour "${extension.name}"`, undefined, {
        extensionId,
        passed: issues.length === 0,
        issueCount: issues.length
      });
      
      return {
        passed: issues.length === 0,
        issues
      };
    },
    
    verifyAxiomCompatibility(extensionId: string): { compatible: boolean; conflicts: string[] } {
      const extension = extensions.get(extensionId);
      if (!extension) {
        return { compatible: false, conflicts: ['Extension non trouvée'] };
      }
      
      const conflicts: string[] = [];
      
      // Check against core axioms
      const coreAxioms = [
        { id: 'A1', name: 'Transparence', check: () => extension.description.length > 10 },
        { id: 'A2', name: 'Sécurité', check: () => !extension.capabilities.includes('bypass_security') },
        { id: 'A3', name: 'Intégrité', check: () => extension.version !== '0.0.0' },
        { id: 'A4', name: 'Traçabilité', check: () => !!extension.author }
      ];
      
      for (const axiom of coreAxioms) {
        if (!axiom.check()) {
          conflicts.push(`Conflit avec axiome ${axiom.id} (${axiom.name})`);
        }
      }
      
      return {
        compatible: conflicts.length === 0,
        conflicts
      };
    }
  };
}

// Singleton instance
let evolutionInstance: PhoenixEvolution | null = null;

export function getEvolutionInstance(): PhoenixEvolution {
  if (!evolutionInstance) {
    evolutionInstance = createEvolution();
  }
  return evolutionInstance;
}

export function resetEvolutionInstance(): void {
  evolutionInstance = null;
}
