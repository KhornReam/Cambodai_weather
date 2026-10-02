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

export function isRainingNow(current) {
  if (!current || typeof current !== 'object') return null;

  const rain = current.rain == null ? Number.NaN : Number(current.rain);
  if (Number.isFinite(rain) && rain > 0) return true;

  const weatherCode = current.weather_code == null ? Number.NaN : Number(current.weather_code);
  if (!Number.isFinite(weatherCode)) {
    return Number.isFinite(rain) ? false : null;
  }

  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode);
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
    return '--°C';
  }

  return `${Math.round(value)}°C`;
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

function getCambodiaDateTime(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Phnom_Penh'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour)
  };
}

export function buildNightRainMessage(hourly, sunrise, sunset) {
  if (!hourly || !sunrise || !sunset) {
    return {
      status: 'Weather data unavailable',
      detail: 'The nighttime forecast is not available for this location right now.'
    };
  }

  const today = getCambodiaDateTime(new Date());
  const tomorrow = new Date(`${today.date}T12:00:00+07:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = getCambodiaDateTime(tomorrow).date;
  const sunriseHour = getCambodiaDateTime(new Date(sunrise)).hour;
  const sunsetHour = getCambodiaDateTime(new Date(sunset)).hour;
  const beforeSunrise = today.hour < sunriseHour;

  const nightHours = hourly.time
    .map((time, index) => ({
      time,
      ...getCambodiaDateTime(new Date(time)),
      probability: hourly.precipitation_probability?.[index] ?? null,
      rain: hourly.rain?.[index] ?? hourly.precipitation?.[index] ?? 0,
      temperature: hourly.temperature_2m?.[index] ?? null,
      code: hourly.weather_code?.[index] ?? null
    }))
    .filter((entry) => {
      if (beforeSunrise) {
        return entry.date === today.date && entry.hour >= today.hour && entry.hour < sunriseHour;
      }

      return (entry.date === today.date && entry.hour >= sunsetHour) ||
        (entry.date === tomorrowDate && entry.hour < sunriseHour);
    });

  if (!nightHours.length) {
    return {
      status: 'Weather data unavailable',
      detail: 'No nighttime window was detected in the API output.'
    };
  }

  const probabilities = nightHours
    .map((entry) => entry.probability)
    .filter((probability) => Number.isFinite(probability));
  const maxProbability = probabilities.length ? Math.max(...probabilities) : null;
  const totalRain = nightHours.reduce((accumulator, entry) => accumulator + (entry.rain || 0), 0);
  const averageTemp = nightHours.reduce((accumulator, entry) => accumulator + (entry.temperature ?? 0), 0) / nightHours.length;

  if ((maxProbability ?? 0) >= 70 || totalRain > 1.5) {
    return {
      status: 'Rain expected tonight.',
      detail: maxProbability == null
        ? `About ${totalRain.toFixed(1)} mm of precipitation is forecast overnight.`
        : `Most likely conditions: ${maxProbability}% chance of rain and about ${totalRain.toFixed(1)} mm expected tonight.`
    };
  }

  if ((maxProbability ?? 0) >= 40 || totalRain > 0.5) {
    return {
      status: 'Possible showers tonight.',
      detail: maxProbability == null
        ? `Around ${totalRain.toFixed(1)} mm of precipitation is forecast overnight.`
        : `There is a moderate chance of light rain, with around ${totalRain.toFixed(1)} mm possible overnight.`
    };
  }

  return {
    status: 'No significant rain expected tonight.',
    detail: `The night should stay mostly dry, with a low chance of rain and an expected temperature near ${Math.round(averageTemp)}°C.`
  };
}
