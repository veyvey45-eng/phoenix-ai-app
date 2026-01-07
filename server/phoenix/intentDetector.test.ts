/**
 * Tests pour le détecteur d'intentions
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, generateSystemPromptForIntent } from './intentDetector';

describe('Intent Detector', () => {
  describe('detectIntent', () => {
    describe('Conversation normale', () => {
      it('devrait détecter une conversation simple', () => {
        const result = detectIntent('Bonjour, comment vas-tu?');
        expect(result.type).toBe('conversation');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('devrait détecter une question générale', () => {
        const result = detectIntent('Raconte-moi une blague');
        expect(result.type).toBe('conversation');
      });

      it('devrait détecter une discussion amicale', () => {
        const result = detectIntent('Merci beaucoup pour ton aide!');
        expect(result.type).toBe('conversation');
      });
    });

    describe('Demandes de code explicites', () => {
      it('devrait détecter "écris-moi un code"', () => {
        const result = detectIntent('Écris-moi un code pour calculer les nombres premiers');
        expect(result.type).toBe('code_request');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('devrait détecter "crée un script python"', () => {
        const result = detectIntent('Crée un script python pour trier une liste');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('python');
      });

      it('devrait détecter "génère une fonction javascript"', () => {
        const result = detectIntent('Génère une fonction javascript pour valider un email');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('javascript');
      });

      it('devrait détecter "code pour"', () => {
        const result = detectIntent('Code pour faire un serveur web');
        expect(result.type).toBe('code_request');
      });

      it('devrait détecter "programme en typescript"', () => {
        const result = detectIntent('Fais-moi un programme en typescript');
        expect(result.type).toBe('code_request');
        expect(result.details.language).toBe('typescript');
      });
    });

    describe('Génération d\'images', () => {
      it('devrait détecter "génère une image"', () => {
        const result = detectIntent('Génère une image d\'un chat sur la lune');
        expect(result.type).toBe('image_generation');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('devrait détecter "crée une illustration"', () => {
        const result = detectIntent('Crée une illustration de paysage montagneux');
        expect(result.type).toBe('image_generation');
      });

      it('devrait détecter "dessine-moi"', () => {
        const result = detectIntent('Dessine-moi un chat');
        expect(result.type).toBe('image_generation');
      });

      it('devrait extraire le prompt d\'image', () => {
        const result = detectIntent('Génère une image d\'un chat sur la plage');
        expect(result.type).toBe('image_generation');
        expect(result.details.imagePrompt).toBeTruthy();
      });
    });

    describe('Météo', () => {
      it('devrait détecter une demande météo', () => {
        const result = detectIntent('Quel temps fait-il à Paris?');
        expect(result.type).toBe('weather');
      });

      it('devrait détecter "météo"', () => {
        const result = detectIntent('Météo Lyon demain');
        expect(result.type).toBe('weather');
      });

      it('devrait détecter "température"', () => {
        const result = detectIntent('Quelle est la température à Marseille?');
        expect(result.type).toBe('weather');
      });
    });

    describe('Crypto', () => {
      it('devrait détecter une demande crypto', () => {
        const result = detectIntent('Quel est le prix du Bitcoin?');
        expect(result.type).toBe('crypto');
      });

      it('devrait détecter "ethereum"', () => {
        const result = detectIntent('Cours de l\'Ethereum');
        expect(result.type).toBe('crypto');
      });
    });

    describe('Recherche web', () => {
      it('devrait détecter "recherche sur internet"', () => {
        const result = detectIntent('Recherche sur internet les actualités');
        expect(result.type).toBe('web_search');
      });

      it('devrait détecter "cherche sur google"', () => {
        const result = detectIntent('Cherche sur google les prix');
        expect(result.type).toBe('web_search');
      });
    });

    describe('Calculs', () => {
      it('devrait détecter une expression mathématique simple', () => {
        const result = detectIntent('2+2');
        expect(result.type).toBe('calculation');
      });

      it('devrait détecter une addition simple', () => {
        const result = detectIntent('5 + 3');
        expect(result.type).toBe('calculation');
      });
    });

    describe('Analyse de fichier', () => {
      it('devrait détecter une analyse de fichier', () => {
        const result = detectIntent('Analyse ce document', true);
        expect(result.type).toBe('file_analysis');
      });
    });

    describe('Non-détection de code pour questions simples', () => {
      it('ne devrait PAS détecter du code pour "comment ça marche"', () => {
        const result = detectIntent('Comment fonctionne une voiture?');
        expect(result.type).not.toBe('code_request');
      });

      it('ne devrait PAS détecter du code pour une explication', () => {
        const result = detectIntent('Explique-moi la photosynthèse');
        expect(result.type).not.toBe('code_request');
      });

      it('ne devrait PAS détecter du code pour une question de culture', () => {
        const result = detectIntent('Qui a inventé l\'ampoule?');
        expect(result.type).not.toBe('code_request');
      });
    });
  });

  describe('generateSystemPromptForIntent', () => {
    it('devrait générer un prompt pour conversation', () => {
      const intent = detectIntent('Bonjour!');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('Phoenix');
      expect(prompt).toContain('Conversation');
    });

    it('devrait générer un prompt pour code', () => {
      const intent = detectIntent('Écris un code python');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('code');
    });

    it('devrait générer un prompt pour image', () => {
      const intent = detectIntent('Génère une image de chat');
      const prompt = generateSystemPromptForIntent(intent);
      expect(prompt).toContain('image');
    });
  });
});


// ==========================================
// NOUVEAUX TESTS - AMÉLIORATIONS v3
// ==========================================

describe('IntentDetector - Tests de transitions améliorés', () => {
  describe('Transitions image vers site', () => {
    it('devrait détecter les transitions avec négation explicite', () => {
      const tests = [
        'Je ne veux plus d\'images, crée-moi un site web',
        'Arrête les images, fais-moi un site',
        'Stop les images, crée un site web'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('site_creation');
      }
    });

    it('devrait détecter les transitions avec "maintenant"', () => {
      const tests = [
        'Maintenant je veux un site web',
        'Now I want a website'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('site_creation');
      }
    });

    it('devrait détecter les transitions avec "plutôt"', () => {
      const tests = [
        'Plutôt crée-moi un site',
        'Rather build me a website'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('site_creation');
      }
    });

    it('devrait détecter les transitions avec "en fait/finalement"', () => {
      const tests = [
        'En fait, je préfère un site',
        'Actually, create a website instead'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('site_creation');
      }
    });

    it('devrait détecter les transitions avec "oublie/laisse tomber"', () => {
      const tests = [
        'Oublie les images, fais un site',
        'Forget the images, create a site',
        'Laisse tomber les images, je veux un site'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('site_creation');
      }
    });
  });

  describe('Transitions image vers app', () => {
    it('devrait détecter les transitions vers application', () => {
      const tests = [
        'Arrête de générer des images, fais-moi une app',
        'Stop generating images, create an app',
        'Plus d\'images, je veux une application'
      ];
      for (const test of tests) {
        const result = detectIntent(test, false, 'image_generation');
        expect(result.type).toBe('app_creation');
      }
    });
  });
});

describe('IntentDetector - Détection d\'applications améliorée', () => {
  it('devrait détecter les types d\'applications spécifiques', () => {
    const tests = [
      { input: 'Build a conversational bot', expected: 'app_creation' },
      { input: 'Create a management dashboard', expected: 'app_creation' },
      { input: 'Build an admin panel', expected: 'app_creation' },
      { input: 'Create a task manager', expected: 'app_creation' },
      { input: 'Build a scheduler', expected: 'app_creation' },
    ];
    for (const test of tests) {
      const result = detectIntent(test.input);
      expect(result.type).toBe(test.expected);
    }
  });
});

describe('IntentDetector - Détection d\'images améliorée', () => {
  it('devrait détecter les demandes d\'images visuelles explicites', () => {
    const tests = [
      'Crée une image de château',
      'Fais une image de dragon',
      'Dessine-moi un paysage',
      'Crée une illustration de robot',
      'Génère une image de chat'
    ];
    for (const test of tests) {
      const result = detectIntent(test);
      expect(result.type).toBe('image_generation');
    }
  });
});

describe('IntentDetector - Taux de réussite global >= 80%', () => {
  it('devrait avoir un taux de réussite >= 80% sur un échantillon représentatif', () => {
    const testCases = [
      // Conversation (10)
      { input: 'Bonjour', expected: 'conversation' },
      { input: 'Merci', expected: 'conversation' },
      { input: 'OK', expected: 'conversation' },
      { input: 'Hello', expected: 'conversation' },
      { input: 'Parfait', expected: 'conversation' },
      { input: 'Super', expected: 'conversation' },
      { input: 'D\'accord', expected: 'conversation' },
      { input: 'Salut', expected: 'conversation' },
      { input: 'Bye', expected: 'conversation' },
      { input: 'Thanks', expected: 'conversation' },
      // Image (10)
      { input: 'Génère une image de chat', expected: 'image_generation' },
      { input: 'Create a picture of a dog', expected: 'image_generation' },
      { input: 'Crée une image de paysage', expected: 'image_generation' },
      { input: 'Generate an image of a dragon', expected: 'image_generation' },
      { input: 'Fais une photo de montagne', expected: 'image_generation' },
      { input: 'Dessine-moi un robot', expected: 'image_generation' },
      { input: 'Crée une illustration', expected: 'image_generation' },
      { input: 'Generate a portrait', expected: 'image_generation' },
      { input: 'Fais une image de ville', expected: 'image_generation' },
      { input: 'Create an image of a castle', expected: 'image_generation' },
      // Site (10)
      { input: 'Crée-moi un site web', expected: 'site_creation' },
      { input: 'Build me a website', expected: 'site_creation' },
      { input: 'Fais-moi un site pour mon restaurant', expected: 'site_creation' },
      { input: 'Create a landing page', expected: 'site_creation' },
      { input: 'Crée un site e-commerce', expected: 'site_creation' },
      { input: 'Build a portfolio website', expected: 'site_creation' },
      { input: 'Fais-moi un site vitrine', expected: 'site_creation' },
      { input: 'Create an online store', expected: 'site_creation' },
      { input: 'Crée un site pour mon hôtel', expected: 'site_creation' },
      { input: 'Build a restaurant website', expected: 'site_creation' },
      // App (10)
      { input: 'Crée-moi une application de chatbot', expected: 'app_creation' },
      { input: 'Build me an AI agent', expected: 'app_creation' },
      { input: 'Fais-moi un bot de conversation', expected: 'app_creation' },
      { input: 'Create a chatbot', expected: 'app_creation' },
      { input: 'Crée un assistant virtuel', expected: 'app_creation' },
      { input: 'Build a customer service bot', expected: 'app_creation' },
      { input: 'Fais-moi un chatbot FAQ', expected: 'app_creation' },
      { input: 'Create a personal assistant', expected: 'app_creation' },
      { input: 'Crée une application fonctionnelle', expected: 'app_creation' },
      { input: 'Build a working application', expected: 'app_creation' },
      // Weather (5)
      { input: 'Météo à Paris', expected: 'weather' },
      { input: 'Weather in London', expected: 'weather' },
      { input: 'Quel temps fait-il?', expected: 'weather' },
      { input: 'Température à Lyon', expected: 'weather' },
      { input: 'What\'s the weather?', expected: 'weather' },
      // Crypto (5)
      { input: 'Prix du Bitcoin', expected: 'crypto' },
      { input: 'ETH price', expected: 'crypto' },
      { input: 'Cours de l\'Ethereum', expected: 'crypto' },
      { input: 'Bitcoin value', expected: 'crypto' },
      { input: 'Combien vaut le BTC?', expected: 'crypto' },
    ];

    let passed = 0;
    const failures: string[] = [];
    
    for (const testCase of testCases) {
      const result = detectIntent(testCase.input);
      if (result.type === testCase.expected) {
        passed++;
      } else {
        failures.push(`"${testCase.input}" → attendu: ${testCase.expected}, obtenu: ${result.type}`);
      }
    }

    const passRate = (passed / testCases.length) * 100;
    
    // Afficher les échecs pour le debug
    if (failures.length > 0) {
      console.log(`Échecs (${failures.length}):`, failures.slice(0, 5));
    }
    
    expect(passRate).toBeGreaterThanOrEqual(80);
  });
});
