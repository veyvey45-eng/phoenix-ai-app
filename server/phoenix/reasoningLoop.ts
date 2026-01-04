/**
 * REASONING LOOP - Boucle de Décision Autonome
 * 
 * Responsabilités:
 * 1. Analyser les erreurs de code
 * 2. Générer des corrections automatiques
 * 3. Prendre des décisions autonomes
 * 4. Évaluer les options et choisir la meilleure
 * 5. Logger les décisions pour l'audit
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { agentDecisions } from "../../drizzle/schema";
import { randomUUID } from "crypto";

export interface DecisionContext {
  taskId: string;
  userId: number;
  currentObjective: string;
  previousAttempts: Array<{
    action: string;
    error: string;
    timestamp: number;
  }>;
  availableTools: string[];
  constraints?: string[];
}

export interface Decision {
  option: string;
  reasoning: string;
  pros: string[];
  cons: string[];
  score: number;
}

export class ReasoningLoop {
  /**
   * Analyse une erreur et génère une correction automatique
   */
  static async analyzeErrorAndCorrect(
    code: string,
    error: string,
    language: string
  ): Promise<{
    correctedCode: string;
    explanation: string;
    confidence: number;
  }> {
    const prompt = `Tu es un expert en debugging et correction de code.

LANGAGE: ${language}
CODE ORIGINAL:
\`\`\`${language}
${code}
\`\`\`

ERREUR:
${error}

Analyse l'erreur et génère le code corrigé. 
Réponds en JSON avec {correctedCode, explanation, confidence (0-1)}

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Tu es un expert en correction de code ${language}. Tu analyses les erreurs et génères des corrections précises.`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === "string") {
        try {
          const parsed = JSON.parse(messageContent);
          return {
            correctedCode: parsed.correctedCode || code,
            explanation: parsed.explanation || "Correction appliquée",
            confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7))
          };
        } catch {
          return {
            correctedCode: code,
            explanation: "Impossible de corriger automatiquement",
            confidence: 0
          };
        }
      }
    } catch (error) {
      console.error("[ReasoningLoop] Erreur lors de l'analyse:", error);
    }

    return {
      correctedCode: code,
      explanation: "Erreur lors de l'analyse",
      confidence: 0
    };
  }

  /**
   * Prend une décision autonome basée sur le contexte
   */
  static async makeDecision(context: DecisionContext): Promise<Decision> {
    const prompt = `Tu es un agent autonome expert en prise de décision.

OBJECTIF ACTUEL: ${context.currentObjective}

TENTATIVES PRÉCÉDENTES:
${context.previousAttempts
  .map(
    (a, i) =>
      `${i + 1}. Action: ${a.action}\n   Erreur: ${a.error}\n   Temps: ${new Date(a.timestamp).toISOString()}`
  )
  .join("\n")}

OUTILS DISPONIBLES: ${context.availableTools.join(", ")}

${context.constraints ? `CONTRAINTES: ${context.constraints.join(", ")}` : ""}

Analyse la situation et propose la meilleure action à prendre ensuite.
Considère les tentatives précédentes et propose une approche différente.

Réponds en JSON avec:
{
  option: "action à prendre",
  reasoning: "pourquoi cette action",
  pros: ["avantage1", "avantage2"],
  cons: ["inconvénient1"],
  score: 0.0-1.0
}

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Tu es un agent autonome expert en prise de décision. Tu analyses les situations complexes et proposes les meilleures actions."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === "string") {
        try {
          const parsed = JSON.parse(messageContent);
          return {
            option: parsed.option || "Aucune option",
            reasoning: parsed.reasoning || "",
            pros: parsed.pros || [],
            cons: parsed.cons || [],
            score: Math.min(1, Math.max(0, parsed.score || 0.5))
          };
        } catch {
          // Fallback
        }
      }
    } catch (error) {
      console.error("[ReasoningLoop] Erreur lors de la prise de décision:", error);
    }

    // Fallback
    return {
      option: context.availableTools[0] || "retry",
      reasoning: "Fallback decision",
      pros: ["Simple"],
      cons: ["Peut ne pas résoudre le problème"],
      score: 0.3
    };
  }

  /**
   * Évalue plusieurs options et choisit la meilleure
   */
  static async evaluateOptions(
    options: string[],
    context: DecisionContext
  ): Promise<{
    selectedOption: string;
    decisions: Decision[];
    reasoning: string;
  }> {
    const prompt = `Tu es un expert en évaluation de stratégies.

OBJECTIF: ${context.currentObjective}

OPTIONS À ÉVALUER:
${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}

CONTEXTE:
- Tentatives précédentes: ${context.previousAttempts.length}
- Outils disponibles: ${context.availableTools.join(", ")}

Évalue chaque option et recommande la meilleure.

Réponds en JSON avec:
{
  selectedOption: "l'option recommandée",
  reasoning: "pourquoi celle-ci",
  scores: [
    {option: "option1", score: 0.0-1.0, reasoning: "..."},
    ...
  ]
}

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Tu es un expert en évaluation stratégique. Tu compares les options et recommandes la meilleure."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === "string") {
        try {
          const parsed = JSON.parse(messageContent);

          const decisions: Decision[] = (parsed.scores || []).map((s: any) => ({
            option: s.option,
            reasoning: s.reasoning || "",
            pros: [],
            cons: [],
            score: Math.min(1, Math.max(0, s.score || 0.5))
          }));

          return {
            selectedOption: parsed.selectedOption || options[0],
            decisions,
            reasoning: parsed.reasoning || ""
          };
        } catch {
          // Fallback
        }
      }
    } catch (error) {
      console.error("[ReasoningLoop] Erreur lors de l'évaluation:", error);
    }

    // Fallback
    return {
      selectedOption: options[0],
      decisions: options.map((o) => ({
        option: o,
        reasoning: "Évaluation non disponible",
        pros: [],
        cons: [],
        score: 0.5
      })),
      reasoning: "Fallback evaluation"
    };
  }

  /**
   * Sauvegarde une décision dans la base de données
   */
  static async logDecision(
    decision: Decision,
    context: DecisionContext,
    outcome?: "success" | "partial" | "failed"
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(agentDecisions).values({
        id: randomUUID(),
        taskId: context.taskId,
        userId: context.userId,
        decision: decision.option,
        reasoning: decision.reasoning,
        options: [decision],
        selectedOption: decision.option,
        outcome: outcome || "unknown",
        llmModel: "gpt-4",
        llmTokensUsed: 0,
        createdAt: new Date()
      });

      console.log(`[ReasoningLoop] Décision enregistrée: ${decision.option}`);
    } catch (error) {
      console.error("[ReasoningLoop] Erreur lors de l'enregistrement:", error);
    }
  }

  /**
   * Génère un plan d'action basé sur l'objectif
   */
  static async generateActionPlan(
    objective: string,
    context: DecisionContext
  ): Promise<{
    steps: Array<{
      step: number;
      action: string;
      expectedOutcome: string;
      fallback: string;
    }>;
    estimatedDuration: number;
  }> {
    const prompt = `Tu es un expert en planification stratégique.

OBJECTIF: ${objective}

OUTILS DISPONIBLES: ${context.availableTools.join(", ")}

Génère un plan d'action détaillé avec étapes claires et mesurables.

Réponds en JSON avec:
{
  steps: [
    {step: 1, action: "...", expectedOutcome: "...", fallback: "..."},
    ...
  ],
  estimatedDuration: 300
}

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Tu es un expert en planification. Tu génères des plans d'action clairs et réalisables."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const messageContent = response.choices[0]?.message?.content;
      if (typeof messageContent === "string") {
        try {
          const parsed = JSON.parse(messageContent);
          return {
            steps: parsed.steps || [],
            estimatedDuration: parsed.estimatedDuration || 300
          };
        } catch {
          // Fallback
        }
      }
    } catch (error) {
      console.error("[ReasoningLoop] Erreur lors de la génération du plan:", error);
    }

    // Fallback
    return {
      steps: [
        {
          step: 1,
          action: objective,
          expectedOutcome: "Objectif atteint",
          fallback: "Retry"
        }
      ],
      estimatedDuration: 300
    };
  }
}
