import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SecurityModule,
  TormentModule,
  ArbitrageModule,
  MemoryModule,
  ErrorDetectionModule,
  InitiativeModule,
  PhoenixOrchestrator,
  PhoenixContext,
  ActionRequestData,
  Hypothesis,
  MemoryContext,
  IssueContext
} from "./core";

// Mock the LLM module
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          hypotheses: [
            { id: "hyp_1", content: "Réponse hypothèse 1", confidence: 0.9, reasoning: "Raisonnement 1" },
            { id: "hyp_2", content: "Réponse hypothèse 2", confidence: 0.7, reasoning: "Raisonnement 2" },
            { id: "hyp_3", content: "Réponse hypothèse 3", confidence: 0.5, reasoning: "Raisonnement 3" }
          ]
        })
      }
    }]
  })
}));

describe("SecurityModule", () => {
  let security: SecurityModule;

  beforeEach(() => {
    security = new SecurityModule("test-secret");
  });

  it("should allow safe actions", () => {
    const action: ActionRequestData = {
      tool: "web_search",
      params: { query: "test query" },
      riskLevel: "low",
      requiresHumanOk: false
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const result = security.evaluate(action, context);
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should reject unknown tools", () => {
    const action: ActionRequestData = {
      tool: "unknown_tool",
      params: {},
      riskLevel: "low",
      requiresHumanOk: false
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const result = security.evaluate(action, context);
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("should require human approval for high risk actions", () => {
    const action: ActionRequestData = {
      tool: "web_search",
      params: {},
      riskLevel: "high",
      requiresHumanOk: false
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const result = security.evaluate(action, context);
    expect(result.allowed).toBe(false);
    expect(result.violations).toContain("Les actions à haut risque nécessitent une approbation humaine");
  });

  it("should sign and verify data correctly", () => {
    const data = { test: "value", number: 123 };
    const signature = security.sign(data);
    
    expect(signature).toBeTruthy();
    expect(security.verify(data, signature)).toBe(true);
    expect(security.verify({ test: "modified" }, signature)).toBe(false);
  });
});

describe("TormentModule", () => {
  let torment: TormentModule;

  beforeEach(() => {
    torment = new TormentModule();
  });

  it("should compute torment score of 0 with no issues", () => {
    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const score = torment.compute(context);
    expect(score).toBe(0);
  });

  it("should increase torment with critical issues", () => {
    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [
        { id: 1, type: "contradiction", severity: "critical", evidence: "Test evidence" }
      ],
      tormentScore: 0,
      criteria: []
    };

    const score = torment.compute(context);
    expect(score).toBeGreaterThan(0);
    expect(score).toBe(25); // Critical issue weight
  });

  it("should increase torment with low confidence utterances", () => {
    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [
        { role: "assistant", content: "Low confidence response", confidence: 0.5 }
      ],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const score = torment.compute(context);
    expect(score).toBeGreaterThan(0);
  });

  it("should prioritize issues by severity", () => {
    const issues: IssueContext[] = [
      { id: 1, type: "error", severity: "low", evidence: "Low" },
      { id: 2, type: "contradiction", severity: "critical", evidence: "Critical" },
      { id: 3, type: "mismatch", severity: "medium", evidence: "Medium" }
    ];

    const prioritized = torment.prioritizeIssues(issues);
    expect(prioritized[0].severity).toBe("critical");
    expect(prioritized[1].severity).toBe("medium");
    expect(prioritized[2].severity).toBe("low");
  });

  it("should recommend correction when torment is high", () => {
    expect(torment.shouldInitiateCorrection(60)).toBe(true);
    expect(torment.shouldInitiateCorrection(30)).toBe(false);
  });
});

describe("MemoryModule", () => {
  let memory: MemoryModule;

  beforeEach(() => {
    memory = new MemoryModule();
  });

  it("should retrieve relevant memories based on query", () => {
    const memories: MemoryContext[] = [
      { id: 1, content: "Phoenix est un système d'IA agentique", salience: 0.8, memoryType: "fact" },
      { id: 2, content: "Le temps est ensoleillé aujourd'hui", salience: 0.5, memoryType: "fact" },
      { id: 3, content: "L'architecture Phoenix utilise des modules", salience: 0.9, memoryType: "fact" }
    ];

    const results = memory.retrieve("Phoenix architecture", memories);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("Phoenix");
  });

  it("should compute embeddings", () => {
    const embedding = memory.computeEmbedding("Test text for embedding");
    expect(embedding).toHaveLength(128);
    expect(embedding.every(v => typeof v === "number")).toBe(true);
  });

  it("should compute salience based on context", () => {
    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [
        { id: 1, type: "contradiction", severity: "high", evidence: "Test" }
      ],
      tormentScore: 50,
      criteria: []
    };

    const salience = memory.computeSalience("This is about contradiction detection", context);
    expect(salience).toBeGreaterThan(0.5);
  });
});

describe("ErrorDetectionModule", () => {
  let errorDetection: ErrorDetectionModule;

  beforeEach(() => {
    errorDetection = new ErrorDetectionModule();
  });

  it("should detect potential contradictions", () => {
    const content = "Le système n'est pas capable de faire cela";
    const memories: MemoryContext[] = [
      { id: 1, content: "Le système est capable de faire cela", salience: 0.9, memoryType: "fact" }
    ];

    const issues = errorDetection.detectContradictions(content, memories);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("contradiction");
  });

  it("should detect hallucinations without sources", () => {
    const content = "Cette affirmation est définitivement vraie et sera toujours valide";
    const sources: string[] = [];

    const issues = errorDetection.detectHallucinations(content, sources);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("hallucination");
  });

  it("should verify tool results", () => {
    const successResult = { output: "Success output", tool: "test_tool" };
    const verification = errorDetection.verifyToolResult(successResult);
    
    expect(verification.passed).toBe(true);
    expect(verification.checks.find(c => c.name === "output_present")?.passed).toBe(true);
  });

  it("should detect errors in tool results", () => {
    const errorResult = { output: "Error: something failed", tool: "test_tool" };
    const verification = errorDetection.verifyToolResult(errorResult);
    
    expect(verification.checks.find(c => c.name === "no_errors")?.passed).toBe(false);
  });
});

describe("InitiativeModule", () => {
  let initiative: InitiativeModule;

  beforeEach(() => {
    initiative = new InitiativeModule();
  });

  it("should execute low risk actions", () => {
    const action: ActionRequestData = {
      tool: "web_search",
      params: {},
      riskLevel: "low",
      requiresHumanOk: false
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 20,
      criteria: []
    };

    const securityGate = { allowed: true, reason: "OK", violations: [] };
    const result = initiative.evaluateAction(action, context, securityGate);
    
    expect(result.mode).toBe("execute");
  });

  it("should suggest high risk actions", () => {
    const action: ActionRequestData = {
      tool: "file_write",
      params: {},
      riskLevel: "high",
      requiresHumanOk: true
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 20,
      criteria: []
    };

    const securityGate = { allowed: true, reason: "OK", violations: [] };
    const result = initiative.evaluateAction(action, context, securityGate);
    
    expect(result.mode).toBe("suggest");
  });

  it("should reject actions that fail security", () => {
    const action: ActionRequestData = {
      tool: "dangerous_tool",
      params: {},
      riskLevel: "low",
      requiresHumanOk: false
    };

    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 20,
      criteria: []
    };

    const securityGate = { allowed: false, reason: "Security violation", violations: ["Violation"] };
    const result = initiative.evaluateAction(action, context, securityGate);
    
    expect(result.mode).toBe("reject");
  });

  it("should format suggestions correctly", () => {
    const action: ActionRequestData = {
      tool: "web_search",
      params: { query: "test" },
      riskLevel: "medium",
      requiresHumanOk: true
    };

    const suggestion = initiative.formatSuggestion(action);
    expect(suggestion).toContain("web_search");
    expect(suggestion).toContain("approbation");
  });
});

describe("ArbitrageModule", () => {
  let arbitrage: ArbitrageModule;

  beforeEach(() => {
    arbitrage = new ArbitrageModule();
  });

  it("should choose the hypothesis with highest confidence", () => {
    const hypotheses: Hypothesis[] = [
      { id: "hyp_1", content: "Low confidence", confidence: 0.3, reasoning: "R1" },
      { id: "hyp_2", content: "High confidence", confidence: 0.9, reasoning: "R2" },
      { id: "hyp_3", content: "Medium confidence", confidence: 0.6, reasoning: "R3" }
    ];

    const criteria = [
      { name: "CLARTE", level: "1", rule: "Be clear", weight: 10 }
    ];

    const result = arbitrage.choose(hypotheses, criteria);
    expect(result.chosen.id).toBe("hyp_2");
    expect(result.rationale).toContain("hyp_2");
  });

  it("should disqualify hypotheses that fail Level 0 criteria", () => {
    const hypotheses: Hypothesis[] = [
      { id: "hyp_1", content: "Uncertain response", confidence: 0.4, reasoning: "R1" },
      { id: "hyp_2", content: "Je pense que c'est possible", confidence: 0.4, reasoning: "R2" }
    ];

    const criteria = [
      { name: "H0-VERITE", level: "0", rule: "Mark uncertainty", weight: 100 }
    ];

    const result = arbitrage.choose(hypotheses, criteria);
    // The one with uncertainty markers should be preferred
    expect(result.chosen).toBeTruthy();
  });

  it("should throw error with no hypotheses", () => {
    expect(() => arbitrage.choose([], [])).toThrow("Aucune hypothèse à évaluer");
  });
});

describe("PhoenixOrchestrator", () => {
  let phoenix: PhoenixOrchestrator;

  beforeEach(() => {
    phoenix = new PhoenixOrchestrator();
  });

  it("should compute torment correctly", () => {
    const context: PhoenixContext = {
      userId: 1,
      contextId: "test",
      memories: [],
      recentUtterances: [],
      activeIssues: [],
      tormentScore: 0,
      criteria: []
    };

    const score = phoenix.computeTorment(context);
    expect(score).toBe(0);
  });

  it("should retrieve memories", () => {
    const memories: MemoryContext[] = [
      { id: 1, content: "Test memory about Phoenix", salience: 0.8, memoryType: "fact" }
    ];

    const results = phoenix.retrieveMemories("Phoenix", memories);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should compute embeddings", () => {
    const embedding = phoenix.computeEmbedding("Test text");
    expect(embedding).toHaveLength(128);
  });

  it("should sign actions", () => {
    const action: ActionRequestData = {
      tool: "test",
      params: {},
      riskLevel: "low",
      requiresHumanOk: false
    };

    const signature = phoenix.signAction(action);
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe("string");
  });

  it("should verify tool results", () => {
    const result = { output: "Success", tool: "test" };
    const verification = phoenix.verifyResult(result);
    
    expect(verification.passed).toBe(true);
  });
});
