const message = "Je vais très bien merci est-ce que tu peux me générer un avion de chasse avec l'emblème de la Turquie dessus s'il te plaît";
const normalizedMessage = message.toLowerCase().trim();

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

console.log('Testing message:', message);
console.log('Normalized:', normalizedMessage);
console.log('');

let matched = false;
for (let i = 0; i < IMAGE_GENERATION_PATTERNS.length; i++) {
  const pattern = IMAGE_GENERATION_PATTERNS[i];
  const result = pattern.test(normalizedMessage);
  console.log(`Pattern ${i + 1}: ${result ? 'MATCH ✓' : 'no match'}`);
  if (result) {
    matched = true;
  }
}

console.log('');
console.log('Final result:', matched ? '✅ IMAGE DETECTED' : '❌ NOT DETECTED');

// Test autres messages
console.log('\n--- Tests supplémentaires ---');
const testMessages = [
  "génère-moi une image de chat",
  "peux-tu me créer un logo",
  "dessine un dragon",
  "fais-moi un avion",
  "crée un paysage de montagne",
  "je voudrais une photo de voiture",
  "generate a picture of a robot"
];

for (const msg of testMessages) {
  let found = false;
  for (const pattern of IMAGE_GENERATION_PATTERNS) {
    if (pattern.test(msg.toLowerCase())) {
      found = true;
      break;
    }
  }
  console.log(`"${msg}": ${found ? '✅' : '❌'}`);
}
