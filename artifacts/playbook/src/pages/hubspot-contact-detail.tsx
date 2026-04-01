import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutputBox } from "@/components/output-box";
import {
  User, Mail, Building2, ChevronLeft, Loader2, Sparkles, Calendar, Phone, Tag
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListPlaybooks } from "@workspace/api-client-react";

interface EmailProp { hs_email_subject?: string; hs_email_text?: string; hs_email_direction?: string; hs_timestamp?: string }

async function fetchContactDetail(id: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/hubspot/contacts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch contact");
  return res.json();
}

async function fetchContactEmails(id: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/hubspot/contacts/${id}/emails`);
  if (!res.ok) throw new Error("Failed to fetch emails");
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

function lifecycleLabel(stage?: string) {
  const map: Record<string, string> = {
    subscriber: "Subscriber",
    lead: "Lead",
    marketingqualifiedlead: "MQL",
    salesqualifiedlead: "SQL",
    opportunity: "Opportunity",
    customer: "Customer",
    evangelist: "Evangelist",
    other: "Other",
  };
  return stage ? (map[stage.toLowerCase()] ?? stage) : null;
}

export default function HubSpotContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [summary, setSummary] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState("none");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const { data: playbooks } = useListPlaybooks();

  const { data: detail, isLoading: loadingDetail, error: detailError } = useQuery({
    queryKey: ["hubspot-contact", id],
    queryFn: () => fetchContactDetail(id!),
    enabled: !!id,
  });

  const { data: emailsData, isLoading: loadingEmails } = useQuery({
    queryKey: ["hubspot-contact-emails", id],
    queryFn: () => fetchContactEmails(id!),
    enabled: !!id,
  });

  const summarize = useMutation({
    mutationFn: async () => {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/hubspot/contacts/${id}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: detail?.contact,
          companies: detail?.companies,
          emails: emailsData?.results ?? [],
          playbookContext: selectedPlaybook !== "none" ? `Playbook ID: ${selectedPlaybook}` : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      return res.json();
    },
    onSuccess: (data) => setSummary(data.summary),
    onError: () => toast({ title: "Summary failed", description: "Please try again.", variant: "destructive" }),
  });

  const contact = detail?.contact?.properties;
  const companies: Array<{ id: string; properties: { name?: string; industry?: string } }> = detail?.companies ?? [];
  const emails: Array<{ id: string; properties: EmailProp }> = emailsData?.results ?? [];

  const fullName = [contact?.firstname, contact?.lastname].filter(Boolean).join(" ") || "Contact";

  if (loadingDetail) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading contact...
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hubspot/contacts")} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <p className="text-destructive">Failed to load contact. Check your HubSpot connection.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={fullName}
        description={[contact?.jobtitle, contact?.company].filter(Boolean).join(" at ")}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/hubspot/contacts")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> All Contacts
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-7xl">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-primary truncate">{contact.email}</a>
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {contact.phone}
                </div>
              )}
              {contact?.lifecyclestage && (
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {lifecycleLabel(contact.lifecyclestage)}
                  </span>
                </div>
              )}
              {contact?.hs_lead_status && (
                <div className="text-xs text-muted-foreground">Status: {contact.hs_lead_status}</div>
              )}
              {contact?.createdate && (
                <div className="text-xs text-muted-foreground">
                  Created: {formatDate(contact.createdate)}
                </div>
              )}
            </CardContent>
          </Card>

          {companies.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Companies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-accent/20 cursor-pointer hover:bg-accent/40 transition-colors"
                    onClick={() => navigate(`/hubspot/companies/${c.id}`)}
                    data-testid={`company-link-${c.id}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.properties.name ?? "Unknown"}</p>
                      {c.properties.industry && (
                        <p className="text-xs text-muted-foreground">{c.properties.industry}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Contact Summary
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
                data-testid="button-generate-contact-summary"
                onClick={() => summarize.mutate()}
                disabled={summarize.isPending || loadingEmails}
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
              label="Contact Summary"
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
                <p className="text-sm text-muted-foreground">No emails found for this contact.</p>
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
        </div>
      </div>
    </div>
  );
}
