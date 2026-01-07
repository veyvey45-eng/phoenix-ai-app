/**
 * Context Manager - Gestion intelligente du contexte des conversations
 * 
 * Ce module permet de:
 * 1. Détecter les changements de sujet dans une conversation
 * 2. Réinitialiser le contexte quand nécessaire
 * 3. Éviter les confusions entre différentes demandes
 * 4. Extraire correctement les noms et paramètres des demandes
 */

// Types de demandes supportées
export type RequestType = 
  | 'conversation'      // Discussion simple
  | 'site_creation'     // Création de site web
  | 'site_modification' // Modification d'un site existant
  | 'image_generation'  // Génération d'image
  | 'code_execution'    // Exécution de code
  | 'web_search'        // Recherche web
  | 'weather'           // Météo
  | 'crypto'            // Prix crypto
  | 'calculation'       // Calcul mathématique
  | 'question'          // Question simple
  | 'unknown';          // Non déterminé

// Interface pour le contexte d'une conversation
export interface ConversationContext {
  conversationId: number;
  lastRequestType: RequestType;
  lastSiteName?: string;
  lastSiteSlug?: string;
  lastAction?: string;
  timestamp: number;
}

// Cache des contextes (en mémoire pour l'instant)
const contextCache = new Map<number, ConversationContext>();

/**
 * Détecte le type de demande à partir du message
 */
export function detectRequestType(message: string): RequestType {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patterns pour chaque type de demande
  const patterns: { type: RequestType; patterns: RegExp[] }[] = [
    {
      type: 'site_creation',
      patterns: [
        /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:site|page)/i,
        /(?:create|make|build|generate)\s+(?:me\s+)?(?:a\s+)?(?:website|site|page)/i,
        /(?:erstelle|mache|baue)\s+(?:mir\s+)?(?:eine?\s+)?(?:webseite|website|seite)/i,
        /(?:maach|bau)\s+(?:mir\s+)?(?:eng?\s+)?(?:websäit|site)/i,
      ]
    },
    {
      type: 'site_modification',
      patterns: [
        /(?:modifie|modifier|change|changer|ajoute|ajouter|mets|mettre|update|edit)\s+(?:le|la|au|à|sur|dans)\s+(?:site|page)/i,
        /(?:ajoute|ajouter)\s+(?:une?\s+)?(?:section|partie|page|élément)/i,
        /(?:que\s+tu\s+viens\s+de\s+cr[ée]er|dernier\s+site|site\s+pr[ée]c[ée]dent)/i,
      ]
    },
    {
      type: 'image_generation',
      patterns: [
        /(?:g[ée]n[èe]re|cr[ée]e|fais|dessine|imagine)\s+(?:moi\s+)?(?:une?\s+)?image/i,
        /(?:generate|create|make|draw)\s+(?:me\s+)?(?:an?\s+)?image/i,
        /(?:erstelle|mache|generiere)\s+(?:mir\s+)?(?:ein\s+)?bild/i,
      ]
    },
    {
      type: 'code_execution',
      patterns: [
        /(?:ex[ée]cute|run|lance|fais\s+tourner)\s+(?:ce\s+)?(?:code|script|programme)/i,
        /(?:calcule|compute|calculate)\s+/i,
        /(?:code\s+python|python\s+code|javascript|js)/i,
        /(?:print|console\.log|echo)/i,
      ]
    },
    {
      type: 'web_search',
      patterns: [
        /(?:cherche|recherche|trouve|search|find|look\s+for)\s+(?:sur\s+)?(?:internet|le\s+web|google|en\s+ligne)/i,
        /(?:quelles?\s+sont|qu'est-ce\s+que|what\s+is|what\s+are)\s+(?:les?\s+)?(?:derni[èe]res?|latest|recent)/i,
        /(?:actualit[ée]s?|news|nouvelles)\s+(?:sur|about|de)/i,
      ]
    },
    {
      type: 'weather',
      patterns: [
        /(?:quel\s+temps|m[ée]t[ée]o|weather|wetter)\s+(?:fait-il|à|in|au|en)/i,
        /(?:temp[ée]rature|temperature)\s+(?:à|in|au|en)/i,
        /(?:il\s+fait\s+(?:chaud|froid|beau))/i,
      ]
    },
    {
      type: 'crypto',
      patterns: [
        /(?:prix|price|cours|valeur|value)\s+(?:du|de|of)?\s*(?:bitcoin|btc|ethereum|eth|crypto)/i,
        /(?:bitcoin|btc|ethereum|eth|solana|sol)\s+(?:prix|price|cours|valeur)/i,
        /(?:combien\s+(?:vaut|coûte)|how\s+much\s+is)\s+(?:le\s+)?(?:bitcoin|ethereum)/i,
      ]
    },
    {
      type: 'calculation',
      patterns: [
        /(?:combien\s+font|calcule|calculate|compute)\s+\d/i,
        /\d+\s*[\+\-\*\/\^]\s*\d+/,
        /(?:racine|sqrt|square\s+root|logarithme|log|puissance|power)/i,
      ]
    },
    {
      type: 'question',
      patterns: [
        /^(?:qu(?:el|elle|oi|and)|qui|où|comment|pourquoi|est-ce\s+que|c'est\s+quoi)/i,
        /^(?:what|who|where|when|why|how|is\s+it|are\s+there)/i,
        /^(?:was|wer|wo|wann|warum|wie)/i,
        /\?$/,
      ]
    },
    {
      type: 'conversation',
      patterns: [
        /^(?:bonjour|salut|hello|hi|hey|coucou|moien|hallo)/i,
        /^(?:merci|thanks|thank\s+you|danke)/i,
        /^(?:au\s+revoir|bye|goodbye|tschüss|äddi)/i,
        /^(?:comment\s+(?:vas-tu|ça\s+va|allez-vous)|how\s+are\s+you)/i,
      ]
    },
  ];
  
  // Chercher le premier pattern qui correspond
  for (const { type, patterns: typePatterns } of patterns) {
    if (typePatterns.some(p => p.test(lowerMessage))) {
      return type;
    }
  }
  
  return 'unknown';
}

/**
 * Extrait le nom d'un site à partir du message
 */
export function extractSiteName(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Patterns pour extraire le nom du site (noms propres explicites uniquement)
  const namePatterns = [
    // "appelé X", "nommé X", "s'appelle X", "named X", "called X"
    /(?:appel[ée]|nomm[ée]|s'appelle|named|called)\s+["']?([A-Z][^"',.\n]+?)["']?(?:\s+pour|\s+for|\s*$|\s*,)/i,
    // "site TechStart", "website MyBusiness"
    /(?:site|website)\s+(?:web\s+)?["']?([A-Z][A-Za-z0-9\s]{2,30})["']?(?:\s|$)/i,
    // Nom propre en majuscule explicite après "pour" ou "for" (mais pas des mots communs)
    /(?:pour|for)\s+(?:un[e]?\s+|a\s+)?([A-Z][a-zA-Zéèêëàâäùûüôöîïç]+(?:\s+[A-Z][a-zA-Zéèêëàâäùûüôöîïç]+)+)/,
  ];
  
  // Liste de mots à ignorer (articles, prépositions, mots génériques)
  const ignoreWords = ['un', 'une', 'le', 'la', 'les', 'de', 'du', 'des', 'pour', 'for', 'web', 'site', 'page', 'a', 'an', 'the', 'website', 'webseite', 'seite', 'einen', 'eine', 'ein', 'für', 'lawyer', 'dentist', 'doctor', 'coach', 'zahnarzt', 'arzt'];
  
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filtrer les noms génériques et les mots simples
      const lowerName = name.toLowerCase();
      if (!ignoreWords.includes(lowerName) && name.length > 2 && /[A-Z]/.test(name[0])) {
        return name;
      }
    }
  }
  
  // Extraire le type de business comme nom par défaut
  // Supporte français, anglais, allemand, luxembourgeois
  const businessTypes: { pattern: RegExp; name: string }[] = [
    // Français
    { pattern: /restaurant\s+(?:italien|français|chinois|japonais)/i, name: 'Restaurant' },
    { pattern: /h[ôo]tel/i, name: 'Hôtel' },
    { pattern: /boulangerie/i, name: 'Boulangerie' },
    { pattern: /salon\s+de\s+coiffure/i, name: 'Salon de Coiffure' },
    { pattern: /photographe/i, name: 'Studio Photo' },
    { pattern: /dentiste/i, name: 'Cabinet Dentaire' },
    { pattern: /avocat/i, name: 'Cabinet d\'Avocat' },
    { pattern: /plombier/i, name: 'Plomberie Pro' },
    { pattern: /fleuriste/i, name: 'Fleuriste' },
    { pattern: /coach\s+sportif/i, name: 'Coach Sportif' },
    { pattern: /architecte/i, name: 'Cabinet d\'Architecture' },
    { pattern: /musicien/i, name: 'Artiste Musicien' },
    { pattern: /électricien/i, name: 'Électricien Pro' },
    { pattern: /psychologue/i, name: 'Cabinet de Psychologie' },
    { pattern: /startup/i, name: 'Startup' },
    { pattern: /école\s+de\s+programmation/i, name: 'École de Code' },
    { pattern: /bierhaus/i, name: 'Bierhaus' },
    // Allemand
    { pattern: /zahnarzt/i, name: 'Zahnarztpraxis' },
    { pattern: /arzt|doktor|praxis/i, name: 'Arztpraxis' },
    { pattern: /rechtsanwalt|anwalt/i, name: 'Rechtsanwaltskanzlei' },
    { pattern: /friseur|friseursalon/i, name: 'Friseursalon' },
    { pattern: /bäckerei/i, name: 'Bäckerei' },
    { pattern: /restaurant|gaststätte/i, name: 'Restaurant' },
    { pattern: /blumenladen|florist/i, name: 'Blumenladen' },
    { pattern: /elektriker/i, name: 'Elektrikerbetrieb' },
    { pattern: /klempner|installateur/i, name: 'Klempnerbetrieb' },
    { pattern: /fotograf/i, name: 'Fotostudio' },
    { pattern: /fitness|trainer|coach/i, name: 'Fitnessstudio' },
    // Anglais
    { pattern: /dentist/i, name: 'Dental Practice' },
    { pattern: /lawyer|attorney/i, name: 'Law Firm' },
    { pattern: /doctor|physician|clinic/i, name: 'Medical Clinic' },
    { pattern: /barber|hair\s*salon/i, name: 'Hair Salon' },
    { pattern: /bakery/i, name: 'Bakery' },
    { pattern: /florist|flower\s*shop/i, name: 'Flower Shop' },
    { pattern: /electrician/i, name: 'Electrical Services' },
    { pattern: /plumber/i, name: 'Plumbing Services' },
    { pattern: /photographer/i, name: 'Photo Studio' },
    { pattern: /personal\s*trainer|fitness\s*coach/i, name: 'Fitness Coach' },
    { pattern: /architect/i, name: 'Architecture Firm' },
    // Luxembourgeois
    { pattern: /dokter|medezinner/i, name: 'Dokterpraxis' },
    { pattern: /coiffer|friseur/i, name: 'Coiffeursalon' },
  ];
  
  for (const { pattern, name } of businessTypes) {
    if (pattern.test(lowerMessage)) {
      return name;
    }
  }
  
  return null;
}

/**
 * Vérifie si le contexte doit être réinitialisé
 */
export function shouldResetContext(
  currentType: RequestType,
  previousContext: ConversationContext | undefined
): boolean {
  if (!previousContext) return false;
  
  // Si le type de demande change significativement, réinitialiser
  const significantChange = 
    (previousContext.lastRequestType === 'site_creation' && currentType !== 'site_modification') ||
    (previousContext.lastRequestType === 'image_generation' && currentType !== 'image_generation') ||
    (previousContext.lastRequestType === 'code_execution' && currentType !== 'code_execution');
  
  // Si plus de 5 minutes se sont écoulées, réinitialiser
  const timeoutExpired = Date.now() - previousContext.timestamp > 5 * 60 * 1000;
  
  return significantChange || timeoutExpired;
}

/**
 * Met à jour le contexte d'une conversation
 */
export function updateContext(
  conversationId: number,
  requestType: RequestType,
  siteName?: string,
  siteSlug?: string
): void {
  const context: ConversationContext = {
    conversationId,
    lastRequestType: requestType,
    lastSiteName: siteName,
    lastSiteSlug: siteSlug,
    timestamp: Date.now(),
  };
  
  contextCache.set(conversationId, context);
}

/**
 * Récupère le contexte d'une conversation
 */
export function getContext(conversationId: number): ConversationContext | undefined {
  return contextCache.get(conversationId);
}

/**
 * Réinitialise le contexte d'une conversation
 */
export function resetContext(conversationId: number): void {
  contextCache.delete(conversationId);
}

/**
 * Nettoie les contextes expirés (plus de 30 minutes)
 */
export function cleanupExpiredContexts(): void {
  const now = Date.now();
  const expirationTime = 30 * 60 * 1000; // 30 minutes
  
  const entries = Array.from(contextCache.entries());
  for (const [id, context] of entries) {
    if (now - context.timestamp > expirationTime) {
      contextCache.delete(id);
    }
  }
}

// Nettoyer les contextes expirés toutes les 10 minutes
setInterval(cleanupExpiredContexts, 10 * 60 * 1000);

export default {
  detectRequestType,
  extractSiteName,
  shouldResetContext,
  updateContext,
  getContext,
  resetContext,
  cleanupExpiredContexts,
};
