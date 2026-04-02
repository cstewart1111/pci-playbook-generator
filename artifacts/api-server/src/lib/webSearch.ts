import fetch from "node-fetch";
import { config } from "./config";
import { geocodeAddress } from "./geocode";
import { LatLng } from "./types";

interface AddressCandidate extends LatLng {
  address: string;
}

/**
 * Confirm or enrich an address using Custom Search or Geocode fallback.
 */
export async function confirmAddress(
  rawAddress: string,
  companyName?: string
): Promise<AddressCandidate[]> {
  // First try geocoding raw input
  try {
    const geo = await geocodeAddress(rawAddress);
    return [{ address: rawAddress, lat: geo.lat, lng: geo.lng }];
  } catch {
    // Fallback to Custom Search if configured
    if (config.customSearchApiKey && config.customSearchCx) {
      const q = [companyName, rawAddress].filter(Boolean).join(" ");
      const url = `https://customsearch.googleapis.com/customsearch/v1?key=${config.customSearchApiKey}&cx=${config.customSearchCx}&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as any;
        const items = data.items ?? [];
        const candidates: AddressCandidate[] = [];
        for (const item of items.slice(0, 5)) {
          const text = item.snippet || item.title || "";
          try {
            const geo = await geocodeAddress(text);
            candidates.push({ address: text, lat: geo.lat, lng: geo.lng });
          } catch {
            continue;
          }
        }
        if (candidates.length) return candidates;
      }
    }
    // Last resort, return empty
    return [];
  }
}

export type { AddressCandidate };