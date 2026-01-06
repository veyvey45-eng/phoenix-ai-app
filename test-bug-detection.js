// Test du bug de détection - APRÈS CORRECTION
const message = "J'ai besoin d'un avis expert sur l'etherium s'il te plaît utilise tes ressources API pour me donner des données en temps réel et si nécessaire créer une table belle je veux savoir les derniers 30 jours jour pour jour le prix de ethereum le mois de décembre 2025";
const normalizedMessage = message.toLowerCase().trim();

console.log('=== TEST BUG DETECTION - APRÈS CORRECTION ===');
console.log('Message:', message);
console.log('');

// Patterns crypto (testés EN PREMIER maintenant)
const CRYPTO_PATTERNS = [
  /(?:bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain)/i,
  /(?:prix|price|cours|value)[\s-]*(?:du|de|of)?[\s-]*(?:bitcoin|btc|ethereum|eth|solana)/i,
];

// Patterns d'image
const IMAGE_GENERATION_PATTERNS = [
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner|produis|produire)[\s-]*(?:moi)?[\s-]*(?:une|un|l')?[\s-]*(?:image|photo|illustration|dessin|visuel|artwork|art)/i,
  /(?:image|photo|illustration|dessin)[\s-]*(?:de|d'|du|des|avec|représentant|montrant)/i,
  /(?:montre|montrer|visualise|visualiser)[\s-]*(?:moi)?[\s-]*(?:une|un)?/i,
  /(?:peux|peut|pourrais|pourrait)[\s-]*(?:tu|vous)?[\s-]*(?:me)?[\s-]*(?:génér|créer|faire|dessiner)/i,
  /(?:génère|générer|crée|créer|dessine|dessiner)[\s-]*(?:moi)?[\s-]*(?:un|une)/i,
  /(?:génère|générer|crée|créer|fais|faire|dessine|dessiner)[\s-]*(?:moi)?[\s-]*(?:un|une)?[\s-]*(?:avion|voiture|maison|chat|chien|paysage|portrait|logo|icône|personnage|robot|animal|monstre|dragon|oiseau|fleur|arbre|montagne|ville|bâtiment)/i,
];

// Mots-clés de données qui excluent la génération d'image
const dataKeywords = /(?:table|tableau|données|data|analyse|analysis|prix|price|api|statistiques|stats|graphique|chart|rapport|report|expert|avis)/i;

console.log('--- ÉTAPE 1: Test Patterns Crypto (PRIORITÉ HAUTE) ---');
let cryptoDetected = false;
for (let i = 0; i < CRYPTO_PATTERNS.length; i++) {
  const pattern = CRYPTO_PATTERNS[i];
  const result = pattern.test(normalizedMessage);
  if (result) {
    console.log(`Pattern ${i + 1}: MATCH ✅`);
    const match = normalizedMessage.match(pattern);
    console.log(`  Texte capturé: "${match[0]}"`);
    cryptoDetected = true;
  }
}

if (cryptoDetected) {
  console.log('');
  console.log('=== RÉSULTAT: CRYPTO DÉTECTÉ ✅ ===');
  console.log('Phoenix va maintenant répondre avec une analyse crypto, pas une image!');
  process.exit(0);
}

console.log('');
console.log('--- ÉTAPE 2: Test exclusion données ---');
const isDataRequest = dataKeywords.test(normalizedMessage);
console.log(`Contient des mots-clés de données: ${isDataRequest ? 'OUI ✅' : 'NON'}`);
if (isDataRequest) {
  const match = normalizedMessage.match(dataKeywords);
  console.log(`  Mot-clé trouvé: "${match[0]}"`);
}

console.log('');
console.log('--- ÉTAPE 3: Test Patterns Image (BLOQUÉ si données) ---');
if (isDataRequest) {
  console.log('⛔ Génération d\'image BLOQUÉE car c\'est une demande de données');
} else {
  for (let i = 0; i < IMAGE_GENERATION_PATTERNS.length; i++) {
    const pattern = IMAGE_GENERATION_PATTERNS[i];
    const result = pattern.test(normalizedMessage);
    if (result) {
      console.log(`Pattern ${i + 1}: MATCH`);
    }
  }
}

console.log('');
console.log('=== TEST RÉUSSI ===');
