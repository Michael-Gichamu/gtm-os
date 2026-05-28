import Link from "next/link";
import { notFound } from "next/navigation";
import { apiServerFetch, ApiError } from "@/lib/api/server";
import type { ActivityDto, LeadDto, NoteDto, PipelineStageDto } from "@gtm/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadStageSelector } from "./_components/lead-stage-selector";
import { AddNoteForm } from "./_components/add-note-form";
import { DeleteLeadButton } from "./_components/delete-lead-button";
import { formatRelative } from "@/lib/utils";
import { ArrowLeft, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let lead: LeadDto;
  try {
    lead = await apiServerFetch<LeadDto>(`/leads/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [notes, activities, stages] = await Promise.all([
    apiServerFetch<NoteDto[]>(`/leads/${id}/notes`),
    apiServerFetch<ActivityDto[]>(`/leads/${id}/activities`),
    apiServerFetch<PipelineStageDto[]>("/pipeline/stages"),
  ]);

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/leads"><ArrowLeft className="mr-1 h-4 w-4" /> All leads</Link>
        </Button>
        <DeleteLeadButton id={lead.id} companyName={lead.companyName} />
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{lead.companyName}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lead.industry ? <Badge variant="outline">{lead.industry}</Badge> : null}
          {(lead.city || lead.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {[lead.city, lead.country].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline stage</CardTitle>
              <CardDescription>Move the lead through your outbound funnel</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadStageSelector leadId={lead.id} currentStageId={lead.pipelineStageId} stages={stages} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Private context for this account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddNoteForm leadId={lead.id} />
              <div className="space-y-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{n.authorName ?? "Unknown"}</span>
                        <span>{formatRelative(n.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Name" value={lead.contactName} />
              <DetailRow label="Role" value={lead.role} />
              {lead.email ? (
                <DetailRow
                  label="Email"
                  icon={<Mail className="h-3.5 w-3.5" />}
                  value={
                    <a href={`mailto:${lead.email}`} className="hover:underline">
                      {lead.email}
                    </a>
                  }
                />
              ) : (
                <DetailRow label="Email" value={null} />
              )}
              {lead.phone ? (
                <DetailRow label="Phone" icon={<Phone className="h-3.5 w-3.5" />} value={lead.phone} />
              ) : null}
              {lead.website ? (
                <DetailRow
                  label="Website"
                  icon={<Globe className="h-3.5 w-3.5" />}
                  value={
                    <a href={lead.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  }
                />
              ) : null}
              {lead.linkedinUrl ? (
                <DetailRow
                  label="LinkedIn"
                  icon={<Linkedin className="h-3.5 w-3.5" />}
                  value={
                    <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      View profile
                    </a>
                  }
                />
              ) : null}
              <DetailRow
                label="Confidence"
                value={lead.confidenceScore == null ? null : `${lead.confidenceScore} / 100`}
              />
              <DetailRow label="Source" value={lead.source} />
            </CardContent>
          </Card>

          {lead.personalization && (
            <Card>
              <CardHeader>
                <CardTitle>Personalization</CardTitle>
                <CardDescription>Used by templates in Phase 2</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">{lead.personalization}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Activity feed for this lead</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />
                      <div className="flex-1">
                        <div className="font-medium">{humanize(a.type)}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.actorName ?? "system"} · {formatRelative(a.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right">{value || <span className="text-muted-foreground">—</span>}</span>
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
