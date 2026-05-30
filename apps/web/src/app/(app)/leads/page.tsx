import { apiServerFetch } from "@/lib/api/server";
import type { LeadDto, Paginated, PipelineStageDto } from "@gtm/shared";
import { LeadsTable } from "./_components/leads-table";
import { NewLeadButton } from "./_components/new-lead-button";
import { ImportLeadsButton } from "./_components/import-leads-button";
import { EnrollLeadsButton } from "./_components/enroll-leads-button";

interface SearchParams {
  search?: string;
  stageId?: string;
  industry?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [paginated, stages] = await Promise.all([
    apiServerFetch<Paginated<LeadDto>>("/leads", {
      searchParams: {
        limit: 100,
        search: params.search,
        stageId: params.stageId,
        industry: params.industry,
      },
    }),
    apiServerFetch<PipelineStageDto[]>("/pipeline/stages"),
  ]);

  return (
    <div className="container max-w-7xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {paginated.items.length} {paginated.items.length === 1 ? "lead" : "leads"} in your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnrollLeadsButton
            leads={paginated.items}
            label={`Enroll ${paginated.items.length} ${paginated.items.length === 1 ? "lead" : "leads"}`}
          />
          <ImportLeadsButton />
          <NewLeadButton stages={stages} />
        </div>
      </div>

      <LeadsTable initial={paginated} stages={stages} initialFilters={params} />
    </div>
  );
}
