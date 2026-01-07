/**
 * Transition Detector - Détecte quand l'utilisateur change de demande
 * ou nie/annule une demande précédente
 * 
 * VERSION AMÉLIORÉE v2: Amélioration des taux de détection des transitions
 * Ce module résout le problème où Phoenix continue sur l'ancienne intention
 * au lieu de comprendre que l'utilisateur veut quelque chose de différent.
 */

export interface TransitionResult {
  hasTransition: boolean;
  transitionType: 'negation' | 'switch' | 'correction' | 'continuation' | 'none';
  negatedIntent?: string;
  newIntent?: string;
  confidence: number;
  keywords: string[];
}

// Patterns de NÉGATION - L'utilisateur ne veut PLUS quelque chose
const NEGATION_PATTERNS = [
  // Français - Négations explicites
  { pattern: /(?:je\s+)?ne\s+veux\s+plus\s+(?:de\s+)?(?:génération\s+d'?)?images?/i, negates: 'image_generation' },
  { pattern: /(?:je\s+)?ne\s+veux\s+plus\s+(?:de\s+)?(?:génération\s+d'?)?photos?/i, negates: 'image_generation' },
  { pattern: /(?:je\s+)?ne\s+veux\s+plus\s+(?:de\s+)?(?:création\s+de\s+)?sites?/i, negates: 'site_creation' },
  { pattern: /(?:je\s+)?ne\s+veux\s+plus\s+(?:de\s+)?(?:création\s+d'?)?apps?/i, negates: 'app_creation' },
  { pattern: /(?:je\s+)?ne\s+veux\s+plus\s+(?:de\s+)?(?:création\s+d'?)?applications?/i, negates: 'app_creation' },
  
  // Négation avec demande de site
  { pattern: /(?:stop|arrête).*(?:je\s+veux|crée).*site/i, negates: 'image_generation' },
  
  // Arrête/Stop
  { pattern: /(?:arrête|stop|stoppe|cesse|fini)\s+(?:de\s+)?(?:générer|créer|faire)\s+(?:des?\s+)?images?/i, negates: 'image_generation' },
  { pattern: /(?:arrête|stop|stoppe|cesse|fini)\s+(?:les?\s+)?images?/i, negates: 'image_generation' },
  { pattern: /(?:arrête|stop|stoppe|cesse|fini)\s+(?:de\s+)?(?:générer|créer|faire)\s+(?:des?\s+)?sites?/i, negates: 'site_creation' },
  { pattern: /(?:arrête|stop|stoppe|cesse|fini)\s+(?:de\s+)?(?:générer|créer|faire)\s+(?:des?\s+)?apps?/i, negates: 'app_creation' },
  
  // NOUVEAU: "Plus d'images" - pattern courant
  { pattern: /^plus\s+d'?images?/i, negates: 'image_generation' },
  { pattern: /plus\s+d'?images?\s*[,]?\s*(?:maintenant|je\s+veux)/i, negates: 'image_generation' },
  
  // Pas de / Pas d' - AMÉLIORÉS
  { pattern: /^pas\s+(?:d'|de\s+)?images?/i, negates: 'image_generation' },
  { pattern: /pas\s+(?:d'|de\s+)?images?\s*[,]?\s*(?:un[e]?\s+)?(?:site|website|page)/i, negates: 'image_generation' },
  { pattern: /pas\s+(?:d'|de\s+)?sites?\s+(?:cette\s+fois|maintenant)?/i, negates: 'site_creation' },
  { pattern: /pas\s+(?:d'|de\s+)?apps?\s+(?:cette\s+fois|maintenant)?/i, negates: 'app_creation' },
  
  // Oublie / Laisse tomber - AMÉLIORÉS
  { pattern: /(?:oublie|laisse\s+tomber|abandonne)\s+(?:les?\s+)?images?/i, negates: 'image_generation' },
  { pattern: /(?:oublie|laisse\s+tomber|abandonne)\s+(?:les?\s+)?sites?/i, negates: 'site_creation' },
  { pattern: /(?:oublie|laisse\s+tomber|abandonne)\s+(?:les?\s+)?apps?/i, negates: 'app_creation' },
  
  // Anglais - AMÉLIORÉS
  { pattern: /(?:no\s+more|stop|don't|do\s+not)\s+(?:generating?\s+)?images?/i, negates: 'image_generation' },
  { pattern: /^no\s+images?/i, negates: 'image_generation' },
  { pattern: /no\s+images?\s*[,]?\s*(?:a\s+)?(?:website|site|page)/i, negates: 'image_generation' },
  { pattern: /(?:no\s+more|stop|don't|do\s+not)\s+(?:creating?\s+)?(?:web)?sites?/i, negates: 'site_creation' },
  { pattern: /(?:no\s+more|stop|don't|do\s+not)\s+(?:creating?\s+)?apps?/i, negates: 'app_creation' },
  { pattern: /forget\s+(?:the\s+)?images?/i, negates: 'image_generation' },
  { pattern: /forget\s+(?:the\s+)?sites?/i, negates: 'site_creation' },
  
  // Allemand
  { pattern: /(?:keine?|nicht)\s+(?:mehr\s+)?(?:Bilder?|Fotos?)/i, negates: 'image_generation' },
  { pattern: /(?:keine?|nicht)\s+(?:mehr\s+)?(?:Web)?seiten?/i, negates: 'site_creation' },
];

// Patterns de TRANSITION - L'utilisateur change de sujet
const TRANSITION_PATTERNS = [
  // "maintenant" - signal fort de changement
  { pattern: /(?:maintenant|à\s+partir\s+de\s+maintenant|désormais|dorénavant)\s+(?:je\s+veux|crée|fais|génère)/i, type: 'switch' as const },
  { pattern: /(?:now|from\s+now\s+on)\s+(?:I\s+want|create|make|generate)/i, type: 'switch' as const },
  { pattern: /(?:jetzt|ab\s+jetzt)\s+(?:will\s+ich|erstelle|mache)/i, type: 'switch' as const },
  
  // NOUVEAU: "maintenant" seul avec site/app
  { pattern: /maintenant\s+(?:un[e]?\s+)?(?:site|website|app|application)/i, type: 'switch' as const },
  { pattern: /now\s+(?:a\s+)?(?:site|website|app|application)/i, type: 'switch' as const },
  
  // "plutôt" / "au lieu de"
  { pattern: /(?:plutôt|au\s+lieu\s+de|à\s+la\s+place)\s+(?:qu'?une?\s+)?/i, type: 'switch' as const },
  { pattern: /(?:instead\s+of|rather\s+than)/i, type: 'switch' as const },
  
  // NOUVEAU: "plutôt" seul avec verbe
  { pattern: /plutôt\s+(?:crée|fais|génère|build|create|make)/i, type: 'switch' as const },
  { pattern: /rather\s+(?:create|build|make)/i, type: 'switch' as const },
  
  // "passons à" / "changeons"
  { pattern: /(?:passons|passe)\s+(?:à|au|aux)/i, type: 'switch' as const },
  { pattern: /(?:changeons|change)\s+(?:de\s+)?(?:sujet|demande|tâche)/i, type: 'switch' as const },
  { pattern: /(?:let's\s+)?(?:move\s+on|switch)\s+to/i, type: 'switch' as const },
  
  // "ok/bien/super, maintenant"
  { pattern: /(?:ok|okay|bien|super|parfait|merci)[\s,]+(?:maintenant|mais\s+là|cette\s+fois)/i, type: 'switch' as const },
  { pattern: /(?:ok|okay|good|great|thanks)[\s,]+(?:now|but\s+now|this\s+time)/i, type: 'switch' as const },
  
  // NOUVEAU: "en fait" / "finalement" - changement d'avis
  { pattern: /(?:en\s+fait|finalement|actually|finally)\s*[,]?\s*(?:je\s+)?(?:préfère|veux|voudrais)/i, type: 'switch' as const },
  { pattern: /(?:en\s+fait|finalement)\s*[,]?\s*(?:un[e]?\s+)?(?:site|website|app|application)/i, type: 'switch' as const },
  
  // NOUVEAU: "je préfère" - préférence
  { pattern: /je\s+préfère\s+(?:un[e]?\s+)?(?:site|website|app|application)/i, type: 'switch' as const },
  { pattern: /i\s+prefer\s+(?:a\s+)?(?:site|website|app|application)/i, type: 'switch' as const },
  
  // NOUVEAU: "serait mieux/plus utile"
  { pattern: /(?:site|website|app|application)\s+(?:serait|would\s+be)\s+(?:mieux|better|plus\s+utile|more\s+useful)/i, type: 'switch' as const },
];

// Patterns de CORRECTION - L'utilisateur corrige une mauvaise compréhension
const CORRECTION_PATTERNS = [
  // "non" / "pas ça"
  { pattern: /^(?:non|no|nein)\s*[,!]?\s*(?:pas|not|nicht)/i, type: 'correction' as const },
  { pattern: /(?:non\s+)?(?:pas|not)\s+(?:une?\s+)?images?/i, type: 'correction' as const, corrects: 'image_generation' },
  { pattern: /(?:non\s+)?(?:pas|not)\s+(?:une?\s+)?(?:vraie?\s+)?applications?/i, type: 'correction' as const, corrects: 'app_creation' },
  
  // "tu m'as mal compris"
  { pattern: /(?:tu\s+)?(?:m'as|as)\s+mal\s+compris/i, type: 'correction' as const },
  { pattern: /(?:you\s+)?misunderstood/i, type: 'correction' as const },
  
  // "ce n'est pas ce que"
  { pattern: /(?:ce\s+)?n'est\s+pas\s+(?:ce\s+que|ça)/i, type: 'correction' as const },
  { pattern: /(?:that's\s+)?not\s+what\s+I/i, type: 'correction' as const },
  
  // "je ne voulais pas"
  { pattern: /je\s+ne\s+voulais\s+pas/i, type: 'correction' as const },
  { pattern: /I\s+didn't\s+(?:want|mean)/i, type: 'correction' as const },
  
  // "erreur"
  { pattern: /(?:c'est\s+une?\s+)?erreur/i, type: 'correction' as const },
  { pattern: /(?:that's\s+a\s+)?mistake/i, type: 'correction' as const },
];

// Patterns pour distinguer "image d'une app" vs "vraie app"
const REAL_VS_IMAGE_PATTERNS = [
  // Demande explicite de VRAIE application
  { pattern: /(?:vraie?|réelle?|fonctionnelle?|qui\s+(?:fonctionne|marche))\s+(?:application|app|chatbot)/i, intent: 'app_creation', isReal: true },
  { pattern: /(?:application|app|chatbot)\s+(?:vraie?|réelle?|fonctionnelle?|qui\s+(?:fonctionne|marche))/i, intent: 'app_creation', isReal: true },
  { pattern: /(?:real|working|functional|actual)\s+(?:application|app|chatbot)/i, intent: 'app_creation', isReal: true },
  { pattern: /(?:application|app|chatbot)\s+(?:that\s+works|functional)/i, intent: 'app_creation', isReal: true },
  
  // Demande explicite d'IMAGE d'application
  { pattern: /(?:image|photo|illustration|dessin|mockup|maquette)\s+(?:d'|de\s+)?(?:une?\s+)?(?:application|app|chatbot)/i, intent: 'image_generation', isReal: false },
  { pattern: /(?:dessine|visualise|montre)\s+(?:moi\s+)?(?:une?\s+)?(?:application|app|chatbot)/i, intent: 'image_generation', isReal: false },
  { pattern: /(?:image|picture|illustration|drawing|mockup)\s+of\s+(?:an?\s+)?(?:application|app|chatbot)/i, intent: 'image_generation', isReal: false },
  
  // "pas une image" = vraie app
  { pattern: /pas\s+(?:une?\s+)?images?\s*[,]?\s*(?:une?\s+)?(?:vraie?|réelle?)?\s*(?:application|app)/i, intent: 'app_creation', isReal: true },
  { pattern: /not\s+(?:an?\s+)?images?\s*[,]?\s*(?:a\s+)?(?:real\s+)?(?:application|app)/i, intent: 'app_creation', isReal: true },
];

// NOUVEAU: Patterns pour détecter l'intention cible dans une transition
const TARGET_INTENT_PATTERNS = [
  // Site web
  { pattern: /(?:site\s*web|site\s*internet|site|page\s*web|landing\s*page|website)/i, intent: 'site_creation' },
  // Application
  { pattern: /(?:application|app|chatbot|agent|assistant|bot)/i, intent: 'app_creation' },
  // Code
  { pattern: /(?:code|script|programme|program)/i, intent: 'code_execution' },
];

/**
 * Détecte si le message contient une transition ou négation
 */
export function detectTransition(message: string, previousIntent?: string): TransitionResult {
  const normalizedMessage = message.toLowerCase().trim();
  const keywords: string[] = [];
  
  // 1. Vérifier les négations
  for (const { pattern, negates } of NEGATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      const match = normalizedMessage.match(pattern);
      if (match) keywords.push(match[0]);
      
      return {
        hasTransition: true,
        transitionType: 'negation',
        negatedIntent: negates,
        confidence: 0.95,
        keywords
      };
    }
  }
  
  // 2. Vérifier les corrections
  for (const { pattern, type, corrects } of CORRECTION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      const match = normalizedMessage.match(pattern);
      if (match) keywords.push(match[0]);
      
      return {
        hasTransition: true,
        transitionType: type,
        negatedIntent: corrects || previousIntent,
        confidence: 0.9,
        keywords
      };
    }
  }
  
  // 3. Vérifier les transitions
  for (const { pattern, type } of TRANSITION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      const match = normalizedMessage.match(pattern);
      if (match) keywords.push(match[0]);
      
      return {
        hasTransition: true,
        transitionType: type,
        confidence: 0.85,
        keywords
      };
    }
  }
  
  // 4. Pas de transition détectée
  return {
    hasTransition: false,
    transitionType: 'none',
    confidence: 1.0,
    keywords: []
  };
}

/**
 * Distingue si l'utilisateur veut une VRAIE application ou une IMAGE d'application
 */
export function distinguishRealVsImage(message: string): {
  isRealApp: boolean;
  isImageOfApp: boolean;
  confidence: number;
  detectedIntent?: string;
} {
  const normalizedMessage = message.toLowerCase().trim();
  
  for (const { pattern, intent, isReal } of REAL_VS_IMAGE_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        isRealApp: isReal,
        isImageOfApp: !isReal,
        confidence: 0.95,
        detectedIntent: intent
      };
    }
  }
  
  // Par défaut: si le message mentionne "application/app/chatbot" sans "image",
  // c'est probablement une vraie application
  const hasAppKeyword = /(?:application|app|chatbot|agent|assistant|bot)/i.test(normalizedMessage);
  const hasImageKeyword = /(?:image|photo|illustration|dessin|picture|drawing|mockup)/i.test(normalizedMessage);
  
  if (hasAppKeyword && !hasImageKeyword) {
    return {
      isRealApp: true,
      isImageOfApp: false,
      confidence: 0.8,
      detectedIntent: 'app_creation'
    };
  }
  
  return {
    isRealApp: false,
    isImageOfApp: false,
    confidence: 0.5
  };
}

/**
 * NOUVEAU: Détecte l'intention cible dans un message de transition
 */
export function detectTargetIntent(message: string): string | undefined {
  const normalizedMessage = message.toLowerCase().trim();
  
  for (const { pattern, intent } of TARGET_INTENT_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return intent;
    }
  }
  
  return undefined;
}

/**
 * Analyse complète du message pour détecter les transitions et intentions réelles
 */
export function analyzeMessageForTransition(
  message: string,
  previousIntent?: string
): {
  transition: TransitionResult;
  realVsImage: ReturnType<typeof distinguishRealVsImage>;
  shouldOverrideIntent: boolean;
  suggestedIntent?: string;
} {
  const transition = detectTransition(message, previousIntent);
  const realVsImage = distinguishRealVsImage(message);
  const normalizedMessage = message.toLowerCase().trim();
  
  let shouldOverrideIntent = false;
  let suggestedIntent: string | undefined;
  
  // Détecter si le message demande un site web
  const hasSiteKeyword = /(?:site\s*web|site\s*internet|site|page\s*web|landing\s*page|website)/i.test(normalizedMessage);
  const hasSiteCreationVerb = /(?:crée|créer|fais|faire|génère|générer|construis|construire|développe|développer|create|make|build)/i.test(normalizedMessage);
  const hasWantVerb = /(?:je\s+veux|je\s+voudrais|j'aimerais|i\s+want|i\s+need|je\s+préfère|i\s+prefer)/i.test(normalizedMessage);
  
  // Si une transition est détectée, on doit probablement changer d'intention
  if (transition.hasTransition) {
    shouldOverrideIntent = true;
    
    // Détecter l'intention cible
    const targetIntent = detectTargetIntent(message);
    
    // Si l'intention précédente était image_generation et qu'elle est niée
    if (transition.negatedIntent === 'image_generation') {
      // Vérifier si le message demande une app ou un site
      if (realVsImage.isRealApp) {
        suggestedIntent = 'app_creation';
      } else if (hasSiteKeyword) {
        suggestedIntent = 'site_creation';
      } else if (targetIntent) {
        suggestedIntent = targetIntent;
      }
    } else if (targetIntent) {
      // Si on a une intention cible claire
      suggestedIntent = targetIntent;
    }
  }
  
  // Si on détecte explicitement une vraie app vs image
  if (realVsImage.isRealApp && realVsImage.confidence > 0.8) {
    shouldOverrideIntent = true;
    suggestedIntent = 'app_creation';
  } else if (realVsImage.isImageOfApp && realVsImage.confidence > 0.8) {
    shouldOverrideIntent = true;
    suggestedIntent = 'image_generation';
  }
  
  // Si le message a une transition et demande un site, forcer site_creation
  if (transition.hasTransition && hasSiteKeyword && (hasSiteCreationVerb || hasWantVerb) && !realVsImage.isRealApp) {
    shouldOverrideIntent = true;
    suggestedIntent = 'site_creation';
  }
  
  // NOUVEAU: Si le message contient "je préfère" ou "serait mieux" avec site
  if ((hasWantVerb || /serait\s+(?:mieux|plus\s+utile)|would\s+be\s+(?:better|more\s+useful)/i.test(normalizedMessage)) && hasSiteKeyword) {
    shouldOverrideIntent = true;
    suggestedIntent = 'site_creation';
  }
  
  return {
    transition,
    realVsImage,
    shouldOverrideIntent,
    suggestedIntent
  };
}

export default {
  detectTransition,
  distinguishRealVsImage,
  analyzeMessageForTransition,
  detectTargetIntent
};
