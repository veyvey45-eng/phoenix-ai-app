/**
 * Auto-Correction Flow - Système d'auto-correction intégré au flux principal
 * 
 * Ce module permet à Phoenix de:
 * 1. Détecter automatiquement les erreurs dans ses actions
 * 2. Analyser la cause de l'erreur
 * 3. Générer une correction automatique
 * 4. Réessayer jusqu'à succès (max 3 tentatives)
 */

import { invokeLLM } from '../_core/llm';
import { toolRegistry, ToolContext, ToolResult } from './toolRegistry';
import { detectSimulation } from './autonomousAgentSystem';

// Configuration
const AUTO_CORRECTION_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  enabledForTools: [
    'static_site_create',
    'smart_project_create',
    'execute_python',
    'execute_javascript',
    'web_navigate'
  ]
};

// Types
export interface CorrectionAttempt {
  attempt: number;
  originalArgs: Record<string, any>;
  correctedArgs?: Record<string, any>;
  error?: string;
  success: boolean;
  output?: string;
}

export interface AutoCorrectionResult {
  success: boolean;
  finalOutput: string;
  attempts: CorrectionAttempt[];
  totalAttempts: number;
  correctionApplied: boolean;
}

/**
 * Analyse une erreur et génère une correction
 */
async function analyzeAndCorrect(
  toolName: string,
  originalArgs: Record<string, any>,
  error: string,
  previousAttempts: CorrectionAttempt[]
): Promise<Record<string, any> | null> {
  const systemPrompt = `Tu es un expert en débogage. Analyse l'erreur suivante et corrige les arguments de l'outil.

OUTIL: ${toolName}
ERREUR: ${error}
ARGUMENTS ORIGINAUX: ${JSON.stringify(originalArgs, null, 2)}
TENTATIVES PRÉCÉDENTES: ${previousAttempts.length}

RÈGLES:
1. Identifie la cause de l'erreur
2. Corrige les arguments pour éviter l'erreur
3. Ne change PAS la logique fondamentale, juste les détails
4. Si l'erreur est liée à une URL fictive, utilise une vraie URL
5. Si l'erreur est liée à du code de simulation, supprime la simulation

Réponds UNIQUEMENT avec un JSON contenant les arguments corrigés:
{
  "correctedArgs": { ... },
  "explanation": "Explication de la correction"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Corrige cette erreur: ${error}` }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      console.log(`[AutoCorrection] Correction générée: ${parsed.explanation}`);
      return parsed.correctedArgs || null;
    }
  } catch (e) {
    console.error('[AutoCorrection] Erreur lors de l\'analyse:', e);
  }

  return null;
}

/**
 * Vérifie si un résultat d'outil nécessite une correction
 */
function needsCorrection(result: ToolResult): { needsCorrection: boolean; reason?: string } {
  // Échec explicite
  if (!result.success && result.error) {
    return { needsCorrection: true, reason: result.error };
  }

  // Vérifier si le résultat contient une URL fictive
  const outputStr = result.output || '';
  if (/https?:\/\/e2b\.dev\/sites\//i.test(outputStr)) {
    return { needsCorrection: true, reason: 'URL fictive e2b.dev détectée dans le résultat' };
  }

  // Vérifier si le résultat contient une simulation
  const simulation = detectSimulation(outputStr);
  if (simulation.isSimulation) {
    return { needsCorrection: true, reason: simulation.reason };
  }

  return { needsCorrection: false };
}

/**
 * Exécute un outil avec auto-correction
 */
export async function executeWithAutoCorrection(
  toolName: string,
  args: Record<string, any>,
  context: ToolContext,
  onProgress?: (message: string) => void
): Promise<AutoCorrectionResult> {
  const attempts: CorrectionAttempt[] = [];
  let currentArgs = { ...args };
  let correctionApplied = false;

  // Vérifier si l'auto-correction est activée pour cet outil
  if (!AUTO_CORRECTION_CONFIG.enabledForTools.includes(toolName)) {
    // Exécuter normalement sans auto-correction
    const result = await toolRegistry.execute(toolName, args, context);
    return {
      success: result.success,
      finalOutput: result.output || result.error || '',
      attempts: [{
        attempt: 1,
        originalArgs: args,
        success: result.success,
        output: result.output,
        error: result.error
      }],
      totalAttempts: 1,
      correctionApplied: false
    };
  }

  for (let attempt = 1; attempt <= AUTO_CORRECTION_CONFIG.maxRetries; attempt++) {
    onProgress?.(`🔄 Tentative ${attempt}/${AUTO_CORRECTION_CONFIG.maxRetries}...`);
    console.log(`[AutoCorrection] Tentative ${attempt} pour ${toolName}`);

    try {
      const result = await toolRegistry.execute(toolName, currentArgs, context);
      
      const correction = needsCorrection(result);
      
      if (!correction.needsCorrection) {
        // Succès!
        attempts.push({
          attempt,
          originalArgs: currentArgs,
          success: true,
          output: result.output
        });

        return {
          success: true,
          finalOutput: result.output || '',
          attempts,
          totalAttempts: attempt,
          correctionApplied
        };
      }

      // Échec - enregistrer et tenter une correction
      attempts.push({
        attempt,
        originalArgs: currentArgs,
        success: false,
        error: correction.reason
      });

      // Si c'est la dernière tentative, ne pas essayer de corriger
      if (attempt === AUTO_CORRECTION_CONFIG.maxRetries) {
        break;
      }

      // Analyser et corriger
      onProgress?.(`🔧 Analyse de l'erreur et correction...`);
      const correctedArgs = await analyzeAndCorrect(
        toolName,
        currentArgs,
        correction.reason || 'Erreur inconnue',
        attempts
      );

      if (correctedArgs) {
        currentArgs = correctedArgs;
        correctionApplied = true;
        console.log(`[AutoCorrection] Arguments corrigés pour tentative ${attempt + 1}`);
      }

      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, AUTO_CORRECTION_CONFIG.retryDelay));

    } catch (error: any) {
      attempts.push({
        attempt,
        originalArgs: currentArgs,
        success: false,
        error: error.message
      });

      if (attempt === AUTO_CORRECTION_CONFIG.maxRetries) {
        break;
      }
    }
  }

  // Toutes les tentatives ont échoué
  const lastAttempt = attempts[attempts.length - 1];
  return {
    success: false,
    finalOutput: `❌ Échec après ${attempts.length} tentatives.\n\nDernière erreur: ${lastAttempt?.error || 'Erreur inconnue'}`,
    attempts,
    totalAttempts: attempts.length,
    correctionApplied
  };
}

/**
 * Vérifie qu'une URL de site créé fonctionne vraiment
 */
export async function verifySiteCreation(
  siteUrl: string,
  context: ToolContext
): Promise<{ success: boolean; error?: string }> {
  console.log(`[AutoCorrection] Vérification du site: ${siteUrl}`);

  // Si c'est une URL relative /sites/xxx, vérifier en base de données
  if (siteUrl.startsWith('/sites/')) {
    const { getSiteBySlug } = await import('../hostedSites');
    const slug = siteUrl.replace('/sites/', '');
    const site = await getSiteBySlug(slug);
    
    if (site && site.htmlContent) {
      console.log(`[AutoCorrection] Site vérifié en DB: ${slug}`);
      return { success: true };
    } else {
      return { success: false, error: 'Site non trouvé en base de données' };
    }
  }

  // Pour les URLs externes, utiliser browserless
  try {
    const { browserless } = await import('./browserless');
    const result = await browserless.getContent(siteUrl);
    
    if (result.success && result.content) {
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Page non accessible' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Wrapper pour la création de site avec vérification automatique
 */
export async function createSiteWithVerification(
  name: string,
  htmlContent: string,
  context: ToolContext,
  onProgress?: (message: string) => void
): Promise<{
  success: boolean;
  url?: string;
  verified: boolean;
  error?: string;
}> {
  onProgress?.('🚀 Création du site...');

  // Créer le site
  const result = await executeWithAutoCorrection(
    'static_site_create',
    { name, html: htmlContent },
    context,
    onProgress
  );

  if (!result.success) {
    return {
      success: false,
      verified: false,
      error: result.finalOutput
    };
  }

  // Extraire l'URL du résultat
  const urlMatch = result.finalOutput.match(/\/sites\/[\w-]+/);
  if (!urlMatch) {
    return {
      success: false,
      verified: false,
      error: 'URL du site non trouvée dans le résultat'
    };
  }

  const siteUrl = urlMatch[0];
  onProgress?.(`🔍 Vérification du site: ${siteUrl}`);

  // Vérifier que le site fonctionne
  const verification = await verifySiteCreation(siteUrl, context);

  if (verification.success) {
    onProgress?.('✅ Site créé et vérifié avec succès!');
    return {
      success: true,
      url: siteUrl,
      verified: true
    };
  } else {
    return {
      success: false,
      url: siteUrl,
      verified: false,
      error: `Site créé mais vérification échouée: ${verification.error}`
    };
  }
}

export default {
  executeWithAutoCorrection,
  verifySiteCreation,
  createSiteWithVerification,
  needsCorrection
};
