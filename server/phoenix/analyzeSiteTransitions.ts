import { detectIntent } from './intentDetector';

// Questions de site qui échouent probablement
const SITE_TESTS = [
  // Patterns simples
  "Crée un site",
  "Fais un site",
  "Je veux un site",
  "Un site web svp",
  "Site pour mon business",
  "Site vitrine",
  "Landing page",
  "Page web",
  // Anglais
  "Create a site",
  "Make a site",
  "I want a site",
  "Website please",
  "Build a site",
  "E-commerce site",
  "Online store",
  "Portfolio website",
];

// Questions de transition
const TRANSITION_TESTS = [
  "Non pas ça, un site",
  "Finalement un site web",
  "En fait je préfère un site",
  "Plutôt un site",
  "Change pour un site",
  "Je veux un site à la place",
  "Oublie l'image, fais un site",
  "No, a website instead",
  "Actually I want a website",
  "Switch to a website",
];

console.log("\n=== SITE FAILURES ===");
let siteFails = 0;
for (const q of SITE_TESTS) {
  const r = detectIntent(q);
  if (r.type !== 'site_creation') {
    console.log(`FAIL: "${q}" -> ${r.type}`);
    siteFails++;
  }
}
console.log(`Site: ${SITE_TESTS.length - siteFails}/${SITE_TESTS.length} passed`);

console.log("\n=== TRANSITION FAILURES ===");
let transFails = 0;
for (const q of TRANSITION_TESTS) {
  const r = detectIntent(q);
  if (r.type !== 'site_creation') {
    console.log(`FAIL: "${q}" -> ${r.type}`);
    transFails++;
  }
}
console.log(`Transitions: ${TRANSITION_TESTS.length - transFails}/${TRANSITION_TESTS.length} passed`);
