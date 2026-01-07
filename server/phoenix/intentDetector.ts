/**
 * Intent Detector - Détecte intelligemment l'intention de l'utilisateur
 * pour décider comment Phoenix doit répondre
 * 
 * VERSION AMÉLIORÉE v3: Amélioration des taux de détection pour site, app, météo, crypto et transitions
 * Objectif: 80-90% de réussite globale
 */

import { analyzeMessageForTransition } from './transitionDetector';

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
    // Nouvelles propriétés pour la détection multi-niveaux
    hasNegation?: boolean;  // Si une négation a été détectée
    hasTransition?: boolean; // Si une transition a été détectée
    negatedIntent?: IntentType; // L'intention qui a été niée
    transitionFrom?: IntentType; // L'intention de départ de la transition
    transitionTo?: IntentType; // L'intention d'arrivée de la transition
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
  // Français - exécution explicite
  /(?:exécute|exécuter|lance|lancer|fais\s+tourner)[\s-]*(?:ce|le|this|the)?[\s-]*(?:code|script|programme)/i,
  /(?:teste|tester|test|debug|débugue)[\s-]*(?:ce|le|this|the)?[\s-]*(?:code|script)/i,
  // Anglais - exécution explicite
  /(?:run|execute|launch)[\s-]*(?:this|the|my)?[\s-]*(?:code|script|program)/i,
  // Calculs et algorithmes
  /(?:calcule|calculer|calculate|compute)[\s-]/i,
  /(?:combien\s+fait|what\s+is)[\s-]*\d+/i,
  /(?:trie|trier|sort)[\s-]*(?:cette|ce|this|the)?[\s-]*(?:liste|array|tableau)/i,
  /(?:inverse|inverser|reverse)[\s-]*(?:cette|ce|this|the)?[\s-]*(?:chaîne|string)/i,
  /(?:compte|compter|count)[\s-]*(?:les)?[\s-]*(?:voyelles|consonnes|vowels|consonants)/i,
  /(?:vérifie|vérifier|check)[\s-]*(?:si|if)[\s-]*.*(?:palindrome)/i,
  /(?:trouve|trouver|find)[\s-]*(?:le|la|the)?[\s-]*(?:maximum|minimum|max|min)/i,
  /(?:convertis|convertir|convert)[\s-]/i,
  /(?:génère|générer|generate)[\s-]*(?:un|une|a)?[\s-]*(?:mot\s+de\s+passe|password|uuid|id)/i,
  /(?:parse|stringify|encode|decode|hash)[\s-]/i,
  /(?:factorielle|factorial|fibonacci)/i,
  /(?:aire|area|rayon|radius|cercle|circle)/i,
  /(?:celsius|fahrenheit|kelvin)/i,
  // Code inline
  /print\s*\(/i,
  /console\.log/i,
  /\[\d+(?:,\s*\d+)*\]/i,  // Arrays comme [1, 2, 3]
];

// Patterns pour détecter les demandes de génération d'IMAGE - AMÉLIORÉS v2
// IMPORTANT: Ces patterns ne doivent PAS matcher les demandes d'applications
const IMAGE_GENERATION_PATTERNS = [
  // Français - patterns avec "image" explicite
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire)[\s-]*(?:moi)?[\s-]*(?:une|un|l')?[\s-]*(?:image|photo|illustration|dessin|visuel|artwork|art)(?!.*(?:application|app|chatbot|site))/i,
  /(?:image|photo|illustration|dessin)[\s-]*(?:de|d'|du|des|avec|représentant|montrant)(?!.*(?:application|app|chatbot|site))/i,
  // Patterns pour objets visuels communs (PAS d'applications)
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:avion|voiture|maison|chat|chien|paysage|portrait|logo|icône|personnage|animal|monstre|dragon|oiseau|fleur|arbre|montagne|ville|bâtiment|papillon|lune|soleil|coucher|lever)(?!.*(?:application|app|chatbot|site))/i,
  // Anglais - patterns avec "image/picture" explicite
  /(?:generate|create|make|draw|produce)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:image|photo|picture|illustration|drawing|visual|artwork)(?!.*(?:application|app|chatbot|site))/i,
  /(?:image|photo|picture)[\s-]*(?:of|with|showing|depicting)(?!.*(?:application|app|chatbot|site))/i,
  // NOUVEAU: Patterns anglais "Generate a X" pour objets visuels courants
  /generate\s+(?:an?\s+)?(?:sunset|sunrise|castle|fantasy|cyberpunk|scene|landscape|rainbow|space\s*station|luxury\s*car|beach\s*resort|northern\s*lights|thunderstorm|abstract|portrait)/i,
  /create\s+(?:an?\s+)?(?:image\s+of\s+)?(?:sunset|sunrise|castle|fantasy|cyberpunk|scene|landscape|rainbow|space\s*station|luxury\s*car|beach\s*resort|northern\s*lights|thunderstorm|abstract|portrait)/i,
  // Patterns anglais pour objets (PAS d'applications)
  /(?:generate|create|make|draw)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:plane|car|house|cat|dog|landscape|portrait|logo|icon|character|animal|monster|dragon|bird|flower|tree|mountain|city|building|butterfly|moon|sun|sunset|sunrise)(?!.*(?:application|app|chatbot|site))/i,
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

// Patterns météo - AMÉLIORÉS pour couvrir plus de cas
const WEATHER_PATTERNS = [
  // Mots-clés directs
  /\b(?:météo|meteo|weather)\b/i,
  /\b(?:température|temperature|temp)\b/i,
  // Questions sur le temps
  /(?:quel|quelle|what|what's)[\s-]*(?:temps|weather)/i,
  /(?:il\s+fait|fait[\s-]il|is\s+it)[\s-]*(?:quel\s+temps|chaud|froid|beau|hot|cold|nice|warm|cool)/i,
  // Prévisions
  /(?:prévisions?|forecast|prévision)/i,
  /(?:va[\s-]t[\s-]il|will\s+it)[\s-]*(?:pleuvoir|neiger|rain|snow)/i,
  // Conditions météo
  /(?:humidité|humidity|wind|vent|uv|soleil|sun|pluie|rain|neige|snow|nuage|cloud|orage|storm)/i,
  // Lever/coucher du soleil
  /(?:lever|coucher)[\s-]*(?:du\s+)?(?:soleil|sun)/i,
  /(?:sunrise|sunset)/i,
  // Questions génériques sur le temps
  /(?:donne|give|show)[\s-]*(?:moi)?[\s-]*(?:la\s+)?météo/i,
  // Canicule, alerte météo
  /(?:canicule|heat\s*wave|alerte\s+météo|weather\s+alert)/i,
];

// Patterns crypto - AMÉLIORÉS pour couvrir plus de cas
const CRYPTO_PATTERNS = [
  // Noms de cryptos
  /\b(?:bitcoin|btc|ethereum|eth|solana|sol|cardano|ada|ripple|xrp|polkadot|dot|avalanche|avax|chainlink|link|uniswap|uni|aave|polygon|matic|cosmos|atom|near|litecoin|ltc|dogecoin|doge|shiba|stablecoin|usdt|usdc|tether)\b/i,
  // Mots-clés crypto
  /\b(?:crypto|cryptomonnaie|cryptocurrency|blockchain)\b/i,
  // Prix et cours
  /(?:prix|price|cours|value|valeur)[\s-]*(?:du|de|of)?[\s-]*(?:bitcoin|btc|ethereum|eth|solana|crypto)/i,
  /(?:combien|how\s+much)[\s-]*(?:vaut|coûte|is|costs?)[\s-]*(?:le|un|a)?[\s-]*(?:bitcoin|btc|eth|ethereum|crypto)/i,
  // Market cap et performance
  /(?:market\s*cap|capitalisation)/i,
  /(?:top\s+\d+|best\s+performing|qui\s+monte|trending)[\s-]*(?:crypto|coins?)/i,
  // Comparaisons
  /(?:btc|bitcoin)[\s-]*(?:vs|versus|contre|vs\.|or)[\s-]*(?:eth|ethereum)/i,
];

// Patterns calcul
const CALCULATION_PATTERNS = [
  /(?:calcule|calculer|calculate|compute)[\s-]/i,
  /(?:combien|how much|how many)[\s-]*(?:fait|font|is|are|equals?)/i,
  /\d+[\s]*[\+\-\*\/\^][\s]*\d+/,  // Expressions mathématiques simples
];

// Patterns pour la CRÉATION de site web (PRIORITÉ HAUTE) - AMÉLIORÉS
const SITE_CREATION_PATTERNS = [
  // Français - Patterns explicites avec "site web"
  /(?:cr[ée]e|cr[ée]er|fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer|construis|construire|d[ée]veloppe|d[ée]velopper)\s*-?\s*(?:moi\s+)?(?:un[e]?\s+)?(?:site\s*web|site\s*internet|site|page\s*web|landing\s*page)/i,
  // "crée un site pour X" - pattern très commun
  /cr[ée]e[rz]?\s*-?\s*(?:moi\s+)?(?:un[e]?\s+)?site\s+(?:web\s+)?(?:pour|d'|de)/i,
  // "site pour un X" avec types de business
  /(?:un[e]?\s+)?site\s+(?:web\s+)?pour\s+(?:un[e]?\s+)?(?:h[ôo]tel|restaurant|entreprise|business|portfolio|coach|avocat|dentiste|plombier|fleuriste|architecte|musicien|photographe|boulanger|[ée]lectricien|psychologue|startup|salon|cabinet|boutique|magasin|agence|studio|gym|école|association|église|church|garage|food\s*truck|mariage|wedding|événement|event|podcast|chaîne|channel|freelancer|consultant|coach|nutritionniste|fitness|yoga|spa|bien-être|wellness)/i,
  /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu\s+)?(?:cr[ée]es?|fasses?|g[ée]n[èe]res?)\s+(?:un[e]?\s+)?(?:site|page)/i,
  /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:me\s+)?(?:cr[ée]er|faire|g[ée]n[ée]rer)\s+(?:un[e]?\s+)?(?:site|page)/i,
  // "site web" seul avec verbe d'action
  /(?:fais|faire|g[ée]n[èe]re|g[ée]n[ée]rer)\s*-?\s*(?:moi\s+)?(?:un[e]?\s+)?landing\s*page/i,
  // Anglais - AMÉLIORÉS
  /(?:create|make|build|generate|develop)\s+(?:me\s+)?(?:a\s+)?(?:website|web\s*site|web\s+page|landing\s+page|site)/i,
  /(?:can\s+you|could\s+you|please)\s+(?:create|make|build|generate)\s+(?:a\s+)?(?:website|site|page)/i,
  /(?:i\s+want|i\s+need|i'd\s+like)\s+(?:a\s+)?(?:website|site|page)\s+for/i,
  // Patterns anglais avec types de business
  /(?:build|create|make)\s+(?:a\s+)?(?:restaurant|portfolio|e-?commerce|online\s+store|blog|company|business|booking|dental|gym|nonprofit|church|law\s+firm|accounting|food\s+delivery|catering|event|conference|musician|artist|photographer|freelancer|consultant|fitness|yoga|spa)\s+(?:website|site|page)/i,
  // Allemand
  /(?:erstelle|erstellen|mache|machen|baue|bauen|generiere|generieren)\s+(?:mir\s+)?(?:eine?\s+)?(?:webseite|website|seite)/i,
  /(?:ich\s+möchte|ich\s+brauche|ich\s+will)\s+(?:eine?\s+)?(?:webseite|website|seite)\s+für/i,
  // Luxembourgeois
  /(?:maach|maachen|bau|bauen)\s+(?:mir\s+)?(?:eng?\s+)?(?:websäit|site)/i,
  // Pattern pour "site vitrine"
  /(?:site\s+vitrine|showcase\s+site|portfolio\s+site)/i,
  // Pattern pour e-commerce
  /(?:site\s+e-?commerce|online\s+store|boutique\s+en\s+ligne)/i,
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
  // Patterns pour "sur mon site", "dans mon site", "à mon site"
  /(?:sur|dans|to|in|on|à)\s+(?:mon|ma|le|la|my|the)?\s*(?:site|page|application)/i,
  // Pattern avec deux-points (ex: "Modifie mon site: change...")
  /(?:modifie|change|update|edit)\s+(?:mon|le|my)?\s*(?:site|page|app)\s*[:\-]/i,
];

// Patterns pour la CRÉATION d'APPLICATION/AGENT IA (PRIORITÉ MAXIMALE) - AMÉLIORÉS v2
const APP_CREATION_PATTERNS = [
  // Français - Création d'application/agent - patterns flexibles
  /(?:cr[éeè]e|cr[éeè]er|fais|faire|g[éeè]n[èe]re|g[éeè]n[éeè]rer|construis|construire|d[éeè]veloppe|d[éeè]velopper)[\s-]*(?:moi\s+)?(?:un[e]?\s+)?(?:vraie?\s+)?(?:application|app|agent|assistant|bot|chatbot|IA|AI)/i,
  // Pattern "crée-moi une application de chatbot" (avec tiret)
  /cr[éeè]e-moi\s+(?:un[e]?\s+)?(?:application|app)\s+(?:de\s+)?(?:chat|chatbot|discussion)/i,
  // Pattern "application de chat/chatbot"
  /(?:cr[éeè]e|cr[éeè]er|fais|faire)[\s-]*(?:moi\s+)?(?:un[e]?\s+)?(?:application|app)\s+(?:de\s+)?(?:chat|chatbot|discussion|messagerie)/i,
  /(?:cr[éeè]e|cr[éeè]er)\s+(?:moi\s+)?(?:un[e]?\s+)?(?:application|app)\s+(?:web|mobile)?\s*(?:d'|de)?\s*(?:agent|assistant|IA|AI|chat)/i,
  /(?:j'aimerais|je\s+voudrais|je\s+veux)\s+(?:que\s+tu\s+)?(?:cr[éeè]es?|fasses?|g[éeè]n[èe]res?)\s+(?:un[e]?\s+)?(?:vraie?\s+)?(?:application|app|agent|chatbot)/i,
  /(?:peux|peut|pourrais|pourrait)[-\s]*(?:tu|vous)?\s*(?:me\s+)?(?:cr[éeè]er|faire|g[éeè]n[éeè]rer)\s+(?:un[e]?\s+)?(?:vraie?\s+)?(?:application|app|agent|chatbot)/i,
  // Pattern spécifique "petite application de chatbot"
  /(?:petite?|simple)\s+(?:application|app)\s+(?:de\s+)?(?:chat|chatbot|discussion)/i,
  // Pattern "application/chatbot fonctionnel(le)"
  /(?:application|app|chatbot|agent)\s+(?:fonctionnel(?:le)?|qui\s+(?:fonctionne|marche))/i,
  // Pattern "vraie application" vs "image"
  /(?:vraie?|réelle?|fonctionnelle?)\s+(?:application|app|chatbot)/i,
  // Pattern simple "chatbot" ou "assistant" avec verbe de création
  /(?:cr[éeè]e|cr[éeè]er|fais|faire)[\s-]*(?:moi\s+)?(?:un\s+)?(?:chatbot|assistant|agent|bot)/i,
  // NOUVEAU: Patterns français simples avec "Fais-moi"
  /fais[\s-]*moi\s+(?:un[e]?\s+)?(?:dashboard|tracker|planificateur|formulaire)/i,
  // Anglais - AMÉLIORÉS v2
  /(?:create|make|build|generate|develop)\s+(?:me\s+)?(?:an?\s+)?(?:real\s+)?(?:application|app|agent|assistant|bot|chatbot|AI)/i,
  /(?:can\s+you|could\s+you|please)\s+(?:create|make|build)\s+(?:an?\s+)?(?:real\s+)?(?:application|app|agent|bot|chatbot)/i,
  /(?:i\s+want|i\s+need|i'd\s+like)\s+(?:an?\s+)?(?:real\s+)?(?:application|app|agent|assistant|chatbot)/i,
  // Pattern "working/functional app"
  /(?:working|functional|real)\s+(?:application|app|chatbot)/i,
  // NOUVEAU: Patterns anglais "Build/Create a X" pour types d'applications
  /(?:build|create)\s+(?:an?\s+)?(?:conversational\s+bot|ordering\s+system|management\s+dashboard|admin\s+panel|task\s+manager|note-?taking\s+app|scheduler|trivia\s+game|feedback\s+form)/i,
  // Patterns pour types d'applications spécifiques
  /(?:create|build|make)\s+(?:a\s+)?(?:booking|reservation|ordering|management|tracking|monitoring|note|todo|task|calendar|quiz|survey|feedback|voting)\s+(?:app|application|system)/i,
  /(?:cr[éeè]e|fais)\s+(?:un[e]?\s+)?(?:application|app)\s+(?:de\s+)?(?:réservation|commande|gestion|suivi|notes|tâches|calendrier|quiz|sondage|feedback|vote)/i,
  // Dashboard et admin panel - AMÉLIORÉS
  /(?:create|build|make|cr[éeè]e|fais)\s+(?:a\s+|an\s+|un\s+)?(?:dashboard|admin\s+panel|panneau\s+d'administration|tableau\s+de\s+bord)/i,
  /(?:build|create)\s+(?:a\s+)?(?:management\s+)?dashboard/i,
  // Customer service bot
  /(?:customer\s+service|support\s+client|FAQ|help\s+desk)\s+(?:bot|chatbot)/i,
  /(?:bot|chatbot)\s+(?:de\s+)?(?:support|service\s+client|FAQ|aide)/i,
  // Personal assistant
  /(?:personal|personnel)\s+(?:assistant|aide)/i,
  /(?:assistant|aide)\s+(?:personnel|virtuel)/i,
];

// Patterns pour détecter les demandes d'IMAGE d'application (à exclure de app_creation)
const IMAGE_OF_APP_PATTERNS = [
  /(?:image|photo|illustration|dessin|mockup|maquette)\s+(?:d'|de\s+)?(?:une?\s+)?(?:application|app|chatbot|interface)/i,
  /(?:dessine|visualise|montre)\s+(?:moi\s+)?(?:à\s+quoi\s+ressemblerait\s+)?(?:une?\s+)?(?:application|app|chatbot)/i,
  /(?:image|picture|illustration|drawing|mockup)\s+of\s+(?:an?\s+)?(?:application|app|chatbot|interface)/i,
];

// Patterns pour les transitions - AMÉLIORÉS v2
const TRANSITION_SITE_PATTERNS = [
  // "En fait, je préfère un site"
  /(?:en\s+fait|finalement|actually|finally)\s*[,]?\s*(?:je\s+)?(?:préfère|veux|voudrais|want|prefer)\s+(?:un[e]?\s+)?(?:site|website|page)/i,
  // "Finalement, un site web serait mieux"
  /(?:finalement|finally)\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)\s+(?:serait|would\s+be)\s+(?:mieux|better)/i,
  // "Laisse tomber les images, je veux un site"
  /(?:laisse\s+tomber|drop|forget)\s+(?:les?\s+)?(?:images?|photos?)\s*[,]?\s*(?:je\s+)?(?:veux|want)\s+(?:un[e]?\s+)?(?:site|website)/i,
  // "je préfère un site"
  /je\s+préfère\s+(?:un[e]?\s+)?(?:site|website|page)/i,
  // NOUVEAU: "Plus d'images, maintenant un site"
  /plus\s+d'?images?\s*[,]?\s*(?:maintenant\s+)?(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU: "Pas d'images, un site web s'il te plaît"
  /pas\s+d'?images?\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU: "No images, a website please"
  /no\s+images?\s*[,]?\s*(?:a\s+)?(?:website|site)/i,
  // NOUVEAU: "I prefer a website over an image"
  /i\s+prefer\s+(?:a\s+)?(?:website|site)\s+(?:over|to)\s+(?:an?\s+)?image/i,
  // NOUVEAU: "Je préfère un site à une image"
  /je\s+préfère\s+(?:un[e]?\s+)?(?:site|website)\s+(?:à|plutôt\s+qu')\s*(?:une?\s+)?image/i,
  // NOUVEAU: "Un site web serait plus utile"
  /(?:un[e]?\s+)?(?:site|website)\s+(?:serait|would\s+be)\s+(?:plus\s+utile|more\s+useful)/i,
  // NOUVEAU: "A website would be more useful"
  /(?:a\s+)?(?:website|site)\s+would\s+be\s+(?:more\s+useful|better)/i,
];

/**
 * Détecte l'intention principale de l'utilisateur
 * VERSION AMÉLIORÉE v3: Meilleure détection pour toutes les catégories
 */
export function detectIntent(message: string, hasFileContent: boolean = false, previousIntent?: string): DetectedIntent {
  const normalizedMessage = message.toLowerCase().trim();
  
  // PREMIÈRE ÉTAPE: Analyser les transitions (changement de demande)
  const transitionAnalysis = analyzeMessageForTransition(message, previousIntent);
  
  console.log('[IntentDetector] Transition analysis:', {
    hasTransition: transitionAnalysis.transition.hasTransition,
    transitionType: transitionAnalysis.transition.transitionType,
    negatedIntent: transitionAnalysis.transition.negatedIntent,
    isRealApp: transitionAnalysis.realVsImage.isRealApp,
    suggestedIntent: transitionAnalysis.suggestedIntent
  });
  
  // Si une transition suggère une intention spécifique, l'utiliser en priorité
  if (transitionAnalysis.shouldOverrideIntent && transitionAnalysis.suggestedIntent) {
    console.log('[IntentDetector] Transition override to:', transitionAnalysis.suggestedIntent);
    return {
      type: transitionAnalysis.suggestedIntent as IntentType,
      confidence: 0.99,
      details: {
        keywords: transitionAnalysis.transition.keywords
      }
    };
  }
  
  // NOUVEAU: Vérifier les patterns de transition vers site
  for (const pattern of TRANSITION_SITE_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] Transition site pattern matched:', pattern);
      return {
        type: 'site_creation',
        confidence: 0.98,
        details: { keywords: ['transition', 'site'] }
      };
    }
  }
  
  // Si une transition est détectée mais pas de suggestion, analyser le reste du message
  if (transitionAnalysis.transition.hasTransition) {
    // Chercher une intention dans la partie après la négation
    const hasAppKeyword = /(?:application|app|chatbot|agent|assistant|bot)/i.test(normalizedMessage);
    const hasSiteKeyword = /(?:site\s*web|site\s*internet|site|page\s*web|landing\s*page|website)/i.test(normalizedMessage);
    const hasCreateVerb = /(?:crée|créer|fais|faire|génère|générer|construis|construire|développe|développer|create|make|build)/i.test(normalizedMessage);
    const hasWantVerb = /(?:je\s+veux|je\s+voudrais|j'aimerais|i\s+want|i\s+need)/i.test(normalizedMessage);
    
    if (hasAppKeyword && (hasCreateVerb || hasWantVerb)) {
      console.log('[IntentDetector] Transition with app keyword detected');
      return {
        type: 'app_creation',
        confidence: 0.95,
        details: { keywords: transitionAnalysis.transition.keywords }
      };
    }
    if (hasSiteKeyword && (hasCreateVerb || hasWantVerb)) {
      console.log('[IntentDetector] Transition with site keyword detected');
      return {
        type: 'site_creation',
        confidence: 0.95,
        details: { keywords: transitionAnalysis.transition.keywords }
      };
    }
  }
  
  // Si un fichier est uploadé, c'est probablement une analyse
  if (hasFileContent) {
    return {
      type: 'file_analysis',
      confidence: 0.9,
      details: { keywords: ['file', 'analysis'] }
    };
  }
  
  // PRIORITÉ MAXIMALE: Vérifier si c'est une IMAGE d'application (à exclure de app_creation)
  for (const pattern of IMAGE_OF_APP_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      console.log('[IntentDetector] Image of app detected (not a real app)');
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
  // MAIS exclure les mots-clés de site/app
  const hasSiteAppKeyword = /(?:site|website|page|application|app)/i.test(normalizedMessage);
  const browseKeywords = /(?:va\s+sur|vas\s+sur|aller\s+sur|visite|visiter|ouvre|ouvrir|navigue|naviguer|go\s+to|visit|open|navigate|browse|\.com|\.fr|\.org|\.net|\.io)/i;
  const isBrowseRequest = browseKeywords.test(normalizedMessage) && !hasSiteAppKeyword;
  
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
  const dataKeywords = /(?:table|tableau|données|data|analyse|analysis|prix|price|api|statistiques|stats|graphique|chart|rapport|report|expert|avis|contenu|content)/i;
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
 * Extrait les mots-clés pertinents du message
 */
function extractKeywords(message: string, pattern: RegExp): string[] {
  const match = message.match(pattern);
  if (match) {
    return match[0].split(/\s+/).filter(word => word.length > 2);
  }
  return [];
}

/**
 * Extrait le prompt pour la génération d'image
 */
function extractImagePrompt(message: string): string {
  // Supprimer les mots-clés de commande
  let prompt = message
    .replace(/(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire)[\s-]*(?:moi)?[\s-]*(?:une?|l')?[\s-]*(?:image|photo|illustration|dessin|visuel|artwork|art)?[\s-]*(?:de|d'|du|des|avec|représentant|montrant)?/gi, '')
    .replace(/(?:generate|create|make|draw|produce)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:image|photo|picture|illustration|drawing|visual|artwork)?[\s-]*(?:of|with|showing|depicting)?/gi, '')
    .trim();
  
  return prompt || message;
}

/**
 * Vérifie si le message est une simple salutation
 */
export function isSimpleGreeting(message: string): boolean {
  const greetings = /^(?:salut|bonjour|bonsoir|coucou|hello|hi|hey|yo|ça va|comment vas-tu|comment tu vas|how are you|what's up|sup)[\s!?]*$/i;
  return greetings.test(message.trim());
}

/**
 * Vérifie si le message est une simple confirmation
 */
export function isSimpleConfirmation(message: string): boolean {
  const confirmations = /^(?:oui|non|ok|okay|d'accord|parfait|super|merci|thanks|yes|no|sure|great|perfect|bien|cool|nice|awesome)[\s!?]*$/i;
  return confirmations.test(message.trim());
}

export default {
  detectIntent,
  isSimpleGreeting,
  isSimpleConfirmation
};


/**
 * Génère un prompt système adapté à l'intention détectée
 */
export function generateSystemPromptForIntent(intent: DetectedIntent): string {
  const basePrompt = `Tu es Phoenix, un assistant IA intelligent et polyvalent créé par Manus. Tu peux:
- Avoir des conversations naturelles et engageantes
- Créer des sites web professionnels
- Créer des applications et chatbots fonctionnels
- Générer des images
- Exécuter du code Python
- Rechercher des informations sur le web
- Donner la météo et les prix des cryptomonnaies

Réponds toujours dans la langue de l'utilisateur. Sois concis mais complet.`;

  switch (intent.type) {
    case 'site_creation':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut créer un site web.
Tu dois créer un site web HTML/CSS complet et professionnel.
Inclus un design moderne, responsive et attrayant.
Utilise des couleurs harmonieuses et une typographie soignée.`;

    case 'app_creation':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut créer une application ou un chatbot.
Tu dois créer une application web fonctionnelle avec interface utilisateur.
Inclus un design moderne et une expérience utilisateur intuitive.`;

    case 'image_generation':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut générer une image.
Tu vas utiliser l'outil de génération d'images pour créer l'image demandée.
Décris ce que tu vas générer avant de le faire.`;

    case 'code_execution':
    case 'code_request':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut exécuter ou voir du code.
Tu vas écrire et/ou exécuter du code Python.
Explique ce que fait le code et montre les résultats.`;

    case 'weather':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut connaître la météo.
Tu vas utiliser l'API météo pour obtenir les informations demandées.
Présente les données de manière claire et lisible.`;

    case 'crypto':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut connaître les prix des cryptomonnaies.
Tu vas utiliser l'API crypto pour obtenir les prix actuels.
Présente les données de manière claire avec les variations.`;

    case 'web_search':
    case 'web_browse':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut des informations du web.
Tu vas effectuer une recherche web pour trouver les informations demandées.
Présente les résultats de manière synthétique et sourcée.`;

    case 'file_analysis':
      return `${basePrompt}

CONTEXTE: L'utilisateur a uploadé un fichier à analyser.
Analyse le contenu du fichier et fournis une réponse pertinente.`;

    case 'site_modification':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut modifier un site web existant.
Tu vas modifier le site selon les instructions données.
Confirme les changements effectués.`;

    case 'calculation':
      return `${basePrompt}

CONTEXTE: L'utilisateur veut effectuer un calcul.
Effectue le calcul demandé et explique le résultat.`;

    case 'conversation':
    default:
      return `${basePrompt}

CONTEXTE: Conversation générale.
Réponds de manière naturelle et engageante.
Sois utile et informatif.`;
  }
}
