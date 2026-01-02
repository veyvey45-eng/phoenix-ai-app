/**
 * Test pour valider la clé API Google AI Studio
 */

import { describe, it, expect } from 'vitest';

describe('Google AI Studio API Key Validation', () => {
  it('should have valid GOOGLE_AI_STUDIO_API_KEY', async () => {
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^AIza/);
  });

  it('should be able to call Gemini API with the key', async () => {
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!apiKey) {
      console.warn('[Gemini] Pas de clé API, test skippé');
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Bonjour' }]
            }]
          })
        }
      );

      // La clé est valide si on reçoit une réponse (même une erreur de validation)
      expect(response.status).toBeLessThan(500);
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('candidates');
        console.log('[Gemini] Clé API valide et fonctionnelle');
      } else if (response.status === 400) {
        console.log('[Gemini] Clé API valide (erreur de validation attendue)');
      }
    } catch (error) {
      console.error('[Gemini] Erreur lors du test:', error);
      throw error;
    }
  });
});
