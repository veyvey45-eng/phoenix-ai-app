/**
 * Script d'exécution du stress test pour Phoenix AI
 * Exécute 500+ questions et collecte les résultats
 */

import { allTestQuestions, TestQuestion, testStats } from './stressTest';
import { detectIntentQuick } from './multiLevelIntentDetector';
import { quickAnalyze } from './semanticAnalyzer';

interface TestResult {
  id: number;
  question: string;
  category: string;
  expectedIntent: string;
  detectedIntent: string;
  passed: boolean;
  confidence: number;
  transitionDetected: boolean;
  negationDetected: boolean;
  executionTimeMs: number;
  error?: string;
}

interface StressTestReport {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgExecutionTimeMs: number;
  byCategory: Record<string, { total: number; passed: number; passRate: number }>;
  failedTests: TestResult[];
  transitionAccuracy: number;
  negationAccuracy: number;
}

// Contexte simple pour les tests
interface SimpleContext {
  lastIntent: string | null;
}

const contextStore: Map<string, SimpleContext> = new Map();

function getContext(conversationId: string): SimpleContext {
  if (!contextStore.has(conversationId)) {
    contextStore.set(conversationId, { lastIntent: null });
  }
  return contextStore.get(conversationId)!;
}

function setContext(conversationId: string, intent: string): void {
  contextStore.set(conversationId, { lastIntent: intent });
}

// Exécuter un test individuel
function runSingleTest(question: TestQuestion): TestResult {
  const startTime = Date.now();
  
  try {
    // Simuler le contexte précédent si nécessaire
    if (question.previousContext) {
      setContext('test-conversation', question.previousContext);
    }
    
    // Analyser le message
    const semantic = quickAnalyze(question.question);
    const quickResult = detectIntentQuick(question.question);
    
    const executionTime = Date.now() - startTime;
    
    // Vérifier si l'intention détectée correspond à l'attendue
    let passed = quickResult.type === question.expectedIntent;
    
    // Pour les tests de transition, vérifier aussi la détection de transition
    const transitionDetected = semantic.references?.hasTransition || false;
    const negationDetected = semantic.references?.hasNegation || false;
    
    return {
      id: question.id,
      question: question.question,
      category: question.category,
      expectedIntent: question.expectedIntent,
      detectedIntent: quickResult.type,
      passed,
      confidence: quickResult.confidence,
      transitionDetected,
      negationDetected,
      executionTimeMs: executionTime,
    };
  } catch (error) {
    return {
      id: question.id,
      question: question.question,
      category: question.category,
      expectedIntent: question.expectedIntent,
      detectedIntent: 'error',
      passed: false,
      confidence: 0,
      transitionDetected: false,
      negationDetected: false,
      executionTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Exécuter tous les tests
export function runStressTest(): StressTestReport {
  console.log('='.repeat(60));
  console.log('PHOENIX AI STRESS TEST - 500+ QUESTIONS');
  console.log('='.repeat(60));
  console.log(`Total questions: ${testStats.total}`);
  console.log('Categories:', testStats.byCategory);
  console.log('='.repeat(60));
  
  const results: TestResult[] = [];
  
  // Exécuter chaque test
  for (const question of allTestQuestions) {
    const result = runSingleTest(question);
    results.push(result);
    
    // Afficher la progression tous les 50 tests
    if (result.id % 50 === 0) {
      const passedSoFar = results.filter(r => r.passed).length;
      console.log(`Progress: ${result.id}/${testStats.total} - Pass rate: ${((passedSoFar / result.id) * 100).toFixed(1)}%`);
    }
  }
  
  // Calculer les statistiques
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length;
  
  // Statistiques par catégorie
  const byCategory: Record<string, { total: number; passed: number; passRate: number }> = {};
  for (const category of Object.keys(testStats.byCategory)) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    byCategory[category] = {
      total: categoryResults.length,
      passed: categoryPassed,
      passRate: categoryResults.length > 0 ? (categoryPassed / categoryResults.length) * 100 : 0,
    };
  }
  
  // Précision des transitions
  const transitionTests = allTestQuestions.filter(q => q.shouldTriggerTransition);
  const transitionResults = results.filter(r => 
    allTestQuestions.find(q => q.id === r.id)?.shouldTriggerTransition
  );
  const transitionCorrect = transitionResults.filter(r => r.transitionDetected).length;
  const transitionAccuracy = transitionTests.length > 0 
    ? (transitionCorrect / transitionTests.length) * 100 
    : 0;
  
  // Précision des négations
  const negationTests = allTestQuestions.filter(q => q.shouldTriggerNegation);
  const negationResults = results.filter(r => 
    allTestQuestions.find(q => q.id === r.id)?.shouldTriggerNegation
  );
  const negationCorrect = negationResults.filter(r => r.negationDetected).length;
  const negationAccuracy = negationTests.length > 0 
    ? (negationCorrect / negationTests.length) * 100 
    : 0;
  
  const report: StressTestReport = {
    totalTests: testStats.total,
    passed,
    failed,
    passRate: (passed / testStats.total) * 100,
    avgExecutionTimeMs: avgExecutionTime,
    byCategory,
    failedTests: results.filter(r => !r.passed),
    transitionAccuracy,
    negationAccuracy,
  };
  
  // Afficher le rapport
  console.log('\n' + '='.repeat(60));
  console.log('STRESS TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passed} (${report.passRate.toFixed(1)}%)`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Avg Execution Time: ${report.avgExecutionTimeMs.toFixed(2)}ms`);
  console.log(`Transition Detection Accuracy: ${report.transitionAccuracy.toFixed(1)}%`);
  console.log(`Negation Detection Accuracy: ${report.negationAccuracy.toFixed(1)}%`);
  
  console.log('\n--- Results by Category ---');
  for (const [category, stats] of Object.entries(report.byCategory)) {
    console.log(`${category}: ${stats.passed}/${stats.total} (${stats.passRate.toFixed(1)}%)`);
  }
  
  if (report.failedTests.length > 0 && report.failedTests.length <= 50) {
    console.log('\n--- Failed Tests (first 50) ---');
    for (const test of report.failedTests.slice(0, 50)) {
      console.log(`[${test.id}] "${test.question.substring(0, 40)}..." - Expected: ${test.expectedIntent}, Got: ${test.detectedIntent}`);
    }
  }
  
  console.log('='.repeat(60));
  
  return report;
}

// Exporter pour utilisation dans les tests
export { TestResult, StressTestReport };
