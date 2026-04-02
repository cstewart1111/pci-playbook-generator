import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetPlaybook, getGetPlaybookQueryKey, useUpdatePlaybook } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Tag, Target, Pencil, Save, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function BackButton() {
  const [, navigate] = useLocation();
  return (
    <Button variant="outline" size="sm" onClick={() => navigate("/playbooks")} data-testid="button-back-playbooks">
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back
    </Button>
  );
}

function ActionButtons({ playbookId }: { playbookId: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/intel-hub?tab=analyze&playbook=${playbookId}`)}
        data-testid="button-import-to-playbook"
      >
        Import More Emails
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/generate-email?playbook=${playbookId}`)}
        data-testid="button-generate-from-playbook"
      >
        Generate Email
      </Button>
    </div>
  );
}

const patternTypeColors: Record<string, string> = {
  opening: "bg-blue-100 text-blue-700",
  subject: "bg-purple-100 text-purple-700",
  hook: "bg-orange-100 text-orange-700",
  value: "bg-green-100 text-green-700",
  cta: "bg-red-100 text-red-700",
  closing: "bg-yellow-100 text-yellow-700",
};

function TagListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="text-sm h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addTag} className="h-8 px-2 text-xs">
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function IcpProfile({ playbookId, playbook }: { playbookId: number; playbook: any }) {
  const [editing, setEditing] = useState(false);
  const [verticals, setVerticals] = useState<string[]>(playbook.icpVerticals || []);
  const [personas, setPersonas] = useState<string[]>(playbook.icpPersonas || []);
  const [painPoints, setPainPoints] = useState<string[]>(playbook.icpPainPoints || []);
  const [differentiators, setDifferentiators] = useState<string[]>(playbook.icpDifferentiators || []);
  const [proofPoints, setProofPoints] = useState<string[]>(playbook.icpProofPoints || []);
  const [companySize, setCompanySize] = useState(playbook.icpCompanySize || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePlaybook = useUpdatePlaybook({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlaybookQueryKey(playbookId) });
        setEditing(false);
        toast({ title: "ICP Profile saved" });
      },
      onError: () => {
        toast({ title: "Failed to save", variant: "destructive" });
      },
    },
  });

  const hasIcp = verticals.length > 0 || personas.length > 0 || painPoints.length > 0 ||
    differentiators.length > 0 || proofPoints.length > 0 || companySize;

  const handleSave = () => {
    updatePlaybook.mutate({
      id: playbookId,
      data: {
        icpVerticals: verticals,
        icpPersonas: personas,
        icpPainPoints: painPoints,
        icpDifferentiators: differentiators,
        icpProofPoints: proofPoints,
        icpCompanySize: companySize || undefined,
      },
    });
  };

  const handleCancel = () => {
    setVerticals(playbook.icpVerticals || []);
    setPersonas(playbook.icpPersonas || []);
    setPainPoints(playbook.icpPainPoints || []);
    setDifferentiators(playbook.icpDifferentiators || []);
    setProofPoints(playbook.icpProofPoints || []);
    setCompanySize(playbook.icpCompanySize || "");
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Ideal Customer Profile (ICP)
          </CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 px-2 text-xs gap-1">
              <Pencil className="w-3 h-3" />
              {hasIcp ? "Edit" : "Set Up"}
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 px-2 text-xs gap-1">
                <X className="w-3 h-3" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updatePlaybook.isPending} className="h-7 px-2 text-xs gap-1">
                <Save className="w-3 h-3" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <div className="space-y-3">
            <TagListEditor label="Target Verticals" values={verticals} onChange={setVerticals} placeholder="e.g. Healthcare, Financial Services" />
            <TagListEditor label="Target Personas" values={personas} onChange={setPersonas} placeholder="e.g. VP of Sales, CRO, Revenue Leader" />
            <TagListEditor label="Key Pain Points" values={painPoints} onChange={setPainPoints} placeholder="e.g. Pipeline visibility, Forecast accuracy" />
            <TagListEditor label="Our Differentiators" values={differentiators} onChange={setDifferentiators} placeholder="e.g. Real-time analytics, 3x faster onboarding" />
            <TagListEditor label="Proof Points" values={proofPoints} onChange={setProofPoints} placeholder="e.g. 40% increase in pipeline for Acme Corp" />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ideal Company Size</label>
              <Input
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="e.g. 200-2000 employees, $50M-$500M revenue"
                className="text-sm h-8"
              />
            </div>
          </div>
        ) : hasIcp ? (
          <div className="space-y-2">
            {verticals.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Verticals</p>
                <div className="flex flex-wrap gap-1">{verticals.map((v, i) => <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>)}</div>
              </div>
            )}
            {personas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Personas</p>
                <div className="flex flex-wrap gap-1">{personas.map((v, i) => <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>)}</div>
              </div>
            )}
            {painPoints.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Pain Points</p>
                <div className="flex flex-wrap gap-1">{painPoints.map((v, i) => <Badge key={i} variant="outline" className="text-xs">{v}</Badge>)}</div>
              </div>
            )}
            {differentiators.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Differentiators</p>
                <div className="flex flex-wrap gap-1">{differentiators.map((v, i) => <Badge key={i} className="text-xs bg-green-100 text-green-700">{v}</Badge>)}</div>
              </div>
            )}
            {proofPoints.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Proof Points</p>
                <div className="flex flex-wrap gap-1">{proofPoints.map((v, i) => <Badge key={i} className="text-xs bg-blue-100 text-blue-700">{v}</Badge>)}</div>
              </div>
            )}
            {companySize && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Company Size</p>
                <p className="text-sm">{companySize}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No ICP defined yet. Click "Set Up" to add target verticals, personas, pain points, and differentiators.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlaybookDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: playbook, isLoading, isError } = useGetPlaybook(id, {
    query: { enabled: !!id, queryKey: getGetPlaybookQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div>
        <div className="px-6 py-5 border-b border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !playbook) {
    return (
      <div>
        <PageHeader title="Playbook Not Found" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground" data-testid="text-not-found">Playbook not found or failed to load.</p>
          <Link href="/playbooks" className="text-sm text-primary hover:underline mt-2 inline-block" data-testid="link-back-to-playbooks">
            ← Back to Playbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={playbook.name}
        description={playbook.description}
        actions={
          <BackButton />
        }
      />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="flex items-center gap-4 flex-wrap">
          <div
            data-testid="text-email-count"
            className="text-sm text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{playbook.emailCount}</span> emails analyzed
          </div>
          {playbook.qualityScore != null && (
            <div
              data-testid="text-quality-score"
              className="flex items-center gap-1 text-sm"
            >
              <span className="font-semibold text-primary text-base">{playbook.qualityScore}</span>
              <span className="text-muted-foreground">/ 10 quality score</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Updated {formatDistanceToNow(new Date(playbook.updatedAt), { addSuffix: true })}
          </div>
        </div>

        {/* Principles */}
        {playbook.principles && playbook.principles.length > 0 && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Core Principles
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="space-y-2" data-testid="list-principles">
                {playbook.principles.map((p, i) => (
                  <li
                    key={i}
                    data-testid={`text-principle-${i}`}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5 shrink-0">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ICP Profile */}
        <IcpProfile playbookId={playbook.id} playbook={playbook} />

        {/* Patterns */}
        {playbook.patterns && playbook.patterns.length > 0 ? (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Extracted Patterns ({playbook.patterns.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3" data-testid="list-patterns">
                {playbook.patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    data-testid={`card-pattern-${pattern.id}`}
                    className="border border-border rounded-sm p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize ${patternTypeColors[pattern.type] ?? ""}`}
                      >
                        {pattern.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground font-medium">{pattern.text}</p>
                    {pattern.examples && pattern.examples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Examples:</p>
                        {pattern.examples.map((ex, i) => (
                          <p
                            key={i}
                            data-testid={`text-example-${pattern.id}-${i}`}
                            className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2"
                          >
                            {ex}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center" data-testid="text-no-patterns">
              <p className="text-sm text-muted-foreground">No patterns extracted yet.</p>
              <Link href="/intel-hub?tab=analyze" className="text-sm text-primary hover:underline mt-1 inline-block" data-testid="link-import-emails">
                Import emails to extract patterns →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <ActionButtons playbookId={playbook.id} />
      </div>
    </div>
  );
}
