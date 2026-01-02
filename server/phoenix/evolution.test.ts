/**
 * Tests for Module 10: Evolution & Extension
 * Project Phoenix
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEvolution, PhoenixEvolution, ModuleId, ExtensionCategory } from './evolution';

describe('Module 10: Evolution & Extension', () => {
  let evolution: PhoenixEvolution;

  beforeEach(() => {
    evolution = createEvolution();
  });

  describe('Version Management', () => {
    it('should return current system version', () => {
      const version = evolution.getCurrentVersion();
      
      expect(version).toBeDefined();
      expect(version.major).toBe(1);
      expect(version.minor).toBe(0);
      expect(version.patch).toBe(0);
      expect(version.codename).toBe('Phoenix Rising');
      expect(version.releaseDate).toBeInstanceOf(Date);
      expect(version.changelog).toBeInstanceOf(Array);
      expect(version.changelog.length).toBeGreaterThan(0);
    });

    it('should check compatibility with target version', () => {
      const result = evolution.checkCompatibility('1.0.0');
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.requiredUpdates).toBeInstanceOf(Array);
    });

    it('should be compatible with same version', () => {
      const result = evolution.checkCompatibility('1.0.0');
      expect(result.compatible).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect incompatibility with major version difference', () => {
      const result = evolution.checkCompatibility('2.0.0');
      expect(result.compatible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Module Management', () => {
    it('should list all 10 modules', () => {
      const modules = evolution.listModules();
      
      expect(modules).toBeInstanceOf(Array);
      expect(modules.length).toBe(10);
      
      const moduleIds = modules.map(m => m.id);
      expect(moduleIds).toContain('logic_gate');
      expect(moduleIds).toContain('memory_sync');
      expect(moduleIds).toContain('arbitrage');
      expect(moduleIds).toContain('action_engine');
      expect(moduleIds).toContain('reporter');
      expect(moduleIds).toContain('renaissance');
      expect(moduleIds).toContain('communication');
      expect(moduleIds).toContain('optimizer');
      expect(moduleIds).toContain('security');
      expect(moduleIds).toContain('evolution');
    });

    it('should get module state by ID', () => {
      const module = evolution.getModuleState('logic_gate');
      
      expect(module).toBeDefined();
      expect(module?.id).toBe('logic_gate');
      expect(module?.name).toBe('Logic Gate');
      expect(typeof module?.enabled).toBe('boolean');
      expect(typeof module?.healthy).toBe('boolean');
      expect(module?.metrics).toBeDefined();
    });

    it('should return null for invalid module ID', () => {
      const module = evolution.getModuleState('invalid_module' as ModuleId);
      expect(module).toBeNull();
    });

    it('should enable a module', () => {
      // First disable it (use communication which has no dependents)
      evolution.disableModule('communication', 'admin-1');
      let module = evolution.getModuleState('communication');
      expect(module?.enabled).toBe(false);
      
      // Then enable it
      const result = evolution.enableModule('communication', 'admin-1');
      expect(result).toBe(true);
      
      module = evolution.getModuleState('communication');
      expect(module?.enabled).toBe(true);
    });

    it('should disable a module without dependents', () => {
      // Use communication which has no dependents
      const result = evolution.disableModule('communication', 'admin-1');
      expect(result).toBe(true);
      
      const module = evolution.getModuleState('communication');
      expect(module?.enabled).toBe(false);
    });

    it('should not disable a module with active dependents', () => {
      // memory_sync has arbitrage depending on it, so it should fail
      const result = evolution.disableModule('memory_sync', 'admin-1');
      expect(result).toBe(false);
      
      const module = evolution.getModuleState('memory_sync');
      expect(module?.enabled).toBe(true);
    });

    it('should not disable evolution module (self-protection)', () => {
      const result = evolution.disableModule('evolution', 'admin-1');
      expect(result).toBe(false);
      
      const module = evolution.getModuleState('evolution');
      expect(module?.enabled).toBe(true);
    });

    it('should check module health', () => {
      const healthy = evolution.checkModuleHealth('logic_gate');
      expect(typeof healthy).toBe('boolean');
    });
  });

  describe('Extension Management', () => {
    it('should register a new extension', () => {
      const extension = evolution.registerExtension({
        name: 'Test Extension',
        description: 'A test extension for Phoenix',
        category: 'tool',
        version: '1.0.0',
        author: 'Test Author',
        dependencies: [],
        capabilities: ['test_capability'],
        config: { key: 'value' }
      });
      
      expect(extension).toBeDefined();
      expect(extension.id).toBeDefined();
      expect(extension.name).toBe('Test Extension');
      expect(extension.status).toBe('pending');
      expect(extension.securityApproved).toBe(false);
      expect(extension.axiomCompatible).toBe(false);
    });

    it('should list extensions', () => {
      // Register some extensions
      evolution.registerExtension({
        name: 'Extension 1',
        description: 'First extension',
        category: 'tool',
        version: '1.0.0',
        author: 'Author 1',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      evolution.registerExtension({
        name: 'Extension 2',
        description: 'Second extension',
        category: 'ai_model',
        version: '1.0.0',
        author: 'Author 2',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const allExtensions = evolution.listExtensions();
      expect(allExtensions.length).toBeGreaterThanOrEqual(2);
      
      // Filter by category
      const toolExtensions = evolution.listExtensions({ category: 'tool' });
      expect(toolExtensions.every(e => e.category === 'tool')).toBe(true);
    });

    it('should approve an extension', () => {
      const extension = evolution.registerExtension({
        name: 'Approval Test',
        description: 'Test approval',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const result = evolution.approveExtension(extension.id, 'admin-1');
      expect(result).toBe(true);
      
      const updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('approved');
      expect(updated?.securityApproved).toBe(true);
      expect(updated?.axiomCompatible).toBe(true);
    });

    it('should activate an approved extension', () => {
      const extension = evolution.registerExtension({
        name: 'Activation Test',
        description: 'Test activation',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      // Must approve first
      evolution.approveExtension(extension.id, 'admin-1');
      
      const result = evolution.activateExtension(extension.id, 'admin-1');
      expect(result).toBe(true);
      
      const updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('active');
      expect(updated?.activatedAt).toBeInstanceOf(Date);
    });

    it('should not activate a pending extension', () => {
      const extension = evolution.registerExtension({
        name: 'Pending Test',
        description: 'Test pending',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const result = evolution.activateExtension(extension.id, 'admin-1');
      expect(result).toBe(false);
      
      const updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('pending');
    });

    it('should deactivate an active extension', () => {
      const extension = evolution.registerExtension({
        name: 'Deactivation Test',
        description: 'Test deactivation',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      evolution.approveExtension(extension.id, 'admin-1');
      evolution.activateExtension(extension.id, 'admin-1');
      
      const result = evolution.deactivateExtension(extension.id, 'admin-1');
      expect(result).toBe(true);
      
      const updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('disabled');
      expect(updated?.deactivatedAt).toBeInstanceOf(Date);
    });

    it('should remove an extension', () => {
      const extension = evolution.registerExtension({
        name: 'Removal Test',
        description: 'Test removal',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const result = evolution.removeExtension(extension.id, 'admin-1');
      expect(result).toBe(true);
      
      const removed = evolution.getExtension(extension.id);
      expect(removed).toBeNull();
    });
  });

  describe('Security Integration', () => {
    it('should run security scan on extension', () => {
      const extension = evolution.registerExtension({
        name: 'Security Test',
        description: 'Test security scan',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const result = evolution.runSecurityScan(extension.id);
      
      expect(result).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(result.issues).toBeInstanceOf(Array);
    });

    it('should verify axiom compatibility', () => {
      const extension = evolution.registerExtension({
        name: 'Axiom Test',
        description: 'Test axiom compatibility',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const result = evolution.verifyAxiomCompatibility(extension.id);
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(result.conflicts).toBeInstanceOf(Array);
    });
  });

  describe('Scalability Metrics', () => {
    it('should return scalability metrics', () => {
      const metrics = evolution.getScalabilityMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalExtensions).toBe('number');
      expect(typeof metrics.activeExtensions).toBe('number');
      expect(typeof metrics.pendingExtensions).toBe('number');
      expect(typeof metrics.totalModules).toBe('number');
      expect(typeof metrics.activeModules).toBe('number');
      expect(typeof metrics.systemLoad).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.resourceUsage).toBe('number');
      expect(typeof metrics.healthScore).toBe('number');
      expect(typeof metrics.uptime).toBe('number');
    });

    it('should have 10 total modules', () => {
      const metrics = evolution.getScalabilityMetrics();
      expect(metrics.totalModules).toBe(10);
    });

    it('should track active extensions', () => {
      const extension = evolution.registerExtension({
        name: 'Metrics Test',
        description: 'Test metrics',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      evolution.approveExtension(extension.id, 'admin-1');
      evolution.activateExtension(extension.id, 'admin-1');
      
      const metrics = evolution.getScalabilityMetrics();
      expect(metrics.activeExtensions).toBeGreaterThanOrEqual(1);
    });

    it('should track pending extensions', () => {
      evolution.registerExtension({
        name: 'Pending Metrics Test',
        description: 'Test pending metrics',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      const metrics = evolution.getScalabilityMetrics();
      expect(metrics.pendingExtensions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Resource Optimization', () => {
    it('should optimize resources', () => {
      // Should not throw
      expect(() => evolution.optimizeResources()).not.toThrow();
    });

    it('should update lastOptimization after optimization', () => {
      evolution.optimizeResources();
      
      const metrics = evolution.getScalabilityMetrics();
      expect(metrics.lastOptimization).toBeInstanceOf(Date);
    });
  });

  describe('Event Log', () => {
    it('should return event log', () => {
      const events = evolution.getEventLog();
      
      expect(events).toBeInstanceOf(Array);
    });

    it('should log module enable/disable events', () => {
      // Use communication which has no dependents
      evolution.disableModule('communication', 'admin-1');
      evolution.enableModule('communication', 'admin-1');
      
      const events = evolution.getEventLog();
      const moduleEvents = events.filter(e => 
        e.type === 'module_enabled' || e.type === 'module_disabled'
      );
      
      expect(moduleEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should log extension events', () => {
      const extension = evolution.registerExtension({
        name: 'Event Log Test',
        description: 'Test event logging',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      evolution.approveExtension(extension.id, 'admin-1');
      evolution.activateExtension(extension.id, 'admin-1');
      
      const events = evolution.getEventLog();
      const extensionEvents = events.filter(e => 
        e.type.startsWith('extension_')
      );
      
      expect(extensionEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit parameter', () => {
      // Generate some events
      for (let i = 0; i < 10; i++) {
        evolution.registerExtension({
          name: `Limit Test ${i}`,
          description: 'Test limit',
          category: 'tool',
          version: '1.0.0',
          author: 'Test',
          dependencies: [],
          capabilities: [],
          config: {}
        });
      }
      
      const limitedEvents = evolution.getEventLog(5);
      expect(limitedEvents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Extension Categories', () => {
    const categories: ExtensionCategory[] = [
      'ai_model', 'data_source', 'api_integration', 
      'tool', 'visualization', 'automation'
    ];

    categories.forEach(category => {
      it(`should support ${category} category`, () => {
        const extension = evolution.registerExtension({
          name: `${category} Extension`,
          description: `Test ${category}`,
          category,
          version: '1.0.0',
          author: 'Test',
          dependencies: [],
          capabilities: [],
          config: {}
        });
        
        expect(extension.category).toBe(category);
        
        const filtered = evolution.listExtensions({ category });
        expect(filtered.some(e => e.id === extension.id)).toBe(true);
      });
    });
  });

  describe('Extension Lifecycle', () => {
    it('should follow correct lifecycle: pending -> approved -> active -> disabled', () => {
      const extension = evolution.registerExtension({
        name: 'Lifecycle Test',
        description: 'Test full lifecycle',
        category: 'tool',
        version: '1.0.0',
        author: 'Test',
        dependencies: [],
        capabilities: [],
        config: {}
      });
      
      // Step 1: Pending
      expect(extension.status).toBe('pending');
      
      // Step 2: Approved
      evolution.approveExtension(extension.id, 'admin-1');
      let updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('approved');
      
      // Step 3: Active
      evolution.activateExtension(extension.id, 'admin-1');
      updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('active');
      
      // Step 4: Disabled
      evolution.deactivateExtension(extension.id, 'admin-1');
      updated = evolution.getExtension(extension.id);
      expect(updated?.status).toBe('disabled');
    });
  });
});
