"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { CampaignDto, CampaignStatus } from "@gtm/shared";
import { Button } from "@/components/ui/button";
import { Play, Pause, Archive } from "lucide-react";

export function CampaignStatusControl({ campaign }: { campaign: CampaignDto }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  async function setStatus(status: CampaignStatus) {
    try {
      await api(`/campaigns/${campaign.id}/status`, {
        method: "POST",
        body: { status },
      });
      toast.success(`Campaign ${status.toLowerCase()}`);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to change status");
    }
  }

  if (campaign.status === "ARCHIVED") {
    return <span className="text-xs text-muted-foreground">Archived (read-only)</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
        <Button
          size="sm"
          onClick={() => setStatus("ACTIVE")}
          disabled={pending || campaign.stepCount === 0}
          title={campaign.stepCount === 0 ? "Add a step first" : undefined}
        >
          <Play className="mr-1 h-4 w-4" />
          {campaign.status === "DRAFT" ? "Activate" : "Resume"}
        </Button>
      )}
      {campaign.status === "ACTIVE" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("PAUSED")} disabled={pending}>
          <Pause className="mr-1 h-4 w-4" />
          Pause
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setStatus("ARCHIVED")} disabled={pending}>
        <Archive className="mr-1 h-4 w-4" />
        Archive
      </Button>
    </div>
  );
}
