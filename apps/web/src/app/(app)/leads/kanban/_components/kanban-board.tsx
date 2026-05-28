"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { LeadDto, PipelineStageDto } from "@gtm/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  stages: PipelineStageDto[];
  leads: LeadDto[];
}

export function KanbanBoard({ stages, leads: initialLeads }: Props) {
  const router = useRouter();
  const [leads, setLeads] = React.useState(initialLeads);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<string | null>(null);

  // Group leads by stageId. Leads without a stage land in __none.
  const byStage = React.useMemo(() => {
    const map = new Map<string, LeadDto[]>();
    stages.forEach((s) => map.set(s.id, []));
    map.set("__none", []);
    for (const l of leads) {
      const key = l.pipelineStageId ?? "__none";
      const bucket = map.get(key) ?? [];
      bucket.push(l);
      map.set(key, bucket);
    }
    return map;
  }, [leads, stages]);

  async function move(leadId: string, toStageId: string) {
    const original = leads;
    // Optimistic update — snap card to new column, roll back on error.
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              pipelineStageId: toStageId,
              pipelineStageName: stages.find((s) => s.id === toStageId)?.name ?? null,
            }
          : l,
      ),
    );
    try {
      await api(`/leads/${leadId}/move-stage`, {
        method: "POST",
        body: { pipelineStageId: toStageId },
      });
      router.refresh();
    } catch (e) {
      setLeads(original);
      const msg = e instanceof ClientApiError ? e.message : "Failed to move lead";
      toast.error(msg);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const items = byStage.get(stage.id) ?? [];
        const isOver = overStage === stage.id;
        return (
          <div
            key={stage.id}
            className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/20 p-3 transition-colors ${
              isOver ? "ring-2 ring-ring" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const id = e.dataTransfer.getData("text/lead-id") || dragId;
              if (id) void move(id, stage.id);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: stage.color ?? "var(--muted)" }}
                />
                {stage.name}
              </span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    setDragId(lead.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab p-3 shadow-sm active:cursor-grabbing"
                >
                  <Link href={`/leads/${lead.id}`} className="block">
                    <div className="text-sm font-medium leading-tight">{lead.companyName}</div>
                    {lead.contactName ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{lead.contactName}</div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      {lead.industry ? <Badge variant="outline">{lead.industry}</Badge> : null}
                      {lead.confidenceScore != null ? (
                        <Badge variant="secondary">{lead.confidenceScore}%</Badge>
                      ) : null}
                    </div>
                  </Link>
                </Card>
              ))}
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Drop here
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
