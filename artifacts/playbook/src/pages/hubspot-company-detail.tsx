import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutputBox } from "@/components/output-box";
import {
  Building2, Mail, FileText, Users, Globe, ChevronLeft,
  Loader2, Sparkles, Calendar, ExternalLink
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListPlaybooks } from "@workspace/api-client-react";

interface ContactProp { firstname?: string; lastname?: string; jobtitle?: string; email?: string }
interface EmailProp { hs_email_subject?: string; hs_email_text?: string; hs_email_direction?: string; hs_timestamp?: string }
interface NoteProp { hs_note_body?: string; hs_timestamp?: string }

async function fetchCompanyDetail(id: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/hubspot/companies/${id}`);
  if (!res.ok) throw new Error("Failed to fetch company");
  return res.json();
}

async function fetchCompanyEmails(id: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/hubspot/companies/${id}/emails`);
  if (!res.ok) throw new Error("Failed to fetch emails");
  return res.json();
}

async function fetchCompanyNotes(id: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/hubspot/companies/${id}/notes`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

function formatDate(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function directionLabel(dir?: string) {
  if (!dir) return "Email";
  if (dir.includes("INCOMING")) return "Inbound";
  if (dir.includes("FORWARDED")) return "Forwarded";
  return "Outbound";
}

export default function HubSpotCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState("none");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const { data: playbooks } = useListPlaybooks();

  const { data: detail, isLoading: loadingDetail, error: detailError } = useQuery({
    queryKey: ["hubspot-company", id],
    queryFn: () => fetchCompanyDetail(id!),
    enabled: !!id,
  });

  const { data: emailsData, isLoading: loadingEmails } = useQuery({
    queryKey: ["hubspot-company-emails", id],
    queryFn: () => fetchCompanyEmails(id!),
    enabled: !!id,
  });

  const { data: notesData, isLoading: loadingNotes } = useQuery({
    queryKey: ["hubspot-company-notes", id],
    queryFn: () => fetchCompanyNotes(id!),
    enabled: !!id,
  });

  const summarize = useMutation({
    mutationFn: async () => {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/hubspot/companies/${id}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: detail?.company,
          contacts: detail?.contacts,
          emails: emailsData?.results ?? [],
          notes: notesData?.results ?? [],
          playbookContext: selectedPlaybook !== "none" ? `Playbook ID: ${selectedPlaybook}` : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      return res.json();
    },
    onSuccess: (data) => setSummary(data.summary),
    onError: () => toast({ title: "Summary failed", description: "Please try again.", variant: "destructive" }),
  });

  const company = detail?.company?.properties;
  const contacts: Array<{ id: string; properties: ContactProp }> = detail?.contacts ?? [];
  const emails: Array<{ id: string; properties: EmailProp }> = emailsData?.results ?? [];
  const notes: Array<{ id: string; properties: NoteProp }> = notesData?.results ?? [];

  if (loadingDetail) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading account...
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hubspot/companies")} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <p className="text-destructive">Failed to load company. Check your HubSpot connection.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={company?.name ?? "Account Detail"}
        description={[company?.industry, company?.city, company?.country].filter(Boolean).join(" · ")}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/hubspot/companies")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> All Accounts
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-7xl">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company?.domain && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary flex items-center gap-1"
                  >
                    {company.domain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {company?.numberofemployees && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {Number(company.numberofemployees).toLocaleString()} employees
                </div>
              )}
              {company?.annualrevenue && (
                <div className="text-muted-foreground">
                  Revenue: ${Number(company.annualrevenue).toLocaleString()}
                </div>
              )}
              {company?.description && (
                <p className="text-muted-foreground text-xs mt-2 border-t border-border pt-2 leading-relaxed">
                  {company.description.slice(0, 200)}{company.description.length > 200 ? "..." : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Contacts ({contacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">No contacts linked</p>
              )}
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-accent/20 cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => navigate(`/hubspot/contacts/${c.id}`)}
                  data-testid={`contact-link-${c.id}`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                    {(c.properties.firstname?.[0] ?? c.properties.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {[c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.properties.jobtitle ?? c.properties.email}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Account Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Playbook (optional)</label>
                <Select value={selectedPlaybook} onValueChange={setSelectedPlaybook}>
                  <SelectTrigger data-testid="select-summary-playbook" className="h-8 text-xs">
                    <SelectValue placeholder="No playbook" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No playbook</SelectItem>
                    {playbooks?.map((pb) => (
                      <SelectItem key={pb.id} value={String(pb.id)}>{pb.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                size="sm"
                data-testid="button-generate-account-summary"
                onClick={() => summarize.mutate()}
                disabled={summarize.isPending || (loadingEmails || loadingNotes)}
              >
                {summarize.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-2" />Generate Summary</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {summary && (
            <OutputBox
              content={summary}
              label="Account Summary"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email History
                {loadingEmails && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {!loadingEmails && <span className="text-muted-foreground font-normal">({emails.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emails.length === 0 && !loadingEmails && (
                <p className="text-sm text-muted-foreground">No emails found for this account.</p>
              )}
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="border border-border rounded-md overflow-hidden"
                    data-testid={`email-row-${email.id}`}
                  >
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent/20 transition-colors"
                      onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          directionLabel(email.properties.hs_email_direction) === "Inbound"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}>
                          {directionLabel(email.properties.hs_email_direction)}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {email.properties.hs_email_subject ?? "(no subject)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
                        <Calendar className="w-3 h-3" />
                        {formatDate(email.properties.hs_timestamp)}
                      </div>
                    </button>
                    {expandedEmail === email.id && email.properties.hs_email_text && (
                      <div className="px-3 py-3 border-t border-border bg-muted/20">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {email.properties.hs_email_text.slice(0, 2000)}
                          {email.properties.hs_email_text.length > 2000 ? "\n\n[truncated...]" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Notes & Activity
                {loadingNotes && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {!loadingNotes && <span className="text-muted-foreground font-normal">({notes.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 && !loadingNotes && (
                <p className="text-sm text-muted-foreground">No notes found for this account.</p>
              )}
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3 p-3 rounded-md bg-muted/20 border border-border">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-xs text-muted-foreground mb-1">{formatDate(note.properties.hs_timestamp)}</p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {note.properties.hs_note_body ?? "(empty note)"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
