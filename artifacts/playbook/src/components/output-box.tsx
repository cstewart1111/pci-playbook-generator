import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OutputBoxProps {
  content: string;
  label?: string;
  className?: string;
}

function formatContent(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-sm font-semibold text-foreground mt-4 mb-1 first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="text-base font-bold text-foreground mt-4 mb-1 first:mt-0">
          {line.slice(2)}
        </h1>
      );
    } else if (line.match(/^[A-Z][A-Z\s]+:$/)) {
      elements.push(
        <p key={key++} className="text-xs font-semibold text-primary uppercase tracking-wide mt-4 mb-1 first:mt-0">
          {line}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={key++} className="flex gap-2 items-start pl-1">
          <span className="text-primary mt-1 shrink-0 text-xs">•</span>
          <span className="text-sm text-foreground leading-relaxed">{line.slice(2)}</span>
        </div>
      );
    } else if (line === "" || line === "---") {
      if (line === "---") {
        elements.push(<hr key={key++} className="border-border my-3" />);
      } else {
        elements.push(<div key={key++} className="h-2" />);
      }
    } else {
      elements.push(
        <p key={key++} className="text-sm text-foreground leading-relaxed">
          {line}
        </p>
      );
    }
  }

  return elements;
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
        className="p-5 bg-card space-y-1"
      >
        {formatContent(content)}
      </div>
    </div>
  );
}
