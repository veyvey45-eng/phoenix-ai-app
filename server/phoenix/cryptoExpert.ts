/**
 * Phoenix Crypto Expert Module
 * 
 * Module complet d'analyse crypto avec:
 * - Indicateurs techniques (RSI, MACD, Bollinger, etc.)
 * - Données de marché en temps réel via CoinGecko
 * - Stratégies de trading
 * - Sentiment de marché
 * - Analyse de portefeuille
 */

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: 'oversold' | 'neutral' | 'overbought';
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    signal: 'bullish' | 'bearish' | 'neutral';
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    bandwidth: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  support: number;
  resistance: number;
  fibonacciLevels: {
    level0: number;
    level236: number;
    level382: number;
    level50: number;
    level618: number;
    level786: number;
    level100: number;
  };
}

export interface MarketSentiment {
  fearGreedIndex: number;
  fearGreedLabel: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  btcDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  marketCapChange24h: number;
}

export interface TradingStrategy {
  name: string;
  type: 'DCA' | 'Grid' | 'Swing' | 'Breakout' | 'Scalping';
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  riskRewardRatio?: number;
  explanation: string;
}

export interface CryptoAnalysis {
  crypto: CryptoPrice;
  technicalIndicators: TechnicalIndicators;
  strategies: TradingStrategy[];
  summary: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

// ============================================================================
// CACHE SYSTEM - Éviter les erreurs 429
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const priceCache = new Map<string, CacheEntry<CryptoPrice>>();
const topCryptosCache: CacheEntry<CryptoPrice[]> | null = { data: [], timestamp: 0 };
const CACHE_TTL = 60000; // 1 minute cache
const CACHE_TTL_LONG = 300000; // 5 minutes for top cryptos

function getCachedPrice(cryptoId: string): CryptoPrice | null {
  const cached = priceCache.get(cryptoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CryptoExpert] Using cached price for ${cryptoId}`);
    return cached.data;
  }
  return null;
}

function setCachedPrice(cryptoId: string, data: CryptoPrice): void {
  priceCache.set(cryptoId, { data, timestamp: Date.now() });
}

// ============================================================================
// API COINGECKO - ACCÈS COMPLET
// ============================================================================

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Récupère le prix et les données d'une crypto (avec cache)
 */
export async function getCryptoPrice(cryptoId: string): Promise<CryptoPrice | null> {
  // Vérifier le cache d'abord
  const cached = getCachedPrice(cryptoId);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&ids=${cryptoId}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d,30d`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      console.error(`[CryptoExpert] API error: ${response.status}`);
      // En cas d'erreur 429, retourner le dernier cache même expiré
      if (response.status === 429) {
        const expiredCache = priceCache.get(cryptoId);
        if (expiredCache) {
          console.log(`[CryptoExpert] Rate limited, using expired cache for ${cryptoId}`);
          return expiredCache.data;
        }
      }
      return null;
    }
    
    const data = await response.json();
    const result = data[0] || null;
    
    // Mettre en cache
    if (result) {
      setCachedPrice(cryptoId, result);
    }
    
    return result;
  } catch (error) {
    console.error('[CryptoExpert] getCryptoPrice error:', error);
    // En cas d'erreur, retourner le cache expiré si disponible
    const expiredCache = priceCache.get(cryptoId);
    if (expiredCache) {
      console.log(`[CryptoExpert] Error, using expired cache for ${cryptoId}`);
      return expiredCache.data;
    }
    return null;
  }
}

/**
 * Récupère les top cryptos par market cap
 */
export async function getTopCryptos(limit: number = 100): Promise<CryptoPrice[]> {
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d`,
      { signal: AbortSignal.timeout(15000) }
    );
    
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('[CryptoExpert] getTopCryptos error:', error);
    return [];
  }
}

/**
 * Récupère les données OHLC historiques
 */
export async function getOHLCData(cryptoId: string, days: number = 30): Promise<OHLCData[]> {
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${cryptoId}/ohlc?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.map((item: number[]) => ({
      timestamp: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4]
    }));
  } catch (error) {
    console.error('[CryptoExpert] getOHLCData error:', error);
    return [];
  }
}

// Mapping des IDs pour différentes APIs
const CRYPTO_SYMBOL_MAP: Record<string, { symbol: string; binanceSymbol: string }> = {
  'bitcoin': { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  'ethereum': { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
  'solana': { symbol: 'SOL', binanceSymbol: 'SOLUSDT' },
  'cardano': { symbol: 'ADA', binanceSymbol: 'ADAUSDT' },
  'ripple': { symbol: 'XRP', binanceSymbol: 'XRPUSDT' },
  'polkadot': { symbol: 'DOT', binanceSymbol: 'DOTUSDT' },
  'dogecoin': { symbol: 'DOGE', binanceSymbol: 'DOGEUSDT' },
  'avalanche-2': { symbol: 'AVAX', binanceSymbol: 'AVAXUSDT' },
  'matic-network': { symbol: 'MATIC', binanceSymbol: 'MATICUSDT' },
  'chainlink': { symbol: 'LINK', binanceSymbol: 'LINKUSDT' },
};

/**
 * Récupère l'historique des prix via CoinGecko
 */
async function getPriceHistoryFromCoinGecko(cryptoId: string, days: number): Promise<{timestamp: number; price: number}[]> {
  try {
    console.log(`[CryptoExpert] Trying CoinGecko for ${cryptoId}...`);
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${cryptoId}/market_chart?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      console.log(`[CryptoExpert] CoinGecko returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    if (data.status?.error_code === 429) {
      console.log('[CryptoExpert] CoinGecko rate limited');
      return [];
    }
    
    console.log(`[CryptoExpert] CoinGecko success: ${data.prices?.length || 0} prices`);
    return data.prices.map((item: number[]) => ({
      timestamp: item[0],
      price: item[1]
    }));
  } catch (error) {
    console.error('[CryptoExpert] CoinGecko error:', error);
    return [];
  }
}

/**
 * Récupère l'historique des prix via CryptoCompare (GRATUIT)
 */
async function getPriceHistoryFromCryptoCompare(cryptoId: string, days: number): Promise<{timestamp: number; price: number}[]> {
  try {
    const symbolInfo = CRYPTO_SYMBOL_MAP[cryptoId];
    if (!symbolInfo) {
      console.log(`[CryptoExpert] Unknown crypto ID for CryptoCompare: ${cryptoId}`);
      return [];
    }
    
    console.log(`[CryptoExpert] Trying CryptoCompare for ${symbolInfo.symbol}...`);
    
    // CryptoCompare API gratuite - histoday pour données journalières
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbolInfo.symbol}&tsym=USD&limit=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      console.log(`[CryptoExpert] CryptoCompare returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (data.Response === 'Error') {
      console.log(`[CryptoExpert] CryptoCompare error: ${data.Message}`);
      return [];
    }
    
    const prices = data.Data?.Data || [];
    console.log(`[CryptoExpert] CryptoCompare success: ${prices.length} prices`);
    
    return prices.map((item: { time: number; close: number }) => ({
      timestamp: item.time * 1000, // Convertir en millisecondes
      price: item.close
    }));
  } catch (error) {
    console.error('[CryptoExpert] CryptoCompare error:', error);
    return [];
  }
}

/**
 * Récupère l'historique des prix via Binance (GRATUIT)
 */
async function getPriceHistoryFromBinance(cryptoId: string, days: number): Promise<{timestamp: number; price: number}[]> {
  try {
    const symbolInfo = CRYPTO_SYMBOL_MAP[cryptoId];
    if (!symbolInfo) {
      console.log(`[CryptoExpert] Unknown crypto ID for Binance: ${cryptoId}`);
      return [];
    }
    
    console.log(`[CryptoExpert] Trying Binance for ${symbolInfo.binanceSymbol}...`);
    
    // Binance API gratuite - klines pour données historiques
    // Interval: 1d = 1 jour, limit = nombre de jours
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbolInfo.binanceSymbol}&interval=1d&limit=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      console.log(`[CryptoExpert] Binance returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.log('[CryptoExpert] Binance returned invalid data');
      return [];
    }
    
    console.log(`[CryptoExpert] Binance success: ${data.length} prices`);
    
    // Format Binance klines: [openTime, open, high, low, close, volume, closeTime, ...]
    return data.map((item: any[]) => ({
      timestamp: item[0], // openTime en millisecondes
      price: parseFloat(item[4]) // close price
    }));
  } catch (error) {
    console.error('[CryptoExpert] Binance error:', error);
    return [];
  }
}

/**
 * Récupère l'historique des prix avec fallback automatique
 * Ordre: CoinGecko → CryptoCompare → Binance
 */
export async function getPriceHistory(cryptoId: string, days: number = 30): Promise<{timestamp: number; price: number}[]> {
  console.log(`[CryptoExpert] Getting price history for ${cryptoId}, ${days} days`);
  
  // 1. Essayer CoinGecko d'abord
  let prices = await getPriceHistoryFromCoinGecko(cryptoId, days);
  if (prices.length > 0) {
    console.log('[CryptoExpert] Using CoinGecko data');
    return prices;
  }
  
  // 2. Fallback sur CryptoCompare
  console.log('[CryptoExpert] CoinGecko failed, trying CryptoCompare...');
  prices = await getPriceHistoryFromCryptoCompare(cryptoId, days);
  if (prices.length > 0) {
    console.log('[CryptoExpert] Using CryptoCompare data');
    return prices;
  }
  
  // 3. Fallback sur Binance
  console.log('[CryptoExpert] CryptoCompare failed, trying Binance...');
  prices = await getPriceHistoryFromBinance(cryptoId, days);
  if (prices.length > 0) {
    console.log('[CryptoExpert] Using Binance data');
    return prices;
  }
  
  console.error('[CryptoExpert] All APIs failed to get price history');
  return [];
}

/**
 * Récupère les cryptos trending
 */
export async function getTrendingCryptos(): Promise<any[]> {
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/search/trending`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.coins || [];
  } catch (error) {
    console.error('[CryptoExpert] getTrendingCryptos error:', error);
    return [];
  }
}

/**
 * Récupère les données globales du marché
 */
export async function getGlobalMarketData(): Promise<any> {
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/global`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('[CryptoExpert] getGlobalMarketData error:', error);
    return null;
  }
}

// ============================================================================
// INDICATEURS TECHNIQUES
// ============================================================================

/**
 * Calcule le RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calcule le MACD
 */
export function calculateMACD(prices: number[]): { macdLine: number; signalLine: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  
  // Signal line (9-period EMA of MACD)
  const macdValues = prices.slice(-26).map((_, i, arr) => {
    const slice = prices.slice(0, prices.length - 26 + i + 1);
    return calculateEMA(slice, 12) - calculateEMA(slice, 26);
  });
  const signalLine = calculateEMA(macdValues, 9);
  
  return {
    macdLine,
    signalLine,
    histogram: macdLine - signalLine
  };
}

/**
 * Calcule l'EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calcule le SMA (Simple Moving Average)
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calcule les Bollinger Bands
 */
export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
  bandwidth: number;
} {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  
  const squaredDiffs = slice.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  const upper = sma + (stdDev * standardDeviation);
  const lower = sma - (stdDev * standardDeviation);
  const currentPrice = prices[prices.length - 1];
  
  return {
    upper,
    middle: sma,
    lower,
    percentB: (currentPrice - lower) / (upper - lower),
    bandwidth: (upper - lower) / sma
  };
}

/**
 * Calcule les niveaux de Fibonacci
 */
export function calculateFibonacciLevels(high: number, low: number): {
  level0: number;
  level236: number;
  level382: number;
  level50: number;
  level618: number;
  level786: number;
  level100: number;
} {
  const diff = high - low;
  return {
    level0: high,
    level236: high - (diff * 0.236),
    level382: high - (diff * 0.382),
    level50: high - (diff * 0.5),
    level618: high - (diff * 0.618),
    level786: high - (diff * 0.786),
    level100: low
  };
}

/**
 * Détecte les niveaux de support et résistance
 */
export function detectSupportResistance(prices: number[]): { support: number; resistance: number } {
  if (prices.length < 10) {
    return { support: Math.min(...prices), resistance: Math.max(...prices) };
  }
  
  const recentPrices = prices.slice(-50);
  const sorted = [...recentPrices].sort((a, b) => a - b);
  
  // Support: zone des prix bas fréquents
  const support = sorted[Math.floor(sorted.length * 0.1)];
  // Resistance: zone des prix hauts fréquents
  const resistance = sorted[Math.floor(sorted.length * 0.9)];
  
  return { support, resistance };
}

// ============================================================================
// ANALYSE TECHNIQUE COMPLÈTE
// ============================================================================

/**
 * Génère une analyse technique complète
 */
export async function generateTechnicalAnalysis(cryptoId: string): Promise<TechnicalIndicators | null> {
  const priceHistory = await getPriceHistory(cryptoId, 90);
  if (priceHistory.length < 30) return null;
  
  const prices = priceHistory.map(p => p.price);
  const ohlc = await getOHLCData(cryptoId, 30);
  
  // RSI
  const rsi = calculateRSI(prices);
  let rsiSignal: 'oversold' | 'neutral' | 'overbought' = 'neutral';
  if (rsi < 30) rsiSignal = 'oversold';
  else if (rsi > 70) rsiSignal = 'overbought';
  
  // MACD
  const macd = calculateMACD(prices);
  let macdSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (macd.histogram > 0 && macd.macdLine > macd.signalLine) macdSignal = 'bullish';
  else if (macd.histogram < 0 && macd.macdLine < macd.signalLine) macdSignal = 'bearish';
  
  // Bollinger Bands
  const bollingerBands = calculateBollingerBands(prices);
  
  // Moving Averages
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const sma200 = prices.length >= 200 ? calculateSMA(prices, 200) : sma50;
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const currentPrice = prices[prices.length - 1];
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentPrice > sma20 && sma20 > sma50) trend = 'bullish';
  else if (currentPrice < sma20 && sma20 < sma50) trend = 'bearish';
  
  // Support/Resistance
  const { support, resistance } = detectSupportResistance(prices);
  
  // Fibonacci
  const high = Math.max(...prices.slice(-30));
  const low = Math.min(...prices.slice(-30));
  const fibonacciLevels = calculateFibonacciLevels(high, low);
  
  return {
    rsi,
    rsiSignal,
    macd: { ...macd, signal: macdSignal },
    bollingerBands,
    movingAverages: { sma20, sma50, sma200, ema12, ema26, trend },
    support,
    resistance,
    fibonacciLevels
  };
}

// ============================================================================
// STRATÉGIES DE TRADING
// ============================================================================

/**
 * Génère des stratégies de trading basées sur l'analyse technique
 */
export function generateTradingStrategies(
  price: CryptoPrice,
  indicators: TechnicalIndicators
): TradingStrategy[] {
  const strategies: TradingStrategy[] = [];
  const currentPrice = price.current_price;
  
  // 1. Stratégie DCA (Dollar Cost Averaging)
  const dcaStrategy: TradingStrategy = {
    name: 'DCA (Dollar Cost Averaging)',
    type: 'DCA',
    signal: 'buy',
    confidence: 0.8,
    explanation: `Investir régulièrement un montant fixe dans ${price.name} pour lisser le prix d'entrée moyen. Recommandé pour une vision long terme.`
  };
  
  if (indicators.rsiSignal === 'oversold') {
    dcaStrategy.confidence = 0.95;
    dcaStrategy.explanation += ' RSI en zone de survente - excellent moment pour accumuler.';
  }
  strategies.push(dcaStrategy);
  
  // 2. Stratégie Swing Trading
  const swingStrategy: TradingStrategy = {
    name: 'Swing Trading',
    type: 'Swing',
    signal: 'hold',
    confidence: 0.6,
    entryPrice: indicators.support,
    targetPrice: indicators.resistance,
    stopLoss: indicators.support * 0.95,
    riskRewardRatio: (indicators.resistance - currentPrice) / (currentPrice - indicators.support * 0.95),
    explanation: ''
  };
  
  if (indicators.rsiSignal === 'oversold' && indicators.macd.signal === 'bullish') {
    swingStrategy.signal = 'buy';
    swingStrategy.confidence = 0.85;
    swingStrategy.explanation = `Signal d'achat: RSI en survente (${indicators.rsi.toFixed(1)}) + MACD bullish. Entrée proche du support à $${indicators.support.toFixed(2)}, objectif $${indicators.resistance.toFixed(2)}.`;
  } else if (indicators.rsiSignal === 'overbought' && indicators.macd.signal === 'bearish') {
    swingStrategy.signal = 'sell';
    swingStrategy.confidence = 0.8;
    swingStrategy.explanation = `Signal de vente: RSI en surachat (${indicators.rsi.toFixed(1)}) + MACD bearish. Proche de la résistance.`;
  } else {
    swingStrategy.explanation = `Attendre un meilleur point d'entrée. Support: $${indicators.support.toFixed(2)}, Résistance: $${indicators.resistance.toFixed(2)}.`;
  }
  strategies.push(swingStrategy);
  
  // 3. Stratégie Breakout
  const breakoutStrategy: TradingStrategy = {
    name: 'Breakout Trading',
    type: 'Breakout',
    signal: 'hold',
    confidence: 0.5,
    explanation: ''
  };
  
  const distanceToResistance = (indicators.resistance - currentPrice) / currentPrice;
  const distanceToSupport = (currentPrice - indicators.support) / currentPrice;
  
  if (distanceToResistance < 0.02) {
    breakoutStrategy.signal = 'buy';
    breakoutStrategy.confidence = 0.7;
    breakoutStrategy.entryPrice = indicators.resistance * 1.01;
    breakoutStrategy.targetPrice = indicators.resistance * 1.1;
    breakoutStrategy.stopLoss = indicators.resistance * 0.97;
    breakoutStrategy.explanation = `Prix proche de la résistance ($${indicators.resistance.toFixed(2)}). Acheter sur cassure confirmée avec volume.`;
  } else if (distanceToSupport < 0.02) {
    breakoutStrategy.signal = 'sell';
    breakoutStrategy.confidence = 0.65;
    breakoutStrategy.explanation = `Prix proche du support ($${indicators.support.toFixed(2)}). Risque de cassure baissière.`;
  } else {
    breakoutStrategy.explanation = `Pas de signal de breakout imminent. Surveiller les niveaux clés.`;
  }
  strategies.push(breakoutStrategy);
  
  // 4. Stratégie Grid Trading
  const gridStrategy: TradingStrategy = {
    name: 'Grid Trading',
    type: 'Grid',
    signal: 'buy',
    confidence: 0.75,
    explanation: `Placer des ordres d'achat entre $${indicators.support.toFixed(2)} et $${(currentPrice * 0.95).toFixed(2)}, et des ordres de vente entre $${(currentPrice * 1.05).toFixed(2)} et $${indicators.resistance.toFixed(2)}. Idéal pour un marché latéral.`
  };
  
  if (indicators.bollingerBands.bandwidth < 0.1) {
    gridStrategy.confidence = 0.9;
    gridStrategy.explanation += ' Bandes de Bollinger serrées - marché en consolidation, parfait pour le grid trading.';
  }
  strategies.push(gridStrategy);
  
  return strategies;
}

// ============================================================================
// SENTIMENT DE MARCHÉ
// ============================================================================

/**
 * Récupère le Fear & Greed Index
 */
export async function getFearGreedIndex(): Promise<{ value: number; label: string } | null> {
  try {
    const response = await fetch(
      'https://api.alternative.me/fng/',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const value = parseInt(data.data[0].value);
    const label = data.data[0].value_classification;
    
    return { value, label };
  } catch (error) {
    console.error('[CryptoExpert] getFearGreedIndex error:', error);
    return null;
  }
}

/**
 * Génère une analyse du sentiment de marché
 */
export async function getMarketSentiment(): Promise<MarketSentiment | null> {
  try {
    const [fearGreed, globalData] = await Promise.all([
      getFearGreedIndex(),
      getGlobalMarketData()
    ]);
    
    if (!globalData) return null;
    
    let fearGreedLabel: MarketSentiment['fearGreedLabel'] = 'Neutral';
    const fgValue = fearGreed?.value || 50;
    
    if (fgValue <= 20) fearGreedLabel = 'Extreme Fear';
    else if (fgValue <= 40) fearGreedLabel = 'Fear';
    else if (fgValue <= 60) fearGreedLabel = 'Neutral';
    else if (fgValue <= 80) fearGreedLabel = 'Greed';
    else fearGreedLabel = 'Extreme Greed';
    
    return {
      fearGreedIndex: fgValue,
      fearGreedLabel,
      btcDominance: globalData.market_cap_percentage?.btc || 0,
      totalMarketCap: globalData.total_market_cap?.usd || 0,
      totalVolume24h: globalData.total_volume?.usd || 0,
      marketCapChange24h: globalData.market_cap_change_percentage_24h_usd || 0
    };
  } catch (error) {
    console.error('[CryptoExpert] getMarketSentiment error:', error);
    return null;
  }
}

// ============================================================================
// ANALYSE COMPLÈTE
// ============================================================================

/**
 * Génère une analyse complète d'une crypto
 */
export async function generateFullAnalysis(cryptoId: string): Promise<CryptoAnalysis | null> {
  console.log(`[CryptoExpert] Generating full analysis for ${cryptoId}`);
  
  const [crypto, indicators] = await Promise.all([
    getCryptoPrice(cryptoId),
    generateTechnicalAnalysis(cryptoId)
  ]);
  
  if (!crypto || !indicators) {
    console.error('[CryptoExpert] Failed to get crypto data or indicators');
    return null;
  }
  
  const strategies = generateTradingStrategies(crypto, indicators);
  
  // Déterminer la recommandation globale
  let buySignals = 0;
  let sellSignals = 0;
  
  if (indicators.rsiSignal === 'oversold') buySignals += 2;
  if (indicators.rsiSignal === 'overbought') sellSignals += 2;
  if (indicators.macd.signal === 'bullish') buySignals += 1;
  if (indicators.macd.signal === 'bearish') sellSignals += 1;
  if (indicators.movingAverages.trend === 'bullish') buySignals += 1;
  if (indicators.movingAverages.trend === 'bearish') sellSignals += 1;
  if (crypto.price_change_percentage_24h > 5) buySignals += 1;
  if (crypto.price_change_percentage_24h < -5) sellSignals += 1;
  
  let recommendation: CryptoAnalysis['recommendation'] = 'hold';
  if (buySignals >= 4) recommendation = 'strong_buy';
  else if (buySignals >= 2 && buySignals > sellSignals) recommendation = 'buy';
  else if (sellSignals >= 4) recommendation = 'strong_sell';
  else if (sellSignals >= 2 && sellSignals > buySignals) recommendation = 'sell';
  
  // Déterminer le niveau de risque
  let riskLevel: CryptoAnalysis['riskLevel'] = 'medium';
  if (crypto.market_cap_rank <= 10) riskLevel = 'low';
  else if (crypto.market_cap_rank <= 50) riskLevel = 'medium';
  else if (crypto.market_cap_rank <= 200) riskLevel = 'high';
  else riskLevel = 'extreme';
  
  // Générer le résumé
  const summary = generateAnalysisSummary(crypto, indicators, recommendation, riskLevel);
  
  return {
    crypto,
    technicalIndicators: indicators,
    strategies,
    summary,
    recommendation,
    riskLevel
  };
}

/**
 * Génère un résumé textuel de l'analyse
 */
function generateAnalysisSummary(
  crypto: CryptoPrice,
  indicators: TechnicalIndicators,
  recommendation: CryptoAnalysis['recommendation'],
  riskLevel: CryptoAnalysis['riskLevel']
): string {
  const recText = {
    'strong_buy': 'ACHAT FORT',
    'buy': 'ACHAT',
    'hold': 'CONSERVER',
    'sell': 'VENTE',
    'strong_sell': 'VENTE FORTE'
  }[recommendation];
  
  const riskText = {
    'low': 'faible',
    'medium': 'modéré',
    'high': 'élevé',
    'extreme': 'extrême'
  }[riskLevel];
  
  let summary = `## Analyse ${crypto.name} (${crypto.symbol.toUpperCase()})\n\n`;
  summary += `**Prix actuel:** $${crypto.current_price.toLocaleString()}\n`;
  summary += `**Variation 24h:** ${crypto.price_change_percentage_24h.toFixed(2)}%\n`;
  summary += `**Market Cap Rank:** #${crypto.market_cap_rank}\n\n`;
  
  summary += `### Recommandation: ${recText}\n`;
  summary += `**Niveau de risque:** ${riskText}\n\n`;
  
  summary += `### Indicateurs Techniques\n`;
  summary += `- **RSI (14):** ${indicators.rsi.toFixed(1)} (${indicators.rsiSignal})\n`;
  summary += `- **MACD:** ${indicators.macd.signal}\n`;
  summary += `- **Tendance MA:** ${indicators.movingAverages.trend}\n`;
  summary += `- **Support:** $${indicators.support.toFixed(2)}\n`;
  summary += `- **Résistance:** $${indicators.resistance.toFixed(2)}\n\n`;
  
  summary += `### Niveaux Fibonacci\n`;
  summary += `- 23.6%: $${indicators.fibonacciLevels.level236.toFixed(2)}\n`;
  summary += `- 38.2%: $${indicators.fibonacciLevels.level382.toFixed(2)}\n`;
  summary += `- 50.0%: $${indicators.fibonacciLevels.level50.toFixed(2)}\n`;
  summary += `- 61.8%: $${indicators.fibonacciLevels.level618.toFixed(2)}\n`;
  
  return summary;
}

// ============================================================================
// FORMATAGE POUR PHOENIX
// ============================================================================

/**
 * Formate l'analyse pour l'affichage dans Phoenix
 */
export function formatAnalysisForPhoenix(analysis: CryptoAnalysis): string {
  let output = analysis.summary + '\n';
  
  output += `\n### Stratégies de Trading\n`;
  for (const strategy of analysis.strategies) {
    output += `\n**${strategy.name}**\n`;
    output += `- Signal: ${strategy.signal.toUpperCase()}\n`;
    output += `- Confiance: ${(strategy.confidence * 100).toFixed(0)}%\n`;
    if (strategy.entryPrice) output += `- Prix d'entrée: $${strategy.entryPrice.toFixed(2)}\n`;
    if (strategy.targetPrice) output += `- Objectif: $${strategy.targetPrice.toFixed(2)}\n`;
    if (strategy.stopLoss) output += `- Stop Loss: $${strategy.stopLoss.toFixed(2)}\n`;
    if (strategy.riskRewardRatio) output += `- Risk/Reward: ${strategy.riskRewardRatio.toFixed(2)}\n`;
    output += `- ${strategy.explanation}\n`;
  }
  
  return output;
}

/**
 * Formate le sentiment de marché pour l'affichage
 */
export function formatSentimentForPhoenix(sentiment: MarketSentiment): string {
  let output = `## 📊 Sentiment du Marché Crypto\n\n`;
  
  const emoji = sentiment.fearGreedIndex <= 25 ? '😱' :
                sentiment.fearGreedIndex <= 45 ? '😰' :
                sentiment.fearGreedIndex <= 55 ? '😐' :
                sentiment.fearGreedIndex <= 75 ? '😊' : '🤑';
  
  output += `### Fear & Greed Index: ${sentiment.fearGreedIndex}/100 ${emoji}\n`;
  output += `**État:** ${sentiment.fearGreedLabel}\n\n`;
  
  output += `### Données Globales\n`;
  output += `- **Dominance BTC:** ${sentiment.btcDominance.toFixed(1)}%\n`;
  output += `- **Market Cap Total:** $${(sentiment.totalMarketCap / 1e12).toFixed(2)}T\n`;
  output += `- **Volume 24h:** $${(sentiment.totalVolume24h / 1e9).toFixed(1)}B\n`;
  output += `- **Variation 24h:** ${sentiment.marketCapChange24h.toFixed(2)}%\n`;
  
  return output;
}

// ============================================================================
// CALCULATEURS
// ============================================================================

/**
 * Calculateur DCA
 */
export function calculateDCA(
  investmentAmount: number,
  frequency: 'daily' | 'weekly' | 'monthly',
  duration: number, // en mois
  historicalPrices: number[]
): {
  totalInvested: number;
  totalCoins: number;
  averagePrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
} {
  const intervals = {
    'daily': duration * 30,
    'weekly': duration * 4,
    'monthly': duration
  };
  
  const numPurchases = intervals[frequency];
  const perPurchase = investmentAmount / numPurchases;
  
  let totalCoins = 0;
  const step = Math.floor(historicalPrices.length / numPurchases);
  
  for (let i = 0; i < numPurchases && i * step < historicalPrices.length; i++) {
    const price = historicalPrices[i * step];
    totalCoins += perPurchase / price;
  }
  
  const currentPrice = historicalPrices[historicalPrices.length - 1];
  const currentValue = totalCoins * currentPrice;
  const averagePrice = investmentAmount / totalCoins;
  
  return {
    totalInvested: investmentAmount,
    totalCoins,
    averagePrice,
    currentValue,
    profitLoss: currentValue - investmentAmount,
    profitLossPercent: ((currentValue - investmentAmount) / investmentAmount) * 100
  };
}

/**
 * Calculateur de position sizing
 */
export function calculatePositionSize(
  accountBalance: number,
  riskPercentage: number,
  entryPrice: number,
  stopLossPrice: number
): {
  positionSize: number;
  riskAmount: number;
  numberOfCoins: number;
  stopLossPercent: number;
} {
  const riskAmount = accountBalance * (riskPercentage / 100);
  const stopLossPercent = Math.abs((stopLossPrice - entryPrice) / entryPrice) * 100;
  const positionSize = riskAmount / (stopLossPercent / 100);
  const numberOfCoins = positionSize / entryPrice;
  
  return {
    positionSize,
    riskAmount,
    numberOfCoins,
    stopLossPercent
  };
}
