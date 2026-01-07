/**
 * Intent Detector - Détecte intelligemment l'intention de l'utilisateur
 * pour décider comment Phoenix doit répondre
 */

export type IntentType = 
  | 'conversation'      // Discussion normale
  | 'code_request'      // Demande explicite de code
  | 'code_execution'    // Demande d'exécuter du code
  | 'image_generation'  // Demande de générer une image
  | 'site_creation'     // Demande de création de site web
  | 'app_creation'      // Demande de création d'application/agent IA
  | 'site_modification' // Demande de modification de site existant
  | 'web_browse'        // Navigation web directe
  | 'web_search'        // Besoin de recherche web
  | 'weather'           // Demande météo
  | 'crypto'            // Demande crypto/prix
  | 'file_analysis'     // Analyse de fichier uploadé
  | 'calculation';      // Calcul mathématique

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  details: {
    keywords: string[];
    language?: string;      // Pour le code
    searchQuery?: string;   // Pour la recherche
    imagePrompt?: string;   // Pour la génération d'image
  };
}

// Patterns pour détecter les demandes EXPLICITES de code
const CODE_REQUEST_PATTERNS = [
  // Français
  /(?:écris|écrire|crée|créer|génère|générer|fais|faire|donne|donner)[\s-]*(?:moi)?[\s-]*(?:un|une|le|la|du)?[\s-]*(?:code|script|programme|fonction|classe|algorithme)/i,
  /(?:code|script|programme)[\s-]*(?:pour|qui|en)/i,
  /(?:en|avec)[\s-]*(?:python|javascript|typescript|java|c\+\+|rust|go|php|ruby|swift)/i,
  /(?:montre|montrer)[\s-]*(?:moi)?[\s-]*(?:comment|le)[\s-]*(?:coder|programmer|écrire)/i,
  // Anglais
  /(?:write|create|generate|make|give|show)[\s-]*(?:me)?[\s-]*(?:a|an|the|some)?[\s-]*(?:code|script|program|function|class|algorithm)/i,
  /(?:code|script|program)[\s-]*(?:for|that|to|in)/i,
  /(?:how to|how do i)[\s-]*(?:code|program|write)/i,
];

// Patterns pour détecter les demandes d'EXÉCUTION de code
const CODE_EXECUTION_PATTERNS = [
  /(?:exécute|exécuter|lance|lancer|run|execute)[\s-]*(?:ce|le|this|the)?[\s-]*(?:code|script)/i,
  /(?:teste|tester|test)[\s-]*(?:ce|le|this|the)?[\s-]*(?:code|script)/i,
];

// Patterns pour détecter les demandes de génération d'IMAGE
const IMAGE_GENERATION_PATTERNS = [
  // Français - patterns plus flexibles
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire)[\s-]*(?:moi)?[\s-]*(?:une|un|l')?[\s-]*(?:image|photo|illustration|dessin|visuel|artwork|art)/i,
  /(?:image|photo|illustration|dessin)[\s-]*(?:de|d'|du|des|avec|représentant|montrant)/i,
  /(?:montre|montrer|visualise|visualiser)[\s-]*(?:moi)?[\s-]*(?:une|un)?/i,
  // NOUVEAU: Patterns pour "peux-tu me générer" sans "image" explicite
  /(?:peux|peut|pourrais|pourrait)[\s-]*(?:tu|vous)?[\s-]*(?:me)?[\s-]*(?:génér|créer|faire|dessiner)/i,
  /(?:génère|générer|crée|créer|dessine|dessiner)[\s-]*(?:moi)?[\s-]*(?:un|une)/i,
  // NOUVEAU: Patterns pour objets visuels communs
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:avion|voiture|maison|chat|chien|paysage|portrait|logo|icône|personnage|robot|animal|monstre|dragon|oiseau|fleur|arbre|montagne|ville|bâtiment)/i,
  // Anglais
  /(?:generate|create|make|draw|produce)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:image|photo|picture|illustration|drawing|visual|artwork)/i,
  /(?:image|photo|picture)[\s-]*(?:of|with|showing|depicting)/i,
  // NOUVEAU: Patterns anglais pour objets
  /(?:generate|create|make|draw)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:plane|car|house|cat|dog|landscape|portrait|logo|icon|character|robot|animal|monster|dragon|bird|flower|tree|mountain|city|building)/i,
];

// Patterns pour détecter les besoins de recherche web
// IMPORTANT: Ces patterns doivent être EXPLICITES pour éviter les faux positifs
const WEB_SEARCH_PATTERNS = [
  /(?:cherche|recherche|trouve|trouver)[\s-]+(?:sur|dans|on|in)?[\s-]*(?:internet|le web|google|the web)/i,
  /(?:actualité|actualités|news|nouvelles|dernières)[\s-]+(?:sur|about|on|de)/i,
  /(?:information|infos?)[\s-]+(?:récentes?|actuelles?|en ligne|online)/i,
];

// Patterns pour les demandes conversationnelles simples (PAS de recherche web)
const CONVERSATIONAL_PATTERNS = [
  // Salutations
  /^(?:salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/i,
  /^(?:ça va|comment vas-tu|comment tu vas|how are you)/i,
  
  // Demandes créatives textuelles
  /(?:raconte|raconter|dis|dire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|conte|poème|joke)/i,
  /(?:écris|écrire|rédige|rédiger)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:poème|histoire|texte|lettre|email|mail|article)/i,
  /(?:fais|faire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|poème)/i,
  
  // Traductions
  /(?:traduis|traduire|translate)[\s-]/i,
  
  // Résumés
  /(?:résume|résumer|summarize)[\s-]/i,
  
  // Explications simples
  /(?:explique|expliquer|explain)[\s-]*(?:moi)?[\s-]*(?:ce|cette|cet|le|la|les)?/i,
  
  // Calculs simples
  /^(?:combien|how much|how many)[\s-]*(?:font|fait|is|are|equals?)[\s-]*\d/i,
  /^\d+[\s]*[\+\-\*\/][\s]*\d+/,
  
  // Questions oui/non
  /^(?:est-ce que|is it|are you|do you|can you|peux-tu|sais-tu)/i,
];

// Patterns météo
const WEATHER_PATTERNS = [
  /(?:météo|meteo|weather|temps|température|temperature)/i,
  /(?:quel|quelle|what)[\s-]*(?:temps|weather)/i,
  /(?:fait|fait-il|is it)[\s-]*(?:chaud|froid|beau|hot|cold)/i,
];

// Patterns crypto
const CRYPTO_PATTERNS = [
  /(?:bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain)/i,
  /(?:prix|price|cours|value)[\s-]*(?:du|de|of)?[\s-]*(?:bitcoin|btc|ethereum|eth|solana)/i,
];

// Patterns calcul
const CALCULATION_PATTERNS = [
  /(?:calcule|calculer|calculate|compute)[\s-]/i,
  /(?:combien|how much|how many)[\s-]*(?:fait|font|is|are|equals?)/i,
  /\d+[\s]*[\+\-\*\/\^][\s]*\d+/,  // Expressions mathématiques simples
];

// Patterns pour la CRÉATION de site web (PRIORITÉ HAUTE)
const SITE_CREATION_PATTERNS = [
  // Français - Patterns explicites
  /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire|d[ée]veloppe|d[ée]velopper)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:site|page)/i,
  // "crée un site pour X" - pattern très commun
  /cr[ée]e[rz]?\s+(?:moi\s+)?(?:un[e]?\s+)?site\s+(?:web\s+)?(?:pour|d'|de)/i,
  // "site pour un X" avec types de business
  /(?:un[e]?\s+)?site\s+(?:web\s+)?pour\s+(?:un[e]?\s+)?(?:h[ôo]tel|restaurant|entreprise|business|portfolio|coach|avocat|dentiste|plombier|fleuriste|architecte|musicien|photographe|boulanger|[ée]lectricien|psychologue|startup|salon|cabinet|boutique|magasin|agence|studio)/i,
  /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu\s+)?(?:cr[ée]es?|fasses?|g[ée]n[èe]res?)\s+(?:un[e]?\s+)?(?:site|page)/i,
  /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:cr[ée]er|faire|g[ée]n[ée]rer)\s+(?:un[e]?\s+)?(?:site|page)/i,
  // Anglais
  /(?:create|make|build|generate|develop)\s+(?:me\s+)?(?:a\s+)?(?:website|web\s+page|landing\s+page|site)/i,
  /(?:can\s+you|could\s+you|please)\s+(?:create|make|build|generate)\s+(?:a\s+)?(?:website|site|page)/i,
  /(?:i\s+want|i\s+need|i'd\s+like)\s+(?:a\s+)?(?:website|site|page)\s+for/i,
  // Allemand
  /(?:erstelle|erstellen|mache|machen|baue|bauen|generiere|generieren)\s+(?:mir\s+)?(?:eine?\s+)?(?:webseite|website|seite)/i,
  /(?:ich\s+möchte|ich\s+brauche|ich\s+will)\s+(?:eine?\s+)?(?:webseite|website|seite)\s+für/i,
  // Luxembourgeois
  /(?:maach|maachen|bau|bauen)\s+(?:mir\s+)?(?:eng?\s+)?(?:websäit|site)/i,
];

// Patterns pour la MODIFICATION de site web existant (PRIORITÉ MAXIMALE)
const SITE_MODIFICATION_PATTERNS = [
  // Français - Modification directe avec nom de site
  /modifie\s+(?:le\s+)?(?:site|mon\s+site)\s+[\w\s]+/i,
  /(?:modifie|modifier|change|changer|mets? [aà] jour|mettre [aà] jour|améliore|améliorer|corrige|corriger|ajuste|ajuster|édite|éditer|update|edit)\s+(?:le|la|mon|ma|ce|cette)?\s*(?:site|page|application|app)/i,
  // Français - Actions sur éléments avec "sur mon site" ou "de mon site"
  /(?:ajoute|ajouter|rajoute|rajouter|insère|insérer|add)\s+(?:un[e]?|des|du|de la)?\s*(?:section|bouton|menu|image|texte|formulaire|contact|header|footer|nav|message)/i,
  /(?:supprime|supprimer|enlève|enlever|retire|retirer|remove|delete)\s+(?:le|la|les|un[e]?)?\s*(?:section|bouton|menu|image|texte|formulaire)/i,
  /(?:change|changer|modifie|modifier)\s+(?:le|la|les)?\s*(?:couleur|titre|texte|image|fond|background|style|design|header|footer)/i,
  // Pattern spécifique: "change la couleur... de mon site"
  /(?:change|changer|modifie|modifier).*(?:couleur|color|style|design).*(?:site|page|app)/i,
  // Anglais
  /(?:modify|change|update|edit|improve|fix|adjust)\s+(?:the|my|this)?\s*(?:site|page|website|application|app)/i,
  /(?:add|insert)\s+(?:a|an|some)?\s*(?:section|button|menu|image|text|form|contact|header|footer|nav|message)/i,
  // Patterns pour "sur mon site", "dans mon site", "à mon site"
  /(?:sur|dans|to|in|on|à)\s+(?:mon|ma|le|la|my|the)?\s*(?:site|page|application)/i,
  // Pattern avec deux-points (ex: "Modifie mon site: change...")
  /(?:modifie|change|update|edit)\s+(?:mon|le|my)?\s*(?:site|page|app)\s*[:\-]/i,
];

// Patterns pour la CRÉATION d'APPLICATION/AGENT IA (PRIORITÉ MAXIMALE)
const APP_CREATION_PATTERNS = [
  // Français - Création d'application/agent
  /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire|d[ée]veloppe|d[ée]velopper)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:application|app|agent|assistant|bot|chatbot|IA|AI)/i,
  /(?:cr[ée]e|cr[ée]er)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:application|app)\s+(?:web|mobile)?\s*(?:d'|de)?\s*(?:agent|assistant|IA|AI|chat)/i,
  /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu\s+)?(?:cr[ée]es?|fasses?|g[ée]n[èe]res?)\s+(?:un[e]?\s+)?(?:application|app|agent)/i,
  /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:cr[ée]er|faire|g[ée]n[ée]rer)\s+(?:un[e]?\s+)?(?:application|app|agent)/i,
  // Anglais
  /(?:create|make|build|generate|develop)\s+(?:me\s+)?(?:an?\s+)?(?:application|app|agent|assistant|bot|chatbot|AI)/i,
  /(?:can\s+you|could\s+you|please)\s+(?:create|make|build)\s+(?:an?\s+)?(?:application|app|agent|bot)/i,
  /(?:i\s+want|i\s+need|i'd\s+like)\s+(?:an?\s+)?(?:application|app|agent|assistant)/i,
];

/**
 * Détecte l'intention principale de l'utilisateur
 */
export function detectIntent(message: string, hasFileContent: boolean = false): DetectedIntent {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Si un fichier est uploadé, c'est probablement une analyse
  if (hasFileContent) {
    return {
      type: 'file_analysis',
      confidence: 0.9,
      details: { keywords: ['file', 'analysis'] }
    };
  }
  
  // PRIORITÉ 0: Vérifier les demandes de CRÉATION d'APPLICATION/AGENT IA (priorité maximale)
  for (const pattern of APP_CREATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] App/Agent creation detected with pattern:', pattern);
      return {
        type: 'app_creation',
        confidence: 0.99,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern)
        }
      };
    }
  }
  
  // PRIORITÉ 1: Vérifier les demandes de MODIFICATION de site existant
  for (const pattern of SITE_MODIFICATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] Site modification detected with pattern:', pattern);
      return {
        type: 'site_modification',
        confidence: 0.97,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern)
        }
      };
    }
  }
  
  // PRIORITÉ 2: Vérifier les demandes de CRÉATION de site web
  for (const pattern of SITE_CREATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] Site creation detected with pattern:', pattern);
      return {
        type: 'site_creation',
        confidence: 0.98,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern)
        }
      };
    }
  }
  
  // Vérifier les demandes explicites de code
  for (const pattern of CODE_REQUEST_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      const language = detectProgrammingLanguage(normalizedMessage);
      return {
        type: 'code_request',
        confidence: 0.95,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern),
          language 
        }
      };
    }
  }
  
  // Vérifier les demandes d'exécution de code
  for (const pattern of CODE_EXECUTION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'code_execution',
        confidence: 0.95,
        details: { keywords: extractKeywords(normalizedMessage, pattern) }
      };
    }
  }
  
  // PRIORITÉ 1: Vérifier les demandes crypto EN PREMIER (avant images)
  for (const pattern of CRYPTO_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'crypto',
        confidence: 0.9,
        details: { keywords: extractKeywords(normalizedMessage, pattern) }
      };
    }
  }
  
  // PRIORITÉ 2: Vérifier les demandes météo
  for (const pattern of WEATHER_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'weather',
        confidence: 0.9,
        details: { keywords: extractKeywords(normalizedMessage, pattern) }
      };
    }
  }
  
  // PRIORITÉ 3: Vérifier les demandes de NAVIGATION WEB (avant les images)
  const browseKeywords = /(?:va\s+sur|vas\s+sur|aller\s+sur|visite|visiter|ouvre|ouvrir|navigue|naviguer|go\s+to|visit|open|navigate|browse|page\s+web|site\s+web|website|webpage|\.com|\.fr|\.org|\.net|\.io)/i;
  const isBrowseRequest = browseKeywords.test(normalizedMessage);
  
  if (isBrowseRequest) {
    return {
      type: 'web_search',  // Utiliser web_search pour déclencher la navigation
      confidence: 0.95,
      details: { 
        keywords: ['browse', 'navigate'],
        searchQuery: message
      }
    };
  }
  
  // PRIORITÉ 4: Vérifier les demandes de génération d'image
  // MAIS exclure si le message contient des mots-clés de données/analyse/navigation
  const dataKeywords = /(?:table|tableau|données|data|analyse|analysis|prix|price|api|statistiques|stats|graphique|chart|rapport|report|expert|avis|contenu|content|page|site)/i;
  const isDataRequest = dataKeywords.test(normalizedMessage);
  
  if (!isDataRequest) {
    for (const pattern of IMAGE_GENERATION_PATTERNS) {
      if (pattern.test(normalizedMessage)) {
        return {
          type: 'image_generation',
          confidence: 0.95,
          details: { 
            keywords: extractKeywords(normalizedMessage, pattern),
            imagePrompt: extractImagePrompt(message)
          }
        };
      }
    }
  }
  
  // Vérifier les calculs
  for (const pattern of CALCULATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'calculation',
        confidence: 0.85,
        details: { keywords: extractKeywords(normalizedMessage, pattern) }
      };
    }
  }
  
  // Vérifier si c'est une demande conversationnelle simple AVANT la recherche web
  for (const pattern of CONVERSATIONAL_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] Conversational pattern matched, returning conversation intent');
      return {
        type: 'conversation',
        confidence: 1.0,
        details: { keywords: [] }
      };
    }
  }
  
  // Vérifier les recherches web EXPLICITES
  for (const pattern of WEB_SEARCH_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'web_search',
        confidence: 0.8,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern),
          searchQuery: message
        }
      };
    }
  }
  
  // Par défaut: conversation normale
  return {
    type: 'conversation',
    confidence: 1.0,
    details: { keywords: [] }
  };
}

/**
 * Détecte le langage de programmation mentionné
 */
function detectProgrammingLanguage(message: string): string | undefined {
  const languages: Record<string, RegExp> = {
    'python': /python|py/i,
    'javascript': /javascript|js|node/i,
    'typescript': /typescript|ts/i,
    'java': /\bjava\b/i,
    'c++': /c\+\+|cpp/i,
    'rust': /rust/i,
    'go': /\bgo\b|golang/i,
    'php': /php/i,
    'ruby': /ruby/i,
    'swift': /swift/i,
  };
  
  for (const [lang, pattern] of Object.entries(languages)) {
    if (pattern.test(message)) {
      return lang;
    }
  }
  
  return undefined;
}

/**
 * Extrait les mots-clés correspondant au pattern
 */
function extractKeywords(message: string, pattern: RegExp): string[] {
  const match = message.match(pattern);
  if (match) {
    return match[0].split(/\s+/).filter(w => w.length > 2);
  }
  return [];
}

/**
 * Extrait le prompt pour la génération d'image
 */
function extractImagePrompt(message: string): string {
  // Enlever les mots de commande et de politesse pour garder la description
  const cleanedMessage = message
    // Enlever les formules de politesse au début
    .replace(/^(?:je vais très bien|je vais bien|merci|salut|bonjour|bonsoir|coucou|hello|hi)[\s,]*(?:merci)?[\s,]*/gi, '')
    // Enlever "est-ce que tu peux", "peux-tu", etc.
    .replace(/(?:est-ce que|est ce que)?[\s-]*(?:tu|vous)?[\s-]*(?:peux|peut|pourrais|pourrait|pouvez)[\s-]*(?:tu|vous)?[\s-]*(?:me)?[\s-]*/gi, '')
    // Enlever les mots de commande pour la génération
    .replace(/(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire|generate|create|make|draw|produce)[\s-]*(?:moi)?[\s-]*/gi, '')
    // Enlever les articles et prépositions inutiles au début
    .replace(/^(?:une|un|l'|le|la|les|an?|the)?[\s-]*/gi, '')
    // Enlever "s'il te plaît", "please", etc. à la fin
    .replace(/[\s,]*(?:s'il te plaît|s'il vous plaît|stp|svp|please|pls)[\s,]*$/gi, '')
    .trim();
  
  return cleanedMessage || message;
}

/**
 * Génère le prompt système adapté à l'intention
 */
export function generateSystemPromptForIntent(intent: DetectedIntent): string {
  const basePrompt = `Tu es Phoenix, un assistant IA intelligent et amical.

RÈGLES FONDAMENTALES:
1. Tu converses NATURELLEMENT comme un ami intelligent
2. Tu ne génères du code QUE si l'utilisateur le demande EXPLICITEMENT
3. Tu réponds de manière concise et utile
4. Tu utilises les données enrichies [DONNEES ENRICHIES] quand elles sont disponibles
5. Tu es honnête sur tes limites

IMPORTANT: Ne génère JAMAIS de code sauf si l'utilisateur dit explicitement des mots comme:
- "écris un code", "crée un script", "programme", "code pour", "en python", "en javascript"
- "write code", "create a script", "program", "code for"

Pour les questions simples, réponds simplement en texte normal.`;

  switch (intent.type) {
    case 'conversation':
      return `${basePrompt}

MODE: CONVERSATION NORMALE
- Réponds naturellement, comme dans une discussion amicale
- Pas de code, pas de formatage technique
- Sois concis et direct`;

    case 'code_request':
      return `${basePrompt}

MODE: GÉNÉRATION DE CODE
- L'utilisateur a explicitement demandé du code
- Génère un code propre et bien commenté
- Utilise le langage demandé: ${intent.details.language || 'le plus approprié'}
- Explique brièvement ce que fait le code`;

    case 'code_execution':
      return `${basePrompt}

MODE: EXÉCUTION DE CODE
- L'utilisateur veut exécuter du code
- Génère le code dans un bloc de code avec le langage spécifié
- Le système exécutera automatiquement le code`;

    case 'image_generation':
      return `${basePrompt}

MODE: GÉNÉRATION D'IMAGE
- L'utilisateur veut une image
- Tu PEUX générer des images, ne dis JAMAIS que tu ne peux pas
- Décris brièvement l'image que tu vas créer
- Le système génère l'image AUTOMATIQUEMENT
- Réponds avec enthousiasme et créativité`;

    case 'web_search':
      return `${basePrompt}

MODE: RECHERCHE WEB
- Utilise les données de recherche fournies dans [DONNEES ENRICHIES]
- Synthétise les informations trouvées
- Cite les sources`;

    case 'weather':
      return `${basePrompt}

MODE: MÉTÉO
- Utilise les données météo fournies dans [DONNEES ENRICHIES]
- Donne les informations de manière claire et concise`;

    case 'crypto':
      return `${basePrompt}

MODE: CRYPTO
- Utilise les données de prix fournies dans [DONNEES ENRICHIES]
- Donne les prix actuels et les variations`;

    case 'calculation':
      return `${basePrompt}

MODE: CALCUL
- Effectue le calcul demandé
- Montre le résultat clairement
- Si le calcul est complexe, tu peux générer du code Python`;

    case 'file_analysis':
      return `${basePrompt}

MODE: ANALYSE DE FICHIER
- Analyse le contenu du fichier fourni dans [CONTENU DU FICHIER]
- Réponds aux questions sur ce fichier
- Cite des passages spécifiques si nécessaire`;

    default:
      return basePrompt;
  }
}

export default {
  detectIntent,
  generateSystemPromptForIntent
};
