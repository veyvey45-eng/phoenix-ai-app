/**
 * Système de plugins extensibles pour Phoenix Agent
 */

export type PluginCategory = 'tool' | 'integration' | 'ui' | 'analytics' | 'security';

export interface PluginHook {
  name: string;
  handler: (...args: any[]) => Promise<any>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: PluginCategory;
  hooks?: PluginHook[];
  tools?: PluginTool[];
  config?: Record<string, any>;
}

export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (args: Record<string, any>) => Promise<any>;
}

export interface LoadedPlugin {
  definition: PluginDefinition;
  isEnabled: boolean;
  loadedAt: Date;
}

class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private hooks: Map<string, Array<{ pluginId: string; handler: (...args: any[]) => Promise<any> }>> = new Map();
  private tools: Map<string, { pluginId: string; tool: PluginTool }> = new Map();

  constructor() {
    console.log('[PluginSystem] Manager initialized');
    this.registerBuiltInPlugins();
  }

  private registerBuiltInPlugins(): void {
    this.registerPlugin({
      id: 'builtin-logging',
      name: 'Logging Plugin',
      description: 'Logs all agent actions for debugging',
      version: '1.0.0',
      author: 'Phoenix',
      category: 'analytics',
      hooks: [
        {
          name: 'beforeAction',
          handler: async (action: any) => {
            console.log(`[Plugin:Logging] Action: ${action.tool}`, action.args);
            return action;
          }
        }
      ]
    });

    this.registerPlugin({
      id: 'builtin-ratelimit',
      name: 'Rate Limiter',
      description: 'Prevents excessive API calls',
      version: '1.0.0',
      author: 'Phoenix',
      category: 'security',
      config: { maxRequestsPerMinute: 60 }
    });

    this.registerPlugin({
      id: 'builtin-cache',
      name: 'Response Cache',
      description: 'Caches repeated queries for faster responses',
      version: '1.0.0',
      author: 'Phoenix',
      category: 'analytics',
      config: { ttlSeconds: 300, maxEntries: 1000 }
    });
  }

  registerPlugin(definition: PluginDefinition): boolean {
    if (this.plugins.has(definition.id)) {
      console.warn(`[PluginSystem] Plugin ${definition.id} already registered`);
      return false;
    }

    const loadedPlugin: LoadedPlugin = {
      definition,
      isEnabled: true,
      loadedAt: new Date()
    };

    this.plugins.set(definition.id, loadedPlugin);

    if (definition.hooks) {
      for (const hook of definition.hooks) {
        this.registerHook(definition.id, hook.name, hook.handler);
      }
    }

    if (definition.tools) {
      for (const tool of definition.tools) {
        this.registerTool(definition.id, tool);
      }
    }

    console.log(`[PluginSystem] Registered plugin: ${definition.name} v${definition.version}`);
    return true;
  }

  private registerHook(pluginId: string, hookName: string, handler: (...args: any[]) => Promise<any>): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push({ pluginId, handler });
  }

  private registerTool(pluginId: string, tool: PluginTool): void {
    const fullName = `plugin:${pluginId}:${tool.name}`;
    this.tools.set(fullName, { pluginId, tool });
  }

  togglePlugin(pluginId: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.isEnabled = enabled;
    return true;
  }

  listPlugins(): Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    category: PluginCategory;
    isEnabled: boolean;
    toolCount: number;
    hookCount: number;
  }> {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.definition.id,
      name: p.definition.name,
      description: p.definition.description,
      version: p.definition.version,
      category: p.definition.category,
      isEnabled: p.isEnabled,
      toolCount: p.definition.tools?.length || 0,
      hookCount: p.definition.hooks?.length || 0
    }));
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const handlers = this.hooks.get(hookName) || [];
    const results: any[] = [];
    for (const { pluginId, handler } of handlers) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.isEnabled) {
        try {
          const result = await handler(...args);
          results.push(result);
        } catch (error) {
          console.error(`[PluginSystem] Hook error in ${pluginId}:${hookName}:`, error);
        }
      }
    }
    return results;
  }
}

export const pluginManager = new PluginManager();
