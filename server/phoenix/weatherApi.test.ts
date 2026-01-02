/**
 * Tests pour le module Weather API
 */

import { describe, it, expect } from 'vitest';
import { weatherApi } from './weatherApi';

describe('WeatherApi', () => {
  describe('getCurrentWeather', () => {
    it('should return weather data for Luxembourg', async () => {
      const weather = await weatherApi.getCurrentWeather('Luxembourg');
      expect(weather.location).toBe('Luxembourg');
      expect(weather.country).toBe('LU');
      expect(typeof weather.temperature).toBe('number');
    });

    it('should return weather data for Paris', async () => {
      const weather = await weatherApi.getCurrentWeather('Paris');
      expect(weather.location).toBe('Paris');
      expect(weather.country).toBe('FR');
    });

    it('should handle unknown cities', async () => {
      const weather = await weatherApi.getCurrentWeather('UnknownCity');
      expect(weather).toHaveProperty('temperature');
      expect(weather.country).toBe('XX');
    });

    it('should return realistic temperature', async () => {
      const weather = await weatherApi.getCurrentWeather('Luxembourg');
      expect(weather.temperature).toBeGreaterThanOrEqual(-10);
      expect(weather.temperature).toBeLessThanOrEqual(40);
    });

    it('should return humidity between 0 and 100', async () => {
      const weather = await weatherApi.getCurrentWeather('Paris');
      expect(weather.humidity).toBeGreaterThanOrEqual(0);
      expect(weather.humidity).toBeLessThanOrEqual(100);
    });
  });

  describe('getForecast', () => {
    it('should return forecast for multiple days', async () => {
      const forecast = await weatherApi.getForecast('Luxembourg', 5);
      expect(forecast.location).toBe('Luxembourg');
      expect(forecast.forecasts.length).toBe(5);
    });

    it('should return valid forecast data', async () => {
      const forecast = await weatherApi.getForecast('Paris', 3);
      for (const day of forecast.forecasts) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('temperature');
        expect(day).toHaveProperty('description');
      }
    });
  });

  describe('formatWeatherForContext', () => {
    it('should format weather for Phoenix context', async () => {
      const weather = await weatherApi.getCurrentWeather('Luxembourg');
      const formatted = weatherApi.formatWeatherForContext(weather);
      expect(formatted).toContain('MÉTÉO');
      expect(formatted).toContain('°C');
      expect(formatted).toContain('Humidité');
    });
  });

  describe('formatForecastForContext', () => {
    it('should format forecast for Phoenix context', async () => {
      const forecast = await weatherApi.getForecast('Paris', 3);
      const formatted = weatherApi.formatForecastForContext(forecast);
      expect(formatted).toContain('PRÉVISIONS');
      expect(formatted).toContain('°C');
    });
  });
});
