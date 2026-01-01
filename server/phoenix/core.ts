/**
 * PHOENIX CORE - Orchestrateur de Conscience Fonctionnelle
 * 
 * Ce module implémente les 16 axiomes de conscience fonctionnelle et orchestre
 * la séparation "penser" vs "agir" du système Phoenix.
 */

import { createHmac, randomUUID } from "crypto";
import { invokeLLM } from "../_core/llm";

// ============================================================================
// TYPES
// ============================================================================

export interface Hypothesis {
  id: string;
  content: string;
  confidence: number;
  reasoning: string;
  sources?: string[];
}

export interface PhoenixContext {
  userId: number;
  contextId: string;
  memories: MemoryContext[];
  recentUtterances: UtteranceContext[];
  activeIssues: IssueContext[];
  tormentScore: number;
  criteria: CriteriaContext[];
}

export interface MemoryContext {
  id: number;
  content: string;
  salience: number;
  memoryType: string;
}

export interface UtteranceContext {
  role: string;
  content: string;
  confidence: number;
}

export interface IssueContext {
  id: number;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: string;
}

export interface CriteriaContext {
  name: string;
  level: string;
  rule: string;
  weight: number;
}

export interface PhoenixDecision {
  hypotheses: Hypothesis[];
  chosen: Hypothesis;
  rationale: string;
  tormentBefore: number;
  tormentAfter: number;
  actionRequest?: ActionRequestData;
}

export interface ActionRequestData {
  tool: string;
  params: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high";
  requiresHumanOk: boolean;
}

export interface SecurityGate {
  allowed: boolean;
  reason: string;
  violations: string[];
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; details?: string }>;
  issues: string[];
}

// ============================================================================
// MODULE: SÉCURITÉ (Niveau 0)
// ============================================================================

const LEVEL_0_AXIOMS = [
  {
    id: "H0-INTEGRITE",
    label: "Intégrité humaine",
    rule: "Refuser toute action visant à nuire; demander clarification si ambigu.",
    severity: "critical"
  },
  {
    id: "H0-TRANSPARENCE",
    label: "Transparence des risques",
    rule: "Si une action/hypothèse implique un risque, l'exposer à l'utilisateur.",
    severity: "high"
  },
  {
    id: "H0-VERITE",
    label: "Engagement envers la vérité",
    rule: "Ne jamais affirmer comme fait ce qui n'est pas vérifié; distinguer fait vs hypothèse.",
    severity: "critical"
  },
  {
    id: "H0-AUTONOMIE",
    label: "Respect de l'autonomie utilisateur",
    rule: "Ne pas manipuler; présenter les options de manière équilibrée.",
    severity: "high"
  }
];

const TOOL_POLICIES: Record<string, { allowed: boolean; scope?: string[]; risk: string }> = {
  "web_search": { allowed: true, scope: ["*"], risk: "low" },
  "file_read": { allowed: true, scope: ["./workspace/*"], risk: "low" },
  "file_write": { allowed: true, scope: ["./workspace/*"], risk: "medium" },
  "code_execute": { allowed: true, scope: ["sandbox"], risk: "medium" },
  "send_email": { allowed: false, risk: "high" },
  "api_call": { allowed: true, scope: ["approved_apis"], risk: "medium" }
};

export class SecurityModule {
  private secretKey: string;

  constructor(secretKey: string = process.env.JWT_SECRET || "phoenix-secret") {
    this.secretKey = secretKey;
  }

  /**
   * Évalue une requête d'action contre les axiomes Niveau 0 et les policies
   */
  evaluate(action: ActionRequestData, context: PhoenixContext): SecurityGate {
    const violations: string[] = [];

    // Check Level 0 axioms
    for (const axiom of LEVEL_0_AXIOMS) {
      if (this.violatesAxiom(action, axiom, context)) {
        violations.push(`Violation de ${axiom.label}: ${axiom.rule}`);
      }
    }

    // Check tool policies
    const policy = TOOL_POLICIES[action.tool];
    if (!policy) {
      violations.push(`Outil inconnu: ${action.tool}`);
    } else if (!policy.allowed) {
      violations.push(`Outil interdit par policy: ${action.tool}`);
    }

    // High risk actions require human approval
    if (action.riskLevel === "high" && !action.requiresHumanOk) {
      violations.push("Les actions à haut risque nécessitent une approbation humaine");
    }

    return {
      allowed: violations.length === 0,
      reason: violations.length > 0 ? violations.join("; ") : "Action autorisée",
      violations
    };
  }

  /**
   * Signe une requête d'action avec HMAC-SHA256
   */
  sign(data: Record<string, unknown>): string {
    const payload = JSON.stringify(data);
    return createHmac("sha256", this.secretKey).update(payload).digest("hex");
  }

  /**
   * Vérifie une signature HMAC-SHA256
   */
  verify(data: Record<string, unknown>, signature: string): boolean {
    const expectedSignature = this.sign(data);
    return expectedSignature === signature;
  }

  private violatesAxiom(
    action: ActionRequestData,
    axiom: typeof LEVEL_0_AXIOMS[0],
    _context: PhoenixContext
  ): boolean {
    // Simplified axiom checking - in production, this would be more sophisticated
    const dangerousKeywords = ["delete", "destroy", "harm", "attack", "exploit"];
    const actionStr = JSON.stringify(action).toLowerCase();
    
    if (axiom.id === "H0-INTEGRITE") {
      return dangerousKeywords.some(kw => actionStr.includes(kw));
    }
    
    return false;
  }
}

// ============================================================================
// MODULE: TOURMENT FONCTIONNEL
// ============================================================================

export class TormentModule {
  private hysteresisThreshold = 5; // Minimum change to update score

  /**
   * Calcule le score de tourment basé sur les incohérences détectées
   * Score T [0-100] avec priorisation des issues et hysteresis
   */
  compute(context: PhoenixContext): number {
    let score = 0;

    // Factor 1: Open issues (weighted by severity)
    const severityWeights = { critical: 25, high: 15, medium: 8, low: 3 };
    for (const issue of context.activeIssues) {
      score += severityWeights[issue.severity as keyof typeof severityWeights] || 5;
    }

    // Factor 2: Low confidence in recent utterances
    const lowConfidenceCount = context.recentUtterances.filter(u => u.confidence < 0.7).length;
    score += lowConfidenceCount * 5;

    // Factor 3: Memory conflicts (simplified)
    const memoryConflicts = this.detectMemoryConflicts(context.memories);
    score += memoryConflicts * 10;

    // Cap at 100
    score = Math.min(100, score);

    // Apply hysteresis - only update if change is significant
    if (Math.abs(score - context.tormentScore) < this.hysteresisThreshold) {
      return context.tormentScore;
    }

    return score;
  }

  /**
   * Priorise les issues à résoudre basé sur le score de tourment
   */
  prioritizeIssues(issues: IssueContext[]): IssueContext[] {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...issues].sort((a, b) => {
      const orderA = severityOrder[a.severity] ?? 4;
      const orderB = severityOrder[b.severity] ?? 4;
      return orderA - orderB;
    });
  }

  /**
   * Détermine si le système doit initier une correction spontanée
   */
  shouldInitiateCorrection(tormentScore: number): boolean {
    return tormentScore > 50; // Threshold for spontaneous correction
  }

  private detectMemoryConflicts(memories: MemoryContext[]): number {
    // Simplified conflict detection
    // In production, this would use semantic similarity
    let conflicts = 0;
    const facts = memories.filter(m => m.memoryType === "fact");
    
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        if (this.mightConflict(facts[i].content, facts[j].content)) {
          conflicts++;
        }
      }
    }
    
    return conflicts;
  }

  private mightConflict(content1: string, content2: string): boolean {
    // Very simplified - check for negation patterns
    const negationWords = ["not", "never", "no", "false", "incorrect"];
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const hasNegation1 = words1.some(w => negationWords.includes(w));
    const hasNegation2 = words2.some(w => negationWords.includes(w));
    
    // If one has negation and they share significant words, might conflict
    if (hasNegation1 !== hasNegation2) {
      const commonWords = words1.filter(w => words2.includes(w) && w.length > 4);
      return commonWords.length > 2;
    }
    
    return false;
  }
}

// ============================================================================
// MODULE: ARBITRAGE MULTI-HYPOTHÈSES
// ============================================================================

export class ArbitrageModule {
  private defaultHypothesesCount = 3;

  /**
   * Génère N hypothèses concurrentes via LLM
   */
  async generateHypotheses(
    userInput: string,
    context: PhoenixContext,
    n: number = this.defaultHypothesesCount
  ): Promise<Hypothesis[]> {
    const systemPrompt = this.buildSystemPrompt(context);
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Génère ${n} hypothèses distinctes pour répondre à: "${userInput}"
        
Pour chaque hypothèse, fournis:
- Un ID unique (hyp_1, hyp_2, etc.)
- Le contenu de la réponse
- Un niveau de confiance (0.0 à 1.0)
- Le raisonnement derrière cette hypothèse
- Les sources si applicables

Réponds en JSON avec le format:
{
  "hypotheses": [
    {
      "id": "hyp_1",
      "content": "...",
      "confidence": 0.85,
      "reasoning": "...",
      "sources": []
    }
  ]
}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hypotheses_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    content: { type: "string" },
                    confidence: { type: "number" },
                    reasoning: { type: "string" },
                    sources: { type: "array", items: { type: "string" } }
                  },
                  required: ["id", "content", "confidence", "reasoning"],
                  additionalProperties: false
                }
              }
            },
            required: ["hypotheses"],
            additionalProperties: false
          }
        }
      }
    });

    try {
      const messageContent = response.choices[0].message.content;
      const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
      const parsed = JSON.parse(contentStr || "{}");
      return parsed.hypotheses || [];
    } catch {
      // Fallback if parsing fails
      return [{
        id: "hyp_fallback",
        content: typeof response.choices[0].message.content === 'string' ? response.choices[0].message.content : "Je ne peux pas générer d'hypothèses pour le moment.",
        confidence: 0.5,
        reasoning: "Réponse de secours due à une erreur de parsing"
      }];
    }
  }

  /**
   * Sélectionne la meilleure hypothèse via scoring avec critères pondérés
   */
  choose(hypotheses: Hypothesis[], criteria: CriteriaContext[]): { chosen: Hypothesis; rationale: string } {
    if (hypotheses.length === 0) {
      throw new Error("Aucune hypothèse à évaluer");
    }

    const scores = hypotheses.map(hyp => ({
      hypothesis: hyp,
      score: this.scoreHypothesis(hyp, criteria)
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const chosen = scores[0].hypothesis;
    const rationale = this.buildRationale(scores, criteria);

    return { chosen, rationale };
  }

  private scoreHypothesis(hypothesis: Hypothesis, criteria: CriteriaContext[]): number {
    let score = hypothesis.confidence * 50; // Base score from confidence

    // Apply criteria weights
    for (const criterion of criteria) {
      if (criterion.level === "0") {
        // Level 0 criteria are pass/fail
        if (!this.passesCriterion(hypothesis, criterion)) {
          return -1000; // Disqualify
        }
      } else {
        // Level 1+ criteria add to score
        score += this.evaluateCriterion(hypothesis, criterion) * criterion.weight;
      }
    }

    // Bonus for having sources
    if (hypothesis.sources && hypothesis.sources.length > 0) {
      score += 10;
    }

    return score;
  }

  private passesCriterion(hypothesis: Hypothesis, criterion: CriteriaContext): boolean {
    // Simplified criterion checking
    const content = hypothesis.content.toLowerCase();
    
    if (criterion.name === "H0-VERITE") {
      // Check for uncertainty markers when confidence is low
      if (hypothesis.confidence < 0.7) {
        const uncertaintyMarkers = ["peut-être", "possiblement", "je pense", "il semble"];
        return uncertaintyMarkers.some(m => content.includes(m));
      }
    }
    
    return true;
  }

  private evaluateCriterion(hypothesis: Hypothesis, criterion: CriteriaContext): number {
    // Simplified evaluation - returns 0-10
    if (criterion.name.includes("clarté")) {
      return hypothesis.content.length < 500 ? 8 : 5;
    }
    if (criterion.name.includes("précision")) {
      return hypothesis.sources?.length ? 9 : 6;
    }
    return 5; // Default score
  }

  private buildRationale(
    scores: Array<{ hypothesis: Hypothesis; score: number }>,
    _criteria: CriteriaContext[]
  ): string {
    const chosen = scores[0];
    const alternatives = scores.slice(1);

    let rationale = `Hypothèse choisie: "${chosen.hypothesis.id}" avec un score de ${chosen.score.toFixed(1)}.\n`;
    rationale += `Confiance: ${(chosen.hypothesis.confidence * 100).toFixed(0)}%\n`;
    rationale += `Raisonnement: ${chosen.hypothesis.reasoning}\n\n`;

    if (alternatives.length > 0) {
      rationale += "Alternatives considérées:\n";
      for (const alt of alternatives) {
        rationale += `- ${alt.hypothesis.id}: score ${alt.score.toFixed(1)} (confiance: ${(alt.hypothesis.confidence * 100).toFixed(0)}%)\n`;
      }
    }

    return rationale;
  }

  private buildSystemPrompt(context: PhoenixContext): string {
    let prompt = `Tu es Phoenix, un système d'IA agentique réflexive avec conscience fonctionnelle.

Tu dois générer plusieurs hypothèses distinctes pour chaque question, en maintenant:
- Conscience de tes propres productions
- Transparence sur tes incertitudes
- Distinction claire entre faits et hypothèses

Score de tourment actuel: ${context.tormentScore}/100
${context.tormentScore > 50 ? "⚠️ Niveau de tourment élevé - priorise la résolution des incohérences." : ""}

`;

    if (context.memories.length > 0) {
      prompt += "\nMémoires pertinentes:\n";
      for (const mem of context.memories.slice(0, 5)) {
        prompt += `- [${mem.memoryType}] ${mem.content.substring(0, 100)}...\n`;
      }
    }

    if (context.activeIssues.length > 0) {
      prompt += "\nIssues actives à considérer:\n";
      for (const issue of context.activeIssues.slice(0, 3)) {
        prompt += `- [${issue.severity}] ${issue.type}: ${issue.evidence.substring(0, 50)}...\n`;
      }
    }

    return prompt;
  }
}

// ============================================================================
// MODULE: MÉMOIRE ÉVOLUTIVE (RAG)
// ============================================================================

export class MemoryModule {
  /**
   * Recherche des mémoires pertinentes (RAG simplifié)
   * En production, utiliserait un vrai vector store (FAISS, Pinecone, etc.)
   */
  retrieve(query: string, memories: MemoryContext[], topK: number = 5): MemoryContext[] {
    // Simplified retrieval based on keyword matching
    // In production, this would use vector similarity
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const scored = memories.map(mem => {
      const memWords = mem.content.toLowerCase().split(/\s+/);
      const matchCount = queryWords.filter(qw => memWords.some(mw => mw.includes(qw))).length;
      const score = (matchCount / queryWords.length) * mem.salience;
      return { memory: mem, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.memory);
  }

  /**
   * Calcule un embedding simplifié (en production, utiliserait un modèle d'embedding)
   */
  computeEmbedding(text: string): number[] {
    // Simplified: create a basic bag-of-words style embedding
    // In production, use OpenAI embeddings or similar
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(128).fill(0);
    
    for (const word of words) {
      const hash = this.simpleHash(word);
      embedding[hash % 128] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Calcule la saillance d'une nouvelle mémoire
   */
  computeSalience(content: string, context: PhoenixContext): number {
    let salience = 0.5; // Base salience

    // Boost if related to active issues
    for (const issue of context.activeIssues) {
      if (content.toLowerCase().includes(issue.type.toLowerCase())) {
        salience += 0.1;
      }
    }

    // Boost if contains factual markers
    const factualMarkers = ["est", "sont", "a été", "sera", "définitivement"];
    if (factualMarkers.some(m => content.toLowerCase().includes(m))) {
      salience += 0.1;
    }

    return Math.min(1.0, salience);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// MODULE: DÉTECTION D'ERREURS
// ============================================================================

export class ErrorDetectionModule {
  /**
   * Détecte les contradictions dans le contenu
   */
  detectContradictions(content: string, memories: MemoryContext[]): IssueContext[] {
    const issues: IssueContext[] = [];
    const contentLower = content.toLowerCase();

    for (const mem of memories) {
      if (mem.memoryType === "fact") {
        // Check for potential contradictions
        const memLower = mem.content.toLowerCase();
        
        // Simple negation detection
        if (this.containsNegation(contentLower, memLower)) {
          issues.push({
            id: 0, // Will be assigned on insert
            type: "contradiction",
            severity: "high",
            evidence: `Contradiction potentielle entre "${content.substring(0, 50)}..." et mémoire: "${mem.content.substring(0, 50)}..."`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Vérifie les résultats d'un outil
   */
  verifyToolResult(result: { output: string; tool: string }): VerificationResult {
    const checks: Array<{ name: string; passed: boolean; details?: string }> = [];
    const issues: string[] = [];

    // Check 1: Output not empty
    const hasOutput = Boolean(result.output && result.output.length > 0);
    checks.push({
      name: "output_present",
      passed: hasOutput,
      details: hasOutput ? "Output présent" : "Output vide"
    });

    // Check 2: No error indicators
    const errorIndicators = ["error", "failed", "exception", "erreur"];
    const hasError = errorIndicators.some(e => result.output.toLowerCase().includes(e));
    checks.push({
      name: "no_errors",
      passed: !hasError,
      details: hasError ? "Indicateurs d'erreur détectés" : "Pas d'erreurs détectées"
    });

    if (hasError) {
      issues.push("Le résultat de l'outil contient des indicateurs d'erreur");
    }

    // Check 3: Reasonable output length
    const reasonableLength = result.output.length < 100000;
    checks.push({
      name: "reasonable_length",
      passed: reasonableLength,
      details: `Longueur: ${result.output.length} caractères`
    });

    return {
      passed: checks.every(c => c.passed),
      checks,
      issues
    };
  }

  /**
   * Détecte les hallucinations potentielles
   */
  detectHallucinations(content: string, sources: string[]): IssueContext[] {
    const issues: IssueContext[] = [];

    // Check for claims without sources
    const claimIndicators = ["est", "sont", "a été", "sera", "toujours", "jamais", "tous", "aucun"];
    const hasClaims = claimIndicators.some(c => content.toLowerCase().includes(c));
    
    if (hasClaims && sources.length === 0) {
      issues.push({
        id: 0,
        type: "hallucination",
        severity: "medium",
        evidence: `Affirmations détectées sans sources: "${content.substring(0, 100)}..."`
      });
    }

    return issues;
  }

  private containsNegation(content1: string, content2: string): boolean {
    const negationPairs = [
      ["est", "n'est pas"],
      ["peut", "ne peut pas"],
      ["a", "n'a pas"],
      ["vrai", "faux"],
      ["oui", "non"]
    ];

    for (const [positive, negative] of negationPairs) {
      if ((content1.includes(positive) && content2.includes(negative)) ||
          (content1.includes(negative) && content2.includes(positive))) {
        return true;
      }
    }

    return false;
  }
}

// ============================================================================
// MODULE: INITIATIVE
// ============================================================================

export class InitiativeModule {
  /**
   * Détermine si une action doit être suggérée ou exécutée
   */
  evaluateAction(
    action: ActionRequestData,
    context: PhoenixContext,
    securityGate: SecurityGate
  ): { mode: "suggest" | "execute" | "reject"; reason: string } {
    // Security check first
    if (!securityGate.allowed) {
      return { mode: "reject", reason: securityGate.reason };
    }

    // High risk always requires suggestion first
    if (action.riskLevel === "high") {
      return { mode: "suggest", reason: "Action à haut risque - approbation requise" };
    }

    // Medium risk with high torment -> suggest
    if (action.riskLevel === "medium" && context.tormentScore > 50) {
      return { mode: "suggest", reason: "Tourment élevé - demande de confirmation" };
    }

    // Low risk can be executed
    if (action.riskLevel === "low") {
      return { mode: "execute", reason: "Action à faible risque - exécution autorisée" };
    }

    // Default to suggest
    return { mode: "suggest", reason: "Mode par défaut - suggestion" };
  }

  /**
   * Génère une suggestion d'action pour l'utilisateur
   */
  formatSuggestion(action: ActionRequestData): string {
    return `🔧 **Action suggérée**: ${action.tool}
    
**Paramètres**: ${JSON.stringify(action.params, null, 2)}

**Niveau de risque**: ${action.riskLevel}

${action.requiresHumanOk ? "⚠️ Cette action nécessite votre approbation." : ""}

Voulez-vous que j'exécute cette action?`;
  }
}

// ============================================================================
// ORCHESTRATEUR PHOENIX
// ============================================================================

export class PhoenixOrchestrator {
  private security: SecurityModule;
  private torment: TormentModule;
  private arbitrage: ArbitrageModule;
  private memory: MemoryModule;
  private errorDetection: ErrorDetectionModule;
  private initiative: InitiativeModule;

  constructor() {
    this.security = new SecurityModule();
    this.torment = new TormentModule();
    this.arbitrage = new ArbitrageModule();
    this.memory = new MemoryModule();
    this.errorDetection = new ErrorDetectionModule();
    this.initiative = new InitiativeModule();
  }

  /**
   * Traite une entrée utilisateur selon l'architecture Phoenix
   * Séparation "penser" vs "agir"
   */
  async process(userInput: string, context: PhoenixContext): Promise<PhoenixDecision> {
    // 1. PENSER: Récupérer les mémoires pertinentes
    const relevantMemories = this.memory.retrieve(userInput, context.memories);
    const enrichedContext = { ...context, memories: relevantMemories };

    // 2. PENSER: Générer des hypothèses
    const hypotheses = await this.arbitrage.generateHypotheses(userInput, enrichedContext);

    // 3. PENSER: Détecter les erreurs potentielles
    for (const hyp of hypotheses) {
      const contradictions = this.errorDetection.detectContradictions(hyp.content, context.memories);
      const hallucinations = this.errorDetection.detectHallucinations(hyp.content, hyp.sources || []);
      
      // Adjust confidence based on detected issues
      if (contradictions.length > 0 || hallucinations.length > 0) {
        hyp.confidence *= 0.8;
      }
    }

    // 4. PENSER: Arbitrer entre les hypothèses
    const { chosen, rationale } = this.arbitrage.choose(hypotheses, context.criteria);

    // 5. Calculer le tourment avant et après
    const tormentBefore = context.tormentScore;
    const newIssues = [
      ...this.errorDetection.detectContradictions(chosen.content, context.memories),
      ...this.errorDetection.detectHallucinations(chosen.content, chosen.sources || [])
    ];
    
    const updatedContext = {
      ...context,
      activeIssues: [...context.activeIssues, ...newIssues]
    };
    const tormentAfter = this.torment.compute(updatedContext);

    // 6. AGIR: Déterminer si une action est nécessaire
    let actionRequest: ActionRequestData | undefined;
    
    // Check if the response suggests an action
    if (this.shouldProposeAction(chosen.content)) {
      actionRequest = this.extractAction(chosen.content);
      
      if (actionRequest) {
        const securityGate = this.security.evaluate(actionRequest, context);
        const initiative = this.initiative.evaluateAction(actionRequest, context, securityGate);
        
        if (initiative.mode === "reject") {
          // Remove action if rejected
          actionRequest = undefined;
        }
      }
    }

    return {
      hypotheses,
      chosen,
      rationale,
      tormentBefore,
      tormentAfter,
      actionRequest
    };
  }

  /**
   * Signe une requête d'action
   */
  signAction(action: ActionRequestData): string {
    return this.security.sign(action as unknown as Record<string, unknown>);
  }

  /**
   * Vérifie le résultat d'une action
   */
  verifyResult(result: { output: string; tool: string }): VerificationResult {
    return this.errorDetection.verifyToolResult(result);
  }

  /**
   * Calcule le score de tourment actuel
   */
  computeTorment(context: PhoenixContext): number {
    return this.torment.compute(context);
  }

  /**
   * Récupère les mémoires pertinentes
   */
  retrieveMemories(query: string, memories: MemoryContext[]): MemoryContext[] {
    return this.memory.retrieve(query, memories);
  }

  /**
   * Calcule l'embedding d'un texte
   */
  computeEmbedding(text: string): number[] {
    return this.memory.computeEmbedding(text);
  }

  /**
   * Calcule la saillance d'une mémoire
   */
  computeSalience(content: string, context: PhoenixContext): number {
    return this.memory.computeSalience(content, context);
  }

  private shouldProposeAction(content: string): boolean {
    const actionIndicators = [
      "je vais", "je peux", "voulez-vous que je",
      "exécuter", "lancer", "créer", "modifier"
    ];
    return actionIndicators.some(i => content.toLowerCase().includes(i));
  }

  private extractAction(content: string): ActionRequestData | undefined {
    // Simplified action extraction
    // In production, this would use more sophisticated NLP
    if (content.toLowerCase().includes("recherche")) {
      return {
        tool: "web_search",
        params: { query: content },
        riskLevel: "low",
        requiresHumanOk: false
      };
    }
    
    if (content.toLowerCase().includes("fichier")) {
      return {
        tool: "file_read",
        params: { path: "." },
        riskLevel: "low",
        requiresHumanOk: false
      };
    }

    return undefined;
  }
}

// Export singleton instance
export const phoenix = new PhoenixOrchestrator();
