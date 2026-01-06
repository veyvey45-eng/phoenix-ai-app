/**
 * Tests pour le module Crypto Expert
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateRSI,
  calculateMACD,
  calculateEMA,
  calculateSMA,
  calculateBollingerBands,
  calculateFibonacciLevels,
  detectSupportResistance,
  calculateDCA,
  calculatePositionSize
} from './cryptoExpert';

describe('Crypto Expert - Indicateurs Techniques', () => {
  describe('calculateSMA', () => {
    it('devrait calculer correctement la moyenne mobile simple', () => {
      const prices = [10, 20, 30, 40, 50];
      const sma = calculateSMA(prices, 5);
      expect(sma).toBe(30); // (10+20+30+40+50)/5 = 30
    });

    it('devrait gérer les périodes plus longues que les données', () => {
      const prices = [10, 20, 30];
      const sma = calculateSMA(prices, 10);
      expect(sma).toBe(30); // Retourne le dernier prix
    });
  });

  describe('calculateEMA', () => {
    it('devrait calculer correctement l\'EMA', () => {
      const prices = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const ema = calculateEMA(prices, 5);
      expect(ema).toBeGreaterThan(0);
      expect(ema).toBeLessThanOrEqual(100);
    });

    it('devrait retourner le dernier prix si pas assez de données', () => {
      const prices = [50];
      const ema = calculateEMA(prices, 10);
      expect(ema).toBe(50);
    });
  });

  describe('calculateRSI', () => {
    it('devrait calculer un RSI entre 0 et 100', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
      const rsi = calculateRSI(prices);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('devrait retourner 50 si pas assez de données', () => {
      const prices = [100, 101, 102];
      const rsi = calculateRSI(prices, 14);
      expect(rsi).toBe(50);
    });

    it('devrait détecter une tendance haussière (RSI élevé)', () => {
      // Prix en hausse constante
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 5);
      const rsi = calculateRSI(prices);
      expect(rsi).toBeGreaterThan(50);
    });

    it('devrait détecter une tendance baissière (RSI bas)', () => {
      // Prix en baisse constante
      const prices = Array.from({ length: 20 }, (_, i) => 200 - i * 5);
      const rsi = calculateRSI(prices);
      expect(rsi).toBeLessThan(50);
    });
  });

  describe('calculateMACD', () => {
    it('devrait calculer le MACD avec les trois composantes', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 20);
      const macd = calculateMACD(prices);
      
      expect(macd).toHaveProperty('macdLine');
      expect(macd).toHaveProperty('signalLine');
      expect(macd).toHaveProperty('histogram');
      expect(typeof macd.macdLine).toBe('number');
      expect(typeof macd.signalLine).toBe('number');
      expect(typeof macd.histogram).toBe('number');
    });
  });

  describe('calculateBollingerBands', () => {
    it('devrait calculer les bandes de Bollinger correctement', () => {
      const prices = Array.from({ length: 25 }, (_, i) => 100 + Math.random() * 10);
      const bb = calculateBollingerBands(prices, 20, 2);
      
      expect(bb).toHaveProperty('upper');
      expect(bb).toHaveProperty('middle');
      expect(bb).toHaveProperty('lower');
      expect(bb).toHaveProperty('percentB');
      expect(bb).toHaveProperty('bandwidth');
      
      // La bande supérieure doit être au-dessus de la moyenne
      expect(bb.upper).toBeGreaterThan(bb.middle);
      // La bande inférieure doit être en-dessous de la moyenne
      expect(bb.lower).toBeLessThan(bb.middle);
    });

    it('devrait avoir un percentB valide pour des prix variables', () => {
      // Utiliser des prix légèrement variables pour éviter la division par zéro
      const prices = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
      const bb = calculateBollingerBands(prices, 20, 2);
      
      // percentB devrait être un nombre valide
      expect(typeof bb.percentB).toBe('number');
      expect(isNaN(bb.percentB)).toBe(false);
    });
  });

  describe('calculateFibonacciLevels', () => {
    it('devrait calculer les niveaux de Fibonacci correctement', () => {
      const high = 100;
      const low = 50;
      const fib = calculateFibonacciLevels(high, low);
      
      expect(fib.level0).toBe(100);
      expect(fib.level100).toBe(50);
      expect(fib.level50).toBe(75); // 100 - (50 * 0.5) = 75
      expect(fib.level236).toBeCloseTo(88.2, 1); // 100 - (50 * 0.236)
      expect(fib.level382).toBeCloseTo(80.9, 1); // 100 - (50 * 0.382)
      expect(fib.level618).toBeCloseTo(69.1, 1); // 100 - (50 * 0.618)
      expect(fib.level786).toBeCloseTo(60.7, 1); // 100 - (50 * 0.786)
    });
  });

  describe('detectSupportResistance', () => {
    it('devrait détecter support et résistance', () => {
      const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 20);
      const { support, resistance } = detectSupportResistance(prices);
      
      expect(support).toBeLessThan(resistance);
      expect(support).toBeGreaterThan(0);
    });

    it('devrait gérer un petit ensemble de données', () => {
      const prices = [100, 105, 95, 110, 90];
      const { support, resistance } = detectSupportResistance(prices);
      
      expect(support).toBe(90);
      expect(resistance).toBe(110);
    });
  });
});

describe('Crypto Expert - Calculateurs', () => {
  describe('calculateDCA', () => {
    it('devrait calculer correctement une stratégie DCA', () => {
      // Prix simulés sur 12 mois
      const prices = Array.from({ length: 365 }, (_, i) => 50000 + Math.sin(i / 30) * 10000);
      
      const result = calculateDCA(1200, 'monthly', 12, prices);
      
      expect(result.totalInvested).toBe(1200);
      expect(result.totalCoins).toBeGreaterThan(0);
      expect(result.averagePrice).toBeGreaterThan(0);
      expect(result.currentValue).toBeGreaterThan(0);
      expect(typeof result.profitLoss).toBe('number');
      expect(typeof result.profitLossPercent).toBe('number');
    });

    it('devrait gérer différentes fréquences', () => {
      const prices = Array.from({ length: 365 }, () => 50000);
      
      const daily = calculateDCA(365, 'daily', 12, prices);
      const weekly = calculateDCA(52, 'weekly', 12, prices);
      const monthly = calculateDCA(12, 'monthly', 12, prices);
      
      // Tous devraient avoir des résultats valides
      expect(daily.totalCoins).toBeGreaterThan(0);
      expect(weekly.totalCoins).toBeGreaterThan(0);
      expect(monthly.totalCoins).toBeGreaterThan(0);
    });
  });

  describe('calculatePositionSize', () => {
    it('devrait calculer la taille de position correctement', () => {
      const result = calculatePositionSize(10000, 2, 50000, 47500);
      
      expect(result.riskAmount).toBe(200); // 10000 * 2%
      expect(result.stopLossPercent).toBe(5); // (50000-47500)/50000 * 100
      expect(result.positionSize).toBe(4000); // 200 / 5%
      expect(result.numberOfCoins).toBeCloseTo(0.08, 4); // 4000 / 50000
    });

    it('devrait gérer différents niveaux de risque', () => {
      const lowRisk = calculatePositionSize(10000, 1, 50000, 47500);
      const highRisk = calculatePositionSize(10000, 5, 50000, 47500);
      
      expect(lowRisk.positionSize).toBeLessThan(highRisk.positionSize);
      expect(lowRisk.riskAmount).toBeLessThan(highRisk.riskAmount);
    });

    it('devrait calculer correctement avec un stop loss serré', () => {
      const result = calculatePositionSize(10000, 2, 50000, 49000);
      
      expect(result.stopLossPercent).toBe(2); // (50000-49000)/50000 * 100
      expect(result.positionSize).toBe(10000); // 200 / 2%
    });
  });
});
