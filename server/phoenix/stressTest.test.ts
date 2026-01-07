/**
 * Stress Test Vitest pour Phoenix AI
 * Exécute 500+ questions et valide la compréhension
 */

import { describe, it, expect } from 'vitest';
import { runStressTest } from './runStressTest';

describe('Phoenix AI Stress Test - 500+ Questions', () => {
  it('should run all 500+ tests and report results', () => {
    const report = runStressTest();
    
    // Afficher le rapport complet
    console.log('\n=== STRESS TEST SUMMARY ===');
    console.log(`Total: ${report.totalTests}`);
    console.log(`Passed: ${report.passed} (${report.passRate.toFixed(1)}%)`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Transition Accuracy: ${report.transitionAccuracy.toFixed(1)}%`);
    console.log(`Negation Accuracy: ${report.negationAccuracy.toFixed(1)}%`);
    
    // Le test passe si au moins 50% des tests réussissent
    // (seuil bas car on utilise la détection rapide sans LLM)
    expect(report.passRate).toBeGreaterThanOrEqual(50);
  });
  
  it('should have good conversation detection', () => {
    const report = runStressTest();
    const conversationStats = report.byCategory['conversation'];
    
    // Les conversations simples devraient avoir un taux de réussite élevé
    expect(conversationStats.passRate).toBeGreaterThanOrEqual(80);
  });
  
  it('should detect transitions correctly', () => {
    const report = runStressTest();
    
    // La détection de transitions devrait être au moins à 60%
    expect(report.transitionAccuracy).toBeGreaterThanOrEqual(60);
  });
  
  it('should detect negations correctly', () => {
    const report = runStressTest();
    
    // La détection de négations devrait être au moins à 60%
    expect(report.negationAccuracy).toBeGreaterThanOrEqual(60);
  });
});
