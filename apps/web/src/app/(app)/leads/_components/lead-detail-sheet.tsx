"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { ActivityDto, LeadDto, NoteDto, PipelineStageDto } from "@gtm/shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelative } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Linkedin, Mail, MapPin, Phone, ExternalLink, Trash2 } from "lucide-react";

interface Props {
  leadId: string | null;
  stages: PipelineStageDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after destructive actions so the parent table can refetch. */
  onMutated?: () => void;
}

export function LeadDetailSheet({ leadId, stages, open, onOpenChange, onMutated }: Props) {
  const qc = useQueryClient();
  const router = useRouter();

  const leadQ = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api<LeadDto>(`/leads/${leadId}`),
    enabled: !!leadId && open,
  });
  const notesQ = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: () => api<NoteDto[]>(`/leads/${leadId}/notes`),
    enabled: !!leadId && open,
  });
  const activitiesQ = useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: () => api<ActivityDto[]>(`/leads/${leadId}/activities`),
    enabled: !!leadId && open,
  });

  const [noteBody, setNoteBody] = React.useState("");
  const [submittingNote, setSubmittingNote] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Reset note draft when switching leads or closing
  React.useEffect(() => {
    setNoteBody("");
    setConfirmDelete(false);
  }, [leadId, open]);

  const lead = leadQ.data;

  async function changeStage(stageId: string) {
    if (!leadId) return;
    try {
      await api(`/leads/${leadId}/move-stage`, { method: "POST", body: { pipelineStageId: stageId } });
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      onMutated?.();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to update stage");
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = noteBody.trim();
    if (!leadId || !trimmed) return;
    setSubmittingNote(true);
    try {
      await api(`/leads/${leadId}/notes`, { method: "POST", body: { body: trimmed } });
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  }

  async function doDelete() {
    if (!leadId) return;
    setDeleting(true);
    try {
      await api(`/leads/${leadId}`, { method: "DELETE" });
      toast.success("Lead deleted");
      setConfirmDelete(false);
      onOpenChange(false);
      onMutated?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to delete lead");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          {!lead ? (
            <SheetBody>
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            </SheetBody>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{lead.companyName}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  {lead.industry && <Badge variant="outline">{lead.industry}</Badge>}
                  {lead.pipelineStageName && (
                    <Badge variant={stages.find((s) => s.id === lead.pipelineStageId)?.semantic === "WON" ? "success" : "secondary"}>
                      {lead.pipelineStageName}
                    </Badge>
                  )}
                  {(lead.city || lead.country) && (
                    <span className="flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" />
                      {[lead.city, lead.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-6">
                {/* Stage selector */}
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Pipeline stage</div>
                  <Select value={lead.pipelineStageId ?? ""} onValueChange={changeStage}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ background: s.color ?? "var(--muted)" }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact card */}
                <Card>
                  <CardContent className="space-y-3 pt-6 text-sm">
                    <DetailRow label="Contact" value={lead.contactName} />
                    <DetailRow label="Role" value={lead.role} />
                    {lead.email ? (
                      <DetailRow
                        label="Email"
                        icon={<Mail className="h-3.5 w-3.5" />}
                        value={<a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>}
                      />
                    ) : (
                      <DetailRow label="Email" value={null} />
                    )}
                    <DetailRow
                      label="Phone"
                      icon={<Phone className="h-3.5 w-3.5" />}
                      value={lead.phone}
                    />
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
                    <DetailRow label="Source" value={lead.source} />
                    <DetailRow
                      label="Confidence"
                      value={lead.confidenceScore == null ? null : `${lead.confidenceScore} / 100`}
                    />
                  </CardContent>
                </Card>

                {lead.personalization && (
                  <Card>
                    <CardContent className="pt-6 text-sm">
                      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Personalization
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{lead.personalization}</div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                  <form onSubmit={addNote} className="space-y-2">
                    <Textarea
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Add a note — what was said on the call, what to follow up on, etc."
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={submittingNote || !noteBody.trim()}>
                        {submittingNote ? "Adding…" : "Add note"}
                      </Button>
                    </div>
                  </form>
                  <div className="space-y-2">
                    {(notesQ.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes yet.</p>
                    ) : (
                      (notesQ.data ?? []).map((n) => (
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
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Activity</div>
                  {(activitiesQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {(activitiesQ.data ?? []).map((a) => (
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
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/leads/${lead.id}`}>
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Open full page
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{lead?.companyName}</span> and all of its notes and
              activities. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
