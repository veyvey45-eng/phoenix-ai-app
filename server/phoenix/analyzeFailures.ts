/**
 * Analyse des échecs du stress test pour identifier les patterns manquants
 */

import { detectIntent } from './intentDetector';

// Questions qui échouent fréquemment - à analyser
const failedQuestions = {
  // Site (54% - 23 échecs sur 50)
  site: [
    'Crée-moi un site web',
    'Create a website for my business',
    'Build me a landing page',
    'Crée un site vitrine',
    'Create a blog website',
    'Build me a company website',
    'Crée un site pour ma startup',
    'Create a booking website',
    'Build a restaurant website',
    'Crée un site pour mon salon de coiffure',
    'Create a dental clinic website',
    'Build a gym website',
    'Crée un site pour mon école',
    'Create a nonprofit website',
    'Build a church website',
    'Crée un site pour mon agence immobilière',
    'Create a law firm website',
    'Build an accounting firm website',
    'Crée un site pour mon garage',
    'Create a food delivery website',
    'Build a catering website',
    'Crée un site pour mon mariage',
    'Create an event website',
  ],
  
  // App (50% - 25 échecs sur 50)
  app: [
    'Crée-moi une application de chatbot',
    'Fais-moi un agent IA',
    'Create a chatbot application',
    'Build me an AI agent',
    'Crée une vraie application de chat',
    'Create a conversational bot',
    'Build an assistant virtuel',
    'Crée une application fonctionnelle',
    'Create a working application',
    'Build a functional chatbot',
    'Crée un chatbot intelligent',
    'Create a personal assistant',
    'Build a customer service bot',
    'Crée un bot de support client',
    'Create a FAQ bot',
    'Build a help desk bot',
    'Crée une application de réservation',
    'Create a booking app',
    'Build an ordering system',
    'Crée une application de gestion',
    'Create a management dashboard',
    'Build an admin panel',
    'Crée une application de suivi',
    'Create a tracking app',
    'Build a monitoring system',
  ],
  
  // Météo (56.7% - 13 échecs sur 30)
  weather: [
    'Météo du jour',
    'Prévisions météo pour demain',
    'Fait-il beau à Nice?',
    'Quel temps fait-il?',
    'Donne-moi la météo',
    'Va-t-il pleuvoir aujourd\'hui?',
    'Will it rain tomorrow?',
    'Météo de la semaine',
    'Weekly forecast',
    'Humidité à Bruxelles',
    'Wind speed in Amsterdam',
    'UV index à Marseille',
    'Air quality in Beijing',
  ],
  
  // Crypto (56.7% - 13 échecs sur 30)
  crypto: [
    'Cours de l\'Ethereum',
    'Combien vaut le BTC?',
    'ETH value',
    'Crypto prices',
    'Valeur actuelle du Bitcoin',
    'Cours des cryptomonnaies',
    'Cardano ADA value',
    'Polkadot DOT price',
    'Avalanche AVAX cours',
    'Chainlink LINK value',
    'Uniswap UNI price',
    'Aave prix',
    'Polygon MATIC value',
  ],
  
  // Transitions (63.3% - environ 44 échecs sur 120)
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
  ]
};

// Analyser chaque catégorie
console.log('\n========================================');
console.log('ANALYSE DES ÉCHECS DU STRESS TEST');
console.log('========================================\n');

for (const [category, questions] of Object.entries(failedQuestions)) {
  console.log(`\n--- ${category.toUpperCase()} ---`);
  let passed = 0;
  let failed = 0;
  
  for (const question of questions) {
    const result = detectIntent(question);
    const expectedIntent = category === 'transitions' ? 'site_creation' : 
                          category === 'site' ? 'site_creation' :
                          category === 'app' ? 'app_creation' :
                          category === 'weather' ? 'weather' :
                          category === 'crypto' ? 'crypto' : 'unknown';
    
    const isCorrect = result.type === expectedIntent;
    if (isCorrect) {
      passed++;
    } else {
      failed++;
      console.log(`  ❌ "${question.substring(0, 50)}..." → ${result.type} (attendu: ${expectedIntent})`);
    }
  }
  
  console.log(`  Résultat: ${passed}/${questions.length} (${Math.round(passed/questions.length*100)}%)`);
}

console.log('\n========================================');
console.log('FIN DE L\'ANALYSE');
console.log('========================================\n');
