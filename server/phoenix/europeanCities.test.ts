import { describe, it, expect } from 'vitest';
import { findCity, searchCities, EUROPEAN_CITIES } from './europeanCities';

describe('European Cities Database', () => {
  it('should have at least 500 cities', () => {
    expect(EUROPEAN_CITIES.length).toBeGreaterThanOrEqual(500);
  });

  it('should find Luxembourg City by exact name', () => {
    const city = findCity('Luxembourg City');
    expect(city).toBeDefined();
    expect(city?.name).toBe('Luxembourg City');
    expect(city?.country).toBe('Luxembourg');
    expect(city?.latitude).toBe(49.6116);
    expect(city?.longitude).toBe(6.1319);
  });

  it('should find Paris by exact name', () => {
    const city = findCity('Paris');
    expect(city).toBeDefined();
    expect(city?.name).toBe('Paris');
    expect(city?.country).toBe('France');
  });

  it('should find Berlin by exact name', () => {
    const city = findCity('Berlin');
    expect(city).toBeDefined();
    expect(city?.name).toBe('Berlin');
    expect(city?.country).toBe('Germany');
  });

  it('should find Amsterdam by exact name', () => {
    const city = findCity('Amsterdam');
    expect(city).toBeDefined();
    expect(city?.name).toBe('Amsterdam');
    expect(city?.country).toBe('Netherlands');
  });

  it('should be case-insensitive', () => {
    const city1 = findCity('paris');
    const city2 = findCity('PARIS');
    const city3 = findCity('Paris');
    expect(city1?.name).toBe(city2?.name);
    expect(city2?.name).toBe(city3?.name);
  });

  it('should search for cities matching a pattern', () => {
    const results = searchCities('paris');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.name === 'Paris')).toBe(true);
  });

  it('should search for cities by country', () => {
    const results = searchCities('france');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.country === 'France')).toBe(true);
  });

  it('should have GPS coordinates for all cities', () => {
    for (const city of EUROPEAN_CITIES) {
      expect(city.latitude).toBeDefined();
      expect(city.longitude).toBeDefined();
      expect(typeof city.latitude).toBe('number');
      expect(typeof city.longitude).toBe('number');
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('should have country codes for all cities', () => {
    for (const city of EUROPEAN_CITIES) {
      expect(city.countryCode).toBeDefined();
      expect(city.countryCode.length).toBe(2);
    }
  });

  it('should find multiple European capitals', () => {
    const capitals = ['Paris', 'Berlin', 'Rome', 'Madrid', 'Brussels', 'Amsterdam', 'Vienna', 'Prague', 'Budapest', 'Warsaw'];
    for (const capital of capitals) {
      const city = findCity(capital);
      expect(city).toBeDefined();
      expect(city?.name).toBe(capital);
    }
  });

  it('should return undefined for non-existent city', () => {
    const city = findCity('NonExistentCity12345');
    expect(city).toBeUndefined();
  });

  it('should search for cities in a specific region', () => {
    const results = searchCities('provence');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should have all European countries represented', () => {
    const countries = new Set(EUROPEAN_CITIES.map(c => c.country));
    expect(countries.size).toBeGreaterThan(30);
    expect(countries.has('France')).toBe(true);
    expect(countries.has('Germany')).toBe(true);
    expect(countries.has('Italy')).toBe(true);
    expect(countries.has('Spain')).toBe(true);
    expect(countries.has('Luxembourg')).toBe(true);
  });

  it('should have Luxembourg with correct coordinates', () => {
    const luxembourg = findCity('Luxembourg City');
    expect(luxembourg).toBeDefined();
    expect(luxembourg?.latitude).toBeCloseTo(49.6116, 3);
    expect(luxembourg?.longitude).toBeCloseTo(6.1319, 3);
  });

  it('should find cities by partial name match in search', () => {
    const results = searchCities('burg');
    expect(results.length).toBeGreaterThan(0);
  });
});
