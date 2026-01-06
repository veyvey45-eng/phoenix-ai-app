/**
 * Tests for MCP Bridge Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPBridgeClient, getMCPBridge, resetMCPBridge } from './mcpBridge';

// Mock WebSocket
vi.mock('ws', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    })),
  };
});

describe('MCPBridgeClient', () => {
  let client: MCPBridgeClient;

  beforeEach(() => {
    resetMCPBridge();
    client = new MCPBridgeClient();
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('initialization', () => {
    it('should create a new instance', () => {
      expect(client).toBeInstanceOf(MCPBridgeClient);
    });

    it('should start disconnected', () => {
      const status = client.getStatus();
      expect(status.connected).toBe(false);
      expect(status.authenticated).toBe(false);
      expect(status.activeMCPs).toEqual([]);
    });

    it('should not be ready initially', () => {
      expect(client.isReady()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return a copy of the status', () => {
      const status1 = client.getStatus();
      const status2 = client.getStatus();
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });

    it('should include all required fields', () => {
      const status = client.getStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('authenticated');
      expect(status).toHaveProperty('activeMCPs');
    });
  });

  describe('disconnect', () => {
    it('should reset status on disconnect', () => {
      client.disconnect();
      const status = client.getStatus();
      expect(status.connected).toBe(false);
      expect(status.authenticated).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return the same instance from getMCPBridge', () => {
      const instance1 = getMCPBridge();
      const instance2 = getMCPBridge();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = getMCPBridge();
      resetMCPBridge();
      const instance2 = getMCPBridge();
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('MCPBridgeClient message handlers', () => {
  let client: MCPBridgeClient;

  beforeEach(() => {
    resetMCPBridge();
    client = new MCPBridgeClient();
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should register message handlers', () => {
    const handler = vi.fn();
    client.on('test', handler);
    // Handler is registered but won't be called without actual WebSocket
    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove message handlers', () => {
    const handler = vi.fn();
    client.on('test', handler);
    client.off('test', handler);
    // Handler is removed
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle once handlers', () => {
    const handler = vi.fn();
    client.once('test', handler);
    // Handler is registered for one-time use
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('MCPBridge types', () => {
  it('should have correct MCPServer structure', () => {
    const server = {
      id: 'test-server',
      name: 'Test Server',
      command: 'npx',
      args: ['-y', '@test/mcp-server'],
      env: { TEST_VAR: 'value' },
      status: 'available' as const,
      source: 'config' as const,
    };

    expect(server.id).toBe('test-server');
    expect(server.status).toBe('available');
    expect(server.source).toBe('config');
  });

  it('should have correct MCPTool structure', () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    };

    expect(tool.name).toBe('test_tool');
    expect(tool.inputSchema.type).toBe('object');
  });

  it('should have correct MCPBridgeConfig structure', () => {
    const config = {
      url: 'ws://localhost:8765',
      secret: 'test-secret',
    };

    expect(config.url).toBe('ws://localhost:8765');
    expect(config.secret).toBe('test-secret');
  });
});
