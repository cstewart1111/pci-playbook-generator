/**
 * Common types for travel optimization.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface MeetingSlot {
  id: string;
  address: string;
  scheduledStartTime: string; // ISO string
  durationMinutes: number;
  companyId?: string;
  companyName?: string;
  lat?: number;
  lng?: number;
}

export interface DirectionLeg {
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
}

export interface Itinerary {
  date: string;
  home?: { address: string; lat: number; lng: number };
  meetings: MeetingSlot[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  directions: DirectionLeg[];
}