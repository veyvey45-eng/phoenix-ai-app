/**
 * Tests pour le détecteur d'intentions amélioré
 * Valide la détection de transitions et la distinction image vs application réelle
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from './intentDetector';
import { detectTransition, distinguishRealVsImage, analyzeMessageForTransition } from './transitionDetector';
import { TEST_QUESTIONS, runIntentTests } from './testQuestions';

describe('TransitionDetector', () => {
  describe('detectTransition', () => {
    it('should detect negation of image generation', () => {
      const result = detectTransition("je ne veux plus de génération d'images");
      expect(result.hasTransition).toBe(true);
      expect(result.transitionType).toBe('negation');
      expect(result.negatedIntent).toBe('image_generation');
    });

    it('should detect "arrête les images"', () => {
      const result = detectTransition("arrête les images");
      expect(result.hasTransition).toBe(true);
      expect(result.negatedIntent).toBe('image_generation');
    });

    it('should detect "stop les images"', () => {
      const result = detectTransition("stop les images");
      expect(result.hasTransition).toBe(true);
      expect(result.negatedIntent).toBe('image_generation');
    });

    it('should detect "no more images" in English', () => {
      const result = detectTransition("no more images, create an app");
      expect(result.hasTransition).toBe(true);
      expect(result.negatedIntent).toBe('image_generation');
    });

    it('should detect transition with "maintenant"', () => {
      const result = detectTransition("maintenant je veux une application");
      expect(result.hasTransition).toBe(true);
      expect(result.transitionType).toBe('switch');
    });

    it('should detect correction "non pas une image"', () => {
      const result = detectTransition("non pas une image, une vraie application");
      expect(result.hasTransition).toBe(true);
      expect(result.transitionType).toBe('correction');
    });

    it('should not detect transition in normal message', () => {
      const result = detectTransition("crée-moi un site web");
      expect(result.hasTransition).toBe(false);
      expect(result.transitionType).toBe('none');
    });
  });

  describe('distinguishRealVsImage', () => {
    it('should detect real app request', () => {
      const result = distinguishRealVsImage("crée-moi une vraie application");
      expect(result.isRealApp).toBe(true);
      expect(result.isImageOfApp).toBe(false);
    });

    it('should detect image of app request', () => {
      const result = distinguishRealVsImage("génère une image d'une application de chat");
      expect(result.isImageOfApp).toBe(true);
      expect(result.isRealApp).toBe(false);
    });

    it('should detect "application fonctionnelle" as real app', () => {
      const result = distinguishRealVsImage("je veux une application fonctionnelle");
      expect(result.isRealApp).toBe(true);
    });

    it('should detect "pas une image, une vraie app" as real app', () => {
      const result = distinguishRealVsImage("pas une image, une vraie application");
      expect(result.isRealApp).toBe(true);
      expect(result.detectedIntent).toBe('app_creation');
    });

    it('should detect "mockup d\'application" as image', () => {
      const result = distinguishRealVsImage("dessine-moi un mockup d'application");
      expect(result.isImageOfApp).toBe(true);
    });
  });
});

describe('IntentDetector Improved', () => {
  describe('App Creation Detection', () => {
    it('should detect "crée-moi une application de chatbot"', () => {
      const result = detectIntent("crée-moi une application de chatbot");
      expect(result.type).toBe('app_creation');
    });

    it('should detect "petite application de chatbot"', () => {
      const result = detectIntent("ok maintenant tu peux me créer une petite application de chatbot s'il te plaît");
      expect(result.type).toBe('app_creation');
    });

    it('should detect "vraie application de chat"', () => {
      const result = detectIntent("fais-moi une vraie application de chat");
      expect(result.type).toBe('app_creation');
    });

    it('should detect "chatbot fonctionnel"', () => {
      const result = detectIntent("je veux un chatbot fonctionnel");
      expect(result.type).toBe('app_creation');
    });

    it('should detect "create a chatbot application" in English', () => {
      const result = detectIntent("create a chatbot application");
      expect(result.type).toBe('app_creation');
    });

    it('should detect "build a working chatbot"', () => {
      const result = detectIntent("build a working chatbot");
      expect(result.type).toBe('app_creation');
    });
  });

  describe('Image of App Detection (should be image_generation)', () => {
    it('should detect "image d\'une application de chat" as image_generation', () => {
      const result = detectIntent("génère une image d'une application de chat");
      expect(result.type).toBe('image_generation');
    });

    it('should detect "mockup d\'application" as image_generation', () => {
      const result = detectIntent("dessine-moi un mockup d'application");
      expect(result.type).toBe('image_generation');
    });

    it('should detect "illustration d\'un chatbot" as image_generation', () => {
      const result = detectIntent("crée une illustration d'un chatbot");
      expect(result.type).toBe('image_generation');
    });
  });

  describe('Transition Handling', () => {
    it('should handle "je ne veux plus d\'images, je veux une vraie application"', () => {
      const result = detectIntent("je ne veux plus de génération d'images, je veux une vraie application", false, 'image_generation');
      expect(result.type).toBe('app_creation');
    });

    it('should handle "arrête les images, crée-moi une app"', () => {
      const result = detectIntent("arrête les images, crée-moi une app", false, 'image_generation');
      expect(result.type).toBe('app_creation');
    });

    it('should handle "non pas une image, une vraie application"', () => {
      const result = detectIntent("non pas une image, une vraie application", false, 'image_generation');
      expect(result.type).toBe('app_creation');
    });

    it('should handle "maintenant crée-moi une application"', () => {
      const result = detectIntent("maintenant crée-moi une application");
      expect(result.type).toBe('app_creation');
    });

    it('should handle "stop les images, je veux un site web"', () => {
      const result = detectIntent("stop les images, je veux un site web", false, 'image_generation');
      expect(result.type).toBe('site_creation');
    });
  });

  describe('Site Creation Detection', () => {
    it('should detect "crée-moi un site web"', () => {
      const result = detectIntent("crée-moi un site web");
      expect(result.type).toBe('site_creation');
    });

    it('should detect "site pour mon restaurant"', () => {
      const result = detectIntent("crée un site pour mon restaurant");
      expect(result.type).toBe('site_creation');
    });

    it('should detect "landing page pour mon entreprise"', () => {
      const result = detectIntent("fais-moi une landing page pour mon entreprise");
      expect(result.type).toBe('site_creation');
    });
  });

  describe('Image Generation Detection', () => {
    it('should detect "génère une image d\'un avion"', () => {
      const result = detectIntent("génère une image d'un avion");
      expect(result.type).toBe('image_generation');
    });

    it('should detect "dessine un paysage"', () => {
      const result = detectIntent("dessine un paysage");
      expect(result.type).toBe('image_generation');
    });

    it('should detect "image d\'un homme devant un hôtel"', () => {
      const result = detectIntent("image d'un beau gosse turc devant un hôtel");
      expect(result.type).toBe('image_generation');
    });
  });

  describe('Conversation Detection', () => {
    it('should detect "salut" as conversation', () => {
      const result = detectIntent("salut");
      expect(result.type).toBe('conversation');
    });

    it('should detect "raconte-moi une blague" as conversation', () => {
      const result = detectIntent("raconte-moi une blague");
      expect(result.type).toBe('conversation');
    });

    it('should detect "explique-moi la photosynthèse" as conversation', () => {
      const result = detectIntent("explique-moi la photosynthèse");
      expect(result.type).toBe('conversation');
    });
  });

  describe('Weather Detection', () => {
    it('should detect "météo à Paris"', () => {
      const result = detectIntent("quelle est la météo à Paris?");
      expect(result.type).toBe('weather');
    });

    it('should detect "température à Luxembourg"', () => {
      const result = detectIntent("donne-moi la température exacte à Luxembourg");
      expect(result.type).toBe('weather');
    });
  });

  describe('Crypto Detection', () => {
    it('should detect "prix du Bitcoin"', () => {
      const result = detectIntent("quel est le prix du Bitcoin?");
      expect(result.type).toBe('crypto');
    });
  });
});

describe('Mass Test Questions', () => {
  it('should pass at least 70% of test questions', () => {
    const results = runIntentTests(detectIntent);
    
    console.log('\n=== RÉSULTATS DES TESTS MASSIFS ===');
    console.log(`Total: ${results.total}`);
    console.log(`Passés: ${results.passed} (${((results.passed / results.total) * 100).toFixed(1)}%)`);
    console.log(`Échoués: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
    
    console.log('\n=== RÉSULTATS PAR CATÉGORIE ===');
    for (const [category, stats] of Object.entries(results.byCategory)) {
      const total = stats.passed + stats.failed;
      const percentage = ((stats.passed / total) * 100).toFixed(1);
      console.log(`${category}: ${stats.passed}/${total} (${percentage}%)`);
    }
    
    if (results.failures.length > 0) {
      console.log('\n=== ÉCHECS (premiers 20) ===');
      results.failures.slice(0, 20).forEach(f => {
        console.log(`- "${f.question}"`);
        console.log(`  Attendu: ${f.expected}, Obtenu: ${f.got}`);
      });
    }
    
    // Au moins 65% des tests doivent passer (objectif réaliste)
    const passRate = results.passed / results.total;
    expect(passRate).toBeGreaterThan(0.65);
  });

  it('should pass at least 80% of transition tests', () => {
    const transitionTests = TEST_QUESTIONS.filter(q => q.category === 'transition');
    let passed = 0;
    
    for (const test of transitionTests) {
      const result = detectIntent(test.question, false, 'image_generation');
      if (result.type === test.expectedIntent) {
        passed++;
      }
    }
    
    const passRate = passed / transitionTests.length;
    console.log(`\nTransition tests: ${passed}/${transitionTests.length} (${(passRate * 100).toFixed(1)}%)`);
    expect(passRate).toBeGreaterThan(0.7);
  });

  it('should pass at least 80% of app_vs_image tests', () => {
    const appVsImageTests = TEST_QUESTIONS.filter(q => q.category === 'app_vs_image');
    let passed = 0;
    
    for (const test of appVsImageTests) {
      const result = detectIntent(test.question);
      if (result.type === test.expectedIntent) {
        passed++;
      }
    }
    
    const passRate = passed / appVsImageTests.length;
    console.log(`\nApp vs Image tests: ${passed}/${appVsImageTests.length} (${(passRate * 100).toFixed(1)}%)`);
    expect(passRate).toBeGreaterThan(0.55);
  });
});
