/**
 * Exécute les tests massifs sur Phoenix AI via l'API
 */

import { TEST_QUESTIONS, TestCase, TestResult } from "./massiveTest";
import { detectIntentMultiLevel } from "./multiLevelIntentDetector";

async function runTest(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Utiliser le détecteur d'intention multi-niveaux
    const result = await detectIntentMultiLevel(testCase.question, null);
    
    const duration = Date.now() - startTime;
    
    // Normaliser les intentions pour la comparaison
    const normalizedActual = normalizeIntent(result.finalIntent);
    const normalizedExpected = normalizeIntent(testCase.expectedIntent);
    
    const success = normalizedActual === normalizedExpected;
    
    return {
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      expectedIntent: testCase.expectedIntent,
      actualIntent: result.finalIntent,
      success,
      response: `Confidence: ${result.finalConfidence}, Transition: ${result.hasTransition}, Negation: ${result.hasNegation}`,
      duration,
    };
  } catch (error: any) {
    return {
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      expectedIntent: testCase.expectedIntent,
      actualIntent: "error",
      success: false,
      response: "",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

function normalizeIntent(intent: string): string {
  const mapping: Record<string, string> = {
    "site_creation": "site_creation",
    "site": "site_creation",
    "app_creation": "app_creation",
    "app": "app_creation",
    "image_generation": "image_generation",
    "image": "image_generation",
    "code_execution": "code_execution",
    "code": "code_execution",
    "weather": "weather",
    "crypto": "crypto",
    "web_search": "web_search",
    "search": "web_search",
    "conversation": "conversation",
    "general": "conversation",
  };
  
  return mapping[intent.toLowerCase()] || intent.toLowerCase();
}

async function runAllTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("PHOENIX AI - TESTS MASSIFS");
  console.log(`Total: ${TEST_QUESTIONS.length} questions`);
  console.log("=".repeat(60));
  
  const results: TestResult[] = [];
  const categoryStats: Record<string, { success: number; total: number }> = {};
  
  for (const testCase of TEST_QUESTIONS) {
    const result = await runTest(testCase);
    results.push(result);
    
    // Mise à jour des stats par catégorie
    if (!categoryStats[testCase.category]) {
      categoryStats[testCase.category] = { success: 0, total: 0 };
    }
    categoryStats[testCase.category].total++;
    if (result.success) {
      categoryStats[testCase.category].success++;
    }
    
    // Afficher la progression
    const status = result.success ? "✅" : "❌";
    const progress = `[${results.length}/${TEST_QUESTIONS.length}]`;
    console.log(`${progress} ${status} ${testCase.category}: "${testCase.question.slice(0, 40)}..." → ${result.actualIntent}`);
    
    // Petit délai pour ne pas surcharger
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Résumé final
  console.log("\n" + "=".repeat(60));
  console.log("RÉSULTATS PAR CATÉGORIE");
  console.log("=".repeat(60));
  
  let totalSuccess = 0;
  let totalTests = 0;
  
  for (const [category, stats] of Object.entries(categoryStats)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    const bar = "█".repeat(Math.floor(stats.success / stats.total * 20)) + "░".repeat(20 - Math.floor(stats.success / stats.total * 20));
    console.log(`${category.padEnd(15)} ${bar} ${stats.success}/${stats.total} (${rate}%)`);
    totalSuccess += stats.success;
    totalTests += stats.total;
  }
  
  console.log("\n" + "=".repeat(60));
  const globalRate = ((totalSuccess / totalTests) * 100).toFixed(1);
  console.log(`TOTAL: ${totalSuccess}/${totalTests} (${globalRate}%)`);
  console.log("=".repeat(60));
  
  // Lister les échecs
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log(`ÉCHECS (${failures.length})`);
    console.log("=".repeat(60));
    
    for (const failure of failures.slice(0, 50)) { // Limiter à 50 échecs affichés
      console.log(`❌ [${failure.category}] "${failure.question}"`);
      console.log(`   Attendu: ${failure.expectedIntent}, Obtenu: ${failure.actualIntent}`);
      if (failure.error) {
        console.log(`   Erreur: ${failure.error}`);
      }
    }
    
    if (failures.length > 50) {
      console.log(`... et ${failures.length - 50} autres échecs`);
    }
  }
}

// Exécuter les tests
runAllTests().catch(console.error);
