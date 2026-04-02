import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function OutputBox({ content, label, className }: OutputBoxProps) {
  const [copied, setCopied] = useState(false);

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
    </div>
  );
}
