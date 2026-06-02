"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ClientApiError } from "@/lib/api/client";
import type { ActivityDto, LeadDto, NoteDto, PipelineStageDto } from "@gtm/shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelative } from "@/lib/utils";
import { EditableField } from "@/components/editable-field";
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

/**
 * The full editable lead surface. Every field is click-to-edit via
 * EditableField, which calls `patchField` below. Patches optimistically
 * mutate the cached lead, fire the PATCH, and on error roll back + toast.
 */
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

  /**
   * Patch a single field with optimistic update + rollback. EditableField's
   * onSave promise resolves only when the server confirms, so the spinner
   * accurately reflects in-flight state.
   */
  async function patchField<K extends keyof LeadDto>(field: K, next: LeadDto[K]) {
    if (!leadId || !lead) return;
    const previous = lead;
    qc.setQueryData<LeadDto>(["lead", leadId], { ...previous, [field]: next });
    try {
      const updated = await api<LeadDto>(`/leads/${leadId}`, {
        method: "PATCH",
        body: { [field]: next },
      });
      qc.setQueryData(["lead", leadId], updated);
      // The list-view cache is what the parent table renders — invalidate.
      qc.invalidateQueries({ queryKey: ["leads"] });
      onMutated?.();
    } catch (e) {
      // Roll back the optimistic edit.
      qc.setQueryData(["lead", leadId], previous);
      const message = e instanceof ClientApiError ? e.message : "Save failed";
      toast.error(message);
      // Re-throw so EditableField stays in edit mode for retry.
      throw new Error(message);
    }
  }

  async function changeStage(stageId: string) {
    if (!leadId) return;
    try {
      await api(`/leads/${leadId}/move-stage`, { method: "POST", body: { pipelineStageId: stageId } });
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
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
                {/* Company name is the headline — also editable inline. */}
                <SheetTitle className="text-xl">
                  <EditableField
                    value={lead.companyName}
                    placeholder="Company name"
                    validate={(v) => (v ? undefined : "Required")}
                    onSave={(v) => patchField("companyName", (v ?? "") as string)}
                  />
                </SheetTitle>
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
                {/* Stage selector — uses the existing dedicated endpoint so the
                    LEAD_STAGE_CHANGED activity is emitted properly. */}
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

                {/* Company section */}
                <Card>
                  <CardContent className="space-y-2 pt-6 text-sm">
                    <SectionTitle>Company</SectionTitle>
                    <EditRow label="Industry">
                      <EditableField
                        value={lead.industry}
                        placeholder="Add industry"
                        onSave={(v) => patchField("industry", v)}
                      />
                    </EditRow>
                    <EditRow label="Website" icon={<Globe className="h-3.5 w-3.5" />}>
                      <EditableField
                        value={lead.website}
                        placeholder="Add website"
                        type="url"
                        validate={(v) => (z.string().url().safeParse(v).success ? undefined : "Invalid URL")}
                        onSave={(v) => patchField("website", v)}
                        renderValue={(v) => (
                          <a
                            href={v}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {v.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      />
                    </EditRow>
                    <EditRow label="City">
                      <EditableField
                        value={lead.city}
                        placeholder="Add city"
                        onSave={(v) => patchField("city", v)}
                      />
                    </EditRow>
                    <EditRow label="Country">
                      <EditableField
                        value={lead.country}
                        placeholder="Add country"
                        onSave={(v) => patchField("country", v)}
                      />
                    </EditRow>
                  </CardContent>
                </Card>

                {/* Contact section */}
                <Card>
                  <CardContent className="space-y-2 pt-6 text-sm">
                    <SectionTitle>Contact</SectionTitle>
                    <EditRow label="Name">
                      <EditableField
                        value={lead.contactName}
                        placeholder="Add contact name"
                        onSave={(v) => patchField("contactName", v)}
                      />
                    </EditRow>
                    <EditRow label="Role">
                      <EditableField
                        value={lead.role}
                        placeholder="Add role"
                        onSave={(v) => patchField("role", v)}
                      />
                    </EditRow>
                    <EditRow label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
                      <EditableField
                        value={lead.email}
                        placeholder="Add email"
                        type="email"
                        validate={(v) =>
                          z.string().email().safeParse(v).success ? undefined : "Invalid email"
                        }
                        onSave={(v) => patchField("email", v)}
                        renderValue={(v) => (
                          <a
                            href={`mailto:${v}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {v}
                          </a>
                        )}
                      />
                    </EditRow>
                    <EditRow label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                      <EditableField
                        value={lead.phone}
                        placeholder="Add phone"
                        type="tel"
                        onSave={(v) => patchField("phone", v)}
                      />
                    </EditRow>
                    <EditRow label="LinkedIn" icon={<Linkedin className="h-3.5 w-3.5" />}>
                      <EditableField
                        value={lead.linkedinUrl}
                        placeholder="Add LinkedIn URL"
                        type="url"
                        validate={(v) => (z.string().url().safeParse(v).success ? undefined : "Invalid URL")}
                        onSave={(v) => patchField("linkedinUrl", v)}
                        renderValue={(v) => (
                          <a
                            href={v}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            View profile
                          </a>
                        )}
                      />
                    </EditRow>
                  </CardContent>
                </Card>

                {/* Source + confidence */}
                <Card>
                  <CardContent className="space-y-2 pt-6 text-sm">
                    <SectionTitle>Lead metadata</SectionTitle>
                    <EditRow label="Source">
                      <EditableField
                        value={lead.source}
                        placeholder="Add source"
                        onSave={(v) => patchField("source", v)}
                      />
                    </EditRow>
                    <EditRow label="Confidence">
                      <EditableField
                        value={lead.confidenceScore == null ? "" : String(lead.confidenceScore)}
                        placeholder="0–100"
                        type="number"
                        validate={(v) => {
                          if (!v) return undefined;
                          const n = Number(v);
                          if (!Number.isInteger(n) || n < 0 || n > 100) return "0–100 only";
                          return undefined;
                        }}
                        onSave={(v) =>
                          patchField("confidenceScore", v == null || v === "" ? null : Number(v))
                        }
                      />
                    </EditRow>
                  </CardContent>
                </Card>

                {/* Personalization — multiline */}
                <Card>
                  <CardContent className="pt-6 text-sm">
                    <SectionTitle>Personalization</SectionTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Used by templates as <span className="font-mono">{"{Personalization}"}</span>.
                    </div>
                    <div className="mt-2">
                      <EditableField
                        value={lead.personalization}
                        placeholder="One-line angle for outreach — what makes this lead unique"
                        multiline
                        onSave={(v) => patchField("personalization", v)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Notes — append-only history; the textbox below is for new
                    notes, not editing existing ones. */}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{children}</div>
  );
}

function EditRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="flex shrink-0 items-center gap-1.5 pt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex-1 min-w-0 text-right">{children}</div>
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
