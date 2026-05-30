import Link from "next/link";
import { notFound } from "next/navigation";
import { apiServerFetch, ApiError } from "@/lib/api/server";
import type {
  CampaignDto,
  SequenceStepDto,
  CampaignEnrollmentDto,
} from "@gtm/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusControl } from "./_components/campaign-status-control";
import { SequenceBuilder } from "./_components/sequence-builder";
import { EnrollmentsTable } from "./_components/enrollments-table";
import { ArrowLeft } from "lucide-react";
import { formatRelative } from "@/lib/utils";

function statusBadge(status: CampaignDto["status"]) {
  switch (status) {
    case "ACTIVE":   return <Badge variant="success">Active</Badge>;
    case "PAUSED":   return <Badge variant="warning">Paused</Badge>;
    case "DRAFT":    return <Badge variant="secondary">Draft</Badge>;
    case "ARCHIVED": return <Badge variant="outline">Archived</Badge>;
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let campaign: CampaignDto;
  try {
    campaign = await apiServerFetch<CampaignDto>(`/campaigns/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [steps, enrollments] = await Promise.all([
    apiServerFetch<SequenceStepDto[]>(`/campaigns/${id}/steps`),
    apiServerFetch<CampaignEnrollmentDto[]>(`/campaigns/${id}/enrollments`),
  ]);

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/campaigns"><ArrowLeft className="mr-1 h-4 w-4" /> All campaigns</Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {statusBadge(campaign.status)}
            <span>{campaign.stepCount} {campaign.stepCount === 1 ? "step" : "steps"}</span>
            <span>·</span>
            <span>cap {campaign.dailyCap}/day</span>
            <span>·</span>
            <span>window {campaign.sendWindowStart}-{campaign.sendWindowEnd}h UTC</span>
            <span>·</span>
            <span>jitter +/- {campaign.jitterMinutes}m</span>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground pt-1">{campaign.description}</p>
          )}
        </div>
        <CampaignStatusControl campaign={campaign} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{campaign.enrollmentCounts.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{campaign.enrollmentCounts.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl">{campaign.enrollmentCounts.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stopped</CardDescription>
            <CardTitle className="text-2xl">{campaign.enrollmentCounts.stopped}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sequence</CardTitle>
          <CardDescription>
            Steps fire in order; delay-days run from the previous send. Subject and body support
            variables like <span className="font-mono">{"{CompanyName}"}</span>,{" "}
            <span className="font-mono">{"{ContactName}"}</span>,{" "}
            <span className="font-mono">{"{Industry}"}</span>,{" "}
            <span className="font-mono">{"{Personalization}"}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SequenceBuilder campaignId={campaign.id} initialSteps={steps} disabled={campaign.status === "ARCHIVED"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
          <CardDescription>
            Up to 500 most recent. Enroll new leads from the <Link href="/leads" className="underline">Leads page</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnrollmentsTable enrollments={enrollments} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Created {formatRelative(campaign.createdAt)}
        {campaign.startedAt ? ` · started ${formatRelative(campaign.startedAt)}` : ""}
      </p>
    </div>
  );
}
