/**
 * Confirmation System - Système de confirmation pour les transitions
 * 
 * Ce module gère les demandes de confirmation lorsque Phoenix détecte
 * un changement significatif dans l'intention de l'utilisateur.
 */

import { IntentType } from './intentDetector';

export interface ConfirmationRequest {
  id: string;
  userId: string;
  previousIntent: IntentType;
  newIntent: IntentType;
  message: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  expiresAt: number;
}

export interface ConfirmationResult {
  needsConfirmation: boolean;
  confirmationMessage?: string;
  previousIntent?: IntentType;
  newIntent?: IntentType;
  confidence: number;
}

// Stockage en mémoire des confirmations en attente
const pendingConfirmations = new Map<string, ConfirmationRequest>();

// Durée de validité d'une confirmation (5 minutes)
const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000;

// Transitions qui nécessitent une confirmation
const SIGNIFICANT_TRANSITIONS: Array<{
  from: IntentType[];
  to: IntentType[];
  threshold: number;
}> = [
  // Changement de mode de création (site <-> app)
  { from: ['site_creation'], to: ['app_creation'], threshold: 0.7 },
  { from: ['app_creation'], to: ['site_creation'], threshold: 0.7 },
  // Changement de génération d'image vers création
  { from: ['image_generation'], to: ['site_creation', 'app_creation'], threshold: 0.6 },
  // Changement de code vers création
  { from: ['code_execution', 'code_request'], to: ['site_creation', 'app_creation'], threshold: 0.7 },
];

/**
 * Messages de confirmation par type de transition
 */
const CONFIRMATION_MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    'image_generation->site_creation': "J'ai compris que vous souhaitez maintenant créer un **site web** au lieu de générer des images. Est-ce correct ?",
    'image_generation->app_creation': "J'ai compris que vous souhaitez maintenant créer une **application** au lieu de générer des images. Est-ce correct ?",
    'site_creation->app_creation': "Vous souhaitez passer de la création de site web à la création d'**application**. Confirmez-vous ?",
    'app_creation->site_creation': "Vous souhaitez passer de la création d'application à la création de **site web**. Confirmez-vous ?",
    'code_execution->site_creation': "Vous souhaitez passer de l'exécution de code à la création de **site web**. Confirmez-vous ?",
    'code_execution->app_creation': "Vous souhaitez passer de l'exécution de code à la création d'**application**. Confirmez-vous ?",
    'default': "J'ai détecté un changement dans votre demande. Voulez-vous vraiment passer à cette nouvelle tâche ?",
  },
  en: {
    'image_generation->site_creation': "I understand you now want to create a **website** instead of generating images. Is that correct?",
    'image_generation->app_creation': "I understand you now want to create an **application** instead of generating images. Is that correct?",
    'site_creation->app_creation': "You want to switch from website creation to **application** creation. Do you confirm?",
    'app_creation->site_creation': "You want to switch from application creation to **website** creation. Do you confirm?",
    'code_execution->site_creation': "You want to switch from code execution to **website** creation. Do you confirm?",
    'code_execution->app_creation': "You want to switch from code execution to **application** creation. Do you confirm?",
    'default': "I detected a change in your request. Do you really want to switch to this new task?",
  }
};

/**
 * Détecte la langue du message
 */
function detectLanguage(message: string): 'fr' | 'en' {
  const frenchPatterns = /(?:je|tu|nous|vous|il|elle|crée|fais|veux|voudrais|s'il|merci|bonjour|salut)/i;
  return frenchPatterns.test(message) ? 'fr' : 'en';
}

/**
 * Vérifie si une transition nécessite une confirmation
 */
export function checkIfNeedsConfirmation(
  previousIntent: IntentType | undefined,
  newIntent: IntentType,
  confidence: number
): ConfirmationResult {
  // Pas de confirmation nécessaire si pas d'intention précédente
  if (!previousIntent) {
    return { needsConfirmation: false, confidence };
  }
  
  // Pas de confirmation si même intention
  if (previousIntent === newIntent) {
    return { needsConfirmation: false, confidence };
  }
  
  // Vérifier si c'est une transition significative
  for (const transition of SIGNIFICANT_TRANSITIONS) {
    if (
      transition.from.includes(previousIntent) &&
      transition.to.includes(newIntent) &&
      confidence >= transition.threshold
    ) {
      return {
        needsConfirmation: true,
        previousIntent,
        newIntent,
        confidence
      };
    }
  }
  
  return { needsConfirmation: false, confidence };
}

/**
 * Génère un message de confirmation
 */
export function generateConfirmationMessage(
  previousIntent: IntentType,
  newIntent: IntentType,
  userMessage: string
): string {
  const lang = detectLanguage(userMessage);
  const messages = CONFIRMATION_MESSAGES[lang] || CONFIRMATION_MESSAGES['fr'];
  
  const key = `${previousIntent}->${newIntent}`;
  return messages[key] || messages['default'];
}

/**
 * Crée une demande de confirmation
 */
export function createConfirmationRequest(
  userId: string,
  previousIntent: IntentType,
  newIntent: IntentType,
  message: string
): ConfirmationRequest {
  const id = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  const request: ConfirmationRequest = {
    id,
    userId,
    previousIntent,
    newIntent,
    message,
    timestamp: now,
    status: 'pending',
    expiresAt: now + CONFIRMATION_EXPIRY_MS
  };
  
  pendingConfirmations.set(id, request);
  
  // Nettoyer les confirmations expirées
  cleanupExpiredConfirmations();
  
  return request;
}

/**
 * Confirme une demande de confirmation
 */
export function confirmRequest(confirmationId: string): boolean {
  const request = pendingConfirmations.get(confirmationId);
  
  if (!request) {
    return false;
  }
  
  if (request.status !== 'pending') {
    return false;
  }
  
  if (Date.now() > request.expiresAt) {
    request.status = 'expired';
    return false;
  }
  
  request.status = 'confirmed';
  return true;
}

/**
 * Annule une demande de confirmation
 */
export function cancelRequest(confirmationId: string): boolean {
  const request = pendingConfirmations.get(confirmationId);
  
  if (!request) {
    return false;
  }
  
  if (request.status !== 'pending') {
    return false;
  }
  
  request.status = 'cancelled';
  return true;
}

/**
 * Récupère une demande de confirmation en attente pour un utilisateur
 */
export function getPendingConfirmation(userId: string): ConfirmationRequest | undefined {
  const requests = Array.from(pendingConfirmations.values());
  for (const request of requests) {
    if (
      request.userId === userId &&
      request.status === 'pending' &&
      Date.now() < request.expiresAt
    ) {
      return request;
    }
  }
  return undefined;
}

/**
 * Vérifie si un message est une réponse de confirmation
 */
export function isConfirmationResponse(message: string): 'yes' | 'no' | 'unknown' {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Réponses positives
  const positivePatterns = [
    /^(?:oui|yes|ok|okay|d'accord|correct|exactement|parfait|confirme|je confirme|c'est ça|that's right|exactly|confirm|sure|absolutely|yep|yeah)$/i,
    /^(?:oui|yes)\s*[,!.]?\s*(?:c'est|that's)?\s*(?:ça|correct|right)?$/i,
  ];
  
  // Réponses négatives
  const negativePatterns = [
    /^(?:non|no|pas|nope|annule|cancel|stop|arrête|pas du tout|not at all|never|jamais)$/i,
    /^(?:non|no)\s*[,!.]?\s*(?:ce n'est pas|that's not|pas ça|not that)?$/i,
  ];
  
  for (const pattern of positivePatterns) {
    if (pattern.test(normalizedMessage)) {
      return 'yes';
    }
  }
  
  for (const pattern of negativePatterns) {
    if (pattern.test(normalizedMessage)) {
      return 'no';
    }
  }
  
  return 'unknown';
}

/**
 * Nettoie les confirmations expirées
 */
function cleanupExpiredConfirmations(): void {
  const now = Date.now();
  const entries = Array.from(pendingConfirmations.entries());
  
  for (const [id, request] of entries) {
    if (now > request.expiresAt && request.status === 'pending') {
      request.status = 'expired';
    }
    
    // Supprimer les confirmations de plus de 30 minutes
    if (now - request.timestamp > 30 * 60 * 1000) {
      pendingConfirmations.delete(id);
    }
  }
}

/**
 * Génère une réponse formatée pour la confirmation
 */
export function formatConfirmationResponse(
  confirmationMessage: string,
  previousIntent: IntentType,
  newIntent: IntentType
): string {
  const intentNames: Record<IntentType, string> = {
    conversation: 'conversation',
    code_request: 'demande de code',
    code_execution: 'exécution de code',
    image_generation: 'génération d\'images',
    site_creation: 'création de site web',
    app_creation: 'création d\'application',
    site_modification: 'modification de site',
    web_browse: 'navigation web',
    web_search: 'recherche web',
    weather: 'météo',
    crypto: 'crypto',
    file_analysis: 'analyse de fichier',
    calculation: 'calcul'
  };
  
  return `🔄 **Changement détecté**

${confirmationMessage}

📍 Mode actuel: ${intentNames[previousIntent]}
🎯 Nouveau mode: ${intentNames[newIntent]}

Répondez **oui** pour confirmer ou **non** pour annuler.`;
}

export default {
  checkIfNeedsConfirmation,
  generateConfirmationMessage,
  createConfirmationRequest,
  confirmRequest,
  cancelRequest,
  getPendingConfirmation,
  isConfirmationResponse,
  formatConfirmationResponse
};
