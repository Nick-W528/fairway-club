import type { IconName } from '@/components/ui';

export interface Weather {
  tempC: number;
  windMph: number;
  code: number;
}

/** Current conditions from Open-Meteo (free, no API key). Only the club's coordinates are sent. */
export async function fetchWeather(lat: number, lon: number): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=mph';
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return {
      tempC: Math.round(json.current.temperature_2m),
      windMph: Math.round(json.current.wind_speed_10m),
      code: json.current.weather_code,
    };
  } catch {
    return null;
  }
}

/** WMO weather code → icon + short label. */
export function describeWeather(code: number): { icon: IconName; label: string } {
  if (code === 0) return { icon: 'sunny-outline', label: 'Clear' };
  if (code <= 2) return { icon: 'partly-sunny-outline', label: 'Partly cloudy' };
  if (code === 3) return { icon: 'cloud-outline', label: 'Overcast' };
  if (code <= 48) return { icon: 'cloud-outline', label: 'Fog' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: 'rainy-outline', label: 'Rain' };
  if (code <= 77 || code === 85 || code === 86) return { icon: 'snow-outline', label: 'Snow' };
  return { icon: 'thunderstorm-outline', label: 'Storms' };
}
