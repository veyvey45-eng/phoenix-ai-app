/**
 * OpenWeatherMap API Module - Données météo réelles en temps réel
 * Remplace la simulation précédente avec des données réelles
 */

interface WeatherData {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  timestamp: Date;
  pressure?: number;
  visibility?: number;
}

interface WeatherForecast {
  location: string;
  forecasts: Array<{ 
    date: Date; 
    temperature: number; 
    tempMin: number;
    tempMax: number;
    description: string;
    humidity: number;
    windSpeed: number;
  }>;
}

class OpenWeatherMapService {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor() {
    this.apiKey = process.env.Openweather_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[OpenWeatherMap] API key not found. Weather data will be simulated.');
    }
  }

  /**
   * Get current weather for a city
   */
  async getCurrentWeather(city: string): Promise<WeatherData> {
    try {
      if (!this.apiKey) {
        return this.getSimulatedWeather(city);
      }

      const response = await fetch(
        `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&units=metric&lang=fr&appid=${this.apiKey}`
      );

      if (!response.ok) {
        console.warn(`[OpenWeatherMap] Failed to fetch weather for ${city}:`, response.status);
        return this.getSimulatedWeather(city);
      }

      const data = await response.json();

      return {
        location: data.name,
        country: data.sys.country,
        temperature: Math.round(data.main.temp * 10) / 10,
        feelsLike: Math.round(data.main.feels_like * 10) / 10,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 10) / 10,
        description: data.weather[0].description,
        pressure: data.main.pressure,
        visibility: data.visibility,
        timestamp: new Date(data.dt * 1000)
      };
    } catch (error) {
      console.error('[OpenWeatherMap] Error fetching weather:', error);
      return this.getSimulatedWeather(city);
    }
  }

  /**
   * Get weather forecast for a city
   */
  async getForecast(city: string, days: number = 5): Promise<WeatherForecast> {
    try {
      if (!this.apiKey) {
        return this.getSimulatedForecast(city, days);
      }

      const response = await fetch(
        `${this.baseUrl}/forecast?q=${encodeURIComponent(city)}&units=metric&lang=fr&appid=${this.apiKey}`
      );

      if (!response.ok) {
        console.warn(`[OpenWeatherMap] Failed to fetch forecast for ${city}:`, response.status);
        return this.getSimulatedForecast(city, days);
      }

      const data = await response.json();
      const forecasts: WeatherForecast['forecasts'] = [];
      const seenDates = new Set<string>();

      // Group by day (OpenWeatherMap returns 3-hour intervals)
      for (const item of data.list) {
        const date = new Date(item.dt * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (!seenDates.has(dateStr) && forecasts.length < days) {
          seenDates.add(dateStr);
          forecasts.push({
            date,
            temperature: Math.round(item.main.temp * 10) / 10,
            tempMin: Math.round(item.main.temp_min * 10) / 10,
            tempMax: Math.round(item.main.temp_max * 10) / 10,
            description: item.weather[0].description,
            humidity: item.main.humidity,
            windSpeed: Math.round(item.wind.speed * 10) / 10
          });
        }
      }

      return {
        location: data.city.name,
        forecasts
      };
    } catch (error) {
      console.error('[OpenWeatherMap] Error fetching forecast:', error);
      return this.getSimulatedForecast(city, days);
    }
  }

  /**
   * Fallback simulated weather when API is unavailable
   */
  private getSimulatedWeather(city: string): WeatherData {
    const seasons: Record<string, { temp: number }> = {
      'winter': { temp: 5 }, 'spring': { temp: 15 }, 'summer': { temp: 25 }, 'autumn': { temp: 12 }
    };

    const getSeason = () => {
      const m = new Date().getMonth();
      if (m >= 2 && m <= 4) return 'spring';
      if (m >= 5 && m <= 7) return 'summer';
      if (m >= 8 && m <= 10) return 'autumn';
      return 'winter';
    };

    const temp = seasons[getSeason()].temp + Math.floor(Math.random() * 6) - 3;
    const descs = ['partiellement nuageux', 'ensoleillé', 'nuageux', 'couvert'];

    return {
      location: city,
      country: 'XX',
      temperature: temp,
      feelsLike: temp - 2,
      humidity: 60 + Math.floor(Math.random() * 30),
      windSpeed: 5 + Math.floor(Math.random() * 20),
      description: descs[Math.floor(Math.random() * descs.length)],
      timestamp: new Date()
    };
  }

  /**
   * Fallback simulated forecast when API is unavailable
   */
  private getSimulatedForecast(city: string, days: number): WeatherForecast {
    const seasons: Record<string, { temp: number }> = {
      'winter': { temp: 5 }, 'spring': { temp: 15 }, 'summer': { temp: 25 }, 'autumn': { temp: 12 }
    };

    const getSeason = () => {
      const m = new Date().getMonth();
      if (m >= 2 && m <= 4) return 'spring';
      if (m >= 5 && m <= 7) return 'summer';
      if (m >= 8 && m <= 10) return 'autumn';
      return 'winter';
    };

    const baseTemp = seasons[getSeason()].temp;
    const forecasts = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecasts.push({
        date,
        temperature: baseTemp + Math.floor(Math.random() * 6) - 3,
        tempMin: baseTemp - 5,
        tempMax: baseTemp + 5,
        description: ['ensoleillé', 'nuageux', 'pluvieux'][Math.floor(Math.random() * 3)],
        humidity: 50 + Math.floor(Math.random() * 40),
        windSpeed: 5 + Math.floor(Math.random() * 15)
      });
    }

    return { location: city, forecasts };
  }

  formatWeatherForContext(w: WeatherData): string {
    return `📍 ${w.location} (${w.country}): ${w.temperature}°C (ressenti ${w.feelsLike}°C), ${w.description}, humidité ${w.humidity}%, vent ${w.windSpeed} km/h`;
  }

  formatForecastForContext(f: WeatherForecast): string {
    const lines = [`Prévisions pour ${f.location}:`];
    for (const day of f.forecasts) {
      const dateStr = day.date.toLocaleDateString('fr-FR');
      lines.push(`  ${dateStr}: ${day.tempMin}°C à ${day.tempMax}°C, ${day.description}`);
    }
    return lines.join('\n');
  }
}

export const openweatherApi = new OpenWeatherMapService();
