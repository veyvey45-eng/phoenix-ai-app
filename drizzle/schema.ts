import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean } from "drizzle-orm/mysql-core";

// ============================================================================
// CORE USER TABLE (from template)
// ============================================================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// STRIPE SUBSCRIPTION TABLES
// ============================================================================

/**
 * STRIPE CUSTOMER - Lien entre utilisateur et client Stripe
 * Stocke uniquement l'ID Stripe du client pour les références API
 */
export const stripeCustomers = mysqlTable("stripeCustomers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;

/**
 * STRIPE SUBSCRIPTION - Abonnement actif
 * Stocke uniquement l'ID Stripe et le statut pour les références API
 */
export const stripeSubscriptions = mysqlTable("stripeSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(),
  stripePriceId: varchar("stripePriceId", { length: 255 }).notNull(),
  status: mysqlEnum("status", [
    "active",
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "trialing"
  ]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  canceledAt: timestamp("canceledAt"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StripeSubscription = typeof stripeSubscriptions.$inferSelect;
export type InsertStripeSubscription = typeof stripeSubscriptions.$inferInsert;

/**
 * STRIPE PAYMENT - Historique des paiements
 * Stocke les détails essentiels pour l'audit et le reporting
 */
export const stripePayments = mysqlTable("stripePayments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).notNull().unique(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  status: mysqlEnum("status", [
    "succeeded",
    "processing",
    "requires_payment_method",
    "requires_confirmation",
    "requires_action",
    "canceled"
  ]).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StripePayment = typeof stripePayments.$inferSelect;
export type InsertStripePayment = typeof stripePayments.$inferInsert;

// ============================================================================
// PHOENIX CORE OBJECTS - 7 Main Data Models
// ============================================================================

/**
 * 1. UTTERANCE - Trace d'un énoncé (user ou agent)
 * Chaque sortie crée un Utterance(id) + lien vers Decision_id; réévaluable à tout moment
 */
export const utterances = mysqlTable("utterances", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  contextId: varchar("contextId", { length: 64 }), // Links related utterances
  confidence: float("confidence").default(1.0), // 0.0 to 1.0
  sources: json("sources").$type<string[]>(), // Array of source references
  decisionId: int("decisionId"), // Link to the decision that produced this
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Utterance = typeof utterances.$inferSelect;
export type InsertUtterance = typeof utterances.$inferInsert;

/**
 * 2. DECISION - Choix interne et ses raisons
 * Arbitrage entre hypothèses/plans via scoring + contraintes
 */
export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  options: json("options").$type<Array<{ id: string; content: string; score: number }>>().notNull(),
  chosen: varchar("chosen", { length: 64 }).notNull(), // ID of chosen option
  rationale: text("rationale").notNull(), // Why this option was chosen
  criteriaSnapshot: json("criteriaSnapshot").$type<Record<string, number>>(), // Criteria weights at decision time
  tormentBefore: float("tormentBefore").default(0), // Torment score before decision
  tormentAfter: float("tormentAfter").default(0), // Torment score after decision
  contextId: varchar("contextId", { length: 64 }),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;

/**
 * 3. ISSUE - Incohérence ou problème détecté
 * Machine à états Issue + TTL + defer + trace 'non résolu' (anti-boucle)
 */
export const issues = mysqlTable("issues", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["contradiction", "hallucination", "mismatch", "error", "uncertainty"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  evidence: text("evidence").notNull(), // What triggered this issue
  status: mysqlEnum("status", ["open", "investigating", "resolved", "deferred"]).default("open").notNull(),
  ttl: int("ttl").default(86400), // Time to live in seconds (default 24h)
  attempts: int("attempts").default(0), // Number of resolution attempts
  resolution: text("resolution"), // How it was resolved
  relatedUtteranceId: int("relatedUtteranceId"),
  relatedDecisionId: int("relatedDecisionId"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Issue = typeof issues.$inferSelect;
export type InsertIssue = typeof issues.$inferInsert;

/**
 * 4. MEMORY ITEM - Élément de mémoire long-terme
 * Journal immuable + mémoire sémantique (vector store) + metadata versionnée
 */
export const memoryItems = mysqlTable("memoryItems", {
  id: int("id").autoincrement().primaryKey(),
  content: text("content").notNull(),
  embedding: json("embedding").$type<number[]>(), // Vector embedding for RAG
  tags: json("tags").$type<string[]>(), // Categorization tags
  salience: float("salience").default(0.5), // Importance score 0.0 to 1.0
  provenance: varchar("provenance", { length: 255 }), // Source of this memory
  memoryType: mysqlEnum("memoryType", ["fact", "hypothesis", "experience", "rule"]).default("fact").notNull(),
  lastUsed: timestamp("lastUsed"),
  useCount: int("useCount").default(0),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MemoryItem = typeof memoryItems.$inferSelect;
export type InsertMemoryItem = typeof memoryItems.$inferInsert;

/**
 * 5. ACTION REQUEST - Action proposée (outils)
 * Création de tasks (suggestion au début), jamais action directe sans validation
 */
export const actionRequests = mysqlTable("actionRequests", {
  id: int("id").autoincrement().primaryKey(),
  tool: varchar("tool", { length: 128 }).notNull(), // Tool to execute
  params: json("params").$type<Record<string, unknown>>(), // Tool parameters
  scope: json("scope").$type<string[]>(), // Allowed scopes
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).default("low").notNull(),
  requiresHumanOk: boolean("requiresHumanOk").default(false).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "executed"]).default("pending").notNull(),
  decisionId: int("decisionId"),
  signature: varchar("signature", { length: 128 }), // HMAC-SHA256 signature
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActionRequest = typeof actionRequests.$inferSelect;
export type InsertActionRequest = typeof actionRequests.$inferInsert;

/**
 * 6. ACTION RESULT - Résultat vérifié
 * Outil exécuté, puis vérifié et journalisé
 */
export const actionResults = mysqlTable("actionResults", {
  id: int("id").autoincrement().primaryKey(),
  actionRequestId: int("actionRequestId").notNull(),
  tool: varchar("tool", { length: 128 }).notNull(),
  output: text("output"), // Tool output
  checks: json("checks").$type<Array<{ name: string; passed: boolean; details?: string }>>(), // Verification checks
  sideEffects: json("sideEffects").$type<string[]>(), // Detected side effects
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  signature: varchar("signature", { length: 128 }), // HMAC-SHA256 signature
  executionTimeMs: int("executionTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActionResult = typeof actionResults.$inferSelect;
export type InsertActionResult = typeof actionResults.$inferInsert;

/**
 * 7. CRITERIA - Règles et poids du module Jugement
 * Critères en YAML/JSON + poids; snapshot dans chaque Decision
 */
export const criteria = mysqlTable("criteria", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  level: mysqlEnum("level", ["0", "1", "2"]).default("1").notNull(), // 0 = immutable axioms
  description: text("description"),
  rule: text("rule").notNull(), // The actual rule/criterion
  weight: float("weight").default(1.0).notNull(), // Weight in scoring
  isActive: boolean("isActive").default(true).notNull(),
  version: int("version").default(1).notNull(),
  changelog: json("changelog").$type<Array<{ version: number; change: string; date: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Criteria = typeof criteria.$inferSelect;
export type InsertCriteria = typeof criteria.$inferInsert;

// ============================================================================
// PHOENIX STATE - Global system state tracking
// ============================================================================

/**
 * PHOENIX STATE - État global du système Phoenix
 * Tracks torment score, active hypotheses, and system health
 */
export const phoenixState = mysqlTable("phoenixState", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tormentScore: float("tormentScore").default(0).notNull(), // 0-100
  activeHypotheses: json("activeHypotheses").$type<Array<{ id: string; content: string; confidence: number }>>(),
  enrichedContext: text("enrichedContext"), // Cached enriched context (weather, crypto, news)
  lastEnrichedAt: timestamp("lastEnrichedAt"), // When the enriched context was last updated
  identityVersion: int("identityVersion").default(1).notNull(),
  lastConsolidation: timestamp("lastConsolidation"),
  openIssuesCount: int("openIssuesCount").default(0).notNull(),
  totalDecisions: int("totalDecisions").default(0).notNull(),
  totalUtterances: int("totalUtterances").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhoenixState = typeof phoenixState.$inferSelect;
export type InsertPhoenixState = typeof phoenixState.$inferInsert & { enrichedContext?: string; lastEnrichedAt?: Date };

// ============================================================================
// AUDIT LOG - Immutable journal for all Phoenix operations
// ============================================================================

/**
 * AUDIT LOG - Journal immuable
 * Toutes les sorties et actions ont un id et une provenance
 */
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  eventType: mysqlEnum("eventType", [
    "utterance_created",
    "decision_made",
    "issue_detected",
    "issue_resolved",
    "action_requested",
    "action_executed",
    "action_rejected",
    "memory_stored",
    "memory_retrieved",
    "torment_updated",
    "criteria_changed",
    "security_violation",
    "consolidation_run",
    "vectra_memory_searched",
    "vectra_memory_stored",
    "transpiration_completed",
    "memory_consolidated",
    "tool_executed",
    "file_uploaded",
    "file_deleted",
    "demo_started",
    "export_generated",
    "document_uploaded",
    "document_approved",
    "document_rejected",
    "document_indexed",
    "concepts_extracted"
  ]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  details: json("details").$type<Record<string, unknown>>(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ============================================================================
// CONVERSATIONS - Chat session management
// ============================================================================

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  contextId: varchar("contextId", { length: 64 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Conversation messages - Link messages to conversations
export const conversationMessages = mysqlTable("conversationMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

// ============================================================================
// ADMIN SYSTEM - Roles, Permissions, and Sensitive Approvals
// ============================================================================

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  category: mysqlEnum("category", [
    "axiom_validation",
    "module_config",
    "audit_access",
    "user_management",
    "system_config"
  ]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export const rolePermissions = mysqlTable("rolePermissions", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["admin", "user", "viewer"]).notNull(),
  permissionId: int("permissionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

/**
 * SENSITIVE VALIDATIONS - Approvals required for critical axiom validations
 */
export const sensitiveValidations = mysqlTable("sensitiveValidations", {
  id: int("id").autoincrement().primaryKey(),
  axiomId: varchar("axiomId", { length: 64 }).notNull(),
  axiomName: varchar("axiomName", { length: 255 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  description: text("description"),
  requiresApproval: boolean("requiresApproval").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SensitiveValidation = typeof sensitiveValidations.$inferSelect;
export type InsertSensitiveValidation = typeof sensitiveValidations.$inferInsert;

/**
 * APPROVAL REQUESTS - Track pending approvals for sensitive operations
 */
export const approvalRequests = mysqlTable("approvalRequests", {
  id: int("id").autoincrement().primaryKey(),
  validationId: int("validationId").notNull(),
  decisionId: int("decisionId"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  requestedBy: int("requestedBy").notNull(),
  approvedBy: int("approvedBy"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  expiresAt: timestamp("expiresAt"),
});

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = typeof approvalRequests.$inferInsert;

/**
 * MODULE CONFIGURATION - Admin-controlled settings for the 10 Phoenix modules
 */
export const moduleConfigs = mysqlTable("moduleConfigs", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("moduleId", { length: 64 }).notNull().unique(),
  moduleName: varchar("moduleName", { length: 128 }).notNull(),
  description: text("description"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  config: json("config").$type<Record<string, unknown>>(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModuleConfig = typeof moduleConfigs.$inferSelect;
export type InsertModuleConfig = typeof moduleConfigs.$inferInsert;

/**
 * ADMIN AUDIT LOG - Enhanced audit trail for admin actions
 */
export const adminAuditLog = mysqlTable("adminAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }).notNull(),
  resourceId: int("resourceId"),
  changes: json("changes").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;


// ============================================================================
// MODULE 02: MEMORY SYNC - Document Knowledge Base
// ============================================================================

/**
 * Reference Documents - PDF and other documents indexed for Phoenix
 * Organized by priority hierarchy (H0-H3)
 */
export const referenceDocuments = mysqlTable("reference_documents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize"), // in bytes
  mimeType: varchar("mimeType", { length: 100 }).default("application/pdf"),
  priority: mysqlEnum("priority", ["H0", "H1", "H2", "H3"]).default("H2").notNull(),
  category: varchar("category", { length: 100 }), // e.g., "theory", "architecture", "ethics"
  tags: json("tags").$type<string[]>(),
  isIndexed: boolean("isIndexed").default(false),
  indexedAt: timestamp("indexedAt"),
  uploadedBy: int("uploadedBy").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "archived"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReferenceDocument = typeof referenceDocuments.$inferSelect;
export type InsertReferenceDocument = typeof referenceDocuments.$inferInsert;

/**
 * Document Chunks - Extracted and indexed content from documents
 * Used for RAG (Retrieval Augmented Generation)
 */
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkIndex: int("chunkIndex").notNull(), // Order within document
  content: text("content").notNull(),
  pageNumber: int("pageNumber"),
  sectionTitle: varchar("sectionTitle", { length: 255 }),
  priority: mysqlEnum("priority", ["H0", "H1", "H2", "H3"]).default("H2").notNull(), // Inherited from document
  embedding: json("embedding").$type<number[]>(), // Vector embedding for similarity search
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

/**
 * Document Access Log - Track when documents are consulted
 */
export const documentAccessLog = mysqlTable("document_access_log", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkId: int("chunkId"),
  accessType: mysqlEnum("accessType", ["view", "search", "rag_query", "download"]).notNull(),
  query: text("query"), // The query that triggered this access
  relevanceScore: float("relevanceScore"), // How relevant was this document to the query
  userId: int("userId"),
  contextId: varchar("contextId", { length: 64 }), // Link to conversation context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentAccessLog = typeof documentAccessLog.$inferSelect;
export type InsertDocumentAccessLog = typeof documentAccessLog.$inferInsert;

/**
 * Knowledge Concepts - Extracted key concepts from documents
 * Used for building the knowledge graph
 */
export const knowledgeConcepts = mysqlTable("knowledge_concepts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  definition: text("definition"),
  priority: mysqlEnum("priority", ["H0", "H1", "H2", "H3"]).default("H2").notNull(),
  sourceDocumentId: int("sourceDocumentId"),
  sourceChunkId: int("sourceChunkId"),
  relatedConcepts: json("relatedConcepts").$type<number[]>(), // IDs of related concepts
  tags: json("tags").$type<string[]>(),
  confidence: float("confidence").default(1.0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeConcept = typeof knowledgeConcepts.$inferSelect;
export type InsertKnowledgeConcept = typeof knowledgeConcepts.$inferInsert;


// ============================================================================
// E2B SANDBOX CHECKPOINT - Sauvegarde et restauration de l'état du sandbox
// ============================================================================

/**
 * Sandbox Checkpoints - Sauvegarde l'état complet du sandbox E2B
 * Permet à Phoenix de restaurer son état entre les conversations
 */
export const sandboxCheckpoints = mysqlTable("sandbox_checkpoints", {
  id: varchar("id", { length: 255 }).primaryKey(),
  conversationId: varchar("conversationId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  data: json("data").notNull(), // JSON stringified CheckpointData
  version: int("version").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SandboxCheckpoint = typeof sandboxCheckpoints.$inferSelect;
export type InsertSandboxCheckpoint = typeof sandboxCheckpoints.$inferInsert;

// ============================================================================
// AUTONOMOUS AGENT SYSTEM - Architecture Multi-Agents
// ============================================================================

/**
 * Autonomous Tasks - Objectifs que Phoenix doit accomplir
 * Chaque tâche est décomposée en sous-étapes et exécutée de manière autonome
 */
export const autonomousTasks = mysqlTable("autonomous_tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  objective: text("objective").notNull(), // L'objectif initial de l'utilisateur
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed", "paused"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  
  // Décomposition en étapes
  steps: json("steps").$type<Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    action: string;
    result?: string;
    error?: string;
  }>>(),
  currentStepIndex: int("currentStepIndex").default(0),
  
  // Résultats et logs
  result: text("result"),
  errorMessage: text("errorMessage"),
  logs: json("logs").$type<Array<{
    timestamp: number;
    level: "info" | "warn" | "error";
    message: string;
  }>>(),
  
  // Métadonnées
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  estimatedDuration: int("estimatedDuration"), // en secondes
  actualDuration: int("actualDuration"), // en secondes
});

export type AutonomousTask = typeof autonomousTasks.$inferSelect;
export type InsertAutonomousTask = typeof autonomousTasks.$inferInsert;

/**
 * Agent State - État interne de l'agent Phoenix
 * Permet la récupération après crash
 */
export const agentState = mysqlTable("agent_state", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: int("userId").notNull(),
  currentTaskId: varchar("currentTaskId", { length: 255 }),
  
  // État du runtime
  state: json("state").$type<{
    variables: Record<string, unknown>;
    memory: string;
    context: Record<string, unknown>;
    lastAction: string;
    lastActionTime: number;
  }>(),
  
  // Checkpoints pour récupération
  lastCheckpointId: varchar("lastCheckpointId", { length: 255 }),
  lastCheckpointTime: timestamp("lastCheckpointTime"),
  
  // Santé de l'agent
  isHealthy: boolean("isHealthy").default(true),
  lastHeartbeat: timestamp("lastHeartbeat").defaultNow(),
  crashCount: int("crashCount").default(0),
  lastCrashTime: timestamp("lastCrashTime"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentState = typeof agentState.$inferSelect;
export type InsertAgentState = typeof agentState.$inferInsert;

/**
 * Task Logs - Journal détaillé de chaque tâche autonome
 * Permet le debugging et l'audit
 */
export const taskLogs = mysqlTable("task_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  taskId: varchar("taskId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  
  stepIndex: int("stepIndex"),
  stepId: varchar("stepId", { length: 255 }),
  
  // Type d'action
  actionType: varchar("actionType", { length: 100 }).notNull(), // "execute_code", "browse_web", "llm_call", etc.
  
  // Détails de l'action
  input: json("input").$type<Record<string, unknown>>(),
  output: json("output").$type<Record<string, unknown>>(),
  error: text("error"),
  
  // Timing
  startTime: timestamp("startTime").defaultNow(),
  endTime: timestamp("endTime"),
  duration: int("duration"), // en ms
  
  // Retry info
  retryCount: int("retryCount").default(0),
  maxRetries: int("maxRetries").default(3),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskLog = typeof taskLogs.$inferSelect;
export type InsertTaskLog = typeof taskLogs.$inferInsert;

/**
 * Agent Decisions - Historique des décisions prises par l'agent
 * Pour l'audit et l'amélioration continue
 */
export const agentDecisions = mysqlTable("agent_decisions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  taskId: varchar("taskId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  
  // La décision
  decision: text("decision").notNull(),
  reasoning: text("reasoning").notNull(),
  
  // Options considérées
  options: json("options").$type<Array<{
    option: string;
    pros: string[];
    cons: string[];
    score: number;
  }>>(),
  
  // Résultat
  selectedOption: text("selectedOption"),
  outcome: mysqlEnum("outcome", ["success", "partial", "failed", "unknown"]).default("unknown"),
  feedback: text("feedback"),
  
  // LLM info
  llmModel: varchar("llmModel", { length: 100 }),
  llmTokensUsed: int("llmTokensUsed"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentDecision = typeof agentDecisions.$inferSelect;
export type InsertAgentDecision = typeof agentDecisions.$inferInsert;

/**
 * Web Automation Sessions - Sessions de navigation web autonome
 */
export const webAutomationSessions = mysqlTable("web_automation_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  taskId: varchar("taskId", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  
  // URL et objectif
  url: varchar("url", { length: 2048 }).notNull(),
  objective: text("objective").notNull(),
  
  // Actions effectuées
  actions: json("actions").$type<Array<{
    type: string;
    selector?: string;
    value?: string;
    result?: string;
    timestamp: number;
  }>>(),
  
  // Résultats
  extractedData: json("extractedData").$type<Record<string, unknown>>(),
  screenshot: text("screenshot"), // Base64 encoded
  
  // Statut
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending"),
  errorMessage: text("errorMessage"),
  
  // Timing
  startTime: timestamp("startTime").defaultNow(),
  endTime: timestamp("endTime"),
  duration: int("duration"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebAutomationSession = typeof webAutomationSessions.$inferSelect;
export type InsertWebAutomationSession = typeof webAutomationSessions.$inferInsert;


// ============================================================================
// USER FILES - Fichiers uploadés par les utilisateurs
// ============================================================================

/**
 * User Files - Fichiers uploadés par les utilisateurs (PDF, TXT, MD, etc.)
 * Persistés en base de données pour survivre aux redémarrages du serveur
 */
export const userFiles = mysqlTable("user_files", {
  id: varchar("id", { length: 64 }).primaryKey(), // nanoid
  userId: int("userId").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  size: int("size").notNull(), // in bytes
  storageUrl: text("storageUrl").notNull(), // S3 URL
  storageKey: varchar("storageKey", { length: 512 }).notNull(), // S3 key
  extractedText: text("extractedText"), // Texte extrait du fichier
  metadata: json("metadata").$type<Record<string, unknown>>(), // Métadonnées additionnelles
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserFile = typeof userFiles.$inferSelect;
export type InsertUserFile = typeof userFiles.$inferInsert;
