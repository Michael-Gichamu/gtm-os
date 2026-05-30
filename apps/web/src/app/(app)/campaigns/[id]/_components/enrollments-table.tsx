"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { CampaignEnrollmentDto, EnrollmentStatus } from "@gtm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square } from "lucide-react";
import { formatRelative } from "@/lib/utils";

function statusBadge(s: EnrollmentStatus) {
  switch (s) {
    case "ENROLLED":          return <Badge variant="secondary">Queued</Badge>;
    case "ACTIVE":            return <Badge variant="success">Active</Badge>;
    case "PAUSED":            return <Badge variant="warning">Paused</Badge>;
    case "COMPLETED":         return <Badge>Completed</Badge>;
    case "STOPPED_ON_REPLY":  return <Badge variant="outline">Replied</Badge>;
    case "STOPPED_MANUAL":    return <Badge variant="destructive">Stopped</Badge>;
    case "BOUNCED":           return <Badge variant="destructive">Bounced</Badge>;
  }
}

export function EnrollmentsTable({ enrollments }: { enrollments: CampaignEnrollmentDto[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function setStatus(id: string, status: "PAUSED" | "ACTIVE" | "STOPPED_MANUAL") {
    setBusy(id);
    try {
      await api(`/campaigns/enrollments/${id}/status`, { method: "POST", body: { status } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  }

  if (enrollments.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No enrollments yet. Enroll leads from the Leads page.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Lead</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Step</th>
            <th className="px-4 py-2 text-left font-medium">Next send</th>
            <th className="px-4 py-2 text-left font-medium">Enrolled</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {enrollments.map((e) => {
            const isPausable = e.status === "ENROLLED" || e.status === "ACTIVE";
            const isResumable = e.status === "PAUSED";
            const isStoppable = isPausable || isResumable;
            return (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link href={`/leads/${e.leadId}`} className="font-medium hover:underline">
                    {e.leadCompanyName}
                  </Link>
                  {e.leadEmail && (
                    <div className="text-xs text-muted-foreground">{e.leadEmail}</div>
                  )}
                </td>
                <td className="px-4 py-2">{statusBadge(e.status)}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.currentStep + 1}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {e.nextSendAt ? formatRelative(e.nextSendAt) : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                  {formatRelative(e.enrolledAt)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isPausable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Pause"
                        disabled={busy === e.id}
                        onClick={() => setStatus(e.id, "PAUSED")}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {isResumable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Resume"
                        disabled={busy === e.id}
                        onClick={() => setStatus(e.id, "ACTIVE")}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {isStoppable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title="Stop"
                        disabled={busy === e.id}
                        onClick={() => setStatus(e.id, "STOPPED_MANUAL")}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
