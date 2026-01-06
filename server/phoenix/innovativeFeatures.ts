/**
 * Innovative Features Integration Module for Phoenix AI
 */

import { shouldTriggerDeepResearch, determineResearchDepth } from './deepResearch';
import { detectDocumentRequest } from './documentGenerator';
import { detectEmailRequest } from './emailAssistant';
import { detectImageRequest } from './imageGeneratorPhoenix';
import { shouldUseTaskAgent } from './taskAgent';
// detectSchedulingRequest n'existe pas dans taskScheduler, on crée une fonction locale
function detectSchedulingRequest(message: string): { isSchedulingRequest: boolean; action?: string } {
  const lowerMessage = message.toLowerCase();
  const schedulingTriggers = ['rappelle-moi', 'rappel', 'planifie', 'programme', 'demain', 'dans', 'chaque jour', 'mes tâches', 'briefing'];
  const isSchedulingRequest = schedulingTriggers.some(t => lowerMessage.includes(t));
  if (!isSchedulingRequest) return { isSchedulingRequest: false };
  if (lowerMessage.includes('briefing')) return { isSchedulingRequest: true, action: 'briefing' };
  if (lowerMessage.includes('mes tâches')) return { isSchedulingRequest: true, action: 'list' };
  return { isSchedulingRequest: true, action: 'create' };
}

export type FeatureType = 'deep_research' | 'document_generation' | 'email_compose' | 
  'email_summarize' | 'image_generation' | 'task_agent' | 'scheduling' | null;

export interface FeatureDetectionResult {
  feature: FeatureType;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface FeatureInfo {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  examples: string[];
}

export function detectFeature(message: string): FeatureDetectionResult {
  if (shouldTriggerDeepResearch(message)) {
    return {
      feature: 'deep_research',
      confidence: 0.9,
      metadata: { depth: determineResearchDepth(message) },
    };
  }
  
  const docRequest = detectDocumentRequest(message);
  if (docRequest) {
    return {
      feature: 'document_generation',
      confidence: 0.85,
      metadata: { type: docRequest.type, topic: docRequest.topic },
    };
  }
  
  const emailRequest = detectEmailRequest(message);
  if (emailRequest.type === 'compose') {
    return { feature: 'email_compose', confidence: 0.85, metadata: emailRequest };
  }
  if (emailRequest.type === 'summarize') {
    return { feature: 'email_summarize', confidence: 0.85, metadata: emailRequest };
  }
  
  const imageRequest = detectImageRequest(message);
  if (imageRequest.isImageRequest) {
    return {
      feature: 'image_generation',
      confidence: 0.9,
      metadata: { style: imageRequest.style, prompt: imageRequest.prompt },
    };
  }
  
  if (shouldUseTaskAgent(message)) {
    return { feature: 'task_agent', confidence: 0.8 };
  }
  
  const scheduleRequest = detectSchedulingRequest(message);
  if (scheduleRequest.isSchedulingRequest) {
    return {
      feature: 'scheduling',
      confidence: 0.85,
      metadata: { action: scheduleRequest.action },
    };
  }
  
  return { feature: null, confidence: 0 };
}

export function getAvailableFeaturesInfo(): FeatureInfo[] {
  return [
    {
      id: 'deep_research',
      name: 'Recherche Approfondie',
      description: 'Recherche multi-sources avec rapport détaillé et citations',
      triggers: ['recherche approfondie', 'deep research', 'analyse complète'],
      examples: ['Fais une recherche approfondie sur l\'IA', 'Deep research sur le changement climatique'],
    },
    {
      id: 'document_generation',
      name: 'Génération de Documents',
      description: 'Création de PowerPoint, Excel, PDF, Word',
      triggers: ['crée un powerpoint', 'génère un excel', 'fais un rapport pdf'],
      examples: ['Crée un PowerPoint sur le marketing', 'Génère un tableau Excel des ventes'],
    },
    {
      id: 'email_compose',
      name: 'Rédaction d\'Email',
      description: 'Rédaction d\'emails professionnels',
      triggers: ['rédige un email', 'écris un mail', 'compose un email'],
      examples: ['Rédige un email pour demander un rendez-vous', 'Écris un mail de relance'],
    },
    {
      id: 'email_summarize',
      name: 'Résumé d\'Email',
      description: 'Résumé et analyse d\'emails',
      triggers: ['résume cet email', 'synthèse de ce mail'],
      examples: ['Résume cet email pour moi', 'Fais une synthèse de ce mail'],
    },
    {
      id: 'image_generation',
      name: 'Génération d\'Images',
      description: 'Création d\'images avec différents styles',
      triggers: ['génère une image', 'crée une image', 'dessine'],
      examples: ['Génère une image d\'un coucher de soleil', 'Dessine un portrait style anime'],
    },
    {
      id: 'task_agent',
      name: 'Agent de Tâches',
      description: 'Décomposition et exécution automatique de tâches complexes',
      triggers: ['fais tout automatiquement', 'workflow', 'puis ensuite'],
      examples: ['Recherche puis crée un rapport', 'Fais tout automatiquement'],
    },
    {
      id: 'scheduling',
      name: 'Planification',
      description: 'Rappels et gestion de tâches planifiées',
      triggers: ['rappelle-moi', 'planifie', 'mes tâches'],
      examples: ['Rappelle-moi demain à 10h', 'Montre-moi mes tâches'],
    },
  ];
}

export function generateSmartSuggestions(message: string, _previousMessages?: string[]): string[] {
  const suggestions: string[] = [];
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('bitcoin') || lowerMessage.includes('crypto') || lowerMessage.includes('trading')) {
    suggestions.push('Analyse technique du Bitcoin');
    suggestions.push('Stratégies de trading crypto');
    suggestions.push('Recherche approfondie sur les altcoins');
  }
  
  if (lowerMessage.includes('stratégie') || lowerMessage.includes('strategy')) {
    suggestions.push('Créer un plan de trading');
    suggestions.push('Analyser les tendances du marché');
    suggestions.push('Comparer différentes stratégies');
  }
  
  if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
    suggestions.push('Rédiger un email professionnel');
    suggestions.push('Résumer mes emails non lus');
    suggestions.push('Suggérer des réponses');
  }
  
  if (lowerMessage.includes('document') || lowerMessage.includes('rapport')) {
    suggestions.push('Créer un PowerPoint');
    suggestions.push('Générer un tableau Excel');
    suggestions.push('Rédiger un rapport PDF');
  }
  
  return suggestions;
}

export const tradingTemplates = [
  {
    id: 'dca-conservative',
    name: 'DCA Conservateur',
    description: 'Investissement régulier à faible risque',
    riskLevel: 'low',
    rules: [
      'Investir un montant fixe chaque semaine',
      'Ne jamais investir plus de 5% du portefeuille en une fois',
      'Diversifier sur 3-5 cryptos majeures',
    ],
  },
  {
    id: 'swing-moderate',
    name: 'Swing Trading Modéré',
    description: 'Trading sur plusieurs jours/semaines',
    riskLevel: 'medium',
    rules: [
      'Utiliser les supports/résistances',
      'Stop-loss à 5-10%',
      'Take-profit à 15-25%',
    ],
  },
  {
    id: 'scalping-aggressive',
    name: 'Scalping Agressif',
    description: 'Trading à court terme haute fréquence',
    riskLevel: 'high',
    rules: [
      'Trades de quelques minutes à quelques heures',
      'Stop-loss serré à 2-3%',
      'Objectif de 1-3% par trade',
    ],
  },
];

export function getTradingTemplate(id: string): typeof tradingTemplates[0] | undefined {
  return tradingTemplates.find(t => t.id === id);
}

export function formatTemplateForDisplay(template: typeof tradingTemplates[0]): string {
  let output = `## ${template.name}\n\n`;
  output += `*${template.description}*\n\n`;
  output += `**Niveau de risque:** ${template.riskLevel}\n\n`;
  output += `### Règles\n\n`;
  template.rules.forEach((rule, i) => {
    output += `${i + 1}. ${rule}\n`;
  });
  return output;
}

export function exportAnalysis(
  title: string,
  content: string,
  options: {
    format: 'markdown' | 'json' | 'text';
    includeTimestamp?: boolean;
    includeDisclaimer?: boolean;
  }
): string {
  const { format, includeTimestamp = true, includeDisclaimer = true } = options;
  
  if (format === 'json') {
    return JSON.stringify({
      title,
      content,
      timestamp: includeTimestamp ? new Date().toISOString() : undefined,
      disclaimer: includeDisclaimer ? 'Ceci n\'est pas un conseil financier.' : undefined,
    }, null, 2);
  }
  
  if (format === 'markdown') {
    let md = `# ${title}\n\n`;
    if (includeTimestamp) {
      md += `*Généré le ${new Date().toLocaleDateString('fr-FR')}*\n\n`;
    }
    md += content + '\n\n';
    if (includeDisclaimer) {
      md += `---\n\n**Avertissement:** Ceci n'est pas un conseil financier.\n`;
    }
    return md;
  }
  
  let text = `${title}\n${'='.repeat(title.length)}\n\n`;
  if (includeTimestamp) {
    text += `Généré le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
  }
  text += content + '\n\n';
  if (includeDisclaimer) {
    text += `Avertissement: Ceci n'est pas un conseil financier.\n`;
  }
  return text;
}


// Fonctions supplémentaires pour la compatibilité avec cryptoExpertRouter

export function getTemplatesByRisk(riskLevel: string): typeof tradingTemplates {
  return tradingTemplates.filter(t => t.riskLevel === riskLevel);
}

export async function compareMultipleCryptos(cryptoIds: string[]): Promise<{
  comparison: string;
  rankings: { id: string; score: number }[];
}> {
  // Placeholder - sera implémenté avec les vraies données crypto
  return {
    comparison: `Comparaison de ${cryptoIds.length} cryptomonnaies`,
    rankings: cryptoIds.map((id, i) => ({ id, score: 100 - i * 10 })),
  };
}

export async function summarizeConversation(messages: { role: string; content: string }[]): Promise<string> {
  // Résumé simple de la conversation
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return 'Aucune conversation à résumer.';
  return `Conversation de ${userMessages.length} messages utilisateur.`;
}
