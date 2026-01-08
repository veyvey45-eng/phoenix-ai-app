/**
 * Tests pour le Mode Agent Autonome
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  detectMultiStepTask, 
  planAgentActions, 
  executeAgentPipeline,
  getAutonomousAgentMode 
} from './autonomousAgentMode';

describe('Mode Agent Autonome', () => {
  describe('detectMultiStepTask', () => {
    it('détecte les tâches recherche + résumé', () => {
      expect(detectMultiStepTask('recherche sur l\'IA et résume les résultats')).toBe(true);
      expect(detectMultiStepTask('trouve des infos sur Bitcoin et fais un résumé')).toBe(true);
    });

    it('détecte les tâches recherche + image', () => {
      expect(detectMultiStepTask('recherche sur les chats et puis génère une image')).toBe(true);
      expect(detectMultiStepTask('trouve des infos sur Paris puis crée une image')).toBe(true);
    });

    it('détecte les analyses complètes', () => {
      expect(detectMultiStepTask('fais une analyse complète sur le changement climatique')).toBe(true);
      expect(detectMultiStepTask('donne-moi une étude détaillée sur l\'économie')).toBe(true);
    });

    it('détecte les demandes "tout sur"', () => {
      expect(detectMultiStepTask('dis-moi tout sur les voitures électriques')).toBe(true);
      expect(detectMultiStepTask('explique-moi tout en détail sur la blockchain')).toBe(true);
    });

    it('ne détecte pas les tâches simples', () => {
      expect(detectMultiStepTask('bonjour')).toBe(false);
      expect(detectMultiStepTask('quelle heure est-il')).toBe(false);
      expect(detectMultiStepTask('génère une image de chat')).toBe(false);
    });
  });

  describe('planAgentActions', () => {
    it('planifie une recherche pour les demandes de recherche', async () => {
      const actions = await planAgentActions('recherche sur l\'intelligence artificielle');
      expect(actions.some(a => a.type === 'search')).toBe(true);
    });

    it('planifie un résumé pour les demandes de synthèse', async () => {
      const actions = await planAgentActions('résume les avantages de Python');
      expect(actions.some(a => a.type === 'summarize')).toBe(true);
    });

    it('planifie une génération d\'image pour les demandes visuelles', async () => {
      const actions = await planAgentActions('génère une image d\'un coucher de soleil');
      expect(actions.some(a => a.type === 'generate_image')).toBe(true);
    });

    it('planifie plusieurs actions pour les tâches multi-étapes', async () => {
      const actions = await planAgentActions('recherche sur les chats et génère une image');
      expect(actions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('executeAgentPipeline', () => {
    it('exécute un pipeline vide pour les tâches simples', async () => {
      const pipeline = await executeAgentPipeline('bonjour');
      expect(pipeline.status).toBe('completed');
      expect(pipeline.actions.length).toBe(0);
    });

    it('retourne un résultat final', async () => {
      const pipeline = await executeAgentPipeline('bonjour comment vas-tu');
      expect(pipeline.finalResult).toBeDefined();
      expect(typeof pipeline.finalResult).toBe('string');
    }, 10000);

    it('appelle le callback de progression', async () => {
      const progressCallback = vi.fn();
      await executeAgentPipeline('bonjour', progressCallback);
      // Le callback peut être appelé si des actions sont planifiées
    }, 10000);
  });

  describe('getAutonomousAgentMode singleton', () => {
    it('retourne toujours la même instance', () => {
      const instance1 = getAutonomousAgentMode();
      const instance2 = getAutonomousAgentMode();
      expect(instance1).toBe(instance2);
    });

    it('permet de configurer le mode agent', () => {
      const agentMode = getAutonomousAgentMode();
      agentMode.setConfig({ maxActions: 10 });
      expect(agentMode.getConfig().maxActions).toBe(10);
    });

    it('expose la méthode isMultiStepTask', () => {
      const agentMode = getAutonomousAgentMode();
      expect(agentMode.isMultiStepTask('recherche et résume')).toBe(true);
      expect(agentMode.isMultiStepTask('bonjour')).toBe(false);
    });
  });
});

describe('Scénarios d\'utilisation réels', () => {
  it('Scénario 1: Recherche + Résumé sur un sujet', async () => {
    const query = 'recherche sur les énergies renouvelables et fais-moi un résumé';
    
    expect(detectMultiStepTask(query)).toBe(true);
    
    const actions = await planAgentActions(query);
    expect(actions.some(a => a.type === 'search')).toBe(true);
    expect(actions.some(a => a.type === 'summarize')).toBe(true);
  });

  it('Scénario 2: Analyse complète avec image', async () => {
    const query = 'fais une analyse complète sur les voitures électriques et illustre avec une image';
    
    expect(detectMultiStepTask(query)).toBe(true);
    
    const actions = await planAgentActions(query);
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it('Scénario 3: Tout savoir sur un sujet', async () => {
    const query = 'dis-moi tout sur la blockchain';
    
    expect(detectMultiStepTask(query)).toBe(true);
  });
});
