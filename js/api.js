const MET_NORWAY_BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const CAMBODIA_UTC_OFFSET_HOURS = 7;

function normalizeLongitude(longitude) {
  return ((longitude % 360) + 360) % 360;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function getSolarTime(date, latitude, longitude, sunrise) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
  const longitudeHour = longitude / 15;
  const approximateTime = dayOfYear + ((sunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = 0.9856 * approximateTime - 3.289;
  const trueLongitude = normalizeLongitude(
    meanAnomaly +
      1.916 * Math.sin(toRadians(meanAnomaly)) +
      0.02 * Math.sin(2 * toRadians(meanAnomaly)) +
      282.634
  );

  let rightAscension = normalizeLongitude(
    toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude))))
  );
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;

  const sinDeclination = 0.39782 * Math.sin(toRadians(trueLongitude));
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHourAngle =
    (Math.cos(toRadians(90.833)) - sinDeclination * Math.sin(toRadians(latitude))) /
    (cosDeclination * Math.cos(toRadians(latitude)));

  if (cosHourAngle < -1 || cosHourAngle > 1) return null;

  const hourAngle = toDegrees(Math.acos(cosHourAngle)) / 15;
  const localMeanTime =
    (sunrise ? 24 - hourAngle : hourAngle) + rightAscension - 0.06571 * approximateTime - 6.622;
  const universalTime = ((localMeanTime - longitudeHour) % 24 + 24) % 24;
  const localHour = (universalTime + CAMBODIA_UTC_OFFSET_HOURS) % 24;
  const hours = Math.floor(localHour);
  const minutes = Math.round((localHour - hours) * 60);
  const normalizedHours = (hours + Math.floor(minutes / 60)) % 24;
  const normalizedMinutes = minutes % 60;

  return `${date}T${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}:00+07:00`;
}

function toCambodiaTime(utcTime) {
  const date = new Date(utcTime);
  if (Number.isNaN(date.getTime())) return null;

  const localTime = new Date(date.getTime() + CAMBODIA_UTC_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  return `${localTime}:00+07:00`;
}

function getWeatherCode(symbol) {
  const condition = String(symbol || '').split('_')[0].toLowerCase();

  if (!condition) return null;
  if (condition.includes('thunder')) return 95;
  if (condition.includes('snow')) {
    if (condition.includes('heavy')) return 75;
    if (condition.includes('light')) return 71;
    return 73;
  }
  if (condition.includes('sleet')) return 66;
  if (condition.includes('fog')) return 45;
  if (condition.includes('drizzle')) return condition.includes('heavy') ? 55 : 51;
  if (condition.includes('rainshowers')) {
    if (condition.includes('heavy')) return 82;
    return 80;
  }
  if (condition.includes('rain')) {
    if (condition.includes('heavy')) return 65;
    if (condition.includes('light')) return 61;
    return 63;
  }
  if (condition === 'clearsky') return 0;
  if (condition === 'fair') return 1;
  if (condition === 'partlycloudy') return 2;
  if (condition === 'cloudy') return 3;

  return null;
}

function getSamplePrecipitation(sample) {
  const oneHour = sample.data.next_1_hours?.details?.precipitation_amount;
  const sixHours = sample.data.next_6_hours?.details?.precipitation_amount;
  return Number.isFinite(oneHour) ? oneHour : Number.isFinite(sixHours) ? sixHours : null;
}

function getDailyTemperatureExtreme(samples, getExtreme) {
  const temperatures = samples
    .map((sample) => sample.temperature)
    .filter(Number.isFinite);

  return temperatures.length ? getExtreme(...temperatures) : null;
}

function normalizeForecast(data, location) {
  const samples = data?.properties?.timeseries;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('MET Norway returned no forecast data for this location.');
  }

  const forecast = samples
    .map((sample) => {
      const time = toCambodiaTime(sample.time);
      if (!time) return null;

      const details = sample.data.instant?.details || {};
      const symbol =
        sample.data.next_1_hours?.summary?.symbol_code ||
        sample.data.next_6_hours?.summary?.symbol_code ||
        sample.data.next_12_hours?.summary?.symbol_code;

      return {
        time,
        date: time.slice(0, 10),
        hour: Number(time.slice(11, 13)),
        temperature: details.air_temperature ?? null,
        humidity: details.relative_humidity ?? null,
        cloudCover: details.cloud_area_fraction ?? null,
        windSpeed: Number.isFinite(details.wind_speed) ? details.wind_speed * 3.6 : null,
        windDirection: details.wind_from_direction ?? null,
        precipitation: getSamplePrecipitation(sample),
        weatherCode: getWeatherCode(symbol)
      };
    })
    .filter(Boolean);

  if (forecast.length === 0) {
    throw new Error('MET Norway returned forecast timestamps that could not be read.');
  }

  const dates = [...new Set(forecast.map((sample) => sample.date))].slice(0, 7);
  const dailySamples = dates.map((date) => forecast.filter((sample) => sample.date === date));
  const currentSample = forecast[0];
  const sunrise = dates.map((date) => getSolarTime(date, location.latitude, location.longitude, true));
  const sunset = dates.map((date) => getSolarTime(date, location.latitude, location.longitude, false));
  const sunriseTime = sunrise[0] ? new Date(sunrise[0]).getTime() : Number.NaN;
  const sunsetTime = sunset[0] ? new Date(sunset[0]).getTime() : Number.NaN;
  const currentTime = new Date(currentSample.time).getTime();
  const precipitationIsRain = currentSample.weatherCode != null &&
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
      .includes(currentSample.weatherCode);

  return {
    current: {
      time: currentSample.time,
      temperature_2m: currentSample.temperature,
      apparent_temperature: null,
      relative_humidity_2m: currentSample.humidity,
      is_day: currentTime >= sunriseTime && currentTime < sunsetTime ? 1 : 0,
      precipitation: currentSample.precipitation,
      rain: precipitationIsRain ? currentSample.precipitation : null,
      weather_code: currentSample.weatherCode,
      cloud_cover: currentSample.cloudCover,
      wind_speed_10m: currentSample.windSpeed,
      wind_direction_10m: currentSample.windDirection
    },
    hourly: {
      time: forecast.map((sample) => sample.time),
      temperature_2m: forecast.map((sample) => sample.temperature),
      apparent_temperature: forecast.map(() => null),
      precipitation_probability: forecast.map(() => null),
      precipitation: forecast.map((sample) => sample.precipitation),
      rain: forecast.map((sample) => sample.precipitation),
      weather_code: forecast.map((sample) => sample.weatherCode),
      relative_humidity_2m: forecast.map((sample) => sample.humidity),
      wind_speed_10m: forecast.map((sample) => sample.windSpeed)
    },
    daily: {
      time: dates,
      temperature_2m_max: dailySamples.map((samplesForDay) =>
        getDailyTemperatureExtreme(samplesForDay, Math.max)
      ),
      temperature_2m_min: dailySamples.map((samplesForDay) =>
        getDailyTemperatureExtreme(samplesForDay, Math.min)
      ),
      sunrise,
      sunset,
      uv_index_max: dates.map(() => null),
      precipitation_probability_max: dates.map(() => null),
      precipitation_sum: dailySamples.map((samplesForDay) =>
        samplesForDay.reduce((total, sample) => total + (sample.precipitation ?? 0), 0)
      ),
      weather_code: dailySamples.map((samplesForDay) => {
        const middaySample = samplesForDay.reduce((closest, sample) =>
          Math.abs(sample.hour - 12) < Math.abs(closest.hour - 12) ? sample : closest
        );
        return middaySample.weatherCode;
      })
    }
  };
}

async function fetchForecastResponse(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response;

    if ([500, 502, 503, 504].includes(response.status) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }

    const body = await response.text();
    const message = body && !body.trimStart().startsWith('<') ? `: ${body.slice(0, 200)}` : '';
    throw new Error(`MET Norway weather service returned HTTP ${response.status}${message}`);
  }

  throw new Error('MET Norway weather service could not be reached after several attempts.');
}

async function fetchLocationForecast(location) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
    throw new Error('A valid latitude and longitude are required to load weather.');
  }

  const params = new URLSearchParams({
    lat: location.latitude.toFixed(4),
    lon: location.longitude.toFixed(4)
  });
  const response = await fetchForecastResponse(`${MET_NORWAY_BASE_URL}?${params}`);
  return normalizeForecast(await response.json(), location);
}

export async function fetchWeatherData(location) {
  return fetchLocationForecast(location);
}

export async function fetchCurrentWeatherForLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error('At least one location is required to load current weather.');
  }

  const results = new Array(locations.length);
  for (let start = 0; start < locations.length; start += 4) {
    const batch = locations.slice(start, start + 4);
    const batchResults = await Promise.all(batch.map((location) => fetchLocationForecast(location)));
    batchResults.forEach((result, index) => {
      results[start + index] = { current: result.current };
    });
  }

  return results;
}
