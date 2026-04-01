import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, ChevronRight, Loader2, Building2, Mail, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    jobtitle?: string;
    company?: string;
    phone?: string;
    hs_lastmodifieddate?: string;
  };
}

interface ContactsResponse {
  results?: HubSpotContact[];
  paging?: { next?: { after?: string } };
  error?: string;
}

interface ContactFilters {
  lifecyclestage: string;
  company: string;
  jobtitle: string;
  city: string;
}

const LIFECYCLE_STAGES = [
  { value: "", label: "Any stage" },
  { value: "subscriber", label: "Subscriber" },
  { value: "lead", label: "Lead" },
  { value: "marketingqualifiedlead", label: "MQL" },
  { value: "salesqualifiedlead", label: "SQL" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer", label: "Customer" },
  { value: "evangelist", label: "Evangelist" },
  { value: "other", label: "Other" },
];

async function fetchContacts(search: string, filters: ContactFilters): Promise<ContactsResponse> {
  const base = getApiBaseUrl();
  const hasFilters = filters.lifecyclestage || filters.company || filters.jobtitle || filters.city;

  if (hasFilters || search) {
    const res = await fetch(`${base}/hubspot/contacts/search/filtered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: search || undefined,
        lifecyclestage: filters.lifecyclestage || undefined,
        company: filters.company || undefined,
        jobtitle: filters.jobtitle || undefined,
        city: filters.city || undefined,
      }),
    });
    if (!res.ok) throw new Error("Failed to fetch contacts");
    return res.json();
  }

  const url = `${base}/hubspot/contacts?limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}

export default function HubSpotContacts() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ContactFilters>({ lifecyclestage: "", company: "", jobtitle: "", city: "" });
  const [activeFilters, setActiveFilters] = useState<ContactFilters>({ lifecyclestage: "", company: "", jobtitle: "", city: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["hubspot-contacts", searchQuery, activeFilters],
    queryFn: () => fetchContacts(searchQuery, activeFilters),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setActiveFilters({ ...filters });
  };

  const activeFilterCount = [activeFilters.lifecyclestage, activeFilters.company, activeFilters.jobtitle, activeFilters.city].filter(Boolean).length;

  const clearAll = () => {
    setSearchInput("");
    setSearchQuery("");
    setFilters({ lifecyclestage: "", company: "", jobtitle: "", city: "" });
    setActiveFilters({ lifecyclestage: "", company: "", jobtitle: "", city: "" });
  };

  const contacts = data?.results ?? [];

  function getInitials(c: HubSpotContact) {
    const first = c.properties.firstname?.[0] ?? "";
    const last = c.properties.lastname?.[0] ?? "";
    return (first + last).toUpperCase() || (c.properties.email?.[0]?.toUpperCase() ?? "?");
  }

  return (
    <div>
      <PageHeader
        title="HubSpot Contacts"
        description="Browse your CRM contacts, view email history, calls, notes, and get AI-powered contact summaries"
      />

      <div className="p-6 space-y-4 max-w-4xl">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-contact-search"
              placeholder="Search contacts by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" data-testid="button-search-contacts">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button
            type="button"
            variant={showFilters ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {(searchQuery || activeFilterCount > 0) && (
            <Button variant="outline" type="button" onClick={clearAll}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </form>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Lifecycle Stage</label>
                  <Select value={filters.lifecyclestage} onValueChange={(v) => setFilters(f => ({ ...f, lifecyclestage: v === "all" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any stage</SelectItem>
                      {LIFECYCLE_STAGES.filter(s => s.value).map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Company</label>
                  <Input
                    placeholder="Any company"
                    value={filters.company}
                    onChange={(e) => setFilters(f => ({ ...f, company: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Job Title</label>
                  <Input
                    placeholder="Any title"
                    value={filters.jobtitle}
                    onChange={(e) => setFilters(f => ({ ...f, jobtitle: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">City</label>
                  <Input
                    placeholder="Any city"
                    value={filters.city}
                    onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Set filters and click Search to apply.</p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading contacts...
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-center text-destructive">
              Failed to load contacts. Check your HubSpot connection.
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && contacts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <User className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No contacts found{searchQuery ? ` for "${searchQuery}"` : ""}.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && contacts.length > 0 && (
          <div className="space-y-2">
            {contacts.map((contact) => {
              const fullName = [contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(" ") || "(unnamed)";
              return (
                <Card
                  key={contact.id}
                  className="cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors"
                  data-testid={`contact-row-${contact.id}`}
                  onClick={() => navigate(`/hubspot/contacts/${contact.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                          {getInitials(contact)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{fullName}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {contact.properties.jobtitle && (
                              <span className="text-xs text-muted-foreground">
                                {contact.properties.jobtitle}
                              </span>
                            )}
                            {contact.properties.company && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="w-3 h-3" />
                                {contact.properties.company}
                              </span>
                            )}
                            {contact.properties.email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                {contact.properties.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
