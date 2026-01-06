/**
 * Auto Execution Engine
 * Intègre la détection automatique et l'exécution dans le streaming chat
 * Permet à Phoenix de prendre l'initiative sans commandes natives
 */

import { detectNativeCommand, executeNativeCommand, formatResult } from './nativeCommands';
import { autoDetectExecution, extractExecutionContent, generateExecutionSuggestion, analyzeProactiveAction } from './autoDetector';
import { createSixteenPointsPrompt } from './sixteenPoints';

export interface AutoExecutionContext {
  userMessage: string;
  phoenixResponse: string;
  conversationHistory: string;
  userId: number;
  username: string;
}

/**
 * Analyse si Phoenix doit exécuter quelque chose automatiquement
 * Retourne le contenu à injecter dans la réponse
 */
export async function analyzeAndExecuteAutomatically(context: AutoExecutionContext): Promise<{
  shouldExecute: boolean;
  executionContent: string;
  executionType: 'code' | 'search' | 'browse' | 'none';
  suggestion: string;
}> {
  // 1. Vérifier les commandes natives d'abord
  const nativeCommand = detectNativeCommand(context.userMessage);
  if (nativeCommand) {
    console.log('[AutoExecution] Native command detected:', nativeCommand.type);
    nativeCommand.userId = context.userId;
    nativeCommand.username = context.username;

    const result = await executeNativeCommand(nativeCommand);
    const executionType = (['code', 'search', 'browse'] as const).includes(nativeCommand.type as any) 
      ? (nativeCommand.type as 'code' | 'search' | 'browse')
      : 'code' as const;
    
    return {
      shouldExecute: result.success,
      executionContent: formatResult(result),
      executionType,
      suggestion: `Exécution ${nativeCommand.type} via commande native`
    };
  }

  // 2. Détection automatique
  const detection = autoDetectExecution(context.userMessage, context.phoenixResponse);

  if (detection.shouldExecute && detection.executionType !== 'none') {
    console.log('[AutoExecution] Auto-detection triggered:', detection.executionType);
    console.log('[AutoExecution] Confidence:', detection.confidence);
    console.log('[AutoExecution] Reason:', detection.reason);

    const content = extractExecutionContent(context.userMessage, detection.executionType);
    const suggestion = generateExecutionSuggestion(context.userMessage, context.phoenixResponse, detection);

    return {
      shouldExecute: true,
      executionContent: content,
      executionType: detection.executionType,
      suggestion
    };
  }

  // 3. Analyse proactive pour proposer une action
  const proactiveAnalysis = await analyzeProactiveAction(context.userMessage, context.conversationHistory);

  if (proactiveAnalysis.shouldTakeInitiative && proactiveAnalysis.actionType !== 'none') {
    console.log('[AutoExecution] Proactive action suggested:', proactiveAnalysis.actionType);
    console.log('[AutoExecution] Action:', proactiveAnalysis.suggestedAction);

    return {
      shouldExecute: true,
      executionContent: proactiveAnalysis.suggestedAction,
      executionType: proactiveAnalysis.actionType as 'code' | 'search' | 'browse',
      suggestion: `💡 Je vais ${proactiveAnalysis.actionType === 'code' ? 'exécuter du code' : proactiveAnalysis.actionType === 'search' ? 'faire une recherche' : 'naviguer le web'} pour toi`
    };
  }

  return {
    shouldExecute: false,
    executionContent: '',
    executionType: 'none',
    suggestion: ''
  };
}

/**
 * Crée un prompt système enrichi avec les 16 Points et les capacités d'auto-exécution
 */
export function createEnrichedSystemPrompt(basePrompt: string): string {
  const sixteenPointsPrompt = createSixteenPointsPrompt();
  
  // Ajouter la date actuelle pour que Phoenix sache qu'il a accès aux données récentes
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  });

  return `${basePrompt}

## ⚡ INFORMATION TEMPORELLE CRITIQUE

**DATE ET HEURE ACTUELLES: ${currentDate}**

Tu es en janvier 2026. Tu as accès à des données EN TEMPS RÉEL via des APIs (CoinGecko pour les cryptos, etc.). Les données que tu reçois dans le contexte sont ACTUELLES et FRAÎCHES. Tu n'es PAS limité aux données de 2024.

**IMPORTANT**: Ne dis JAMAIS que tu n'as pas accès aux données récentes (2025, 2026). Utilise les données fournies dans le contexte car elles sont en temps réel.

${sixteenPointsPrompt}

## Capacités d'Auto-Exécution

Tu as accès à ces capacités d'auto-exécution:

### 1. Commandes Natives
- \`/code python: <code>\` - Exécute du code Python
- \`/code javascript: <code>\` - Exécute du code JavaScript
- \`/search: <query>\` - Recherche sur le web
- \`/browse: <url>\` - Navigue sur un site web
- \`/generate: <objective>\` - Génère du code
- \`/analyze: <code>\` - Analyse du code

### 2. GÉNÉRATION D'IMAGES
**Tu PEUX générer des images.** Quand l'utilisateur demande une image (dessine, génère, crée une image/photo/illustration), le système génère automatiquement l'image. Tu n'as PAS besoin de dire que tu ne peux pas générer d'images.

### 3. Détection Automatique
Tu détectes automatiquement quand tu dois:
- Exécuter du code (patterns: "exécute", "calcule", "crée une fonction", etc.)
- Faire une recherche (patterns: "recherche", "trouve", "dernières nouvelles", etc.)
- Naviguer le web (patterns: "navigue", "extrait", "https://", etc.)

### 4. Proactivité
Tu proposes des actions avant qu'on te les demande:
- Si l'utilisateur pose un problème: tu proposes une solution
- Si tu détectes une erreur: tu la corriges automatiquement
- Si tu peux améliorer une réponse: tu le fais

## Directives d'Auto-Exécution

1. **Détection Automatique**: Détecte automatiquement les demandes d'exécution
2. **Exécution Réelle**: Exécute du code réel, pas de simulation
3. **Transparence**: Explique toujours ce que tu vas faire
4. **Proactivité**: Propose des actions sans attendre la permission
5. **Auto-Correction**: Corrige tes erreurs automatiquement
6. **Apprentissage**: Apprends de chaque interaction

## Exemples

### Exemple 1: Détection Automatique de Code
Utilisateur: "Calcule la racine carrée de 256"
Phoenix: "Je vais exécuter du code Python pour calculer cela.
\`\`\`python
import math
print(math.sqrt(256))
\`\`\`
Résultat: 16.0"

### Exemple 2: Détection Automatique de Recherche
Utilisateur: "Quelles sont les dernières nouvelles sur l'IA?"
Phoenix: "Je vais faire une recherche web pour toi.
🔍 Recherche: dernières nouvelles sur l'IA
Résultats: ..."

### Exemple 3: Proactivité
Utilisateur: "J'ai un problème avec mon code"
Phoenix: "Je vais analyser ton code et proposer une solution.
📊 Analyse: ...
💡 Je vais exécuter du code pour tester la solution."

## Rappel Important
Tu es Phoenix, une IA autonome. Tu ne dis jamais "je ne peux pas" ou "je ne suis pas capable". Tu prends l'initiative et tu résous les problèmes.`;
}

/**
 * Injecte les résultats d'exécution dans la réponse de Phoenix
 */
export function injectExecutionResults(
  phoenixResponse: string,
  executionContent: string,
  executionType: 'code' | 'search' | 'browse' | 'none'
): string {
  if (!executionContent || executionType === 'none') {
    return phoenixResponse;
  }

  // Injecter les résultats d'exécution avant la réponse de Phoenix
  const injectedResponse = `${executionContent}\n\n${phoenixResponse}`;
  return injectedResponse;
}

/**
 * Crée une suggestion d'action pour Phoenix
 * Utilisée pour proposer des actions proactives
 */
export function createActionSuggestion(
  executionType: 'code' | 'search' | 'browse' | 'none',
  content: string
): string {
  switch (executionType) {
    case 'code':
      return `\n\n**💡 Je vais exécuter ce code Python pour toi:**\n\`\`\`python\n${content}\n\`\`\``;

    case 'search':
      return `\n\n**💡 Je vais faire une recherche web pour toi:**\n🔍 "${content}"`;

    case 'browse':
      return `\n\n**💡 Je vais naviguer et extraire les données pour toi:**\n🌐 ${content}`;

    default:
      return '';
  }
}

/**
 * Valide si une exécution est sûre
 */
export function validateExecutionSafety(executionType: 'code' | 'search' | 'browse', content: string): {
  isSafe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  switch (executionType) {
    case 'code':
      // Vérifier les opérations dangereuses
      if (content.includes('rm -rf') || content.includes('del ')) {
        warnings.push('⚠️ Opération de suppression détectée');
      }
      if (content.includes('import os') && content.includes('system')) {
        warnings.push('⚠️ Commande système détectée');
      }
      if (content.includes('eval') || content.includes('exec')) {
        warnings.push('⚠️ Exécution dynamique détectée');
      }
      break;

    case 'browse':
      // Vérifier les URLs suspectes
      if (content.includes('localhost') || content.includes('127.0.0.1')) {
        warnings.push('⚠️ URL locale détectée');
      }
      break;
  }

  return {
    isSafe: warnings.length === 0,
    warnings
  };
}
