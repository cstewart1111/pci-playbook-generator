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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { OutputBox } from "@/components/output-box";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const JOB_TITLE_GROUPS = [
  {
    label: "President / Executive",
    titles: ["President / CEO", "Executive Director", "Chancellor", "Provost"],
  },
  {
    label: "Vice President",
    titles: [
      "VP of Advancement",
      "VP of Development",
      "VP of Alumni Relations",
      "VP of Marketing",
      "VP of Enrollment",
      "VP of Communications",
    ],
  },
  {
    label: "Director",
    titles: [
      "Director of Advancement",
      "Director of Development",
      "Director of Alumni Relations",
      "Director of Marketing",
      "Director of Communications",
      "Director of Enrollment",
      "Director of Operations",
      "Director of Annual Giving",
    ],
  },
  {
    label: "Assistant / Associate Director",
    titles: [
      "Associate VP of Advancement",
      "Assistant Director of Advancement",
      "Assistant Director of Development",
      "Assistant Director of Alumni Relations",
      "Associate Director of Annual Giving",
    ],
  },
  {
    label: "Military / VFW / American Legion",
    titles: [
      "Post Commander",
      "State Commander",
      "Department Commander",
      "District Commander",
      "National Officer",
      "Post Adjutant",
      "State Adjutant",
      "Department Adjutant",
      "Post Quartermaster",
      "Department Quartermaster",
      "Service Officer",
      "Membership Chair",
      "Department Membership Director",
      "Auxiliary President",
      "Post Chaplain",
    ],
  },
  {
    label: "Other",
    titles: ["Other"],
  },
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

  // Form fields
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [productType, setProductType] = useState("");
  const [scriptType, setScriptType] = useState("cold_call");
  const [playbookId, setPlaybookId] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [notes, setNotes] = useState("");

  // Output
  const [output, setOutput] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);

  const searchString = useSearch();

  const generateScript = useGenerateScript({
    mutation: {
      onSuccess: (data) => {
        setOutput(data.output);
        setGenerationId(data.generationId);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
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

  const handleGenerate = () => {
    if (!contactName && !company) {
      toast({
        title: "Missing info",
        description: "Please provide a contact name or company.",
        variant: "destructive",
      });
      return;
    }

    setOutput(null);
    setGenerationId(null);

    const selectedProduct = productType && productType !== "none" ? productType : "";
    const selectedScript = SCRIPT_TYPES.find(s => s.value === scriptType)?.label ?? scriptType;
    const resolvedPlaybookId = playbookId && playbookId !== "none" ? Number(playbookId) : null;

    const contextParts: string[] = [];
    if (contactName) contextParts.push(`Contact: ${contactName}`);
    if (company) contextParts.push(`Company: ${company}`);
    if (jobTitle && jobTitle !== "none") contextParts.push(`Job Title: ${jobTitle}`);
    if (selectedProduct) contextParts.push(`Product Type: ${selectedProduct}`);
    contextParts.push(`Script Type: ${selectedScript}`);
    if (notes.trim()) contextParts.push(`Notes: ${notes.trim()}`);
    if (additionalContext.trim()) contextParts.push(additionalContext.trim());

    generateScript.mutate({
      data: {
        objective: `${selectedScript} with ${contactName || company}`,
        context: contextParts.join(". "),
        playbookId: resolvedPlaybookId,
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Script Builder"
        description="Generate personalized call scripts trained on your playbook and knowledge base"
      />

      <div className="p-6 space-y-5 max-w-3xl">
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
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Not specified</SelectItem>
                    {JOB_TITLE_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 pt-2">
                          {group.label}
                        </SelectLabel>
                        {group.titles.map((title) => (
                          <SelectItem key={title} value={title}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
              disabled={generateScript.isPending}
              className="w-full"
              data-testid="button-generate-script"
            >
              {generateScript.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Script...
                </>
              ) : (
                "Generate Script"
              )}
            </Button>
          </CardContent>
        </Card>

        {output && (
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
