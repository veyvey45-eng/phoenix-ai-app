import { describe, it, expect, beforeEach } from "vitest";
import { ArbitrageModule } from "./core";
import type { PhoenixContext, UtteranceContext } from "./core";

describe("Conversation History in Phoenix", () => {
  let arbitrage: ArbitrageModule;

  beforeEach(() => {
    arbitrage = new ArbitrageModule();
  });

  describe("buildSystemPrompt includes conversation history", () => {
    it("should include recent utterances in the system prompt", () => {
      // Access the private method via prototype for testing
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [
          { role: "user", content: "Quelle est la capitale de la France?", confidence: 1.0 },
          { role: "assistant", content: "La capitale de la France est Paris.", confidence: 0.95 },
          { role: "user", content: "Et de l'Allemagne?", confidence: 1.0 }
        ],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      // Verify the prompt contains the conversation history section
      expect(prompt).toContain("HISTORIQUE DE CONVERSATION RÉCENT");
      expect(prompt).toContain("Quelle est la capitale de la France?");
      expect(prompt).toContain("La capitale de la France est Paris.");
      expect(prompt).toContain("Et de l'Allemagne?");
    });

    it("should format user messages correctly", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [
          { role: "user", content: "Test message", confidence: 1.0 }
        ],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain("**Utilisateur**: Test message");
    });

    it("should format assistant messages correctly", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [
          { role: "assistant", content: "Response message", confidence: 0.9 }
        ],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain("**Phoenix**: Response message");
    });

    it("should truncate long messages", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const longMessage = "A".repeat(500);
      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [
          { role: "user", content: longMessage, confidence: 1.0 }
        ],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      // Should be truncated to 300 chars + "..."
      expect(prompt).toContain("A".repeat(300) + "...");
      expect(prompt).not.toContain("A".repeat(400));
    });

    it("should handle empty conversation history", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      // Should not contain the history section if empty
      expect(prompt).not.toContain("HISTORIQUE DE CONVERSATION RÉCENT");
    });

    it("should include instruction for reprendre dernière question", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain("Reprends ma dernière question");
    });

    it("should preserve chronological order (oldest to newest)", () => {
      const buildSystemPrompt = (arbitrage as any).buildSystemPrompt.bind(arbitrage);

      const context: PhoenixContext = {
        userId: 1,
        contextId: "test-context",
        memories: [],
        recentUtterances: [
          { role: "user", content: "First message", confidence: 1.0 },
          { role: "assistant", content: "First response", confidence: 0.9 },
          { role: "user", content: "Second message", confidence: 1.0 },
          { role: "assistant", content: "Second response", confidence: 0.9 }
        ],
        activeIssues: [],
        tormentScore: 0,
        criteria: []
      };

      const prompt = buildSystemPrompt(context);

      // Verify order: first message should appear before second message
      const firstIndex = prompt.indexOf("First message");
      const secondIndex = prompt.indexOf("Second message");
      
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });
});
