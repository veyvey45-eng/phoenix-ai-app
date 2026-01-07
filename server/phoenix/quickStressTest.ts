/**
 * QUICK STRESS TEST - Test rapide des améliorations v4
 * Teste les catégories problématiques: search, image, code
 */

import { detectIntent, IntentType } from './intentDetector';

interface TestCase {
  question: string;
  expectedIntent: IntentType;
  category: string;
}

const TEST_QUESTIONS: TestCase[] = [];

// ============================================
// RECHERCHE WEB (50 questions) - Était à 40%
// ============================================
const SEARCH_QUESTIONS = [
  // Recherche explicite
  "Cherche des informations sur Paris",
  "Recherche les dernières actualités",
  "Trouve des infos sur le changement climatique",
  "Google les résultats du match",
  "Search for best restaurants",
  "Find information about AI",
  "Look up the latest news",
  // Questions "qu'est-ce que"
  "Qu'est-ce que le machine learning?",
  "C'est quoi la blockchain?",
  "What is quantum computing?",
  "What's the meaning of life?",
  "Qu'est-ce qu'un NFT?",
  "C'est quoi le metaverse?",
  // Questions "qui est"
  "Qui est Elon Musk?",
  "Who is the president of France?",
  "C'est qui Jeff Bezos?",
  "Who is the CEO of Apple?",
  // Questions "comment faire"
  "Comment faire un gâteau?",
  "How to learn programming?",
  "Comment apprendre le piano?",
  "How do I start a business?",
  "Comment devenir riche?",
  // Questions "pourquoi"
  "Pourquoi le ciel est bleu?",
  "Why is the sky blue?",
  "Pourquoi les oiseaux migrent?",
  "Why do we dream?",
  // Actualités
  "Actualités du jour",
  "News about technology",
  "Dernières nouvelles sur l'économie",
  "Latest news on AI",
  "Infos sur la politique",
  // Définitions
  "Définition de l'intelligence artificielle",
  "Definition of machine learning",
  "Signification du mot empathie",
  "Meaning of serendipity",
  // Comparaisons
  "Différence entre Python et JavaScript",
  "Difference between AI and ML",
  "Compare React vs Vue",
  "Comparer iPhone et Android",
  // Listes et recommandations
  "Meilleurs films de 2024",
  "Best programming languages",
  "Top 10 des restaurants à Paris",
  "Liste des pays les plus riches",
  "Recommandations de livres",
  // Questions générales
  "En savoir plus sur l'histoire de France",
  "Tell me about the Roman Empire",
  "Explique-moi la théorie de l'évolution",
  "Learn more about space exploration",
];

SEARCH_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'web_search', category: 'search' });
});

// ============================================
// GÉNÉRATION D'IMAGE (50 questions) - Était à 60.9%
// ============================================
const IMAGE_QUESTIONS = [
  // Explicite avec "image"
  "Génère une image de dragon",
  "Crée une image de paysage",
  "Fais-moi une image de chat",
  "Generate an image of a castle",
  "Create a picture of a sunset",
  "Make an image of a robot",
  // Explicite avec "photo/illustration"
  "Génère une photo de montagne",
  "Crée une illustration de licorne",
  "Fais un dessin de papillon",
  "Generate a photo of a beach",
  "Create an illustration of a fairy",
  "Draw me a portrait",
  // Créatures fantastiques (implicite)
  "Génère un dragon",
  "Crée une licorne",
  "Fais un phoenix",
  "Generate a wizard",
  "Create a mermaid",
  "Make a centaur",
  // Animaux (implicite)
  "Génère un chat",
  "Crée un chien",
  "Fais un lion",
  "Generate a tiger",
  "Create an elephant",
  "Draw a butterfly",
  // Paysages (implicite)
  "Génère un paysage",
  "Crée une forêt",
  "Fais une montagne",
  "Generate a landscape",
  "Create a beach scene",
  "Make a sunset",
  // Objets (implicite)
  "Génère une voiture",
  "Crée un avion",
  "Fais une maison",
  "Generate a spaceship",
  "Create a castle",
  "Draw a sword",
  // Portraits (implicite)
  "Génère un portrait",
  "Crée un personnage",
  "Fais un guerrier",
  "Generate a princess",
  "Create a superhero",
  "Draw a ninja",
  // Styles artistiques
  "Art style cyberpunk",
  "Style manga",
  "Vintage style image",
  "Abstract art",
  "Pixel art dragon",
  "Anime style character",
  // Nourriture
  "Génère un gâteau",
  "Create a pizza",
];

IMAGE_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'image_generation', category: 'image' });
});

// ============================================
// EXÉCUTION DE CODE (50 questions) - Était à 51.2%
// ============================================
const CODE_QUESTIONS = [
  // Calculs simples
  "Calcule 5 + 3",
  "Calculate 10 * 5",
  "Combien fait 100 / 4?",
  "What's 25 + 75?",
  "Additionne 15 et 20",
  "Multiplie 6 par 7",
  // Calculs complexes
  "Calcule la factorielle de 10",
  "Calculate fibonacci of 20",
  "Résous x² + 5x + 6 = 0",
  "Find prime numbers up to 100",
  "Calcule le PGCD de 48 et 18",
  // Opérations sur listes
  "Trie cette liste: [5, 2, 8, 1]",
  "Sort this array: [3, 1, 4, 1, 5]",
  "Inverse cette chaîne: hello",
  "Reverse this string: world",
  "Trouve le maximum de [1, 5, 3, 9, 2]",
  "Find the minimum in [10, 5, 8, 3]",
  // Conversions
  "Convertis 100 celsius en fahrenheit",
  "Convert 50 miles to km",
  "Transforme en base64: hello",
  "Encode this in hex: test",
  // Vérifications
  "Vérifie si 'radar' est un palindrome",
  "Check if 17 is prime",
  "Valide si cette email est correcte",
  // Manipulation de texte
  "Compte les voyelles dans 'bonjour'",
  "Count words in this sentence",
  "Mets en majuscule: hello world",
  "Replace 'a' with 'b' in 'banana'",
  // Débogage
  "Debug ce code",
  "Fixe cette erreur",
  "Corrige ce bug",
  "Find the bug in this code",
  // Exécution explicite
  "Exécute ce code Python",
  "Run this script",
  "Lance ce programme",
  "Execute this function",
  // Génération
  "Génère un mot de passe",
  "Generate a random number",
  "Crée un UUID",
  // Géométrie
  "Calcule l'aire d'un cercle de rayon 5",
  "Find the perimeter of a square with side 10",
  "Calculate the volume of a sphere",
  // Expressions mathématiques
  "5 + 3 * 2",
  "100 / 4 - 10",
  "(15 + 5) * 2",
  "2^10",
  // Code inline
  "print('Hello World')",
  "console.log('test')",
  "[1, 2, 3, 4, 5]",
  "def hello(): pass",
];

CODE_QUESTIONS.forEach(q => {
  TEST_QUESTIONS.push({ question: q, expectedIntent: 'code_execution', category: 'code' });
});

// ============================================
// EXÉCUTION DU TEST
// ============================================
async function runQuickStressTest() {
  console.log('\\n========================================');
  console.log('QUICK STRESS TEST - Validation v4');
  console.log('========================================\\n');
  
  const results: Record<string, { passed: number; failed: number; failures: string[] }> = {};
  
  // Initialiser les résultats par catégorie
  const categories = ['search', 'image', 'code'];
  categories.forEach(cat => {
    results[cat] = { passed: 0, failed: 0, failures: [] };
  });
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Exécuter les tests
  for (const test of TEST_QUESTIONS) {
    const detected = detectIntent(test.question);
    const passed = detected.type === test.expectedIntent;
    
    if (passed) {
      results[test.category].passed++;
      totalPassed++;
    } else {
      results[test.category].failed++;
      totalFailed++;
      results[test.category].failures.push(
        `"${test.question}" → ${detected.type} (attendu: ${test.expectedIntent})`
      );
    }
  }
  
  // Afficher les résultats
  console.log('RÉSULTATS PAR CATÉGORIE:');
  console.log('------------------------');
  
  for (const [category, data] of Object.entries(results)) {
    const total = data.passed + data.failed;
    const rate = ((data.passed / total) * 100).toFixed(1);
    const status = parseFloat(rate) >= 85 ? '✅' : '❌';
    console.log(`${status} ${category.toUpperCase()}: ${data.passed}/${total} (${rate}%)`);
    
    if (data.failures.length > 0 && data.failures.length <= 10) {
      console.log('   Échecs:');
      data.failures.forEach(f => console.log(`   - ${f}`));
    } else if (data.failures.length > 10) {
      console.log(`   ${data.failures.length} échecs (affichage des 5 premiers):`);
      data.failures.slice(0, 5).forEach(f => console.log(`   - ${f}`));
    }
    console.log('');
  }
  
  // Résumé global
  const globalRate = ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1);
  const globalStatus = parseFloat(globalRate) >= 85 ? '✅' : '❌';
  
  console.log('========================================');
  console.log(`${globalStatus} TOTAL: ${totalPassed}/${totalPassed + totalFailed} (${globalRate}%)`);
  console.log('========================================\\n');
  
  return {
    total: totalPassed + totalFailed,
    passed: totalPassed,
    failed: totalFailed,
    rate: parseFloat(globalRate),
    results
  };
}

// Exécuter le test
runQuickStressTest().then(result => {
  console.log('Test terminé.');
  process.exit(result.rate >= 85 ? 0 : 1);
});

export { runQuickStressTest };
