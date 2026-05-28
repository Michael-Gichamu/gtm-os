import Link from "next/link";
import { apiServerFetch } from "@/lib/api/server";
import type { ActivityDto } from "@gtm/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

export default async function ActivityPage() {
  const items = await apiServerFetch<ActivityDto[]>("/activities", { searchParams: { limit: 200 } });

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Every state-changing event in this workspace</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>{items.length} events</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="space-y-3">
              {items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {humanize(a.type)}{" "}
                      {a.leadId ? (
                        <Link href={`/leads/${a.leadId}`} className="font-normal text-muted-foreground hover:underline">
                          → view lead
                        </Link>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.actorName ?? "system"} · {formatRelative(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function humanize(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
