/**
 * Autonomous Agent System - Système d'agent VRAIMENT autonome
 * 
 * Ce module implémente un agent qui:
 * 1. N'utilise JAMAIS de simulations
 * 2. Vérifie TOUJOURS que ses créations fonctionnent
 * 3. S'auto-corrige automatiquement en cas d'erreur
 * 4. Utilise uniquement les URLs réelles du système
 * 5. Continue jusqu'à ce que la tâche soit vraiment terminée
 */

import { toolRegistry, ToolContext, ToolResult } from './toolRegistry';
import { invokeLLM } from '../_core/llm';
import { browserless } from './browserless';
import { staticSiteGenerator } from './staticSiteGenerator';
import { createHostedSite, getSiteBySlug } from '../hostedSites';

// Configuration de l'agent autonome
const AGENT_CONFIG = {
  maxIterations: 10,
  maxRetries: 3,
  verificationTimeout: 10000,
  baseUrl: '' // Sera défini dynamiquement
};

// Types
export interface AgentAction {
  type: 'tool_call' | 'verify' | 'retry' | 'complete' | 'error';
  tool?: string;
  args?: Record<string, any>;
  result?: any;
  error?: string;
  url?: string;
}

export interface AgentState {
  goal: string;
  currentStep: number;
  actions: AgentAction[];
  lastResult?: ToolResult;
  createdUrls: string[];
  verifiedUrls: string[];
  errors: string[];
  isComplete: boolean;
}

/**
 * Génère le prompt système STRICT pour l'agent autonome
 * Ce prompt interdit explicitement les simulations
 */
export function generateStrictAgentPrompt(): string {
  return `Tu es Phoenix, un agent IA AUTONOME avec des capacités d'exécution RÉELLES.

## RÈGLES ABSOLUES - INTERDICTIONS

🚫 **INTERDICTIONS STRICTES:**
1. **JAMAIS de simulation** - Tu ne dois JAMAIS simuler une action avec du code Python/JavaScript qui fait juste un print()
2. **JAMAIS d'URLs fictives** - Tu ne dois JAMAIS générer des URLs comme "https://e2b.dev/sites/xxx" ou inventer des URLs
3. **JAMAIS de faux succès** - Tu ne dois JAMAIS dire "succès" sans avoir vérifié que l'action a vraiment réussi
4. **JAMAIS de code qui "simule"** - Si tu vois le mot "simulate" ou "simulation" dans du code, REFUSE de l'exécuter

## RÈGLES D'EXÉCUTION RÉELLE

✅ **OBLIGATIONS:**
1. **Utilise les VRAIS outils** - Appelle toujours smart_project_create ou static_site_create pour créer des sites
2. **URLs RÉELLES uniquement** - Les vraies URLs sont au format "/sites/{slug}" (relatives à ce serveur)
3. **Vérifie TOUJOURS** - Après avoir créé quelque chose, vérifie que ça fonctionne
4. **Auto-correction** - Si une erreur survient, corrige-la automatiquement
5. **Continue jusqu'au bout** - Ne t'arrête pas tant que la tâche n'est pas vraiment terminée

## WORKFLOW POUR CRÉER UN SITE WEB

Quand on te demande de créer un site web, tu DOIS suivre ces étapes:

1. **Créer le site** avec l'outil \`static_site_create\`:
   - Génère le HTML complet
   - L'outil retourne une URL au format "/sites/{slug}"
   - Cette URL est RÉELLE et permanente

2. **Vérifier le site** avec l'outil \`web_navigate\`:
   - Navigue vers l'URL créée
   - Vérifie que le contenu est correct
   - Si erreur 404, réessaie la création

3. **Confirmer à l'utilisateur**:
   - Donne l'URL VÉRIFIÉE
   - Décris ce qui a été créé
   - Ne dis "succès" que si tu as vérifié

## OUTILS DISPONIBLES

### Pour créer des sites web:
- \`static_site_create\`: Crée un site statique avec URL permanente
- \`smart_project_create\`: Crée un projet complet

### Pour vérifier:
- \`web_navigate\`: Navigue vers une URL et vérifie le contenu
- \`browserless_get_content\`: Extrait le contenu d'une page

### Pour le code:
- \`execute_python\`: Exécute du code Python RÉEL (pas de simulation!)
- \`execute_javascript\`: Exécute du code JavaScript RÉEL

## FORMAT DE RÉPONSE

Pour exécuter une action:
\`\`\`json
{
  "mode": "agent",
  "thinking": "Je vais créer le site et vérifier qu'il fonctionne",
  "action": {
    "type": "tool_call",
    "tool_name": "static_site_create",
    "tool_args": {
      "name": "mon-site",
      "html": "<html>...</html>"
    }
  }
}
\`\`\`

Pour vérifier une création:
\`\`\`json
{
  "mode": "agent",
  "thinking": "Je vérifie que le site fonctionne",
  "action": {
    "type": "tool_call",
    "tool_name": "web_navigate",
    "tool_args": {
      "url": "/sites/mon-site-abc123"
    }
  }
}
\`\`\`

## DÉTECTION DE SIMULATION

Si tu vois du code comme:
- \`print("Site créé: https://...")\`
- \`url = "https://e2b.dev/sites/..."\`
- \`# Simulate...\`

**REFUSE** d'exécuter ce code et utilise plutôt les vrais outils!

## RAPPEL FINAL

Tu es un agent AUTONOME. Cela signifie:
- Tu FAIS les choses, tu ne les simules pas
- Tu VÉRIFIES que tes actions ont réussi
- Tu CORRIGES automatiquement les erreurs
- Tu ne t'arrêtes pas tant que ce n'est pas VRAIMENT fait`;
}

/**
 * Crée un site web de manière autonome avec vérification
 */
export async function createSiteAutonomously(
  userId: number,
  name: string,
  htmlContent: string,
  context: ToolContext
): Promise<{
  success: boolean;
  url?: string;
  verified: boolean;
  error?: string;
  attempts: number;
}> {
  let attempts = 0;
  const maxAttempts = AGENT_CONFIG.maxRetries;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[AutonomousAgent] Tentative ${attempts}/${maxAttempts} de création de site`);

    try {
      // Étape 1: Créer le site
      const site = await createHostedSite({
        userId,
        name,
        description: `Site créé par Phoenix AI`,
        siteType: 'custom',
        htmlContent,
        isPublic: true
      });

      if (!site) {
        console.error('[AutonomousAgent] Échec de création du site');
        continue;
      }

      const siteUrl = `/sites/${site.slug}`;
      console.log(`[AutonomousAgent] Site créé: ${siteUrl}`);

      // Étape 2: Vérifier que le site existe
      const verifiedSite = await getSiteBySlug(site.slug);
      if (!verifiedSite) {
        console.error('[AutonomousAgent] Site non trouvé après création');
        continue;
      }

      // Étape 3: Vérifier le contenu
      if (!verifiedSite.htmlContent || verifiedSite.htmlContent.length === 0) {
        console.error('[AutonomousAgent] Contenu HTML vide');
        continue;
      }

      console.log(`[AutonomousAgent] Site vérifié avec succès: ${siteUrl}`);
      
      return {
        success: true,
        url: siteUrl,
        verified: true,
        attempts
      };

    } catch (error: any) {
      console.error(`[AutonomousAgent] Erreur tentative ${attempts}:`, error.message);
    }
  }

  return {
    success: false,
    verified: false,
    error: `Échec après ${attempts} tentatives`,
    attempts
  };
}

/**
 * Vérifie qu'une URL fonctionne vraiment
 */
export async function verifyUrl(url: string): Promise<{
  success: boolean;
  statusCode?: number;
  content?: string;
  error?: string;
}> {
  try {
    // Si c'est une URL relative, vérifier en base de données
    if (url.startsWith('/sites/')) {
      const slug = url.replace('/sites/', '');
      const site = await getSiteBySlug(slug);
      
      if (site && site.htmlContent) {
        return {
          success: true,
          statusCode: 200,
          content: site.htmlContent.substring(0, 500)
        };
      } else {
        return {
          success: false,
          statusCode: 404,
          error: 'Site non trouvé'
        };
      }
    }

    // Pour les URLs externes, utiliser browserless
    const result = await browserless.getContent(url);
    
    if (result.success) {
      return {
        success: true,
        statusCode: 200,
        content: result.content?.substring(0, 500)
      };
    } else {
      return {
        success: false,
        statusCode: 404,
        error: result.error
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Détecte si une réponse contient une simulation
 */
export function detectSimulation(content: string): {
  isSimulation: boolean;
  reason?: string;
} {
  const simulationPatterns = [
    { pattern: /simulate|simulation/i, reason: 'Contient le mot "simulate"' },
    { pattern: /https?:\/\/e2b\.dev\/sites\//i, reason: 'URL e2b.dev fictive détectée' },
    { pattern: /print\s*\(\s*["'].*https?:\/\/.*["']\s*\)/i, reason: 'Print d\'une URL (simulation)' },
    { pattern: /url\s*=\s*["']https?:\/\/e2b\.dev/i, reason: 'Assignation d\'URL e2b.dev fictive' },
    { pattern: /# Simulate|# Simul/i, reason: 'Commentaire de simulation' },
    { pattern: /fake|mock|dummy/i, reason: 'Contient fake/mock/dummy' }
  ];

  for (const { pattern, reason } of simulationPatterns) {
    if (pattern.test(content)) {
      return { isSimulation: true, reason };
    }
  }

  return { isSimulation: false };
}

/**
 * Outil de création de site statique avec vérification automatique
 */
export const staticSiteCreateTool = {
  name: 'static_site_create',
  description: `Crée un site web statique avec une URL PERMANENTE et VÉRIFIE qu'il fonctionne.

⚡ IMPORTANT: Cet outil:
1. Crée le site dans la base de données
2. Vérifie automatiquement que le site existe
3. Retourne une URL RÉELLE au format /sites/{slug}
4. Ne retourne JAMAIS d'URL fictive

L'URL retournée est PERMANENTE et accessible immédiatement.`,
  category: 'web' as const,
  parameters: [
    { name: 'name', type: 'string' as const, description: 'Nom du site', required: true },
    { name: 'html', type: 'string' as const, description: 'Contenu HTML complet', required: true },
    { name: 'description', type: 'string' as const, description: 'Description du site', required: false }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    const userId = parseInt(context.userId, 10) || 1;
    
    // Vérifier que le HTML n'est pas une simulation
    const simulation = detectSimulation(args.html || '');
    if (simulation.isSimulation) {
      return {
        success: false,
        output: '',
        error: `REFUSÉ: ${simulation.reason}. Fournis du vrai HTML, pas une simulation!`
      };
    }

    // Créer le site avec vérification automatique
    const result = await createSiteAutonomously(
      userId,
      args.name,
      args.html,
      context
    );

    if (result.success && result.url) {
      return {
        success: true,
        output: `✅ Site "${args.name}" créé et VÉRIFIÉ avec succès!

🔗 **URL PERMANENTE:** ${result.url}
   Cette URL est RÉELLE et ne disparaîtra JAMAIS!

✓ Vérifié: Le site existe et est accessible
✓ Tentatives: ${result.attempts}

💡 Tu peux partager cette URL immédiatement!`,
        metadata: {
          url: result.url,
          verified: true,
          attempts: result.attempts
        },
        artifacts: [{
          type: 'text',
          content: result.url,
          mimeType: 'text/uri-list',
          name: 'URL du site'
        }]
      };
    } else {
      return {
        success: false,
        output: '',
        error: result.error || 'Échec de création du site après plusieurs tentatives'
      };
    }
  }
};

/**
 * Outil de vérification d'URL
 */
export const verifyUrlTool = {
  name: 'verify_url',
  description: `Vérifie qu'une URL fonctionne vraiment.

Utilise cet outil pour:
- Vérifier qu'un site créé est accessible
- Confirmer qu'une URL n'est pas en erreur 404
- Valider le contenu d'une page`,
  category: 'web' as const,
  parameters: [
    { name: 'url', type: 'string' as const, description: 'URL à vérifier', required: true }
  ],
  execute: async (args: Record<string, any>, context: ToolContext): Promise<ToolResult> => {
    const result = await verifyUrl(args.url);

    if (result.success) {
      return {
        success: true,
        output: `✅ URL vérifiée avec succès!

🔗 URL: ${args.url}
📊 Status: ${result.statusCode}
📄 Aperçu du contenu: ${result.content?.substring(0, 200)}...`,
        metadata: {
          statusCode: result.statusCode,
          contentPreview: result.content?.substring(0, 200)
        }
      };
    } else {
      return {
        success: false,
        output: '',
        error: `❌ URL non accessible: ${result.error || 'Erreur ' + result.statusCode}`
      };
    }
  }
};

/**
 * Exporte les outils autonomes
 */
export const autonomousTools = [
  staticSiteCreateTool,
  verifyUrlTool
];

/**
 * Intercepteur pour bloquer les simulations
 */
export function interceptSimulation(
  toolName: string,
  args: Record<string, any>
): { blocked: boolean; reason?: string } {
  // Vérifier si c'est une exécution de code
  if (toolName === 'execute_python' || toolName === 'execute_javascript') {
    const code = args.code || '';
    const simulation = detectSimulation(code);
    
    if (simulation.isSimulation) {
      return {
        blocked: true,
        reason: `Code de simulation détecté: ${simulation.reason}. Utilise les vrais outils au lieu de simuler!`
      };
    }
  }

  return { blocked: false };
}

export default {
  generateStrictAgentPrompt,
  createSiteAutonomously,
  verifyUrl,
  detectSimulation,
  interceptSimulation,
  autonomousTools
};
