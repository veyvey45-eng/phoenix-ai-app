/**
 * Modules 13-16: Productivité
 * - Module 13: ContentGenerator
 * - Module 14: DocumentAnalyzer
 * - Module 15: SpecialistAgents
 * - Module 16: IdeaGenerator
 */

import { invokeLLM } from '../_core/llm';

// ============================================================================
// Module 13: ContentGenerator
// ============================================================================

export interface ContentTemplate {
  type: 'email' | 'article' | 'post' | 'presentation' | 'report';
  style: 'professionnel' | 'casual' | 'academique' | 'marketing';
  tone: 'formel' | 'amical' | 'persuasif' | 'informatif';
}

export class ContentGenerator {
  async generateContent(
    topic: string,
    template: ContentTemplate,
    params?: Record<string, any>
  ): Promise<string> {
    const prompts: Record<ContentTemplate['type'], string> = {
      email: `Génère un email professionnel sur le sujet: ${topic}. Style: ${template.style}. Ton: ${template.tone}`,
      article: `Écris un article complet sur: ${topic}. Style: ${template.style}. Longueur: 500 mots`,
      post: `Crée un post réseaux sociaux sur: ${topic}. Style: ${template.style}. Ton: ${template.tone}`,
      presentation: `Prépare un plan de présentation sur: ${topic}. Format: 5 slides principales`,
      report: `Génère un rapport technique sur: ${topic}. Style: ${template.style}. Sections: Introduction, Analyse, Conclusion`,
    };

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en création de contenu. ${prompts[template.type]}`,
        },
        {
          role: 'user',
          content: `Paramètres additionnels: ${JSON.stringify(params || {})}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  async generateMultipleVariants(
    topic: string,
    template: ContentTemplate,
    count: number = 3
  ): Promise<string[]> {
    const variants: string[] = [];

    for (let i = 0; i < count; i++) {
      const variant = await this.generateContent(topic, template, { variant: i + 1 });
      variants.push(variant);
    }

    return variants;
  }
}

// ============================================================================
// Module 14: DocumentAnalyzer
// ============================================================================

export interface DocumentAnalysisResult {
  summary: string;
  keyPoints: string[];
  sentiment: 'positif' | 'négatif' | 'neutre';
  topics: string[];
  wordCount: number;
  readingTime: number;
}

export class DocumentAnalyzer {
  async analyzeDocument(
    content: string,
    language: string = 'fr'
  ): Promise<DocumentAnalysisResult> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse de documents. Analyse le document suivant et fournis un résumé, les points clés, le sentiment et les sujets principaux.`,
        },
        {
          role: 'user',
          content: `Document:\n${content}`,
        },
      ],
    });

    const analysisText = response.choices?.[0]?.message?.content;
    const text = typeof analysisText === 'string' ? analysisText : JSON.stringify(analysisText);

    return {
      summary: text.substring(0, 200),
      keyPoints: text.split('\n').filter(l => l.trim().length > 0).slice(0, 5),
      sentiment: this.detectSentiment(text),
      topics: this.extractTopics(text),
      wordCount: content.split(/\s+/).length,
      readingTime: Math.ceil(content.split(/\s+/).length / 200),
    };
  }

  private detectSentiment(text: string): 'positif' | 'négatif' | 'neutre' {
    const positiveWords = ['bien', 'excellent', 'super', 'génial', 'merveilleux'];
    const negativeWords = ['mal', 'horrible', 'terrible', 'mauvais', 'nul'];

    const positiveCount = positiveWords.filter(w => text.toLowerCase().includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.toLowerCase().includes(w)).length;

    if (positiveCount > negativeCount) return 'positif';
    if (negativeCount > positiveCount) return 'négatif';
    return 'neutre';
  }

  private extractTopics(text: string): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 5);
    const uniqueWords = Array.from(new Set(words));
    return uniqueWords.slice(0, 5);
  }
}

// ============================================================================
// Module 15: SpecialistAgents
// ============================================================================

export type SpecialistType = 'copywriting' | 'code' | 'seo' | 'ux' | 'design';

export interface SpecialistResult {
  type: SpecialistType;
  output: string;
  recommendations: string[];
  score: number;
}

export class SpecialistAgents {
  private specialists: Record<SpecialistType, string> = {
    copywriting: 'Tu es un expert en copywriting. Crée du contenu persuasif et engageant.',
    code: 'Tu es un expert en programmation. Génère du code propre et optimisé.',
    seo: 'Tu es un expert SEO. Optimise le contenu pour les moteurs de recherche.',
    ux: 'Tu es un expert UX. Crée des expériences utilisateur exceptionnelles.',
    design: 'Tu es un expert en design. Crée des designs modernes et attrayants.',
  };

  async executeSpecialist(
    type: SpecialistType,
    request: string
  ): Promise<SpecialistResult> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: this.specialists[type],
        },
        {
          role: 'user',
          content: request,
        },
      ],
    });

    const output = response.choices?.[0]?.message?.content;
    const outputText = typeof output === 'string' ? output : JSON.stringify(output);

    return {
      type,
      output: outputText,
      recommendations: this.generateRecommendations(type, outputText),
      score: this.calculateScore(type, outputText),
    };
  }

  private generateRecommendations(type: SpecialistType, output: string): string[] {
    const recommendations: Record<SpecialistType, string[]> = {
      copywriting: [
        'Ajouter un appel à l\'action plus fort',
        'Améliorer la structure des phrases',
        'Renforcer les bénéfices',
      ],
      code: [
        'Ajouter des commentaires',
        'Optimiser les performances',
        'Ajouter la gestion des erreurs',
      ],
      seo: [
        'Augmenter la densité de mots-clés',
        'Améliorer les méta-descriptions',
        'Ajouter des liens internes',
      ],
      ux: [
        'Simplifier la navigation',
        'Améliorer l\'accessibilité',
        'Optimiser pour mobile',
      ],
      design: [
        'Améliorer la hiérarchie visuelle',
        'Utiliser une palette de couleurs cohérente',
        'Ajouter plus d\'espaces blancs',
      ],
    };

    return recommendations[type];
  }

  private calculateScore(type: SpecialistType, output: string): number {
    const baseScore = Math.min(1, output.length / 1000);
    return Math.round(baseScore * 100) / 100;
  }
}

// ============================================================================
// Module 16: IdeaGenerator
// ============================================================================

export interface Idea {
  id: string;
  title: string;
  description: string;
  score: number;
  category: string;
  feasibility: number;
  impact: number;
}

export class IdeaGenerator {
  async generateIdeas(topic: string, count: number = 10): Promise<Idea[]> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en brainstorming. Génère ${count} idées créatives et innovantes sur le sujet suivant.`,
        },
        {
          role: 'user',
          content: `Sujet: ${topic}`,
        },
      ],
    });

    const responseText = response.choices?.[0]?.message?.content;
    const text = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

    const ideas: Idea[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < Math.min(count, lines.length); i++) {
      ideas.push({
        id: `idea-${Date.now()}-${i}`,
        title: `Idée ${i + 1}`,
        description: lines[i] || 'Description non disponible',
        score: Math.random(),
        category: topic,
        feasibility: Math.floor(Math.random() * 10),
        impact: Math.floor(Math.random() * 10),
      });
    }

    return ideas.sort((a, b) => (b.score + b.feasibility + b.impact) - (a.score + a.feasibility + a.impact));
  }

  async filterIdeas(ideas: Idea[], minScore: number = 0.5): Promise<Idea[]> {
    return ideas.filter(idea => {
      const combinedScore = (idea.score + idea.feasibility / 10 + idea.impact / 10) / 3;
      return combinedScore >= minScore;
    });
  }

  async rankIdeas(ideas: Idea[]): Promise<Idea[]> {
    return ideas.sort((a, b) => {
      const scoreA = (a.score + a.feasibility / 10 + a.impact / 10) / 3;
      const scoreB = (b.score + b.feasibility / 10 + b.impact / 10) / 3;
      return scoreB - scoreA;
    });
  }
}

// ============================================================================
// Exports
// ============================================================================

export const contentGenerator = new ContentGenerator();
export const documentAnalyzer = new DocumentAnalyzer();
export const specialistAgents = new SpecialistAgents();
export const ideaGenerator = new IdeaGenerator();
