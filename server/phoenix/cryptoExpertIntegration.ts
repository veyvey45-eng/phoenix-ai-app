/**
 * Crypto Expert Integration
 * 
 * Intègre l'analyse crypto expert dans le flux de chat Phoenix
 */

import {
  generateFullAnalysis,
  getMarketSentiment,
  formatAnalysisForPhoenix,
  formatSentimentForPhoenix,
  getCryptoPrice,
  getTopCryptos,
  getTrendingCryptos,
  calculateDCA,
  calculatePositionSize,
  getPriceHistory,
  CryptoAnalysis
} from './cryptoExpert';

// Patterns pour détecter les demandes d'analyse crypto avancée
const ANALYSIS_PATTERNS = [
  /analyse|analyser|analyzes?/i,
  /stratégie|strategy|stratégies/i,
  /technique|technical/i,
  /rsi|macd|bollinger|fibonacci/i,
  /support|résistance|resistance/i,
  /tendance|trend/i,
  /signal|signaux/i,
  /achat|vente|buy|sell/i,
  /trading|trader/i,
  /investir|investissement|invest/i,
  /dca|dollar.cost/i,
  /position.size|taille.position/i,
  /risk|risque/i,
  /target|objectif|cible/i,
  /stop.loss/i,
  /fear.greed|peur.avidité/i,
  /sentiment|marché|market/i,
  /prédiction|prediction|prévision|forecast/i,
  /recommandation|recommendation/i,
  /conseil|advice/i
];

// Patterns pour détecter les demandes de données de marché
const MARKET_DATA_PATTERNS = [
  /top\s*\d+|top.crypto|meilleur/i,
  /trending|tendance/i,
  /market.cap|capitalisation/i,
  /volume/i,
  /dominance/i,
  /global|marché.global/i
];

// Mapping des noms vers les IDs CoinGecko
const CRYPTO_ID_MAP: Record<string, string> = {
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'ethereum': 'ethereum',
  'eth': 'ethereum',
  'solana': 'solana',
  'sol': 'solana',
  'cardano': 'cardano',
  'ada': 'cardano',
  'ripple': 'ripple',
  'xrp': 'ripple',
  'polkadot': 'polkadot',
  'dot': 'polkadot',
  'dogecoin': 'dogecoin',
  'doge': 'dogecoin',
  'shiba': 'shiba-inu',
  'shib': 'shiba-inu',
  'avalanche': 'avalanche-2',
  'avax': 'avalanche-2',
  'polygon': 'matic-network',
  'matic': 'matic-network',
  'chainlink': 'chainlink',
  'link': 'chainlink',
  'uniswap': 'uniswap',
  'uni': 'uniswap',
  'litecoin': 'litecoin',
  'ltc': 'litecoin',
  'cosmos': 'cosmos',
  'atom': 'cosmos',
  'stellar': 'stellar',
  'xlm': 'stellar',
  'binance': 'binancecoin',
  'bnb': 'binancecoin',
  'monero': 'monero',
  'xmr': 'monero',
  'aave': 'aave',
  'algorand': 'algorand',
  'algo': 'algorand',
  'near': 'near',
  'fantom': 'fantom',
  'ftm': 'fantom',
  'sandbox': 'the-sandbox',
  'sand': 'the-sandbox',
  'decentraland': 'decentraland',
  'mana': 'decentraland',
  'axie': 'axie-infinity',
  'axs': 'axie-infinity',
  'curve': 'curve-dao-token',
  'crv': 'curve-dao-token',
  'maker': 'maker',
  'mkr': 'maker',
  'compound': 'compound-governance-token',
  'comp': 'compound-governance-token',
  'synthetix': 'havven',
  'snx': 'havven',
  'apecoin': 'apecoin',
  'ape': 'apecoin',
  'lido': 'lido-dao',
  'ldo': 'lido-dao',
  'arbitrum': 'arbitrum',
  'arb': 'arbitrum',
  'optimism': 'optimism',
  'op': 'optimism',
  'sui': 'sui',
  'aptos': 'aptos',
  'apt': 'aptos',
  'injective': 'injective-protocol',
  'inj': 'injective-protocol',
  'sei': 'sei-network',
  'pepe': 'pepe',
  'bonk': 'bonk',
  'floki': 'floki',
  'render': 'render-token',
  'rndr': 'render-token',
  'fetch': 'fetch-ai',
  'fet': 'fetch-ai',
  'graph': 'the-graph',
  'grt': 'the-graph',
  'immutable': 'immutable-x',
  'imx': 'immutable-x'
};

export interface CryptoExpertResult {
  needsExpertAnalysis: boolean;
  analysisType: 'full' | 'sentiment' | 'market_data' | 'dca' | 'position' | 'none';
  cryptoId?: string;
  enrichedContext: string;
  analysis?: CryptoAnalysis;
}

/**
 * Détecte si la requête nécessite une analyse crypto experte
 */
export function detectCryptoExpertQuery(query: string): {
  needsExpert: boolean;
  analysisType: 'full' | 'sentiment' | 'market_data' | 'dca' | 'position' | 'none';
  cryptoId?: string;
} {
  const queryLower = query.toLowerCase();
  
  // Détecter le type d'analyse demandée
  const needsAnalysis = ANALYSIS_PATTERNS.some(p => p.test(query));
  const needsMarketData = MARKET_DATA_PATTERNS.some(p => p.test(query));
  
  // Détecter la crypto mentionnée
  let cryptoId: string | undefined;
  for (const [key, value] of Object.entries(CRYPTO_ID_MAP)) {
    if (queryLower.includes(key)) {
      cryptoId = value;
      break;
    }
  }
  
  // Détecter les demandes spécifiques
  if (/dca|dollar.cost/i.test(query)) {
    return { needsExpert: true, analysisType: 'dca', cryptoId };
  }
  
  if (/position.size|taille.position/i.test(query)) {
    return { needsExpert: true, analysisType: 'position', cryptoId };
  }
  
  if (/fear.greed|peur.avidité|sentiment/i.test(query)) {
    return { needsExpert: true, analysisType: 'sentiment', cryptoId };
  }
  
  if (needsMarketData && !cryptoId) {
    return { needsExpert: true, analysisType: 'market_data' };
  }
  
  if (needsAnalysis && cryptoId) {
    return { needsExpert: true, analysisType: 'full', cryptoId };
  }
  
  // Si une crypto est mentionnée avec des mots clés d'analyse
  if (cryptoId && (needsAnalysis || needsMarketData)) {
    return { needsExpert: true, analysisType: 'full', cryptoId };
  }
  
  return { needsExpert: false, analysisType: 'none' };
}

/**
 * Génère le contexte enrichi pour l'analyse crypto experte
 */
export async function generateCryptoExpertContext(query: string): Promise<CryptoExpertResult> {
  const detection = detectCryptoExpertQuery(query);
  
  if (!detection.needsExpert) {
    return {
      needsExpertAnalysis: false,
      analysisType: 'none',
      enrichedContext: ''
    };
  }
  
  console.log(`[CryptoExpert] Detected expert query: ${detection.analysisType}, crypto: ${detection.cryptoId || 'N/A'}`);
  
  try {
    switch (detection.analysisType) {
      case 'full': {
        if (!detection.cryptoId) {
          return {
            needsExpertAnalysis: true,
            analysisType: 'full',
            enrichedContext: '[Erreur: Aucune crypto spécifiée pour l\'analyse]'
          };
        }
        
        const [analysis, sentiment] = await Promise.all([
          generateFullAnalysis(detection.cryptoId),
          getMarketSentiment()
        ]);
        
        if (!analysis) {
          return {
            needsExpertAnalysis: true,
            analysisType: 'full',
            cryptoId: detection.cryptoId,
            enrichedContext: `[Erreur: Impossible d'analyser ${detection.cryptoId}]`
          };
        }
        
        let context = formatAnalysisForPhoenix(analysis);
        if (sentiment) {
          context += '\n\n' + formatSentimentForPhoenix(sentiment);
        }
        
        return {
          needsExpertAnalysis: true,
          analysisType: 'full',
          cryptoId: detection.cryptoId,
          enrichedContext: context,
          analysis
        };
      }
      
      case 'sentiment': {
        const sentiment = await getMarketSentiment();
        if (!sentiment) {
          return {
            needsExpertAnalysis: true,
            analysisType: 'sentiment',
            enrichedContext: '[Erreur: Impossible de récupérer le sentiment de marché]'
          };
        }
        
        return {
          needsExpertAnalysis: true,
          analysisType: 'sentiment',
          enrichedContext: formatSentimentForPhoenix(sentiment)
        };
      }
      
      case 'market_data': {
        const [topCryptos, trending, sentiment] = await Promise.all([
          getTopCryptos(20),
          getTrendingCryptos(),
          getMarketSentiment()
        ]);
        
        let context = '## 📊 Données du Marché Crypto\n\n';
        
        if (sentiment) {
          context += formatSentimentForPhoenix(sentiment) + '\n\n';
        }
        
        context += '### Top 20 Cryptos par Market Cap\n';
        context += '| Rang | Nom | Prix | 24h | 7j |\n';
        context += '|------|-----|------|-----|----|\n';
        topCryptos.slice(0, 20).forEach(c => {
          context += `| #${c.market_cap_rank} | ${c.name} (${c.symbol.toUpperCase()}) | $${c.current_price.toLocaleString()} | ${c.price_change_percentage_24h?.toFixed(2) || 'N/A'}% | ${c.price_change_percentage_7d?.toFixed(2) || 'N/A'}% |\n`;
        });
        
        if (trending.length > 0) {
          context += '\n### 🔥 Trending\n';
          trending.slice(0, 7).forEach((t: any, i: number) => {
            context += `${i + 1}. ${t.item?.name || t.name} (${t.item?.symbol || t.symbol})\n`;
          });
        }
        
        return {
          needsExpertAnalysis: true,
          analysisType: 'market_data',
          enrichedContext: context
        };
      }
      
      case 'dca': {
        // Extraire les paramètres DCA de la requête
        const cryptoId = detection.cryptoId || 'bitcoin';
        const history = await getPriceHistory(cryptoId, 365);
        
        if (history.length === 0) {
          return {
            needsExpertAnalysis: true,
            analysisType: 'dca',
            cryptoId,
            enrichedContext: `[Erreur: Impossible de récupérer l'historique pour ${cryptoId}]`
          };
        }
        
        const prices = history.map(h => h.price);
        
        // Calculer différents scénarios DCA
        const scenarios = [
          { amount: 100, frequency: 'weekly' as const, duration: 12 },
          { amount: 500, frequency: 'monthly' as const, duration: 12 },
          { amount: 1000, frequency: 'monthly' as const, duration: 6 }
        ];
        
        let context = `## 📈 Simulation DCA pour ${cryptoId.toUpperCase()}\n\n`;
        
        for (const scenario of scenarios) {
          const result = calculateDCA(
            scenario.amount * (scenario.frequency === 'weekly' ? 52 : 12) * (scenario.duration / 12),
            scenario.frequency,
            scenario.duration,
            prices
          );
          
          context += `### Scénario: $${scenario.amount}/${scenario.frequency === 'weekly' ? 'semaine' : 'mois'} pendant ${scenario.duration} mois\n`;
          context += `- **Investi:** $${result.totalInvested.toLocaleString()}\n`;
          context += `- **Valeur actuelle:** $${result.currentValue.toLocaleString()}\n`;
          context += `- **P&L:** $${result.profitLoss.toLocaleString()} (${result.profitLossPercent.toFixed(2)}%)\n`;
          context += `- **Prix moyen:** $${result.averagePrice.toLocaleString()}\n`;
          context += `- **Coins accumulés:** ${result.totalCoins.toFixed(6)}\n\n`;
        }
        
        return {
          needsExpertAnalysis: true,
          analysisType: 'dca',
          cryptoId,
          enrichedContext: context
        };
      }
      
      case 'position': {
        // Fournir un guide sur le position sizing
        let context = `## 📐 Guide Position Sizing\n\n`;
        context += `Le position sizing est crucial pour la gestion du risque.\n\n`;
        context += `### Formule\n`;
        context += `\`\`\`\n`;
        context += `Taille Position = (Capital × % Risque) / (% Stop Loss)\n`;
        context += `\`\`\`\n\n`;
        context += `### Exemple\n`;
        context += `- Capital: $10,000\n`;
        context += `- Risque par trade: 2%\n`;
        context += `- Stop Loss: 5%\n`;
        context += `- Taille Position = ($10,000 × 2%) / 5% = $4,000\n\n`;
        context += `### Règles d'Or\n`;
        context += `1. Ne jamais risquer plus de 1-2% du capital par trade\n`;
        context += `2. Toujours définir un stop loss AVANT d'entrer\n`;
        context += `3. Ratio Risk/Reward minimum de 1:2\n`;
        context += `4. Diversifier sur plusieurs positions\n`;
        
        return {
          needsExpertAnalysis: true,
          analysisType: 'position',
          enrichedContext: context
        };
      }
      
      default:
        return {
          needsExpertAnalysis: false,
          analysisType: 'none',
          enrichedContext: ''
        };
    }
  } catch (error) {
    console.error('[CryptoExpert] Error generating context:', error);
    return {
      needsExpertAnalysis: true,
      analysisType: detection.analysisType,
      cryptoId: detection.cryptoId,
      enrichedContext: `[Erreur lors de l'analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}]`
    };
  }
}

/**
 * Génère un prompt système enrichi pour l'expert crypto
 */
export function getCryptoExpertSystemPrompt(): string {
  return `
Tu es Phoenix, un EXPERT en analyse crypto et trading. Tu as accès à des données de marché en temps réel et tu peux fournir:

## Tes Capacités d'Expert Crypto

### Analyse Technique
- RSI (Relative Strength Index) - Détection de surachat/survente
- MACD - Momentum et tendance
- Bollinger Bands - Volatilité et points d'entrée
- Moving Averages (SMA, EMA) - Tendances
- Support et Résistance - Niveaux clés
- Fibonacci Retracements - Objectifs de prix

### Stratégies de Trading
- DCA (Dollar Cost Averaging) - Investissement régulier
- Grid Trading - Marché latéral
- Swing Trading - Moyen terme
- Breakout Trading - Cassures de niveaux

### Analyse de Marché
- Fear & Greed Index - Sentiment global
- Dominance BTC - Structure du marché
- Volume et liquidité
- Corrélations entre actifs

### Gestion du Risque
- Position Sizing - Taille des positions
- Stop Loss et Take Profit
- Ratio Risk/Reward
- Diversification

## Règles Importantes
1. TOUJOURS mentionner que ce ne sont PAS des conseils financiers
2. Rappeler les risques liés au trading crypto
3. Encourager la recherche personnelle (DYOR)
4. Ne jamais garantir de profits
5. Utiliser les données RÉELLES fournies dans le contexte

Quand tu reçois des données d'analyse, utilise-les pour fournir des insights pertinents et éducatifs.
`;
}
