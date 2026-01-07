/**
 * Meta-Cognition Module - Réflexion sur la Qualité des Réponses
 * 
 * Ce module permet à Phoenix de réfléchir sur ses propres réponses
 * et de les améliorer avant de les livrer, comme Manus AI.
 * 
 * Fonctionnalités:
 * 1. Évaluation de la qualité des réponses
 * 2. Détection des erreurs potentielles
 * 3. Auto-amélioration des réponses
 * 4. Validation avant livraison
 */

import { invokeLLM } from '../_core/llm';

// Types pour la méta-cognition
export interface QualityAssessment {
  id: string;
  responseId: string;
  scores: {
    relevance: number;      // Pertinence par rapport à la demande
    completeness: number;   // Complétude de la réponse
    accuracy: number;       // Exactitude des informations
    clarity: number;        // Clarté de l'expression
    helpfulness: number;    // Utilité pour l'utilisateur
  };
  overallScore: number;
  issues: QualityIssue[];
  suggestions: string[];
  timestamp: number;
}

export interface QualityIssue {
  type: 'missing_info' | 'unclear' | 'incorrect' | 'incomplete' | 'off_topic' | 'too_verbose' | 'too_brief';
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
  suggestion?: string;
}

export interface SelfReflection {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface ImprovementResult {
  originalResponse: string;
  improvedResponse: string;
  changes: string[];
  qualityImprovement: number;
}

// Seuils de qualité
const QUALITY_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.75,
  ACCEPTABLE: 0.6,
  NEEDS_IMPROVEMENT: 0.4,
  POOR: 0.2
};

/**
 * Classe principale de méta-cognition
 */
export class MetaCognition {
  private assessmentHistory: QualityAssessment[] = [];
  private reflectionHistory: SelfReflection[] = [];

  constructor() {
    this.assessmentHistory = [];
    this.reflectionHistory = [];
  }

  /**
   * Évalue la qualité d'une réponse
   */
  async assessQuality(
    response: string,
    originalRequest: string,
    context?: string[]
  ): Promise<QualityAssessment> {
    console.log('[MetaCognition] Assessing response quality');

    const prompt = `Évalue la qualité de cette réponse:

Demande originale: "${originalRequest}"
Réponse: "${response.substring(0, 2000)}"
${context ? `Contexte: ${context.slice(-3).join(' | ')}` : ''}

Évalue sur une échelle de 0 à 1:
1. Pertinence: La réponse répond-elle à la demande?
2. Complétude: La réponse couvre-t-elle tous les aspects?
3. Exactitude: Les informations sont-elles correctes?
4. Clarté: La réponse est-elle claire et bien structurée?
5. Utilité: La réponse aide-t-elle vraiment l'utilisateur?

Identifie aussi les problèmes et suggestions d'amélioration.

Réponds en JSON:
{
  "scores": {
    "relevance": 0.0-1.0,
    "completeness": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "clarity": 0.0-1.0,
    "helpfulness": 0.0-1.0
  },
  "issues": [
    {
      "type": "missing_info|unclear|incorrect|incomplete|off_topic|too_verbose|too_brief",
      "description": "...",
      "severity": "low|medium|high",
      "suggestion": "..."
    }
  ],
  "suggestions": ["..."]
}`;

    try {
      const response_llm = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu évalues la qualité des réponses de manière objective et constructive.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response_llm.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const scores = result.scores || {
          relevance: 0.7,
          completeness: 0.7,
          accuracy: 0.7,
          clarity: 0.7,
          helpfulness: 0.7
        };

        const overallScore = (
          scores.relevance * 0.25 +
          scores.completeness * 0.2 +
          scores.accuracy * 0.25 +
          scores.clarity * 0.15 +
          scores.helpfulness * 0.15
        );

        const assessment: QualityAssessment = {
          id: `assess_${Date.now()}`,
          responseId: `resp_${Date.now()}`,
          scores,
          overallScore,
          issues: result.issues || [],
          suggestions: result.suggestions || [],
          timestamp: Date.now()
        };

        this.assessmentHistory.push(assessment);
        return assessment;
      }
    } catch (error) {
      console.error('[MetaCognition] Error assessing quality:', error);
    }

    // Évaluation par défaut
    return {
      id: `assess_${Date.now()}`,
      responseId: `resp_${Date.now()}`,
      scores: {
        relevance: 0.7,
        completeness: 0.7,
        accuracy: 0.7,
        clarity: 0.7,
        helpfulness: 0.7
      },
      overallScore: 0.7,
      issues: [],
      suggestions: [],
      timestamp: Date.now()
    };
  }

  /**
   * Améliore une réponse basée sur l'évaluation
   */
  async improveResponse(
    response: string,
    assessment: QualityAssessment,
    originalRequest: string
  ): Promise<ImprovementResult> {
    console.log('[MetaCognition] Improving response based on assessment');

    // Si la qualité est déjà excellente, pas besoin d'améliorer
    if (assessment.overallScore >= QUALITY_THRESHOLDS.EXCELLENT) {
      return {
        originalResponse: response,
        improvedResponse: response,
        changes: [],
        qualityImprovement: 0
      };
    }

    const issuesText = assessment.issues
      .map(i => `- ${i.type}: ${i.description} (${i.severity})`)
      .join('\n');

    const prompt = `Améliore cette réponse en corrigeant les problèmes identifiés:

Demande originale: "${originalRequest}"
Réponse actuelle: "${response}"

Problèmes identifiés:
${issuesText}

Suggestions:
${assessment.suggestions.join('\n')}

Score actuel: ${(assessment.overallScore * 100).toFixed(0)}%

Génère une version améliorée qui:
1. Corrige tous les problèmes identifiés
2. Applique les suggestions
3. Maintient le ton et le style appropriés

Réponds en JSON:
{
  "improvedResponse": "...",
  "changes": ["changement 1", "changement 2"],
  "expectedImprovement": 0.0-1.0
}`;

    try {
      const response_llm = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu améliores les réponses de manière constructive.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response_llm.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        return {
          originalResponse: response,
          improvedResponse: result.improvedResponse || response,
          changes: result.changes || [],
          qualityImprovement: result.expectedImprovement || 0.1
        };
      }
    } catch (error) {
      console.error('[MetaCognition] Error improving response:', error);
    }

    return {
      originalResponse: response,
      improvedResponse: response,
      changes: [],
      qualityImprovement: 0
    };
  }

  /**
   * Effectue une auto-réflexion sur une question
   */
  async selfReflect(question: string): Promise<SelfReflection> {
    console.log('[MetaCognition] Self-reflecting on:', question);

    const prompt = `Réfléchis à cette question sur ta propre performance:

Question: "${question}"

Analyse honnêtement:
1. Ta réponse à cette question
2. Ta confiance dans cette réponse
3. Le raisonnement derrière ta réponse

Réponds en JSON:
{
  "answer": "...",
  "confidence": 0.0-1.0,
  "reasoning": "..."
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Tu pratiques l\'auto-réflexion honnête et constructive.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const result = JSON.parse(content);

        const reflection: SelfReflection = {
          id: `reflect_${Date.now()}`,
          question,
          answer: result.answer || 'Réflexion non disponible',
          confidence: result.confidence || 0.5,
          reasoning: result.reasoning || '',
          timestamp: Date.now()
        };

        this.reflectionHistory.push(reflection);
        return reflection;
      }
    } catch (error) {
      console.error('[MetaCognition] Error in self-reflection:', error);
    }

    return {
      id: `reflect_${Date.now()}`,
      question,
      answer: 'Réflexion non disponible',
      confidence: 0.5,
      reasoning: '',
      timestamp: Date.now()
    };
  }

  /**
   * Vérifie si une réponse est prête à être livrée
   */
  async isReadyToDeliver(
    response: string,
    originalRequest: string
  ): Promise<{ ready: boolean; reason: string; assessment: QualityAssessment }> {
    const assessment = await this.assessQuality(response, originalRequest);

    if (assessment.overallScore >= QUALITY_THRESHOLDS.GOOD) {
      return {
        ready: true,
        reason: 'Qualité suffisante pour livraison',
        assessment
      };
    }

    if (assessment.overallScore >= QUALITY_THRESHOLDS.ACCEPTABLE) {
      // Vérifier s'il y a des problèmes critiques
      const criticalIssues = assessment.issues.filter(i => i.severity === 'high');
      if (criticalIssues.length === 0) {
        return {
          ready: true,
          reason: 'Qualité acceptable, pas de problèmes critiques',
          assessment
        };
      }
    }

    return {
      ready: false,
      reason: `Qualité insuffisante (${(assessment.overallScore * 100).toFixed(0)}%). Problèmes: ${assessment.issues.map(i => i.description).join(', ')}`,
      assessment
    };
  }

  /**
   * Génère un rapport de qualité
   */
  generateQualityReport(): string {
    if (this.assessmentHistory.length === 0) {
      return 'Aucune évaluation disponible.';
    }

    const avgScore = this.assessmentHistory.reduce((sum, a) => sum + a.overallScore, 0) / this.assessmentHistory.length;
    const recentAssessments = this.assessmentHistory.slice(-5);

    const report = `📊 **Rapport de Qualité**

**Score moyen:** ${(avgScore * 100).toFixed(1)}%

**Dernières évaluations:**
${recentAssessments.map(a => `- ${(a.overallScore * 100).toFixed(0)}% (${a.issues.length} problèmes)`).join('\n')}

**Problèmes fréquents:**
${this.getMostCommonIssues().join('\n')}
`;

    return report;
  }

  /**
   * Obtient les problèmes les plus fréquents
   */
  private getMostCommonIssues(): string[] {
    const issueCounts = new Map<string, number>();

    this.assessmentHistory.forEach(assessment => {
      assessment.issues.forEach(issue => {
        const count = issueCounts.get(issue.type) || 0;
        issueCounts.set(issue.type, count + 1);
      });
    });

    return Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `- ${type}: ${count} occurrences`);
  }

  /**
   * Questions de réflexion standards
   */
  async performStandardReflection(): Promise<SelfReflection[]> {
    const questions = [
      'Ma réponse répond-elle vraiment à ce que l\'utilisateur demande?',
      'Y a-t-il des informations importantes que j\'ai omises?',
      'Ma réponse est-elle claire et facile à comprendre?',
      'Ai-je fait des suppositions non vérifiées?',
      'Comment puis-je améliorer ma prochaine réponse?'
    ];

    const reflections: SelfReflection[] = [];

    for (const question of questions) {
      const reflection = await this.selfReflect(question);
      reflections.push(reflection);
    }

    return reflections;
  }

  /**
   * Obtient l'historique des évaluations
   */
  getAssessmentHistory(): QualityAssessment[] {
    return [...this.assessmentHistory];
  }

  /**
   * Obtient l'historique des réflexions
   */
  getReflectionHistory(): SelfReflection[] {
    return [...this.reflectionHistory];
  }

  /**
   * Réinitialise le module
   */
  reset(): void {
    this.assessmentHistory = [];
    this.reflectionHistory = [];
  }
}

// Instance singleton
let metaCognitionInstance: MetaCognition | null = null;

export function getMetaCognition(): MetaCognition {
  if (!metaCognitionInstance) {
    metaCognitionInstance = new MetaCognition();
  }
  return metaCognitionInstance;
}

export default MetaCognition;
