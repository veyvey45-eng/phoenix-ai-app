/**
 * Auto Detector Module
 * Détecte automatiquement quand Phoenix doit utiliser RealExecutor
 * Sans que l'utilisateur ait à utiliser des commandes natives
 * Système "Zero-Prompt" - Phoenix prend l'initiative
 */

import { RealExecutor } from './realExecutor';
import { invokeLLM } from '../_core/llm';

export interface DetectionResult {
  shouldExecute: boolean;
  executionType: 'code' | 'search' | 'browse' | 'none';
  confidence: number;
  reason: string;
  suggestedAction?: string;
}

/**
 * Patterns pour détecter les demandes d'exécution
 */
const EXECUTION_PATTERNS = {
  code: {
    patterns: [
      /exécute|execute|run|lance|calcul|calcule|math|code|script|python|javascript|js/i,
      /affiche|print|montre|résultat|output|console/i,
      /créer une fonction|write a function|generate code/i,
      /quelle est|what is|combien|how much|calculate/i
    ],
    confidence: 0.8
  },
  search: {
    patterns: [
      /recherche|search|trouve|find|cherche|look for/i,
      /dernières nouvelles|latest news|actualités|trending/i,
      /quel est|what is|qui est|who is|où est|where is/i,
      /information|data|données|stats|statistics/i,
      /sur internet|online|web|google/i
    ],
    confidence: 0.7
  },
  browse: {
    patterns: [
      /navigue|navigate|browse|visite|visit|go to/i,
      /extrait|extract|scrape|récupère|get data/i,
      /https?:\/\/|www\.|\.com|\.fr|\.org/i,
      /site web|website|page|url/i,
      /clique|click|remplir|fill|soumettre|submit/i
    ],
    confidence: 0.75
  }
};

/**
 * Détecte automatiquement si Phoenix doit exécuter quelque chose
 */
export function autoDetectExecution(userMessage: string, phoenixResponse: string): DetectionResult {
  // Vérifier si Phoenix dit qu'il ne peut pas faire quelque chose
  const cannotDoPatterns = [
    /je ne peux pas|i cannot|i can't|je ne suis pas capable/i,
    /je n'ai pas accès|i don't have access|i cannot access/i,
    /je ne sais pas|i don't know|i'm not sure/i,
    /malheureusement|unfortunately|désolé|sorry/i,
    /simulation|simulated|hypothetical/i
  ];

  const phoenixSaysCannotDo = cannotDoPatterns.some(pattern => pattern.test(phoenixResponse));

  // Vérifier si le message contient une demande d'exécution
  for (const [executionType, config] of Object.entries(EXECUTION_PATTERNS)) {
    const matchCount = config.patterns.filter(pattern => pattern.test(userMessage)).length;
    const matchRatio = matchCount / config.patterns.length;

    if (matchRatio > 0.3) {
      // Si Phoenix dit qu'il ne peut pas faire quelque chose, on doit l'exécuter
      if (phoenixSaysCannotDo) {
        return {
          shouldExecute: true,
          executionType: executionType as 'code' | 'search' | 'browse',
          confidence: Math.min(1, config.confidence + 0.2),
          reason: `Phoenix dit qu'il ne peut pas faire cela. Je vais ${executionType === 'code' ? 'exécuter le code' : executionType === 'search' ? 'faire une recherche' : 'naviguer le web'} pour lui.`,
          suggestedAction: `Exécution ${executionType} détectée automatiquement`
        };
      }

      // Sinon, vérifier si c'est une demande claire
      if (matchRatio > 0.5) {
        return {
          shouldExecute: true,
          executionType: executionType as 'code' | 'search' | 'browse',
          confidence: config.confidence * matchRatio,
          reason: `Demande d'${executionType} détectée`,
          suggestedAction: `Exécution ${executionType} automatique`
        };
      }
    }
  }

  return {
    shouldExecute: false,
    executionType: 'none',
    confidence: 0,
    reason: 'Aucune demande d\'exécution détectée'
  };
}

/**
 * Extrait le contenu à exécuter du message utilisateur
 */
export function extractExecutionContent(userMessage: string, executionType: 'code' | 'search' | 'browse'): string {
  switch (executionType) {
    case 'code':
      // Chercher du code dans des blocs de code
      const codeBlockMatch = userMessage.match(/```(?:python|javascript|js)?\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        return codeBlockMatch[1];
      }

      // Sinon, utiliser le message entier
      return userMessage.replace(/^(exécute|execute|run|lance)\s+/i, '').trim();

    case 'search':
      // Extraire la requête de recherche
      return userMessage.replace(/^(recherche|search|trouve|find)\s+/i, '').trim();

    case 'browse':
      // Extraire l'URL et l'objectif
      const urlMatch = userMessage.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return userMessage;
      }
      return userMessage;

    default:
      return userMessage;
  }
}

/**
 * Génère une suggestion d'action pour Phoenix
 */
export function generateExecutionSuggestion(
  userMessage: string,
  phoenixResponse: string,
  detectionResult: DetectionResult
): string {
  if (!detectionResult.shouldExecute) {
    return '';
  }

  const executionType = detectionResult.executionType;
  if (executionType === 'none') return '';
  const content = extractExecutionContent(userMessage, executionType);

  switch (executionType) {
    case 'code':
      return `\n\n**💡 Je vais exécuter ce code pour toi:**\n\`\`\`python\n${content}\n\`\`\``;

    case 'search':
      return `\n\n**💡 Je vais faire une recherche web pour toi:**\n🔍 "${content}"`;

    case 'browse':
      return `\n\n**💡 Je vais naviguer et extraire les données pour toi:**\n🌐 ${content}`;

    default:
      return '';
  }
}

/**
 * Détermine si Phoenix doit proposer d'exécuter quelque chose
 * Retourne true si Phoenix devrait dire "Je vais exécuter cela pour toi"
 */
export function shouldProactivelyExecute(userMessage: string): boolean {
  const proactivePatterns = [
    /exécute|execute|run|lance|calcul|calcule/i,
    /affiche|print|montre|résultat/i,
    /créer une fonction|write a function/i,
    /recherche|search|trouve/i,
    /navigue|navigate|browse/i,
    /problème|problem|bug|erreur|error/i,
    /aide-moi|help me|peux-tu|can you/i
  ];

  return proactivePatterns.some(pattern => pattern.test(userMessage));
}

/**
 * Analyse le contexte pour décider si Phoenix doit prendre l'initiative
 * Retourne une suggestion d'action proactive
 */
export async function analyzeProactiveAction(userMessage: string, conversationContext: string): Promise<{
  shouldTakeInitiative: boolean;
  suggestedAction: string;
  actionType: 'code' | 'search' | 'browse' | 'analyze' | 'none';
}> {
  // Utiliser LLM pour analyser si Phoenix devrait prendre l'initiative
  const analysis = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `Tu es Phoenix, une IA autonome. Analyse si tu dois prendre l'initiative pour résoudre le problème de l'utilisateur.
        
Réponds en JSON avec cette structure:
{
  "shouldTakeInitiative": boolean,
  "actionType": "code" | "search" | "browse" | "analyze" | "none",
  "suggestedAction": "description de l'action à prendre"
}

Prends l'initiative si:
- L'utilisateur demande d'exécuter du code
- L'utilisateur pose une question qui nécessite une recherche
- L'utilisateur demande d'analyser quelque chose
- L'utilisateur a un problème que tu peux résoudre`
      },
      {
        role: 'user',
        content: `Contexte de conversation:\n${conversationContext}\n\nMessage utilisateur:\n${userMessage}`
      }
    ]
  });

  try {
    const content = analysis.choices[0]?.message?.content;
    const jsonStr = typeof content === 'string' ? content : '';
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldTakeInitiative: parsed.shouldTakeInitiative || false,
        suggestedAction: parsed.suggestedAction || '',
        actionType: parsed.actionType || 'none'
      };
    }
  } catch (error) {
    console.error('Erreur analyse proactive:', error);
  }

  return {
    shouldTakeInitiative: false,
    suggestedAction: '',
    actionType: 'none'
  };
}

/**
 * Crée un prompt pour Phoenix pour qu'il propose une action
 */
export function createProactivePrompt(actionType: 'code' | 'search' | 'browse' | 'analyze' | 'none', userMessage: string): string {
  switch (actionType) {
    case 'code':
      return `L'utilisateur demande d'exécuter du code. Je vais générer et exécuter le code approprié pour résoudre son problème. Je vais d'abord générer le code, puis l'exécuter, puis afficher les résultats.`;

    case 'search':
      return `L'utilisateur pose une question qui nécessite une recherche web. Je vais faire une recherche pour trouver les informations les plus récentes et pertinentes.`;

    case 'browse':
      return `L'utilisateur demande d'extraire des données d'un site web. Je vais naviguer sur le site et extraire les données demandées.`;

    case 'analyze':
      return `L'utilisateur demande une analyse. Je vais analyser le code ou les données fournis et donner une analyse détaillée.`;

    default:
      return '';
  }
}
