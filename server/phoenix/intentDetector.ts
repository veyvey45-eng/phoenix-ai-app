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
  // Français - patterns avec langages de programmation (PRIORITÉ HAUTE)
  /(?:écris|écrire|crée|créer|génère|générer|fais|faire|donne|donner)[\s-]*(?:moi)?[\s-]*(?:un|une|le|la|du)?[\s-]*(?:code|script|fonction|classe|algorithme)/i,
  /(?:code|script)[\s-]*(?:pour|qui|en)/i,
  /(?:en|avec)[\s-]*(?:python|javascript|typescript|java|c\+\+|rust|go|php|ruby|swift)/i,
  /(?:montre|montrer)[\s-]*(?:moi)?[\s-]*(?:comment|le)[\s-]*(?:coder|programmer|écrire)/i,
  // NOUVEAU v3: Patterns avec langage explicite
  /\b(?:python|javascript|typescript|java|c\+\+|rust|go|php|ruby|swift|bash|sql)\s+(?:code|script|function|classe)/i,
  /\b(?:code|script)\s+(?:python|javascript|typescript|java|c\+\+|rust|go|php|ruby|swift|bash|sql)/i,
  // Anglais - patterns avec langages de programmation
  /(?:write|create|generate|make|give|show)[\s-]*(?:me)?[\s-]*(?:a|an|the|some)?[\s-]*(?:code|script|function|class|algorithm)/i,
  /(?:code|script)[\s-]*(?:for|that|to|in)/i,
  /(?:how to|how do i)[\s-]*(?:code|program|write)/i,
  // NOUVEAU v3: Patterns "programme un algorithme" vs "programme/application"
  /(?:programme|program)\s+(?:un|une|a|an)?\s*(?:algorithme|algorithm|fonction|function)/i,
  // NOUVEAU v3: "code une classe" pattern
  /\b(?:code)[\s-]*(?:une?|a|an)?[\s-]*(?:classe|class|fonction|function|méthode|method)/i,
  // NOUVEAU v3: Patterns anglais simples avec "code"
  /\b(?:write|make)\s+(?:python|javascript|js|typescript|ts)\s+(?:code|script)/i,
  /\b(?:write|make)\s+(?:a|some)?\s*(?:code|script)\s+(?:in|with|using)\s+(?:python|javascript|js)/i,
];

// Patterns pour détecter les demandes d'EXÉCUTION de code - AMÉLIORÉS v4
const CODE_EXECUTION_PATTERNS = [
  // NOUVEAU v4: Patterns simples et directs
  /\b(?:exécute|lance|run|execute)\b/i,
  /\b(?:teste|test)\s+(?:ce|le|this|the)?\s*(?:code|script)?\b/i,
  // NOUVEAU v4: Débogage (détection large)
  /\b(?:debug|débugue|débogue|fix|fixe|corrige|répare)\b/i,
  /\b(?:bug|erreur|error)\s+(?:dans|in|with)\b/i,
  // NOUVEAU v4: Calculs mathématiques (détection large)
  /\b(?:calcule|calculate|compute|compte|count)\b/i,
  /\b(?:additionne|add|soustrait|subtract|multiplie|multiply|divise|divide)\b/i,
  /\b(?:combien\s+fait|what\s+is|what's)\s+\d+/i,
  /\d+\s*[\+\-\*\/\^]\s*\d+/,
  // NOUVEAU v4: Opérations sur listes
  /\b(?:trie|sort|ordonne|order)\b/i,
  /\b(?:inverse|reverse|retourne)\b/i,
  /\b(?:filtre|filter)\b/i,
  /\b(?:maximum|minimum|max|min|plus\s+grand|plus\s+petit)\b/i,
  // NOUVEAU v4: Conversions
  /\b(?:convertis|convert|transforme|transform)\b/i,
  /\b(?:celsius|fahrenheit|kelvin|km|miles|kg|pounds)\b/i,
  /\b(?:base64|hexadécimal|hex|binaire|binary)\b/i,
  // NOUVEAU v4: Génération
  /\b(?:génère|generate)\s+(?:un|a)?\s*(?:mot\s+de\s+passe|password|uuid|nombre\s+aléatoire|random)\b/i,
  /\b(?:parse|stringify|encode|decode|hash|encrypt|decrypt)\b/i,
  // NOUVEAU v4: Mathématiques avancées
  /\b(?:factorielle|factorial|fibonacci|suite|séquence)\b/i,
  /\b(?:aire|area|périmètre|perimeter|volume|surface|rayon|radius)\b/i,
  /\b(?:cercle|circle|carré|square|rectangle|triangle|sphère|sphere)\b/i,
  /\b(?:résous|solve)\s+(?:cette|ce|this)?\s*(?:équation|equation)?\b/i,
  /\b(?:nombres?\s+premiers?|prime\s+numbers?)\b/i,
  /\b(?:diviseurs?|divisors?|facteurs?|factors?|multiples?)\b/i,
  /\b(?:pgcd|ppcm|gcd|lcm|modulo|mod)\b/i,
  // NOUVEAU v4: Vérifications
  /\b(?:vérifie|check|valide|validate)\b/i,
  /\b(?:palindrome|anagramme|anagram|premier|prime)\b/i,
  // NOUVEAU v4: Manipulation de texte
  /\b(?:voyelles|consonnes|vowels|consonants|mots|words|caractères|characters)\b/i,
  /\b(?:majuscule|minuscule|uppercase|lowercase|capitalize)\b/i,
  /\b(?:remplace|replace|substitue|substitute)\b/i,
  // Code inline
  /print\s*\(/i,
  /console\.log/i,
  /\[\d+(?:,\s*\d+)*\]/i,
  /def\s+\w+\s*\(/i,
  /function\s+\w+\s*\(/i,
];

// Patterns pour détecter les demandes de génération d'IMAGE - AMÉLIORÉS v6
// IMPORTANT: Ces patterns ne doivent PAS matcher les demandes d'applications, météo, sites
const IMAGE_GENERATION_PATTERNS = [
  // NOUVEAU v6: Patterns explicites avec "image/photo/illustration"
  /\b(?:image|photo|illustration|dessin|picture|drawing|artwork)\s+(?:de|d'|of|du|des|style|avec)\b/i,
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?|the)?\s*(?:image|photo|illustration|dessin|picture|drawing|artwork|visuel)\b/i,
  // NOUVEAU v6: Styles artistiques (détection large)
  /\b(?:style|art)\s+(?:impressionniste|vintage|minimaliste|manga|cyberpunk|aquarelle|réaliste|abstrait|pop\s*art|art\s*déco|rétro|fantaisie|fantasy|sci-fi|steampunk|pixel|8-?bit|low-?poly|3d|cartoon|anime|chibi)/i,
  /\b(?:impressionist|vintage|minimalist|manga|cyberpunk|watercolor|realistic|abstract|pop\s*art|art\s*deco|retro|fantasy|sci-fi|steampunk|pixel|8-?bit|low-?poly|3d|cartoon|anime|chibi)\s+(?:style|image|photo|art|drawing)/i,
  // NOUVEAU v6: Créatures et personnages fantastiques (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:dragon|licorne|unicorn|fée|fairy|sorcier|wizard|chevalier|knight|guerrier|warrior|robot|vaisseau|spaceship|alien|sirène|mermaid|phoenix|griffon|griffin|centaure|centaur|elfe|elf|nain|dwarf|orc|gobelin|goblin|troll|démon|demon|ange|angel|vampire|loup-garou|werewolf|zombie)\b/i,
  // NOUVEAU v6: Animaux (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:chat|chien|cat|dog|lion|tigre|tiger|éléphant|elephant|cheval|horse|oiseau|bird|aigle|eagle|hibou|owl|papillon|butterfly|poisson|fish|dauphin|dolphin|baleine|whale|serpent|snake|tortue|turtle|lapin|rabbit|renard|fox|loup|wolf|ours|bear|panda|singe|monkey|girafe|giraffe|zèbre|zebra)\b/i,
  // NOUVEAU v6: Paysages et scènes (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:paysage|landscape|forêt|forest|montagne|mountain|océan|ocean|plage|beach|désert|desert|jungle|espace|space|planète|planet|galaxie|galaxy|ville|city|château|castle|temple|cathédrale|cathedral|pont|bridge|tour|tower|gratte-ciel|skyscraper|coucher\s+de\s+soleil|sunset|lever\s+de\s+soleil|sunrise|aurore\s+boréale|northern\s+lights|arc-en-ciel|rainbow)\b/i,
  // NOUVEAU v6: Objets et véhicules (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:voiture|car|avion|plane|bateau|boat|moto|motorcycle|vélo|bicycle|train|hélicoptère|helicopter|fusée|rocket|maison|house|appartement|apartment|meuble|furniture|fleur|flower|arbre|tree|fruit|légume|vegetable|épée|sword|bouclier|shield|armure|armor|couronne|crown)\b/i,
  // NOUVEAU v6: Portraits et personnes (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:portrait|visage|face|personnage|character|personne|person|homme|man|femme|woman|enfant|child|bébé|baby|vieillard|old\s+man|prince|princesse|princess|roi|king|reine|queen|pirate|ninja|samouraï|samurai|cowboy|astronaute|astronaut|super-héros|superhero)\b/i,
  // NOUVEAU v6: Nourriture (détection implicite)
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:gâteau|cake|pizza|hamburger|burger|sushi|glace|ice\s+cream|chocolat|chocolate|bonbon|candy|croissant|baguette|fromage|cheese|vin|wine|café|coffee|thé|tea)\b/i,
  // NOUVEAU v6: Art abstrait et concepts
  /\b(?:génère|crée|fais|generate|create|make|draw)\s+(?:moi\s+)?(?:une?|an?)?\s*(?:abstrait|abstract|géométrique|geometric|fractal|mandala|motif|pattern|texture|fond|background|wallpaper|bannière|banner|affiche|poster|logo|icône|icon)\b/i,
  // Patterns français avec "image" explicite (PRIORITÉ HAUTE)
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire)[\s-]*(?:moi)?[\s-]*(?:une|un|l')?[\s-]*(?:image|photo|illustration|dessin|visuel|artwork|art)(?!.*(?:application|app|chatbot|site))/i,
  /(?:image|photo|illustration|dessin)[\s-]*(?:de|d'|du|des|avec|représentant|montrant)(?!.*(?:application|app|chatbot|site))/i,
  // Patterns anglais avec "image/picture" explicite
  /(?:generate|create|make|draw|produce)[\s-]*(?:me)?[\s-]*(?:an?|the)?[\s-]*(?:image|photo|picture|illustration|drawing|visual|artwork)(?!.*(?:application|app|chatbot|site))/i,
  /(?:image|photo|picture)[\s-]*(?:of|with|showing|depicting)(?!.*(?:application|app|chatbot|site))/i,
  // Patterns "dessine-moi" / "draw me" / "fais un dessin" (détection large)
  /dessine[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*\w+/i,
  /draw[\s-]*(?:me)?[\s-]*(?:an?)?[\s-]*\w+/i,
  /fais[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:dessin|illustration|croquis|esquisse)/i,
  /\b(?:dessin|illustration)\s+(?:de|d')\s*\w+/i,
  // NOUVEAU: Pattern pour "fais un dessin de X" avec animaux/objets
  /\b(?:fais|crée|génère|make|create|generate)\s+(?:moi\s+)?(?:une?)?\s*(?:dessin|illustration)\s+(?:de|d')\s*(?:papillon|butterfly|chat|chien|cat|dog|lion|dragon|licorne|unicorn|paysage|landscape|portrait|maison|house|voiture|car|robot|château|castle|forêt|forest|montagne|mountain|oiseau|bird|fleur|flower|arbre|tree|soleil|sun|lune|moon|\w+)/i,
  // Patterns pour styles artistiques
  /(?:génère|crée|fais|generate|create|make)[\s-]*(?:moi)?[\s-]*(?:un|une|an?)?[\s-]*(?:style|art|oeuvre|artwork|painting|peinture|tableau)[\s-]*(?:de|d'|of|in)?/i,
];

// Patterns pour détecter les besoins de recherche web - AMÉLIORÉS v4
const WEB_SEARCH_PATTERNS = [
  // NOUVEAU v4: Patterns simples et directs pour recherche
  /\b(?:cherche|recherche|trouve|search|find|look\s+up)\b/i,
  /\b(?:google|googler|bing)\b/i,
  // NOUVEAU v4: Questions "qu'est-ce que" / "c'est quoi"
  /\b(?:qu'?est[- ]ce\s+que|c'?est\s+quoi|what\s+is|what\s+are|what's)\b/i,
  /\b(?:qui\s+est|who\s+is|who\s+are|c'?est\s+qui)\b/i,
  /\b(?:comment\s+faire|how\s+to|how\s+do\s+(?:i|you))\b/i,
  /\b(?:pourquoi|why\s+is|why\s+are|why\s+do)\b/i,
  /\b(?:quand|when\s+is|when\s+was|when\s+did)\b/i,
  /\b(?:où\s+est|where\s+is|where\s+are|where\s+can)\b/i,
  // NOUVEAU v4: Actualités et informations
  /\b(?:actualités?|news|nouvelles|dernières\s+(?:nouvelles|infos))\b/i,
  /\b(?:informations?|infos?)\s+(?:sur|about|on)\b/i,
  /\b(?:en\s+savoir\s+plus|learn\s+more|tell\s+me\s+about)\b/i,
  // NOUVEAU v4: Recherche de définitions
  /\b(?:définition|definition|signification|meaning)\s+(?:de|of)?\b/i,
  /\b(?:explique|explain)\s+(?:moi)?\s*(?:ce\s+qu'?est|what\s+is)\b/i,
  // NOUVEAU v4: Recherche de comparaisons
  /\b(?:différence|difference)\s+(?:entre|between)\b/i,
  /\b(?:compare|comparer|vs|versus)\b/i,
  // NOUVEAU v4: Recherche de listes/tops
  /\b(?:meilleurs?|best|top\s+\d+|liste\s+(?:des?|of))\b/i,
  /\b(?:recommandations?|recommendations?)\s+(?:de|for|pour)\b/i,
  // Recherche explicite
  /(?:cherche|recherche|trouve|trouver)[\s-]+(?:sur|dans|on|in)?[\s-]*(?:internet|le\s+web|google|the\s+web)/i,
  /(?:actualité|actualités|news|nouvelles|dernières)[\s-]+(?:sur|about|on|de)/i,
  /(?:information|infos?)[\s-]+(?:récentes?|actuelles?|en\s+ligne|online)/i,
  // Questions factuelles FR
  /\b(?:qui\s+est|c'?est\s+qui)\s+[A-ZÀ-Ü][a-zà-ü]+/i,
  /\b(?:qu'?est[- ]ce\s+que|what\s+is)\s+(?:le|la|l'|the|a|an)?\s*[A-ZÀ-Ü]/i,
  /\b(?:quand|when)\s+(?:a\s+[eé]t[eé]|est|was|is)\s+(?:fond[eé]|cr[eé][eé]|founded|created)/i,
  // Questions factuelles EN
  /\b(?:who\s+is|who\s+are)\s+(?:the)?\s*[A-Z]/i,
  /\b(?:when\s+was|when\s+were)\s+[A-Z]/i,
  /\b(?:where\s+is|where\s+are)\s+[A-Z]/i,
  // Recherche Google explicite
  /\b(?:google|bing|recherche\s+sur|search\s+for|look\s+up)\b/i,
  // Questions sur des personnes/entreprises
  /\b(?:qui\s+est|who\s+is)\s+(?:le|la|the)?\s*(?:pr[eé]sident|CEO|fondateur|founder|directeur|director)\b/i,
];

// Patterns pour les demandes conversationnelles simples (PAS de recherche web)
const CONVERSATIONAL_PATTERNS = [
  // Salutations
  /^(?:salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/i,
  /^(?:ça va|comment vas-tu|comment tu vas|how are you)/i,
  
  // Demandes créatives textuelles (EXCLURE dessin/illustration qui sont des images)
  /(?:raconte|raconter|dis|dire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|conte|poème|joke)/i,
  /(?:écris|écrire|rédige|rédiger)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:poème|histoire|texte|lettre|email|mail|article)/i,
  /(?:fais|faire)[\s-]*(?:moi)?[\s-]*(?:une|un)?[\s-]*(?:blague|histoire|poème)(?![\s-]*(?:dessin|illustration))/i,
  
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

// Patterns météo - AMÉLIORÉS v2 pour éviter les faux positifs avec images
const WEATHER_PATTERNS = [
  // Mots-clés directs (SANS sunrise/sunset qui sont souvent des images)
  /\b(?:météo|meteo|weather)\b/i,
  /\b(?:température|temperature)\s+(?:à|in|at|de|of|today|demain|tomorrow)?/i,
  // Questions sur le temps
  /(?:quel|quelle|what|what's)[\s-]*(?:temps|weather)/i,
  /(?:il\s+fait|fait[\s-]il|is\s+it)[\s-]*(?:quel\s+temps|chaud|froid|beau|hot|cold|nice|warm|cool)/i,
  // Prévisions
  /(?:prévisions?|forecast|prévision)/i,
  /(?:va[\s-]t[\s-]il|will\s+it)[\s-]*(?:pleuvoir|neiger|rain|snow)/i,
  // Conditions météo (SANS soleil/sun qui peuvent être des images)
  /(?:humidité|humidity|wind|vent|uv|pluie|rain|neige|snow|nuage|cloud|orage|storm)/i,
  // Lever/coucher du soleil SEULEMENT avec contexte météo
  /(?:heure\s+(?:du\s+)?(?:lever|coucher)|what\s+time\s+(?:is\s+)?(?:sunrise|sunset))/i,
  /(?:météo|weather).*(?:sunrise|sunset|lever|coucher)/i,
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

// Patterns pour la CRÉATION de site web (PRIORITÉ HAUTE) - AMÉLIORÉS v3
const SITE_CREATION_PATTERNS = [
  // NOUVEAU v3: Patterns simples et directs
  /\b(?:site\s*web|website|web\s*site)\b/i,  // Tout message contenant "site web" ou "website"
  /\b(?:landing\s*page|page\s*d'atterrissage)\b/i,  // Landing page
  /\b(?:page\s*web|web\s*page)\b/i,  // Page web
  /\b(?:site\s*vitrine|showcase\s*site)\b/i,  // Site vitrine
  /\b(?:site\s*e-?commerce|e-?commerce\s*site|online\s*store|boutique\s*en\s*ligne)\b/i,  // E-commerce
  /\b(?:portfolio\s*(?:website|site)?|site\s*portfolio)\b/i,  // Portfolio
  // NOUVEAU v3: Patterns avec "site" seul + contexte
  /\b(?:un|une|a|an)\s+site\b/i,  // "un site", "a site"
  /\bsite\s+(?:pour|for|de|d')\b/i,  // "site pour", "site for"
  /\b(?:je\s+veux|i\s+want|i\s+need)\s+(?:un\s+)?site\b/i,  // "je veux un site"
  // NOUVEAU v3: Patterns anglais simples
  /\b(?:website|site)\s+(?:please|svp|s'il\s+(?:te|vous)\s+pla[iî]t)\b/i,  // "website please"
  /\b(?:need|want)\s+(?:a\s+)?(?:website|site)\b/i,  // "need a website"
  // NOUVEAU v3: Types de sites spécifiques
  /\b(?:blog|blogue)\s*(?:site|website)?\b/i,  // Blog
  /\b(?:corporate|company|business)\s+(?:website|site)\b/i,  // Corporate site
  /\b(?:personal|personnel)\s+(?:website|site)\b/i,  // Personal site
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

// Patterns pour la CRÉATION d'APPLICATION/AGENT IA (PRIORITÉ MAXIMALE) - AMÉLIORÉS v5
// Équilibre entre détection large et évitement des faux positifs
const APP_CREATION_PATTERNS = [
  // Mots-clés d'application (détection large mais avec contexte)
  /\b(?:application|app)\b(?!.*(?:image|photo|illustration|dessin|picture))/i,
  /\b(?:chatbot|chat\s*bot)\b/i,
  /\b(?:dashboard|tableau\s*de\s*bord)\b/i,
  /\b(?:admin\s*panel|panneau\s*d'?administration)\b/i,
  /\b(?:agent\s*(?:IA|AI|virtuel|intelligent))\b/i,
  /\b(?:assistant\s*(?:virtuel|intelligent|IA|AI))\b/i,
  /\b(?:logiciel|software)\b/i,
  // Systèmes et outils
  /\b(?:syst[eè]me|system)\s+(?:de|of|pour|for)\b/i,
  /\b(?:outil|tool)\s+(?:de|of|pour|for)\b/i,
  /\b(?:bot|robot)\s+(?:de|for|pour)\b/i,
  // Acronymes business
  /\b(?:CRM|ERP|SaaS)\b/i,
  // Systèmes spécifiques
  /\b(?:booking|r[eé]servation)\s+(?:system|syst[eè]me)\b/i,
  /\b(?:ordering|commande)\s+(?:system|syst[eè]me)\b/i,
  /\b(?:inventory|inventaire|stock)\s+(?:management|gestion)\b/i,
  // Applications de productivité
  /\b(?:todo|to-do|task\s*list|liste\s*de\s*t[aâ]ches)\b/i,
  /\b(?:tracker|suivi|tracking)\b/i,
  /\b(?:planificateur|planner|scheduler)\b/i,
  /\b(?:gestionnaire|manager)\s+(?:de|of)\b/i,
  // Quiz et sondages
  /\b(?:quiz|questionnaire|survey|sondage)\b/i,
  /\b(?:feedback|avis|review)\s+(?:system|form|syst[eè]me|formulaire)\b/i,
  /\b(?:voting|vote)\s+(?:system|app|syst[eè]me)\b/i,
  // Monitoring et analytics
  /\b(?:monitoring|surveillance)\s+(?:dashboard|tool|outil)\b/i,
  /\b(?:analytics|statistiques)\s+(?:dashboard|tool|outil)\b/i,
  // Note taking et calendar
  /\b(?:note-?taking|prise\s*de\s*notes)\b/i,
  /\b(?:calendar|calendrier)\s+(?:app|application)?\b/i,
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

// Patterns pour les transitions - AMÉLIORÉS v3
const TRANSITION_SITE_PATTERNS = [
  // "En fait, je préfère un site"
  /(?:en\s+fait|finalement|actually|finally)\s*[,]?\s*(?:je\s+)?(?:préfère|veux|voudrais|want|prefer)\s+(?:un[e]?\s+)?(?:site|website|page)/i,
  // "Finalement, un site web serait mieux"
  /(?:finalement|finally)\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)\s+(?:serait|would\s+be)\s+(?:mieux|better)/i,
  // "Laisse tomber les images, je veux un site"
  /(?:laisse\s+tomber|drop|forget)\s+(?:les?\s+)?(?:images?|photos?)\s*[,]?\s*(?:je\s+)?(?:veux|want)\s+(?:un[e]?\s+)?(?:site|website)/i,
  // "je préfère un site"
  /je\s+préfère\s+(?:un[e]?\s+)?(?:site|website|page)/i,
  // NOUVEAU v3: "Non pas ça, un site"
  /(?:non|no)\s+(?:pas\s+)?(?:ça|that|this)\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU v3: "Plutôt un site"
  /(?:plutôt|rather|instead)\s+(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU v3: "Change pour un site"
  /(?:change|switch|passe)\s+(?:pour|to|vers)\s+(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU v3: "à la place, un site"
  /(?:à\s+la\s+place|instead)\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)/i,
  // NOUVEAU v3: "No, a website instead"
  /(?:no|non)\s*[,]?\s*(?:a\s+)?(?:website|site)\s+(?:instead|plutôt)/i,
  // NOUVEAU v3: "Actually I want a website"
  /(?:actually|en\s+fait)\s+(?:i\s+want|je\s+veux)\s+(?:a\s+)?(?:website|site)/i,
  // Plus d'images, maintenant un site
  /plus\s+d'?images?\s*[,]?\s*(?:maintenant\s+)?(?:un[e]?\s+)?(?:site|website)/i,
  // Pas d'images, un site web s'il te plaît
  /pas\s+d'?images?\s*[,]?\s*(?:un[e]?\s+)?(?:site|website)/i,
  // No images, a website please
  /no\s+images?\s*[,]?\s*(?:a\s+)?(?:website|site)/i,
  // I prefer a website over an image
  /i\s+prefer\s+(?:a\s+)?(?:website|site)\s+(?:over|to)\s+(?:an?\s+)?image/i,
  // Je préfère un site à une image
  /je\s+préfère\s+(?:un[e]?\s+)?(?:site|website)\s+(?:à|plutôt\s+qu')\s*(?:une?\s+)?image/i,
  // Un site web serait plus utile
  /(?:un[e]?\s+)?(?:site|website)\s+(?:serait|would\s+be)\s+(?:plus\s+utile|more\s+useful)/i,
  // A website would be more useful
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
  
  // PRIORITÉ 0: Vérifier les demandes explicites de CODE (AVANT app_creation)
  // Ceci évite que "programme un algorithme" soit détecté comme app_creation
  for (const pattern of CODE_REQUEST_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      const language = detectProgrammingLanguage(normalizedMessage);
      console.log('[IntentDetector] Code request detected with pattern:', pattern);
      return {
        type: 'code_request',
        confidence: 0.96,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern),
          language 
        }
      };
    }
  }
  
  // PRIORITÉ 1: Vérifier les demandes de CRÉATION d'APPLICATION/AGENT IA
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
  
  // PRIORITÉ 2: Vérifier les demandes de MODIFICATION de site existant
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
  
  // PRIORITÉ 3: Vérifier les demandes de CRÉATION de site web
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
  
  // SUPPRIMÉ: Vérification dupliquée de code_request (déjà fait en priorité 0)
  // Vérifier les demandes d'exécution de code
  for (const pattern of CODE_EXECUTION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        type: 'code_execution',
        confidence: 0.95,
        details: { 
          keywords: extractKeywords(normalizedMessage, pattern)
        }
      };
    }
  }
  
  // PRIORITÉ 4: Vérifier les demandes crypto (avant images)
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
  const dataKeywords = /\b(?:table|tableau|données|data|analyse|analysis|prix|price|\bapi\b|statistiques|stats|graphique|chart|rapport|report|expert|avis|contenu|content)\b/i;
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
  // MAIS exclure les demandes d'images (dessin, illustration)
  const isImageRequest = /(?:dessin|illustration|croquis|esquisse)\s+(?:de|d')/i.test(normalizedMessage);
  
  if (!isImageRequest) {
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
