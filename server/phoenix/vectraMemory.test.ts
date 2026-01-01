import { describe, expect, it, beforeEach, vi } from "vitest";
import { VectraMemoryStore, MemoryEntry, TranspirationEvent } from "./vectraMemory";

// Mock the LLM module
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockRejectedValue(new Error("LLM not available"))
}));

describe("VectraMemoryStore", () => {
  let memoryStore: VectraMemoryStore;

  beforeEach(() => {
    memoryStore = new VectraMemoryStore();
  });

  describe("generateHashEmbedding", () => {
    it("should generate consistent embeddings for the same text", () => {
      const text = "Test text for embedding";
      const embedding1 = (memoryStore as any).generateHashEmbedding(text);
      const embedding2 = (memoryStore as any).generateHashEmbedding(text);
      
      expect(embedding1).toEqual(embedding2);
    });

    it("should generate different embeddings for different texts", () => {
      const embedding1 = (memoryStore as any).generateHashEmbedding("First text");
      const embedding2 = (memoryStore as any).generateHashEmbedding("Second text");
      
      // Embeddings should be different
      expect(embedding1).not.toEqual(embedding2);
    });

    it("should generate embeddings of correct dimension", () => {
      const embedding = (memoryStore as any).generateHashEmbedding("Test");
      
      expect(embedding).toHaveLength(1536); // EMBEDDING_DIMENSION
    });

    it("should generate normalized embeddings", () => {
      const embedding = (memoryStore as any).generateHashEmbedding("Test text");
      
      // Calculate L2 norm
      const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      
      // Should be approximately 1 (normalized)
      expect(norm).toBeCloseTo(1, 5);
    });
  });

  describe("computeSalience", () => {
    it("should return base salience for simple events", () => {
      const event: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Simple response"
      };

      const salience = (memoryStore as any).computeSalience(event);
      expect(salience).toBeGreaterThanOrEqual(0.5);
      expect(salience).toBeLessThanOrEqual(1.0);
    });

    it("should increase salience for user messages", () => {
      const userEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "user",
        content: "User message"
      };

      const assistantEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Assistant message"
      };

      const userSalience = (memoryStore as any).computeSalience(userEvent);
      const assistantSalience = (memoryStore as any).computeSalience(assistantEvent);

      expect(userSalience).toBeGreaterThan(assistantSalience);
    });

    it("should increase salience for questions", () => {
      const questionEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "user",
        content: "What is the meaning of life?"
      };

      const statementEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "user",
        content: "This is a statement"
      };

      const questionSalience = (memoryStore as any).computeSalience(questionEvent);
      const statementSalience = (memoryStore as any).computeSalience(statementEvent);

      expect(questionSalience).toBeGreaterThan(statementSalience);
    });

    it("should increase salience for events with issues", () => {
      const eventWithIssues: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Response with issues",
        issues: ["Contradiction detected"]
      };

      const eventWithoutIssues: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Response without issues"
      };

      const salienceWithIssues = (memoryStore as any).computeSalience(eventWithIssues);
      const salienceWithoutIssues = (memoryStore as any).computeSalience(eventWithoutIssues);

      expect(salienceWithIssues).toBeGreaterThan(salienceWithoutIssues);
    });

    it("should increase salience for low confidence responses", () => {
      const lowConfidenceEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Uncertain response",
        confidence: 0.5
      };

      const highConfidenceEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "assistant",
        content: "Confident response",
        confidence: 0.95
      };

      const lowConfidenceSalience = (memoryStore as any).computeSalience(lowConfidenceEvent);
      const highConfidenceSalience = (memoryStore as any).computeSalience(highConfidenceEvent);

      expect(lowConfidenceSalience).toBeGreaterThan(highConfidenceSalience);
    });

    it("should cap salience at 1.0", () => {
      const maxEvent: TranspirationEvent = {
        userId: 1,
        contextId: "test",
        role: "user",
        content: "This is a very long question that should have high salience? " + "x".repeat(200),
        confidence: 0.3,
        issues: ["Issue 1", "Issue 2", "Issue 3"]
      };

      const salience = (memoryStore as any).computeSalience(maxEvent);
      expect(salience).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Memory operations", () => {
    it("should generate embedding via public method", async () => {
      const embedding = await memoryStore.generateEmbedding("Test text");
      
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => typeof v === "number")).toBe(true);
    });
  });
});

describe("VectraMemoryStore - Transpiration Logic", () => {
  let memoryStore: VectraMemoryStore;

  beforeEach(() => {
    memoryStore = new VectraMemoryStore();
  });

  it("should have transpire method", () => {
    expect(typeof memoryStore.transpire).toBe("function");
  });

  it("should have store method", () => {
    expect(typeof memoryStore.store).toBe("function");
  });

  it("should have retrieve method", () => {
    expect(typeof memoryStore.retrieve).toBe("function");
  });

  it("should have consolidate method", () => {
    expect(typeof memoryStore.consolidate).toBe("function");
  });

  it("should have getStats method", () => {
    expect(typeof memoryStore.getStats).toBe("function");
  });
});
