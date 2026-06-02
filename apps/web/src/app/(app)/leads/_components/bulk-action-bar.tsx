"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { CampaignDto, EnrollLeadsResult, LeadDto, PipelineStageDto } from "@gtm/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Move, Trash2, X } from "lucide-react";

/**
 * Floating contextual action bar that appears at the bottom of the leads
 * table when one or more rows are selected. Matches the Linear/Notion/
 * Attio pattern: row checkboxes -> bar surfaces -> bulk operations.
 *
 * Phase 1.x scope: bulk enroll into a campaign, bulk move stage, bulk
 * delete. Each iterates with per-lead API calls — clean and simple at
 * Phase-1 row counts. We can swap for true bulk endpoints once profiling
 * shows the loop is the bottleneck.
 */
interface Props {
  selectedIds: string[];
  selectedLeads: LeadDto[];
  stages: PipelineStageDto[];
  onClear: () => void;
}

export function BulkActionBar({ selectedIds, selectedLeads, stages, onClear }: Props) {
  const router = useRouter();
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [campaigns, setCampaigns] = React.useState<CampaignDto[] | null>(null);
  const [campaignChoice, setCampaignChoice] = React.useState("");
  const [stageChoice, setStageChoice] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Lazy-load campaigns when the enroll dialog opens.
  React.useEffect(() => {
    if (!enrollOpen || campaigns) return;
    api<CampaignDto[]>("/campaigns")
      .then(setCampaigns)
      .catch((e) => toast.error(e instanceof ClientApiError ? e.message : "Failed to load campaigns"));
  }, [enrollOpen, campaigns]);

  const eligibleCampaigns = (campaigns ?? []).filter(
    (c) => c.status !== "ARCHIVED" && c.stepCount > 0,
  );

  async function bulkEnroll() {
    if (!campaignChoice) return;
    setBusy(true);
    try {
      const r = await api<EnrollLeadsResult>(`/campaigns/${campaignChoice}/enrollments`, {
        method: "POST",
        body: { leadIds: selectedIds },
      });
      toast.success(
        `Enrolled ${r.enrolled}` +
          (r.skipped ? `, skipped ${r.skipped} already enrolled` : "") +
          (r.errors.length ? `, ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}` : ""),
      );
      setEnrollOpen(false);
      onClear();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  async function bulkMoveStage() {
    if (!stageChoice) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await api(`/leads/${id}/move-stage`, {
          method: "POST",
          body: { pipelineStageId: stageChoice },
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed === 0) toast.success(`Moved ${ok} ${ok === 1 ? "lead" : "leads"}`);
    else toast.warning(`Moved ${ok}, failed ${failed}`);
    setMoveOpen(false);
    onClear();
    router.refresh();
  }

  async function bulkDelete() {
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await api(`/leads/${id}`, { method: "DELETE" });
        ok++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed === 0) toast.success(`Deleted ${ok} ${ok === 1 ? "lead" : "leads"}`);
    else toast.warning(`Deleted ${ok}, failed ${failed}`);
    setDeleteOpen(false);
    onClear();
    router.refresh();
  }

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transform">
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-lg">
          <span className="px-2 text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={() => setEnrollOpen(true)}>
            <Megaphone className="mr-1 h-4 w-4" />
            Enroll
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMoveOpen(true)}>
            <Move className="mr-1 h-4 w-4" />
            Move stage
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button size="icon" variant="ghost" onClick={onClear} title="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll {selectedIds.length} {selectedIds.length === 1 ? "lead" : "leads"}</DialogTitle>
            <DialogDescription>
              Leads already in the chosen campaign are skipped automatically.
            </DialogDescription>
          </DialogHeader>
          {campaigns === null ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading campaigns…</div>
          ) : eligibleCampaigns.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No eligible campaigns. Create one with at least one step first.
            </div>
          ) : (
            <Select value={campaignChoice} onValueChange={setCampaignChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a campaign" />
              </SelectTrigger>
              <SelectContent>
                {eligibleCampaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.stepCount} {c.stepCount === 1 ? "step" : "steps"} · {c.status.toLowerCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={bulkEnroll} disabled={!campaignChoice || busy}>
              {busy ? "Enrolling…" : "Enroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move stage dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedIds.length} {selectedIds.length === 1 ? "lead" : "leads"} to a new stage</DialogTitle>
            <DialogDescription>
              Each move writes a LEAD_STAGE_CHANGED entry to the activity log.
            </DialogDescription>
          </DialogHeader>
          <Select value={stageChoice} onValueChange={setStageChoice}>
            <SelectTrigger>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={bulkMoveStage} disabled={!stageChoice || busy}>
              {busy ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} {selectedIds.length === 1 ? "lead" : "leads"}?</DialogTitle>
            <DialogDescription>
              Permanently removes the selected {selectedIds.length === 1 ? "lead" : "leads"} and all
              {" "}{selectedIds.length === 1 ? "its" : "their"} notes, activities, and campaign
              enrollments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedLeads.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {selectedLeads.slice(0, 10).map((l) => (
                <div key={l.id} className="truncate">• {l.companyName}</div>
              ))}
              {selectedLeads.length > 10 && (
                <div className="text-muted-foreground">…and {selectedLeads.length - 10} more</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDelete} disabled={busy}>
              {busy ? "Deleting…" : `Delete ${selectedIds.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
