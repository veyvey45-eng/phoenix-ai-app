/**
 * Tests pour CoinGecko Crypto API
 */

import { describe, it, expect } from 'vitest';
import { cryptoApi } from './cryptoApi';

describe('CryptoApi', () => {
  describe('getPrice', () => {
    it('should get Bitcoin price', async () => {
      const response = await cryptoApi.getPrice('btc', 'usd');
      expect(response.crypto.symbol).toBe('BTC');
      expect(response.crypto.price).toBeGreaterThan(0);
      expect(response.crypto.currency).toBe('USD');
    });

    it('should get Ethereum price', async () => {
      const response = await cryptoApi.getPrice('eth', 'usd');
      expect(response.crypto.symbol).toBe('ETH');
      expect(response.crypto.price).toBeGreaterThan(0);
    });

    it('should cache prices', async () => {
      const response1 = await cryptoApi.getPrice('btc', 'usd');
      const response2 = await cryptoApi.getPrice('btc', 'usd');
      expect(response1.crypto.price).toBe(response2.crypto.price);
    });
  });

  describe('getPrices', () => {
    it('should get multiple prices', async () => {
      const responses = await cryptoApi.getPrices(['btc', 'eth'], 'usd');
      expect(responses.length).toBe(2);
      expect(responses[0].crypto.symbol).toBe('BTC');
      expect(responses[1].crypto.symbol).toBe('ETH');
    });
  });

  describe('formatForContext', () => {
    it('should format crypto data for Phoenix', async () => {
      const response = await cryptoApi.getPrice('btc', 'usd');
      const formatted = cryptoApi.formatForContext(response);
      expect(formatted).toContain('PRIX CRYPTO');
      expect(formatted).toContain('Bitcoin');
      expect(formatted).toContain('USD');
    });
  });
});
