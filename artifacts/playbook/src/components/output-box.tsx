import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OutputBoxProps {
  content: string;
  label?: string;
  className?: string;
}

export function OutputBox({ content, label, className }: OutputBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative border border-border rounded-sm bg-card", className)}>
      {label && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            data-testid="button-copy-output"
            className="h-6 px-2 text-xs gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      {!label && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          data-testid="button-copy-output"
          className="absolute top-2 right-2 h-6 px-2 text-xs gap-1 z-10"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
      <pre
        data-testid="text-output-content"
        className="p-4 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-foreground"
      >
        {content}
      </pre>
    </div>
  );
}
