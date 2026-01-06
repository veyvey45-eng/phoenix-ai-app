/**
 * Tests pour le système de sécurité MCP
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getActionTypeFromTool,
  assessRisk,
  requiresConfirmation,
  createConfirmationRequest,
  processConfirmationResponse,
  getPendingConfirmation,
  getUserPendingConfirmations,
  cleanupExpiredConfirmations,
  getRiskLevelLabel,
  RiskLevel,
} from './phoenix/mcpSecurity';

describe('MCP Security Module', () => {
  describe('getActionTypeFromTool', () => {
    it('should identify read operations as read_file', () => {
      expect(getActionTypeFromTool('read_file')).toBe('read_file');
      expect(getActionTypeFromTool('get_content')).toBe('read_file');
      expect(getActionTypeFromTool('list_files')).toBe('read_file');
      expect(getActionTypeFromTool('search_text')).toBe('read_file');
    });

    it('should identify delete operations as delete_file', () => {
      expect(getActionTypeFromTool('delete_file')).toBe('delete_file');
      expect(getActionTypeFromTool('remove_item')).toBe('delete_file');
    });

    it('should identify recursive delete as delete_directory', () => {
      expect(getActionTypeFromTool('delete_directory')).toBe('delete_directory');
      expect(getActionTypeFromTool('remove_folder', { recursive: true })).toBe('delete_directory');
    });

    it('should identify install operations', () => {
      expect(getActionTypeFromTool('npm_install')).toBe('install_package');
      expect(getActionTypeFromTool('pip_install')).toBe('install_package');
    });

    it('should identify execute operations', () => {
      expect(getActionTypeFromTool('execute_command')).toBe('execute_command');
      expect(getActionTypeFromTool('run_shell')).toBe('execute_command');
      expect(getActionTypeFromTool('bash_exec')).toBe('execute_command');
    });

    it('should identify write operations', () => {
      expect(getActionTypeFromTool('write_file')).toBe('write_file');
      expect(getActionTypeFromTool('create_document')).toBe('write_file');
      expect(getActionTypeFromTool('save_content')).toBe('write_file');
    });

    it('should return unknown for unrecognized tools', () => {
      expect(getActionTypeFromTool('some_random_tool')).toBe('unknown');
    });
  });

  describe('assessRisk', () => {
    it('should return LOW risk for read operations', () => {
      const result = assessRisk('read_file', 'read_file', {});
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return MEDIUM risk for write operations', () => {
      const result = assessRisk('write_file', 'write_file', {});
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should return HIGH risk for delete operations', () => {
      const result = assessRisk('delete_file', 'delete_file', {});
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should return CRITICAL risk for dangerous commands', () => {
      const result = assessRisk('execute_command', 'shell', { command: 'rm -rf /' });
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return CRITICAL risk for protected paths', () => {
      const result = assessRisk('delete_file', 'delete', { path: 'C:\\Windows\\System32\\test.dll' });
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.warnings.some(w => w.includes('protégé'))).toBe(true);
    });

    it('should add warning for recursive operations', () => {
      const result = assessRisk('write_file', 'write', { recursive: true });
      expect(result.warnings.some(w => w.includes('récursive'))).toBe(true);
    });
  });

  describe('requiresConfirmation', () => {
    it('should not require confirmation for read operations', () => {
      expect(requiresConfirmation('read_file', {})).toBe(false);
      expect(requiresConfirmation('list_directory', {})).toBe(false);
      expect(requiresConfirmation('search_content', {})).toBe(false);
    });

    it('should require confirmation for write operations', () => {
      expect(requiresConfirmation('write_file', {})).toBe(true);
      expect(requiresConfirmation('create_file', {})).toBe(true);
    });

    it('should require confirmation for delete operations', () => {
      expect(requiresConfirmation('delete_file', {})).toBe(true);
      expect(requiresConfirmation('remove_directory', {})).toBe(true);
    });

    it('should require confirmation for execute operations', () => {
      expect(requiresConfirmation('execute_command', {})).toBe(true);
      expect(requiresConfirmation('run_script', {})).toBe(true);
    });

    it('should require confirmation for install operations', () => {
      expect(requiresConfirmation('npm_install', {})).toBe(true);
      expect(requiresConfirmation('pip_install', {})).toBe(true);
    });
  });

  describe('createConfirmationRequest', () => {
    it('should create a valid confirmation request', () => {
      const request = createConfirmationRequest(
        'user123',
        'delete_file',
        'filesystem',
        { path: '/home/user/test.txt' }
      );

      expect(request.id).toBeDefined();
      expect(request.userId).toBe('user123');
      expect(request.toolName).toBe('delete_file');
      expect(request.serverName).toBe('filesystem');
      expect(request.arguments).toEqual({ path: '/home/user/test.txt' });
      expect(request.riskLevel).toBe(RiskLevel.HIGH);
      expect(request.createdAt).toBeInstanceOf(Date);
      expect(request.expiresAt).toBeInstanceOf(Date);
      expect(request.expiresAt.getTime()).toBeGreaterThan(request.createdAt.getTime());
    });

    it('should store the request for later retrieval', () => {
      const request = createConfirmationRequest(
        'user456',
        'write_file',
        'filesystem',
        { path: '/home/user/new.txt', content: 'test' }
      );

      const retrieved = getPendingConfirmation(request.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(request.id);
    });
  });

  describe('processConfirmationResponse', () => {
    it('should process approval correctly', () => {
      const request = createConfirmationRequest(
        'user789',
        'create_file',
        'filesystem',
        { path: '/home/user/approved.txt' }
      );

      const response = processConfirmationResponse(request.id, true);
      expect(response).not.toBeNull();
      expect(response?.approved).toBe(true);
      expect(response?.respondedAt).toBeInstanceOf(Date);

      // Request should be removed after processing
      expect(getPendingConfirmation(request.id)).toBeNull();
    });

    it('should process rejection correctly', () => {
      const request = createConfirmationRequest(
        'user101',
        'delete_file',
        'filesystem',
        { path: '/home/user/rejected.txt' }
      );

      const response = processConfirmationResponse(request.id, false, 'Too risky');
      expect(response).not.toBeNull();
      expect(response?.approved).toBe(false);
      expect(response?.reason).toBe('Too risky');
    });

    it('should return null for non-existent request', () => {
      const response = processConfirmationResponse('non_existent_id', true);
      expect(response).toBeNull();
    });
  });

  describe('getUserPendingConfirmations', () => {
    it('should return all pending confirmations for a user', () => {
      const userId = 'testuser_' + Date.now();
      
      createConfirmationRequest(userId, 'write_file', 'fs', { path: '/test1.txt' });
      createConfirmationRequest(userId, 'delete_file', 'fs', { path: '/test2.txt' });
      createConfirmationRequest('other_user', 'write_file', 'fs', { path: '/test3.txt' });

      const userRequests = getUserPendingConfirmations(userId);
      expect(userRequests.length).toBe(2);
      expect(userRequests.every(r => r.userId === userId)).toBe(true);
    });
  });

  describe('getRiskLevelLabel', () => {
    it('should return correct labels for each risk level', () => {
      expect(getRiskLevelLabel(RiskLevel.LOW).label).toBe('Faible');
      expect(getRiskLevelLabel(RiskLevel.LOW).emoji).toBe('✅');
      
      expect(getRiskLevelLabel(RiskLevel.MEDIUM).label).toBe('Moyen');
      expect(getRiskLevelLabel(RiskLevel.MEDIUM).emoji).toBe('⚠️');
      
      expect(getRiskLevelLabel(RiskLevel.HIGH).label).toBe('Élevé');
      expect(getRiskLevelLabel(RiskLevel.HIGH).emoji).toBe('🔶');
      
      expect(getRiskLevelLabel(RiskLevel.CRITICAL).label).toBe('CRITIQUE');
      expect(getRiskLevelLabel(RiskLevel.CRITICAL).emoji).toBe('🚨');
    });
  });

  describe('cleanupExpiredConfirmations', () => {
    it('should clean up expired confirmations', () => {
      // This test verifies the cleanup function runs without error
      // Actual expiration testing would require mocking Date
      const cleaned = cleanupExpiredConfirmations();
      expect(typeof cleaned).toBe('number');
    });
  });
});
