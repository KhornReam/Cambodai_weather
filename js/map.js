import { CAMBODIA_LOCATIONS } from './locations.js';
import { loadProvinceGeoJSON } from './geojson.js';
import { initializeMapWeatherLayer } from './mapWeather.js';

const CAMBODIA_BOUNDS = [
  [8.9, 102.1],
  [14.8, 107.7]
];

const defaultProvinceStyle = {
  color: '#1d4ed8',
  weight: 1,
  fillColor: '#7dd3fc',
  fillOpacity: 0.16
};

const selectedProvinceStyle = {
  color: '#0f172a',
  weight: 3,
  fillColor: '#60a5fa',
  fillOpacity: 0.45
};

export async function initMap(onProvinceSelect) {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof window.L === 'undefined') {
    return null;
  }

  const map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: true,
    minZoom: 6,
    maxZoom: 9,
    maxBounds: [
      [8.2, 101.4],
      [15.3, 108.5]
    ],
    maxBoundsViscosity: 0.75
  });

  map.fitBounds(CAMBODIA_BOUNDS);
  map.setMaxBounds([
    [8.2, 101.4],
    [15.3, 108.5]
  ]);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.control.zoom({ position: 'topleft' }).addTo(map);

  const resetButton = document.getElementById('reset-map-btn');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      map.flyToBounds(CAMBODIA_BOUNDS, {
        padding: [20, 20],
        duration: 1.2
      });
    });
  }

  const fullscreenButton = document.getElementById('fullscreen-map-btn');
  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', async () => {
      if (!document.fullscreenElement) {
        await mapContainer.requestFullscreen().catch(() => {});
      } else {
        await document.exitFullscreen().catch(() => {});
      }

      setTimeout(() => map.invalidateSize(), 250);
    });
  }

  const provinceLayers = new Map();
  let selectedLayer = null;
  let selectedPlaceMarker = null;

  const focusLocation = (location) => {
    if (!location) return;

    const provinceName = location.admin1 || location.name;
    const targetLayer = provinceLayers.get(provinceName);
    if (selectedLayer && selectedLayer !== targetLayer) {
      selectedLayer.setStyle({ ...defaultProvinceStyle });
    }
    if (targetLayer) {
      selectedLayer = targetLayer;
      targetLayer.setStyle({ ...selectedProvinceStyle });
    }

    if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      const isProvince = CAMBODIA_LOCATIONS.some((item) => item.name === location.name);
      map.flyTo([location.latitude, location.longitude], isProvince ? 8 : 10, { duration: 1.2 });

      if (!isProvince) {
        if (selectedPlaceMarker) {
          selectedPlaceMarker.setLatLng([location.latitude, location.longitude]);
        } else {
          selectedPlaceMarker = L.circleMarker([location.latitude, location.longitude], {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: '#e11d48',
            fillOpacity: 1
          }).addTo(map);
        }
        selectedPlaceMarker.bindTooltip(location.name, { permanent: true, direction: 'top' });
      }
    }
  };

  try {
    const geoJsonData = await loadProvinceGeoJSON();
    const provinceLayer = L.geoJSON(geoJsonData, {
      style: () => ({ ...defaultProvinceStyle }),
      onEachFeature: (feature, layer) => {
        const provinceName = feature.properties?.name || 'Province';
        provinceLayers.set(provinceName, layer);

        layer.bindTooltip(provinceName, {
          sticky: true,
          direction: 'center'
        });

        layer.on('mouseover', () => {
          if (selectedLayer !== layer) {
            layer.setStyle({ ...defaultProvinceStyle, fillOpacity: 0.28, weight: 2 });
          }
        });

        layer.on('mouseout', () => {
          if (selectedLayer !== layer) {
            layer.setStyle({ ...defaultProvinceStyle });
          }
        });

        layer.on('click', () => {
          if (selectedLayer && selectedLayer !== layer) {
            selectedLayer.setStyle({ ...defaultProvinceStyle });
          }

          selectedLayer = layer;
          layer.setStyle({ ...selectedProvinceStyle });

          if (onProvinceSelect) {
            onProvinceSelect(provinceName);
          }
        });
      }
    });

    provinceLayer.addTo(map);

    window.addEventListener('location:selected', (event) => {
      const location = event.detail?.location || CAMBODIA_LOCATIONS.find((item) => item.name === event.detail?.locationName);
      focusLocation(location);
    });
  } catch (error) {
    console.error('GeoJSON map data failed to load:', error);
  }

  const weatherMap = await initializeMapWeatherLayer(map, onProvinceSelect);

  return {
    map,
    weatherMap,
    focusLocation,
    focusProvince: (provinceName) => {
      const match = CAMBODIA_LOCATIONS.find((location) => location.name === provinceName);
      focusLocation(match);
    }
  };
}
