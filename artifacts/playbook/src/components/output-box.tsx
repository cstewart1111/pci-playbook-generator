import { useState } from "react";
import { Copy, Check, Sparkles, Send, MessageCircle, Calendar, Trophy, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUpdateGenerationOutcome } from "@workspace/api-client-react";

interface OutputBoxProps {
  content: string;
  label?: string;
  className?: string;
  generationId?: number;
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

const OUTCOME_OPTIONS = [
  { value: "sent", label: "Sent", icon: Send, color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { value: "replied", label: "Got Reply", icon: MessageCircle, color: "text-green-600 bg-green-50 border-green-200 hover:bg-green-100" },
  { value: "booked_meeting", label: "Booked Meeting", icon: Calendar, color: "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100" },
  { value: "closed_won", label: "Closed Won", icon: Trophy, color: "text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
  { value: "no_response", label: "No Response", icon: Clock, color: "text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100" },
  { value: "rejected", label: "Rejected", icon: XCircle, color: "text-red-500 bg-red-50 border-red-200 hover:bg-red-100" },
];

export function OutputBox({ content, label, className, generationId }: OutputBoxProps) {
  const [copied, setCopied] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const updateOutcome = useUpdateGenerationOutcome({
    mutation: {
      onSuccess: () => {},
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOutcome = (outcome: string) => {
    if (!generationId) return;
    setSelectedOutcome(outcome);
    updateOutcome.mutate({ id: generationId, data: { outcome } });
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

      {/* Feedback / Outcome Tracking */}
      {generationId && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Track outcome (helps improve future generations):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OUTCOME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedOutcome === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleOutcome(opt.value)}
                  disabled={updateOutcome.isPending}
                  data-testid={`button-outcome-${opt.value}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    isSelected
                      ? `${opt.color} ring-2 ring-offset-1 ring-current`
                      : `${opt.color} opacity-70 hover:opacity-100`
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
