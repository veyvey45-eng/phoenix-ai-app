/**
 * Code Detector Module
 * Détecte quand Phoenix doit utiliser le Code Interpreter
 */

export interface CodeDetectionResult {
  shouldExecuteCode: boolean;
  language: 'python' | 'javascript' | null;
  codeBlock?: string;
  reason: string;
}

/**
 * Détecte si la question nécessite l'exécution de code
 */
export function detectCodeExecutionNeed(userMessage: string): CodeDetectionResult {
  const lowerMessage = userMessage.toLowerCase();

  // Patterns qui indiquent un besoin de calcul/code
  const calculationPatterns = [
    /calcul[e]?|comput|math|équation|formule|résoudre/i,
    /racine|sqrt|logarithme|exponentiel|puissance/i,
    /somme|moyenne|médiane|écart-type|statistique/i,
    /graphique|chart|plot|visuali[sz]|courbe|histogramme/i,
    /données|data|analyse|analysis|dataset/i,
    /tableau|table|matrix|matrice/i,
    /tri|sort|filter|filtrer|grouper|group/i,
    /json|parse|format|transformer|convert/i,
    /script|code|programme|algorithm/i,
  ];

  // Patterns spécifiques Python
  const pythonPatterns = [
    /python|numpy|pandas|matplotlib|scipy|sklearn/i,
    /fichier|file|csv|excel|json|xml/i,
    /boucle|loop|fonction|function|classe|class/i,
  ];

  // Patterns spécifiques JavaScript
  const jsPatterns = [
    /javascript|node|js|react|typescript/i,
    /array|object|map|filter|reduce/i,
    /async|await|promise|callback/i,
  ];

  // Vérifier les patterns de calcul
  let needsCode = false;
  for (const pattern of calculationPatterns) {
    if (pattern.test(userMessage)) {
      needsCode = true;
      break;
    }
  }

  if (!needsCode) {
    return {
      shouldExecuteCode: false,
      language: null,
      reason: 'No code execution patterns detected',
    };
  }

  // Déterminer le langage
  let language: 'python' | 'javascript' | null = null;

  for (const pattern of pythonPatterns) {
    if (pattern.test(userMessage)) {
      language = 'python';
      break;
    }
  }

  if (!language) {
    for (const pattern of jsPatterns) {
      if (pattern.test(userMessage)) {
        language = 'javascript';
        break;
      }
    }
  }

  // Default to Python for data analysis
  if (!language && needsCode) {
    language = 'python';
  }

  return {
    shouldExecuteCode: true,
    language,
    reason: `Code execution needed for ${language} computation`,
  };
}

/**
 * Extrait le code d'une réponse LLM
 */
export function extractCodeFromResponse(response: string): string | null {
  // Pattern pour code blocks markdown
  const pythonMatch = response.match(/```python\n([\s\S]*?)\n```/);
  if (pythonMatch) {
    return pythonMatch[1];
  }

  const jsMatch = response.match(/```(?:javascript|js)\n([\s\S]*?)\n```/);
  if (jsMatch) {
    return jsMatch[1];
  }

  // Pattern générique
  const genericMatch = response.match(/```\n([\s\S]*?)\n```/);
  if (genericMatch) {
    return genericMatch[1];
  }

  return null;
}

/**
 * Génère une requête LLM pour exécuter du code
 */
export function generateCodeExecutionPrompt(
  userMessage: string,
  language: 'python' | 'javascript'
): string {
  const languageName = language === 'python' ? 'Python 3.11' : 'JavaScript (Node.js 20)';

  return `The user is asking for a computation or data analysis task. You must:

1. Understand the user's request: "${userMessage}"
2. Write ${languageName} code to solve it
3. Return the code in a markdown code block (triple backticks)
4. Include comments explaining what the code does

Important:
- Make the code complete and executable
- Include all necessary imports
- Print/console.log the results clearly
- Handle errors gracefully

User request: ${userMessage}

Please write the ${languageName} code:`;
}

/**
 * Valide si le code est sûr à exécuter
 */
export function validateCodeSafety(code: string, language: 'python' | 'javascript'): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  if (language === 'python') {
    // Patterns dangereux Python
    const dangerousPatterns = [
      { pattern: /os\.remove|os\.rmdir/, message: 'File deletion detected' },
      { pattern: /shutil\.rmtree/, message: 'Directory deletion detected' },
      { pattern: /open\([^,]*,\s*['"]w/, message: 'File write operation detected' },
      { pattern: /subprocess\./, message: 'System command execution detected' },
      { pattern: /exec\(|eval\(/, message: 'Code injection detected' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }
  } else if (language === 'javascript') {
    // Patterns dangereux JavaScript
    const dangerousPatterns = [
      { pattern: /fs\.unlink|fs\.rmdir|fs\.rm/, message: 'File deletion detected' },
      { pattern: /fs\.writeFile/, message: 'File write operation detected' },
      { pattern: /require\(['"]fs['"]|require\(['"]child_process['"]/, message: 'Dangerous module import detected' },
      { pattern: /eval\(|Function\(/, message: 'Code injection detected' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}
