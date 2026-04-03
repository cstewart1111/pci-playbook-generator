import { useState } from "react";
import { useSearch } from "wouter";
import {
  useListPlaybooks,
  useAnalyzeEmails,
  getGetPlaybookQueryKey,
  getListPlaybooksQueryKey,
} from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react";
import { parseSearch } from "@/lib/query-params";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Trash2,
  Plus,
  CheckCircle2,
} from "lucide-react";

const JOB_TITLE_GROUPS = [
  {
    label: "President / Executive",
    titles: ["President / CEO", "Executive Director", "Chancellor", "Provost"],
  },
  {
    label: "Vice President",
    titles: ["VP of Advancement", "VP of Development", "VP of Alumni Relations", "VP of Marketing", "VP of Enrollment", "VP of Communications"],
  },
  {
    label: "Director",
    titles: ["Director of Advancement", "Director of Development", "Director of Alumni Relations", "Director of Marketing", "Director of Communications", "Director of Enrollment", "Director of Operations", "Director of Annual Giving"],
  },
  {
    label: "Assistant / Associate Director",
    titles: ["Associate VP of Advancement", "Assistant Director of Advancement", "Assistant Director of Development", "Assistant Director of Alumni Relations", "Associate Director of Annual Giving"],
  },
  {
    label: "Military / VFW / American Legion",
    titles: ["Post Commander", "State Commander", "Department Commander", "District Commander", "National Officer", "Post Adjutant", "State Adjutant", "Department Adjutant", "Post Quartermaster", "Department Quartermaster", "Service Officer", "Membership Chair", "Department Membership Director", "Auxiliary President", "Post Chaplain"],
  },
  { label: "Other", titles: ["Other"] },
];

const EMAIL_TYPES = [
  { value: "cold_email", label: "Cold Email" },
  { value: "bda_email", label: "BDA Email" },
  { value: "ae_email", label: "AE Email" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "breakup", label: "Breakup" },
  { value: "other", label: "Other" },
];

interface EmailEntry {
  name: string;
  jobTitle: string;
  emailType: string;
  content: string;
}

export default function IntelHub() {
  const search = useSearch();
  const defaultPlaybook = parseSearch(search).get("playbook") ?? "";

  const [emails, setEmails] = useState<EmailEntry[]>([{ name: "", jobTitle: "", emailType: "cold_email", content: "" }]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>(defaultPlaybook);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: playbooks } = useListPlaybooks();
  const analyzeEmails = useAnalyzeEmails({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        queryClient.invalidateQueries({ queryKey: getListPlaybooksQueryKey() });
        if (selectedPlaybook) {
          queryClient.invalidateQueries({ queryKey: getGetPlaybookQueryKey(Number(selectedPlaybook)) });
        }
        toast({ title: "Analysis complete", description: `Extracted ${data.patterns.length} patterns` });
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Check that your emails are pasted correctly.", variant: "destructive" });
      },
    },
  });

  const addEmail = () => setEmails((prev) => [...prev, { name: "", jobTitle: "", emailType: "cold_email", content: "" }]);
  const removeEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, field: keyof EmailEntry, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const handleAnalyze = () => {
    if (!selectedPlaybook) {
      toast({ title: "Select a playbook first", variant: "destructive" });
      return;
    }
    const filled = emails.filter((e) => e.content.trim());
    if (filled.length === 0) {
      toast({ title: "Paste at least one email", variant: "destructive" });
      return;
    }
    setResult(null);
    const emailStrings = filled.map((e) => {
      const meta = [
        e.name.trim() ? `From: ${e.name.trim()}` : "",
        e.jobTitle.trim() ? `Job Title: ${e.jobTitle.trim()}` : "",
        e.emailType ? `Type: ${EMAIL_TYPES.find((t) => t.value === e.emailType)?.label ?? e.emailType}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      return meta ? `[${meta}]\n${e.content.trim()}` : e.content.trim();
    });
    analyzeEmails.mutate({ id: Number(selectedPlaybook), data: { emails: emailStrings } });
  };

  return (
    <div>
      <PageHeader
        title="Email Analyzer"
        description="Paste winning emails to extract patterns and train AI on your style"
      />

      <div className="p-6 space-y-5 max-w-4xl">
        <div className="space-y-1.5">
          <Label htmlFor="select-playbook">Target Playbook</Label>
          <Select value={selectedPlaybook} onValueChange={setSelectedPlaybook}>
            <SelectTrigger id="select-playbook" data-testid="select-playbook" className="max-w-sm">
              <SelectValue placeholder="Select a playbook..." />
            </SelectTrigger>
            <SelectContent>
              {playbooks?.map((pb) => (
                <SelectItem key={pb.id} value={String(pb.id)} data-testid={`option-playbook-${pb.id}`}>
                  {pb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!playbooks || playbooks.length === 0) && (
            <p className="text-xs text-muted-foreground">No playbooks yet -- create one on the Playbooks page first.</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Emails to analyze ({emails.filter((e) => e.content.trim()).length} filled)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addEmail}
              data-testid="button-add-email"
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Email
            </Button>
          </div>
          {emails.map((email, i) => (
            <Card key={i} className="relative">
              <CardContent className="p-4 space-y-3">
                {emails.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeEmail(i)}
                    data-testid={`button-remove-email-${i}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <Input
                      value={email.name}
                      onChange={(e) => updateEmail(i, "name", e.target.value)}
                      placeholder="Sender name"
                      data-testid={`input-email-name-${i}`}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Job Title</label>
                    <Select value={email.jobTitle} onValueChange={(val) => updateEmail(i, "jobTitle", val)}>
                      <SelectTrigger data-testid={`select-email-job-title-${i}`} className="text-sm">
                        <SelectValue placeholder="Select job title..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
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
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Email Type</label>
                    <Select value={email.emailType} onValueChange={(val) => updateEmail(i, "emailType", val)}>
                      <SelectTrigger data-testid={`select-email-type-${i}`} className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_TYPES.map((et) => (
                          <SelectItem key={et.value} value={et.value}>
                            {et.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  value={email.content}
                  onChange={(e) => updateEmail(i, "content", e.target.value)}
                  placeholder={`Paste email #${i + 1} here (subject + body)...`}
                  rows={5}
                  data-testid={`input-email-${i}`}
                  className="font-mono text-xs resize-y"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={analyzeEmails.isPending}
          data-testid="button-analyze"
          className="w-full sm:w-auto"
        >
          {analyzeEmails.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing with AI...
            </>
          ) : (
            "Analyze Emails"
          )}
        </Button>

        {result && (
          <Card className="border-primary/30">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Analysis Complete
                <Badge variant="secondary" className="ml-auto text-xs">
                  Score: {result.qualityScore}/10
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4" data-testid="section-analysis-results">
              {result.principles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Principles</p>
                  <ul className="space-y-1">
                    {result.principles.map((p, i) => (
                      <li key={i} data-testid={`text-result-principle-${i}`} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">&#10003;</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.patterns.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Patterns Extracted ({result.patterns.length})
                  </p>
                  <div className="space-y-2">
                    {result.patterns.map((pattern, i) => (
                      <div key={i} data-testid={`card-result-pattern-${i}`} className="border border-border rounded-sm p-2.5">
                        <Badge variant="outline" className="text-xs capitalize mb-1">{pattern.type}</Badge>
                        <p className="text-sm text-foreground">{pattern.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
