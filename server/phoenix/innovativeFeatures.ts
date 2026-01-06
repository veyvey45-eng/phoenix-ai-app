/**
 * Innovative Features Module
 * Fonctionnalités avancées et innovantes pour Phoenix
 */

import { invokeLLM } from '../_core/llm';

// ============================================================================
// RÉSUMÉ AUTOMATIQUE DE CONVERSATIONS
// ============================================================================

interface ConversationSummary {
  keyPoints: string[];
  topics: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  actionItems: string[];
  summary: string;
}

/**
 * Génère un résumé automatique d'une conversation longue
 */
export async function summarizeConversation(
  messages: Array<{ role: string; content: string }>
): Promise<ConversationSummary> {
  try {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse de conversations. Génère un résumé structuré en JSON avec:
- keyPoints: les points clés (max 5)
- topics: les sujets abordés (max 5)
- sentiment: positive, negative ou neutral
- actionItems: les actions à faire (max 3)
- summary: un résumé en 2-3 phrases

Réponds UNIQUEMENT en JSON valide.`
        },
        {
          role: 'user',
          content: `Analyse cette conversation:\n\n${conversationText}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'conversation_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              keyPoints: { type: 'array', items: { type: 'string' } },
              topics: { type: 'array', items: { type: 'string' } },
              sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
              actionItems: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' }
            },
            required: ['keyPoints', 'topics', 'sentiment', 'actionItems', 'summary'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : '{}';
    return JSON.parse(contentStr);
  } catch (error) {
    console.error('[InnovativeFeatures] Error summarizing conversation:', error);
    return {
      keyPoints: [],
      topics: [],
      sentiment: 'neutral',
      actionItems: [],
      summary: 'Impossible de générer le résumé.'
    };
  }
}

// ============================================================================
// TEMPLATES DE STRATÉGIES DE TRADING
// ============================================================================

export interface TradingTemplate {
  id: string;
  name: string;
  description: string;
  type: 'conservative' | 'moderate' | 'aggressive';
  rules: string[];
  riskLevel: number; // 1-10
  timeframe: string;
  indicators: string[];
  entryConditions: string[];
  exitConditions: string[];
  riskManagement: {
    stopLoss: string;
    takeProfit: string;
    positionSize: string;
  };
}

export const tradingTemplates: TradingTemplate[] = [
  {
    id: 'dca-conservative',
    name: 'DCA Conservateur',
    description: 'Stratégie d\'accumulation progressive avec faible risque',
    type: 'conservative',
    rules: [
      'Investir un montant fixe chaque semaine',
      'Ne jamais investir plus de 5% du capital par achat',
      'Ignorer les fluctuations à court terme'
    ],
    riskLevel: 2,
    timeframe: 'Long terme (1-5 ans)',
    indicators: ['Prix moyen', 'Tendance générale'],
    entryConditions: ['Jour fixe de la semaine', 'Montant fixe'],
    exitConditions: ['Objectif de profit atteint', 'Besoin de liquidités'],
    riskManagement: {
      stopLoss: 'Non applicable (stratégie long terme)',
      takeProfit: 'Retrait progressif à +100%, +200%, +300%',
      positionSize: '5-10% du capital par achat'
    }
  },
  {
    id: 'swing-moderate',
    name: 'Swing Trading Modéré',
    description: 'Capture les mouvements de prix sur plusieurs jours/semaines',
    type: 'moderate',
    rules: [
      'Suivre la tendance principale',
      'Entrer sur les pullbacks',
      'Respecter le ratio risque/récompense de 1:2 minimum'
    ],
    riskLevel: 5,
    timeframe: 'Moyen terme (jours à semaines)',
    indicators: ['RSI', 'MACD', 'EMA 20/50', 'Support/Résistance'],
    entryConditions: [
      'RSI < 40 en tendance haussière',
      'Prix rebondit sur EMA 20',
      'MACD croise à la hausse'
    ],
    exitConditions: [
      'RSI > 70',
      'Prix atteint la résistance',
      'MACD croise à la baisse'
    ],
    riskManagement: {
      stopLoss: '5-8% sous le prix d\'entrée',
      takeProfit: '10-20% au-dessus du prix d\'entrée',
      positionSize: '2-5% du capital par trade'
    }
  },
  {
    id: 'breakout-aggressive',
    name: 'Breakout Agressif',
    description: 'Capture les cassures de niveaux clés avec effet de levier',
    type: 'aggressive',
    rules: [
      'Attendre la confirmation du breakout',
      'Volume doit être supérieur à la moyenne',
      'Stop loss serré obligatoire'
    ],
    riskLevel: 8,
    timeframe: 'Court terme (heures à jours)',
    indicators: ['Volume', 'Bollinger Bands', 'ATR', 'Niveaux clés'],
    entryConditions: [
      'Prix casse la résistance avec volume',
      'Bollinger Bands s\'écartent',
      'ATR en augmentation'
    ],
    exitConditions: [
      'Objectif atteint (1.5x ATR)',
      'Volume diminue',
      'Faux breakout détecté'
    ],
    riskManagement: {
      stopLoss: '2-3% ou sous le niveau cassé',
      takeProfit: '1.5-2x le risque pris',
      positionSize: '1-2% du capital par trade'
    }
  },
  {
    id: 'grid-trading',
    name: 'Grid Trading Automatisé',
    description: 'Achats et ventes automatiques sur une grille de prix',
    type: 'moderate',
    rules: [
      'Définir une range de prix (haut/bas)',
      'Placer des ordres à intervalles réguliers',
      'Profiter de la volatilité latérale'
    ],
    riskLevel: 4,
    timeframe: 'Variable (adapté au marché)',
    indicators: ['Support/Résistance', 'ATR', 'Volatilité historique'],
    entryConditions: [
      'Marché en range identifié',
      'Volatilité modérée',
      'Grille configurée'
    ],
    exitConditions: [
      'Prix sort de la range',
      'Profit cible atteint',
      'Tendance forte détectée'
    ],
    riskManagement: {
      stopLoss: 'Sortie si prix < bas de la grille -5%',
      takeProfit: 'Accumulation des petits profits',
      positionSize: 'Capital divisé par nombre de niveaux'
    }
  },
  {
    id: 'fear-greed',
    name: 'Stratégie Fear & Greed',
    description: 'Acheter la peur, vendre la cupidité',
    type: 'moderate',
    rules: [
      'Acheter quand Fear & Greed < 25 (Extreme Fear)',
      'Vendre quand Fear & Greed > 75 (Extreme Greed)',
      'Patience et discipline'
    ],
    riskLevel: 5,
    timeframe: 'Moyen à long terme',
    indicators: ['Fear & Greed Index', 'RSI', 'Sentiment social'],
    entryConditions: [
      'Fear & Greed Index < 25',
      'RSI < 30',
      'News négatives dominantes'
    ],
    exitConditions: [
      'Fear & Greed Index > 75',
      'RSI > 70',
      'Euphorie généralisée'
    ],
    riskManagement: {
      stopLoss: '15-20% (stratégie contrarian)',
      takeProfit: 'Vente progressive par paliers',
      positionSize: '10-20% du capital par zone de peur'
    }
  }
];

/**
 * Obtenir un template de stratégie par ID
 */
export function getTradingTemplate(id: string): TradingTemplate | undefined {
  return tradingTemplates.find(t => t.id === id);
}

/**
 * Obtenir les templates par type de risque
 */
export function getTemplatesByRisk(type: 'conservative' | 'moderate' | 'aggressive'): TradingTemplate[] {
  return tradingTemplates.filter(t => t.type === type);
}

/**
 * Formater un template pour l'affichage
 */
export function formatTemplateForDisplay(template: TradingTemplate): string {
  return `
## 📊 ${template.name}

**Description**: ${template.description}

**Type**: ${template.type === 'conservative' ? '🟢 Conservateur' : template.type === 'moderate' ? '🟡 Modéré' : '🔴 Agressif'}
**Niveau de risque**: ${'⚠️'.repeat(Math.ceil(template.riskLevel / 2))} (${template.riskLevel}/10)
**Timeframe**: ${template.timeframe}

### 📏 Règles
${template.rules.map(r => `- ${r}`).join('\n')}

### 📈 Indicateurs utilisés
${template.indicators.map(i => `- ${i}`).join('\n')}

### ✅ Conditions d'entrée
${template.entryConditions.map(c => `- ${c}`).join('\n')}

### ❌ Conditions de sortie
${template.exitConditions.map(c => `- ${c}`).join('\n')}

### 🛡️ Gestion du risque
- **Stop Loss**: ${template.riskManagement.stopLoss}
- **Take Profit**: ${template.riskManagement.takeProfit}
- **Taille de position**: ${template.riskManagement.positionSize}
`;
}

// ============================================================================
// COMPARAISON MULTI-CRYPTO
// ============================================================================

import { getCryptoPrice, generateTechnicalAnalysis, CryptoPrice } from './cryptoExpert';

export interface CryptoComparison {
  cryptos: Array<{
    id: string;
    name: string;
    price: number;
    change24h: number;
    marketCap: number;
    volume: number;
    rsi?: number;
    recommendation: 'buy' | 'hold' | 'sell';
  }>;
  winner: string;
  analysis: string;
}

/**
 * Compare plusieurs cryptos
 */
export async function compareMultipleCryptos(cryptoIds: string[]): Promise<CryptoComparison> {
  const results: CryptoComparison['cryptos'] = [];
  
  for (const id of cryptoIds.slice(0, 5)) { // Max 5 cryptos
    try {
      const [price, technical] = await Promise.all([
        getCryptoPrice(id),
        generateTechnicalAnalysis(id).catch(() => null)
      ]);
      
      if (price) {
        let recommendation: 'buy' | 'hold' | 'sell' = 'hold';
        const rsi = technical?.rsi;
        
        if (rsi) {
          if (rsi < 30 && price.price_change_percentage_24h < 0) recommendation = 'buy';
          else if (rsi > 70 && price.price_change_percentage_24h > 10) recommendation = 'sell';
        }
        
        results.push({
          id: price.id,
          name: price.name,
          price: price.current_price,
          change24h: price.price_change_percentage_24h,
          marketCap: price.market_cap,
          volume: price.total_volume,
          rsi: rsi,
          recommendation
        });
      }
    } catch (error) {
      console.error(`[InnovativeFeatures] Error fetching ${id}:`, error);
    }
  }
  
  // Déterminer le "gagnant" basé sur plusieurs critères
  let winner = '';
  let bestScore = -Infinity;
  
  for (const crypto of results) {
    let score = 0;
    // Score basé sur la performance 24h (normalisé)
    score += crypto.change24h * 2;
    // Score basé sur le RSI (favoriser les oversold)
    if (crypto.rsi && crypto.rsi < 40) score += (40 - crypto.rsi);
    // Score basé sur le volume relatif au market cap
    score += (crypto.volume / crypto.marketCap) * 100;
    
    if (score > bestScore) {
      bestScore = score;
      winner = crypto.name;
    }
  }
  
  // Générer l'analyse
  const analysis = generateComparisonAnalysis(results, winner);
  
  return { cryptos: results, winner, analysis };
}

function generateComparisonAnalysis(
  cryptos: CryptoComparison['cryptos'],
  winner: string
): string {
  let analysis = `## 📊 Comparaison Multi-Crypto\n\n`;
  analysis += `| Crypto | Prix | 24h | RSI | Recommandation |\n`;
  analysis += `|--------|------|-----|-----|----------------|\n`;
  
  for (const c of cryptos) {
    const changeEmoji = c.change24h >= 0 ? '🟢' : '🔴';
    const recEmoji = c.recommendation === 'buy' ? '💚' : c.recommendation === 'sell' ? '❤️' : '💛';
    analysis += `| ${c.name} | $${c.price.toLocaleString()} | ${changeEmoji} ${c.change24h.toFixed(2)}% | ${c.rsi?.toFixed(0) || 'N/A'} | ${recEmoji} ${c.recommendation.toUpperCase()} |\n`;
  }
  
  analysis += `\n### 🏆 Meilleur choix actuel: **${winner}**\n`;
  analysis += `\n*Analyse basée sur: performance 24h, RSI, et ratio volume/market cap*`;
  
  return analysis;
}

// ============================================================================
// SUGGESTIONS INTELLIGENTES
// ============================================================================

export interface SmartSuggestion {
  type: 'action' | 'question' | 'tip';
  text: string;
  priority: number;
  context?: string;
}

/**
 * Génère des suggestions intelligentes basées sur le contexte
 */
export function generateSmartSuggestions(
  userMessage: string,
  previousMessages: string[] = []
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  const lowerMessage = userMessage.toLowerCase();
  
  // Suggestions crypto
  if (lowerMessage.includes('bitcoin') || lowerMessage.includes('btc')) {
    suggestions.push({
      type: 'question',
      text: 'Voulez-vous voir l\'analyse technique complète du Bitcoin ?',
      priority: 1
    });
    suggestions.push({
      type: 'action',
      text: 'Comparer Bitcoin avec Ethereum et Solana',
      priority: 2
    });
  }
  
  // Suggestions trading
  if (lowerMessage.includes('stratégie') || lowerMessage.includes('trading')) {
    suggestions.push({
      type: 'tip',
      text: 'Conseil: Commencez par une stratégie DCA si vous débutez',
      priority: 1
    });
    suggestions.push({
      type: 'action',
      text: 'Voir les templates de stratégies disponibles',
      priority: 2
    });
  }
  
  // Suggestions code
  if (lowerMessage.includes('code') || lowerMessage.includes('script')) {
    suggestions.push({
      type: 'tip',
      text: 'Je peux exécuter du Python et JavaScript en temps réel',
      priority: 1
    });
  }
  
  // Suggestions météo
  if (lowerMessage.includes('météo') || lowerMessage.includes('temps')) {
    suggestions.push({
      type: 'question',
      text: 'Voulez-vous les prévisions pour les prochains jours ?',
      priority: 2
    });
  }
  
  return suggestions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// EXPORT DES ANALYSES EN MARKDOWN
// ============================================================================

export interface ExportOptions {
  format: 'markdown' | 'json';
  includeTimestamp: boolean;
  includeDisclaimer: boolean;
}

/**
 * Exporte une analyse en format structuré
 */
export function exportAnalysis(
  title: string,
  content: string,
  options: ExportOptions = { format: 'markdown', includeTimestamp: true, includeDisclaimer: true }
): string {
  let output = '';
  
  if (options.format === 'markdown') {
    output += `# ${title}\n\n`;
    
    if (options.includeTimestamp) {
      output += `*Généré le ${new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}*\n\n`;
    }
    
    output += content;
    
    if (options.includeDisclaimer) {
      output += `\n\n---\n\n`;
      output += `⚠️ **Avertissement**: Cette analyse est fournie à titre informatif uniquement. `;
      output += `Elle ne constitue pas un conseil financier. Faites toujours vos propres recherches `;
      output += `avant de prendre des décisions d'investissement.`;
    }
  } else {
    output = JSON.stringify({
      title,
      content,
      timestamp: options.includeTimestamp ? new Date().toISOString() : undefined,
      disclaimer: options.includeDisclaimer ? 'Cette analyse est fournie à titre informatif uniquement.' : undefined
    }, null, 2);
  }
  
  return output;
}
