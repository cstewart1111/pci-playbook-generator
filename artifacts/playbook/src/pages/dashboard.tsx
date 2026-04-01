import { useGetDashboardStats, useListPlaybooks, useGetRecentGenerations } from "@workspace/api-client-react";
import type { Generation } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Mail, FileText, Pen, TrendingUp, Import } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          {isLoading ? (
            <Skeleton className="h-6 w-12 mt-0.5" />
          ) : (
            <p
              data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-2xl font-bold text-foreground tabular-nums"
            >
              {value ?? 0}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const generationTypeLabel: Record<string, string> = {
  email: "Email Generated",
  script: "Script Generated",
  edits: "Edit Suggestions",
};

const generationTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  script: FileText,
  edits: Pen,
};

function GenerationItem({ gen }: { gen: Generation }) {
  const label = generationTypeLabel[gen.type] ?? gen.type;
  const Icon = generationTypeIcon[gen.type] ?? TrendingUp;
  return (
    <div
      data-testid={`row-generation-${gen.id}`}
      className="flex items-center gap-3 py-2.5"
    >
      <div className="w-7 h-7 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {gen.company && (
            <Badge variant="secondary" className="text-xs">{gen.company}</Badge>
          )}
        </div>
        {gen.role && (
          <p className="text-xs text-muted-foreground truncate">{gen.role}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(gen.createdAt), { addSuffix: true })}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: playbooks, isLoading: playbooksLoading } = useListPlaybooks();
  const { data: recentGenerations, isLoading: generationsLoading } = useGetRecentGenerations();

  const recentPlaybooks = playbooks?.slice(0, 4) ?? [];
  const activityFeed = recentGenerations?.slice(0, 8) ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your sales playbooks and AI generations"
      />
      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Playbooks" value={stats?.totalPlaybooks} icon={BookOpen} isLoading={statsLoading} />
          <StatCard label="Total Generations" value={stats?.totalGenerations} icon={TrendingUp} isLoading={statsLoading} />
          <StatCard label="Emails Analyzed" value={stats?.totalEmailsAnalyzed} icon={Import} isLoading={statsLoading} />
          <StatCard label="Emails Generated" value={stats?.emailsGenerated} icon={Mail} isLoading={statsLoading} />
          <StatCard label="Scripts Generated" value={stats?.scriptsGenerated} icon={FileText} isLoading={statsLoading} />
          <StatCard label="Edit Requests" value={stats?.editsRequested} icon={Pen} isLoading={statsLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent activity feed */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {generationsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : activityFeed.length === 0 ? (
                <div className="py-6 text-center" data-testid="text-empty-activity">
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate an email, script, or request edits to see activity here.</p>
                </div>
              ) : (
                <div className="divide-y divide-border" data-testid="list-recent-activity">
                  {activityFeed.map((gen) => (
                    <GenerationItem key={gen.id} gen={gen} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent playbooks */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Recent Playbooks</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {playbooksLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentPlaybooks.length === 0 ? (
                <div className="py-6 text-center" data-testid="text-empty-playbooks">
                  <p className="text-sm text-muted-foreground">No playbooks yet.</p>
                  <Link href="/playbooks" className="text-sm text-primary hover:underline mt-1 inline-block" data-testid="link-create-first-playbook">
                    Create your first playbook →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentPlaybooks.map((pb) => (
                    <Link
                      key={pb.id}
                      href={`/playbooks/${pb.id}`}
                      data-testid={`row-playbook-${pb.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-muted/50 -mx-1 px-1 rounded-sm transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{pb.name}</p>
                        <p className="text-xs text-muted-foreground">{pb.emailCount} emails analyzed</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {pb.qualityScore != null && (
                          <span className="text-xs font-semibold text-primary">{pb.qualityScore}/10</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(pb.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/import"
                data-testid="link-quick-import"
                className="flex items-center gap-2 p-3 border border-border rounded-sm hover:bg-muted/50 transition-colors"
              >
                <Import className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Import Emails</span>
              </Link>
              <Link
                href="/generate-email"
                data-testid="link-quick-generate-email"
                className="flex items-center gap-2 p-3 border border-border rounded-sm hover:bg-muted/50 transition-colors"
              >
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Generate Email</span>
              </Link>
              <Link
                href="/generate-script"
                data-testid="link-quick-generate-script"
                className="flex items-center gap-2 p-3 border border-border rounded-sm hover:bg-muted/50 transition-colors"
              >
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Generate Script</span>
              </Link>
              <Link
                href="/suggest-edits"
                data-testid="link-quick-suggest-edits"
                className="flex items-center gap-2 p-3 border border-border rounded-sm hover:bg-muted/50 transition-colors"
              >
                <Pen className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Suggest Edits</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
