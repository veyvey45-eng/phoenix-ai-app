/**
 * Stress Test Complet pour Phoenix AI
 * Ce script teste toutes les fonctionnalités de l'application
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/trpc`;

// Helper pour les requêtes tRPC
async function trpcCall(procedure: string, input: any, method: 'query' | 'mutation' = 'mutation') {
  const url = `${API_URL}/${procedure}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(method === 'query' ? { "0": { json: input } } : { json: input }),
  });
  return response.json();
}

// ============================================================================
// STRESS TEST 1: Chat et Conversation
// ============================================================================
describe('Stress Test - Chat et Conversation', () => {
  it('devrait répondre à une question simple', async () => {
    const response = await fetch(`${API_URL}/phoenix.chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          message: "Quelle est la capitale de la France?",
          fastMode: true
        }
      })
    });
    const data = await response.json();
    console.log('Chat response:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });

  it('devrait gérer plusieurs messages consécutifs', async () => {
    const messages = [
      "Bonjour Phoenix!",
      "Comment vas-tu?",
      "Peux-tu m'aider?"
    ];
    
    for (const msg of messages) {
      const response = await fetch(`${API_URL}/phoenix.chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { message: msg, fastMode: true } })
      });
      expect(response.status).toBeLessThan(500);
    }
  });
});

// ============================================================================
// STRESS TEST 2: Code Executor
// ============================================================================
describe('Stress Test - Code Executor', () => {
  it('devrait exécuter du code Python simple', async () => {
    const response = await fetch(`${API_URL}/codeInterpreter.executePythonPublic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          code: "print('Hello from Python!')\nresult = 2 + 2\nprint(f'2 + 2 = {result}')"
        }
      })
    });
    const data = await response.json();
    console.log('Python execution:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });

  it('devrait exécuter du code JavaScript', async () => {
    const response = await fetch(`${API_URL}/codeInterpreter.executeJavaScriptPublic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          code: "console.log('Hello from JavaScript!');\nconst sum = [1,2,3,4,5].reduce((a,b) => a+b, 0);\nconsole.log('Sum:', sum);"
        }
      })
    });
    const data = await response.json();
    console.log('JavaScript execution:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });

  it('devrait gérer les erreurs de code gracieusement', async () => {
    const response = await fetch(`${API_URL}/codeInterpreter.executePythonPublic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          code: "print(undefined_variable)"
        }
      })
    });
    const data = await response.json();
    console.log('Error handling:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 3: Création de Sites Web
// ============================================================================
describe('Stress Test - Création de Sites Web', () => {
  it('devrait lister les sites hébergés', async () => {
    const response = await fetch(`${API_URL}/hostedSites.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Sites list:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });

  it('devrait récupérer un site par slug', async () => {
    const response = await fetch(`${API_URL}/hostedSites.getBySlug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { slug: 'yachahotel-1vGF-GzG' } })
    });
    const data = await response.json();
    console.log('Site by slug:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 4: Recherche Web
// ============================================================================
describe('Stress Test - Recherche Web', () => {
  it('devrait effectuer une recherche web', async () => {
    const response = await fetch(`${API_URL}/phoenix.search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          query: "Luxembourg weather today"
        }
      })
    });
    const data = await response.json();
    console.log('Search results:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 5: Administration
// ============================================================================
describe('Stress Test - Administration', () => {
  it('devrait vérifier le statut admin', async () => {
    const response = await fetch(`${API_URL}/phoenix.admin.isAdmin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Admin status:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });

  it('devrait récupérer les modules', async () => {
    const response = await fetch(`${API_URL}/phoenix.admin.modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Modules:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 6: E2B Sandbox
// ============================================================================
describe('Stress Test - E2B Sandbox', () => {
  it('devrait vérifier les statistiques E2B', async () => {
    const response = await fetch(`${API_URL}/e2b.getStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('E2B Stats:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 7: Workspace et Projets
// ============================================================================
describe('Stress Test - Workspace et Projets', () => {
  it('devrait lister les projets', async () => {
    const response = await fetch(`${API_URL}/projects.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Projects list:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 8: Conversations
// ============================================================================
describe('Stress Test - Conversations', () => {
  it('devrait lister les conversations', async () => {
    const response = await fetch(`${API_URL}/phoenix.conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Conversations:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

// ============================================================================
// STRESS TEST 9: Sécurité
// ============================================================================
describe('Stress Test - Sécurité', () => {
  it('devrait vérifier le statut de sécurité', async () => {
    const response = await fetch(`${API_URL}/phoenix.security.status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: {} })
    });
    const data = await response.json();
    console.log('Security status:', JSON.stringify(data).substring(0, 500));
    expect(response.status).toBeLessThan(500);
  });
});

console.log('Stress test script loaded successfully!');
