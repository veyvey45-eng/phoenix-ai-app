import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import { 
  InsertUser, users,
  utterances, InsertUtterance, Utterance,
  decisions, InsertDecision, Decision,
  issues, InsertIssue, Issue,
  memoryItems, InsertMemoryItem, MemoryItem,
  actionRequests, InsertActionRequest, ActionRequest,
  actionResults, InsertActionResult, ActionResult,
  criteria, InsertCriteria, Criteria,
  phoenixState, InsertPhoenixState, PhoenixState,
  auditLog, InsertAuditLog, AuditLog,
  conversations, InsertConversation, Conversation,
  conversationMessages, InsertConversationMessage, ConversationMessage,
  permissions, InsertPermission, Permission,
  rolePermissions, InsertRolePermission, RolePermission,
  sensitiveValidations, InsertSensitiveValidation, SensitiveValidation,
  approvalRequests, InsertApprovalRequest, ApprovalRequest,
  moduleConfigs, InsertModuleConfig, ModuleConfig,
  adminAuditLog, InsertAdminAuditLog, AdminAuditLog,
  stripeCustomers, InsertStripeCustomer, StripeCustomer,
  stripeSubscriptions, InsertStripeSubscription, StripeSubscription,
  stripePayments, InsertStripePayment, StripePayment
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// UTTERANCE OPERATIONS
// ============================================================================

export async function createUtterance(data: InsertUtterance): Promise<Utterance | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(utterances).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date() } as Utterance;
}

export async function getUtterancesByContext(contextId: string, limit = 50): Promise<Utterance[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(utterances)
    .where(eq(utterances.contextId, contextId))
    .orderBy(desc(utterances.createdAt))
    .limit(limit);
}

export async function getRecentUtterances(userId: number, limit = 200): Promise<Utterance[]> {
  const db = await getDb();
  if (!db) return [];

  // Récupérer les messages les plus récents, puis les inverser pour avoir l'ordre chronologique
  const results = await db.select()
    .from(utterances)
    .where(eq(utterances.userId, userId))
    .orderBy(desc(utterances.createdAt))
    .limit(limit);
  
  // Inverser pour avoir l'ordre chronologique (ancien vers récent)
  return results.reverse();
}

// ============================================================================
// DECISION OPERATIONS
// ============================================================================

export async function createDecision(data: InsertDecision): Promise<Decision | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(decisions).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date() } as Decision;
}

export async function getDecisionsByUser(userId: number, limit = 50): Promise<Decision[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(decisions)
    .where(eq(decisions.userId, userId))
    .orderBy(desc(decisions.createdAt))
    .limit(limit);
}

// ============================================================================
// ISSUE OPERATIONS
// ============================================================================

export async function createIssue(data: InsertIssue): Promise<Issue | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(issues).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date(), updatedAt: new Date() } as Issue;
}

export async function getActiveIssues(userId: number): Promise<Issue[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(issues)
    .where(and(
      eq(issues.userId, userId),
      eq(issues.status, "open")
    ))
    .orderBy(desc(issues.createdAt));
}

export async function updateIssueStatus(
  issueId: number, 
  status: "open" | "investigating" | "resolved" | "deferred",
  resolution?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(issues)
    .set({ status, resolution, attempts: sql`${issues.attempts} + 1` })
    .where(eq(issues.id, issueId));
}

export async function getIssueStats(userId: number): Promise<{ total: number; open: number; resolved: number }> {
  const db = await getDb();
  if (!db) return { total: 0, open: 0, resolved: 0 };

  const allIssues = await db.select().from(issues).where(eq(issues.userId, userId));
  return {
    total: allIssues.length,
    open: allIssues.filter(i => i.status === "open").length,
    resolved: allIssues.filter(i => i.status === "resolved").length
  };
}

// ============================================================================
// MEMORY OPERATIONS
// ============================================================================

export async function createMemory(data: InsertMemoryItem): Promise<MemoryItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(memoryItems).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date() } as MemoryItem;
}

export async function getMemoriesByUser(userId: number, limit = 100): Promise<MemoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(memoryItems)
    .where(eq(memoryItems.userId, userId))
    .orderBy(desc(memoryItems.salience))
    .limit(limit);
}

export async function updateMemoryUsage(memoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(memoryItems)
    .set({ 
      lastUsed: new Date(),
      useCount: sql`${memoryItems.useCount} + 1`
    })
    .where(eq(memoryItems.id, memoryId));
}

// ============================================================================
// ACTION REQUEST OPERATIONS
// ============================================================================

export async function createActionRequest(data: InsertActionRequest): Promise<ActionRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(actionRequests).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date() } as ActionRequest;
}

export async function updateActionRequestStatus(
  requestId: number,
  status: "pending" | "approved" | "rejected" | "executed"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(actionRequests)
    .set({ status })
    .where(eq(actionRequests.id, requestId));
}

export async function getPendingActionRequests(userId: number): Promise<ActionRequest[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(actionRequests)
    .where(and(
      eq(actionRequests.userId, userId),
      eq(actionRequests.status, "pending")
    ))
    .orderBy(desc(actionRequests.createdAt));
}

// ============================================================================
// ACTION RESULT OPERATIONS
// ============================================================================

export async function createActionResult(data: InsertActionResult): Promise<ActionResult | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(actionResults).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date() } as ActionResult;
}

// ============================================================================
// CRITERIA OPERATIONS
// ============================================================================

export async function getActiveCriteria(): Promise<Criteria[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(criteria)
    .where(eq(criteria.isActive, true))
    .orderBy(criteria.level, criteria.weight);
}

export async function createCriteria(data: InsertCriteria): Promise<Criteria | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(criteria).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date(), updatedAt: new Date() } as Criteria;
}

export async function initializeDefaultCriteria(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await getActiveCriteria();
  if (existing.length > 0) return;

  const defaultCriteria: InsertCriteria[] = [
    {
      name: "H0-INTEGRITE",
      level: "0",
      description: "Axiome immuable: Intégrité humaine",
      rule: "Refuser toute action visant à nuire; demander clarification si ambigu.",
      weight: 100,
      isActive: true
    },
    {
      name: "H0-TRANSPARENCE",
      level: "0",
      description: "Axiome immuable: Transparence des risques",
      rule: "Si une action/hypothèse implique un risque, l'exposer à l'utilisateur.",
      weight: 100,
      isActive: true
    },
    {
      name: "H0-VERITE",
      level: "0",
      description: "Axiome immuable: Engagement envers la vérité",
      rule: "Ne jamais affirmer comme fait ce qui n'est pas vérifié.",
      weight: 100,
      isActive: true
    },
    {
      name: "CLARTE",
      level: "1",
      description: "Critère évolutif: Clarté des réponses",
      rule: "Privilégier les réponses claires et concises.",
      weight: 10,
      isActive: true
    },
    {
      name: "PRECISION",
      level: "1",
      description: "Critère évolutif: Précision factuelle",
      rule: "Citer les sources quand disponibles.",
      weight: 15,
      isActive: true
    },
    {
      name: "COHERENCE",
      level: "1",
      description: "Critère évolutif: Cohérence avec l'historique",
      rule: "Maintenir la cohérence avec les échanges précédents.",
      weight: 12,
      isActive: true
    }
  ];

  for (const c of defaultCriteria) {
    await createCriteria(c);
  }
}

// ============================================================================
// PHOENIX STATE OPERATIONS
// ============================================================================

export async function getOrCreatePhoenixState(userId: number): Promise<PhoenixState> {
  const db = await getDb();
  if (!db) {
    return {
      id: 0,
      userId,
      tormentScore: 0,
      activeHypotheses: [],
      enrichedContext: null,
      lastEnrichedAt: null,
      identityVersion: 1,
      lastConsolidation: null,
      openIssuesCount: 0,
      totalDecisions: 0,
      totalUtterances: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  const existing = await db.select()
    .from(phoenixState)
    .where(eq(phoenixState.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db.insert(phoenixState).values({
    userId,
    tormentScore: 0,
    activeHypotheses: [],
    identityVersion: 1,
    openIssuesCount: 0,
    totalDecisions: 0,
    totalUtterances: 0
  });

  const id = Number(result[0].insertId);
  return {
    id,
    userId,
    tormentScore: 0,
    activeHypotheses: [],
    enrichedContext: null,
    lastEnrichedAt: null,
    identityVersion: 1,
    lastConsolidation: null,
    openIssuesCount: 0,
    totalDecisions: 0,
    totalUtterances: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export async function updatePhoenixState(
  userId: number,
  updates: Partial<InsertPhoenixState>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(phoenixState)
    .set(updates)
    .where(eq(phoenixState.userId, userId));
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

export async function logAuditEvent(data: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(auditLog).values(data);
}

export async function getAuditLog(userId: number, limit = 100): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

export async function createConversation(data: InsertConversation): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(conversations).values(data);
  const id = Number(result[0].insertId);
  return { ...data, id, createdAt: new Date(), updatedAt: new Date() } as Conversation;
}

export async function getConversationsByUser(userId: number): Promise<Conversation[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversationByContextId(contextId: string): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(conversations)
    .where(eq(conversations.contextId, contextId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}


// ============================================================================
// ADMIN SYSTEM OPERATIONS
// ============================================================================

/**
 * Check if a user has admin role
 */
export async function isUserAdmin(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "admin")))
    .limit(1);

  return result.length > 0;
}

/**
 * Promote a user to admin role
 */
export async function promoteToAdmin(userId: number, promotedBy: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Verify the promoter is admin
  const isPromoterAdmin = await isUserAdmin(promotedBy);
  if (!isPromoterAdmin) return false;

  await db.update(users)
    .set({ role: "admin" })
    .where(eq(users.id, userId));

  // Log the action
  await logAdminAction({
    adminId: promotedBy,
    action: "promote_to_admin",
    resourceType: "user",
    resourceId: userId,
    changes: { role: "admin" }
  });

  return true;
}

/**
 * Log admin actions for audit trail
 */
export async function logAdminAction(data: InsertAdminAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(adminAuditLog).values(data);
}

/**
 * Get admin audit log
 */
export async function getAdminAuditLog(limit = 100): Promise<AdminAuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

// ============================================================================
// MODULE CONFIGURATION OPERATIONS
// ============================================================================

/**
 * Initialize the 10 Phoenix modules
 */
export async function initializeModuleConfigs(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const defaultModules = [
    { moduleId: "logic_gate", moduleName: "Logic Gate", description: "Filtre de sécurité et validation des décisions" },
    { moduleId: "memory_sync", moduleName: "Memory Sync", description: "Synchronisation des connaissances de référence" },
    { moduleId: "arbitrage", moduleName: "Arbitrage", description: "Génération et sélection des hypothèses" },
    { moduleId: "torment", moduleName: "Torment", description: "Calcul du score de tourment et incertitude" },
    { moduleId: "security", moduleName: "Security", description: "Vérification des axiomes de sécurité" },
    { moduleId: "memory_rag", moduleName: "Memory RAG", description: "Recherche et récupération de mémoires" },
    { moduleId: "error_detection", moduleName: "Error Detection", description: "Détection des contradictions et hallucinations" },
    { moduleId: "initiative", moduleName: "Initiative", description: "Évaluation des actions à suggérer ou exécuter" },
    { moduleId: "tool_gateway", moduleName: "Tool Gateway", description: "Gestion des permissions et signatures d'outils" },
    { moduleId: "sleep_consolidation", moduleName: "Sleep Consolidation", description: "Consolidation nocturne des mémoires" }
  ];

  for (const module of defaultModules) {
    const existing = await db.select()
      .from(moduleConfigs)
      .where(eq(moduleConfigs.moduleId, module.moduleId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(moduleConfigs).values({
        ...module,
        isEnabled: true,
        config: {}
      });
    }
  }
}

/**
 * Get all module configurations
 */
export async function getModuleConfigs(): Promise<ModuleConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(moduleConfigs)
    .orderBy(moduleConfigs.moduleId);
}

/**
 * Update module configuration (Admin only)
 */
export async function updateModuleConfig(
  moduleId: string,
  updates: Partial<InsertModuleConfig>,
  adminId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Verify admin
  const isAdmin = await isUserAdmin(adminId);
  if (!isAdmin) return false;

  await db.update(moduleConfigs)
    .set({ ...updates, updatedBy: adminId })
    .where(eq(moduleConfigs.moduleId, moduleId));

  // Log the action
  await logAdminAction({
    adminId,
    action: "update_module_config",
    resourceType: "module",
    resourceId: 0,
    changes: { moduleId, ...updates }
  });

  return true;
}

// ============================================================================
// SENSITIVE VALIDATION OPERATIONS
// ============================================================================

/**
 * Initialize the 16 axioms as sensitive validations
 */
export async function initializeSensitiveValidations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const axioms = [
    // Niveau 0 - Critiques
    { axiomId: "H0-INTEGRITE", axiomName: "Intégrité humaine", severity: "critical" as const, description: "Refuser toute action visant à nuire", requiresApproval: true },
    { axiomId: "H0-TRANSPARENCE", axiomName: "Transparence", severity: "critical" as const, description: "Montrer le raisonnement et les incertitudes", requiresApproval: true },
    { axiomId: "H0-VERITE", axiomName: "Vérité", severity: "critical" as const, description: "Ne jamais affirmer sans preuve", requiresApproval: true },
    { axiomId: "H0-LIMITE", axiomName: "Limite", severity: "critical" as const, description: "Reconnaître les limites de compétence", requiresApproval: true },
    // Niveau 1 - Haute priorité
    { axiomId: "H1-COHERENCE", axiomName: "Cohérence", severity: "high" as const, description: "Maintenir la cohérence des réponses", requiresApproval: true },
    { axiomId: "H1-PRECISION", axiomName: "Précision", severity: "high" as const, description: "Fournir des informations précises", requiresApproval: false },
    { axiomId: "H1-PERTINENCE", axiomName: "Pertinence", severity: "high" as const, description: "Répondre de manière pertinente", requiresApproval: false },
    { axiomId: "H1-CLARTE", axiomName: "Clarté", severity: "high" as const, description: "Communiquer clairement", requiresApproval: false },
    // Niveau 2 - Moyenne priorité
    { axiomId: "H2-EFFICACITE", axiomName: "Efficacité", severity: "medium" as const, description: "Optimiser les ressources", requiresApproval: false },
    { axiomId: "H2-ADAPTABILITE", axiomName: "Adaptabilité", severity: "medium" as const, description: "S'adapter au contexte", requiresApproval: false },
    { axiomId: "H2-APPRENTISSAGE", axiomName: "Apprentissage", severity: "medium" as const, description: "Apprendre des interactions", requiresApproval: false },
    { axiomId: "H2-COLLABORATION", axiomName: "Collaboration", severity: "medium" as const, description: "Collaborer efficacement", requiresApproval: false },
    // Niveau 3 - Basse priorité
    { axiomId: "H3-CREATIVITE", axiomName: "Créativité", severity: "low" as const, description: "Proposer des solutions créatives", requiresApproval: false },
    { axiomId: "H3-EMPATHIE", axiomName: "Empathie", severity: "low" as const, description: "Comprendre les besoins utilisateur", requiresApproval: false },
    { axiomId: "H3-PROACTIVITE", axiomName: "Proactivité", severity: "low" as const, description: "Anticiper les besoins", requiresApproval: false },
    { axiomId: "H3-EVOLUTION", axiomName: "Évolution", severity: "low" as const, description: "Évoluer continuellement", requiresApproval: false }
  ];

  for (const axiom of axioms) {
    const existing = await db.select()
      .from(sensitiveValidations)
      .where(eq(sensitiveValidations.axiomId, axiom.axiomId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(sensitiveValidations).values(axiom);
    }
  }
}

/**
 * Get all sensitive validations
 */
export async function getSensitiveValidations(): Promise<SensitiveValidation[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(sensitiveValidations)
    .orderBy(sensitiveValidations.severity);
}

/**
 * Update sensitive validation settings (Admin only)
 */
export async function updateSensitiveValidation(
  axiomId: string,
  updates: Partial<InsertSensitiveValidation>,
  adminId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const isAdmin = await isUserAdmin(adminId);
  if (!isAdmin) return false;

  await db.update(sensitiveValidations)
    .set(updates)
    .where(eq(sensitiveValidations.axiomId, axiomId));

  await logAdminAction({
    adminId,
    action: "update_sensitive_validation",
    resourceType: "axiom",
    resourceId: 0,
    changes: { axiomId, ...updates }
  });

  return true;
}

// ============================================================================
// APPROVAL REQUEST OPERATIONS
// ============================================================================

/**
 * Create an approval request for a sensitive operation
 */
export async function createApprovalRequest(data: InsertApprovalRequest): Promise<ApprovalRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(approvalRequests).values({
    ...data,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiry
  });
  const id = Number(result[0].insertId);
  
  // Send notification to owner for pending approval
  try {
    const { notifyOwner } = await import('./_core/notification');
    await notifyOwner({
      title: `🔔 Approbation requise - Phoenix`,
      content: `Une nouvelle demande d'approbation (ID: ${id}) nécessite votre attention.\n\nValidation ID: ${data.validationId}\nDemandeur ID: ${data.requestedBy}\n\nConnectez-vous au tableau de bord Admin pour approuver ou rejeter cette demande.`
    });
    console.log(`[Notification] Approval request ${id} notification sent to owner`);
  } catch (error) {
    console.warn('[Notification] Failed to notify owner of approval request:', error);
  }
  
  return { ...data, id, createdAt: new Date() } as ApprovalRequest;
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(approvalRequests)
    .where(eq(approvalRequests.status, "pending"))
    .orderBy(desc(approvalRequests.createdAt));
}

/**
 * Approve or reject an approval request (Admin only)
 */
export async function processApprovalRequest(
  requestId: number,
  approved: boolean,
  adminId: number,
  reason?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const isAdmin = await isUserAdmin(adminId);
  if (!isAdmin) return false;

  const status = approved ? "approved" : "rejected";

  await db.update(approvalRequests)
    .set({
      status,
      approvedBy: adminId,
      reason,
      approvedAt: new Date()
    })
    .where(eq(approvalRequests.id, requestId));

  await logAdminAction({
    adminId,
    action: approved ? "approve_request" : "reject_request",
    resourceType: "approval_request",
    resourceId: requestId,
    changes: { status, reason }
  });

  return true;
}

/**
 * Get approval history
 */
export async function getApprovalHistory(limit = 50): Promise<ApprovalRequest[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(approvalRequests)
    .orderBy(desc(approvalRequests.createdAt))
    .limit(limit);
}

export async function updateConversation(
  conversationId: number, 
  data: Partial<Conversation>
): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  updateData.updatedAt = new Date();

  await db.update(conversations)
    .set(updateData)
    .where(eq(conversations.id, conversationId));

  return getConversationById(conversationId);
}

export async function getConversationById(conversationId: number): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function deleteConversation(conversationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Delete all utterances in this conversation first
    await db.delete(utterances)
      .where(eq(utterances.contextId, (await getConversationById(conversationId))?.contextId || ''));
    
    // Then delete the conversation
    await db.delete(conversations)
      .where(eq(conversations.id, conversationId));
    
    return true;
  } catch (error) {
    console.error('[Database] Error deleting conversation:', error);
    return false;
  }
}

export async function getConversationMessages(conversationId: number, limit = 100): Promise<ConversationMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(conversationMessages.createdAt)
    .limit(limit);
}

export async function saveConversationMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string
): Promise<ConversationMessage | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(conversationMessages).values({
    conversationId,
    role,
    content
  });

  if (!result) return undefined;

  return db.select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(1)
    .then(rows => rows[0]);
}

export async function getOrCreateConversationForUser(
  userId: number,
  title?: string
): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const contextId = randomUUID();
  return createConversation({
    userId,
    title: title || `Conversation ${new Date().toLocaleString('fr-FR')}`,
    contextId,
    isActive: true
  });
}
