import Link from "next/link";
import { apiServerFetch } from "@/lib/api/server";
import type { CampaignDto } from "@gtm/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewCampaignButton } from "./_components/new-campaign-button";
import { formatRelative } from "@/lib/utils";
import { Megaphone, Pause, Play, CheckCircle2, Archive } from "lucide-react";

function statusBadge(status: CampaignDto["status"]) {
  switch (status) {
    case "ACTIVE":   return <Badge variant="success">Active</Badge>;
    case "PAUSED":   return <Badge variant="warning">Paused</Badge>;
    case "DRAFT":    return <Badge variant="secondary">Draft</Badge>;
    case "ARCHIVED": return <Badge variant="outline">Archived</Badge>;
  }
}

export default async function CampaignsPage() {
  const campaigns = await apiServerFetch<CampaignDto[]>("/campaigns");

  return (
    <div className="container max-w-7xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              Outbound sequences — build, enroll leads, monitor progress.
            </p>
          </div>
        </div>
        <NewCampaignButton />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>
              Create your first campaign, add a sequence step, then enroll leads from the Leads page.
              The worker handles scheduling and (stubbed) sending in the background.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {statusBadge(c.status)}
                  </div>
                  {c.description && (
                    <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{c.stepCount} {c.stepCount === 1 ? "step" : "steps"}</span>
                    <span>cap {c.dailyCap}/day</span>
                    <span>window {c.sendWindowStart}-{c.sendWindowEnd}h UTC</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <Stat label="Total"     value={c.enrollmentCounts.total} />
                    <Stat label="Active"    value={c.enrollmentCounts.active}    icon={<Play className="h-3 w-3" />} />
                    <Stat label="Done"      value={c.enrollmentCounts.completed} icon={<CheckCircle2 className="h-3 w-3" />} />
                    <Stat label="Stopped"   value={c.enrollmentCounts.stopped}   icon={<Pause className="h-3 w-3" />} />
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    {c.startedAt ? `Started ${formatRelative(c.startedAt)}` : `Created ${formatRelative(c.createdAt)}`}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
