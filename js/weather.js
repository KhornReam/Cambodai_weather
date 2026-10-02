export const WEATHER_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm'
};

export function getWeatherDescription(code) {
  return WEATHER_CODE_MAP[code] ?? 'Weather conditions unavailable';
}

export function getWeatherTheme(code) {
  const weatherCode = Number(code);

  if ([95, 96, 99].includes(weatherCode)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'rain';
  if ([45, 48].includes(weatherCode)) return 'fog';
  if (weatherCode === 3) return 'cloudy';
  if ([1, 2].includes(weatherCode)) return 'partly-cloudy';

  return weatherCode === 0 ? 'clear' : 'cloudy';
}

export function isRainExpectedToday(dailyData) {
  const rawProbability = dailyData?.precipitation_probability_max?.[0];
  const rawAccumulation = dailyData?.precipitation_sum?.[0];
  const rawWeatherCode = dailyData?.weather_code?.[0];
  const probability = rawProbability == null ? Number.NaN : Number(rawProbability);
  const accumulation = rawAccumulation == null ? Number.NaN : Number(rawAccumulation);
  const weatherCode = rawWeatherCode == null ? Number.NaN : Number(rawWeatherCode);
  const hasForecastValue = Number.isFinite(probability) || Number.isFinite(accumulation) || Number.isFinite(weatherCode);

  if (!hasForecastValue) return null;

  const rainyWeatherCode = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode);
  return rainyWeatherCode || probability >= 40 || accumulation >= 0.1;
}

export function getWeatherIconClass(code) {
  const weatherCode = Number(code);

  if (weatherCode === 0) return 'fa-sun';
  if (weatherCode === 1) return 'fa-cloud-sun';
  if (weatherCode === 2) return 'fa-cloud-sun';
  if (weatherCode === 3) return 'fa-cloud';
  if ([45, 48].includes(weatherCode)) return 'fa-smog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'fa-cloud-rain';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'fa-snowflake';
  if ([95, 96, 99].includes(weatherCode)) return 'fa-cloud-bolt';

  return 'fa-cloud';
}

export function formatTemperature(value) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--°';
  }

  return `${Math.round(value)}°`;
}

export function formatTimeFromISO(isoString) {
  if (!isoString) return '--';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function getDailyHighLow(dailyData) {
  const max = dailyData?.temperature_2m_max?.[0];
  const min = dailyData?.temperature_2m_min?.[0];

  return {
    max: max ?? null,
    min: min ?? null
  };
}

export function buildNightRainMessage(hourly, sunrise, sunset) {
  if (!hourly || !sunrise || !sunset) {
    return {
      status: 'Weather data unavailable',
      detail: 'The nighttime forecast is not available for this location right now.'
    };
  }

  const nightHours = hourly.time
    .map((time, index) => ({
      time,
      probability: hourly.precipitation_probability?.[index] ?? 0,
      rain: hourly.rain?.[index] ?? 0,
      temperature: hourly.temperature_2m?.[index] ?? null,
      code: hourly.weather_code?.[index] ?? null
    }))
    .filter((entry) => {
      const hourTime = new Date(entry.time).getHours();
      const sunsetHour = new Date(sunset).getHours();
      const sunriseHour = new Date(sunrise).getHours();

      return hourTime >= sunsetHour || hourTime < sunriseHour;
    });

  if (!nightHours.length) {
    return {
      status: 'Weather data unavailable',
      detail: 'No nighttime window was detected in the API output.'
    };
  }

  const maxProbability = Math.max(...nightHours.map((entry) => entry.probability), 0);
  const totalRain = nightHours.reduce((accumulator, entry) => accumulator + (entry.rain || 0), 0);
  const averageTemp = nightHours.reduce((accumulator, entry) => accumulator + (entry.temperature ?? 0), 0) / nightHours.length;

  if (maxProbability >= 70 || totalRain > 1.5) {
    return {
      status: 'Rain expected tonight.',
      detail: `Most likely conditions: ${maxProbability}% chance of rain and about ${totalRain.toFixed(1)} mm expected tonight.`
    };
  }

  if (maxProbability >= 40 || totalRain > 0.5) {
    return {
      status: 'Possible showers tonight.',
      detail: `There is a moderate chance of light rain, with around ${totalRain.toFixed(1)} mm possible overnight.`
    };
  }

  return {
    status: 'No significant rain expected tonight.',
    detail: `The night should stay mostly dry, with a low chance of rain and an expected temperature near ${Math.round(averageTemp)}°C.`
  };
}
