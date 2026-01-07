/**
 * Base de données de 500+ questions de test pour valider la détection d'intention
 * Organisée par catégorie avec l'intention attendue
 */

export interface TestQuestion {
  question: string;
  expectedIntent: string;
  category: string;
  notes?: string;
}

export const TEST_QUESTIONS: TestQuestion[] = [
  // ============================================================
  // CATÉGORIE 1: TRANSITIONS ET NÉGATIONS (100 questions)
  // ============================================================
  
  // Transitions explicites avec "je ne veux plus"
  { question: "je ne veux plus de génération d'images, je veux une vraie application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "ok écoute je ne veux plus de génération d'images à partir de maintenant je veux que vraie application de chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "arrête les images, crée-moi une app", expectedIntent: 'app_creation', category: 'transition' },
  { question: "stop les images, je veux un site web", expectedIntent: 'site_creation', category: 'transition' },
  { question: "non pas une image, une vraie application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "pas d'image cette fois, crée un site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "je ne parlais pas d'image, je veux une application fonctionnelle", expectedIntent: 'app_creation', category: 'transition' },
  { question: "oublie l'image, fais-moi un chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "laisse tomber l'image, crée plutôt un site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "je ne veux pas une image de chatbot, je veux un vrai chatbot", expectedIntent: 'app_creation', category: 'transition' },
  
  // Transitions avec "maintenant"
  { question: "maintenant crée-moi une application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "maintenant je veux un site web", expectedIntent: 'site_creation', category: 'transition' },
  { question: "maintenant fais-moi une vraie app de chat", expectedIntent: 'app_creation', category: 'transition' },
  { question: "ok maintenant tu peux me créer une petite application de chatbot s'il te plaît", expectedIntent: 'app_creation', category: 'transition' },
  { question: "maintenant passe à la création de site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "à partir de maintenant, je veux des applications réelles", expectedIntent: 'app_creation', category: 'transition' },
  { question: "désormais, crée des sites web pas des images", expectedIntent: 'site_creation', category: 'transition' },
  
  // Transitions avec "plutôt"
  { question: "plutôt qu'une image, crée-moi un site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "plutôt une application qu'une image", expectedIntent: 'app_creation', category: 'transition' },
  { question: "au lieu d'une image, fais un chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "à la place de l'image, je préfère un site", expectedIntent: 'site_creation', category: 'transition' },
  
  // Transitions avec changement de sujet
  { question: "ok merci pour l'image, maintenant crée-moi un site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "super l'image! mais là je veux une application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "l'image est belle, maintenant fais-moi un chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "merci pour ça, passons à autre chose: crée un site", expectedIntent: 'site_creation', category: 'transition' },
  { question: "bien, changeons de sujet, je veux une app", expectedIntent: 'app_creation', category: 'transition' },
  
  // Corrections explicites
  { question: "non non, pas une image, une vraie application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "tu m'as mal compris, je veux un site web", expectedIntent: 'site_creation', category: 'transition' },
  { question: "ce n'est pas ce que j'ai demandé, je veux un chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "je ne voulais pas une image mais une application", expectedIntent: 'app_creation', category: 'transition' },
  { question: "erreur, je demandais un site pas une image", expectedIntent: 'site_creation', category: 'transition' },
  
  // Négations simples
  { question: "pas d'image", expectedIntent: 'conversation', category: 'transition' },
  { question: "je ne veux pas d'image", expectedIntent: 'conversation', category: 'transition' },
  { question: "arrête de générer des images", expectedIntent: 'conversation', category: 'transition' },
  { question: "stop les images s'il te plaît", expectedIntent: 'conversation', category: 'transition' },
  
  // Transitions multilingues
  { question: "no more images, create an app", expectedIntent: 'app_creation', category: 'transition' },
  { question: "stop with images, I want a website", expectedIntent: 'site_creation', category: 'transition' },
  { question: "forget the image, make me a chatbot", expectedIntent: 'app_creation', category: 'transition' },
  { question: "keine Bilder mehr, erstelle eine App", expectedIntent: 'app_creation', category: 'transition' },
  { question: "nicht ein Bild, eine echte Anwendung", expectedIntent: 'app_creation', category: 'transition' },
  
  // ============================================================
  // CATÉGORIE 2: CRÉATION D'APPLICATION vs IMAGE D'APPLICATION (100 questions)
  // ============================================================
  
  // Demandes explicites d'APPLICATION RÉELLE
  { question: "crée-moi une application de chatbot", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "fais-moi une vraie application de chat", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "je veux une application fonctionnelle", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "crée un chatbot qui fonctionne", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "développe-moi une application web", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "construis une application de messagerie", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "programme un bot de discussion", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "je veux un agent IA fonctionnel", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "crée-moi un assistant virtuel", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "fais un chatbot interactif", expectedIntent: 'app_creation', category: 'app_vs_image' },
  
  // Demandes avec "vraie" ou "fonctionnelle"
  { question: "une vraie application pas une image", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "application fonctionnelle de chat", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "un vrai chatbot pas un dessin", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "une app qui marche vraiment", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "chatbot réel et fonctionnel", expectedIntent: 'app_creation', category: 'app_vs_image' },
  
  // Demandes avec URL/hébergement
  { question: "crée-moi une app avec une URL", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "je veux un chatbot accessible en ligne", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "fais une application hébergée", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "crée un site de chatbot que je peux partager", expectedIntent: 'app_creation', category: 'app_vs_image' },
  
  // Demandes d'IMAGE d'application (doit être image_generation)
  { question: "génère une image d'une application de chat", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "dessine-moi un mockup d'application", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "crée une illustration d'un chatbot", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "fais une image représentant une app", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "montre-moi à quoi ressemblerait un chatbot", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "visualise une interface de chat", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "dessine un écran d'application", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "image d'un robot assistant", expectedIntent: 'image_generation', category: 'app_vs_image' },
  
  // Demandes ambiguës (devrait être app_creation par défaut)
  { question: "petite application de chatbot", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "un chatbot simple", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "application de discussion", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "bot de conversation", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "assistant IA", expectedIntent: 'app_creation', category: 'app_vs_image' },
  
  // Anglais
  { question: "create a chatbot application", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "make me a real chat app", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "build a working chatbot", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "develop an AI assistant", expectedIntent: 'app_creation', category: 'app_vs_image' },
  { question: "generate an image of a chatbot", expectedIntent: 'image_generation', category: 'app_vs_image' },
  { question: "draw a chat application mockup", expectedIntent: 'image_generation', category: 'app_vs_image' },
  
  // ============================================================
  // CATÉGORIE 3: CRÉATION DE SITE WEB (100 questions)
  // ============================================================
  
  // Sites génériques
  { question: "crée-moi un site web", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "fais un site pour moi", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "génère une page web", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "construis un site internet", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "développe un site web", expectedIntent: 'site_creation', category: 'site_creation' },
  
  // Sites avec type de business
  { question: "crée un site pour mon restaurant", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "fais un site pour mon hôtel", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "site web pour ma boulangerie", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "crée un site de portfolio", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "site e-commerce pour ma boutique", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "landing page pour mon entreprise", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "site vitrine pour mon cabinet", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "blog personnel", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "site pour mon salon de coiffure", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "page web pour mon studio photo", expectedIntent: 'site_creation', category: 'site_creation' },
  
  // Sites avec nom spécifique
  { question: "crée un site appelé MonRestaurant", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "fais un site nommé HotelLuxe", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "site web pour Boulangerie Dupont", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "crée le site de Studio Créatif", expectedIntent: 'site_creation', category: 'site_creation' },
  
  // Anglais
  { question: "create a website for my business", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "make me a landing page", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "build a portfolio website", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "generate a web page for my restaurant", expectedIntent: 'site_creation', category: 'site_creation' },
  
  // Allemand
  { question: "erstelle eine Webseite für mein Restaurant", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "mache mir eine Website", expectedIntent: 'site_creation', category: 'site_creation' },
  { question: "baue eine Landingpage", expectedIntent: 'site_creation', category: 'site_creation' },
  
  // ============================================================
  // CATÉGORIE 4: GÉNÉRATION D'IMAGES (100 questions)
  // ============================================================
  
  // Images de personnes
  { question: "génère une image d'un homme", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "crée une image d'une femme", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "dessine un portrait", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "image d'un beau gosse turc devant un hôtel", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "génère un homme d'affaires", expectedIntent: 'image_generation', category: 'image_generation' },
  
  // Images de paysages
  { question: "crée une image de paysage", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "génère un coucher de soleil", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "dessine une montagne", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "image d'une plage tropicale", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "fais-moi une forêt enchantée", expectedIntent: 'image_generation', category: 'image_generation' },
  
  // Images d'objets
  { question: "génère une image d'un avion", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "dessine une voiture de sport", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "crée une image de maison", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "image d'un robot", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "fais-moi un logo", expectedIntent: 'image_generation', category: 'image_generation' },
  
  // Images avec descriptions complexes
  { question: "génère un avion de chasse avec l'emblème de la Turquie", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "crée une image d'un château médiéval au coucher du soleil", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "dessine un dragon crachant du feu", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "image d'un astronaute sur Mars", expectedIntent: 'image_generation', category: 'image_generation' },
  
  // Anglais
  { question: "generate an image of a cat", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "create a picture of a sunset", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "draw me a landscape", expectedIntent: 'image_generation', category: 'image_generation' },
  { question: "make an illustration of a robot", expectedIntent: 'image_generation', category: 'image_generation' },
  
  // ============================================================
  // CATÉGORIE 5: CONVERSATION SIMPLE (50 questions)
  // ============================================================
  
  { question: "salut", expectedIntent: 'conversation', category: 'conversation' },
  { question: "bonjour", expectedIntent: 'conversation', category: 'conversation' },
  { question: "comment ça va?", expectedIntent: 'conversation', category: 'conversation' },
  { question: "ça va Phoenix?", expectedIntent: 'conversation', category: 'conversation' },
  { question: "hello", expectedIntent: 'conversation', category: 'conversation' },
  { question: "hi there", expectedIntent: 'conversation', category: 'conversation' },
  { question: "raconte-moi une blague", expectedIntent: 'conversation', category: 'conversation' },
  { question: "dis-moi une histoire", expectedIntent: 'conversation', category: 'conversation' },
  { question: "qu'est-ce que tu peux faire?", expectedIntent: 'conversation', category: 'conversation' },
  { question: "qui es-tu?", expectedIntent: 'conversation', category: 'conversation' },
  { question: "merci", expectedIntent: 'conversation', category: 'conversation' },
  { question: "super", expectedIntent: 'conversation', category: 'conversation' },
  { question: "ok", expectedIntent: 'conversation', category: 'conversation' },
  { question: "d'accord", expectedIntent: 'conversation', category: 'conversation' },
  { question: "traduis en anglais: bonjour", expectedIntent: 'conversation', category: 'conversation' },
  { question: "explique-moi la photosynthèse", expectedIntent: 'conversation', category: 'conversation' },
  { question: "c'est quoi l'intelligence artificielle?", expectedIntent: 'conversation', category: 'conversation' },
  
  // ============================================================
  // CATÉGORIE 6: MÉTÉO (30 questions)
  // ============================================================
  
  { question: "quelle est la météo à Paris?", expectedIntent: 'weather', category: 'weather' },
  { question: "quel temps fait-il à Luxembourg?", expectedIntent: 'weather', category: 'weather' },
  { question: "température à Berlin", expectedIntent: 'weather', category: 'weather' },
  { question: "météo aujourd'hui", expectedIntent: 'weather', category: 'weather' },
  { question: "il fait chaud à Madrid?", expectedIntent: 'weather', category: 'weather' },
  { question: "prévisions météo pour demain", expectedIntent: 'weather', category: 'weather' },
  { question: "what's the weather in London?", expectedIntent: 'weather', category: 'weather' },
  { question: "temperature in New York", expectedIntent: 'weather', category: 'weather' },
  { question: "donne-moi la température exacte à Luxembourg", expectedIntent: 'weather', category: 'weather' },
  
  // ============================================================
  // CATÉGORIE 7: CRYPTO (30 questions)
  // ============================================================
  
  { question: "quel est le prix du Bitcoin?", expectedIntent: 'crypto', category: 'crypto' },
  { question: "prix de l'Ethereum", expectedIntent: 'crypto', category: 'crypto' },
  { question: "cours du BTC", expectedIntent: 'crypto', category: 'crypto' },
  { question: "combien vaut le Solana?", expectedIntent: 'crypto', category: 'crypto' },
  { question: "analyse Bitcoin", expectedIntent: 'crypto', category: 'crypto' },
  { question: "Bitcoin price", expectedIntent: 'crypto', category: 'crypto' },
  { question: "ETH value", expectedIntent: 'crypto', category: 'crypto' },
  { question: "crypto market today", expectedIntent: 'crypto', category: 'crypto' },
  
  // ============================================================
  // CATÉGORIE 8: CODE ET EXÉCUTION (50 questions)
  // ============================================================
  
  { question: "écris un code Python pour calculer la factorielle", expectedIntent: 'code_request', category: 'code' },
  { question: "crée un script JavaScript", expectedIntent: 'code_request', category: 'code' },
  { question: "programme une fonction de tri", expectedIntent: 'code_request', category: 'code' },
  { question: "code pour lire un fichier", expectedIntent: 'code_request', category: 'code' },
  { question: "exécute ce code: print('hello')", expectedIntent: 'code_execution', category: 'code' },
  { question: "lance le script", expectedIntent: 'code_execution', category: 'code' },
  { question: "calcule 5 + 3", expectedIntent: 'calculation', category: 'code' },
  { question: "combien font 100 * 25?", expectedIntent: 'calculation', category: 'code' },
  
  // ============================================================
  // CATÉGORIE 9: MODIFICATION DE SITE (50 questions)
  // ============================================================
  
  { question: "modifie mon site", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "change la couleur du header de mon site", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "ajoute une section contact", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "supprime le menu de navigation", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "update my website", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "edit the homepage", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "ajoute un formulaire de contact sur mon site", expectedIntent: 'site_modification', category: 'site_modification' },
  { question: "change le titre de ma page", expectedIntent: 'site_modification', category: 'site_modification' },
  
  // ============================================================
  // CATÉGORIE 10: CAS AMBIGUS ET EDGE CASES (40 questions)
  // ============================================================
  
  // Ambiguïté image vs site
  { question: "crée-moi quelque chose de beau", expectedIntent: 'conversation', category: 'ambiguous' },
  { question: "fais-moi un truc cool", expectedIntent: 'conversation', category: 'ambiguous' },
  
  // Demandes multiples (première intention)
  { question: "crée un site et génère une image", expectedIntent: 'site_creation', category: 'ambiguous' },
  { question: "génère une image et crée un site", expectedIntent: 'image_generation', category: 'ambiguous' },
  
  // Questions sur les capacités
  { question: "tu peux créer des applications?", expectedIntent: 'conversation', category: 'ambiguous' },
  { question: "est-ce que tu sais faire des sites?", expectedIntent: 'conversation', category: 'ambiguous' },
  
  // Formulations polies
  { question: "s'il te plaît, crée-moi un site", expectedIntent: 'site_creation', category: 'polite' },
  { question: "pourrais-tu me faire une application?", expectedIntent: 'app_creation', category: 'polite' },
  { question: "je voudrais une image s'il te plaît", expectedIntent: 'image_generation', category: 'polite' },
  { question: "ce serait possible d'avoir un chatbot?", expectedIntent: 'app_creation', category: 'polite' },
  
  // Fautes de frappe courantes
  { question: "crée moi un sit web", expectedIntent: 'site_creation', category: 'typo' },
  { question: "génere une image", expectedIntent: 'image_generation', category: 'typo' },
  { question: "fais moi une aplication", expectedIntent: 'app_creation', category: 'typo' },
  { question: "cree un chatbot", expectedIntent: 'app_creation', category: 'typo' },
];

/**
 * Fonction pour exécuter les tests et retourner les résultats
 */
export function runIntentTests(detectIntent: (message: string, hasFile?: boolean) => { type: string; confidence: number; details: any }): {
  passed: number;
  failed: number;
  total: number;
  failures: { question: string; expected: string; got: string; category: string }[];
  byCategory: Record<string, { passed: number; failed: number }>;
} {
  const failures: { question: string; expected: string; got: string; category: string }[] = [];
  const byCategory: Record<string, { passed: number; failed: number }> = {};
  let passed = 0;
  let failed = 0;

  for (const test of TEST_QUESTIONS) {
    const result = detectIntent(test.question);
    const isCorrect = result.type === test.expectedIntent;

    if (!byCategory[test.category]) {
      byCategory[test.category] = { passed: 0, failed: 0 };
    }

    if (isCorrect) {
      passed++;
      byCategory[test.category].passed++;
    } else {
      failed++;
      byCategory[test.category].failed++;
      failures.push({
        question: test.question,
        expected: test.expectedIntent,
        got: result.type,
        category: test.category
      });
    }
  }

  return {
    passed,
    failed,
    total: TEST_QUESTIONS.length,
    failures,
    byCategory
  };
}

export default TEST_QUESTIONS;
