/**
 * Auto Code Generator Module
 * Génère et exécute automatiquement du code pour les requêtes de calcul
 * 
 * Flux:
 * 1. Utilisateur demande un calcul (ex: "Calcule 5 + 3")
 * 2. Ce module DÉTECTE la demande de calcul
 * 3. Ce module GÉNÈRE le code Python correspondant
 * 4. Ce module EXÉCUTE le code via E2B Sandbox
 * 5. Ce module RETOURNE le résultat réel (pas simulé)
 */

import { executeCodeFromGroq } from './codeInterpreterTool';

/**
 * Détecte si la requête est un calcul/code execution
 */
export function isCalculationRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const patterns = [
    // Calculs simples
    /calcul[e]?|compute|math/i,
    /racine|sqrt|logarithme|exponentiel|puissance/i,
    /somme|moyenne|médiane|écart-type|statistique/i,
    /résoudre|solve|équation|formula/i,
    /[\d\s\+\-\*\/\(\)]+\s*=|calcul|résultat/i,
    // Demandes de code
    /crée.*code|créer.*code|generate.*code|écris.*code|write.*code/i,
    /affiche|print|exécute|execute|run/i,
  ];
  
  return patterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Génère le code Python pour un calcul simple ou une demande de code
 */
export function generateCodeForCalculation(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // IMPORTANT: Vérifier les patterns plus spécifiques EN PREMIER
  
  // Calcul de racine carrée (DOIT être avant les autres patterns)
  if (lowerMessage.includes('racine') || lowerMessage.includes('sqrt')) {
    // Chercher un nombre après "racine" ou "sqrt"
    const numMatch = message.match(/(?:racine|sqrt)[^\d]*([\d.]+)/i);
    if (numMatch) {
      const num = numMatch[1];
      return `import math\nprint(math.sqrt(${num}))`;
    }
  }
  
  // Calcul de puissance
  if (lowerMessage.includes('puissance') || lowerMessage.includes('power')) {
    const numMatch = message.match(/puissance[^\d]*([\d.]+)[^\d]*([\d.]+)|(\d+)\s*\^\s*(\d+)/i);
    if (numMatch) {
      const base = numMatch[1] || numMatch[3];
      const exp = numMatch[2] || numMatch[4];
      return `print(${base} ** ${exp})`;
    }
  }
  
  // Calcul de factorielle
  if (lowerMessage.includes('factorielle') || lowerMessage.includes('factorial')) {
    const numMatch = message.match(/factorielle[^\d]*([\d.]+)|factorial[^\d]*([\d.]+)/i);
    if (numMatch) {
      const num = numMatch[1] || numMatch[2];
      return `import math\nprint(math.factorial(${num}))`;
    }
  }
  
  // Demande "affiche Bonjour le monde"
  if ((lowerMessage.includes('affiche') || lowerMessage.includes('print')) && lowerMessage.includes('monde')) {
    return `print("Bonjour le monde")`;
  }
  
  // Demande "affiche [texte]"
  const affichMatch = message.match(/affiche[s]?\s+["']?([^"'\n]+)["']?/i);
  if (affichMatch) {
    const text = affichMatch[1].trim();
    return `print("${text}")`;
  }
  
  // Extraire les nombres et opérateurs pour calculs simples (support pour multiples opérandes)
  // Chercher d'abord les calculs avec 3+ nombres (ex: 10 + 20 + 30)
  const multiMathMatch = message.match(/(\d+(?:\.\d+)?(?:\s*[\+\-\*\/]\s*\d+(?:\.\d+)?)+)/);
  if (multiMathMatch) {
    const expression = multiMathMatch[1].replace(/\s+/g, '');
    return `print(${expression})`;
  }
  
  // Fallback pour calculs simples avec 2 nombres
  const mathMatch = message.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const [, num1, op, num2] = mathMatch;
    return `print(${num1} ${op} ${num2})`;
  }
  
  return null;
}

/**
 * Exécute un calcul et retourne le résultat
 */
export async function executeCalculation(
  message: string,
  userId: string = 'auto-calculator'
): Promise<{
  success: boolean;
  code?: string;
  output?: string;
  error?: string;
  executionTime?: number;
}> {
  try {
    // Générer le code
    const code = generateCodeForCalculation(message);
    if (!code) {
      return { success: false, error: 'Could not generate code for this calculation' };
    }
    
    console.log('[AutoCodeGenerator] Generated code:', code);
    
    // Exécuter le code
    const result = await executeCodeFromGroq({
      language: 'python',
      code,
      userId,
      username: 'auto-calculator',
    });
    
    return {
      success: !result.error,
      code,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
    };
  } catch (error) {
    console.error('[AutoCodeGenerator] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Formate la réponse avec le code et le résultat réel
 */
export function formatCalculationResponse(result: {
  success: boolean;
  code?: string;
  output?: string;
  error?: string;
  executionTime?: number;
}): string {
  if (!result.success || !result.code) {
    return '';
  }
  
  let response = `**Code Python généré et exécuté:**\n\n\`\`\`python\n${result.code}\n\`\`\`\n\n`;
  
  if (result.error) {
    response += `❌ **Erreur lors de l'exécution (${result.executionTime}ms):**\n\n${result.error}`;
  } else {
    response += `✅ **Résultat RÉEL de l'exécution (${result.executionTime}ms):**\n\n\`\`\`\n${result.output}\`\`\``;
  }
  
  return response;
}
