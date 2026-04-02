import { Router } from "express";
import { getUpcomingMeetings } from "../lib/hubspotMeetings";
import { geocodeAddress } from "../lib/geocode";
import { solveRoute } from "../lib/solver";
import { getDirections } from "../lib/directions";
import { confirmAddress, AddressCandidate } from "../lib/webSearch";
import { LatLng, MeetingSlot, Itinerary } from "../lib/types";

const router = Router();

/**
 * Optimize travel for a given date, optional home base, and seed account.
 * Returns an itinerary with ordered meetings and driving directions.
 */
router.get("/optimize-travel", async (req, res) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const homeBase = req.query.homeBase ? String(req.query.homeBase) : undefined;
    const seedAccountId = req.query.seedAccountId
      ? String(req.query.seedAccountId)
      : undefined;

    // Fetch meetings
    const meetings = await getUpcomingMeetings(date, seedAccountId);
    if (!meetings.length) {
      return res.status(404).json({ error: "No meetings found for given date." });
    }

    // Geocode home base if provided
    let homeGeo: LatLng | undefined;
    if (homeBase) {
      try {
        homeGeo = await geocodeAddress(homeBase);
      } catch (e: any) {
        return res
          .status(400)
          .json({ error: `Failed to geocode homeBase: ${e.message}` });
      }
    }

    // Geocode meeting addresses
    const meetingsWithGeo: MeetingSlot[] = [];
    for (const m of meetings) {
      try {
        const geo = await geocodeAddress(m.address);
        meetingsWithGeo.push({ ...m, lat: geo.lat, lng: geo.lng });
      } catch (e: any) {
        return res
          .status(400)
          .json({ error: `Failed to geocode meeting address "${m.address}": ${e.message}` });
      }
    }

    // Solve route
    const ordered = solveRoute(meetingsWithGeo, homeGeo);

    // Fetch directions
    const directions = await getDirections(
      ordered,
      homeGeo && homeBase ? { address: homeBase, ...homeGeo } : undefined
    );

    // Summarize
    const totalDistanceMeters = directions.reduce(
      (sum, leg) => sum + leg.distanceMeters,
      0
    );
    const totalDurationSeconds = directions.reduce(
      (sum, leg) => sum + leg.durationSeconds,
      0
    );

    const itinerary: Itinerary = {
      date,
      home:
        homeGeo && homeBase
          ? { address: homeBase, lat: homeGeo.lat, lng: homeGeo.lng }
          : undefined,
      meetings: ordered,
      totalDistanceMeters,
      totalDurationSeconds,
      directions,
    };

    return res.json(itinerary);
  } catch (err: any) {
    console.error("Error optimizing travel:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * Confirm an address by returning candidate normalized addresses with geocodes.
 */
router.post("/confirm-address", async (req, res) => {
  try {
    const rawAddress = req.body.rawAddress as string;
    const companyName = req.body.companyName as string | undefined;
    if (!rawAddress) {
      return res.status(400).json({ error: "rawAddress is required." });
    }
    const candidates: AddressCandidate[] = await confirmAddress(
      rawAddress,
      companyName
    );
    return res.json({ candidates });
  } catch (err: any) {
    console.error("Error confirming address:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;