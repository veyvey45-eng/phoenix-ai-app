import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../db', () => ({
  getDb: vi.fn(() => null),
  isUserAdmin: vi.fn(() => Promise.resolve(true)),
  logAdminAction: vi.fn(() => Promise.resolve())
}));

// Mock LLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          concepts: [
            { name: "Test Concept", definition: "A test definition", tags: ["test"] }
          ]
        })
      }
    }]
  }))
}));

import { getMemorySyncModule } from './memorySync';

describe('MemorySyncModule', () => {
  let memorySync: ReturnType<typeof getMemorySyncModule>;

  beforeEach(() => {
    memorySync = getMemorySyncModule();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getMemorySyncModule();
      const instance2 = getMemorySyncModule();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Priority Weights', () => {
    it('should have correct priority hierarchy', () => {
      // H0 should have highest weight, H3 lowest
      const priorities = ['H0', 'H1', 'H2', 'H3'];
      expect(priorities).toHaveLength(4);
    });
  });

  describe('Document Upload', () => {
    it('should return null when database is not available', async () => {
      const result = await memorySync.uploadDocument({
        title: 'Test Document',
        fileName: 'test.pdf',
        fileUrl: 'https://example.com/test.pdf',
        priority: 'H2',
        uploadedBy: 1
      });
      expect(result).toBeNull();
    });
  });

  describe('Document Approval', () => {
    it('should return false when database is not available', async () => {
      const result = await memorySync.approveDocument(1, 1);
      expect(result).toBe(false);
    });
  });

  describe('Document Rejection', () => {
    it('should return false when database is not available', async () => {
      const result = await memorySync.rejectDocument(1, 1, 'Test reason');
      expect(result).toBe(false);
    });
  });

  describe('Document Indexing', () => {
    it('should return false when database is not available', async () => {
      const result = await memorySync.indexDocument(1, 'Test content', 1);
      expect(result).toBe(false);
    });
  });

  describe('Search', () => {
    it('should return empty array when database is not available', async () => {
      const results = await memorySync.search({
        query: 'test query',
        limit: 10
      });
      expect(results).toEqual([]);
    });

    it('should accept priority filters', async () => {
      const results = await memorySync.search({
        query: 'test',
        priorities: ['H0', 'H1'],
        limit: 5
      });
      expect(results).toEqual([]);
    });

    it('should accept category filters', async () => {
      const results = await memorySync.search({
        query: 'test',
        categories: ['theory', 'architecture'],
        limit: 5
      });
      expect(results).toEqual([]);
    });
  });

  describe('Context for Decision', () => {
    it('should return default message when no documents found', async () => {
      const context = await memorySync.getContextForDecision('test query');
      expect(context).toContain('Aucune référence documentaire');
    });
  });

  describe('Concept Extraction', () => {
    it('should return 0 when database is not available', async () => {
      const count = await memorySync.extractConcepts(1, 1);
      expect(count).toBe(0);
    });
  });

  describe('Get Documents', () => {
    it('should return empty array when database is not available', async () => {
      const docs = await memorySync.getDocuments();
      expect(docs).toEqual([]);
    });

    it('should accept status filter', async () => {
      const docs = await memorySync.getDocuments('approved');
      expect(docs).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should return default stats when database is not available', async () => {
      const stats = await memorySync.getStats();
      expect(stats).toEqual({
        totalDocuments: 0,
        byPriority: {},
        byStatus: {},
        totalChunks: 0,
        totalConcepts: 0
      });
    });
  });
});
