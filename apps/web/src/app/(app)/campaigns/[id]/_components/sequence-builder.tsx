"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { SequenceStepDto } from "@gtm/shared";
import { extractVariables, TEMPLATE_VARIABLES } from "@gtm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Props {
  campaignId: string;
  initialSteps: SequenceStepDto[];
  disabled?: boolean;
}

interface StepDraft {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
}

const EMPTY_DRAFT: StepDraft = { order: 0, subject: "", body: "", delayDays: 0 };

export function SequenceBuilder({ campaignId, initialSteps, disabled }: Props) {
  const router = useRouter();
  const [steps, setSteps] = React.useState(initialSteps);
  const [editing, setEditing] = React.useState<SequenceStepDto | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<StepDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);

  function openCreate() {
    setDraft({
      order: steps.length, // next position
      subject: "",
      body: "",
      delayDays: steps.length === 0 ? 0 : 3, // sensible default
    });
    setCreating(true);
  }

  function openEdit(step: SequenceStepDto) {
    setEditing(step);
    setDraft({
      order: step.order,
      subject: step.subject,
      body: step.body,
      delayDays: step.delayDays,
    });
  }

  async function save() {
    setSubmitting(true);
    try {
      if (editing) {
        const updated = await api<SequenceStepDto>(
          `/campaigns/${campaignId}/steps/${editing.id}`,
          { method: "PATCH", body: draft },
        );
        setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("Step updated");
        setEditing(null);
      } else {
        const created = await api<SequenceStepDto>(
          `/campaigns/${campaignId}/steps`,
          { method: "POST", body: draft },
        );
        setSteps((prev) => [...prev, created].sort((a, b) => a.order - b.order));
        toast.success("Step added");
        setCreating(false);
      }
      setDraft(EMPTY_DRAFT);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to save step");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStep(step: SequenceStepDto) {
    if (!confirm(`Delete step ${step.order + 1}? This can't be undone.`)) return;
    try {
      await api(`/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
      toast.success("Step deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to delete step");
    }
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No steps yet. Add one to start the sequence.
        </div>
      ) : (
        <ol className="space-y-2">
          {steps.map((step) => {
            const variables = extractVariables(step.subject + " " + step.body);
            return (
              <li key={step.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">Step {step.order + 1}</span>
                      <span>·</span>
                      <span>
                        {step.delayDays === 0 ? "fires immediately" : `delay ${step.delayDays}d`}
                      </span>
                      {variables.length > 0 && (
                        <>
                          <span>·</span>
                          <span>uses {variables.map((v) => `{${v}}`).join(", ")}</span>
                        </>
                      )}
                    </div>
                    <div className="font-medium truncate">{step.subject}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {step.body}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" disabled={disabled} onClick={() => openEdit(step)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      disabled={disabled}
                      onClick={() => deleteStep(step)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Button onClick={openCreate} disabled={disabled} variant="outline" className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add step
      </Button>

      {/* Create / edit dialog */}
      <Dialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
            setDraft(EMPTY_DRAFT);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit step ${editing.order + 1}` : "New sequence step"}</DialogTitle>
            <DialogDescription>
              Available variables:{" "}
              {TEMPLATE_VARIABLES.map((v) => (
                <code key={v} className="mr-1 rounded bg-muted px-1.5 py-0.5 text-xs">{`{${v}}`}</code>
              ))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.order}
                  onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Delay (days from previous)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={draft.delayDays}
                  onChange={(e) => setDraft({ ...draft, delayDays: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Quick question for {CompanyName}"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Body</Label>
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
                placeholder={`Hi {ContactName},\n\nI saw {CompanyName} is in the {Industry} space...`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={submitting || !draft.subject.trim() || !draft.body.trim()}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Add step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
