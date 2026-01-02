/**
 * Module 02: Memory Sync - Document Knowledge Base
 * 
 * Gère l'indexation des documents PDF et leur utilisation comme
 * source de vérité pour Phoenix. Organise les documents selon
 * la hiérarchie de priorité H0-H3.
 * 
 * Priorités:
 * - H0 (Critique): Axiomes fondamentaux, règles inviolables
 * - H1 (Haute): Principes directeurs, architecture core
 * - H2 (Moyenne): Guidelines, bonnes pratiques
 * - H3 (Basse): Références, exemples, documentation
 */

import { getDb } from "../db";
import { 
  referenceDocuments, 
  documentChunks, 
  documentAccessLog,
  knowledgeConcepts,
  InsertReferenceDocument,
  InsertDocumentChunk,
  InsertKnowledgeConcept
} from "../../drizzle/schema";
import { eq, desc, and, like, inArray, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { isUserAdmin, logAdminAction } from "../db";

// Priority weights for relevance scoring
const PRIORITY_WEIGHTS = {
  H0: 4.0,  // Critical - highest weight
  H1: 3.0,  // High priority
  H2: 2.0,  // Medium priority
  H3: 1.0,  // Low priority
};

type Priority = "H0" | "H1" | "H2" | "H3";

export interface DocumentUploadParams {
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  priority: Priority;
  category?: string;
  tags?: string[];
  uploadedBy: number;
}

export interface ChunkParams {
  documentId: number;
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  priority: Priority;
}

export interface SearchParams {
  query: string;
  priorities?: Priority[];
  categories?: string[];
  limit?: number;
  userId?: number;
  contextId?: string;
}

export interface SearchResult {
  documentId: number;
  chunkId: number;
  title: string;
  content: string;
  priority: Priority;
  relevanceScore: number;
  pageNumber?: number;
  sectionTitle?: string;
}

/**
 * Memory Sync Module - Singleton
 */
class MemorySyncModule {
  private static instance: MemorySyncModule;

  private constructor() {}

  static getInstance(): MemorySyncModule {
    if (!MemorySyncModule.instance) {
      MemorySyncModule.instance = new MemorySyncModule();
    }
    return MemorySyncModule.instance;
  }

  /**
   * Upload a new reference document (requires admin approval)
   */
  async uploadDocument(params: DocumentUploadParams): Promise<number | null> {
    const db = await getDb();
    if (!db) return null;

    const [result] = await db.insert(referenceDocuments).values({
      title: params.title,
      description: params.description,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      fileSize: params.fileSize,
      mimeType: params.mimeType || "application/pdf",
      priority: params.priority,
      category: params.category,
      tags: params.tags,
      uploadedBy: params.uploadedBy,
      status: "pending", // Requires admin approval
    });

    return result.insertId;
  }

  /**
   * Approve a document (admin only)
   */
  async approveDocument(documentId: number, adminId: number): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    // Verify admin
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) return false;

    await db.update(referenceDocuments)
      .set({ 
        status: "approved",
        approvedBy: adminId,
        approvedAt: new Date()
      })
      .where(eq(referenceDocuments.id, documentId));

    await logAdminAction({
      adminId,
      action: "approve_document",
      resourceType: "reference_document",
      resourceId: documentId,
      changes: { status: "approved" }
    });

    return true;
  }

  /**
   * Reject a document (admin only)
   */
  async rejectDocument(documentId: number, adminId: number, reason?: string): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) return false;

    await db.update(referenceDocuments)
      .set({ status: "rejected" })
      .where(eq(referenceDocuments.id, documentId));

    await logAdminAction({
      adminId,
      action: "reject_document",
      resourceType: "reference_document",
      resourceId: documentId,
      changes: { status: "rejected", reason }
    });

    return true;
  }

  /**
   * Index a document by extracting and chunking its content
   */
  async indexDocument(documentId: number, content: string, adminId: number): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) return false;

    // Get document info
    const [doc] = await db.select()
      .from(referenceDocuments)
      .where(eq(referenceDocuments.id, documentId));

    if (!doc || doc.status !== "approved") return false;

    // Split content into chunks
    const chunks = this.splitIntoChunks(content, 1000);

    // Store chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await db.insert(documentChunks).values({
        documentId,
        chunkIndex: i,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        priority: doc.priority,
      });
    }

    // Mark document as indexed
    await db.update(referenceDocuments)
      .set({ 
        isIndexed: true,
        indexedAt: new Date()
      })
      .where(eq(referenceDocuments.id, documentId));

    await logAdminAction({
      adminId,
      action: "index_document",
      resourceType: "reference_document",
      resourceId: documentId,
      changes: { chunksCreated: chunks.length }
    });

    return true;
  }

  /**
   * Split content into chunks for indexing
   */
  private splitIntoChunks(content: string, maxChunkSize: number): Array<{
    content: string;
    pageNumber?: number;
    sectionTitle?: string;
  }> {
    const chunks: Array<{
      content: string;
      pageNumber?: number;
      sectionTitle?: string;
    }> = [];

    // Split by paragraphs first
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = "";
    let currentPage = 1;

    for (const paragraph of paragraphs) {
      // Check for page markers
      const pageMatch = paragraph.match(/\[Page (\d+)\]/);
      if (pageMatch) {
        currentPage = parseInt(pageMatch[1]);
      }

      // Check for section headers
      const sectionMatch = paragraph.match(/^#+\s*(.+)$/m);
      const sectionTitle = sectionMatch ? sectionMatch[1] : undefined;

      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          pageNumber: currentPage,
          sectionTitle
        });
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: currentPage
      });
    }

    return chunks;
  }

  /**
   * Search documents with priority-weighted relevance
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    const db = await getDb();
    if (!db) return [];

    const { query, priorities, categories, limit = 10, userId, contextId } = params;

    // Build query conditions
    const conditions = [
      eq(referenceDocuments.status, "approved"),
      eq(referenceDocuments.isIndexed, true)
    ];

    if (priorities && priorities.length > 0) {
      conditions.push(inArray(referenceDocuments.priority, priorities));
    }

    if (categories && categories.length > 0) {
      conditions.push(inArray(referenceDocuments.category, categories));
    }

    // Get matching documents
    const docs = await db.select()
      .from(referenceDocuments)
      .where(and(...conditions));

    // Search in chunks
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    for (const doc of docs) {
      const chunks = await db.select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, doc.id));

      for (const chunk of chunks) {
        const contentLower = chunk.content.toLowerCase();
        
        // Calculate relevance score
        let termMatches = 0;
        for (const term of queryTerms) {
          if (contentLower.includes(term)) {
            termMatches++;
          }
        }

        if (termMatches > 0) {
          const termScore = termMatches / queryTerms.length;
          const priorityWeight = PRIORITY_WEIGHTS[doc.priority as Priority];
          const relevanceScore = termScore * priorityWeight;

          results.push({
            documentId: doc.id,
            chunkId: chunk.id,
            title: doc.title,
            content: chunk.content,
            priority: doc.priority as Priority,
            relevanceScore,
            pageNumber: chunk.pageNumber || undefined,
            sectionTitle: chunk.sectionTitle || undefined
          });

          // Log access
          if (userId) {
            await db.insert(documentAccessLog).values({
              documentId: doc.id,
              chunkId: chunk.id,
              accessType: "search",
              query,
              relevanceScore,
              userId,
              contextId
            });
          }
        }
      }
    }

    // Sort by relevance and limit
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, limit);
  }

  /**
   * Get context for Phoenix decisions based on priority
   */
  async getContextForDecision(query: string, userId?: number): Promise<string> {
    // Search with priority order: H0 first, then H1, H2, H3
    const h0Results = await this.search({ query, priorities: ["H0"], limit: 3, userId });
    const h1Results = await this.search({ query, priorities: ["H1"], limit: 3, userId });
    const h2Results = await this.search({ query, priorities: ["H2"], limit: 2, userId });
    const h3Results = await this.search({ query, priorities: ["H3"], limit: 2, userId });

    const allResults = [...h0Results, ...h1Results, ...h2Results, ...h3Results];

    if (allResults.length === 0) {
      return "Aucune référence documentaire trouvée pour cette requête.";
    }

    let context = "## Références Documentaires (par priorité)\n\n";

    // Group by priority
    const byPriority: Record<string, SearchResult[]> = {
      H0: [], H1: [], H2: [], H3: []
    };

    for (const result of allResults) {
      byPriority[result.priority].push(result);
    }

    const priorityLabels: Record<string, string> = {
      H0: "🔴 CRITIQUE (H0)",
      H1: "🟠 HAUTE (H1)",
      H2: "🟡 MOYENNE (H2)",
      H3: "🟢 BASSE (H3)"
    };

    for (const priority of ["H0", "H1", "H2", "H3"]) {
      const results = byPriority[priority];
      if (results.length > 0) {
        context += `### ${priorityLabels[priority]}\n\n`;
        for (const result of results) {
          context += `**${result.title}**`;
          if (result.pageNumber) context += ` (Page ${result.pageNumber})`;
          context += `\n> ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n\n`;
        }
      }
    }

    return context;
  }

  /**
   * Extract key concepts from a document using LLM
   */
  async extractConcepts(documentId: number, adminId: number): Promise<number> {
    const db = await getDb();
    if (!db) return 0;

    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) return 0;

    // Get document chunks
    const chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    if (chunks.length === 0) return 0;

    // Combine chunks for analysis
    const fullContent = chunks.map((c: { content: string }) => c.content).join("\n\n");
    const priority = chunks[0].priority;

    // Use LLM to extract concepts
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Tu es un expert en extraction de concepts. Extrais les concepts clés du texte suivant.
          
Pour chaque concept, fournis:
- name: Le nom du concept (court)
- definition: Une définition concise
- tags: 2-3 tags pertinents

Réponds en JSON avec un tableau "concepts".`
        },
        {
          role: "user",
          content: fullContent.substring(0, 8000) // Limit to avoid token overflow
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "concepts_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              concepts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    definition: { type: "string" },
                    tags: { type: "array", items: { type: "string" } }
                  },
                  required: ["name", "definition", "tags"],
                  additionalProperties: false
                }
              }
            },
            required: ["concepts"],
            additionalProperties: false
          }
        }
      }
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') return 0;
    const content = rawContent;

    try {
      const parsed = JSON.parse(content);
      const concepts = parsed.concepts || [];

      for (const concept of concepts) {
        await db.insert(knowledgeConcepts).values({
          name: concept.name,
          definition: concept.definition,
          priority: priority as Priority,
          sourceDocumentId: documentId,
          tags: concept.tags,
          confidence: 0.8
        });
      }

      await logAdminAction({
        adminId,
        action: "extract_concepts",
        resourceType: "reference_document",
        resourceId: documentId,
        changes: { conceptsExtracted: concepts.length }
      });

      return concepts.length;
    } catch (e) {
      console.error("[MemorySync] Failed to parse concepts:", e);
      return 0;
    }
  }

  /**
   * Get all documents with their status
   */
  async getDocuments(status?: string): Promise<any[]> {
    const db = await getDb();
    if (!db) return [];

    if (status) {
      return db.select()
        .from(referenceDocuments)
        .where(eq(referenceDocuments.status, status as any))
        .orderBy(desc(referenceDocuments.createdAt));
    }

    return db.select()
      .from(referenceDocuments)
      .orderBy(desc(referenceDocuments.createdAt));
  }

  /**
   * Get document statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    totalChunks: number;
    totalConcepts: number;
  }> {
    const db = await getDb();
    if (!db) return {
      totalDocuments: 0,
      byPriority: {},
      byStatus: {},
      totalChunks: 0,
      totalConcepts: 0
    };

    const docs = await db.select().from(referenceDocuments);
    const chunks = await db.select().from(documentChunks);
    const concepts = await db.select().from(knowledgeConcepts);

    const byPriority: Record<string, number> = { H0: 0, H1: 0, H2: 0, H3: 0 };
    const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0, archived: 0 };

    for (const doc of docs) {
      byPriority[doc.priority]++;
      byStatus[doc.status]++;
    }

    return {
      totalDocuments: docs.length,
      byPriority,
      byStatus,
      totalChunks: chunks.length,
      totalConcepts: concepts.length
    };
  }
}

// Export singleton getter
export function getMemorySyncModule(): MemorySyncModule {
  return MemorySyncModule.getInstance();
}
