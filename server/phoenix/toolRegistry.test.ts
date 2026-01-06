/**
 * Tests pour le ToolRegistry - Système d'outils de l'agent Phoenix
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolRegistry } from './toolRegistry';

describe('ToolRegistry', () => {
  describe('listAll', () => {
    it('should return all registered tools', () => {
      const tools = toolRegistry.listAll();
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include essential tools', () => {
      const tools = toolRegistry.listAll();
      const toolNames = tools.map(t => t.name);
      
      // Vérifier que les outils essentiels sont présents
      expect(toolNames).toContain('execute_python');
      expect(toolNames).toContain('execute_javascript');
      expect(toolNames).toContain('web_search');
      expect(toolNames).toContain('generate_image');
      expect(toolNames).toContain('think');
    });
  });

  describe('get', () => {
    it('should return a tool by name', () => {
      const tool = toolRegistry.get('execute_python');
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('execute_python');
      expect(tool?.description).toBeDefined();
      expect(tool?.category).toBe('code');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolRegistry.get('non_existent_tool');
      
      expect(tool).toBeUndefined();
    });
  });

  describe('listByCategory', () => {
    it('should filter tools by category', () => {
      const codeTools = toolRegistry.listByCategory('code');
      
      expect(codeTools.length).toBeGreaterThan(0);
      codeTools.forEach(tool => {
        expect(tool.category).toBe('code');
      });
    });

    it('should return web tools', () => {
      const webTools = toolRegistry.listByCategory('web');
      
      expect(webTools.length).toBeGreaterThan(0);
      webTools.forEach(tool => {
        expect(tool.category).toBe('web');
      });
    });

    it('should return system tools', () => {
      const systemTools = toolRegistry.listByCategory('system');
      
      expect(systemTools.length).toBeGreaterThan(0);
      systemTools.forEach(tool => {
        expect(tool.category).toBe('system');
      });
    });
  });

  describe('generateToolsDescription', () => {
    it('should generate a description string for all tools', () => {
      const description = toolRegistry.generateToolsDescription();
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('execute_python');
      expect(description).toContain('web_search');
    });
  });

  describe('generateToolsSchema', () => {
    it('should generate JSON schema for tools', () => {
      const schema = toolRegistry.generateToolsSchema();
      
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      
      // Vérifier la structure du schéma
      const firstTool = schema[0];
      expect(firstTool.type).toBe('function');
      expect(firstTool.function).toBeDefined();
      expect(firstTool.function.name).toBeDefined();
      expect(firstTool.function.description).toBeDefined();
      expect(firstTool.function.parameters).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should return error for non-existent tool', async () => {
      const result = await toolRegistry.execute(
        'non_existent_tool',
        {},
        { userId: 'test-user', sessionId: 'test-session' }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('non trouvé');
    });

    it('should return error for missing required parameters', async () => {
      const result = await toolRegistry.execute(
        'execute_python',
        {}, // Missing 'code' parameter
        { userId: 'test-user', sessionId: 'test-session' }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('requis');
    });

    it('should execute think tool successfully', async () => {
      const result = await toolRegistry.execute(
        'think',
        { problem: 'Comment résoudre 2+2?' },
        { userId: 'test-user', sessionId: 'test-session' }
      );
      
      // Le résultat dépend du LLM, mais la structure doit être correcte
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.output).toBe('string');
    });
  });

  describe('tool parameters', () => {
    it('should have valid parameter definitions', () => {
      const tools = toolRegistry.listAll();
      
      tools.forEach(tool => {
        expect(tool.parameters).toBeDefined();
        expect(Array.isArray(tool.parameters)).toBe(true);
        
        tool.parameters.forEach(param => {
          expect(param.name).toBeDefined();
          expect(param.type).toBeDefined();
          expect(param.description).toBeDefined();
          expect(typeof param.required).toBe('boolean');
        });
      });
    });
  });
});
