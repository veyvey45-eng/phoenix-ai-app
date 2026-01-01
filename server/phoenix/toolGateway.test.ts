import { describe, it, expect, beforeEach } from "vitest";
import {
  ToolGateway,
  PolicyEngine,
  SignatureService,
  ActionRequest,
  ScopeCategory,
  RiskLevel
} from "./toolGateway";

describe("ToolGateway", () => {
  let gateway: ToolGateway;

  beforeEach(() => {
    gateway = new ToolGateway();
  });

  describe("createActionRequest", () => {
    it("should create a valid action request with all fields", () => {
      const request = gateway.createActionRequest(
        "calculator",
        { expression: "2+2" },
        ["tool:calculator", "data:read"],
        "low",
        1,
        "ctx_123"
      );

      expect(request.id).toMatch(/^action_/);
      expect(request.tool).toBe("calculator");
      expect(request.params).toEqual({ expression: "2+2" });
      expect(request.scopes).toEqual(["tool:calculator", "data:read"]);
      expect(request.riskLevel).toBe("low");
      expect(request.userId).toBe(1);
      expect(request.contextId).toBe("ctx_123");
      expect(request.requiresHumanOk).toBe(false);
    });

    it("should set requiresHumanOk to true for high risk actions", () => {
      const request = gateway.createActionRequest(
        "email_send",
        { to: "test@example.com" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      expect(request.requiresHumanOk).toBe(true);
    });

    it("should set requiresHumanOk to true for critical risk actions", () => {
      const request = gateway.createActionRequest(
        "payment",
        { amount: 100 },
        ["act:payment"],
        "critical",
        1,
        "ctx_123"
      );

      expect(request.requiresHumanOk).toBe(true);
    });
  });

  describe("evaluate", () => {
    it("should allow low risk calculator tool", () => {
      const request = gateway.createActionRequest(
        "calculator",
        { expression: "2+2" },
        ["tool:calculator", "data:read"],
        "low",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.signature).toBeDefined();
      expect(decision.signature?.algorithm).toBe("HMAC-SHA256");
    });

    it("should allow web search tool", () => {
      const request = gateway.createActionRequest(
        "web_search",
        { query: "phoenix ai" },
        ["tool:web_search", "data:read", "net:http_get"],
        "low",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);

      expect(decision.allowed).toBe(true);
      expect(decision.signature).toBeDefined();
    });

    it("should require human approval for email sending", () => {
      const request = gateway.createActionRequest(
        "email_send",
        { to: "test@example.com", subject: "Test" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);

      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.signature).toBeUndefined();
    });

    it("should require human approval for payment actions", () => {
      const request = gateway.createActionRequest(
        "payment",
        { amount: 100, currency: "EUR" },
        ["act:payment"],
        "critical",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);

      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(true);
    });

    it("should deny unknown tools by default", () => {
      const request = gateway.createActionRequest(
        "unknown_dangerous_tool",
        {},
        ["unknown:scope" as ScopeCategory],
        "low",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);

      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(false);
    });
  });

  describe("approve and reject", () => {
    it("should approve pending action and return signature", () => {
      const request = gateway.createActionRequest(
        "email_send",
        { to: "test@example.com" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      // First evaluate - should require approval
      gateway.evaluate(request);

      // Then approve
      const decision = gateway.approve(request.id, "admin_user");

      expect(decision.allowed).toBe(true);
      expect(decision.signature).toBeDefined();
      expect(decision.reason).toContain("admin_user");
    });

    it("should reject pending action", () => {
      const request = gateway.createActionRequest(
        "email_send",
        { to: "test@example.com" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      // First evaluate - should require approval
      gateway.evaluate(request);

      // Then reject
      const decision = gateway.reject(request.id, "Destinataire non autorisé");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Destinataire non autorisé");
      expect(decision.violations).toContain("human_rejected");
    });

    it("should return error for non-existent action", () => {
      const decision = gateway.approve("non_existent_action", "admin");

      expect(decision.allowed).toBe(false);
      expect(decision.violations).toContain("action_not_found");
    });
  });

  describe("canExecute", () => {
    it("should allow execution with valid signature", () => {
      const request = gateway.createActionRequest(
        "calculator",
        { expression: "2+2" },
        ["tool:calculator", "data:read"],
        "low",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);
      expect(decision.signature).toBeDefined();

      const result = gateway.canExecute(request, decision.signature!);

      expect(result.canExecute).toBe(true);
      expect(result.reason).toBe("Exécution autorisée");
    });

    it("should reject execution with tampered request", () => {
      const request = gateway.createActionRequest(
        "calculator",
        { expression: "2+2" },
        ["tool:calculator", "data:read"],
        "low",
        1,
        "ctx_123"
      );

      const decision = gateway.evaluate(request);
      expect(decision.signature).toBeDefined();

      // Tamper with the request
      const tamperedRequest = { ...request, params: { expression: "rm -rf /" } };

      const result = gateway.canExecute(tamperedRequest, decision.signature!);

      expect(result.canExecute).toBe(false);
      expect(result.reason).toBe("Signature invalide");
    });
  });

  describe("getPendingApprovals", () => {
    it("should return list of pending approvals", () => {
      const request1 = gateway.createActionRequest(
        "email_send",
        { to: "test1@example.com" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      const request2 = gateway.createActionRequest(
        "payment",
        { amount: 50 },
        ["act:payment"],
        "critical",
        1,
        "ctx_456"
      );

      gateway.evaluate(request1);
      gateway.evaluate(request2);

      const pending = gateway.getPendingApprovals();

      expect(pending.length).toBe(2);
      expect(pending.map(p => p.tool)).toContain("email_send");
      expect(pending.map(p => p.tool)).toContain("payment");
    });

    it("should remove approved actions from pending list", () => {
      const request = gateway.createActionRequest(
        "email_send",
        { to: "test@example.com" },
        ["act:email_send"],
        "high",
        1,
        "ctx_123"
      );

      gateway.evaluate(request);
      expect(gateway.getPendingApprovals().length).toBe(1);

      gateway.approve(request.id, "admin");
      expect(gateway.getPendingApprovals().length).toBe(0);
    });
  });
});

describe("PolicyEngine", () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe("evaluate", () => {
    it("should match tool-specific rules", () => {
      const request: ActionRequest = {
        id: "action_1",
        tool: "calculator",
        params: {},
        scopes: ["tool:calculator", "data:read"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const result = engine.evaluate(request);

      expect(result.action).toBe("allow");
      expect(result.matchedRule).toBe("allow_calculator");
    });

    it("should match risk level rules", () => {
      const request: ActionRequest = {
        id: "action_1",
        tool: "dangerous_tool",
        params: {},
        scopes: [],
        riskLevel: "high",
        requiresHumanOk: true,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const result = engine.evaluate(request);

      expect(result.action).toBe("ask_human");
      expect(result.matchedRule).toBe("require_human_for_high_risk");
    });

    it("should match scope-based rules", () => {
      const request: ActionRequest = {
        id: "action_1",
        tool: "custom_tool",
        params: {},
        scopes: ["act:payment"],
        riskLevel: "medium",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const result = engine.evaluate(request);

      expect(result.action).toBe("ask_human");
      expect(result.matchedRule).toBe("require_human_for_payment");
    });
  });
});

describe("SignatureService", () => {
  let service: SignatureService;

  beforeEach(() => {
    service = new SignatureService("test-secret-key", "test_key_v1");
  });

  describe("sign", () => {
    it("should create a valid signature", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const signature = service.sign(request);

      expect(signature.id).toMatch(/^sig_/);
      expect(signature.actionId).toBe("action_123");
      expect(signature.algorithm).toBe("HMAC-SHA256");
      expect(signature.keyId).toBe("test_key_v1");
      expect(signature.signature).toHaveLength(64); // SHA256 hex
      expect(signature.issuedAt).toBeInstanceOf(Date);
      expect(signature.expiresAt).toBeInstanceOf(Date);
      expect(signature.expiresAt.getTime()).toBeGreaterThan(signature.issuedAt.getTime());
    });

    it("should produce deterministic signatures for same input", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const sig1 = service.sign(request);
      const sig2 = service.sign(request);

      expect(sig1.signature).toBe(sig2.signature);
    });
  });

  describe("verify", () => {
    it("should verify valid signature", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const signature = service.sign(request);
      const result = service.verify(request, signature);

      expect(result.valid).toBe(true);
      expect(result.reason).toBe("Signature valide");
    });

    it("should reject tampered request", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const signature = service.sign(request);
      
      // Tamper with request
      const tamperedRequest = { ...request, params: { expression: "malicious" } };
      const result = service.verify(tamperedRequest, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature invalide");
    });

    it("should reject expired signature", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const signature = service.sign(request);
      
      // Manually expire the signature
      signature.expiresAt = new Date(Date.now() - 1000);
      
      const result = service.verify(request, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature expirée");
    });

    it("should reject mismatched action ID", () => {
      const request: ActionRequest = {
        id: "action_123",
        tool: "calculator",
        params: { expression: "2+2" },
        scopes: ["tool:calculator"],
        riskLevel: "low",
        requiresHumanOk: false,
        requestedAt: new Date(),
        userId: 1,
        contextId: "ctx_1"
      };

      const signature = service.sign(request);
      
      // Change action ID
      const differentRequest = { ...request, id: "action_456" };
      const result = service.verify(differentRequest, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Action ID mismatch");
    });
  });
});
