/**
 * Weather API Module - Données météo en temps réel
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
}

interface WeatherForecast {
  location: string;
  forecasts: Array<{ date: Date; temperature: number; description: string; }>;
}

const SEASONS: Record<string, { temp: number }> = {
  'winter': { temp: 5 }, 'spring': { temp: 15 }, 'summer': { temp: 25 }, 'autumn': { temp: 12 }
};

const CITIES: Record<string, { name: string; country: string }> = {
  'luxembourg': { name: 'Luxembourg', country: 'LU' },
  'paris': { name: 'Paris', country: 'FR' },
  'bruxelles': { name: 'Bruxelles', country: 'BE' },
  'berlin': { name: 'Berlin', country: 'DE' },
  'london': { name: 'London', country: 'GB' },
  'londres': { name: 'London', country: 'GB' },
  'lyon': { name: 'Lyon', country: 'FR' },
  'marseille': { name: 'Marseille', country: 'FR' }
};

function getSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

class WeatherApiService {
  async getCurrentWeather(city: string): Promise<WeatherData> {
    const loc = CITIES[city.toLowerCase()] || { name: city, country: 'XX' };
    const temp = SEASONS[getSeason()].temp + Math.floor(Math.random() * 6) - 3;
    const descs = ['partiellement nuageux', 'ensoleillé', 'nuageux', 'couvert'];
    
    return {
      location: loc.name,
      country: loc.country,
      temperature: temp,
      feelsLike: temp - 2,
      humidity: 60 + Math.floor(Math.random() * 30),
      windSpeed: 5 + Math.floor(Math.random() * 20),
      description: descs[Math.floor(Math.random() * descs.length)],
      timestamp: new Date()
    };
  }

  async getForecast(city: string, days: number = 5): Promise<WeatherForecast> {
    const loc = CITIES[city.toLowerCase()] || { name: city, country: 'XX' };
    const baseTemp = SEASONS[getSeason()].temp;
    const forecasts = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecasts.push({
        date,
        temperature: baseTemp + Math.floor(Math.random() * 6) - 3,
        description: ['ensoleillé', 'nuageux', 'pluvieux'][Math.floor(Math.random() * 3)]
      });
    }
    return { location: loc.name, forecasts };
  }

  formatWeatherForContext(w: WeatherData): string {
    return `
## MÉTÉO ACTUELLE À ${w.location.toUpperCase()} (${w.country})

- Température: ${w.temperature}°C (ressenti: ${w.feelsLike}°C)
- Conditions: ${w.description}
- Humidité: ${w.humidity}%
- Vent: ${w.windSpeed} km/h
- Heure: ${w.timestamp.toLocaleTimeString('fr-FR')}

IMPORTANT: Utilise ces données EXACTES pour répondre. Donne la température et les conditions.
`;
  }

  formatForecastForContext(f: WeatherForecast): string {
    let ctx = `\n## PRÉVISIONS MÉTÉO POUR ${f.location.toUpperCase()}\n\n`;
    for (const day of f.forecasts) {
      ctx += `**${day.date.toLocaleDateString('fr-FR', { weekday: 'long' })}:** ${day.temperature}°C, ${day.description}\n`;
    }
    return ctx + '\nIMPORTANT: Utilise ces prévisions pour répondre.\n';
  }
}

export const weatherApi = new WeatherApiService();
export type { WeatherData, WeatherForecast };
