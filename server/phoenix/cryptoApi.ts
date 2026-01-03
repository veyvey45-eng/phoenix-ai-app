/**
 * CoinGecko API Module - Prix crypto en temps réel + historique
 * Gratuit, pas de clé API requise
 */

interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change24h: number;
  marketCap: number;
  volume24h: number;
  timestamp: Date;
  historicalData?: Array<{
    date: string;
    price: number;
    change: number;
  }>;
  period?: string;
}

interface CryptoPriceResponse {
  crypto: CryptoPrice;
  source: string;
  cached: boolean;
}

const CACHE: Map<string, { data: CryptoPrice; time: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback prices if API is unavailable
const FALLBACK_PRICES: Record<string, number> = {
  'ethereum': 3099.6,
  'bitcoin': 89916,
  'binancecoin': 612,
  'ripple': 2.45,
  'cardano': 0.98,
  'solana': 198,
  'polkadot': 7.85,
  'dogecoin': 0.38,
  'tether': 1.0,
  'usd-coin': 1.0,
  'litecoin': 95,
  'chainlink': 28,
  'uniswap': 8.5,
  'matic-network': 0.45,
  'avalanche-2': 35
};

class CryptoApiService {
  private baseUrl = 'https://api.coingecko.com/api/v3';

  private extractPeriod(query: string): 'day' | 'week' | 'month' | 'year' | null {
    if (/semaine|7.*jour|7j|7d|week/i.test(query)) return 'week';
    if (/mois|30.*jour|30j|30d|month/i.test(query)) return 'month';
    if (/an|année|365.*jour|1.*an|year|365d/i.test(query)) return 'year';
    if (/jour|24.*heure|24h|day/i.test(query)) return 'day';
    return null;
  }

  async getHistoricalPrice(symbol: string, currency: string = 'usd', period: 'day' | 'week' | 'month' | 'year' = 'day'): Promise<CryptoPriceResponse> {
    const cacheKey = `${symbol.toLowerCase()}-${currency}-${period}`;
    const cached = CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return { crypto: cached.data, source: `CoinGecko (cached - ${period})`, cached: true };
    }

    try {
      const coinId = this.mapSymbolToCoinId(symbol);
      const days = period === 'day' ? '1' : period === 'week' ? '7' : period === 'month' ? '30' : '365';
      const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=${currency}&days=${days}&interval=daily`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const prices = data.prices || [];
      const marketCaps = data.market_caps || [];
      const volumes = data.total_volumes || [];
      
      if (prices.length === 0) throw new Error(`Pas de données pour ${symbol}`);
      
      // Calculate change percentage
      const firstPrice = prices[0][1];
      const lastPrice = prices[prices.length - 1][1];
      const changePct = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      // Format historical data
      const historicalData = prices.map((p: [number, number], idx: number) => ({
        date: new Date(p[0]).toLocaleDateString('fr-FR'),
        price: Math.round(p[1] * 100) / 100,
        change: idx === 0 ? 0 : Math.round(((p[1] - prices[idx - 1][1]) / prices[idx - 1][1]) * 10000) / 100
      }));
      
      const crypto: CryptoPrice = {
        symbol: symbol.toUpperCase(),
        name: this.getCryptoName(symbol),
        price: Math.round(lastPrice * 100) / 100,
        currency: currency.toUpperCase(),
        change24h: Math.round(changePct * 100) / 100,
        marketCap: marketCaps[marketCaps.length - 1]?.[1] || 0,
        volume24h: volumes[volumes.length - 1]?.[1] || 0,
        timestamp: new Date(),
        historicalData,
        period
      };
      
      CACHE.set(cacheKey, { data: crypto, time: Date.now() });
      return { crypto, source: `CoinGecko (temps réel - ${period})`, cached: false };
    } catch (error) {
      console.error(`[CryptoAPI] Erreur historique ${period}:`, error);
      return {
        crypto: {
          symbol: symbol.toUpperCase(),
          name: this.getCryptoName(symbol),
          price: 0,
          currency: currency.toUpperCase(),
          change24h: 0,
          marketCap: 0,
          volume24h: 0,
          timestamp: new Date(),
          period
        },
        source: 'Erreur',
        cached: false
      };
    }
  }

  async getPrice(symbol: string, currency: string = 'usd', query?: string): Promise<CryptoPriceResponse> {
    // Check if user is asking for historical data
    if (query) {
      const period = this.extractPeriod(query);
      if (period && period !== 'day') {
        return this.getHistoricalPrice(symbol, currency, period);
      }
    }

    const cacheKey = `${symbol.toLowerCase()}-${currency}`;
    const cached = CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return { crypto: cached.data, source: 'CoinGecko (cached)', cached: true };
    }

    try {
      const coinId = this.mapSymbolToCoinId(symbol);
      const url = `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
      
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const priceData = data[coinId];
      
      if (!priceData) throw new Error(`Pas de données pour ${symbol}`);
      
      const crypto: CryptoPrice = {
        symbol: symbol.toUpperCase(),
        name: this.getCryptoName(symbol),
        price: Math.round(priceData[currency] * 100) / 100,
        currency: currency.toUpperCase(),
        change24h: Math.round(priceData[`${currency}_24h_change`] * 100) / 100,
        marketCap: priceData[`${currency}_market_cap`] || 0,
        volume24h: priceData[`${currency}_24h_vol`] || 0,
        timestamp: new Date()
      };
      
      CACHE.set(cacheKey, { data: crypto, time: Date.now() });
      return { crypto, source: 'CoinGecko (temps réel)', cached: false };
    } catch (error) {
      console.error('[CryptoAPI] Erreur CoinGecko:', error);
      
      // Use fallback price if API fails
      const coinId = this.mapSymbolToCoinId(symbol);
      const fallbackPrice = FALLBACK_PRICES[coinId];
      
      if (fallbackPrice) {
        const crypto: CryptoPrice = {
          symbol: symbol.toUpperCase(),
          name: this.getCryptoName(symbol),
          price: fallbackPrice,
          currency: currency.toUpperCase(),
          change24h: 0,
          marketCap: 0,
          volume24h: 0,
          timestamp: new Date()
        };
        
        CACHE.set(cacheKey, { data: crypto, time: Date.now() });
        return { crypto, source: 'Fallback (API indisponible)', cached: false };
      }
      
      throw error;
    }
  }

  async getPrices(symbols: string[], currency: string = 'usd', query?: string): Promise<CryptoPriceResponse[]> {
    return Promise.all(symbols.map(s => this.getPrice(s, currency, query)));
  }

  private mapSymbolToCoinId(symbol: string): string {
    const map: Record<string, string> = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'bnb': 'binancecoin',
      'xrp': 'ripple',
      'ada': 'cardano',
      'sol': 'solana',
      'dot': 'polkadot',
      'doge': 'dogecoin',
      'usdt': 'tether',
      'usdc': 'usd-coin',
      'ltc': 'litecoin',
      'link': 'chainlink',
      'uni': 'uniswap',
      'matic': 'matic-network',
      'avax': 'avalanche-2'
    };
    return map[symbol.toLowerCase()] || symbol.toLowerCase();
  }

  private getCryptoName(symbol: string): string {
    const names: Record<string, string> = {
      'btc': 'Bitcoin',
      'eth': 'Ethereum',
      'bnb': 'Binance Coin',
      'xrp': 'Ripple',
      'ada': 'Cardano',
      'sol': 'Solana',
      'dot': 'Polkadot',
      'doge': 'Dogecoin',
      'usdt': 'Tether',
      'usdc': 'USD Coin',
      'ltc': 'Litecoin',
      'link': 'Chainlink',
      'uni': 'Uniswap',
      'matic': 'Polygon',
      'avax': 'Avalanche'
    };
    return names[symbol.toLowerCase()] || symbol;
  }

  formatForContext(response: CryptoPriceResponse): string {
    const { crypto } = response;
    const changeEmoji = crypto.change24h >= 0 ? '📈' : '📉';
    
    let context = `
## PRIX CRYPTO EN TEMPS RÉEL

**${crypto.name} (${crypto.symbol})**
- Prix: ${crypto.price} ${crypto.currency}
- Variation: ${changeEmoji} ${crypto.change24h}%
- Market Cap: $${(crypto.marketCap / 1e9).toFixed(2)}B
- Volume 24h: $${(crypto.volume24h / 1e9).toFixed(2)}B
- Source: ${response.source}
- Heure: ${crypto.timestamp.toLocaleTimeString('fr-FR')}`;

    if (crypto.historicalData && crypto.historicalData.length > 0) {
      context += `

## DONNÉES HISTORIQUES (${crypto.period})

Évolution du prix sur la période:`;
      const data = crypto.historicalData;
      // Show first, middle, and last data points to keep context concise
      const indices = [0, Math.floor(data.length / 2), data.length - 1];
      const shown = new Set<number>();
      indices.forEach(idx => {
        if (idx < data.length && !shown.has(idx)) {
          shown.add(idx);
          const d = data[idx];
          context += `\n- ${d.date}: ${d.price} ${crypto.currency} (${d.change > 0 ? '+' : ''}${d.change}%)`;
        }
      });
    }
    
    context += `

IMPORTANT: Utilise ces données EXACTES pour répondre à la question.`;
    return context;
  }
}

export const cryptoApi = new CryptoApiService();
export type { CryptoPrice, CryptoPriceResponse };
