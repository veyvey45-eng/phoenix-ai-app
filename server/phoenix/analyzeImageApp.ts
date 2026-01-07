import { detectIntent } from './intentDetector';

// Questions IMAGE qui échouent
const imageQuestions = [
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
];

// Questions APP qui échouent
const appQuestions = [
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
];

console.log('\n=== ANALYSE DES ÉCHECS IMAGE ===\n');
let imageFailed: string[] = [];
for (const q of imageQuestions) {
  const result = detectIntent(q);
  if (result.type !== 'image_generation') {
    imageFailed.push(`"${q}" → ${result.type}`);
  }
}
console.log(`Échecs IMAGE: ${imageFailed.length}/${imageQuestions.length}`);
imageFailed.slice(0, 10).forEach(f => console.log(`  ❌ ${f}`));

console.log('\n=== ANALYSE DES ÉCHECS APP ===\n');
let appFailed: string[] = [];
for (const q of appQuestions) {
  const result = detectIntent(q);
  if (result.type !== 'app_creation') {
    appFailed.push(`"${q}" → ${result.type}`);
  }
}
console.log(`Échecs APP: ${appFailed.length}/${appQuestions.length}`);
appFailed.slice(0, 10).forEach(f => console.log(`  ❌ ${f}`));
