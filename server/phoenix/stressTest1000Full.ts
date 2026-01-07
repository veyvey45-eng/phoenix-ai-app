/**
 * STRESS TEST 1000 QUESTIONS - Test complet de Phoenix
 * Teste toutes les catégories avec des variations réalistes
 */

import { detectIntent, IntentType } from './intentDetector';

interface TestCase {
  question: string;
  expectedIntent: IntentType;
  category: string;
}

// ============================================
// GÉNÉRATION DE 1000 QUESTIONS DE TEST
// ============================================

const TEST_QUESTIONS: TestCase[] = [];

// ============================================
// CONVERSATION (150 questions)
// ============================================
const CONVERSATION_QUESTIONS = [
  // Salutations FR (30)
  "Salut", "Bonjour", "Bonsoir", "Coucou", "Hey", "Hello", "Hi",
  "Salut Phoenix", "Bonjour Phoenix", "Hello Phoenix",
  "Salut, comment ça va?", "Bonjour, comment vas-tu?",
  "Coucou, ça va?", "Hey, quoi de neuf?",
  "Salut! Tu vas bien?", "Bonjour! Comment tu te sens?",
  "Hello! How are you?", "Hi there!", "Hey buddy!",
  "Salut mon ami", "Bonjour mon pote", "Coucou toi",
  "Re", "Re-bonjour", "Re-salut", "Yo", "Wesh",
  "Bonne journée", "Bonne soirée", "Bonne nuit",
  // Salutations EN (20)
  "Good morning", "Good afternoon", "Good evening",
  "What's up?", "How's it going?", "How are you doing?",
  "Nice to meet you", "Pleased to meet you",
  "Hey there", "Hi Phoenix", "Hello AI",
  "Greetings", "Howdy", "Sup", "Yo what's up",
  "Morning!", "Evening!", "Night!",
  "Hey, how's your day?", "Hi, what's new?",
  // Confirmations et réponses (30)
  "Oui", "Non", "Peut-être", "D'accord", "OK", "Okay",
  "Yes", "No", "Maybe", "Sure", "Of course", "Absolutely",
  "Bien sûr", "Évidemment", "Certainement", "Parfait",
  "C'est bon", "Ça marche", "Entendu", "Compris",
  "Merci", "Merci beaucoup", "Thanks", "Thank you",
  "S'il te plaît", "Please", "Svp",
  "Je comprends", "Je vois", "Ah d'accord", "Ah ok",
  // Questions personnelles (30)
  "Comment tu t'appelles?", "Qui es-tu?", "Tu es qui?",
  "What's your name?", "Who are you?", "What are you?",
  "Tu peux faire quoi?", "Qu'est-ce que tu sais faire?",
  "What can you do?", "What are your capabilities?",
  "Tu es intelligent?", "Tu comprends tout?",
  "Are you smart?", "Do you understand everything?",
  "Tu as des émotions?", "Tu ressens des choses?",
  "Do you have feelings?", "Can you feel emotions?",
  "Tu es une IA?", "Tu es un robot?", "Tu es humain?",
  "Are you an AI?", "Are you a robot?", "Are you human?",
  "Parle-moi de toi", "Tell me about yourself",
  "Tu aimes quoi?", "What do you like?",
  "Tu as quel âge?", "How old are you?",
  // Demandes créatives textuelles (40)
  "Raconte-moi une blague", "Dis-moi une blague",
  "Tell me a joke", "Make me laugh",
  "Raconte-moi une histoire", "Invente une histoire",
  "Tell me a story", "Create a story",
  "Écris-moi un poème", "Fais-moi un poème",
  "Write me a poem", "Create a poem",
  "Traduis ça en anglais", "Translate this to French",
  "Résume ce texte", "Summarize this",
  "Explique-moi la relativité", "Explain quantum physics",
  "Donne-moi des conseils", "Give me advice",
  "Aide-moi à écrire un email", "Help me write a letter",
  "Corrige mon texte", "Fix my grammar",
  "Reformule cette phrase", "Rephrase this sentence",
  "Simplifie ce concept", "Make this simpler",
  "Développe cette idée", "Expand on this idea",
  "Donne-moi des synonymes", "Give me synonyms",
  "Qu'est-ce que ça veut dire?", "What does this mean?",
  "Définis ce mot", "Define this word",
  "Compare ces deux choses", "Compare these two things",
  "Analyse ce texte", "Analyze this text",
];

CONVERSATION_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'conversation', category: 'conversation' });
});

// ============================================
// SITE WEB (120 questions)
// ============================================
const SITE_QUESTIONS = [
  // Création simple FR (30)
  "Crée-moi un site web", "Fais-moi un site internet",
  "Je veux un site web", "Génère un site pour moi",
  "Construis-moi un site", "Développe un site web",
  "Crée un site vitrine", "Fais un site e-commerce",
  "Je voudrais un site web", "Peux-tu créer un site?",
  "Crée un site pour mon entreprise", "Fais un site pour mon restaurant",
  "Site web pour un hôtel", "Site pour un photographe",
  "Landing page pour ma startup", "Page web pour mon portfolio",
  "Site internet professionnel", "Site web moderne",
  "Crée-moi une page web", "Fais-moi une landing page",
  "Un site web svp", "Site pour mon business",
  "Site vitrine", "Landing page", "Page web",
  "Boutique en ligne", "Site e-commerce", "Online store",
  "Portfolio website", "Blog site", "Site blog",
  // Création simple EN (30)
  "Create a website for me", "Make me a website",
  "Build a website", "I want a website",
  "Generate a website", "Develop a website for me",
  "Create a landing page", "Build an e-commerce site",
  "I need a website", "Can you make a website?",
  "Website for my business", "Site for my company",
  "Portfolio site", "Blog website", "E-commerce website",
  "Create a site", "Make a site", "Build a site",
  "I want a site", "Website please",
  "Online store for my products", "Web page for my services",
  "Corporate website", "Personal website", "Business site",
  "Professional website", "Modern website", "Simple website",
  "Responsive website", "Mobile-friendly site",
  // Types spécifiques (30)
  "Site pour un dentiste", "Site pour un avocat",
  "Site pour un coach", "Site pour un consultant",
  "Site pour un freelancer", "Site pour une agence",
  "Site pour un salon de coiffure", "Site pour un spa",
  "Site pour un gym", "Site pour un yoga studio",
  "Site pour une église", "Site pour une association",
  "Site pour un food truck", "Site pour un traiteur",
  "Site pour un mariage", "Site pour un événement",
  "Site pour un podcast", "Site pour une chaîne YouTube",
  "Restaurant website", "Hotel website", "Dental website",
  "Law firm website", "Fitness website", "Yoga website",
  "Church website", "Nonprofit website", "Event website",
  "Wedding website", "Catering website", "Musician website",
  // Avec détails (30)
  "Crée un site web avec un formulaire de contact",
  "Fais un site avec une galerie photos",
  "Site web avec réservation en ligne",
  "Site avec système de paiement",
  "Landing page avec call-to-action",
  "Site vitrine avec présentation de l'équipe",
  "Site e-commerce avec panier d'achat",
  "Blog avec système de commentaires",
  "Portfolio avec filtres par catégorie",
  "Site avec intégration réseaux sociaux",
  "Create a website with contact form",
  "Build a site with photo gallery",
  "Website with online booking",
  "Site with payment system",
  "Landing page with newsletter signup",
  "Corporate site with team section",
  "E-commerce with shopping cart",
  "Blog with comment system",
  "Portfolio with category filters",
  "Site with social media integration",
  "Site responsive mobile-first",
  "Website with dark mode",
  "Site avec animations",
  "Website with parallax effect",
  "Site multilingue", "Multilingual website",
  "Site avec SEO optimisé", "SEO-friendly website",
  "Site avec analytics", "Website with tracking",
];

SITE_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'site_creation', category: 'site' });
});

// ============================================
// APPLICATION (120 questions)
// ============================================
const APP_QUESTIONS = [
  // Chatbot et assistant (30)
  "Crée-moi un chatbot", "Fais-moi un assistant virtuel",
  "Je veux un agent IA", "Génère un bot pour moi",
  "Construis-moi une application de chat",
  "Développe un assistant intelligent",
  "Crée un chatbot pour mon entreprise",
  "Fais un bot de support client",
  "Assistant virtuel pour répondre aux questions",
  "Chatbot FAQ", "Bot de service client",
  "Create a chatbot", "Make me a virtual assistant",
  "Build an AI agent", "I want a chat application",
  "Customer service bot", "Support chatbot",
  "FAQ bot", "Help desk assistant",
  "Conversational AI", "Chat assistant",
  "Bot de conversation", "Agent conversationnel",
  "Assistant de vente", "Sales assistant bot",
  "Bot de réservation", "Booking assistant",
  "Assistant personnel", "Personal assistant",
  "Bot multilingue", "Multilingual chatbot",
  // Dashboard et admin (30)
  "Crée-moi un dashboard", "Fais-moi un tableau de bord",
  "Je veux un panneau d'administration",
  "Génère un admin panel", "Construis-moi un dashboard analytics",
  "Dashboard de gestion", "Tableau de bord de suivi",
  "Admin panel pour mon site", "Panneau de contrôle",
  "Dashboard de monitoring", "Tableau de bord temps réel",
  "Create a dashboard", "Make me an admin panel",
  "Build a management dashboard", "Analytics dashboard",
  "Monitoring dashboard", "Real-time dashboard",
  "Control panel", "Management panel",
  "Dashboard de ventes", "Sales dashboard",
  "Dashboard financier", "Financial dashboard",
  "Dashboard RH", "HR dashboard",
  "Dashboard marketing", "Marketing dashboard",
  "Dashboard de performance", "Performance dashboard",
  "Dashboard KPI", "KPI tracker",
  // Applications spécifiques (30)
  "Crée une application de gestion de tâches",
  "Fais une app de prise de notes",
  "Application de suivi de dépenses",
  "App de gestion de projet",
  "Système de réservation", "Booking system",
  "Système de commande", "Ordering system",
  "Gestion d'inventaire", "Inventory management",
  "CRM simple", "Customer management system",
  "Quiz application", "Survey app",
  "Feedback form system", "Voting system",
  "Task manager", "Note-taking app",
  "Expense tracker", "Budget tracker",
  "Project management tool", "Kanban board",
  "Calendar app", "Scheduling app",
  "Todo list", "Task list app",
  "Habit tracker", "Goal tracker",
  "Time tracker", "Pomodoro app",
  "Password manager", "Bookmark manager",
  // Avec fonctionnalités (30)
  "Application avec authentification",
  "App avec base de données",
  "Système avec notifications",
  "Application avec API",
  "App avec paiement Stripe",
  "Système avec rôles utilisateurs",
  "Application avec export PDF",
  "App avec graphiques",
  "Système avec recherche",
  "Application avec filtres",
  "App with authentication",
  "Application with database",
  "System with notifications",
  "App with API integration",
  "System with user roles",
  "Application with PDF export",
  "App with charts",
  "System with search",
  "Application with filters",
  "App with real-time updates",
  "Système temps réel", "Real-time system",
  "Application collaborative", "Collaborative app",
  "App multi-utilisateurs", "Multi-user application",
  "Système sécurisé", "Secure application",
  "App mobile-friendly", "Responsive application",
  "Application PWA", "Progressive web app",
];

APP_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'app_creation', category: 'app' });
});

// ============================================
// IMAGE (100 questions)
// ============================================
const IMAGE_QUESTIONS = [
  // Génération simple FR (25)
  "Génère une image", "Crée une image",
  "Fais-moi une image", "Dessine-moi quelque chose",
  "Génère une illustration", "Crée un dessin",
  "Fais une photo", "Produis une image",
  "Image de chat", "Photo de paysage",
  "Illustration d'un robot", "Dessin d'une maison",
  "Génère une image de coucher de soleil",
  "Crée une illustration de montagne",
  "Fais-moi un dessin de voiture",
  "Image artistique", "Photo réaliste",
  "Illustration cartoon", "Dessin anime",
  "Art numérique", "Digital art",
  "Génère un logo", "Crée un avatar",
  "Fais une icône", "Produis un visuel",
  "Image pour mon projet",
  // Génération simple EN (25)
  "Generate an image", "Create an image",
  "Make me an image", "Draw something",
  "Generate an illustration", "Create a drawing",
  "Make a photo", "Produce an image",
  "Image of a cat", "Photo of landscape",
  "Illustration of a robot", "Drawing of a house",
  "Generate a sunset image",
  "Create a mountain illustration",
  "Make me a car drawing",
  "Artistic image", "Realistic photo",
  "Cartoon illustration", "Anime drawing",
  "Digital artwork", "AI art",
  "Generate a logo", "Create an avatar",
  "Make an icon", "Produce a visual",
  "Image for my project",
  // Styles artistiques (25)
  "Image style impressionniste",
  "Photo style vintage",
  "Illustration style minimaliste",
  "Dessin style manga",
  "Art style cyberpunk",
  "Image style aquarelle",
  "Photo style noir et blanc",
  "Illustration style flat design",
  "Dessin style réaliste",
  "Art style abstrait",
  "Impressionist style image",
  "Vintage style photo",
  "Minimalist illustration",
  "Manga style drawing",
  "Cyberpunk art",
  "Watercolor style",
  "Black and white photo",
  "Flat design illustration",
  "Realistic drawing",
  "Abstract art",
  "Style pop art", "Pop art style",
  "Style art déco", "Art deco style",
  "Style rétro", "Retro style",
  // Sujets spécifiques (25)
  "Image d'un dragon", "Dragon illustration",
  "Photo de forêt", "Forest photo",
  "Dessin de super-héros", "Superhero drawing",
  "Illustration de ville futuriste",
  "Futuristic city illustration",
  "Image de plage tropicale",
  "Tropical beach image",
  "Portrait d'une femme", "Woman portrait",
  "Paysage de montagne", "Mountain landscape",
  "Nature morte", "Still life",
  "Scène de science-fiction", "Sci-fi scene",
  "Fantasy artwork", "Oeuvre fantastique",
  "Image de nourriture", "Food photography",
  "Animal sauvage", "Wild animal",
  "Espace et galaxies", "Space and galaxies",
  "Architecture moderne", "Modern architecture",
  "Fleurs et jardins", "Flowers and gardens",
  "Océan et mer", "Ocean and sea",
];

IMAGE_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'image_generation', category: 'image' });
});

// ============================================
// CODE (80 questions)
// ============================================
const CODE_QUESTIONS = [
  // Demandes de code FR (20)
  "Écris du code Python", "Fais un script JavaScript",
  "Crée une fonction", "Code un algorithme",
  "Écris une classe", "Fais du code TypeScript",
  "Script pour trier une liste",
  "Fonction pour calculer la moyenne",
  "Code pour parser du JSON",
  "Algorithme de tri",
  "Programme un algorithme de recherche",
  "Code une fonction récursive",
  "Script de validation",
  "Fonction de conversion",
  "Code pour manipuler des strings",
  "Algorithme de Fibonacci",
  "Code factorielle",
  "Script de génération de mot de passe",
  "Fonction de hash",
  "Code pour encoder en base64",
  // Demandes de code EN (20)
  "Write Python code", "Make a JavaScript script",
  "Create a function", "Code an algorithm",
  "Write a class", "Make TypeScript code",
  "Script to sort a list",
  "Function to calculate average",
  "Code to parse JSON",
  "Sorting algorithm",
  "Program a search algorithm",
  "Code a recursive function",
  "Validation script",
  "Conversion function",
  "Code for string manipulation",
  "Fibonacci algorithm",
  "Factorial code",
  "Password generator script",
  "Hash function",
  "Code to encode base64",
  // Exécution et calculs (20)
  "Exécute ce code", "Lance ce script",
  "Run this code", "Execute this script",
  "Calcule 2+2", "Calculate 5*10",
  "Combien fait 100/4?", "What is 25*4?",
  "Résous cette équation", "Solve this equation",
  "Trouve les nombres premiers",
  "Find prime numbers",
  "Calcule la factorielle de 10",
  "Calculate factorial of 10",
  "Convertis en binaire",
  "Convert to binary",
  "Calcule l'aire d'un cercle",
  "Calculate circle area",
  "Trie cette liste", "Sort this array",
  // Débogage (20)
  "Debug ce code", "Débugue ce script",
  "Trouve le bug", "Find the error",
  "Corrige ce code", "Fix this code",
  "Pourquoi ça ne marche pas?",
  "Why doesn't this work?",
  "Erreur dans mon code",
  "Error in my code",
  "Optimise ce code", "Optimize this code",
  "Améliore ce script", "Improve this script",
  "Refactore ce code", "Refactor this code",
  "Analyse ce code", "Analyze this code",
  "Explique ce code", "Explain this code",
  "Review mon code", "Code review",
];

CODE_QUESTIONS.forEach(q => {
  const isExecution = /exécute|lance|run|execute|calcul|calculate|combien|what is|résous|solve|trie|sort|debug|débugue|trouve.*bug|find.*error|corrige|fix/i.test(q);
  TEST_QUESTIONS.push({ 
    question: q, 
    expectedIntent: isExecution ? 'code_execution' : 'code_request', 
    category: 'code' 
  });
});

// ============================================
// MÉTÉO (80 questions)
// ============================================
const WEATHER_QUESTIONS = [
  // Météo simple FR (20)
  "Quel temps fait-il?", "Quelle est la météo?",
  "Météo à Paris", "Temps à Lyon",
  "Il fait beau aujourd'hui?", "Va-t-il pleuvoir?",
  "Température actuelle", "Prévisions météo",
  "Météo de demain", "Temps cette semaine",
  "Quel temps à Marseille?", "Météo Luxembourg",
  "Il neige?", "Y a-t-il du soleil?",
  "Humidité aujourd'hui", "Vent actuel",
  "Météo du week-end", "Prévisions pour lundi",
  "Temps à Bruxelles", "Météo en Belgique",
  // Météo simple EN (20)
  "What's the weather?", "How's the weather?",
  "Weather in London", "Temperature in New York",
  "Is it sunny today?", "Will it rain?",
  "Current temperature", "Weather forecast",
  "Tomorrow's weather", "This week's weather",
  "What's the weather in Berlin?", "Weather in Tokyo",
  "Is it snowing?", "Is there sun?",
  "Humidity today", "Current wind",
  "Weekend weather", "Monday forecast",
  "Weather in Amsterdam", "Weather in Spain",
  // Questions détaillées (20)
  "Quelle est la température à Paris aujourd'hui?",
  "Va-t-il pleuvoir demain à Lyon?",
  "Prévisions météo pour la semaine prochaine",
  "Quel temps fera-t-il ce week-end?",
  "Est-ce qu'il fait froid à Montréal?",
  "Température maximale aujourd'hui",
  "Température minimale cette nuit",
  "Indice UV actuel", "Qualité de l'air",
  "Risque d'orage", "Probabilité de pluie",
  "What's the temperature in Paris today?",
  "Will it rain tomorrow in London?",
  "Weather forecast for next week",
  "What will the weather be this weekend?",
  "Is it cold in Montreal?",
  "Maximum temperature today",
  "Minimum temperature tonight",
  "Current UV index", "Air quality",
  "Storm risk", "Rain probability",
  // Villes spécifiques (20)
  "Météo New York", "Weather in Los Angeles",
  "Temps à Tokyo", "Weather in Sydney",
  "Météo Dubai", "Weather in Singapore",
  "Temps à Rome", "Weather in Barcelona",
  "Météo Amsterdam", "Weather in Vienna",
  "Temps à Prague", "Weather in Budapest",
  "Météo Lisbonne", "Weather in Athens",
  "Temps à Dublin", "Weather in Edinburgh",
  "Météo Oslo", "Weather in Stockholm",
  "Temps à Helsinki", "Weather in Copenhagen",
];

WEATHER_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'weather', category: 'weather' });
});

// ============================================
// CRYPTO (60 questions)
// ============================================
const CRYPTO_QUESTIONS = [
  // Prix simple (20)
  "Prix du Bitcoin", "Cours de l'Ethereum",
  "Combien vaut le BTC?", "Valeur de l'ETH",
  "Bitcoin price", "Ethereum price",
  "How much is Bitcoin?", "BTC value",
  "Prix Solana", "Cours Cardano",
  "Valeur du Dogecoin", "Prix XRP",
  "Solana price", "Cardano price",
  "Dogecoin value", "XRP price",
  "Prix crypto", "Cryptocurrency prices",
  "Cours des cryptos", "Crypto market",
  // Comparaisons (20)
  "BTC vs ETH", "Bitcoin vs Ethereum",
  "Quelle crypto acheter?", "Best crypto to buy",
  "Top 10 cryptos", "Best performing coins",
  "Crypto qui monte", "Trending cryptocurrencies",
  "Market cap Bitcoin", "ETH market cap",
  "Volume trading BTC", "Bitcoin trading volume",
  "Dominance Bitcoin", "BTC dominance",
  "Altcoins performance", "DeFi tokens",
  "NFT market", "Stablecoins",
  "Meme coins", "Layer 2 tokens",
  // Analyse (20)
  "Analyse Bitcoin", "BTC analysis",
  "Prévision Ethereum", "ETH prediction",
  "Bitcoin va monter?", "Will BTC go up?",
  "Ethereum bearish or bullish?",
  "Support et résistance BTC",
  "Bitcoin technical analysis",
  "Crypto news", "Actualités crypto",
  "Blockchain news", "DeFi news",
  "Bitcoin halving", "ETH 2.0",
  "Crypto regulation", "SEC crypto",
  "Bitcoin mining", "Ethereum staking",
  "Wallet crypto", "Exchange crypto",
];

CRYPTO_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'crypto', category: 'crypto' });
});

// ============================================
// RECHERCHE WEB (40 questions)
// ============================================
const SEARCH_QUESTIONS = [
  // Questions factuelles (20)
  "Qui est le président de la France?",
  "Who is the CEO of Apple?",
  "Quand a été fondé Google?",
  "When was Microsoft founded?",
  "Où est la Tour Eiffel?",
  "Where is the Statue of Liberty?",
  "Qu'est-ce que l'intelligence artificielle?",
  "What is machine learning?",
  "Recherche sur internet",
  "Search on Google",
  "Trouve des informations sur",
  "Find information about",
  "Actualités du jour",
  "Latest news",
  "Dernières nouvelles sur",
  "Recent news about",
  "Qui a inventé l'ampoule?",
  "Who invented the telephone?",
  "Quand est né Einstein?",
  "When was Newton born?",
  // Recherches spécifiques (20)
  "Cherche sur internet les meilleurs restaurants",
  "Search for best hotels in Paris",
  "Trouve les horaires de train",
  "Find flight schedules",
  "Recherche les avis sur ce produit",
  "Search for product reviews",
  "Informations sur cette entreprise",
  "Information about this company",
  "Google ce sujet",
  "Look up this topic",
  "Dernières actualités tech",
  "Latest tech news",
  "Nouvelles du sport",
  "Sports news",
  "Actualités économiques",
  "Economic news",
  "Recherche académique",
  "Academic research",
  "Articles scientifiques",
  "Scientific papers",
];

SEARCH_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'web_search', category: 'search' });
});

// ============================================
// TRANSITIONS (150 questions)
// ============================================
const TRANSITION_QUESTIONS = [
  // Image -> Site (30)
  "Non pas une image, un site web",
  "En fait je préfère un site",
  "Finalement un site web",
  "Plutôt un site que ça",
  "Change pour un site",
  "Je veux un site à la place",
  "Oublie l'image, fais un site",
  "No, a website instead",
  "Actually I want a website",
  "Switch to a website",
  "Forget the image, make a site",
  "I prefer a website",
  "Let's do a website instead",
  "Can you make a website instead?",
  "Non pas ça, un site",
  "Pas d'image, un site",
  "No image, a website",
  "Website instead of image",
  "Site web plutôt",
  "Rather a website",
  "A website would be better",
  "Un site serait mieux",
  "Je préfère un site web",
  "I'd rather have a website",
  "Make it a website",
  "Fais-en un site",
  "Transform to website",
  "Transforme en site",
  "Change to site",
  "Passe à un site",
  // Site -> App (30)
  "Non pas un site, une application",
  "En fait je préfère une app",
  "Finalement une application",
  "Plutôt une app que ça",
  "Change pour une application",
  "Je veux une app à la place",
  "Oublie le site, fais une app",
  "No, an application instead",
  "Actually I want an app",
  "Switch to an application",
  "Forget the site, make an app",
  "I prefer an application",
  "Let's do an app instead",
  "Can you make an app instead?",
  "Non pas ça, une app",
  "Pas de site, une application",
  "No website, an app",
  "App instead of site",
  "Application plutôt",
  "Rather an application",
  "An app would be better",
  "Une app serait mieux",
  "Je préfère une application",
  "I'd rather have an app",
  "Make it an application",
  "Fais-en une app",
  "Transform to app",
  "Transforme en application",
  "Change to app",
  "Passe à une app",
  // App -> Image (30)
  "Non pas une app, une image",
  "En fait je préfère une image",
  "Finalement une image",
  "Plutôt une image que ça",
  "Change pour une image",
  "Je veux une image à la place",
  "Oublie l'app, fais une image",
  "No, an image instead",
  "Actually I want an image",
  "Switch to an image",
  "Forget the app, make an image",
  "I prefer an image",
  "Let's do an image instead",
  "Can you make an image instead?",
  "Non pas ça, une image",
  "Pas d'app, une image",
  "No app, an image",
  "Image instead of app",
  "Image plutôt",
  "Rather an image",
  "An image would be better",
  "Une image serait mieux",
  "Je préfère une image",
  "I'd rather have an image",
  "Make it an image",
  "Fais-en une image",
  "Transform to image",
  "Transforme en image",
  "Change to image",
  "Passe à une image",
  // Négations générales (30)
  "Non", "No", "Pas ça", "Not that",
  "Ce n'est pas ce que je veux",
  "That's not what I want",
  "Annule", "Cancel", "Stop", "Arrête",
  "Recommence", "Start over", "Restart",
  "Autre chose", "Something else",
  "Change ça", "Change this",
  "Modifie", "Modify", "Ajuste", "Adjust",
  "Pas comme ça", "Not like this",
  "Différent", "Different",
  "Essaie autre chose", "Try something else",
  "Refais", "Redo", "Again", "Encore",
  "Mieux que ça", "Better than this",
  "Plus simple", "Simpler",
  // Confirmations de transition (30)
  "Oui, un site", "Yes, a website",
  "Oui, une app", "Yes, an application",
  "Oui, une image", "Yes, an image",
  "Exactement, un site", "Exactly, a website",
  "C'est ça, une app", "That's it, an app",
  "Parfait, une image", "Perfect, an image",
  "D'accord pour le site", "OK for the website",
  "OK pour l'app", "OK for the app",
  "Ça marche pour l'image", "Works for the image",
  "Confirme le site", "Confirm the website",
  "Valide l'app", "Validate the app",
  "Accepte l'image", "Accept the image",
  "Continue avec le site", "Continue with website",
  "Poursuis avec l'app", "Proceed with app",
  "Garde l'image", "Keep the image",
];

// Ajouter les transitions avec les bonnes intentions attendues
TRANSITION_QUESTIONS.slice(0, 30).forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'site_creation', category: 'transition' });
});
TRANSITION_QUESTIONS.slice(30, 60).forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'app_creation', category: 'transition' });
});
TRANSITION_QUESTIONS.slice(60, 90).forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'image_generation', category: 'transition' });
});
// Les négations générales restent en conversation
TRANSITION_QUESTIONS.slice(90, 120).forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'conversation', category: 'transition' });
});
// Les confirmations dépendent du contexte, on les met en conversation par défaut
TRANSITION_QUESTIONS.slice(120).forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'conversation', category: 'transition' });
});

// ============================================
// EXÉCUTION DU TEST
// ============================================

interface CategoryStats {
  total: number;
  passed: number;
  rate: number;
}

interface TestResult {
  question: string;
  expected: IntentType;
  actual: IntentType;
  passed: boolean;
  category: string;
}

async function runStressTest() {
  console.log('============================================================');
  console.log('🚀 STRESS TEST 1000 QUESTIONS - PHOENIX AI');
  console.log('============================================================');
  console.log(`Total questions: ${TEST_QUESTIONS.length}`);
  console.log('');

  const results: TestResult[] = [];
  const categoryStats: Map<string, CategoryStats> = new Map();
  
  // Initialiser les stats par catégorie
  const categories = Array.from(new Set(TEST_QUESTIONS.map(t => t.category)));
  categories.forEach(cat => {
    categoryStats.set(cat, { total: 0, passed: 0, rate: 0 });
  });

  // Exécuter les tests
  for (const test of TEST_QUESTIONS) {
    const result = detectIntent(test.question);
    const passed = result.type === test.expectedIntent;
    
    results.push({
      question: test.question,
      expected: test.expectedIntent,
      actual: result.type,
      passed,
      category: test.category
    });

    const stats = categoryStats.get(test.category)!;
    stats.total++;
    if (passed) stats.passed++;
  }

  // Calculer les taux
  categoryStats.forEach((stats) => {
    stats.rate = (stats.passed / stats.total) * 100;
  });

  // Afficher les résultats par catégorie
  console.log('📊 RÉSULTATS PAR CATÉGORIE:');
  console.log('| Catégorie    | Réussis | Total | Taux    |');
  console.log('|--------------|---------|-------|---------|');
  
  let totalPassed = 0;
  let totalTests = 0;
  
  categoryStats.forEach((stats, category) => {
    const catName = category.padEnd(12);
    const passed = stats.passed.toString().padStart(7);
    const total = stats.total.toString().padStart(5);
    const rate = stats.rate.toFixed(1).padStart(6) + '%';
    console.log(`| ${catName} | ${passed} | ${total} | ${rate} |`);
    totalPassed += stats.passed;
    totalTests += stats.total;
  });

  const globalRate = (totalPassed / totalTests) * 100;
  console.log('|--------------|---------|-------|---------|');
  console.log(`| ${'TOTAL'.padEnd(12)} | ${totalPassed.toString().padStart(7)} | ${totalTests.toString().padStart(5)} | ${globalRate.toFixed(1).padStart(6)}% |`);

  // Afficher les échecs (limité à 50)
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0 && failures.length <= 50) {
    console.log('\n❌ ÉCHECS:');
    failures.forEach(f => {
      console.log(`  [${f.category}] "${f.question.substring(0, 50)}..." -> ${f.actual} (attendu: ${f.expected})`);
    });
  } else if (failures.length > 50) {
    console.log(`\n❌ ${failures.length} échecs au total (trop nombreux pour afficher)`);
  }

  console.log('============================================================');
  console.log('📈 RÉSUMÉ FINAL:');
  console.log(`   Tests réussis: ${totalPassed}/${totalTests} (${globalRate.toFixed(1)}%)`);
  console.log(`   Tests échoués: ${failures.length}`);
  
  if (globalRate >= 90) {
    console.log('   ✅ EXCELLENT! Phoenix est prêt pour la production.');
  } else if (globalRate >= 80) {
    console.log('   ✅ BON! Phoenix fonctionne bien mais peut être amélioré.');
  } else if (globalRate >= 70) {
    console.log('   ⚠️ ACCEPTABLE mais des améliorations sont nécessaires.');
  } else {
    console.log('   ❌ INSUFFISANT. Des corrections majeures sont requises.');
  }
  console.log('============================================================');

  return { totalPassed, totalTests, globalRate, categoryStats, failures };
}

// Exécuter le test
runStressTest().catch(console.error);
