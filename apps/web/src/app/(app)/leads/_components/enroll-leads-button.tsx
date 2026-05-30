"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { CampaignDto, EnrollLeadsResult, LeadDto } from "@gtm/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone } from "lucide-react";

/**
 * Bulk-enroll leads. Operator picks a campaign and confirms; we POST every
 * provided lead id. The API skips already-enrolled leads silently (the
 * (campaignId, leadId) unique handles dedupe).
 *
 * Phase 2.4 scope: enrolls every lead the parent component hands over.
 * The leads table currently doesn't have multi-select — that's a follow-up
 * polish — so for now the call site passes "every visible lead" or "this
 * one lead" depending on context.
 */
interface Props {
  leads: LeadDto[];
  /** Label override — e.g. "Enroll selected" or "Enroll this lead". */
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm";
}

export function EnrollLeadsButton({ leads, label, variant = "outline", size = "default" }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [campaigns, setCampaigns] = React.useState<CampaignDto[] | null>(null);
  const [selected, setSelected] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  // Lazy-load campaigns when the dialog opens — avoids a server fetch for
  // operators who never click this button.
  React.useEffect(() => {
    if (!open || campaigns) return;
    api<CampaignDto[]>("/campaigns")
      .then(setCampaigns)
      .catch((e) =>
        toast.error(e instanceof ClientApiError ? e.message : "Failed to load campaigns"),
      );
  }, [open, campaigns]);

  const eligibleCampaigns = (campaigns ?? []).filter(
    (c) => c.status !== "ARCHIVED" && c.stepCount > 0,
  );

  async function enroll() {
    if (!selected || leads.length === 0) return;
    setSubmitting(true);
    try {
      const r = await api<EnrollLeadsResult>(
        `/campaigns/${selected}/enrollments`,
        { method: "POST", body: { leadIds: leads.map((l) => l.id) } },
      );
      toast.success(
        `Enrolled ${r.enrolled}` +
          (r.skipped ? `, skipped ${r.skipped} already in campaign` : "") +
          (r.errors.length ? `, ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}` : ""),
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Enroll failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} disabled={leads.length === 0}>
          <Megaphone className="mr-1 h-4 w-4" />
          {label ?? `Enroll ${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll into a campaign</DialogTitle>
          <DialogDescription>
            {leads.length} {leads.length === 1 ? "lead" : "leads"} will be enrolled. Leads already in the
            chosen campaign are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {campaigns === null ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading campaigns…</div>
        ) : eligibleCampaigns.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No eligible campaigns. Create a campaign and add at least one step first.
          </div>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
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
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={enroll} disabled={!selected || submitting}>
            {submitting ? "Enrolling…" : "Enroll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
