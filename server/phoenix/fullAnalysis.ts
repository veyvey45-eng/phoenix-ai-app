/**
 * Analyse complète de toutes les catégories du stress test
 */

import { detectIntent } from './intentDetector';

// Toutes les questions par catégorie
const allQuestions = {
  // CONVERSATION (50)
  conversation: [
    'Bonjour', 'Salut Phoenix', 'Comment ça va?', 'Hello', 'Hi there',
    'Good morning', 'Bonsoir', 'Merci beaucoup', 'Thanks', 'Au revoir',
    'Bye', 'À bientôt', 'Comment tu t\'appelles?', 'Qui es-tu?', 'What can you do?',
    'Que sais-tu faire?', 'Aide-moi', 'J\'ai besoin d\'aide', 'Help me', 'C\'est quoi Phoenix?',
    'Tu es intelligent?', 'Are you an AI?', 'Tu parles français?', 'Do you speak English?', 'Quelle heure est-il?',
    'What time is it?', 'Quel jour sommes-nous?', 'What day is today?', 'Je m\'ennuie', 'Raconte-moi une blague',
    'Tell me a joke', 'Tu es drôle', 'Parfait', 'Super', 'Excellent',
    'D\'accord', 'OK', 'Compris', 'Je comprends', 'C\'est bien',
    'That\'s great', 'Awesome', 'Cool', 'Nice', 'Bien joué',
    'Bravo', 'Félicitations', 'Je suis content', 'I\'m happy', 'Ça me plaît'
  ],

  // IMAGE (50)
  image: [
    'Génère une image de chat', 'Crée-moi une image de paysage', 'Fais une photo de montagne',
    'Generate an image of a sunset', 'Create a picture of a dog', 'Génère une image de voiture de sport rouge',
    'Crée une illustration de robot futuriste', 'Fais-moi une image de plage tropicale', 'Generate a fantasy castle',
    'Create an image of a dragon', 'Génère une image de forêt enchantée', 'Crée une image de ville futuriste',
    'Fais une image de pizza', 'Generate a portrait of a woman', 'Create an abstract art piece',
    'Génère une image de lion majestueux', 'Crée une image d\'astronaute sur Mars', 'Fais une image de jardin japonais',
    'Generate a cyberpunk scene', 'Create an image of a waterfall', 'Génère une image de café parisien',
    'Crée une image de bateau sur l\'océan', 'Fais une image de château médiéval', 'Generate a snowy mountain landscape',
    'Create an image of a rainbow', 'Génère une image de fleurs colorées', 'Crée une image de papillon',
    'Fais une image de lune', 'Generate a space station', 'Create an image of a phoenix bird',
    'Génère une image de beau gosse turc devant un hôtel', 'Crée une image de femme élégante', 'Fais une image de famille heureuse',
    'Generate a luxury car', 'Create an image of a modern house', 'Génère une image de restaurant chic',
    'Crée une image de bureau moderne', 'Fais une image de salle de sport', 'Generate a tropical beach resort',
    'Create an image of a cozy living room', 'Génère une image de cuisine moderne', 'Crée une image de chambre luxueuse',
    'Fais une image de piscine', 'Generate a garden with flowers', 'Create an image of a bookshelf',
    'Génère une image de coucher de soleil sur la mer', 'Crée une image de lever de soleil', 'Fais une image de nuit étoilée',
    'Generate northern lights', 'Create an image of a thunderstorm'
  ],

  // SITE (50)
  site: [
    'Crée-moi un site web', 'Fais-moi un site pour mon restaurant', 'Create a website for my business',
    'Build me a landing page', 'Crée une page web pour mon hôtel', 'Fais-moi un site e-commerce',
    'Create an online store', 'Build a portfolio website', 'Crée un site vitrine',
    'Fais-moi un blog', 'Create a blog website', 'Build me a company website',
    'Crée un site pour ma startup', 'Fais-moi un site de réservation', 'Create a booking website',
    'Build a restaurant website', 'Crée un site pour mon salon de coiffure', 'Fais-moi un site pour mon cabinet médical',
    'Create a dental clinic website', 'Build a gym website', 'Crée un site pour mon école',
    'Fais-moi un site pour mon association', 'Create a nonprofit website', 'Build a church website',
    'Crée un site pour mon agence immobilière', 'Fais-moi un site pour mon cabinet d\'avocats', 'Create a law firm website',
    'Build an accounting firm website', 'Crée un site pour mon garage', 'Fais-moi un site pour mon food truck',
    'Create a food delivery website', 'Build a catering website', 'Crée un site pour mon mariage',
    'Fais-moi un site pour mon événement', 'Create an event website', 'Build a conference website',
    'Crée un site pour mon podcast', 'Fais-moi un site pour ma chaîne YouTube', 'Create a musician website',
    'Build an artist portfolio', 'Crée un site pour mon photographe', 'Fais-moi un site pour mon studio de design',
    'Create a freelancer website', 'Build a consultant website', 'Crée un site pour mon coach sportif',
    'Fais-moi un site pour mon nutritionniste', 'Create a fitness trainer website', 'Build a yoga studio website',
    'Crée un site pour mon spa', 'Fais-moi un site pour mon centre de bien-être'
  ],

  // APP (50)
  app: [
    'Crée-moi une application de chatbot', 'Fais-moi un agent IA', 'Create a chatbot application',
    'Build me an AI agent', 'Crée une vraie application de chat', 'Fais-moi un bot de conversation',
    'Create a conversational bot', 'Build an assistant virtuel', 'Crée une application fonctionnelle',
    'Fais-moi une app qui marche', 'Create a working application', 'Build a functional chatbot',
    'Crée un chatbot intelligent', 'Fais-moi un assistant personnel', 'Create a personal assistant',
    'Build a customer service bot', 'Crée un bot de support client', 'Fais-moi un chatbot FAQ',
    'Create a FAQ bot', 'Build a help desk bot', 'Crée une application de réservation',
    'Fais-moi une app de commande', 'Create a booking app', 'Build an ordering system',
    'Crée une application de gestion', 'Fais-moi un dashboard', 'Create a management dashboard',
    'Build an admin panel', 'Crée une application de suivi', 'Fais-moi un tracker',
    'Create a tracking app', 'Build a monitoring system', 'Crée une application de notes',
    'Fais-moi une app todo list', 'Create a note-taking app', 'Build a task manager',
    'Crée une application de calendrier', 'Fais-moi un planificateur', 'Create a calendar app',
    'Build a scheduler', 'Crée une application de quiz', 'Fais-moi un jeu de questions',
    'Create a quiz app', 'Build a trivia game', 'Crée une application de sondage',
    'Fais-moi un formulaire de feedback', 'Create a survey app', 'Build a feedback form',
    'Crée une application de vote', 'Fais-moi un système de vote'
  ],

  // CODE (50)
  code: [
    'Exécute ce code Python', 'Lance ce script', 'Run this code', 'Execute this script',
    'Fais tourner ce programme', 'Teste ce code', 'Test this code', 'Debug ce programme',
    'Calcule 2+2', 'Calculate 15*7', 'Combien fait 100/4?', 'What is 25*25?',
    'Trie cette liste [5,2,8,1,9]', 'Sort this array [3,1,4,1,5]', 'Inverse cette chaîne "hello"',
    'Reverse this string "world"', 'Compte les voyelles dans "bonjour"', 'Count vowels in "hello world"',
    'Vérifie si "radar" est un palindrome', 'Check if "level" is a palindrome', 'Trouve le maximum de [1,5,3,9,2]',
    'Find the minimum of [7,2,8,1,6]', 'Convertis 100 en binaire', 'Convert 255 to hexadecimal',
    'Génère un mot de passe', 'Generate a UUID', 'Parse ce JSON', 'Stringify this object',
    'Encode en base64 "hello"', 'Decode base64 "aGVsbG8="', 'Hash MD5 de "password"', 'SHA256 hash of "secret"',
    'Calcule la factorielle de 5', 'Calculate fibonacci(10)', 'Calcule l\'aire d\'un cercle de rayon 5',
    'Convert 30 celsius to fahrenheit', 'Génère les nombres premiers jusqu\'à 50', 'Find all divisors of 24',
    'Calcule la moyenne de [10,20,30,40,50]', 'Calculate standard deviation', 'Résous x² - 5x + 6 = 0',
    'Calcule la distance entre (0,0) et (3,4)', 'Generate random numbers', 'Shuffle this list',
    'Find duplicates in [1,2,2,3,3,3]', 'Remove duplicates from array', 'Merge two sorted lists',
    'Binary search for 7 in [1,3,5,7,9]', 'Calcule le PGCD de 48 et 18', 'Find LCM of 12 and 15'
  ],

  // WEATHER (30)
  weather: [
    'Quelle est la météo à Paris?', 'Il fait quel temps à Lyon?', 'Température à Luxembourg',
    'What\'s the weather in London?', 'Weather forecast for Berlin', 'Météo du jour',
    'Prévisions météo pour demain', 'Fait-il beau à Nice?', 'Quel temps fait-il?',
    'Donne-moi la météo', 'Température exacte à Luxembourg', 'Current temperature in New York',
    'Va-t-il pleuvoir aujourd\'hui?', 'Will it rain tomorrow?', 'Météo de la semaine',
    'Weekly forecast', 'Humidité à Bruxelles', 'Wind speed in Amsterdam',
    'UV index à Marseille', 'Air quality in Beijing', 'Température ressentie à Strasbourg',
    'Feels like temperature in Chicago', 'Lever du soleil à Tokyo', 'Sunset time in Sydney',
    'Neige à Chamonix?', 'Snow forecast for Alps', 'Canicule prévue?',
    'Heat wave warning?', 'Météo pour mon voyage à Rome', 'Weather for my trip to Barcelona'
  ],

  // CRYPTO (30)
  crypto: [
    'Prix du Bitcoin', 'Cours de l\'Ethereum', 'Combien vaut le BTC?',
    'Bitcoin price', 'ETH value', 'Crypto prices',
    'Quel est le prix du Solana?', 'Valeur actuelle du Bitcoin', 'Cours des cryptomonnaies',
    'XRP price today', 'Cardano ADA value', 'Prix du Litecoin',
    'Polkadot DOT price', 'Avalanche AVAX cours', 'Chainlink LINK value',
    'Uniswap UNI price', 'Aave prix', 'Polygon MATIC value',
    'Cosmos ATOM price', 'Near Protocol cours', 'Bitcoin market cap',
    'Capitalisation Ethereum', 'Top 10 cryptos', 'Best performing crypto today',
    'Crypto qui monte', 'Bitcoin 24h change', 'ETH weekly performance',
    'BTC vs ETH', 'Stablecoins prices', 'USDT USDC comparison'
  ],

  // TRANSITIONS (40)
  transitions: [
    'Je ne veux plus d\'images, crée-moi un site web',
    'Arrête les images, fais-moi un site',
    'Stop les images, crée un site web',
    'Plus d\'images, maintenant un site',
    'No more images, create a website',
    'Instead of images, build me a site',
    'Maintenant je veux un site web',
    'Now I want a website',
    'Plutôt crée-moi un site',
    'Rather build me a website',
    'À la place, fais-moi un site web',
    'En fait, je préfère un site',
    'Actually, create a website instead',
    'Finalement, un site web serait mieux',
    'Je change d\'avis, crée un site',
    'Changed my mind, build a website',
    'Oublie les images, fais un site',
    'Forget the images, create a site',
    'Laisse tomber les images, je veux un site',
    'Drop the images, make me a website',
    'Pas d\'images, un site web s\'il te plaît',
    'No images, a website please',
    'Je préfère un site à une image',
    'I prefer a website over an image',
    'Un site web serait plus utile',
    'A website would be more useful',
    'Crée plutôt un site pour mon business',
    'Build a business website instead',
    'Je veux passer à la création de site',
    'Let\'s switch to website creation',
    'Arrête de générer des images, fais-moi une app',
    'Stop generating images, create an app',
    'Plus d\'images, je veux une application',
    'No more images, I want an application',
    'Maintenant crée-moi une application',
    'Now create me an application',
    'Plutôt une vraie application',
    'Rather a real application',
    'Je préfère une app fonctionnelle',
    'I prefer a functional app'
  ]
};

// Mapping des catégories vers les intentions attendues
const expectedIntents: Record<string, string> = {
  conversation: 'conversation',
  image: 'image_generation',
  site: 'site_creation',
  app: 'app_creation',
  code: 'code_execution',
  weather: 'weather',
  crypto: 'crypto',
  transitions: 'site_creation' // La plupart des transitions vont vers site_creation
};

// Fonction pour déterminer l'intention attendue pour les transitions
function getExpectedIntentForTransition(question: string): string {
  if (/app|application/i.test(question)) {
    return 'app_creation';
  }
  return 'site_creation';
}

// Analyser toutes les catégories
console.log('\n========================================');
console.log('ANALYSE COMPLÈTE DU STRESS TEST');
console.log('========================================\n');

let totalPassed = 0;
let totalQuestions = 0;
const results: Record<string, { passed: number; total: number; percentage: number }> = {};

for (const [category, questions] of Object.entries(allQuestions)) {
  let passed = 0;
  const failed: string[] = [];
  
  for (const question of questions) {
    const result = detectIntent(question);
    let expectedIntent = expectedIntents[category];
    
    // Pour les transitions, déterminer l'intention attendue
    if (category === 'transitions') {
      expectedIntent = getExpectedIntentForTransition(question);
    }
    
    const isCorrect = result.type === expectedIntent;
    if (isCorrect) {
      passed++;
    } else {
      failed.push(`"${question.substring(0, 40)}..." → ${result.type}`);
    }
  }
  
  const percentage = Math.round(passed / questions.length * 100);
  results[category] = { passed, total: questions.length, percentage };
  totalPassed += passed;
  totalQuestions += questions.length;
  
  console.log(`\n--- ${category.toUpperCase()} ---`);
  console.log(`Résultat: ${passed}/${questions.length} (${percentage}%)`);
  
  if (failed.length > 0 && failed.length <= 5) {
    console.log('Échecs:');
    failed.forEach(f => console.log(`  ❌ ${f}`));
  } else if (failed.length > 5) {
    console.log(`Échecs: ${failed.length} questions (premiers 5):`);
    failed.slice(0, 5).forEach(f => console.log(`  ❌ ${f}`));
  }
}

console.log('\n========================================');
console.log('RÉSUMÉ GLOBAL');
console.log('========================================\n');

console.log('| Catégorie    | Réussite | Pourcentage |');
console.log('|--------------|----------|-------------|');
for (const [category, { passed, total, percentage }] of Object.entries(results)) {
  const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';
  console.log(`| ${category.padEnd(12)} | ${passed}/${total}`.padEnd(22) + `| ${percentage}% ${status}`.padEnd(14) + '|');
}

const globalPercentage = Math.round(totalPassed / totalQuestions * 100);
console.log('|--------------|----------|-------------|');
console.log(`| TOTAL        | ${totalPassed}/${totalQuestions}`.padEnd(22) + `| ${globalPercentage}%`.padEnd(14) + '|');

console.log('\n========================================');
console.log('FIN DE L\'ANALYSE');
console.log('========================================\n');
