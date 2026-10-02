import { CAMBODIA_LOCATIONS } from './locations.js';
import { loadProvinceGeoJSON } from './geojson.js';
import { initializeMapWeatherLayer } from './mapWeather.js';

const CAMBODIA_BOUNDS = [
  [8.9, 102.1],
  [14.8, 107.7]
];

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

  const getProvinceStyles = () => {
    const rootStyle = getComputedStyle(document.documentElement);
    const accent = rootStyle.getPropertyValue('--weather-accent').trim() || '#3f8874';
    const strong = rootStyle.getPropertyValue('--weather-accent-strong').trim() || '#173d36';

    return {
      default: { color: accent, weight: 1, fillColor: accent, fillOpacity: 0.1 },
      selected: { color: strong, weight: 3, fillColor: accent, fillOpacity: 0.38 }
    };
  };

  const updateProvinceStyles = () => {
    const styles = getProvinceStyles();
    provinceLayers.forEach((layer) => {
      layer.setStyle(layer === selectedLayer ? styles.selected : styles.default);
    });
    selectedPlaceMarker?.setStyle({ fillColor: styles.default.color });
  };

  const focusLocation = (location) => {
    if (!location) return;

    const provinceStyles = getProvinceStyles();
    const provinceName = location.admin1 || location.name;
    const targetLayer = provinceLayers.get(provinceName);
    if (selectedLayer && selectedLayer !== targetLayer) {
      selectedLayer.setStyle(provinceStyles.default);
    }
    if (targetLayer) {
      selectedLayer = targetLayer;
      targetLayer.setStyle(provinceStyles.selected);
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
            fillColor: provinceStyles.default.color,
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
      style: () => getProvinceStyles().default,
      onEachFeature: (feature, layer) => {
        const provinceName = feature.properties?.name || 'Province';
        provinceLayers.set(provinceName, layer);

        layer.bindTooltip(provinceName, {
          sticky: true,
          direction: 'center'
        });

        layer.on('mouseover', () => {
          if (selectedLayer !== layer) {
            layer.setStyle({ ...getProvinceStyles().default, fillOpacity: 0.25, weight: 2 });
          }
        });

        layer.on('mouseout', () => {
          if (selectedLayer !== layer) {
            layer.setStyle(getProvinceStyles().default);
          }
        });

        layer.on('click', () => {
          if (selectedLayer && selectedLayer !== layer) {
            selectedLayer.setStyle(getProvinceStyles().default);
          }

          selectedLayer = layer;
          layer.setStyle(getProvinceStyles().selected);

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

    window.addEventListener('weather:dashboard-updated', updateProvinceStyles);
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
