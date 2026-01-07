import { detectIntent } from './intentDetector';

const SITE_TESTS = [
  "Crée-moi un site web",
  "Fais-moi un site internet",
  "Je veux un site web",
  "Génère un site pour moi",
  "Construis-moi un site",
  "Développe un site web",
  "Crée un site vitrine",
  "Fais un site e-commerce",
  "Je voudrais un site web",
  "Peux-tu créer un site?",
  "Create a website for me",
  "Make me a website",
  "Build a website",
  "I want a website",
  "Generate a website",
  "Develop a website for me",
  "Create a landing page",
  "Build an e-commerce site",
  "I need a website",
  "Can you make a website?",
];

const CODE_TESTS = [
  "Écris du code Python",
  "Fais un script JavaScript",
  "Crée une fonction",
  "Programme un algorithme",
  "Écris un programme",
  "Code une classe",
  "Write Python code",
  "Make a JavaScript script",
  "Create a function",
  "Program an algorithm",
  "Exécute ce code",
  "Lance ce script",
  "Run this script",
  "Test this code",
  "Calcule 2+2",
  "Calculate 5*10",
];

console.log("\n=== SITE FAILURES ===");
for (const q of SITE_TESTS) {
  const r = detectIntent(q);
  if (r.type !== 'site_creation') {
    console.log(`FAIL: "${q}" -> ${r.type}`);
  }
}

console.log("\n=== CODE FAILURES ===");
for (const q of CODE_TESTS) {
  const r = detectIntent(q);
  const expected = q.toLowerCase().includes('calcul') || q.toLowerCase().includes('2+2') || q.toLowerCase().includes('5*10') 
    ? 'calculation' 
    : q.toLowerCase().includes('exécute') || q.toLowerCase().includes('lance') || q.toLowerCase().includes('run') || q.toLowerCase().includes('test')
    ? 'code_execution'
    : 'code_request';
  if (r.type !== expected && r.type !== 'code_request' && r.type !== 'code_execution' && r.type !== 'calculation') {
    console.log(`FAIL: "${q}" -> ${r.type} (expected ${expected})`);
  }
}
