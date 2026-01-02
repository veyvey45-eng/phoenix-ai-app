import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
  conversations, InsertConversation, Conversation
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

export async function getRecentUtterances(userId: number, limit = 20): Promise<Utterance[]> {
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
