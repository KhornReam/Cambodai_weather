import { CAMBODIA_LOCATIONS } from './locations.js';
import { fetchWeatherData } from './api.js';
import { formatTemperature, getWeatherDescription, getWeatherIconClass, getWeatherTheme, isRainingNow } from './weather.js';

const weatherCache = new Map();
const markerMap = new Map();
const photoCache = new Map();
let photoRequestId = 0;
const CAMBODIA_REFERENCE_PHOTO = {
  title: 'Royal Palace, Phnom Penh Cambodia 1.jpg',
  imageUrl: '../assets/images/cambodia-reference-photo.jpg',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Royal_Palace,_Phnom_Penh_Cambodia_1.jpg',
  artist: 'Hanay',
  license: 'CC BY-SA 3.0',
  fallback: true
};

function normalizePhotoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getMetadataText(value) {
  if (!value) return '';

  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent.trim();
}

async function fetchPlacePhoto(placeName) {
  const searchName = String(placeName || '').split(',')[0].trim();
  if (!searchName) return null;
  if (photoCache.has(searchName)) return photoCache.get(searchName);

  try {
    const savedPhoto = localStorage.getItem(`cambodia-weather-photo:${searchName}`);
    if (savedPhoto) {
      const photo = JSON.parse(savedPhoto);
      photoCache.set(searchName, Promise.resolve(photo));
      return photo;
    }
  } catch {
    // Continue with the live source if browser storage is unavailable.
  }

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${searchName} Cambodia`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*'
  });

  const request = (async () => {
    let data;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (response.ok) {
        data = await response.json();
        break;
      }

      if (response.status !== 429 || attempt === 2) {
        throw new Error(`Image search failed (${response.status}).`);
      }

      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }

    const nameTokens = normalizePhotoText(searchName)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !['province', 'municipality', 'district'].includes(token));
    const pages = Object.values(data?.query?.pages || {});
    const match = pages.find((page) => {
      const image = page.imageinfo?.[0];
      const title = normalizePhotoText(page.title);
      return ['image/jpeg', 'image/webp'].includes(image?.mime) &&
        !/map|locator|diagram|logo|flag/.test(title) &&
        nameTokens.length > 0 &&
        nameTokens.every((token) => title.includes(token));
    });

    if (!match) return null;

    const image = match.imageinfo[0];
    const metadata = image.extmetadata || {};
    const photo = {
      title: match.title.replace(/^File:/, ''),
      imageUrl: image.thumburl || image.url,
      pageUrl: image.descriptionurl,
      artist: getMetadataText(metadata.Artist?.value),
      license: getMetadataText(metadata.LicenseShortName?.value)
    };

    try {
      localStorage.setItem(`cambodia-weather-photo:${searchName}`, JSON.stringify(photo));
    } catch {
      // The current selection can still use the in-memory photo result.
    }

    return photo;
  })().catch((error) => {
    photoCache.delete(searchName);
    throw error;
  });

  photoCache.set(searchName, request);
  return request;
}

function renderPlacePhoto(location, requestId, useFallback = false) {
  const panel = document.getElementById('map-weather-panel');
  const slot = panel?.querySelector('.map-place-photo-slot');
  if (!slot) return;

  const placeName = location.photoSearchName || location.name;
  const photoRequest = (useFallback
    ? Promise.resolve({ ...CAMBODIA_REFERENCE_PHOTO })
    : fetchPlacePhoto(placeName)
    .then((photo) => {
      if (!photo && location.admin1 && normalizePhotoText(location.admin1) !== normalizePhotoText(placeName)) {
        return fetchPlacePhoto(location.admin1).then((regionalPhoto) =>
          regionalPhoto ? { ...regionalPhoto, regionalName: location.admin1 } : null
        );
      }
      return photo;
    }))
    .then((photo) => {
      if (requestId !== photoRequestId || !slot.isConnected) return;

      if (!photo) {
        photo = { ...CAMBODIA_REFERENCE_PHOTO };
      }

      const figure = document.createElement('figure');
      figure.className = 'map-place-photo';
      const link = document.createElement('a');
      link.href = photo.pageUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.setAttribute('aria-label', `Open image source: ${photo.title}`);
      const image = document.createElement('img');
      image.src = photo.imageUrl;
      image.alt = `${location.photoSearchName || location.name}: ${photo.title}`;
      image.loading = 'eager';
      image.addEventListener('error', () => {
        if (image.dataset.fallbackUsed) return;
        image.dataset.fallbackUsed = 'true';
        image.src = CAMBODIA_REFERENCE_PHOTO.imageUrl;
        image.alt = `Cambodia reference photo of Phnom Penh, shown for ${location.name}`;
        link.href = CAMBODIA_REFERENCE_PHOTO.pageUrl;
        link.setAttribute('aria-label', `Open image source: ${CAMBODIA_REFERENCE_PHOTO.title}`);
        caption.textContent = `Cambodia reference photo, not ${location.name} · ${CAMBODIA_REFERENCE_PHOTO.title} · ${CAMBODIA_REFERENCE_PHOTO.artist} · ${CAMBODIA_REFERENCE_PHOTO.license}`;
      });
      link.append(image);
      const caption = document.createElement('figcaption');
      const regionalNote = photo.regionalName ? `Regional photo: ${photo.regionalName}, not ${placeName}` : '';
      const fallbackNote = photo.fallback
        ? `Cambodia reference photo${location.name === 'Phnom Penh' ? '' : `, not ${location.name}`}`
        : '';
      caption.textContent = [regionalNote || fallbackNote, photo.title, photo.artist, photo.license].filter(Boolean).join(' · ');
      figure.append(link, caption);
      slot.replaceWith(figure);
    })
    .catch((error) => {
      console.warn('Place photo could not be loaded:', error);
      if (requestId === photoRequestId && slot.isConnected) {
        if (!useFallback) {
          renderPlacePhoto(location, requestId, true);
        } else {
          slot.textContent = 'The bundled Cambodia reference photo could not be loaded.';
        }
      }
    });
}

function getWeatherIcon(code) {
  return `<i class="fa-solid ${getWeatherIconClass(code)}" aria-hidden="true"></i>`;
}

function createMarkerIcon(temperature, weatherCode) {
  const weatherTheme = getWeatherTheme(weatherCode);
  return L.divIcon({
    html: `
      <div class="weather-marker" data-weather-theme="${weatherTheme}">
        <span>${Math.round(temperature)}°C</span>
        <small>${getWeatherIcon(weatherCode)}</small>
      </div>
    `,
    className: 'weather-marker-wrapper',
    iconSize: [56, 42],
    iconAnchor: [28, 21]
  });
}

async function loadLocationWeather(location, refresh = false) {
  if (!refresh && weatherCache.has(location.name)) {
    return weatherCache.get(location.name);
  }

  const request = fetchWeatherData(location);
  weatherCache.set(location.name, request);

  try {
    const data = await request;
    weatherCache.set(location.name, data);
    return data;
  } catch (error) {
    weatherCache.delete(location.name);
    throw error;
  }
}

function publishProvinceRainSummary(locationWeather) {
  const rainSummary = {
    time: null,
    total: CAMBODIA_LOCATIONS.length,
    available: 0,
    rainingNow: [],
    notRainingNow: [],
    unavailable: []
  };

  for (const [index, result] of locationWeather.entries()) {
    if (result.status === 'rejected') {
      console.warn('Province current weather could not be loaded:', result.reason);
      rainSummary.unavailable.push({ location: CAMBODIA_LOCATIONS[index], reason: 'Current weather unavailable' });
      continue;
    }

    const { location, data } = result.value;
    const current = data.current || {};
    const raining = isRainingNow(current);
    rainSummary.time ||= current.time || null;

    const provinceConditions = {
      location,
      weatherCode: current.weather_code ?? null,
      condition: current.weather_code == null ? null : getWeatherDescription(current.weather_code),
      precipitation: current.rain ?? current.precipitation ?? null,
      temperature: current.temperature_2m ?? null
    };

    if (raining === null) {
      rainSummary.unavailable.push({ ...provinceConditions, reason: 'Current conditions unavailable' });
    } else if (raining) {
      rainSummary.rainingNow.push(provinceConditions);
      rainSummary.available += 1;
    } else {
      rainSummary.notRainingNow.push(provinceConditions);
      rainSummary.available += 1;
    }
  }

  window.dispatchEvent(new CustomEvent('weather:province-rain-summary', { detail: rainSummary }));
}

async function refreshProvinceWeather() {
  window.dispatchEvent(new CustomEvent('weather:province-rain-updating'));

  const locationWeather = await Promise.allSettled(
    CAMBODIA_LOCATIONS.map(async (location) => ({
      location,
      data: await loadLocationWeather(location, true)
    }))
  );

  for (const result of locationWeather) {
    if (result.status !== 'fulfilled') continue;

    const { location, data } = result.value;
    const marker = markerMap.get(location.name);
    if (marker && data.current) {
      marker.setIcon(createMarkerIcon(data.current.temperature_2m ?? 0, data.current.weather_code ?? 0));
    }
  }

  publishProvinceRainSummary(locationWeather);
}

function renderMapInfoPanel(location, data) {
  const panel = document.getElementById('map-weather-panel');
  if (!panel || !data || !location) return;

  const current = data.current || {};
  const daily = data.daily || {};
  const requestId = ++photoRequestId;
  const weatherTheme = getWeatherTheme(current.weather_code);

  panel.innerHTML = `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-brand-600">Selected place</p>
        <h3 class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">${location.name}</h3>
      </div>
      <div class="weather-icon-badge flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" data-weather-theme="${weatherTheme}">
        ${getWeatherIcon(current.weather_code)}
      </div>
    </div>

    <div class="map-place-photo-slot" aria-live="polite">Searching for a verified place photo...</div>

    <div class="map-weather-summary mb-4 rounded-2xl p-3">
      <div class="flex items-end gap-2">
        <span class="text-4xl font-black">${formatTemperature(current.temperature_2m)}</span>
        <span class="pb-1 text-sm">Feels like ${formatTemperature(current.apparent_temperature)}</span>
      </div>
      <p class="mt-2 text-sm font-medium">${getWeatherDescription(current.weather_code)}</p>
    </div>

    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">Humidity</p>
        <p class="mt-1 font-bold">${current.relative_humidity_2m ?? '--'}%</p>
      </div>
      <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">Wind</p>
        <p class="mt-1 font-bold">${current.wind_speed_10m ?? '--'} km/h</p>
      </div>
      <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">UV</p>
        <p class="mt-1 font-bold">${daily.uv_index_max?.[0] ?? '--'}</p>
      </div>
      <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">Rain</p>
        <p class="mt-1 font-bold">${current.precipitation ?? '0'} mm</p>
      </div>
    </div>

    <div class="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
      <p>Sunrise: ${daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--'}</p>
      <p class="mt-1">Sunset: ${daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--'}</p>
      <p class="mt-1">Cloud cover: ${current.cloud_cover ?? '--'}%</p>
    </div>
  `;

  renderPlacePhoto(location, requestId);
}

export async function initializeMapWeatherLayer(map, onProvinceSelect) {
  const markerLayer = L.layerGroup().addTo(map);

  window.addEventListener('weather:dashboard-updated', (event) => {
    const location = event.detail?.location;
    const data = event.detail?.data;

    if (!location || !data) return;
    renderMapInfoPanel(location, data);

    const marker = markerMap.get(location.name);
    if (marker && data.current) {
      marker.setIcon(createMarkerIcon(data.current.temperature_2m ?? 0, data.current.weather_code ?? 0));
      marker.bindPopup(`
        <div class="text-sm">
          <strong>${location.name}</strong><br />
          ${Math.round(data.current.temperature_2m ?? 0)}°C ${getWeatherIcon(data.current.weather_code)}
        </div>
      `);
    } else if (data.current && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      const placeMarker = L.marker([location.latitude, location.longitude], {
        icon: createMarkerIcon(data.current.temperature_2m ?? 0, data.current.weather_code ?? 0)
      }).addTo(markerLayer);
      placeMarker.bindPopup(`<div class="text-sm"><strong>${location.name}</strong><br />${Math.round(data.current.temperature_2m ?? 0)}°C ${getWeatherIcon(data.current.weather_code)}</div>`);
      placeMarker.on('click', () => {
        window.dispatchEvent(new CustomEvent('location:selected', { detail: { location } }));
      });
      markerMap.set(location.name, placeMarker);
    }
  });

  const locationWeather = await Promise.allSettled(
    CAMBODIA_LOCATIONS.map(async (location) => ({
      location,
      data: await loadLocationWeather(location)
    }))
  );

  publishProvinceRainSummary(locationWeather);

  for (const result of locationWeather) {
    if (result.status === 'rejected') {
      continue;
    }

    const { location, data } = result.value;
    const current = data.current || {};
    const marker = L.marker([location.latitude, location.longitude], {
      icon: createMarkerIcon(current.temperature_2m ?? 0, current.weather_code ?? 0)
    }).addTo(markerLayer);

    marker.bindPopup(`
      <div class="text-sm">
        <strong>${location.name}</strong><br />
        ${Math.round(current.temperature_2m ?? 0)}°C ${getWeatherIcon(current.weather_code)}
      </div>
    `);

    marker.on('click', () => {
      if (onProvinceSelect) {
        onProvinceSelect(location.name);
      }
      renderMapInfoPanel(location, data);
    });

    markerMap.set(location.name, marker);
  }

  window.addEventListener('weather:refresh-provinces', () => {
    refreshProvinceWeather().catch((error) => {
      console.error('Province current weather refresh failed:', error);
    });
  });

  return { markerLayer, markerMap, renderMapInfoPanel };
}

export async function refreshMarkerWeather(locationName) {
  const location = CAMBODIA_LOCATIONS.find((item) => item.name === locationName);
  if (!location) return;

  const data = await loadLocationWeather(location);
  const marker = markerMap.get(locationName);
  if (marker && data.current) {
    marker.setIcon(createMarkerIcon(data.current.temperature_2m ?? 0, data.current.weather_code ?? 0));
  }

  return data;
}
