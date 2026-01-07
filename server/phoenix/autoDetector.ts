/**
 * Auto Detector Module
 * Détecte automatiquement quand Phoenix doit utiliser RealExecutor
 * Sans que l'utilisateur ait à utiliser des commandes natives
 * Système "Zero-Prompt" - Phoenix prend l'initiative
 * 
 * IMPORTANT: Ce module doit éviter les faux positifs pour les questions conversationnelles simples
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
 * Patterns pour détecter les demandes conversationnelles simples
 * Ces patterns EXCLUENT l'exécution automatique
 */
const CONVERSATIONAL_PATTERNS = [
  // Questions simples de conversation
  /^(?:salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/i,
  /^(?:ça va|comment vas-tu|comment tu vas|how are you)/i,
  
  // Demandes créatives textuelles (pas de recherche web nécessaire)
  /(?:raconte|raconter|dis|dire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|conte|poème|joke)/i,
  /(?:écris|écrire|rédige|rédiger)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:poème|histoire|texte|lettre|email|mail|article|essai)/i,
  /(?:fais|faire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|poème)/i,
  
  // Traductions (pas besoin de web)
  /(?:traduis|traduire|translate)[\s-]/i,
  
  // Résumés (pas besoin de web)
  /(?:résume|résumer|summarize)[\s-]/i,
  
  // Explications simples
  /(?:explique|expliquer|explain)[\s-]*(?:moi)?[\s-]*(?:ce|cette|cet|le|la|les)?/i,
  
  // Questions de culture générale basiques
  /^(?:combien|how much|how many)[\s-]*(?:font|fait|is|are|equals?)[\s-]*\d/i,
  /^\d+[\s]*[\+\-\*\/][\s]*\d+/,  // Calculs simples comme "2+2"
  
  // Questions oui/non
  /^(?:est-ce que|is it|are you|do you|can you|peux-tu|sais-tu)/i,
  
  // Demandes de définition simple (Phoenix peut répondre sans web)
  /^(?:c'est quoi|qu'est-ce que c'est|what is a|define)\s+(?:un|une|le|la|a|an|the)?\s*\w+\s*\?*$/i,
  
  // Questions sur les capacités de Phoenix
  /(?:que peux-tu|what can you|tu peux faire quoi|tu sais faire quoi)/i,
];

/**
 * Patterns pour détecter les demandes de CRÉATION de site web (pas de navigation)
 */
const WEBSITE_CREATION_PATTERNS = [
  /(?:crée|créer|fais|faire|génère|générer|construis|construire|développe|développer)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:site|page)\s+(?:web)?/i,
  /(?:site|page)\s+(?:web\s+)?(?:pour|d'|de|avec)/i,
];

/**
 * Patterns pour détecter les demandes d'exécution EXPLICITES
 */
const EXECUTION_PATTERNS = {
  code: {
    patterns: [
      // Demandes EXPLICITES d'exécution de code
      /(?:exécute|execute|run|lance)[\s-]+(?:ce|le|this|the)?[\s-]*(?:code|script|programme)/i,
      /(?:teste|tester|test)[\s-]+(?:ce|le|this|the)?[\s-]*(?:code|script)/i,
      // Code dans des blocs
      /```(?:python|javascript|js|typescript|ts|bash|shell)/i,
      // Demandes de calcul complexe
      /(?:calcule|calculer|calculate|compute)[\s-]+(?:la|le|les|the)?[\s-]*(?:somme|moyenne|total|résultat)/i,
    ],
    confidence: 0.8,
    // Patterns qui EXCLUENT l'exécution de code
    exclusions: [
      /(?:explique|explain|comment|how)[\s-]+(?:ce|le|this|the)?[\s-]*(?:code|script)/i,  // Explication de code, pas exécution
    ]
  },
  search: {
    patterns: [
      // Demandes EXPLICITES de recherche web
      /(?:recherche|cherche|search|find|look up)[\s-]+(?:sur|dans|on|in)?[\s-]*(?:internet|le web|google|the web)/i,
      /(?:trouve|trouver|find)[\s-]+(?:moi)?[\s-]+(?:des)?[\s-]*(?:informations?|infos?|articles?|news|actualités)/i,
      // Actualités explicites
      /(?:dernières|latest|récentes|recent)[\s-]+(?:nouvelles|news|actualités|informations)/i,
      // Questions nécessitant des données en temps réel (sauf météo et crypto qui sont gérés séparément)
      /(?:prix|price|cours|value)[\s-]+(?:actuel|current|aujourd'hui|today)/i,
    ],
    confidence: 0.7,
    // Patterns qui EXCLUENT la recherche
    exclusions: [
      ...CONVERSATIONAL_PATTERNS,
      /(?:c'est quoi|qu'est-ce que|what is|define)[\s-]+(?:un|une|le|la|a|an|the)?\s*\w+\s*\?*$/i,  // Définitions simples
    ]
  },
  browse: {
    patterns: [
      // Demandes EXPLICITES de navigation web
      /(?:va|aller|go)[\s-]+(?:sur|to)[\s-]+(?:le site|la page|the site|the page)/i,
      /(?:ouvre|ouvrir|open)[\s-]+(?:le site|la page|l'url|the site|the page|the url)/i,
      /(?:navigue|naviguer|navigate|browse)[\s-]+(?:vers|sur|to|on)/i,
      /(?:visite|visiter|visit)[\s-]+(?:le site|la page|the site|the page)/i,
      // URLs explicites avec intention de navigation
      /(?:va|aller|go|ouvre|open|visite|visit)[\s-]+(?:sur|to|on)?[\s-]*https?:\/\//i,
      // Extraction de données d'un site spécifique
      /(?:extrait|extraire|extract|scrape|récupère|récupérer|get)[\s-]+(?:les)?[\s-]*(?:données|data|informations?|infos?)[\s-]+(?:de|from|du|sur)/i,
    ],
    confidence: 0.75,
    // Patterns qui EXCLUENT la navigation
    exclusions: [
      ...WEBSITE_CREATION_PATTERNS,  // Création de site != navigation
      /(?:crée|créer|fais|faire|génère|générer)[\s-]/i,  // Création != navigation
    ]
  }
};

/**
 * Vérifie si le message est une demande conversationnelle simple
 */
function isConversationalRequest(message: string): boolean {
  return CONVERSATIONAL_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Vérifie si le message est une demande de création de site web
 */
function isWebsiteCreationRequest(message: string): boolean {
  return WEBSITE_CREATION_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Détecte automatiquement si Phoenix doit exécuter quelque chose
 * AMÉLIORÉ: Évite les faux positifs pour les questions conversationnelles
 */
export function autoDetectExecution(userMessage: string, phoenixResponse: string): DetectionResult {
  // PRIORITÉ 1: Vérifier si c'est une demande conversationnelle simple
  if (isConversationalRequest(userMessage)) {
    console.log('[AutoDetector] Conversational request detected, skipping execution');
    return {
      shouldExecute: false,
      executionType: 'none',
      confidence: 0,
      reason: 'Demande conversationnelle simple - pas besoin d\'exécution'
    };
  }

  // PRIORITÉ 2: Vérifier si c'est une demande de création de site (pas de navigation)
  if (isWebsiteCreationRequest(userMessage)) {
    console.log('[AutoDetector] Website creation request detected, not navigation');
    return {
      shouldExecute: false,
      executionType: 'none',
      confidence: 0,
      reason: 'Demande de création de site web - pas de navigation nécessaire'
    };
  }

  // Vérifier si Phoenix dit qu'il ne peut pas faire quelque chose
  const cannotDoPatterns = [
    /je ne peux pas|i cannot|i can't|je ne suis pas capable/i,
    /je n'ai pas accès|i don't have access|i cannot access/i,
    /je ne sais pas|i don't know|i'm not sure/i,
    /malheureusement|unfortunately|désolé|sorry/i,
    /simulation|simulated|hypothetical/i
  ];

  const phoenixSaysCannotDo = cannotDoPatterns.some(pattern => pattern.test(phoenixResponse));

  // Vérifier si le message contient une demande d'exécution EXPLICITE
  for (const [executionType, config] of Object.entries(EXECUTION_PATTERNS)) {
    // Vérifier d'abord les exclusions
    const isExcluded = config.exclusions?.some(pattern => pattern.test(userMessage));
    if (isExcluded) {
      console.log(`[AutoDetector] Message excluded from ${executionType} execution`);
      continue;
    }

    const matchCount = config.patterns.filter(pattern => pattern.test(userMessage)).length;
    const matchRatio = matchCount / config.patterns.length;

    // Exiger un match ratio plus élevé pour éviter les faux positifs
    if (matchRatio > 0.4) {
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

      // Sinon, vérifier si c'est une demande TRÈS claire (ratio > 0.6)
      if (matchRatio > 0.6) {
        return {
          shouldExecute: true,
          executionType: executionType as 'code' | 'search' | 'browse',
          confidence: config.confidence * matchRatio,
          reason: `Demande explicite d'${executionType} détectée`,
          suggestedAction: `Exécution ${executionType} automatique`
        };
      }
    }
  }

  return {
    shouldExecute: false,
    executionType: 'none',
    confidence: 0,
    reason: 'Aucune demande d\'exécution explicite détectée'
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
 * AMÉLIORÉ: Plus strict pour éviter les faux positifs
 */
export function shouldProactivelyExecute(userMessage: string): boolean {
  // D'abord vérifier si c'est une demande conversationnelle
  if (isConversationalRequest(userMessage)) {
    return false;
  }

  // Patterns qui nécessitent vraiment une exécution
  const proactivePatterns = [
    /(?:exécute|execute|run|lance)[\s-]+(?:ce|le|this|the)?[\s-]*(?:code|script)/i,
    /```(?:python|javascript|js)/i,  // Code dans un bloc
    /(?:recherche|search)[\s-]+(?:sur|dans|on|in)?[\s-]*(?:internet|le web|google)/i,
    /(?:navigue|navigate|browse|visite|visit)[\s-]+(?:vers|sur|to|on)?[\s-]*https?:\/\//i,
  ];

  return proactivePatterns.some(pattern => pattern.test(userMessage));
}

/**
 * Analyse le contexte pour décider si Phoenix doit prendre l'initiative
 * AMÉLIORÉ: Avec fallback en cas d'erreur LLM (rate limit)
 */
export async function analyzeProactiveAction(userMessage: string, conversationContext: string): Promise<{
  shouldTakeInitiative: boolean;
  suggestedAction: string;
  actionType: 'code' | 'search' | 'browse' | 'analyze' | 'none';
}> {
  // D'abord vérifier si c'est une demande conversationnelle simple
  if (isConversationalRequest(userMessage)) {
    console.log('[AutoDetector] Conversational request - no proactive action needed');
    return {
      shouldTakeInitiative: false,
      suggestedAction: '',
      actionType: 'none'
    };
  }

  // Vérifier si c'est une demande de création de site
  if (isWebsiteCreationRequest(userMessage)) {
    console.log('[AutoDetector] Website creation request - no proactive action needed');
    return {
      shouldTakeInitiative: false,
      suggestedAction: '',
      actionType: 'none'
    };
  }

  try {
    // Utiliser LLM pour analyser si Phoenix devrait prendre l'initiative
    const analysis = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es Phoenix, une IA autonome. Analyse si tu dois prendre l'initiative pour résoudre le problème de l'utilisateur.

IMPORTANT: Pour les demandes suivantes, réponds TOUJOURS avec shouldTakeInitiative: false:
- Questions conversationnelles simples (salut, ça va, etc.)
- Demandes créatives (blagues, poèmes, histoires, etc.)
- Traductions
- Résumés
- Explications
- Calculs simples (2+2, etc.)
- Questions de culture générale basiques

Réponds en JSON avec cette structure:
{
  "shouldTakeInitiative": boolean,
  "actionType": "code" | "search" | "browse" | "analyze" | "none",
  "suggestedAction": "description de l'action à prendre"
}

Prends l'initiative UNIQUEMENT si:
- L'utilisateur demande EXPLICITEMENT d'exécuter du code
- L'utilisateur demande EXPLICITEMENT une recherche web
- L'utilisateur demande EXPLICITEMENT de naviguer sur un site`
        },
        {
          role: 'user',
          content: `Message utilisateur:\n${userMessage}`
        }
      ]
    });

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
  } catch (error: any) {
    // FALLBACK: En cas d'erreur LLM (rate limit, etc.), ne pas prendre d'initiative
    console.error('[AutoDetector] LLM error, falling back to no action:', error.message);
    return {
      shouldTakeInitiative: false,
      suggestedAction: '',
      actionType: 'none'
    };
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
