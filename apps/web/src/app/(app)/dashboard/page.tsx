import Link from "next/link";
import { apiServerFetch } from "@/lib/api/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ActivityDto, PipelineStageDto } from "@gtm/shared";
import { formatRelative } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface WorkspaceMe {
  id: string;
  name: string;
  slug: string;
  counts: { total: number; active: number; won: number; lost: number };
}

const summary = (label: string, value: number) => (
  <Card key={label}>
    <CardHeader className="pb-2">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-3xl">{value}</CardTitle>
    </CardHeader>
  </Card>
);

export default async function DashboardPage() {
  const [workspace, stages, activity] = await Promise.all([
    apiServerFetch<WorkspaceMe>("/workspace/me"),
    apiServerFetch<PipelineStageDto[]>("/pipeline/stages"),
    apiServerFetch<ActivityDto[]>("/activities", { searchParams: { limit: 10 } }),
  ]);

  return (
    <div className="container max-w-6xl space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">Operator dashboard</p>
        </div>
        <Button asChild>
          <Link href="/leads">
            Open leads <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary("Total leads", workspace.counts.total)}
        {summary("Active", workspace.counts.active)}
        {summary("Won", workspace.counts.won)}
        {summary("Lost", workspace.counts.lost)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Lead count by stage</CardDescription>
          </CardHeader>
          <CardContent>
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stages yet.</p>
            ) : (
              <div className="space-y-2">
                {stages.map((s) => {
                  const total = stages.reduce((a, b) => a + b.leadCount, 0) || 1;
                  const pct = Math.round((s.leadCount / total) * 100);
                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: s.color ?? "var(--muted)" }}
                          />
                          {s.name}
                        </span>
                        <span className="text-muted-foreground">{s.leadCount}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Last 10 events in this workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity yet. Create your first lead to get started.
              </p>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{humanize(a.type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.actorName ?? "system"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function humanize(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
