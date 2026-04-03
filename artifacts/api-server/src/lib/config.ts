/**
 * Central configuration loader for environment variables.
 */
export const config = {
  googleApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  customSearchApiKey: process.env.CUSTOM_SEARCH_API_KEY || "",
  customSearchCx: process.env.CUSTOM_SEARCH_CX || "",
  geocodeCacheTtlMs: Number(process.env.GEOCODE_CACHE_TTL_MS) || 30 * 24 * 60 * 60 * 1000,
  distanceMatrixCacheTtlMs: Number(process.env.DISTANCE_MATRIX_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
};

