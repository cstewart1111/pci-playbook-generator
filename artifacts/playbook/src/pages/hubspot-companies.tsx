import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Building2, ChevronRight, Loader2, Users, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";

interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    city?: string;
    country?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    hs_lastmodifieddate?: string;
  };
}

interface CompaniesResponse {
  results?: HubSpotCompany[];
  paging?: { next?: { after?: string } };
  error?: string;
}

async function fetchCompanies(search: string): Promise<CompaniesResponse> {
  const base = getApiBaseUrl();
  const url = search
    ? `${base}/hubspot/companies?search=${encodeURIComponent(search)}&limit=20`
    : `${base}/hubspot/companies?limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

export default function HubSpotCompanies() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["hubspot-companies", searchQuery],
    queryFn: () => fetchCompanies(searchQuery),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const companies = data?.results ?? [];

  return (
    <div>
      <PageHeader
        title="HubSpot Accounts"
        description="Browse your CRM accounts, view email history, notes, and get AI-powered account summaries"
      />

      <div className="p-6 space-y-4 max-w-4xl">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-company-search"
              placeholder="Search companies by name or domain..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" data-testid="button-search-companies">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          {searchQuery && (
            <Button
              variant="outline"
              type="button"
              onClick={() => { setSearchInput(""); setSearchQuery(""); }}
            >
              Clear
            </Button>
          )}
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading companies...
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-center text-destructive">
              Failed to load companies. Check your HubSpot connection.
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && companies.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No companies found{searchQuery ? ` for "${searchQuery}"` : ""}.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && companies.length > 0 && (
          <div className="space-y-2">
            {companies.map((company) => (
              <Card
                key={company.id}
                className="cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors"
                data-testid={`company-row-${company.id}`}
                onClick={() => navigate(`/hubspot/companies/${company.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {company.properties.name ?? "(unnamed)"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {company.properties.domain && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              {company.properties.domain}
                            </span>
                          )}
                          {company.properties.industry && (
                            <span className="text-xs text-muted-foreground">
                              {company.properties.industry}
                            </span>
                          )}
                          {company.properties.numberofemployees && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              {Number(company.properties.numberofemployees).toLocaleString()} employees
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
