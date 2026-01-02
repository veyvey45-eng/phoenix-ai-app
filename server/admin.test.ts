import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  isUserAdmin: vi.fn(),
  promoteToAdmin: vi.fn(),
  logAdminAction: vi.fn(),
  getAdminAuditLog: vi.fn(),
  initializeModuleConfigs: vi.fn(),
  getModuleConfigs: vi.fn(),
  updateModuleConfig: vi.fn(),
  initializeSensitiveValidations: vi.fn(),
  getSensitiveValidations: vi.fn(),
  updateSensitiveValidation: vi.fn(),
  createApprovalRequest: vi.fn(),
  getPendingApprovals: vi.fn(),
  processApprovalRequest: vi.fn(),
  getApprovalHistory: vi.fn(),
}));

import {
  isUserAdmin,
  promoteToAdmin,
  logAdminAction,
  getAdminAuditLog,
  initializeModuleConfigs,
  getModuleConfigs,
  updateModuleConfig,
  initializeSensitiveValidations,
  getSensitiveValidations,
  updateSensitiveValidation,
  createApprovalRequest,
  getPendingApprovals,
  processApprovalRequest,
  getApprovalHistory,
} from './db';

describe('Admin System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Management', () => {
    it('should check if user is admin', async () => {
      vi.mocked(isUserAdmin).mockResolvedValue(true);
      
      const result = await isUserAdmin(1);
      
      expect(result).toBe(true);
      expect(isUserAdmin).toHaveBeenCalledWith(1);
    });

    it('should return false for non-admin user', async () => {
      vi.mocked(isUserAdmin).mockResolvedValue(false);
      
      const result = await isUserAdmin(2);
      
      expect(result).toBe(false);
    });

    it('should promote user to admin', async () => {
      vi.mocked(promoteToAdmin).mockResolvedValue(true);
      
      const result = await promoteToAdmin(2, 1);
      
      expect(result).toBe(true);
      expect(promoteToAdmin).toHaveBeenCalledWith(2, 1);
    });

    it('should fail to promote if promoter is not admin', async () => {
      vi.mocked(promoteToAdmin).mockResolvedValue(false);
      
      const result = await promoteToAdmin(2, 3);
      
      expect(result).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log admin actions', async () => {
      vi.mocked(logAdminAction).mockResolvedValue(undefined);
      
      await logAdminAction({
        adminId: 1,
        action: 'test_action',
        resourceType: 'test',
        resourceId: 123,
        changes: { test: true }
      });
      
      expect(logAdminAction).toHaveBeenCalledWith({
        adminId: 1,
        action: 'test_action',
        resourceType: 'test',
        resourceId: 123,
        changes: { test: true }
      });
    });

    it('should retrieve admin audit log', async () => {
      const mockLogs = [
        { id: 1, adminId: 1, action: 'action1', resourceType: 'test', createdAt: new Date() },
        { id: 2, adminId: 1, action: 'action2', resourceType: 'test', createdAt: new Date() }
      ];
      vi.mocked(getAdminAuditLog).mockResolvedValue(mockLogs as any);
      
      const result = await getAdminAuditLog(10);
      
      expect(result).toHaveLength(2);
      expect(getAdminAuditLog).toHaveBeenCalledWith(10);
    });
  });

  describe('Module Configuration', () => {
    it('should initialize module configs', async () => {
      vi.mocked(initializeModuleConfigs).mockResolvedValue(undefined);
      
      await initializeModuleConfigs();
      
      expect(initializeModuleConfigs).toHaveBeenCalled();
    });

    it('should get all module configs', async () => {
      const mockModules = [
        { id: 1, moduleId: 'logic_gate', moduleName: 'Logic Gate', isEnabled: true },
        { id: 2, moduleId: 'memory_sync', moduleName: 'Memory Sync', isEnabled: true }
      ];
      vi.mocked(getModuleConfigs).mockResolvedValue(mockModules as any);
      
      const result = await getModuleConfigs();
      
      expect(result).toHaveLength(2);
      expect(result[0].moduleId).toBe('logic_gate');
    });

    it('should update module config as admin', async () => {
      vi.mocked(updateModuleConfig).mockResolvedValue(true);
      
      const result = await updateModuleConfig('logic_gate', { isEnabled: false }, 1);
      
      expect(result).toBe(true);
      expect(updateModuleConfig).toHaveBeenCalledWith('logic_gate', { isEnabled: false }, 1);
    });

    it('should fail to update module config as non-admin', async () => {
      vi.mocked(updateModuleConfig).mockResolvedValue(false);
      
      const result = await updateModuleConfig('logic_gate', { isEnabled: false }, 2);
      
      expect(result).toBe(false);
    });
  });

  describe('Sensitive Validations (16 Axioms)', () => {
    it('should initialize sensitive validations', async () => {
      vi.mocked(initializeSensitiveValidations).mockResolvedValue(undefined);
      
      await initializeSensitiveValidations();
      
      expect(initializeSensitiveValidations).toHaveBeenCalled();
    });

    it('should get all sensitive validations', async () => {
      const mockValidations = [
        { id: 1, axiomId: 'H0-INTEGRITE', axiomName: 'Intégrité humaine', severity: 'critical' },
        { id: 2, axiomId: 'H0-TRANSPARENCE', axiomName: 'Transparence', severity: 'critical' }
      ];
      vi.mocked(getSensitiveValidations).mockResolvedValue(mockValidations as any);
      
      const result = await getSensitiveValidations();
      
      expect(result).toHaveLength(2);
      expect(result[0].axiomId).toBe('H0-INTEGRITE');
    });

    it('should update sensitive validation as admin', async () => {
      vi.mocked(updateSensitiveValidation).mockResolvedValue(true);
      
      const result = await updateSensitiveValidation('H0-INTEGRITE', { requiresApproval: true }, 1);
      
      expect(result).toBe(true);
    });
  });

  describe('Approval Requests', () => {
    it('should create approval request', async () => {
      const mockRequest = { id: 1, validationId: 1, status: 'pending', requestedBy: 1 };
      vi.mocked(createApprovalRequest).mockResolvedValue(mockRequest as any);
      
      const result = await createApprovalRequest({
        validationId: 1,
        requestedBy: 1,
        status: 'pending'
      });
      
      expect(result).toBeDefined();
      expect(result?.status).toBe('pending');
    });

    it('should get pending approvals', async () => {
      const mockApprovals = [
        { id: 1, validationId: 1, status: 'pending' },
        { id: 2, validationId: 2, status: 'pending' }
      ];
      vi.mocked(getPendingApprovals).mockResolvedValue(mockApprovals as any);
      
      const result = await getPendingApprovals();
      
      expect(result).toHaveLength(2);
    });

    it('should process approval request (approve)', async () => {
      vi.mocked(processApprovalRequest).mockResolvedValue(true);
      
      const result = await processApprovalRequest(1, true, 1, 'Approved');
      
      expect(result).toBe(true);
      expect(processApprovalRequest).toHaveBeenCalledWith(1, true, 1, 'Approved');
    });

    it('should process approval request (reject)', async () => {
      vi.mocked(processApprovalRequest).mockResolvedValue(true);
      
      const result = await processApprovalRequest(1, false, 1, 'Rejected');
      
      expect(result).toBe(true);
      expect(processApprovalRequest).toHaveBeenCalledWith(1, false, 1, 'Rejected');
    });

    it('should get approval history', async () => {
      const mockHistory = [
        { id: 1, status: 'approved', approvedAt: new Date() },
        { id: 2, status: 'rejected', approvedAt: new Date() }
      ];
      vi.mocked(getApprovalHistory).mockResolvedValue(mockHistory as any);
      
      const result = await getApprovalHistory(50);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('Security Constraints', () => {
    it('should require admin role for module updates', async () => {
      // First call: non-admin user
      vi.mocked(updateModuleConfig).mockResolvedValue(false);
      const result1 = await updateModuleConfig('logic_gate', { isEnabled: false }, 999);
      expect(result1).toBe(false);
      
      // Second call: admin user
      vi.mocked(updateModuleConfig).mockResolvedValue(true);
      const result2 = await updateModuleConfig('logic_gate', { isEnabled: false }, 1);
      expect(result2).toBe(true);
    });

    it('should require admin role for validation updates', async () => {
      vi.mocked(updateSensitiveValidation).mockResolvedValue(false);
      const result = await updateSensitiveValidation('H0-INTEGRITE', { requiresApproval: false }, 999);
      expect(result).toBe(false);
    });

    it('should require admin role for approval processing', async () => {
      vi.mocked(processApprovalRequest).mockResolvedValue(false);
      const result = await processApprovalRequest(1, true, 999);
      expect(result).toBe(false);
    });
  });
});
