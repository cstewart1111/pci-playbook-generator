import { useParams, Link, useLocation } from "wouter";
import { useGetPlaybook, getGetPlaybookQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function BackButton() {
  const [, navigate] = useLocation();
  return (
    <Button variant="outline" size="sm" onClick={() => navigate("/playbooks")} data-testid="button-back-playbooks">
      <ArrowLeft className="w-4 h-4 mr-1" />
      Back
    </Button>
  );
}

function ActionButtons({ playbookId }: { playbookId: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/import?playbook=${playbookId}`)}
        data-testid="button-import-to-playbook"
      >
        Import More Emails
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/generate-email?playbook=${playbookId}`)}
        data-testid="button-generate-from-playbook"
      >
        Generate Email
      </Button>
    </div>
  );
}

const patternTypeColors: Record<string, string> = {
  opening: "bg-blue-100 text-blue-700",
  subject: "bg-purple-100 text-purple-700",
  hook: "bg-orange-100 text-orange-700",
  value: "bg-green-100 text-green-700",
  cta: "bg-red-100 text-red-700",
  closing: "bg-yellow-100 text-yellow-700",
};

export default function PlaybookDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: playbook, isLoading, isError } = useGetPlaybook(id, {
    query: { enabled: !!id, queryKey: getGetPlaybookQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div>
        <div className="px-6 py-5 border-b border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !playbook) {
    return (
      <div>
        <PageHeader title="Playbook Not Found" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground" data-testid="text-not-found">Playbook not found or failed to load.</p>
          <Link href="/playbooks" className="text-sm text-primary hover:underline mt-2 inline-block" data-testid="link-back-to-playbooks">
            ← Back to Playbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={playbook.name}
        description={playbook.description}
        actions={
          <BackButton />
        }
      />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="flex items-center gap-4 flex-wrap">
          <div
            data-testid="text-email-count"
            className="text-sm text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{playbook.emailCount}</span> emails analyzed
          </div>
          {playbook.qualityScore != null && (
            <div
              data-testid="text-quality-score"
              className="flex items-center gap-1 text-sm"
            >
              <span className="font-semibold text-primary text-base">{playbook.qualityScore}</span>
              <span className="text-muted-foreground">/ 10 quality score</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Updated {formatDistanceToNow(new Date(playbook.updatedAt), { addSuffix: true })}
          </div>
        </div>

        {/* Principles */}
        {playbook.principles && playbook.principles.length > 0 && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Core Principles
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="space-y-2" data-testid="list-principles">
                {playbook.principles.map((p, i) => (
                  <li
                    key={i}
                    data-testid={`text-principle-${i}`}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5 shrink-0">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Patterns */}
        {playbook.patterns && playbook.patterns.length > 0 ? (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Extracted Patterns ({playbook.patterns.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3" data-testid="list-patterns">
                {playbook.patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    data-testid={`card-pattern-${pattern.id}`}
                    className="border border-border rounded-sm p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize ${patternTypeColors[pattern.type] ?? ""}`}
                      >
                        {pattern.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground font-medium">{pattern.text}</p>
                    {pattern.examples && pattern.examples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Examples:</p>
                        {pattern.examples.map((ex, i) => (
                          <p
                            key={i}
                            data-testid={`text-example-${pattern.id}-${i}`}
                            className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2"
                          >
                            {ex}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center" data-testid="text-no-patterns">
              <p className="text-sm text-muted-foreground">No patterns extracted yet.</p>
              <Link href="/import" className="text-sm text-primary hover:underline mt-1 inline-block" data-testid="link-import-emails">
                Import emails to extract patterns →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <ActionButtons playbookId={playbook.id} />
      </div>
    </div>
  );
}
