import { useState, useCallback } from "react";
import { useListPlaybooks } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { OutputBox } from "@/components/output-box";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import {
  Loader2,
  Search,
  Building2,
  User,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type SourceMode = "hubspot-contact" | "hubspot-company" | "manual";

interface HubSpotResult {
  id: string;
  properties: Record<string, string | null>;
}

interface NoteResult {
  id: string;
  properties: {
    hs_note_body?: string | null;
    hs_timestamp?: string | null;
  };
}

const STAGE_LABELS = [
  "Cold Outreach",
  "Discovery / Qualification",
  "Proposal / Evaluation",
  "Negotiation / Decision",
  "Re-engagement / Stalled Deal",
];

export default function ScriptBuilder() {
  const { toast } = useToast();
  const { data: playbooks } = useListPlaybooks();

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>("hubspot-contact");

  // HubSpot search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HubSpotResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HubSpotResult | null>(null);

  // Notes from HubSpot
  const [notes, setNotes] = useState<string[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Manual entry
  const [manualName, setManualName] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualRole, setManualRole] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  // Shared fields
  const [additionalContext, setAdditionalContext] = useState("");
  const [playbookId, setPlaybookId] = useState("");

  // Output
  const [output, setOutput] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeVariation, setActiveVariation] = useState(0);

  // Notes visibility
  const [showNotes, setShowNotes] = useState(false);

  const apiBase = getApiBaseUrl();

  const searchHubSpot = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const type = sourceMode === "hubspot-contact" ? "contacts" : "companies";
      const resp = await fetch(
        `${apiBase}/hubspot/${type}?search=${encodeURIComponent(searchQuery)}&limit=10`
      );
      const data = await resp.json();
      setSearchResults(data.results ?? []);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchQuery, sourceMode, apiBase, toast]);

  const selectRecord = useCallback(
    async (record: HubSpotResult) => {
      setSelectedRecord(record);
      setSearchResults([]);
      setSearchQuery("");
      setLoadingNotes(true);
      setNotes([]);

      try {
        const type = sourceMode === "hubspot-contact" ? "contacts" : "companies";
        const notesResp = await fetch(`${apiBase}/hubspot/${type}/${record.id}/notes`);
        const notesData = await notesResp.json();
        const noteTexts: string[] = (notesData.results ?? [])
          .map((n: NoteResult) => n.properties.hs_note_body)
          .filter(Boolean) as string[];
        setNotes(noteTexts);
        if (noteTexts.length > 0) setShowNotes(true);
      } catch {
        // Notes are optional, don't block
      } finally {
        setLoadingNotes(false);
      }
    },
    [sourceMode, apiBase]
  );

  const getSelectedName = (): string => {
    if (!selectedRecord) return "";
    const p = selectedRecord.properties;
    if (sourceMode === "hubspot-contact") {
      return [p.firstname, p.lastname].filter(Boolean).join(" ");
    }
    return p.name ?? "";
  };

  const getSelectedCompany = (): string => {
    if (!selectedRecord) return "";
    const p = selectedRecord.properties;
    if (sourceMode === "hubspot-company") return p.name ?? "";
    return p.company ?? "";
  };

  const getSelectedRole = (): string => {
    if (!selectedRecord) return "";
    return selectedRecord.properties.jobtitle ?? "";
  };

  const handleGenerate = async () => {
    const isManual = sourceMode === "manual";
    const name = isManual ? manualName : getSelectedName();
    const company = isManual ? manualCompany : getSelectedCompany();
    const role = isManual ? manualRole : getSelectedRole();
    const allNotes = isManual
      ? manualNotes.trim()
        ? [manualNotes.trim()]
        : []
      : notes;

    if (!name && !company) {
      toast({
        title: "Missing info",
        description: "Please provide a name or company.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setOutput(null);
    setActiveVariation(0);

    try {
      const resp = await fetch(`${apiBase}/generations/script-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          role,
          notes: allNotes,
          context: additionalContext || undefined,
          playbookId:
            playbookId && playbookId !== "none" ? Number(playbookId) : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.output);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Split output into 5 variations
  const parseVariations = (text: string): string[] => {
    const parts = text.split(/===\s*VARIATION\s+\d+[^=]*===/).filter((s) => s.trim());
    if (parts.length >= 5) return parts.slice(0, 5);
    // Fallback: return the whole text as one block
    return [text];
  };

  const variations = output ? parseVariations(output) : [];

  return (
    <div>
      <PageHeader
        title="Script Builder"
        description="Pull a contact or company from HubSpot, load their notes, and generate 5 call script variations for different deal stages"
      />

      <div className="p-6 space-y-5 max-w-4xl">
        {/* Source Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Data Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={sourceMode === "hubspot-contact" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceMode("hubspot-contact");
                  setSelectedRecord(null);
                  setNotes([]);
                  setSearchResults([]);
                }}
              >
                <User className="w-4 h-4 mr-1.5" />
                HubSpot Contact
              </Button>
              <Button
                variant={sourceMode === "hubspot-company" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceMode("hubspot-company");
                  setSelectedRecord(null);
                  setNotes([]);
                  setSearchResults([]);
                }}
              >
                <Building2 className="w-4 h-4 mr-1.5" />
                HubSpot Company
              </Button>
              <Button
                variant={sourceMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceMode("manual");
                  setSelectedRecord(null);
                  setNotes([]);
                  setSearchResults([]);
                }}
              >
                Manual Entry
              </Button>
            </div>

            {/* HubSpot Search */}
            {sourceMode !== "manual" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={
                      sourceMode === "hubspot-contact"
                        ? "Search contacts by name..."
                        : "Search companies by name..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchHubSpot()}
                  />
                  <Button
                    onClick={searchHubSpot}
                    disabled={searching || !searchQuery.trim()}
                    size="sm"
                    className="shrink-0"
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => selectRecord(r)}
                        className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors text-sm"
                      >
                        {sourceMode === "hubspot-contact" ? (
                          <div>
                            <span className="font-medium">
                              {[r.properties.firstname, r.properties.lastname]
                                .filter(Boolean)
                                .join(" ") || "Unknown"}
                            </span>
                            {r.properties.jobtitle && (
                              <span className="text-muted-foreground ml-2">
                                {r.properties.jobtitle}
                              </span>
                            )}
                            {r.properties.company && (
                              <span className="text-muted-foreground ml-2">
                                at {r.properties.company}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium">
                              {r.properties.name ?? "Unknown"}
                            </span>
                            {r.properties.industry && (
                              <span className="text-muted-foreground ml-2">
                                {r.properties.industry}
                              </span>
                            )}
                            {r.properties.domain && (
                              <span className="text-muted-foreground ml-2">
                                ({r.properties.domain})
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Record */}
                {selectedRecord && (
                  <div className="bg-accent/30 rounded-md p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sourceMode === "hubspot-contact" ? (
                          <User className="w-4 h-4 text-primary" />
                        ) : (
                          <Building2 className="w-4 h-4 text-primary" />
                        )}
                        <span className="font-medium text-sm">
                          {getSelectedName() || getSelectedCompany()}
                        </span>
                        {getSelectedRole() && (
                          <span className="text-muted-foreground text-sm">
                            - {getSelectedRole()}
                          </span>
                        )}
                        {sourceMode === "hubspot-contact" && getSelectedCompany() && (
                          <span className="text-muted-foreground text-sm">
                            at {getSelectedCompany()}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRecord(null);
                          setNotes([]);
                        }}
                        className="h-7 text-xs"
                      >
                        Clear
                      </Button>
                    </div>

                    {/* Notes Section */}
                    {loadingNotes && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading notes...
                      </div>
                    )}
                    {!loadingNotes && notes.length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => setShowNotes(!showNotes)}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <StickyNote className="w-3 h-3" />
                          {notes.length} note{notes.length !== 1 ? "s" : ""} found
                          {showNotes ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        {showNotes && (
                          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                            {notes.map((note, i) => (
                              <div
                                key={i}
                                className="text-xs text-muted-foreground bg-background rounded p-2 border"
                              >
                                {note.length > 300 ? note.slice(0, 300) + "..." : note}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!loadingNotes && notes.length === 0 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        No notes found for this record.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual Entry */}
            {sourceMode === "manual" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Contact name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Company</Label>
                    <Input
                      placeholder="Company name"
                      value={manualCompany}
                      onChange={(e) => setManualCompany(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Role / Title</Label>
                  <Input
                    placeholder="e.g. VP of Engineering"
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    placeholder="Paste any notes, call summaries, or background info..."
                    rows={4}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Context & Playbook */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs">Additional Context (optional)</Label>
              <Textarea
                placeholder="Any extra context: recent trigger events, specific goals, industry trends..."
                rows={3}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Playbook (optional)</Label>
              <Select value={playbookId} onValueChange={setPlaybookId}>
                <SelectTrigger>
                  <SelectValue placeholder="Use no playbook" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No playbook</SelectItem>
                  {playbooks?.map((pb) => (
                    <SelectItem key={pb.id} value={String(pb.id)}>
                      {pb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating 5 Script Variations...
                </>
              ) : (
                "Generate 5 Script Variations"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output: Tabbed Variations */}
        {output && variations.length > 1 && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STAGE_LABELS.map((label, i) => (
                <Button
                  key={i}
                  variant={activeVariation === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveVariation(i)}
                  className="text-xs"
                >
                  {i + 1}. {label}
                </Button>
              ))}
            </div>
            <OutputBox
              content={variations[activeVariation]?.trim() ?? ""}
              label={`Script - ${STAGE_LABELS[activeVariation]}`}
            />
          </div>
        )}

        {/* Fallback: single output if parsing failed */}
        {output && variations.length === 1 && (
          <OutputBox content={output} label="Generated Scripts" />
        )}
      </div>
    </div>
  );
}
