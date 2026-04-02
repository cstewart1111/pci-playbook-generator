import { LatLng, MeetingSlot } from "./types";

/**
 * Haversine formula to compute straight-line distance (meters).
 */
function haversine(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aHarv =
    sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return R * c;
}

/**
 * Simple nearest-neighbor route solver.
 */
export function solveRoute(
  meetings: MeetingSlot[],
  home?: LatLng
): MeetingSlot[] {
  const remaining = meetings.slice();
  const ordered: MeetingSlot[] = [];
  let current: LatLng | undefined = home;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const m = remaining[i];
      if (m.lat == null || m.lng == null) continue;
      const dist = current
        ? haversine(current, { lat: m.lat, lng: m.lng })
        : 0;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    if (next.lat != null && next.lng != null) {
      current = { lat: next.lat, lng: next.lng };
    }
  }
  return ordered;
}