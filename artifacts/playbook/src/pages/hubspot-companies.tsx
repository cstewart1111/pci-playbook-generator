import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Building2, ChevronRight, Loader2, Users, Globe, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface CompanyFilters {
  industry: string;
  city: string;
  employeeRange: string;
  revenueRange: string;
}

const EMPLOYEE_RANGES = [
  { value: "", label: "Any size" },
  { value: "1-50", label: "1-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-1000", label: "201-1,000" },
  { value: "1001-5000", label: "1,001-5,000" },
  { value: "5001+", label: "5,001+" },
];

const REVENUE_RANGES = [
  { value: "", label: "Any revenue" },
  { value: "0-1000000", label: "Under $1M" },
  { value: "1000000-10000000", label: "$1M-$10M" },
  { value: "10000000-50000000", label: "$10M-$50M" },
  { value: "50000000-200000000", label: "$50M-$200M" },
  { value: "200000000+", label: "$200M+" },
];

const INDUSTRIES = [
  "", "ACCOUNTING", "AIRLINES_AVIATION", "APPAREL_FASHION", "BANKING",
  "BIOTECHNOLOGY", "COMPUTER_SOFTWARE", "CONSTRUCTION", "CONSUMER_GOODS",
  "EDUCATION_MANAGEMENT", "FINANCIAL_SERVICES", "FOOD_BEVERAGES",
  "GOVERNMENT_ADMINISTRATION", "HEALTH_WELLNESS_AND_FITNESS", "HOSPITAL_HEALTH_CARE",
  "INFORMATION_TECHNOLOGY_AND_SERVICES", "INSURANCE", "INTERNET",
  "LEGAL_SERVICES", "MANAGEMENT_CONSULTING", "MANUFACTURING", "MARKETING_AND_ADVERTISING",
  "MEDIA_PRODUCTION", "NON_PROFIT_ORGANIZATION_MANAGEMENT", "OIL_ENERGY",
  "PHARMACEUTICALS", "REAL_ESTATE", "RETAIL", "TELECOMMUNICATIONS",
  "TRANSPORTATION_TRUCKING_RAILROAD", "UTILITIES",
];

function parseRange(val: string) {
  if (!val) return {};
  if (val.endsWith("+")) return { min: val.replace("+", "") };
  const [min, max] = val.split("-");
  return { min, max };
}

async function fetchCompanies(search: string, filters: CompanyFilters): Promise<CompaniesResponse> {
  const base = getApiBaseUrl();
  const hasFilters = filters.industry || filters.city || filters.employeeRange || filters.revenueRange;

  if (hasFilters || search) {
    const empRange = parseRange(filters.employeeRange);
    const revRange = parseRange(filters.revenueRange);
    const res = await fetch(`${base}/hubspot/companies/search/filtered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: search || undefined,
        industry: filters.industry || undefined,
        city: filters.city || undefined,
        minEmployees: empRange.min || undefined,
        maxEmployees: empRange.max || undefined,
        minRevenue: revRange.min || undefined,
        maxRevenue: revRange.max || undefined,
      }),
    });
    if (!res.ok) throw new Error("Failed to fetch companies");
    return res.json();
  }

  const url = `${base}/hubspot/companies?limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

export default function HubSpotCompanies() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CompanyFilters>({ industry: "", city: "", employeeRange: "", revenueRange: "" });
  const [activeFilters, setActiveFilters] = useState<CompanyFilters>({ industry: "", city: "", employeeRange: "", revenueRange: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["hubspot-companies", searchQuery, activeFilters],
    queryFn: () => fetchCompanies(searchQuery, activeFilters),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setActiveFilters({ ...filters });
  };

  const activeFilterCount = [activeFilters.industry, activeFilters.city, activeFilters.employeeRange, activeFilters.revenueRange].filter(Boolean).length;

  const clearAll = () => {
    setSearchInput("");
    setSearchQuery("");
    setFilters({ industry: "", city: "", employeeRange: "", revenueRange: "" });
    setActiveFilters({ industry: "", city: "", employeeRange: "", revenueRange: "" });
  };

  const companies = data?.results ?? [];

  return (
    <div>
      <PageHeader
        title="HubSpot Accounts"
        description="Browse your CRM accounts, view email history, notes, calls, and get AI-powered account summaries"
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
                  <label className="text-xs text-muted-foreground mb-1.5 block">Industry</label>
                  <Select value={filters.industry} onValueChange={(v) => setFilters(f => ({ ...f, industry: v === "all" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any industry</SelectItem>
                      {INDUSTRIES.filter(Boolean).map(ind => (
                        <SelectItem key={ind} value={ind}>
                          {ind.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Employees</label>
                  <Select value={filters.employeeRange} onValueChange={(v) => setFilters(f => ({ ...f, employeeRange: v === "any" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any size" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_RANGES.map(r => (
                        <SelectItem key={r.value || "any"} value={r.value || "any"}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Annual Revenue</label>
                  <Select value={filters.revenueRange} onValueChange={(v) => setFilters(f => ({ ...f, revenueRange: v === "any" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Any revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map(r => (
                        <SelectItem key={r.value || "any"} value={r.value || "any"}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Set filters and click Search to apply.</p>
            </CardContent>
          </Card>
        )}

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
