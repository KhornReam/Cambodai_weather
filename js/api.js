const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export async function fetchWeatherData({ latitude, longitude, timezone = 'Asia/Phnom_Penh' }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,relative_humidity_2m,wind_speed_10m',
    daily:
      'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,weather_code',
    timezone,
    forecast_days: '7',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm'
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`The weather service is unavailable right now (status ${response.status}).`);
  }

  const data = await response.json();

  if (!data || !data.current || !data.hourly || !data.daily) {
    throw new Error('The weather API returned incomplete data for this location.');
  }

  return data;
}
