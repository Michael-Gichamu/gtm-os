"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import type { PipelineStageDto } from "@gtm/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeadStageSelector({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string | null;
  stages: PipelineStageDto[];
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(currentStageId ?? "");
  const [pending, startTransition] = React.useTransition();

  async function onChange(next: string) {
    setValue(next);
    try {
      await api(`/leads/${leadId}/move-stage`, {
        method: "POST",
        body: { pipelineStageId: next },
      });
      toast.success("Stage updated");
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof ClientApiError ? e.message : "Failed to update stage";
      toast.error(msg);
      setValue(currentStageId ?? "");
    }
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-72">
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
  );
}
