import Link from "next/link";
import { apiServerFetch } from "@/lib/api/server";
import type { LeadDto, Paginated, PipelineStageDto } from "@gtm/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { Trophy } from "lucide-react";

/**
 * Clients view — Won leads.
 *
 * In our model a Lead doesn't graduate to a separate Client entity (that
 * would force a hard data fork); instead, Lead with a stage whose semantic
 * is WON IS a Client. This page is the same dataset, filtered. Splitting to
 * a real Account/Customer model is a Phase 7 concern when multi-stakeholder
 * selling enters.
 */
export default async function ClientsPage() {
  const [paginated, stages] = await Promise.all([
    apiServerFetch<Paginated<LeadDto>>("/leads", {
      searchParams: { limit: 200, semantic: "WON" },
    }),
    apiServerFetch<PipelineStageDto[]>("/pipeline/stages"),
  ]);
  const wonStageNames = new Set(stages.filter((s) => s.semantic === "WON").map((s) => s.name));

  return (
    <div className="container max-w-7xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-emerald-500/15 p-2 text-emerald-500">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Leads you've won. {paginated.items.length} {paginated.items.length === 1 ? "client" : "clients"} so far.
          </p>
        </div>
      </div>

      {paginated.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No clients yet</CardTitle>
            <CardDescription>
              When you move a lead into a {Array.from(wonStageNames).map((s) => `"${s}"`).join(" or ") || `"Won"`}
              {" "}stage, it shows up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {paginated.items.map((c) => (
            <Link key={c.id} href={`/leads/${c.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.companyName}</CardTitle>
                    <Badge variant="success">Client</Badge>
                  </div>
                  <CardDescription>
                    {c.industry ?? "—"}
                    {c.city || c.country ? ` · ${[c.city, c.country].filter(Boolean).join(", ")}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {c.contactName && (
                    <div>
                      <span className="text-muted-foreground">Contact: </span>
                      {c.contactName}
                      {c.role ? ` (${c.role})` : ""}
                    </div>
                  )}
                  {c.email && (
                    <div className="truncate">
                      <span className="text-muted-foreground">Email: </span>
                      {c.email}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-2">
                    Won {formatRelative(c.updatedAt)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
