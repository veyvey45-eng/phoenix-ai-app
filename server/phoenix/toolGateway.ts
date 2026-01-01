/**
 * PHOENIX TOOL GATEWAY - Système de permissions et signatures pour actions outillées
 * 
 * Ce module implémente le pattern "default deny" avec signatures HMAC-SHA256
 * pour sécuriser l'exécution des outils par Phoenix.
 * 
 * Architecture:
 * 1. Chaque action doit être évaluée par le Policy Engine
 * 2. Les actions autorisées reçoivent une signature
 * 3. Le Tool Gateway vérifie la signature avant exécution
 * 4. Les actions sensibles nécessitent une approbation humaine
 */

import { createHmac, randomUUID } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ScopeCategory = 
  | "data:read" | "data:write" 
  | "memory:read" | "memory:write"
  | "tool:web_search" | "tool:calculator" | "tool:file_read" | "tool:datetime"
  | "file:read" | "file:write"
  | "net:http_get" | "net:http_post"
  | "act:email_send" | "act:payment" | "act:admin";

export interface ActionRequest {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  scopes: ScopeCategory[];
  riskLevel: RiskLevel;
  requiresHumanOk: boolean;
  requestedAt: Date;
  userId: number;
  contextId: string;
}

export interface ActionSignature {
  id: string;
  actionId: string;
  algorithm: "HMAC-SHA256";
  keyId: string;
  signature: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface GatewayDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  violations: string[];
  signature?: ActionSignature;
}

export interface HumanApproval {
  id: string;
  actionId: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  constraints?: {
    maxCost?: number;
    maxSideEffects?: number;
  };
}

export interface PolicyRule {
  id: string;
  when: {
    tool?: string;
    riskLevel?: RiskLevel | RiskLevel[];
    scopeContains?: string;
  };
  action: "allow" | "deny" | "ask_human";
  reason: string;
  allowedScopes?: ScopeCategory[];
  paramsAllowlist?: Record<string, string>;
}

// ============================================================================
// POLICY ENGINE
// ============================================================================

const DEFAULT_POLICIES: PolicyRule[] = [
  // Low risk tools - auto-allow
  {
    id: "allow_calculator",
    when: { tool: "calculator", riskLevel: "low" },
    action: "allow",
    reason: "Calculatrice - outil sûr",
    allowedScopes: ["tool:calculator", "data:read"]
  },
  {
    id: "allow_datetime",
    when: { tool: "datetime", riskLevel: "low" },
    action: "allow",
    reason: "Date/Heure - outil sûr",
    allowedScopes: ["tool:datetime", "data:read"]
  },
  {
    id: "allow_web_search",
    when: { tool: "web_search", riskLevel: "low" },
    action: "allow",
    reason: "Recherche web - lecture seule",
    allowedScopes: ["tool:web_search", "data:read", "net:http_get"]
  },
  {
    id: "allow_file_read",
    when: { tool: "file_read", riskLevel: "low" },
    action: "allow",
    reason: "Lecture de fichier - sandbox uniquement",
    allowedScopes: ["tool:file_read", "file:read", "data:read"]
  },
  
  // Medium risk - allow with logging
  {
    id: "allow_memory_write",
    when: { scopeContains: "memory:write" },
    action: "allow",
    reason: "Écriture mémoire - journalisée",
    allowedScopes: ["memory:write", "data:write"]
  },
  
  // High risk - require human approval
  {
    id: "require_human_for_high_risk",
    when: { riskLevel: ["high", "critical"] },
    action: "ask_human",
    reason: "Action à haut risque - approbation requise"
  },
  
  // Network POST - require approval
  {
    id: "require_human_for_network_post",
    when: { scopeContains: "net:http_post" },
    action: "ask_human",
    reason: "Requête réseau POST - approbation requise"
  },
  
  // Sensitive actions - always require approval
  {
    id: "require_human_for_email",
    when: { scopeContains: "act:email_send" },
    action: "ask_human",
    reason: "Envoi d'email - approbation requise"
  },
  {
    id: "require_human_for_payment",
    when: { scopeContains: "act:payment" },
    action: "ask_human",
    reason: "Paiement - approbation requise"
  },
  {
    id: "require_human_for_admin",
    when: { scopeContains: "act:admin" },
    action: "ask_human",
    reason: "Action admin - approbation requise"
  },
  
  // Default deny
  {
    id: "default_deny",
    when: {},
    action: "deny",
    reason: "Action non autorisée par défaut"
  }
];

export class PolicyEngine {
  private policies: PolicyRule[];

  constructor(customPolicies?: PolicyRule[]) {
    this.policies = customPolicies || DEFAULT_POLICIES;
  }

  /**
   * Évalue une requête d'action contre les règles de policy
   */
  evaluate(request: ActionRequest): { 
    action: "allow" | "deny" | "ask_human"; 
    reason: string;
    matchedRule: string;
    violations: string[];
  } {
    const violations: string[] = [];

    for (const rule of this.policies) {
      if (this.matchesRule(request, rule)) {
        // Vérifier les scopes autorisés
        if (rule.allowedScopes) {
          const unauthorizedScopes = request.scopes.filter(
            s => !rule.allowedScopes!.includes(s)
          );
          if (unauthorizedScopes.length > 0) {
            violations.push(`Scopes non autorisés: ${unauthorizedScopes.join(", ")}`);
          }
        }

        // Vérifier les paramètres
        if (rule.paramsAllowlist) {
          for (const [param, constraint] of Object.entries(rule.paramsAllowlist)) {
            const value = request.params[param];
            if (!this.validateParam(value, constraint)) {
              violations.push(`Paramètre invalide: ${param}`);
            }
          }
        }

        return {
          action: violations.length > 0 ? "deny" : rule.action,
          reason: violations.length > 0 ? violations.join("; ") : rule.reason,
          matchedRule: rule.id,
          violations
        };
      }
    }

    // Default deny
    return {
      action: "deny",
      reason: "Aucune règle correspondante - refusé par défaut",
      matchedRule: "default_deny",
      violations: ["no_matching_rule"]
    };
  }

  private matchesRule(request: ActionRequest, rule: PolicyRule): boolean {
    const { when } = rule;

    // Match tool
    if (when.tool && request.tool !== when.tool) {
      return false;
    }

    // Match risk level
    if (when.riskLevel) {
      const levels = Array.isArray(when.riskLevel) ? when.riskLevel : [when.riskLevel];
      if (!levels.includes(request.riskLevel)) {
        return false;
      }
    }

    // Match scope contains
    if (when.scopeContains) {
      if (!request.scopes.some(s => s.includes(when.scopeContains!))) {
        return false;
      }
    }

    return true;
  }

  private validateParam(value: unknown, constraint: string): boolean {
    // Format: "type<=maxValue" ou "type"
    const match = constraint.match(/^(\w+)(?:<=(\d+))?$/);
    if (!match) return false;

    const [, type, maxValue] = match;

    switch (type) {
      case "string":
        if (typeof value !== "string") return false;
        if (maxValue && value.length > parseInt(maxValue)) return false;
        return true;
      case "int":
      case "number":
        if (typeof value !== "number") return false;
        if (maxValue && value > parseInt(maxValue)) return false;
        return true;
      case "boolean":
        return typeof value === "boolean";
      default:
        return false;
    }
  }
}

// ============================================================================
// SIGNATURE SERVICE
// ============================================================================

export class SignatureService {
  private secretKey: string;
  private keyId: string;
  private signatureValidityMs: number;

  constructor(
    secretKey: string = process.env.JWT_SECRET || "phoenix-gateway-secret",
    keyId: string = "key_v1",
    signatureValidityMs: number = 15 * 60 * 1000 // 15 minutes
  ) {
    this.secretKey = secretKey;
    this.keyId = keyId;
    this.signatureValidityMs = signatureValidityMs;
  }

  /**
   * Signe une requête d'action avec HMAC-SHA256
   */
  sign(request: ActionRequest): ActionSignature {
    const canonical = this.canonicalize(request);
    const signature = createHmac("sha256", this.secretKey)
      .update(canonical)
      .digest("hex");

    const now = new Date();
    return {
      id: `sig_${randomUUID()}`,
      actionId: request.id,
      algorithm: "HMAC-SHA256",
      keyId: this.keyId,
      signature,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + this.signatureValidityMs)
    };
  }

  /**
   * Vérifie une signature
   */
  verify(request: ActionRequest, signature: ActionSignature): {
    valid: boolean;
    reason: string;
  } {
    // Vérifier l'expiration
    if (new Date() > signature.expiresAt) {
      return { valid: false, reason: "Signature expirée" };
    }

    // Vérifier l'action ID
    if (signature.actionId !== request.id) {
      return { valid: false, reason: "Action ID mismatch" };
    }

    // Vérifier la signature
    const canonical = this.canonicalize(request);
    const expectedSignature = createHmac("sha256", this.secretKey)
      .update(canonical)
      .digest("hex");

    if (signature.signature !== expectedSignature) {
      return { valid: false, reason: "Signature invalide" };
    }

    return { valid: true, reason: "Signature valide" };
  }

  private canonicalize(request: ActionRequest): string {
    // Créer une représentation canonique stable pour la signature
    const canonical = {
      id: request.id,
      tool: request.tool,
      params: this.sortObject(request.params),
      scopes: [...request.scopes].sort(),
      riskLevel: request.riskLevel,
      userId: request.userId,
      contextId: request.contextId
    };
    return JSON.stringify(canonical);
  }

  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }
    return sorted;
  }
}

// ============================================================================
// TOOL GATEWAY
// ============================================================================

export class ToolGateway {
  private policyEngine: PolicyEngine;
  private signatureService: SignatureService;
  private pendingApprovals: Map<string, ActionRequest>;
  private approvedActions: Map<string, HumanApproval>;

  constructor(
    policyEngine?: PolicyEngine,
    signatureService?: SignatureService
  ) {
    this.policyEngine = policyEngine || new PolicyEngine();
    this.signatureService = signatureService || new SignatureService();
    this.pendingApprovals = new Map();
    this.approvedActions = new Map();
  }

  /**
   * Évalue une requête d'action et retourne une décision
   */
  evaluate(request: ActionRequest): GatewayDecision {
    // Évaluer contre les policies
    const evaluation = this.policyEngine.evaluate(request);

    switch (evaluation.action) {
      case "allow":
        // Signer et autoriser
        const signature = this.signatureService.sign(request);
        return {
          allowed: true,
          reason: evaluation.reason,
          requiresApproval: false,
          violations: evaluation.violations,
          signature
        };

      case "ask_human":
        // Mettre en attente d'approbation
        this.pendingApprovals.set(request.id, request);
        return {
          allowed: false,
          reason: evaluation.reason,
          requiresApproval: true,
          violations: evaluation.violations
        };

      case "deny":
      default:
        return {
          allowed: false,
          reason: evaluation.reason,
          requiresApproval: false,
          violations: evaluation.violations
        };
    }
  }

  /**
   * Approuve une action en attente (appelé après validation humaine)
   */
  approve(
    actionId: string,
    approvedBy: string,
    constraints?: HumanApproval["constraints"]
  ): GatewayDecision {
    const request = this.pendingApprovals.get(actionId);
    if (!request) {
      return {
        allowed: false,
        reason: "Action non trouvée ou expirée",
        requiresApproval: false,
        violations: ["action_not_found"]
      };
    }

    // Créer l'approbation
    const approval: HumanApproval = {
      id: `approval_${randomUUID()}`,
      actionId,
      approvedBy,
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      constraints
    };

    this.approvedActions.set(actionId, approval);
    this.pendingApprovals.delete(actionId);

    // Signer l'action approuvée
    const signature = this.signatureService.sign(request);

    return {
      allowed: true,
      reason: `Approuvé par ${approvedBy}`,
      requiresApproval: false,
      violations: [],
      signature
    };
  }

  /**
   * Rejette une action en attente
   */
  reject(actionId: string, reason: string): GatewayDecision {
    this.pendingApprovals.delete(actionId);
    return {
      allowed: false,
      reason: `Rejeté: ${reason}`,
      requiresApproval: false,
      violations: ["human_rejected"]
    };
  }

  /**
   * Vérifie si une action peut être exécutée (signature valide)
   */
  canExecute(request: ActionRequest, signature: ActionSignature): {
    canExecute: boolean;
    reason: string;
  } {
    // Vérifier la signature
    const verification = this.signatureService.verify(request, signature);
    if (!verification.valid) {
      return { canExecute: false, reason: verification.reason };
    }

    // Vérifier si une approbation humaine était requise
    const approval = this.approvedActions.get(request.id);
    if (request.requiresHumanOk && !approval) {
      return { canExecute: false, reason: "Approbation humaine requise" };
    }

    // Vérifier l'expiration de l'approbation
    if (approval && new Date() > approval.expiresAt) {
      return { canExecute: false, reason: "Approbation expirée" };
    }

    return { canExecute: true, reason: "Exécution autorisée" };
  }

  /**
   * Retourne les actions en attente d'approbation
   */
  getPendingApprovals(): ActionRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Crée une nouvelle requête d'action
   */
  createActionRequest(
    tool: string,
    params: Record<string, unknown>,
    scopes: ScopeCategory[],
    riskLevel: RiskLevel,
    userId: number,
    contextId: string
  ): ActionRequest {
    return {
      id: `action_${randomUUID()}`,
      tool,
      params,
      scopes,
      riskLevel,
      requiresHumanOk: riskLevel === "high" || riskLevel === "critical",
      requestedAt: new Date(),
      userId,
      contextId
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let gatewayInstance: ToolGateway | null = null;

export function getToolGateway(): ToolGateway {
  if (!gatewayInstance) {
    gatewayInstance = new ToolGateway();
  }
  return gatewayInstance;
}

export default ToolGateway;
