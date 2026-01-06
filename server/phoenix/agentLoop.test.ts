/**
 * Tests pour l'Agent Loop RÉEL
 * Vérifie que Phoenix peut exécuter des tâches multi-étapes automatiquement
 */

import { describe, it, expect } from 'vitest';
import { 
  shouldUseAgentLoop, 
  AgentTask,
  AgentTaskResult
} from './agentLoop';

describe('Agent Loop - Détection de tâches complexes', () => {
  it('devrait détecter une demande de recherche + analyse', () => {
    expect(shouldUseAgentLoop('Recherche les dernières news crypto et analyse les tendances')).toBe(true);
    expect(shouldUseAgentLoop('Analyse les news du Bitcoin et fais-moi un résumé')).toBe(true);
  });

  it('devrait détecter une demande de rapport', () => {
    expect(shouldUseAgentLoop('Fais-moi un rapport sur les actions tech')).toBe(true);
    expect(shouldUseAgentLoop('Génère un rapport détaillé sur le marché immobilier')).toBe(true);
  });

  it('devrait détecter une demande multi-étapes explicite', () => {
    expect(shouldUseAgentLoop("D'abord recherche, puis analyse, ensuite résume")).toBe(true);
    expect(shouldUseAgentLoop('Premièrement trouve les données, deuxièmement analyse-les')).toBe(true);
  });

  it('devrait détecter une demande de collecte de données', () => {
    expect(shouldUseAgentLoop('Collecte les données de plusieurs sources')).toBe(true);
    expect(shouldUseAgentLoop('Récupère les informations de plusieurs sites web')).toBe(true);
  });

  it('ne devrait PAS détecter une question simple', () => {
    expect(shouldUseAgentLoop('Quelle heure est-il ?')).toBe(false);
    expect(shouldUseAgentLoop('Bonjour, comment vas-tu ?')).toBe(false);
    expect(shouldUseAgentLoop('Calcule 2 + 2')).toBe(false);
  });

  it('ne devrait PAS détecter une demande de code simple', () => {
    expect(shouldUseAgentLoop('Écris une fonction Python pour trier une liste')).toBe(false);
    expect(shouldUseAgentLoop('Génère du code JavaScript pour un bouton')).toBe(false);
  });
});

describe('Agent Loop - Types de tâches', () => {
  it('devrait avoir les bons types de tâches', () => {
    const validTypes = ['browse', 'search', 'code', 'analyze', 'generate', 'save'];
    
    const task: AgentTask = {
      id: '1',
      type: 'search',
      description: 'Test',
      input: 'query'
    };
    
    expect(validTypes).toContain(task.type);
  });

  it('devrait supporter les dépendances entre tâches', () => {
    const task: AgentTask = {
      id: '2',
      type: 'analyze',
      description: 'Analyser les résultats',
      input: '{{result_1}}',
      dependencies: ['1']
    };
    
    expect(task.dependencies).toContain('1');
  });
});

describe('Agent Loop - Résultats', () => {
  it('devrait avoir la structure correcte pour les résultats', () => {
    const result: AgentTaskResult = {
      taskId: '1',
      success: true,
      output: 'Test output',
      duration: 1000
    };
    
    expect(result.taskId).toBe('1');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Test output');
    expect(result.duration).toBe(1000);
  });

  it('devrait supporter les erreurs dans les résultats', () => {
    const result: AgentTaskResult = {
      taskId: '1',
      success: false,
      output: '',
      error: 'Test error',
      duration: 500
    };
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
  });
});

describe('Agent Loop - Patterns de détection exhaustifs', () => {
  const complexPatterns = [
    'Recherche les news et analyse les tendances',
    'Fais un rapport sur le marché',
    'Compare plusieurs sources et synthétise',
    'Collecte les données de différents sites',
    "D'abord cherche, puis analyse",
    'Benchmark les performances',
    'Génère une synthèse complète',
    'Évalue différentes options',
    'Crée une synthèse des résultats',
    'Produis un document complet'
  ];

  const simplePatterns = [
    'Bonjour',
    'Quelle est la capitale de la France ?',
    'Calcule 10 * 5',
    'Écris un poème',
    'Traduis ce texte',
    'Explique-moi la photosynthèse',
    'Donne-moi la météo',
    'Quel temps fait-il ?'
  ];

  complexPatterns.forEach(pattern => {
    it(`devrait détecter comme complexe: "${pattern.substring(0, 40)}..."`, () => {
      expect(shouldUseAgentLoop(pattern)).toBe(true);
    });
  });

  simplePatterns.forEach(pattern => {
    it(`devrait détecter comme simple: "${pattern.substring(0, 40)}..."`, () => {
      expect(shouldUseAgentLoop(pattern)).toBe(false);
    });
  });
});

describe('Agent Loop - Cas limites', () => {
  it('devrait gérer une chaîne vide', () => {
    expect(shouldUseAgentLoop('')).toBe(false);
  });

  it('devrait gérer une chaîne avec seulement des espaces', () => {
    expect(shouldUseAgentLoop('   ')).toBe(false);
  });

  it('devrait être insensible à la casse', () => {
    expect(shouldUseAgentLoop('FAIS UN RAPPORT SUR LE MARCHÉ')).toBe(true);
    expect(shouldUseAgentLoop('fais un rapport sur le marché')).toBe(true);
    expect(shouldUseAgentLoop('Fais Un Rapport Sur Le Marché')).toBe(true);
  });
});
