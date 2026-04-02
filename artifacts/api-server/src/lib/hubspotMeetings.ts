import { hubspotPost } from "./hubspotClient";
import { MeetingSlot } from "./types";

/**
 * Fetch upcoming HubSpot meetings for a given date.
 * Falls back to empty list on errors.
 */
export async function getUpcomingMeetings(
  date: string,
  seedAccountId?: string
): Promise<MeetingSlot[]> {
  try {
    // Define start and end of day in epoch ms
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const filterGroups: any[] = [
      {
        filters: [
          { propertyName: "hs_meeting_start_time", operator: "GTE", value: start.getTime() },
          { propertyName: "hs_meeting_start_time", operator: "LT", value: end.getTime() },
        ],
      },
    ];
    // More filtering by owner or account can be added here

    const body = {
      filterGroups,
      sorts: [{ propertyName: "hs_meeting_start_time", direction: "ASCENDING" }],
      properties: ["hs_meeting_start_time", "hs_meeting_location"],
      limit: 50,
    };
    const data = await hubspotPost("/crm/v3/objects/meetings/search", body) as any;
    const results = data.results ?? [];
    return results.map((r: any) => ({
      id: r.id,
      address: r.properties.hs_meeting_location ?? "",
      scheduledStartTime: new Date(Number(r.properties.hs_meeting_start_time)).toISOString(),
      durationMinutes: 30,
    }));
  } catch (err) {
    console.error("Error fetching HubSpot meetings:", err);
    return [];
  }
}