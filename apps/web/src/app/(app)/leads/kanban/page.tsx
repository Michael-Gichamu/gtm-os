import { apiServerFetch } from "@/lib/api/server";
import type { LeadDto, Paginated, PipelineStageDto } from "@gtm/shared";
import { KanbanBoard } from "./_components/kanban-board";

export default async function KanbanPage() {
  const [stages, paginated] = await Promise.all([
    apiServerFetch<PipelineStageDto[]>("/pipeline/stages"),
    apiServerFetch<Paginated<LeadDto>>("/leads", { searchParams: { limit: 200 } }),
  ]);

  return (
    <div className="container max-w-[1600px] space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag leads between stages to move them.
        </p>
      </div>
      <KanbanBoard stages={stages} leads={paginated.items} />
    </div>
  );
}
