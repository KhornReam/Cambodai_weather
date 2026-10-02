import { CAMBODIA_LOCATIONS, DEFAULT_LOCATION } from './locations.js';
import { fetchWeatherData } from './api.js';
import { buildNightRainMessage, formatTemperature, getDailyHighLow, getWeatherDescription, getWeatherIconClass, getWeatherTheme } from './weather.js';
import { initializeUI, populateLocationSelect, renderLocationOverview, renderErrorState, setLoadingState, startCambodiaClock, updateLastUpdated } from './ui.js';
import { initMap } from './map.js';

const appState = {
  selectedLocation: DEFAULT_LOCATION,
  darkMode: localStorage.getItem('cambodia-weather-theme') === 'dark'
};

async function refreshWeather() {
  setLoadingState(true);

  try {
    const weatherData = await fetchWeatherData(appState.selectedLocation);
    updateWeatherDashboard(weatherData);
    updateLastUpdated(new Date());
  } catch (error) {
    console.error('Weather refresh failed:', error);
    renderErrorState(error.message || 'Weather data could not be loaded.');
  } finally {
    setLoadingState(false);
  }
}

function updateWeatherDashboard(data) {
  const current = data.current;
  const daily = data.daily;
  const hourly = data.hourly;
  const todayHighLow = getDailyHighLow(daily);
  const weatherTheme = getWeatherTheme(current.weather_code);
  const daylight = Number(current.is_day) === 0 ? 'night' : 'day';

  document.documentElement.dataset.weatherTheme = weatherTheme;
  document.documentElement.dataset.daylight = daylight;

  const locationSelect = document.getElementById('location-select');
  if (locationSelect) {
    locationSelect.value = appState.selectedLocation.name;
  }

  document.getElementById('selected-location').textContent = appState.selectedLocation.name;
  document.getElementById('weather-description').textContent = getWeatherDescription(current.weather_code);
  const currentWeatherIcon = document.getElementById('current-weather-icon');
  if (currentWeatherIcon) {
    currentWeatherIcon.className = `fa-solid ${getWeatherIconClass(current.weather_code)}`;
  }
  document.getElementById('current-temperature').textContent = formatTemperature(current.temperature_2m);
  document.getElementById('feels-like').textContent = formatTemperature(current.apparent_temperature);
  document.getElementById('temp-range').textContent = `${formatTemperature(todayHighLow.max)} / ${formatTemperature(todayHighLow.min)}`;
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m ?? '--'}%`;
  document.getElementById('wind-speed').textContent = `${current.wind_speed_10m ?? '--'} km/h`;
  document.getElementById('uv-index').textContent = daily.uv_index_max?.[0] ?? '--';
  document.getElementById('cloud-cover').textContent = `${current.cloud_cover ?? '--'}%`;
  document.getElementById('precipitation').textContent = `${current.precipitation ?? '--'} mm`;

  window.dispatchEvent(
    new CustomEvent('weather:dashboard-updated', {
      detail: {
        location: appState.selectedLocation,
        data
      }
    })
  );

  const nightly = buildNightRainMessage(hourly, daily.sunrise?.[0], daily.sunset?.[0]);
  const rainForecast = document.getElementById('rain-forecast');
  if (rainForecast) {
    rainForecast.innerHTML = `
      <div class="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
        <p class="text-base font-bold">${nightly.status}</p>
        <p class="mt-2 text-sm leading-6">${nightly.detail}</p>
      </div>
    `;
  }

  const hourlyContainer = document.getElementById('hourly-forecast');
  if (hourlyContainer) {
    hourlyContainer.innerHTML = hourly.time
      .slice(0, 6)
      .map((time, index) => {
        const temp = hourly.temperature_2m[index];
        const precipChance = hourly.precipitation_probability?.[index];
        const precipitation = hourly.precipitation?.[index];
        const weatherCode = hourly.weather_code[index];
        const isRainy = precipChance != null
          ? precipChance >= 40
          : Number(precipitation) > 0 || getWeatherTheme(weatherCode) === 'rain' || getWeatherTheme(weatherCode) === 'storm';
        const weatherIcon = getWeatherIconClass(weatherCode);
        const rainLabel = precipChance != null
          ? `${precipChance}% rain`
          : precipitation != null
            ? `${Number(precipitation).toFixed(1)} mm`
            : 'Rain --';

        return `
          <div class="forecast-item ${isRainy ? 'rainy' : ''}" data-weather-theme="${getWeatherTheme(hourly.weather_code[index])}">
            <p class="text-xs text-slate-500 dark:text-slate-400">${new Intl.DateTimeFormat([], { hour: 'numeric', timeZone: 'Asia/Phnom_Penh' }).format(new Date(time))}</p>
            <div class="mt-2 flex justify-center text-lg text-sky-500">
              <i class="fa-solid ${weatherIcon}" aria-hidden="true"></i>
            </div>
            <p class="mt-2 text-center text-lg font-bold">${formatTemperature(temp)}</p>
            <p class="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">${rainLabel}</p>
          </div>
        `;
      })
      .join('');
  }

  const dailyContainer = document.getElementById('daily-forecast');
  if (dailyContainer) {
    dailyContainer.innerHTML = daily.time
      .slice(0, 7)
      .map((date, index) => {
        const conditionCode = daily.weather_code[index];
        const conditionTheme = getWeatherTheme(conditionCode);
        const precipChance = daily.precipitation_probability_max?.[index];
        const day = new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Phnom_Penh'
        }).format(new Date(`${date}T12:00:00+07:00`));

        return `
          <div class="daily-forecast-row" data-weather-theme="${conditionTheme}">
            <p class="daily-forecast-day">${index === 0 ? 'Today' : day}</p>
            <span class="daily-forecast-condition" aria-label="${getWeatherDescription(conditionCode)}">
              <i class="fa-solid ${getWeatherIconClass(conditionCode)}" aria-hidden="true"></i>
            </span>
            <p class="daily-forecast-description">${getWeatherDescription(conditionCode)}</p>
            <p class="daily-forecast-rain"><i class="fa-solid fa-droplet" aria-hidden="true"></i> ${precipChance ?? '--'}%</p>
            <p class="daily-forecast-temperatures">
              <strong>${formatTemperature(daily.temperature_2m_max?.[index])}</strong>
              <span>${formatTemperature(daily.temperature_2m_min?.[index])}</span>
            </p>
          </div>
        `;
      })
      .join('');
  }

  renderLocationOverview(CAMBODIA_LOCATIONS, appState.selectedLocation.name);
}

let dashboardStarted = false;

async function startWeatherDashboard() {
  if (dashboardStarted) return;
  dashboardStarted = true;

  populateLocationSelect(CAMBODIA_LOCATIONS);
  initializeUI(appState);
  startCambodiaClock();
  const locationSelect = document.getElementById('location-select');
  if (locationSelect) {
    locationSelect.value = appState.selectedLocation.name;
  }
  renderLocationOverview(CAMBODIA_LOCATIONS, appState.selectedLocation.name);

  let mapController = null;

  window.addEventListener('location:search', (event) => {
    const query = event.detail?.query ?? '';
    renderLocationOverview(CAMBODIA_LOCATIONS, appState.selectedLocation.name, query);
  });

  window.addEventListener('location:place-search', async (event) => {
    const query = event.detail?.query?.trim();
    if (!query) return;

    try {
      const params = new URLSearchParams({
        name: query,
        count: '8',
        language: 'en',
        format: 'json',
        countryCode: 'KH'
      });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      if (!response.ok) throw new Error(`Place search failed (${response.status}).`);

      const data = await response.json();
      const results = (data.results || [])
        .filter((result) => result.country_code === 'KH' && Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
        .map((result) => ({
          id: `place-${result.latitude}-${result.longitude}`,
          name: result.name,
          photoSearchName: result.name,
          latitude: result.latitude,
          longitude: result.longitude,
          admin1: result.admin1,
          admin2: result.admin2,
          country: 'Cambodia',
          featureCode: result.feature_code
        }));

      window.dispatchEvent(new CustomEvent('location:place-results', { detail: { results } }));
    } catch (error) {
      console.error('Cambodia place search failed:', error);
      window.dispatchEvent(
        new CustomEvent('location:place-results', {
          detail: { results: [], message: 'Place search is temporarily unavailable.' }
        })
      );
    }
  });

  window.addEventListener('location:selected', async (event) => {
    const place = event.detail.location;
    const selectedName = event.detail.locationName;
    const found = place || CAMBODIA_LOCATIONS.find((location) => location.name === selectedName);

    if (!found || !Number.isFinite(found.latitude) || !Number.isFinite(found.longitude)) return;

    if (appState.selectedLocation.id === found.id) {
      return;
    }

    appState.selectedLocation = found;
    renderLocationOverview(CAMBODIA_LOCATIONS, appState.selectedLocation.name, document.getElementById('location-search')?.value || '');
    const currentSelect = document.getElementById('location-select');
    if (currentSelect) {
      if (![...currentSelect.options].some((option) => option.value === found.name)) {
        const option = document.createElement('option');
        option.value = found.name;
        option.textContent = found.admin1 ? `${found.name} · ${found.admin1}` : found.name;
        currentSelect.append(option);
      }
      currentSelect.value = found.name;
    }
    mapController?.focusLocation?.(found);
    await refreshWeather();
  });

  window.addEventListener('weather:refresh', async () => {
    await refreshWeather();
    window.dispatchEvent(new CustomEvent('weather:refresh-provinces'));
  });

  mapController = await initMap(async (provinceName) => {
    const found = CAMBODIA_LOCATIONS.find((location) => location.name === provinceName);
    if (!found) return;

    appState.selectedLocation = found;
    const searchField = document.getElementById('location-search');
    if (searchField) {
      searchField.value = '';
    }
    renderLocationOverview(CAMBODIA_LOCATIONS, appState.selectedLocation.name, '');

    if (locationSelect) {
      locationSelect.value = found.name;
    }

    await refreshWeather();
  });

  if (mapController && mapController.focusLocation) {
    mapController.focusLocation(appState.selectedLocation);
  }

  refreshWeather();
}

document.addEventListener('DOMContentLoaded', () => {
  const welcomeScreen = document.getElementById('welcome-screen');
  const dashboardShell = document.getElementById('weather-app-shell');
  const startButton = document.getElementById('get-started');

  if (!welcomeScreen || !dashboardShell || !startButton) {
    startWeatherDashboard();
    return;
  }

  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    dashboardShell.hidden = false;
    dashboardShell.inert = false;
    dashboardShell.removeAttribute('aria-hidden');
    welcomeScreen.classList.add('is-leaving');

    window.setTimeout(() => {
      welcomeScreen.hidden = true;
    }, 340);

    await startWeatherDashboard();
  }, { once: true });
});
