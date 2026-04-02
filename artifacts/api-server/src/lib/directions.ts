import { Client } from "@googlemaps/google-maps-services-js";
import { MeetingSlot, DirectionLeg } from "./types";
import { config } from "./config";

const client = new Client({});

/**
 * Fetch driving directions for an ordered sequence of meetings.
 */
export async function getDirections(
  meetings: MeetingSlot[],
  home?: { address: string; lat: number; lng: number }
): Promise<DirectionLeg[]> {
  if (!meetings.length) return [];

  const origin = home
    ? `${home.lat},${home.lng}`
    : `${meetings[0].lat},${meetings[0].lng}`;
  const destination = `${meetings[meetings.length - 1].lat},${meetings[
    meetings.length - 1
  ].lng}`;
  // When no home provided, origin is meetings[0], so waypoints start at index 1.
  // When home is provided, all meetings except the last are waypoints.
  const waypointStart = home ? 0 : 1;
  const waypoints = meetings
    .slice(waypointStart, -1)
    .map((m) => `${m.lat},${m.lng}`);

  const params: any = {
    origin,
    destination,
    key: config.googleApiKey,
    mode: "driving",
  };
  if (waypoints.length) {
    params.waypoints = waypoints;
  }
  // departure_time omitted for simplicity; add if needed
  const response = await client.directions({ params });
  if (response.data.status !== "OK" || !response.data.routes.length) {
    throw new Error(`Directions API failed: ${response.data.status}`);
  }
  const route = response.data.routes[0];
  const legs = route.legs;

  return legs.map((leg) => ({
    origin: {
      address: leg.start_address,
      lat: leg.start_location.lat,
      lng: leg.start_location.lng,
    },
    destination: {
      address: leg.end_address,
      lat: leg.end_location.lat,
      lng: leg.end_location.lng,
    },
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    polyline: route.overview_polyline?.points,
  }));
}