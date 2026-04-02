import { Client } from "@googlemaps/google-maps-services-js";
import { TTLCache } from "./cache";
import { config } from "./config";
import { LatLng } from "./types";

const client = new Client({});
const cache = new TTLCache<{ distanceMeters: number; durationSeconds: number }[][]>();

/**
 * Fetch a distance matrix between origins and destinations.
 */
export async function getDistanceMatrix(
  origins: LatLng[],
  destinations: LatLng[],
  departureTime?: number
): Promise<{ distanceMeters: number; durationSeconds: number }[][]> {
  const key = JSON.stringify({ origins, destinations, departureTime });
  const cached = cache.get(key);
  if (cached) return cached;

  const params: any = {
    origins: origins.map((o) => `${o.lat},${o.lng}`),
    destinations: destinations.map((d) => `${d.lat},${d.lng}`),
    key: config.googleApiKey,
    mode: "driving",
  };
  if (departureTime) {
    params.departure_time = departureTime;
    params.traffic_model = "best_guess";
  }
  const response = await client.distancematrix({ params });
  if (response.data.status !== "OK") {
    throw new Error(`DistanceMatrix API error: ${response.data.status}`);
  }
  const matrix = response.data.rows.map((row) =>
    row.elements.map((el) => {
      const dist = el.distance?.value ?? 0;
      const dur = departureTime
        ? el.duration_in_traffic?.value ?? el.duration?.value ?? 0
        : el.duration?.value ?? 0;
      return { distanceMeters: dist, durationSeconds: dur };
    })
  );
  cache.set(key, matrix, config.distanceMatrixCacheTtlMs);
  return matrix;
}