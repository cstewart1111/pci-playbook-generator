import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Clock, Navigation, Home } from "lucide-react";
import type { Itinerary } from "@workspace/api-client-react";

function formatDistance(meters: number): string {
  const miles = meters * 0.000621371;
  return `${miles.toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TravelPlanner() {
  const [date, setDate] = useState(getTodayDate());
  const [homeBase, setHomeBase] = useState("");
  const [result, setResult] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ date });
      if (homeBase.trim()) params.set("homeBase", homeBase.trim());
      const res = await fetch(`/api/travel/optimize-travel?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to optimize travel");
      } else {
        setResult(json as Itinerary);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = () => {
    if (!result) return;
    const stops = [
      result.home?.address,
      ...result.meetings.map((m) => m.address),
    ].filter((s): s is string => !!s);
    if (stops.length < 2) return;
    const origin = encodeURIComponent(stops[0]);
    const destination = encodeURIComponent(stops[stops.length - 1]);
    const waypoints = stops
      .slice(1, -1)
      .map(encodeURIComponent)
      .join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
    window.open(url, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Travel Planner"
        description="Optimize your driving route for HubSpot meetings on a given day"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        {/* Input form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="input-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">
                  Home Base{" "}
                  <span className="text-xs">(optional starting point)</span>
                </Label>
                <Input
                  placeholder="e.g. 123 Main St, Austin TX"
                  value={homeBase}
                  onChange={(e) => setHomeBase(e.target.value)}
                  data-testid="input-home-base"
                />
              </div>
            </div>
            <Button
              onClick={handleOptimize}
              disabled={loading || !date}
              className="w-full"
              data-testid="button-optimize"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Optimizing Route...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Optimize Route
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error state */}
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary stats */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {formatDistance(result.totalDistanceMeters)}
                    </span>
                    <span className="text-xs text-muted-foreground">total drive</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {formatDuration(result.totalDurationSeconds)}
                    </span>
                    <span className="text-xs text-muted-foreground">drive time</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{result.meetings.length}</span>
                    <span className="text-xs text-muted-foreground">stops</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Itinerary timeline */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-4">Optimized Route</h3>

                {/* Home base start */}
                {result.home && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Home className="w-4 h-4 text-primary" />
                      </div>
                      <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />
                    </div>
                    <div className="pb-4 pt-1 min-w-0">
                      <p className="text-sm font-medium">Start: Home Base</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.home.address}
                      </p>
                    </div>
                  </div>
                )}

                {result.meetings.map((meeting, idx) => {
                  // Determine the driving leg that leads INTO this stop.
                  // With a home base: leg[idx] leads into meeting[idx].
                  // Without a home base: leg[0] connects meeting[0]→meeting[1],
                  // so the leg into meeting[idx] is leg[idx-1] (undefined for idx=0).
                  const legIndex = result.home ? idx : idx - 1;
                  const leg =
                    legIndex >= 0 ? result.directions[legIndex] : undefined;
                  const isLast = idx === result.meetings.length - 1;

                  return (
                    <div key={meeting.id}>
                      {/* Driving leg connector */}
                      {leg && (
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center w-8 shrink-0">
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="py-1 flex items-center gap-1.5">
                            <Navigation className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {formatDistance(leg.distanceMeters)} ·{" "}
                              {formatDuration(leg.durationSeconds)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Meeting stop */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">
                            {idx + 1}
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />
                          )}
                        </div>
                        <div className="pb-4 pt-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {meeting.companyName ?? `Meeting ${idx + 1}`}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(meeting.scheduledStartTime)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {meeting.durationMinutes} min
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {meeting.address}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Open in Google Maps */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={openInGoogleMaps}
                className="gap-1.5"
                data-testid="button-open-maps"
              >
                <MapPin className="w-3.5 h-3.5" />
                Open in Google Maps
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
