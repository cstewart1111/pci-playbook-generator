import { useState } from "react";
import { Copy, Check, Sparkles, ChevronDown, ChevronUp, RefreshCw, X, MapPin, Building2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SocialProofMeta {
  orgName: string;
  orgType: string;
  sizeTier: string;
  region: string;
  angle: string;
  intensity: string;
  matchReason: string;
  orgId: string;
  hasOHP: boolean;
}

interface OutputBoxProps {
  content: string;
  label?: string;
  className?: string;
  generationId?: number;
  socialProof?: SocialProofMeta | null;
  onSwapProof?: () => void;
  onRegenerateWithoutProof?: () => void;
}

function renderContent(text: string) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSectionHeader = /^[A-Z][A-Z\s\/]+:$/.test(line.trim());

    if (isSectionHeader) {
      nodes.push(
        <p key={key++} className="text-xs font-bold text-primary uppercase tracking-widest mt-5 mb-1.5 first:mt-0">
          {line}
        </p>
      );
    } else if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-3" />);
    } else {
      nodes.push(
        <p key={key++} className="text-[15px] leading-[1.75] text-foreground">
          {line}
        </p>
      );
    }
  }

  return nodes;
}

const REGION_LABELS: Record<string, string> = {
  NE: "Northeast", SE: "Southeast", MW: "Midwest", SW: "Southwest", W: "West", NATL: "National", UNK: "",
};

const ANGLE_LABELS: Record<string, string> = {
  participation: "Participation / Response Rate",
  data_enrichment: "Data Enrichment",
  stories: "Stories Collected",
  mem_don: "Donor / Member Discovery",
  ohp_case_study: "OHP Case Study",
};

const ORG_TYPE_LABELS: Record<string, string> = {
  university_college: "University / College",
  high_school: "High School / Prep",
  association: "Association",
  military_veteran: "Military / Veteran",
  fraternity_sorority: "Fraternity / Sorority",
  seminary_religious: "Seminary / Religious",
  other: "Organization",
};

export function OutputBox({ content, label, className, socialProof, onSwapProof, onRegenerateWithoutProof }: OutputBoxProps) {
  const [copied, setCopied] = useState(false);
  const [proofExpanded, setProofExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden shadow-sm", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            {label ?? "AI Output"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          data-testid="button-copy-output"
          className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div
        data-testid="text-output-content"
        className="p-6 bg-white dark:bg-card"
        style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}
      >
        {renderContent(content)}
      </div>

      {/* Social Proof Review Section */}
      {socialProof && (
        <div className="border-t border-border">
          <button
            onClick={() => setProofExpanded(!proofExpanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50/50 hover:bg-blue-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">
                Social Proof Used: {socialProof.orgName}
              </span>
            </div>
            {proofExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" />
              : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
            }
          </button>

          {proofExpanded && (
            <div className="px-4 py-3 bg-blue-50/30 space-y-3">
              {/* Org info card */}
              <div className="rounded-md border border-blue-200 bg-white p-3">
                <p className="text-sm font-medium text-foreground">{socialProof.orgName}</p>
                <div className="flex flex-wrap gap-3 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    {socialProof.sizeTier.charAt(0).toUpperCase() + socialProof.sizeTier.slice(1)} {ORG_TYPE_LABELS[socialProof.orgType] || socialProof.orgType}
                  </span>
                  {socialProof.region && REGION_LABELS[socialProof.region] && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {REGION_LABELS[socialProof.region]}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Target className="w-3 h-3" />
                    {ANGLE_LABELS[socialProof.angle] || socialProof.angle}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Why this match: {socialProof.matchReason}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {onSwapProof && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSwapProof}
                    className="h-7 text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Swap proof and regenerate
                  </Button>
                )}
                {onRegenerateWithoutProof && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerateWithoutProof}
                    className="h-7 text-xs gap-1.5"
                  >
                    <X className="w-3 h-3" />
                    Regenerate without proof
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
