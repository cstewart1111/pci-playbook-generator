import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useListPlaybooks, useGenerateScript } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";

type ScriptMode = "single" | "variations";

const STAGE_LABELS = [
  "Cold Outreach",
  "Discovery / Qualification",
  "Proposal / Evaluation",
  "Negotiation / Decision",
  "Re-engagement / Stalled Deal",
];

const JOB_TITLES = [
  // Higher Ed / Nonprofit
  "President / CEO",
  "Executive Director",
  "VP of Advancement",
  "Director of Advancement",
  "VP of Development",
  "Director of Development",
  "VP of Alumni Relations",
  "Director of Alumni Relations",
  "VP of Marketing",
  "Director of Marketing",
  "Director of Communications",
  "VP of Enrollment",
  "Director of Enrollment",
  "Director of Operations",
  // Military / VFW / American Legion
  "Post Commander",
  "State Commander",
  "Department Commander",
  "Post Adjutant",
  "State Adjutant",
  "Department Adjutant",
  "Post Quartermaster",
  "Department Quartermaster",
  "Service Officer",
  "Membership Chair",
  "Department Membership Director",
  "Auxiliary President",
  "District Commander",
  "National Officer",
  "Post Chaplain",
  // General
  "Other",
];

const PRODUCT_TYPES = [
  "Pipeline Discovery",
  "Oral History",
  "Census & Directory",
  "Storycause/DXO",
];

const SCRIPT_TYPES = [
  { value: "cold_call", label: "Cold Call (First Touch)" },
  { value: "warm_call", label: "Warm Call (Replied / Opened)" },
  { value: "follow_up", label: "Follow-Up (After Voicemail / Email)" },
  { value: "gatekeeper", label: "Gatekeeper / Front Desk" },
  { value: "voicemail", label: "Voicemail Drop" },
  { value: "referral", label: "Referral / Intro Call" },
  { value: "event_follow_up", label: "Event / Conference Follow-Up" },
  { value: "re_engagement", label: "Re-engagement (Went Dark)" },
  { value: "set_meeting", label: "Set the Meeting (Book Zoom / Onsite)" },
];

export default function ScriptBuilder() {
  const { toast } = useToast();
  const { data: playbooks } = useListPlaybooks();

  // Script mode
  const [scriptMode, setScriptMode] = useState<ScriptMode>("variations");

  // Form fields
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [productType, setProductType] = useState("");
  const [scriptType, setScriptType] = useState("cold_call");
  const [playbookId, setPlaybookId] = useState("");

  // Single script fields
  const [objective, setObjective] = useState("");

  // Shared
  const [additionalContext, setAdditionalContext] = useState("");
  const [notes, setNotes] = useState("");

  // Output
  const [output, setOutput] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeVariation, setActiveVariation] = useState(0);

  const apiBase = getApiBaseUrl();
  const searchString = useSearch();

  // Single script generation via the typed hook
  const generateSingleScript = useGenerateScript({
    mutation: {
      onSuccess: (data) => {
        setOutput(data.output);
        setGenerationId(data.generationId);
        setGenerating(false);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
        setGenerating(false);
      },
    },
  });

  // Auto-load from query params (when navigating from company/contact detail)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const name = params.get("name");
    const companyParam = params.get("company");
    const role = params.get("role");
    const notesParam = params.get("notes");

    if (!name && !companyParam) return;

    if (name) setContactName(name);
    if (companyParam) setCompany(companyParam);
    if (role) setJobTitle(role);
    if (notesParam) {
      try {
        const parsed = JSON.parse(notesParam);
        if (Array.isArray(parsed)) {
          setNotes(parsed.join("\n---\n"));
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [searchString]);

  const handleGenerate = async () => {
    if (!contactName && !company) {
      toast({
        title: "Missing info",
        description: "Please provide a contact name or company.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setOutput(null);
    setGenerationId(null);
    setActiveVariation(0);

    const selectedProduct = productType && productType !== "none" ? productType : "";
    const selectedScript = SCRIPT_TYPES.find(s => s.value === scriptType)?.label ?? scriptType;
    const resolvedPlaybookId = playbookId && playbookId !== "none" ? Number(playbookId) : null;

    if (scriptMode === "single") {
      const contextParts: string[] = [];
      if (contactName) contextParts.push(`Contact: ${contactName}`);
      if (company) contextParts.push(`Company: ${company}`);
      if (jobTitle && jobTitle !== "none") contextParts.push(`Job Title: ${jobTitle}`);
      if (selectedProduct) contextParts.push(`Product Type: ${selectedProduct}`);
      contextParts.push(`Script Type: ${selectedScript}`);
      if (notes.trim()) contextParts.push(`Notes: ${notes.trim()}`);
      if (additionalContext.trim()) contextParts.push(additionalContext.trim());

      generateSingleScript.mutate({
        data: {
          objective: objective || `${selectedScript} with ${contactName || company}`,
          context: contextParts.join(". "),
          playbookId: resolvedPlaybookId,
        },
      });
    } else {
      try {
        const resp = await fetch(`${apiBase}/generations/script-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName,
            company,
            role: jobTitle && jobTitle !== "none" ? jobTitle : "",
            productType: selectedProduct,
            scriptType: selectedScript,
            notes: notes.trim() ? [notes.trim()] : [],
            context: additionalContext || undefined,
            playbookId: resolvedPlaybookId ?? undefined,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Generation failed");
        setOutput(data.output);
        setGenerationId(data.generationId ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Please try again.";
        toast({ title: "Generation failed", description: message, variant: "destructive" });
      } finally {
        setGenerating(false);
      }
    }
  };

  // Split output into 5 variations
  const parseVariations = (text: string): string[] => {
    const parts = text.split(/===\s*VARIATION\s+\d+[^=]*===/).filter((s) => s.trim());
    if (parts.length >= 5) return parts.slice(0, 5);
    return [text];
  };

  const variations = output ? parseVariations(output) : [];

  return (
    <div>
      <PageHeader
        title="Script Builder"
        description="Generate personalized call scripts trained on your playbook and knowledge base"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        {/* Script Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={scriptMode === "single" ? "default" : "outline"}
            size="sm"
            onClick={() => setScriptMode("single")}
          >
            Quick Script
          </Button>
          <Button
            variant={scriptMode === "variations" ? "default" : "outline"}
            size="sm"
            onClick={() => setScriptMode("variations")}
          >
            Full Playbook (5 Variations)
          </Button>
        </div>

        {/* Main Form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Row 1: Contact Name + Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Contact Name</Label>
                <Input
                  placeholder="e.g. John Smith"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Company</Label>
                <Input
                  placeholder="e.g. University of Texas"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  data-testid="input-company"
                />
              </div>
            </div>

            {/* Row 2: Job Title + Script Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Job Title</Label>
                <Select value={jobTitle} onValueChange={setJobTitle}>
                  <SelectTrigger data-testid="select-job-title">
                    <SelectValue placeholder="Select job title..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {JOB_TITLES.map((jt) => (
                      <SelectItem key={jt} value={jt}>
                        {jt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Script Type</Label>
                <Select value={scriptType} onValueChange={setScriptType}>
                  <SelectTrigger data-testid="select-script-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRIPT_TYPES.map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Product Type + Playbook */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Product Type</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {PRODUCT_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Playbook</Label>
                <Select value={playbookId} onValueChange={setPlaybookId}>
                  <SelectTrigger data-testid="select-playbook">
                    <SelectValue placeholder="No playbook" />
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
            </div>

            {/* Objective (quick script only) */}
            {scriptMode === "single" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Call Objective</Label>
                <Textarea
                  placeholder="e.g. Book a discovery call to understand their alumni engagement challenges"
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  data-testid="input-objective"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Notes <span className="text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Paste any call notes, meeting summaries, or background info about the prospect..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </div>

            {/* Additional Context */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Additional Context <span className="text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Trigger events, specific goals, industry trends, anything else to shape the script..."
                rows={2}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                data-testid="input-context"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || generateSingleScript.isPending}
              className="w-full"
              data-testid="button-generate-script"
            >
              {generating || generateSingleScript.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {scriptMode === "single" ? "Generating Script..." : "Generating 5 Script Variations..."}
                </>
              ) : scriptMode === "single" ? (
                "Generate Script"
              ) : (
                "Generate 5 Script Variations"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output: Tabbed Variations */}
        {output && scriptMode === "variations" && variations.length > 1 && (
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
              generationId={generationId ?? undefined}
            />
          </div>
        )}

        {/* Single script output or fallback */}
        {output && (scriptMode === "single" || variations.length === 1) && !(scriptMode === "variations" && variations.length > 1) && (
          <OutputBox
            content={output}
            label="Generated Script"
            generationId={generationId ?? undefined}
            data-testid="section-script-output"
          />
        )}
      </div>
    </div>
  );
}
