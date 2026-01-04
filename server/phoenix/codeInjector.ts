/**
 * Code Injector Module
 * Injecte du code exécutable dans les réponses de Phoenix quand elle dit qu'elle ne peut pas exécuter
 */

import { executeCodeFromGroq } from './codeInterpreterTool';

/**
 * Détecte si Phoenix dit qu'elle ne peut pas exécuter du code
 */
export function detectExecutionRefusal(response: string): boolean {
  const refusalPatterns = [
    /je ne peux pas.*exécuter/gi,
    /je ne dispose pas.*interpréteur/gi,
    /je ne dispose pas.*compilateur/gi,
    /vous devrez.*exécuter vous-même/gi,
    /je n'ai pas.*environnement d'exécution/gi,
    /je ne peux pas.*compiler.*lancer/gi,
  ];

  return refusalPatterns.some(pattern => pattern.test(response));
}

/**
 * Génère un code d'exemple basé sur le contexte de la question
 */
export function generateExampleCode(userMessage: string): { code: string; language: 'python' | 'javascript' } | null {
  // Si l'utilisateur demande "créer un code", générer un exemple simple
  if (/créer.*code|générer.*code|écrire.*code|code.*simple|exemple.*code/i.test(userMessage)) {
    return {
      language: 'python',
      code: `# Exemple de code Python simple
print("Bonjour! Je peux maintenant exécuter du code réellement!")
print("Ceci est un exemple d'exécution en temps réel.")

# Calcul simple
a = 5
b = 3
result = a + b
print(f"Le résultat de {a} + {b} = {result}")`,
    };
  }

  // Si l'utilisateur demande "calcule", générer un calcul
  if (/calcul|somme|addition|multiplication|division|résultat|math/i.test(userMessage)) {
    return {
      language: 'python',
      code: `# Calcul mathématique
import math

# Exemples de calculs
print("=== Calculs Mathématiques ===")
print(f"5 + 3 = {5 + 3}")
print(f"10 * 2 = {10 * 2}")
print(f"Racine carrée de 16 = {math.sqrt(16)}")
print(f"2 puissance 3 = {2 ** 3}")`,
    };
  }

  // Si l'utilisateur demande "exécuter", générer un exemple
  if (/exécuter|run|execute|lancer/i.test(userMessage)) {
    return {
      language: 'python',
      code: `# Code exécuté en temps réel
print("✅ Le code est exécuté RÉELLEMENT via E2B Sandbox!")
print("Ceci n'est pas une simulation - c'est du vrai code en exécution.")

# Afficher des informations
import sys
print(f"Python version: {sys.version}")
print(f"Plateforme: {sys.platform}")`,
    };
  }

  return null;
}

/**
 * Injecte du code exécutable dans la réponse
 */
export async function injectExecutableCode(
  response: string,
  userMessage: string,
  userId: string = 'phoenix'
): Promise<string> {
  try {
    // Vérifier si Phoenix dit qu'elle ne peut pas exécuter
    if (!detectExecutionRefusal(response)) {
      console.log('[CodeInjector] No execution refusal detected');
      return response;
    }

    console.log('[CodeInjector] Execution refusal detected, injecting executable code');

    // Générer un code d'exemple
    const codeExample = generateExampleCode(userMessage);
    if (!codeExample) {
      console.log('[CodeInjector] No code example generated');
      return response;
    }

    // Exécuter le code
    console.log(`[CodeInjector] Executing ${codeExample.language} code`);
    const executionResult = await executeCodeFromGroq({
      language: codeExample.language,
      code: codeExample.code,
      userId,
      username: 'phoenix-code-injector',
    });

    if (executionResult.error) {
      console.error('[CodeInjector] Execution error:', executionResult.error);
      return response;
    }

    // Créer le bloc de code avec le résultat
    const codeBlock = `\n\n**Code Python généré et exécuté:**\n\n\`\`\`python\n${codeExample.code}\n\`\`\`\n\n✅ **Résultat RÉEL de l'exécution (${executionResult.executionTime}ms):**\n\n\`\`\`\n${executionResult.output}\n\`\`\``;

    // Remplacer la partie "je ne peux pas exécuter" par le code exécuté
    let modifiedResponse = response.replace(
      /Cependant,[\s\S]*?vous devrez[\s\S]*?environnement[\s\S]*?\./,
      'Cependant, j\'ai maintenant accès à un environnement d\'exécution E2B, donc je PEUX exécuter le code réellement!'
    );

    // Ajouter le code exécuté à la fin
    modifiedResponse += codeBlock;

    return modifiedResponse;
  } catch (error) {
    console.error('[CodeInjector] Error:', error);
    return response;
  }
}
