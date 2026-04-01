import { useState } from "react";
import { useSearch } from "wouter";
import {
  useListPlaybooks,
  useAnalyzeEmails,
  getGetPlaybookQueryKey,
  getListPlaybooksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import type { AnalysisResult } from "@workspace/api-client-react";

function parseQueryString(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  const q = search.startsWith("?") ? search.slice(1) : search;
  q.split("&").forEach((part) => {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  });
  return params;
}

export default function Import() {
  const search = useSearch();
  const queryParams = parseQueryString(search);
  const defaultPlaybook = queryParams.playbook ?? "";

  const [emails, setEmails] = useState<string[]>([""]);
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

  const addEmail = () => setEmails((prev) => [...prev, ""]);
  const removeEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? val : e)));

  const handleAnalyze = () => {
    if (!selectedPlaybook) {
      toast({ title: "Select a playbook first", variant: "destructive" });
      return;
    }
    const filled = emails.filter((e) => e.trim());
    if (filled.length === 0) {
      toast({ title: "Paste at least one email", variant: "destructive" });
      return;
    }
    setResult(null);
    analyzeEmails.mutate({ id: Number(selectedPlaybook), data: { emails: filled } });
  };

  return (
    <div>
      <PageHeader
        title="Import & Analyze"
        description="Paste winning emails to extract patterns into a playbook"
      />

      <div className="p-6 space-y-5 max-w-3xl">
        {/* Playbook selector */}
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
            <p className="text-xs text-muted-foreground">No playbooks yet — create one on the Playbooks page first.</p>
          )}
        </div>

        {/* Email inputs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Emails to analyze ({emails.filter((e) => e.trim()).length} filled)</Label>
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
            <div key={i} className="relative group">
              <Textarea
                value={email}
                onChange={(e) => updateEmail(i, e.target.value)}
                placeholder={`Paste email #${i + 1} here (subject + body)...`}
                rows={5}
                data-testid={`input-email-${i}`}
                className="font-mono text-xs resize-y pr-8"
              />
              {emails.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => removeEmail(i)}
                  data-testid={`button-remove-email-${i}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
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

        {/* Results */}
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
                        <span className="text-primary mt-0.5">✓</span>
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
