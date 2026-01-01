/**
 * Phoenix Embeddings Service
 * 
 * Génère des embeddings sémantiques pour la mémoire vectorielle.
 * Utilise l'API LLM intégrée pour créer des représentations vectorielles
 * du texte, permettant une recherche sémantique précise.
 */

import { invokeLLM } from '../_core/llm';
import crypto from 'crypto';

const EMBEDDING_DIMENSION = 1536;

/**
 * Génère un embedding sémantique via l'API LLM
 * Utilise une approche de "semantic hashing" où le LLM génère
 * une représentation textuelle qui est ensuite convertie en vecteur
 */
export async function generateSemanticEmbedding(text: string): Promise<number[]> {
  try {
    // Demander au LLM de générer une représentation sémantique structurée
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un système d'extraction sémantique. Pour chaque texte, extrais les concepts clés, 
          les entités, les relations, et le sentiment. Réponds en JSON avec cette structure exacte:
          {
            "concepts": ["concept1", "concept2", ...],
            "entities": ["entité1", "entité2", ...],
            "actions": ["action1", "action2", ...],
            "sentiment": "positif|négatif|neutre",
            "domain": "domaine principal",
            "keywords": ["mot1", "mot2", ...]
          }`
        },
        {
          role: 'user',
          content: text
        }
      ],
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'semantic_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              concepts: { type: 'array', items: { type: 'string' } },
              entities: { type: 'array', items: { type: 'string' } },
              actions: { type: 'array', items: { type: 'string' } },
              sentiment: { type: 'string', enum: ['positif', 'négatif', 'neutre'] },
              domain: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } }
            },
            required: ['concepts', 'entities', 'actions', 'sentiment', 'domain', 'keywords'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid LLM response');
    }

    const semanticData = JSON.parse(content);
    
    // Convertir l'extraction sémantique en vecteur
    return semanticToVector(semanticData, text);
  } catch (error) {
    console.warn('[Embeddings] LLM embedding failed, using fallback:', error);
    // Fallback vers l'embedding hash-based
    return generateHashEmbedding(text);
  }
}

/**
 * Convertit une extraction sémantique en vecteur numérique
 */
function semanticToVector(
  semanticData: {
    concepts: string[];
    entities: string[];
    actions: string[];
    sentiment: string;
    domain: string;
    keywords: string[];
  },
  originalText: string
): number[] {
  const embedding: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
  
  // Zone 1 (0-255): Concepts
  semanticData.concepts.forEach((concept, i) => {
    const hash = crypto.createHash('sha256').update(concept.toLowerCase()).digest();
    for (let j = 0; j < 32 && i * 32 + j < 256; j++) {
      embedding[i * 32 + j] = (hash[j] - 128) / 128;
    }
  });

  // Zone 2 (256-511): Entités
  semanticData.entities.forEach((entity, i) => {
    const hash = crypto.createHash('sha256').update(entity.toLowerCase()).digest();
    for (let j = 0; j < 32 && 256 + i * 32 + j < 512; j++) {
      embedding[256 + i * 32 + j] = (hash[j] - 128) / 128;
    }
  });

  // Zone 3 (512-767): Actions
  semanticData.actions.forEach((action, i) => {
    const hash = crypto.createHash('sha256').update(action.toLowerCase()).digest();
    for (let j = 0; j < 32 && 512 + i * 32 + j < 768; j++) {
      embedding[512 + i * 32 + j] = (hash[j] - 128) / 128;
    }
  });

  // Zone 4 (768-1023): Keywords
  semanticData.keywords.forEach((keyword, i) => {
    const hash = crypto.createHash('sha256').update(keyword.toLowerCase()).digest();
    for (let j = 0; j < 32 && 768 + i * 32 + j < 1024; j++) {
      embedding[768 + i * 32 + j] = (hash[j] - 128) / 128;
    }
  });

  // Zone 5 (1024-1279): Domain + Sentiment
  const domainHash = crypto.createHash('sha256').update(semanticData.domain.toLowerCase()).digest();
  for (let j = 0; j < 128; j++) {
    embedding[1024 + j] = (domainHash[j % 32] - 128) / 128;
  }
  
  // Sentiment encoding
  const sentimentValue = semanticData.sentiment === 'positif' ? 1 : 
                         semanticData.sentiment === 'négatif' ? -1 : 0;
  for (let j = 1152; j < 1280; j++) {
    embedding[j] = sentimentValue * 0.5;
  }

  // Zone 6 (1280-1535): Original text n-grams
  const words = originalText.toLowerCase().split(/\s+/);
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      const hash = crypto.createHash('sha256').update(ngram).digest();
      for (let j = 0; j < 8; j++) {
        const idx = 1280 + ((hash[0] * 256 + hash[1] + j) % 256);
        embedding[idx] += (hash[j + 2] - 128) / 512;
      }
    }
  }

  // Normalisation L2
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Fallback: Génère un embedding basé sur hash (déterministe)
 */
export function generateHashEmbedding(text: string): number[] {
  const embedding: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  
  // Mots individuels
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash = crypto.createHash('sha256').update(word + i.toString()).digest();
    for (let j = 0; j < hash.length && j < EMBEDDING_DIMENSION; j++) {
      const idx = (i * 32 + j) % EMBEDDING_DIMENSION;
      embedding[idx] += (hash[j] - 128) / 128;
    }
  }

  // N-grams (2-3)
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      const hash = crypto.createHash('sha256').update(ngram).digest();
      for (let j = 0; j < hash.length; j++) {
        const idx = (hash[j] + j * 6) % EMBEDDING_DIMENSION;
        embedding[idx] += (hash[(j + 1) % hash.length] - 128) / 256;
      }
    }
  }

  // Normalisation L2
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Calcule la similarité cosinus entre deux vecteurs
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export default {
  generateSemanticEmbedding,
  generateHashEmbedding,
  cosineSimilarity
};
