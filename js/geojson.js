const PROVINCE_DATA_URL = new URL('../assets/cambodia-provinces.geojson', import.meta.url);
const PROVINCE_NAME_ALIASES = new Map([
  ['Bantey Meanchey', 'Banteay Meanchey'],
  ['Ratanakiri Province', 'Ratanakiri'],
  ['Tbong Khmum', 'Tboung Khmum']
]);

export async function loadProvinceGeoJSON() {
  const response = await fetch(PROVINCE_DATA_URL);

  if (!response.ok) {
    throw new Error(`Cambodia province boundaries could not be loaded (status ${response.status}).`);
  }

  const data = await response.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Cambodia province boundary data has an invalid GeoJSON structure.');
  }

  return {
    ...data,
    features: data.features.map((feature) => {
      const sourceName = feature.properties?.shapeName;
      const name = PROVINCE_NAME_ALIASES.get(sourceName) || sourceName;

      if (!name || !feature.geometry) {
        throw new Error('Cambodia province boundary data contains an incomplete feature.');
      }

      return {
        ...feature,
        properties: { ...feature.properties, name }
      };
    })
  };
}
