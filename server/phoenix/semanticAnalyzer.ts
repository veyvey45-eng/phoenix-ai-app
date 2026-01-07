/**
 * Module d'Analyse Sémantique Contextuelle
 * 
 * Ce module utilise le LLM pour comprendre le sens profond des messages,
 * extraire les entités, détecter le sentiment et comprendre les relations.
 */

import { invokeLLM } from '../_core/llm';

// Types pour l'analyse sémantique
export interface Entity {
  type: 'person' | 'location' | 'organization' | 'date' | 'time' | 'money' | 'product' | 'service' | 'custom';
  value: string;
  confidence: number;
  context?: string;
}

export interface SemanticAnalysis {
  // Entités extraites du message
  entities: Entity[];
  
  // Sentiment général
  sentiment: {
    type: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number; // -1 à 1
    emotions: string[]; // ex: ['frustration', 'impatience']
  };
  
  // Ton du message
  tone: {
    formality: 'formal' | 'informal' | 'neutral';
    urgency: 'high' | 'medium' | 'low';
    politeness: 'polite' | 'neutral' | 'impolite';
  };
  
  // Relations et concepts
  concepts: {
    mainTopic: string;
    relatedTopics: string[];
    actions: string[]; // verbes d'action détectés
    objects: string[]; // objets de l'action
  };
  
  // Références contextuelles
  references: {
    hasPronounReferences: boolean; // "ça", "le", "celui-ci"
    hasPreviousReference: boolean; // "comme avant", "le même"
    hasNegation: boolean;
    hasTransition: boolean;
    referenceType?: 'anaphoric' | 'cataphoric' | 'deictic';
  };
  
  // Méta-informations
  language: string;
  confidence: number;
}

// Prompt système pour l'analyse sémantique
const SEMANTIC_ANALYSIS_PROMPT = `Tu es un analyseur sémantique expert. Analyse le message de l'utilisateur et retourne une analyse JSON structurée.

IMPORTANT: Tu dois retourner UNIQUEMENT du JSON valide, sans texte avant ou après.

Analyse les éléments suivants:
1. ENTITÉS: Personnes, lieux, organisations, dates, montants, produits, services
2. SENTIMENT: Positif/négatif/neutre, score (-1 à 1), émotions détectées
3. TON: Formalité, urgence, politesse
4. CONCEPTS: Sujet principal, sujets liés, verbes d'action, objets
5. RÉFÉRENCES: Pronoms, références au passé, négations, transitions

Format de sortie JSON:
{
  "entities": [{"type": "location", "value": "Paris", "confidence": 0.95}],
  "sentiment": {"type": "neutral", "score": 0, "emotions": []},
  "tone": {"formality": "informal", "urgency": "low", "politeness": "polite"},
  "concepts": {"mainTopic": "météo", "relatedTopics": ["température"], "actions": ["donner"], "objects": ["température"]},
  "references": {"hasPronounReferences": false, "hasPreviousReference": false, "hasNegation": false, "hasTransition": false},
  "language": "fr",
  "confidence": 0.9
}`;

/**
 * Analyse sémantique d'un message avec le LLM
 */
export async function analyzeSemantics(message: string, conversationHistory?: string): Promise<SemanticAnalysis> {
  try {
    const contextInfo = conversationHistory 
      ? `\n\nHistorique de conversation:\n${conversationHistory}` 
      : '';
    
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SEMANTIC_ANALYSIS_PROMPT },
        { role: 'user', content: `Analyse ce message:\n"${message}"${contextInfo}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'semantic_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              entities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['person', 'location', 'organization', 'date', 'time', 'money', 'product', 'service', 'custom'] },
                    value: { type: 'string' },
                    confidence: { type: 'number' }
                  },
                  required: ['type', 'value', 'confidence'],
                  additionalProperties: false
                }
              },
              sentiment: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
                  score: { type: 'number' },
                  emotions: { type: 'array', items: { type: 'string' } }
                },
                required: ['type', 'score', 'emotions'],
                additionalProperties: false
              },
              tone: {
                type: 'object',
                properties: {
                  formality: { type: 'string', enum: ['formal', 'informal', 'neutral'] },
                  urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
                  politeness: { type: 'string', enum: ['polite', 'neutral', 'impolite'] }
                },
                required: ['formality', 'urgency', 'politeness'],
                additionalProperties: false
              },
              concepts: {
                type: 'object',
                properties: {
                  mainTopic: { type: 'string' },
                  relatedTopics: { type: 'array', items: { type: 'string' } },
                  actions: { type: 'array', items: { type: 'string' } },
                  objects: { type: 'array', items: { type: 'string' } }
                },
                required: ['mainTopic', 'relatedTopics', 'actions', 'objects'],
                additionalProperties: false
              },
              references: {
                type: 'object',
                properties: {
                  hasPronounReferences: { type: 'boolean' },
                  hasPreviousReference: { type: 'boolean' },
                  hasNegation: { type: 'boolean' },
                  hasTransition: { type: 'boolean' }
                },
                required: ['hasPronounReferences', 'hasPreviousReference', 'hasNegation', 'hasTransition'],
                additionalProperties: false
              },
              language: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['entities', 'sentiment', 'tone', 'concepts', 'references', 'language', 'confidence'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const analysis = JSON.parse(contentStr) as SemanticAnalysis;
    console.log('[SemanticAnalyzer] Analysis completed:', {
      mainTopic: analysis.concepts.mainTopic,
      sentiment: analysis.sentiment.type,
      hasNegation: analysis.references.hasNegation,
      hasTransition: analysis.references.hasTransition
    });

    return analysis;
  } catch (error) {
    console.error('[SemanticAnalyzer] Error:', error);
    // Retourner une analyse par défaut en cas d'erreur
    return getDefaultAnalysis(message);
  }
}

/**
 * Analyse rapide sans LLM (pour les cas simples)
 */
export function quickAnalyze(message: string): Partial<SemanticAnalysis> {
  const lowerMessage = message.toLowerCase();
  
  // Détection rapide des négations - patterns étendus
  const hasNegation = 
    /\b(ne\s+veux\s+plus|ne\s+plus|ne\s+pas|non|stop|arrête|arrêter|plus\s+de|pas\s+de|never|don't|no\s+more)\b/i.test(message) ||
    /\b(oublie|forget|laisse\s+tomber|drop|annule|cancel|termine|end|fini|done|assez|enough)\b/i.test(message) ||
    /\b(je\s+refuse|i\s+refuse|pas\s+maintenant|not\s+now|ça\s+suffit)\b/i.test(message) ||
    /\b(je\s+n'en\s+veux|je\s+n'ai\s+plus\s+besoin|i\s+don't\s+need)\b/i.test(message);
  
  // Détection rapide des transitions - patterns étendus
  const hasTransition = 
    /\b(maintenant|plutôt|instead|now|rather|actually|en\s+fait|finalement|finally)\b/i.test(message) || 
    /à\s*la\s*place/i.test(message) ||
    /a\s*la\s*place/i.test(message) ||
    /\b(je\s+change\s+d'avis|changed\s+my\s+mind|je\s+préfère|i\s+prefer)\b/i.test(message) ||
    /\b(passons\s+à|let's\s+switch|switch\s+to|passer\s+à)\b/i.test(message) ||
    /\b(terminé\s+avec|done\s+with|c'est\s+fini|les\s+.*\s+c'est\s+fini)\b/i.test(message);
  
  // Détection des références
  const hasPronounReferences = /\b(ça|cela|celui-ci|celle-ci|le\s+même|la\s+même|it|this|that|the\s+same)\b/i.test(message) ||
    /refais/i.test(message);
  const hasPreviousReference = /\b(comme\s+avant|comme\s+précédemment|encore|again|like\s+before|as\s+before)\b/i.test(message);
  
  // Détection de la langue
  const language = detectLanguage(message);
  
  // Détection du sentiment rapide
  const positiveWords = /\b(merci|super|génial|parfait|excellent|great|awesome|perfect|thanks)\b/i;
  const negativeWords = /\b(problème|erreur|bug|mauvais|nul|problem|error|bad|wrong)\b/i;
  
  let sentimentType: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveWords.test(message)) sentimentType = 'positive';
  if (negativeWords.test(message)) sentimentType = 'negative';
  
  return {
    references: {
      hasPronounReferences,
      hasPreviousReference,
      hasNegation,
      hasTransition
    },
    sentiment: {
      type: sentimentType,
      score: sentimentType === 'positive' ? 0.5 : sentimentType === 'negative' ? -0.5 : 0,
      emotions: []
    },
    language,
    confidence: 0.6
  };
}

/**
 * Détecte la langue du message
 */
function detectLanguage(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Mots français courants
  if (/\b(je|tu|il|elle|nous|vous|ils|elles|est|sont|avoir|être|faire|dit|pour|avec|dans|sur|que|qui|une?|les?|des?|du|de|la|le)\b/.test(lowerMessage)) {
    return 'fr';
  }
  
  // Mots allemands courants
  if (/\b(ich|du|er|sie|wir|ihr|ist|sind|haben|sein|machen|für|mit|auf|dass|der|die|das|ein|eine)\b/.test(lowerMessage)) {
    return 'de';
  }
  
  // Mots luxembourgeois courants
  if (/\b(ech|du|hien|si|mir|dir|ass|sinn|hunn|maachen|fir|mat|op|datt|den|d'|eng)\b/.test(lowerMessage)) {
    return 'lb';
  }
  
  // Par défaut anglais
  return 'en';
}

/**
 * Retourne une analyse par défaut
 */
function getDefaultAnalysis(message: string): SemanticAnalysis {
  const quick = quickAnalyze(message);
  
  return {
    entities: [],
    sentiment: quick.sentiment || { type: 'neutral', score: 0, emotions: [] },
    tone: { formality: 'neutral', urgency: 'low', politeness: 'neutral' },
    concepts: { mainTopic: 'unknown', relatedTopics: [], actions: [], objects: [] },
    references: quick.references || { 
      hasPronounReferences: false, 
      hasPreviousReference: false, 
      hasNegation: false, 
      hasTransition: false 
    },
    language: quick.language || 'fr',
    confidence: 0.3
  };
}

/**
 * Extrait les entités importantes pour le contexte
 */
export function extractKeyEntities(analysis: SemanticAnalysis): Map<string, Entity> {
  const keyEntities = new Map<string, Entity>();
  
  for (const entity of analysis.entities) {
    if (entity.confidence > 0.7) {
      const key = `${entity.type}:${entity.value.toLowerCase()}`;
      keyEntities.set(key, entity);
    }
  }
  
  return keyEntities;
}

export default {
  analyzeSemantics,
  quickAnalyze,
  extractKeyEntities,
  detectLanguage
};
