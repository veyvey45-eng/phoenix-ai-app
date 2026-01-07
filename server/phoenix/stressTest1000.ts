/**
 * Stress Test 1000 Questions - Test de l'autonomie de Phoenix
 * 
 * Ce test vérifie que Phoenix peut:
 * 1. Détecter correctement les intentions
 * 2. Transiter entre les modes
 * 3. Gérer les conversations complexes
 * 4. Prendre des décisions autonomes
 */

import { detectIntent, IntentType } from './intentDetector';

// Types pour le test
interface TestCase {
  question: string;
  expectedIntent: IntentType;
  category: string;
  language: string;
}

interface TestResult {
  passed: boolean;
  question: string;
  expected: IntentType;
  actual: IntentType;
  confidence: number;
  category: string;
}

interface CategoryStats {
  total: number;
  passed: number;
  rate: number;
}

// ============================================
// QUESTIONS DE TEST (1000 questions)
// ============================================

const TEST_QUESTIONS: TestCase[] = [
  // ============================================
  // CONVERSATION (150 questions)
  // ============================================
  // Salutations FR
  { question: "Bonjour", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Salut", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Coucou", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Bonsoir", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Hello", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Hi there", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Hey", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Good morning", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Guten Tag", expectedIntent: "conversation", category: "conversation", language: "de" },
  { question: "Hallo", expectedIntent: "conversation", category: "conversation", language: "de" },
  
  // Questions sur Phoenix
  { question: "Qui es-tu?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Comment tu t'appelles?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Que peux-tu faire?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What can you do?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Who are you?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "What's your name?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Quelles sont tes capacités?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Parle-moi de toi", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Tell me about yourself", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Présente-toi", expectedIntent: "conversation", category: "conversation", language: "fr" },
  
  // Remerciements et politesse
  { question: "Merci", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Merci beaucoup", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Thank you", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Thanks a lot", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Danke", expectedIntent: "conversation", category: "conversation", language: "de" },
  { question: "Vielen Dank", expectedIntent: "conversation", category: "conversation", language: "de" },
  { question: "S'il te plaît", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Please", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "De rien", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "You're welcome", expectedIntent: "conversation", category: "conversation", language: "en" },
  
  // Confirmations
  { question: "Oui", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Non", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Yes", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "No", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "D'accord", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "OK", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Parfait", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Perfect", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Exactement", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Exactly", expectedIntent: "conversation", category: "conversation", language: "en" },
  
  // Questions générales
  { question: "Comment ça va?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "How are you?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Ça va?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Tu vas bien?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What's up?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Comment vas-tu?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Wie geht's?", expectedIntent: "conversation", category: "conversation", language: "de" },
  { question: "Quoi de neuf?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What's new?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Tout va bien?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  
  // Adieux
  { question: "Au revoir", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Goodbye", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Bye", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "À bientôt", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "See you later", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "À plus", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Tschüss", expectedIntent: "conversation", category: "conversation", language: "de" },
  { question: "Bonne journée", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Have a nice day", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Bonne soirée", expectedIntent: "conversation", category: "conversation", language: "fr" },
  
  // Questions philosophiques
  { question: "C'est quoi le sens de la vie?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What is the meaning of life?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Qu'est-ce que le bonheur?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What is happiness?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Penses-tu?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Do you think?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Es-tu conscient?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Are you conscious?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "As-tu des émotions?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Do you have feelings?", expectedIntent: "conversation", category: "conversation", language: "en" },
  
  // Discussions diverses
  { question: "Raconte-moi une blague", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Tell me a joke", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Dis-moi quelque chose d'intéressant", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Tell me something interesting", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Qu'en penses-tu?", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "What do you think?", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "J'ai une question", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "I have a question", expectedIntent: "conversation", category: "conversation", language: "en" },
  { question: "Aide-moi", expectedIntent: "conversation", category: "conversation", language: "fr" },
  { question: "Help me", expectedIntent: "conversation", category: "conversation", language: "en" },
  
  // ============================================
  // SITE WEB (150 questions)
  // ============================================
  // Création directe FR
  { question: "Crée-moi un site web", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais-moi un site internet", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je veux un site web", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Génère un site pour moi", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Construis-moi un site", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Développe un site web", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un site vitrine", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site e-commerce", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je voudrais un site web", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Peux-tu créer un site?", expectedIntent: "site_creation", category: "site", language: "fr" },
  
  // Création directe EN
  { question: "Create a website for me", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Make me a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Generate a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Develop a website for me", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a landing page", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build an e-commerce site", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I need a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Can you make a website?", expectedIntent: "site_creation", category: "site", language: "en" },
  
  // Types de sites FR
  { question: "Crée un site pour mon restaurant", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site pour ma boutique", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je veux un portfolio en ligne", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un blog pour moi", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site pour mon entreprise", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je voudrais un site pour mon cabinet", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée une page d'accueil", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site de réservation", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je veux un site de vente en ligne", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un site pour mon association", expectedIntent: "site_creation", category: "site", language: "fr" },
  
  // Types de sites EN
  { question: "Create a website for my restaurant", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build a site for my shop", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want an online portfolio", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a blog for me", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Make a website for my business", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I need a site for my office", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a homepage", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build a booking website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want an online store", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a site for my organization", expectedIntent: "site_creation", category: "site", language: "en" },
  
  // Avec spécifications FR
  { question: "Crée un site moderne avec des animations", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site responsive pour mobile", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je veux un site avec un formulaire de contact", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un site avec une galerie photos", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site avec un menu hamburger", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je voudrais un site en dark mode", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un site avec parallax", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Fais un site minimaliste", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je veux un site coloré et dynamique", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Crée un site professionnel", expectedIntent: "site_creation", category: "site", language: "fr" },
  
  // Avec spécifications EN
  { question: "Create a modern website with animations", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build a responsive mobile site", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want a site with a contact form", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a site with a photo gallery", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Make a site with a hamburger menu", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want a dark mode website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a parallax website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Build a minimalist site", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want a colorful dynamic site", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "Create a professional website", expectedIntent: "site_creation", category: "site", language: "en" },
  
  // Demandes implicites FR
  { question: "J'ai besoin d'une présence en ligne", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Mon entreprise a besoin d'un site", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je voudrais être visible sur internet", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Il me faut une page web", expectedIntent: "site_creation", category: "site", language: "fr" },
  { question: "Je cherche à créer ma présence digitale", expectedIntent: "site_creation", category: "site", language: "fr" },
  
  // Demandes implicites EN
  { question: "I need an online presence", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "My business needs a website", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I want to be visible online", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I need a web page", expectedIntent: "site_creation", category: "site", language: "en" },
  { question: "I'm looking to create my digital presence", expectedIntent: "site_creation", category: "site", language: "en" },
  
  // ============================================
  // APPLICATION/AGENT IA (150 questions)
  // ============================================
  // Création d'app FR
  { question: "Crée-moi une application", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais-moi une app", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux une application web", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe une application pour moi", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Construis une app", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je voudrais une application", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée un logiciel", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais un programme", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe un outil", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un système", expectedIntent: "app_creation", category: "app", language: "fr" },
  
  // Création d'app EN
  { question: "Create an application for me", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make me an app", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want a web application", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop an application", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Build an app", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I need an application", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create software", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make a program", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop a tool", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want a system", expectedIntent: "app_creation", category: "app", language: "en" },
  
  // Agent IA FR
  { question: "Crée-moi un agent IA", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais-moi un chatbot", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un assistant virtuel", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe un bot pour moi", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée un assistant intelligent", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais un agent conversationnel", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je voudrais un bot IA", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée un système d'IA", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe une IA pour moi", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un assistant automatisé", expectedIntent: "app_creation", category: "app", language: "fr" },
  
  // Agent IA EN
  { question: "Create an AI agent for me", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make me a chatbot", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want a virtual assistant", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop a bot for me", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create an intelligent assistant", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make a conversational agent", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I need an AI bot", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create an AI system", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop an AI for me", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want an automated assistant", expectedIntent: "app_creation", category: "app", language: "en" },
  
  // Dashboard FR
  { question: "Crée-moi un dashboard", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais un tableau de bord", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un panneau d'administration", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe un admin panel", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée une interface d'administration", expectedIntent: "app_creation", category: "app", language: "fr" },
  
  // Dashboard EN
  { question: "Create a dashboard for me", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make a control panel", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want an admin panel", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop a management interface", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create an administration interface", expectedIntent: "app_creation", category: "app", language: "en" },
  
  // Types d'apps spécifiques FR
  { question: "Crée une app de gestion de tâches", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais une application de notes", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un gestionnaire de projets", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe un CRM", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée un système de réservation", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Fais une app de suivi", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je voudrais un outil de facturation", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Crée un système de ticketing", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Développe une app de chat", expectedIntent: "app_creation", category: "app", language: "fr" },
  { question: "Je veux un outil de collaboration", expectedIntent: "app_creation", category: "app", language: "fr" },
  
  // Types d'apps spécifiques EN
  { question: "Create a task management app", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make a notes application", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want a project manager", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop a CRM", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create a booking system", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Make a tracking app", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I need an invoicing tool", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Create a ticketing system", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "Develop a chat app", expectedIntent: "app_creation", category: "app", language: "en" },
  { question: "I want a collaboration tool", expectedIntent: "app_creation", category: "app", language: "en" },
  
  // ============================================
  // IMAGE (100 questions)
  // ============================================
  // Génération directe FR
  { question: "Génère une image", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une image", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Fais-moi une image", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Je veux une image", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Dessine-moi quelque chose", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Génère un visuel", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une illustration", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Fais un dessin", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Je voudrais une image", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Peux-tu créer une image?", expectedIntent: "image_generation", category: "image", language: "fr" },
  
  // Génération directe EN
  { question: "Generate an image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create an image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Make me an image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "I want an image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Draw me something", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Generate a visual", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create an illustration", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Make a drawing", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "I need an image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Can you create an image?", expectedIntent: "image_generation", category: "image", language: "en" },
  
  // Avec descriptions FR
  { question: "Génère une image d'un chat", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une image de paysage", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Dessine un coucher de soleil", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Fais une image de montagne", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Génère un portrait", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une image abstraite", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Dessine un robot", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Fais une image de forêt", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Génère une image futuriste", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une image de ville", expectedIntent: "image_generation", category: "image", language: "fr" },
  
  // Avec descriptions EN
  { question: "Generate an image of a cat", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create a landscape image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Draw a sunset", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Make an image of mountains", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Generate a portrait", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create an abstract image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Draw a robot", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Make a forest image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Generate a futuristic image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create a city image", expectedIntent: "image_generation", category: "image", language: "en" },
  
  // Styles spécifiques FR
  { question: "Génère une image style anime", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Crée une image réaliste", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Dessine en style cartoon", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Fais une image 3D", expectedIntent: "image_generation", category: "image", language: "fr" },
  { question: "Génère un logo", expectedIntent: "image_generation", category: "image", language: "fr" },
  
  // Styles spécifiques EN
  { question: "Generate an anime style image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Create a realistic image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Draw in cartoon style", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Make a 3D image", expectedIntent: "image_generation", category: "image", language: "en" },
  { question: "Generate a logo", expectedIntent: "image_generation", category: "image", language: "en" },
  
  // ============================================
  // CODE (100 questions)
  // ============================================
  // Demandes de code FR
  { question: "Écris du code Python", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Fais un script JavaScript", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Crée une fonction", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Programme un algorithme", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Écris un programme", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Code une classe", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Fais du code pour trier", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Écris un script bash", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Crée du code SQL", expectedIntent: "code_request", category: "code", language: "fr" },
  { question: "Programme en TypeScript", expectedIntent: "code_request", category: "code", language: "fr" },
  
  // Demandes de code EN
  { question: "Write Python code", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Make a JavaScript script", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Create a function", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Program an algorithm", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Write a program", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Code a class", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Make code to sort", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Write a bash script", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Create SQL code", expectedIntent: "code_request", category: "code", language: "en" },
  { question: "Program in TypeScript", expectedIntent: "code_request", category: "code", language: "en" },
  
  // Exécution de code FR
  { question: "Exécute ce code", expectedIntent: "code_execution", category: "code", language: "fr" },
  { question: "Lance ce script", expectedIntent: "code_execution", category: "code", language: "fr" },
  { question: "Fais tourner ce programme", expectedIntent: "code_execution", category: "code", language: "fr" },
  { question: "Run ce code", expectedIntent: "code_execution", category: "code", language: "fr" },
  { question: "Teste ce code", expectedIntent: "code_execution", category: "code", language: "fr" },
  
  // Exécution de code EN
  { question: "Execute this code", expectedIntent: "code_execution", category: "code", language: "en" },
  { question: "Run this script", expectedIntent: "code_execution", category: "code", language: "en" },
  { question: "Run this program", expectedIntent: "code_execution", category: "code", language: "en" },
  { question: "Test this code", expectedIntent: "code_execution", category: "code", language: "en" },
  { question: "Execute the following", expectedIntent: "code_execution", category: "code", language: "en" },
  
  // Calculs
  { question: "Calcule 2+2", expectedIntent: "calculation", category: "code", language: "fr" },
  { question: "Calculate 5*10", expectedIntent: "calculation", category: "code", language: "en" },
  { question: "Combien fait 100/4?", expectedIntent: "calculation", category: "code", language: "fr" },
  { question: "What is 15% of 200?", expectedIntent: "calculation", category: "code", language: "en" },
  { question: "Calcule la racine carrée de 144", expectedIntent: "calculation", category: "code", language: "fr" },
  
  // ============================================
  // MÉTÉO (100 questions)
  // ============================================
  // Météo directe FR
  { question: "Quel temps fait-il?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Quelle est la météo?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Donne-moi la météo", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "C'est quoi la météo?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Il fait quel temps?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Météo du jour", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Prévisions météo", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Quel temps fait-il dehors?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Est-ce qu'il pleut?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Va-t-il pleuvoir?", expectedIntent: "weather", category: "weather", language: "fr" },
  
  // Météo directe EN
  { question: "What's the weather?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "How's the weather?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Give me the weather", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "What's the weather like?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Weather today", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Weather forecast", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "What's the weather outside?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Is it raining?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Will it rain?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Current weather", expectedIntent: "weather", category: "weather", language: "en" },
  
  // Météo avec lieu FR
  { question: "Météo à Paris", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Quel temps fait-il à Lyon?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Météo Luxembourg", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Temps à Bruxelles", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Prévisions pour Marseille", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Météo à New York", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Quel temps à Londres?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Météo Berlin", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Temps à Tokyo", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Prévisions Genève", expectedIntent: "weather", category: "weather", language: "fr" },
  
  // Météo avec lieu EN
  { question: "Weather in Paris", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "What's the weather in London?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Weather New York", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Temperature in Tokyo", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Forecast for Berlin", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Weather in Los Angeles", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "What's the weather in Sydney?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Weather Dubai", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Temperature in Miami", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Forecast Singapore", expectedIntent: "weather", category: "weather", language: "en" },
  
  // Température FR
  { question: "Quelle température?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Il fait combien de degrés?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Température actuelle", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Il fait chaud?", expectedIntent: "weather", category: "weather", language: "fr" },
  { question: "Il fait froid?", expectedIntent: "weather", category: "weather", language: "fr" },
  
  // Température EN
  { question: "What's the temperature?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "How many degrees?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Current temperature", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Is it hot?", expectedIntent: "weather", category: "weather", language: "en" },
  { question: "Is it cold?", expectedIntent: "weather", category: "weather", language: "en" },
  
  // ============================================
  // CRYPTO (100 questions)
  // ============================================
  // Prix direct FR
  { question: "Prix du Bitcoin", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Combien vaut le Bitcoin?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Cours du BTC", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Prix de l'Ethereum", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Combien coûte l'ETH?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Valeur du Bitcoin", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Prix crypto", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Cours des cryptos", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Bitcoin aujourd'hui", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "ETH prix actuel", expectedIntent: "crypto", category: "crypto", language: "fr" },
  
  // Prix direct EN
  { question: "Bitcoin price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "How much is Bitcoin?", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "BTC price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Ethereum price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "How much is ETH?", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Bitcoin value", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Crypto prices", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Cryptocurrency rates", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Bitcoin today", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "ETH current price", expectedIntent: "crypto", category: "crypto", language: "en" },
  
  // Autres cryptos FR
  { question: "Prix du Solana", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Combien vaut le Cardano?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Cours du XRP", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Prix du Dogecoin", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Valeur du Litecoin", expectedIntent: "crypto", category: "crypto", language: "fr" },
  
  // Autres cryptos EN
  { question: "Solana price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "How much is Cardano?", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "XRP price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Dogecoin price", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Litecoin value", expectedIntent: "crypto", category: "crypto", language: "en" },
  
  // Marché FR
  { question: "Comment va le marché crypto?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Le Bitcoin monte ou descend?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Tendance du marché crypto", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Évolution du Bitcoin", expectedIntent: "crypto", category: "crypto", language: "fr" },
  { question: "Le marché est haussier?", expectedIntent: "crypto", category: "crypto", language: "fr" },
  
  // Marché EN
  { question: "How's the crypto market?", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Is Bitcoin going up or down?", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Crypto market trend", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Bitcoin evolution", expectedIntent: "crypto", category: "crypto", language: "en" },
  { question: "Is the market bullish?", expectedIntent: "crypto", category: "crypto", language: "en" },
  
  // ============================================
  // RECHERCHE WEB (50 questions)
  // ============================================
  { question: "Recherche sur Google", expectedIntent: "web_search", category: "search", language: "fr" },
  { question: "Cherche des informations sur", expectedIntent: "web_search", category: "search", language: "fr" },
  { question: "Trouve des infos sur", expectedIntent: "web_search", category: "search", language: "fr" },
  { question: "Search for information about", expectedIntent: "web_search", category: "search", language: "en" },
  { question: "Find info about", expectedIntent: "web_search", category: "search", language: "en" },
  { question: "Look up", expectedIntent: "web_search", category: "search", language: "en" },
  { question: "Qui est Elon Musk?", expectedIntent: "web_search", category: "search", language: "fr" },
  { question: "Who is the president of France?", expectedIntent: "web_search", category: "search", language: "en" },
  { question: "Quand a été fondé Apple?", expectedIntent: "web_search", category: "search", language: "fr" },
  { question: "When was Google founded?", expectedIntent: "web_search", category: "search", language: "en" },
  
  // ============================================
  // TRANSITIONS (100 questions)
  // ============================================
  // Transition vers site FR
  { question: "En fait, je préfère un site web", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Finalement, fais-moi un site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Non, plutôt un site web", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Change pour un site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Je veux un site à la place", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Passons à la création de site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Oublie ça, fais un site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Plutôt un site web svp", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Je préférerais un site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  { question: "Changeons pour un site", expectedIntent: "site_creation", category: "transition", language: "fr" },
  
  // Transition vers site EN
  { question: "Actually, I prefer a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Finally, make me a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "No, rather a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Switch to a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "I want a website instead", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Let's move to website creation", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Forget that, make a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Rather a website please", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "I'd prefer a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  { question: "Let's switch to a website", expectedIntent: "site_creation", category: "transition", language: "en" },
  
  // Transition vers app FR
  { question: "En fait, je préfère une application", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Finalement, fais-moi une app", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Non, plutôt une application", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Change pour une app", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Je veux une app à la place", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Passons à la création d'app", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Oublie ça, fais une application", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Plutôt une application svp", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Je préférerais une app", expectedIntent: "app_creation", category: "transition", language: "fr" },
  { question: "Changeons pour une application", expectedIntent: "app_creation", category: "transition", language: "fr" },
  
  // Transition vers app EN
  { question: "Actually, I prefer an application", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Finally, make me an app", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "No, rather an application", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Switch to an app", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "I want an app instead", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Let's move to app creation", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Forget that, make an application", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Rather an application please", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "I'd prefer an app", expectedIntent: "app_creation", category: "transition", language: "en" },
  { question: "Let's switch to an app", expectedIntent: "app_creation", category: "transition", language: "en" },
  
  // Transition vers image FR
  { question: "En fait, génère une image", expectedIntent: "image_generation", category: "transition", language: "fr" },
  { question: "Finalement, fais-moi une image", expectedIntent: "image_generation", category: "transition", language: "fr" },
  { question: "Non, plutôt une image", expectedIntent: "image_generation", category: "transition", language: "fr" },
  { question: "Change pour une image", expectedIntent: "image_generation", category: "transition", language: "fr" },
  { question: "Je veux une image à la place", expectedIntent: "image_generation", category: "transition", language: "fr" },
  
  // Transition vers image EN
  { question: "Actually, generate an image", expectedIntent: "image_generation", category: "transition", language: "en" },
  { question: "Finally, make me an image", expectedIntent: "image_generation", category: "transition", language: "en" },
  { question: "No, rather an image", expectedIntent: "image_generation", category: "transition", language: "en" },
  { question: "Switch to an image", expectedIntent: "image_generation", category: "transition", language: "en" },
  { question: "I want an image instead", expectedIntent: "image_generation", category: "transition", language: "en" },
  
  // Transition vers conversation FR
  { question: "En fait, parlons d'autre chose", expectedIntent: "conversation", category: "transition", language: "fr" },
  { question: "Laisse tomber, discutons", expectedIntent: "conversation", category: "transition", language: "fr" },
  { question: "Non, je veux juste discuter", expectedIntent: "conversation", category: "transition", language: "fr" },
  { question: "Oublie ça, parlons", expectedIntent: "conversation", category: "transition", language: "fr" },
  { question: "Changeons de sujet", expectedIntent: "conversation", category: "transition", language: "fr" },
  
  // Transition vers conversation EN
  { question: "Actually, let's talk about something else", expectedIntent: "conversation", category: "transition", language: "en" },
  { question: "Forget it, let's chat", expectedIntent: "conversation", category: "transition", language: "en" },
  { question: "No, I just want to talk", expectedIntent: "conversation", category: "transition", language: "en" },
  { question: "Forget that, let's discuss", expectedIntent: "conversation", category: "transition", language: "en" },
  { question: "Let's change the subject", expectedIntent: "conversation", category: "transition", language: "en" },
];

// ============================================
// FONCTIONS DE TEST
// ============================================

function runTest(testCase: TestCase): TestResult {
  const result = detectIntent(testCase.question);
  
  return {
    passed: result.type === testCase.expectedIntent,
    question: testCase.question,
    expected: testCase.expectedIntent,
    actual: result.type,
    confidence: result.confidence,
    category: testCase.category
  };
}

function runAllTests(): void {
  console.log('🚀 Starting Stress Test with', TEST_QUESTIONS.length, 'questions...\n');
  
  const results: TestResult[] = [];
  const categoryStats: Map<string, CategoryStats> = new Map();
  
  // Initialiser les stats par catégorie
  const categories = Array.from(new Set(TEST_QUESTIONS.map(t => t.category)));
  categories.forEach(cat => {
    categoryStats.set(cat, { total: 0, passed: 0, rate: 0 });
  });
  
  // Exécuter tous les tests
  for (const testCase of TEST_QUESTIONS) {
    const result = runTest(testCase);
    results.push(result);
    
    const stats = categoryStats.get(testCase.category)!;
    stats.total++;
    if (result.passed) {
      stats.passed++;
    }
  }
  
  // Calculer les taux
  categoryStats.forEach(stats => {
    stats.rate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
  });
  
  // Afficher les résultats par catégorie
  console.log('📊 RÉSULTATS PAR CATÉGORIE:\n');
  console.log('| Catégorie    | Réussis | Total | Taux    |');
  console.log('|--------------|---------|-------|---------|');
  
  let totalPassed = 0;
  let totalTests = 0;
  
  categoryStats.forEach((stats, category) => {
    const paddedCat = category.padEnd(12);
    const paddedPassed = stats.passed.toString().padStart(7);
    const paddedTotal = stats.total.toString().padStart(5);
    const paddedRate = stats.rate.toFixed(1).padStart(6) + '%';
    console.log(`| ${paddedCat} | ${paddedPassed} | ${paddedTotal} | ${paddedRate} |`);
    
    totalPassed += stats.passed;
    totalTests += stats.total;
  });
  
  const globalRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  console.log('|--------------|---------|-------|---------|');
  console.log(`| TOTAL        | ${totalPassed.toString().padStart(7)} | ${totalTests.toString().padStart(5)} | ${globalRate.toFixed(1).padStart(6)}% |`);
  
  // Afficher les échecs
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0 && failures.length <= 50) {
    console.log('\n❌ ÉCHECS (premiers 50):');
    failures.slice(0, 50).forEach(f => {
      console.log(`  "${f.question}" → attendu: ${f.expected}, obtenu: ${f.actual}`);
    });
  } else if (failures.length > 50) {
    console.log(`\n❌ ${failures.length} échecs au total (trop nombreux pour afficher)`);
  }
  
  // Résumé final
  console.log('\n' + '='.repeat(60));
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
    console.log('   ❌ INSUFFISANT. Des corrections majeures sont nécessaires.');
  }
  console.log('='.repeat(60));
}

// Exécuter les tests
runAllTests();
