import { Client } from "@googlemaps/google-maps-services-js";
import { TTLCache } from "./cache";
import { config } from "./config";
import { LatLng } from "./types";

const client = new Client({});
const cache = new TTLCache<LatLng>();

/**
 * Geocode an address to latitude/longitude, with caching.
 */
export async function geocodeAddress(address: string): Promise<LatLng> {
  const key = address.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const response = await client.geocode({
    params: {
      address,
      key: config.googleApiKey,
    },
  });
  if (response.data.status !== "OK" || !response.data.results.length) {
    throw new Error(`Geocode failed for "${address}": ${response.data.status}`);
  }
  const loc = response.data.results[0].geometry.location;
  const value: LatLng = { lat: loc.lat, lng: loc.lng };
  cache.set(key, value, config.geocodeCacheTtlMs);
  return value;
}