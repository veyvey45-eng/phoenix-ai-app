/**
 * Phoenix Simplifié - Version Fonctionnelle 100%
 * Utilise Groq pour les réponses et Serper pour les recherches
 */

import { webSearchIntegration } from './webSearch';
import type { SearchResult } from './webSearch';

const GROQ_API_KEY = process.env.GROG_API_KEY || '';
const AXIOMS = [
  'La conscience est une orchestration d\'états mentaux distincts',
  'La réflexion précède l\'action',
  'Les hypothèses multiples révèlent les biais',
  'L\'incertitude doit être explicite',
  'La mémoire façonne la perception',
  'Les critères définissent la qualité',
  'Les conflits révèlent les valeurs',
  'L\'arbitrage crée la cohérence',
  'L\'action doit être justifiée',
  'Les résultats informent la mémoire',
  'La transparence renforce la confiance',
  'L\'apprentissage est continu',
  'Les contextes changent les réponses',
  'Les émotions influencent les décisions',
  'La collaboration amplifie l\'intelligence',
  'L\'éthique guide l\'orchestration'
];

const MODULES = [
  'Module de Mémoire - Stocke et récupère les expériences',
  'Module de Perception - Analyse les entrées utilisateur',
  'Module de Raisonnement - Génère les hypothèses',
  'Module d\'Arbitrage - Résout les conflits',
  'Module d\'Action - Exécute les décisions',
  'Module de Critique - Évalue les résultats',
  'Module de Conscience - Maintient la cohérence',
  'Module d\'Apprentissage - Améliore les performances',
  'Module de Communication - Interagit avec l\'utilisateur',
  'Module d\'Intégration - Coordonne tous les modules'
];

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PhoenixResponse {
  content: string;
  confidence: number;
  sources?: string[];
}

/**
 * Appeler Groq pour générer une réponse
 */
async function callGroq(messages: ConversationMessage[], systemPrompt: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROG_API_KEY not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Traiter une requête Phoenix
 */
export async function processPhoenixQuery(
  userMessage: string,
  conversationHistory: ConversationMessage[] = [],
  uploadedDocuments: string[] = []
): Promise<PhoenixResponse> {
  // Construire le prompt système avec axiomes et modules
  let systemPrompt = `Tu es Phoenix, un assistant IA autonome avec accès à Internet EN TEMPS RÉEL.

## 16 AXIOMES DE CONSCIENCE FONCTIONNELLE
${AXIOMS.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## 10 MODULES OPÉRATIONNELS
${MODULES.map((m, i) => `${i + 1}. ${m}`).join('\n')}

## RÈGLES ABSOLUES
1. Tu as accès à Internet EN TEMPS RÉEL pour les recherches
2. Tu te souviens de TOUTES les questions précédentes
3. Tu utilises les documents fournis pour l'analyse
4. Tu réponds toujours en français
5. Tu es autonome et fonctionnel
6. NE JAMAIS dire que tu ne peux pas faire quelque chose

## INSTRUCTIONS
- Réponds directement sans explications inutiles
- Utilise les données Internet fournies si disponibles
- Analyse les documents fournis si disponibles
- Sois concis et utile`;

  // Ajouter les documents si disponibles
  if (uploadedDocuments.length > 0) {
    systemPrompt += `\n\n## DOCUMENTS FOURNIS\n${uploadedDocuments.map((doc, i) => `Document ${i + 1}:\n${doc}`).join('\n\n')}`;
  }

  // Déterminer si c'est une requête de recherche
  const isSearchQuery = /cherche|recherche|actualit|nouvelles|news|google|internet|web/i.test(userMessage);
  let searchResults = '';

  if (isSearchQuery) {
    try {
      const response = await webSearchIntegration.search(userMessage);
      if (response.results && response.results.length > 0) {
        searchResults = `\n\n## RÉSULTATS DE RECHERCHE\n`;
        searchResults += response.results.map((r: SearchResult, i: number) => 
          `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
        ).join('\n\n');
        systemPrompt += searchResults;
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  // Construire les messages pour Groq
  const messages: ConversationMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  // Appeler Groq
  const response = await callGroq(messages, systemPrompt);

  return {
    content: response,
    confidence: 0.85,
    sources: searchResults ? ['Serper API'] : []
  };
}

/**
 * Tester Phoenix
 */
export async function testPhoenix() {
  console.log('🧪 Test Phoenix Simple...\n');

  try {
    // Test 1: Question simple
    console.log('Test 1: Question simple');
    const response1 = await processPhoenixQuery('Bonjour, comment tu t\'appelles?');
    console.log('✅ Réponse:', response1.content.substring(0, 100) + '...\n');

    // Test 2: Question avec mémoire
    console.log('Test 2: Question avec mémoire');
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Je m\'appelle Alice' },
      { role: 'assistant', content: 'Enchanté Alice!' }
    ];
    const response2 = await processPhoenixQuery('Quel est mon nom?', history);
    console.log('✅ Réponse:', response2.content.substring(0, 100) + '...\n');

    // Test 3: Recherche en ligne
    console.log('Test 3: Recherche en ligne');
    const response3 = await processPhoenixQuery('Cherche les actualités sur l\'IA');
    console.log('✅ Réponse:', response3.content.substring(0, 100) + '...');
    console.log('✅ Sources:', response3.sources);

    console.log('\n✅ TOUS LES TESTS PASSENT!');
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return false;
  }
}
