import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SleepModule, getSleepModule } from './sleepModule';

// Mock the dependencies
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: 'Test theme or insight'
      }
    }]
  })
}));

vi.mock('./vectraMemory', () => ({
  getMemoryStore: vi.fn().mockReturnValue({
    retrieve: vi.fn().mockResolvedValue([]),
    store: vi.fn().mockResolvedValue({ id: 'test-id' })
  })
}));

describe('SleepModule', () => {
  let sleepModule: SleepModule;

  beforeEach(() => {
    sleepModule = new SleepModule();
  });

  describe('Initialization', () => {
    it('should create a SleepModule instance', () => {
      expect(sleepModule).toBeInstanceOf(SleepModule);
    });

    it('should return singleton via getSleepModule', () => {
      const instance1 = getSleepModule();
      const instance2 = getSleepModule();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Statistics', () => {
    it('should return default stats for new user', () => {
      const stats = sleepModule.getStats(999);
      expect(stats).toEqual({
        lastConsolidation: null,
        totalConsolidations: 0,
        totalMerged: 0,
        totalInsights: 0
      });
    });
  });

  describe('Consolidation', () => {
    it('should return empty result when not enough memories', async () => {
      const result = await sleepModule.consolidate(1);
      
      expect(result).toHaveProperty('merged');
      expect(result).toHaveProperty('reinforced');
      expect(result).toHaveProperty('insightsGenerated');
      expect(result).toHaveProperty('patternsDetected');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('should return result with duration', async () => {
      // Run consolidation
      const result = await sleepModule.consolidate(1);
      
      // Duration should always be tracked
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.merged).toBe(0);
      expect(result.reinforced).toBe(0);
      expect(result.insightsGenerated).toBe(0);
    });
  });
});

describe('Embeddings Integration', () => {
  it('should have cosineSimilarity function', async () => {
    const { cosineSimilarity } = await import('./embeddings');
    
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const similarity = cosineSimilarity(vecA, vecB);
    
    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should compute similarity between different vectors', async () => {
    const { cosineSimilarity } = await import('./embeddings');
    
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const similarity = cosineSimilarity(vecA, vecB);
    
    expect(similarity).toBeCloseTo(0, 5);
  });

  it('should generate hash embedding', async () => {
    const { generateHashEmbedding } = await import('./embeddings');
    
    const embedding = generateHashEmbedding('Test text for embedding');
    
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536);
    expect(embedding.every(v => typeof v === 'number')).toBe(true);
  });

  it('should generate consistent embeddings for same text', async () => {
    const { generateHashEmbedding } = await import('./embeddings');
    
    const text = 'Consistent test text';
    const embedding1 = generateHashEmbedding(text);
    const embedding2 = generateHashEmbedding(text);
    
    expect(embedding1).toEqual(embedding2);
  });

  it('should generate different embeddings for different texts', async () => {
    const { generateHashEmbedding, cosineSimilarity } = await import('./embeddings');
    
    const embedding1 = generateHashEmbedding('First text');
    const embedding2 = generateHashEmbedding('Completely different content');
    
    const similarity = cosineSimilarity(embedding1, embedding2);
    expect(similarity).toBeLessThan(0.9);
  });
});
