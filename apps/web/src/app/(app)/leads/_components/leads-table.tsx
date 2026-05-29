"use client";
import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LeadDto, Paginated, PipelineStageDto } from "@gtm/shared";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelative } from "@/lib/utils";
import { LeadDetailSheet } from "./lead-detail-sheet";

interface Props {
  initial: Paginated<LeadDto>;
  stages: PipelineStageDto[];
  initialFilters: { search?: string; stageId?: string; industry?: string };
}

export function LeadsTable({ initial, stages, initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState(initialFilters.search ?? "");
  const [openLeadId, setOpenLeadId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Debounce search -> URL update so back/forward + bookmarking work.
  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      router.replace(`${pathname}?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const stageId = params.get("stageId") ?? undefined;
  const industry = params.get("industry") ?? undefined;

  const { data } = useQuery({
    queryKey: ["leads", { search, stageId, industry }],
    queryFn: () =>
      api<Paginated<LeadDto>>("/leads", {
        searchParams: { limit: 100, search, stageId, industry },
      }),
    initialData: initial,
  });

  const industries = Array.from(
    new Set((data?.items ?? []).map((l) => l.industry).filter(Boolean)),
  ) as string[];

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const openLead = (id: string) => {
    setOpenLeadId(id);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search company, contact, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={stageId ?? "__all"}
          onValueChange={(v) => setParam("stageId", v === "__all" ? undefined : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {industries.length > 0 && (
          <Select
            value={industry ?? "__all"}
            onValueChange={(v) => setParam("industry", v === "__all" ? undefined : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All industries</SelectItem>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Industry</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
              <th className="px-4 py-3 text-left font-medium">Stage</th>
              <th className="px-4 py-3 text-left font-medium">Confidence</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data!.items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No leads yet. Click <span className="font-medium">New Lead</span> or
                  <span className="font-medium"> Import</span> to add some.
                </td>
              </tr>
            ) : (
              data!.items.map((l) => {
                const stage = stages.find((s) => s.id === l.pipelineStageId);
                return (
                  <tr
                    key={l.id}
                    onClick={() => openLead(l.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{l.companyName}</div>
                      {l.city || l.country ? (
                        <div className="text-xs text-muted-foreground">
                          {[l.city, l.country].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.contactName ?? <span className="text-muted-foreground">—</span>}
                      {l.role ? (
                        <div className="text-xs text-muted-foreground">{l.role}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.email ? (
                        <a
                          href={`mailto:${l.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {l.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.phone ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {l.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {l.source ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.pipelineStageName ? (
                        <Badge variant={stage?.semantic === "WON" ? "success" : "secondary"}>
                          {l.pipelineStageName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.confidenceScore == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ConfidenceBar value={l.confidenceScore} />
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                      {formatRelative(l.updatedAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LeadDetailSheet
        leadId={openLeadId}
        stages={stages}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setOpenLeadId(null);
        }}
        onMutated={() => {
          qc.invalidateQueries({ queryKey: ["leads"] });
          router.refresh();
        }}
      />
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 75 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-muted-foreground/50";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{v}</span>
    </div>
  );
}
