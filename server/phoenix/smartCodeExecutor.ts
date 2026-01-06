/**
 * Smart Code Executor Module
 * Gère le flux COMPLET de génération et exécution de code
 * - Détecte les demandes de code
 * - Génère le code approprié
 * - Exécute le code réellement
 * - Retourne le résultat avec le code et l'output
 */

import { invokeLLM } from '../_core/llm';
import { executeCodeFromGroq } from './codeInterpreterTool';
import { getPriceHistory, getCryptoPrice } from './cryptoExpert';

/**
 * Détecte si la question est une demande de code/calcul
 */
export function isCodeRequest(message: string): boolean {
  const patterns = [
    /crée.*code|créer.*code|generate.*code|écris.*code|write.*code/i,
    /affiche|print|exécute|execute|run|lancer/i,
    /calcul|compute|math|somme|addition|multiplication|division/i,
    /racine|sqrt|logarithme|exponentiel|puissance/i,
    /[\d\s\+\-\*\/\(\)]+\s*=|résultat|result/i,
    /tableau.*python|python.*tableau/i,
    /tableau.*prix|prix.*tableau/i,
  ];

  return patterns.some(pattern => pattern.test(message));
}

/**
 * Détecte si la demande nécessite des données crypto réelles
 */
function detectCryptoDataNeed(message: string): { needsData: boolean; cryptoId: string | null; days: number } {
  const lowerMessage = message.toLowerCase();
  
  // Patterns pour détecter les demandes de données crypto
  const cryptoPatterns = [
    /prix.*(?:bitcoin|btc|ethereum|eth|solana|sol)/i,
    /(?:bitcoin|btc|ethereum|eth|solana|sol).*prix/i,
    /valeur.*(?:bitcoin|btc|ethereum|eth|solana|sol)/i,
    /(?:bitcoin|btc|ethereum|eth|solana|sol).*valeur/i,
    /historique.*(?:bitcoin|btc|ethereum|eth|solana|sol)/i,
    /(?:bitcoin|btc|ethereum|eth|solana|sol).*historique/i,
    /jour.*pour.*jour.*(?:bitcoin|btc|ethereum|eth|solana|sol)/i,
    /(?:bitcoin|btc|ethereum|eth|solana|sol).*jour.*pour.*jour/i,
    /tableau.*(?:bitcoin|btc|ethereum|eth|solana|sol)/i,
    /(?:bitcoin|btc|ethereum|eth|solana|sol).*tableau/i,
  ];
  
  const needsData = cryptoPatterns.some(p => p.test(lowerMessage));
  
  if (!needsData) {
    return { needsData: false, cryptoId: null, days: 30 };
  }
  
  // Détecter quelle crypto
  let cryptoId = 'bitcoin';
  if (/ethereum|eth/i.test(lowerMessage)) cryptoId = 'ethereum';
  else if (/solana|sol/i.test(lowerMessage)) cryptoId = 'solana';
  else if (/bitcoin|btc/i.test(lowerMessage)) cryptoId = 'bitcoin';
  
  // Détecter la période
  let days = 30;
  if (/décembre|december/i.test(lowerMessage)) days = 31;
  if (/janvier|january/i.test(lowerMessage)) days = 31;
  if (/semaine|week/i.test(lowerMessage)) days = 7;
  if (/mois|month/i.test(lowerMessage)) days = 30;
  if (/année|year/i.test(lowerMessage)) days = 365;
  
  return { needsData: true, cryptoId, days };
}

/**
 * Récupère les données crypto réelles pour les injecter dans le code
 */
async function fetchRealCryptoData(cryptoId: string, days: number): Promise<string> {
  try {
    console.log(`[SmartCodeExecutor] Fetching real crypto data for ${cryptoId}, ${days} days`);
    
    const priceHistory = await getPriceHistory(cryptoId, days);
    
    if (!priceHistory || priceHistory.length === 0) {
      console.warn('[SmartCodeExecutor] No price history returned');
      return '';
    }
    
    // Formater les données pour Python
    const formattedData = priceHistory.map(item => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString('fr-FR');
      return `    {"date": "${dateStr}", "prix": ${item.price.toFixed(2)}}`;
    }).join(',\n');
    
    console.log(`[SmartCodeExecutor] Fetched ${priceHistory.length} price points`);
    
    return `# DONNÉES RÉELLES RÉCUPÉRÉES VIA API COINGECKO\n# Crypto: ${cryptoId}\n# Période: ${days} derniers jours\ndonnees_reelles = [\n${formattedData}\n]`;
  } catch (error) {
    console.error('[SmartCodeExecutor] Error fetching crypto data:', error);
    return '';
  }
}

/**
 * Génère du code approprié pour la question
 */
export async function generateAppropriateCode(
  userMessage: string,
  language: 'python' | 'javascript' = 'python'
): Promise<string | null> {
  try {
    console.log('[SmartCodeExecutor] Generating code for:', userMessage);
    
    // VÉRIFIER SI ON A BESOIN DE DONNÉES CRYPTO RÉELLES
    const cryptoNeed = detectCryptoDataNeed(userMessage);
    let realDataContext = '';
    
    if (cryptoNeed.needsData && cryptoNeed.cryptoId) {
      console.log(`[SmartCodeExecutor] Crypto data needed: ${cryptoNeed.cryptoId}, ${cryptoNeed.days} days`);
      realDataContext = await fetchRealCryptoData(cryptoNeed.cryptoId, cryptoNeed.days);
      
      if (realDataContext) {
        console.log('[SmartCodeExecutor] Real crypto data fetched successfully');
      } else {
        console.warn('[SmartCodeExecutor] Failed to fetch real crypto data');
      }
    }

    const systemPrompt = `Tu es un expert en programmation. L'utilisateur te demande de générer du code.

RÈGLES STRICTES:
1. Génère du code EXÉCUTABLE et COMPLET
2. Le code doit répondre EXACTEMENT à la demande
3. Utilise print() pour afficher les résultats
4. Retourne UNIQUEMENT le code entre balises \`\`\`${language}\`\`\`
5. PAS d'explications, PAS de texte en dehors des balises
6. Le code doit être RÉEL, pas du pseudo-code
7. Si des données réelles sont fournies, TU DOIS les utiliser EXACTEMENT comme fournies
8. NE JAMAIS inventer de données - utilise UNIQUEMENT les données fournies`;

    // Construire le prompt utilisateur avec les données réelles si disponibles
    let userPrompt = `Génère du code ${language} pour: "${userMessage}"`;
    
    if (realDataContext) {
      userPrompt += `\n\n## DONNÉES RÉELLES À UTILISER (OBLIGATOIRE):\n${realDataContext}\n\nIMPORTANT: Utilise ces données EXACTEMENT comme fournies. Ne les modifie pas et n'invente pas d'autres données.`;
    }
    
    userPrompt += `\n\nRetourne UNIQUEMENT le code entre balises \`\`\`${language}\`\`\`, rien d'autre.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let contentRaw = response.choices?.[0]?.message?.content;
    const content = typeof contentRaw === 'string' ? contentRaw : '';

    if (!content) {
      console.warn('[SmartCodeExecutor] Empty response');
      return null;
    }

    console.log('[SmartCodeExecutor] Raw response (first 200 chars):', content.substring(0, 200));

    // Extraire le code entre les balises ```
    let codeMatch = content.match(/```(?:python|javascript|py|js)?\s*\n([\s\S]*?)\n```/);
    
    if (!codeMatch) {
      codeMatch = content.match(/```(?:python|javascript|py|js)?([\s\S]*?)```/);
    }

    if (codeMatch) {
      const code = codeMatch[1].trim();
      console.log('[SmartCodeExecutor] Extracted code:', code.substring(0, 150));
      return code;
    }

    // Fallback: si le contenu ressemble à du code, le retourner
    if (content.includes('print(') || content.includes('def ') || content.includes('import ')) {
      console.log('[SmartCodeExecutor] Using raw content as code');
      return content.trim();
    }

    console.warn('[SmartCodeExecutor] Could not extract code');
    return null;
  } catch (error) {
    console.error('[SmartCodeExecutor] Error generating code:', error);
    return null;
  }
}

/**
 * Exécute le code et retourne le résultat
 */
export async function executeCode(
  code: string,
  language: 'python' | 'javascript' = 'python',
  userId: string = 'smart-executor'
): Promise<{
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}> {
  try {
    console.log('[SmartCodeExecutor] Executing code...');

    const result = await executeCodeFromGroq({
      language,
      code,
      userId,
      username: 'smart-executor'
    });

    return {
      success: !result.error,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime
    };
  } catch (error) {
    console.error('[SmartCodeExecutor] Execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Flux COMPLET: génère et exécute le code
 */
export async function generateAndExecuteCompleteFlow(
  userMessage: string,
  language: 'python' | 'javascript' = 'python'
): Promise<{
  success: boolean;
  code?: string;
  output?: string;
  error?: string;
  executionTime?: number;
  fullResponse?: string;
}> {
  try {
    // Vérifier si c'est une demande de code
    if (!isCodeRequest(userMessage)) {
      console.log('[SmartCodeExecutor] Not a code request');
      return { success: false, error: 'Not a code request' };
    }

    // Générer le code
    const code = await generateAppropriateCode(userMessage, language);
    if (!code) {
      console.warn('[SmartCodeExecutor] Failed to generate code');
      return { success: false, error: 'Failed to generate code' };
    }

    console.log('[SmartCodeExecutor] Generated code:', code.substring(0, 150));

    // Exécuter le code
    const execution = await executeCode(code, language);

    if (!execution.success) {
      return {
        success: false,
        code,
        error: execution.error,
        executionTime: execution.executionTime
      };
    }

    // Formater la réponse complète
    const fullResponse = `**Code généré et exécuté:**\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n✅ **Résultat RÉEL de l'exécution (${execution.executionTime}ms):**\n\n\`\`\`\n${execution.output}\n\`\`\``;

    return {
      success: true,
      code,
      output: execution.output,
      executionTime: execution.executionTime,
      fullResponse
    };
  } catch (error) {
    console.error('[SmartCodeExecutor] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
