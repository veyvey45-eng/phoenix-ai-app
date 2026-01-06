/**
 * Crypto Expert Router
 * 
 * Endpoints tRPC pour l'analyse crypto avancée
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import {
  getCryptoPrice,
  getTopCryptos,
  getOHLCData,
  getPriceHistory,
  getTrendingCryptos,
  getGlobalMarketData,
  generateTechnicalAnalysis,
  generateFullAnalysis,
  getMarketSentiment,
  getFearGreedIndex,
  formatAnalysisForPhoenix,
  formatSentimentForPhoenix,
  calculateDCA,
  calculatePositionSize
} from '../phoenix/cryptoExpert';

export const cryptoExpertRouter = router({
  // ============================================================================
  // DONNÉES DE MARCHÉ
  // ============================================================================
  
  /**
   * Récupère le prix d'une crypto
   */
  getPrice: publicProcedure
    .input(z.object({
      cryptoId: z.string()
    }))
    .query(async ({ input }) => {
      const price = await getCryptoPrice(input.cryptoId);
      return price;
    }),
  
  /**
   * Récupère les top cryptos
   */
  getTopCryptos: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(250).default(100)
    }).optional())
    .query(async ({ input }) => {
      const cryptos = await getTopCryptos(input?.limit || 100);
      return cryptos;
    }),
  
  /**
   * Récupère les données OHLC
   */
  getOHLC: publicProcedure
    .input(z.object({
      cryptoId: z.string(),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input }) => {
      const ohlc = await getOHLCData(input.cryptoId, input.days);
      return ohlc;
    }),
  
  /**
   * Récupère l'historique des prix
   */
  getPriceHistory: publicProcedure
    .input(z.object({
      cryptoId: z.string(),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input }) => {
      const history = await getPriceHistory(input.cryptoId, input.days);
      return history;
    }),
  
  /**
   * Récupère les cryptos trending
   */
  getTrending: publicProcedure
    .query(async () => {
      const trending = await getTrendingCryptos();
      return trending;
    }),
  
  /**
   * Récupère les données globales du marché
   */
  getGlobalData: publicProcedure
    .query(async () => {
      const globalData = await getGlobalMarketData();
      return globalData;
    }),
  
  // ============================================================================
  // ANALYSE TECHNIQUE
  // ============================================================================
  
  /**
   * Génère une analyse technique
   */
  getTechnicalAnalysis: publicProcedure
    .input(z.object({
      cryptoId: z.string()
    }))
    .query(async ({ input }) => {
      const analysis = await generateTechnicalAnalysis(input.cryptoId);
      return analysis;
    }),
  
  /**
   * Génère une analyse complète
   */
  getFullAnalysis: publicProcedure
    .input(z.object({
      cryptoId: z.string()
    }))
    .query(async ({ input }) => {
      const analysis = await generateFullAnalysis(input.cryptoId);
      if (!analysis) return null;
      
      return {
        ...analysis,
        formattedAnalysis: formatAnalysisForPhoenix(analysis)
      };
    }),
  
  // ============================================================================
  // SENTIMENT DE MARCHÉ
  // ============================================================================
  
  /**
   * Récupère le Fear & Greed Index
   */
  getFearGreedIndex: publicProcedure
    .query(async () => {
      const fgi = await getFearGreedIndex();
      return fgi;
    }),
  
  /**
   * Récupère le sentiment de marché complet
   */
  getMarketSentiment: publicProcedure
    .query(async () => {
      const sentiment = await getMarketSentiment();
      if (!sentiment) return null;
      
      return {
        ...sentiment,
        formatted: formatSentimentForPhoenix(sentiment)
      };
    }),
  
  // ============================================================================
  // CALCULATEURS
  // ============================================================================
  
  /**
   * Calculateur DCA
   */
  calculateDCA: publicProcedure
    .input(z.object({
      cryptoId: z.string(),
      investmentAmount: z.number().positive(),
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      duration: z.number().min(1).max(60) // mois
    }))
    .mutation(async ({ input }) => {
      const history = await getPriceHistory(input.cryptoId, input.duration * 30);
      if (history.length === 0) {
        throw new Error('Impossible de récupérer l\'historique des prix');
      }
      
      const prices = history.map(h => h.price);
      const result = calculateDCA(
        input.investmentAmount,
        input.frequency,
        input.duration,
        prices
      );
      
      return result;
    }),
  
  /**
   * Calculateur de position sizing
   */
  calculatePositionSize: publicProcedure
    .input(z.object({
      accountBalance: z.number().positive(),
      riskPercentage: z.number().min(0.1).max(100),
      entryPrice: z.number().positive(),
      stopLossPrice: z.number().positive()
    }))
    .mutation(async ({ input }) => {
      const result = calculatePositionSize(
        input.accountBalance,
        input.riskPercentage,
        input.entryPrice,
        input.stopLossPrice
      );
      
      return result;
    }),
  
  // ============================================================================
  // ANALYSE POUR PHOENIX CHAT
  // ============================================================================
  
  /**
   * Génère une analyse formatée pour le chat Phoenix
   */
  analyzeForChat: publicProcedure
    .input(z.object({
      cryptoId: z.string(),
      includeStrategies: z.boolean().default(true),
      includeSentiment: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      const [analysis, sentiment] = await Promise.all([
        generateFullAnalysis(input.cryptoId),
        input.includeSentiment ? getMarketSentiment() : null
      ]);
      
      if (!analysis) {
        return {
          success: false,
          error: `Impossible d'analyser ${input.cryptoId}. Vérifiez l'ID de la crypto.`
        };
      }
      
      let response = formatAnalysisForPhoenix(analysis);
      
      if (sentiment) {
        response += '\n\n' + formatSentimentForPhoenix(sentiment);
      }
      
      return {
        success: true,
        analysis: response,
        recommendation: analysis.recommendation,
        riskLevel: analysis.riskLevel,
        currentPrice: analysis.crypto.current_price,
        change24h: analysis.crypto.price_change_percentage_24h
      };
    }),
  
  /**
   * Recherche une crypto par nom ou symbole
   */
  searchCrypto: publicProcedure
    .input(z.object({
      query: z.string()
    }))
    .query(async ({ input }) => {
      // Mapping des noms courants vers les IDs CoinGecko
      const commonMappings: Record<string, string> = {
        'btc': 'bitcoin',
        'bitcoin': 'bitcoin',
        'eth': 'ethereum',
        'ethereum': 'ethereum',
        'sol': 'solana',
        'solana': 'solana',
        'ada': 'cardano',
        'cardano': 'cardano',
        'xrp': 'ripple',
        'ripple': 'ripple',
        'dot': 'polkadot',
        'polkadot': 'polkadot',
        'doge': 'dogecoin',
        'dogecoin': 'dogecoin',
        'shib': 'shiba-inu',
        'shiba': 'shiba-inu',
        'avax': 'avalanche-2',
        'avalanche': 'avalanche-2',
        'matic': 'matic-network',
        'polygon': 'matic-network',
        'link': 'chainlink',
        'chainlink': 'chainlink',
        'uni': 'uniswap',
        'uniswap': 'uniswap',
        'ltc': 'litecoin',
        'litecoin': 'litecoin',
        'atom': 'cosmos',
        'cosmos': 'cosmos',
        'xlm': 'stellar',
        'stellar': 'stellar',
        'bnb': 'binancecoin',
        'binance': 'binancecoin',
        'usdt': 'tether',
        'tether': 'tether',
        'usdc': 'usd-coin',
        'xmr': 'monero',
        'monero': 'monero',
        'aave': 'aave',
        'algo': 'algorand',
        'algorand': 'algorand',
        'near': 'near',
        'ftm': 'fantom',
        'fantom': 'fantom',
        'sand': 'the-sandbox',
        'sandbox': 'the-sandbox',
        'mana': 'decentraland',
        'decentraland': 'decentraland',
        'axs': 'axie-infinity',
        'axie': 'axie-infinity',
        'crv': 'curve-dao-token',
        'curve': 'curve-dao-token',
        'mkr': 'maker',
        'maker': 'maker',
        'comp': 'compound-governance-token',
        'compound': 'compound-governance-token',
        'snx': 'havven',
        'synthetix': 'havven',
        'ape': 'apecoin',
        'apecoin': 'apecoin',
        'ldo': 'lido-dao',
        'lido': 'lido-dao',
        'arb': 'arbitrum',
        'arbitrum': 'arbitrum',
        'op': 'optimism',
        'optimism': 'optimism',
        'sui': 'sui',
        'apt': 'aptos',
        'aptos': 'aptos',
        'inj': 'injective-protocol',
        'injective': 'injective-protocol',
        'sei': 'sei-network',
        'pepe': 'pepe',
        'wif': 'dogwifcoin',
        'bonk': 'bonk',
        'floki': 'floki',
        'render': 'render-token',
        'rndr': 'render-token',
        'fet': 'fetch-ai',
        'fetch': 'fetch-ai',
        'grt': 'the-graph',
        'graph': 'the-graph',
        'imx': 'immutable-x',
        'immutable': 'immutable-x'
      };
      
      const normalizedQuery = input.query.toLowerCase().trim();
      const cryptoId = commonMappings[normalizedQuery] || normalizedQuery;
      
      return {
        query: input.query,
        cryptoId,
        found: commonMappings[normalizedQuery] !== undefined
      };
    })
});
