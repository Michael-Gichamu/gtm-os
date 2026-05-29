"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { api, ClientApiError } from "@/lib/api/client";
import type { LeadImportResult } from "@gtm/shared";
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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Bulk-import leads from CSV or Excel.
 *
 * Flow:
 *   1. Operator picks a file (CSV / .xlsx).
 *   2. We parse client-side and auto-detect columns by header heuristics.
 *   3. Show preview + counts, then send the normalized rows to /leads/import.
 *   4. Backend dedupes by email-in-workspace and returns a summary.
 */

// Header heuristic — lowercased + alphanumeric-only -> target lead field.
// Order matters: first match wins. Easy to extend later.
const HEADER_MAP: Record<string, string> = {
  // company
  companyname: "companyName", company: "companyName", business: "companyName",
  organisation: "companyName", organization: "companyName", clinic: "companyName",
  firm: "companyName", account: "companyName",
  // contact
  contactname: "contactName", contact: "contactName", name: "contactName",
  firstname: "contactName", fullname: "contactName",
  // email
  email: "email", emailaddress: "email", workemail: "email",
  // phone
  phone: "phone", phonenumber: "phone", mobile: "phone", tel: "phone",
  // web
  website: "website", url: "website", site: "website", web: "website",
  // linkedin
  linkedin: "linkedinUrl", linkedinurl: "linkedinUrl", linkedinprofile: "linkedinUrl",
  // industry
  industry: "industry", vertical: "industry", sector: "industry", category: "industry",
  // location
  city: "city", town: "city",
  country: "country", region: "country",
  // role
  role: "role", title: "role", position: "role", jobtitle: "role", job: "role",
  // misc
  source: "source", leadsource: "source",
  personalization: "personalization", note: "personalization", notes: "personalization",
};

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface ParsedRow {
  [field: string]: string | number | undefined;
}

interface PreparedImport {
  headers: string[];
  mapping: Record<string, string>; // original header -> lead field
  unmapped: string[];
  rows: Record<string, unknown>[]; // normalized lead drafts ready for the API
  totalRows: number;
}

function prepareRows(headers: string[], rawRows: ParsedRow[]): PreparedImport {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const h of headers) {
    const target = HEADER_MAP[normHeader(h)];
    if (target) mapping[h] = target;
    else unmapped.push(h);
  }

  const rows: Record<string, unknown>[] = [];
  for (const raw of rawRows) {
    const lead: Record<string, unknown> = {};
    for (const [origHeader, targetField] of Object.entries(mapping)) {
      const v = raw[origHeader];
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s) continue;
      // confidenceScore is numeric in our schema — handled by zod coerce.
      lead[targetField] = s;
    }
    // Only include rows with at least a companyName (required by our schema).
    if (lead.companyName) rows.push(lead);
  }

  return {
    headers,
    mapping,
    unmapped,
    rows,
    totalRows: rawRows.length,
  };
}

async function parseFile(file: File): Promise<PreparedImport> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (results) => {
          const headers = (results.meta.fields ?? []).filter(Boolean) as string[];
          resolve(prepareRows(headers, results.data));
        },
        error: (err) => reject(err),
      });
    });
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) throw new Error("Spreadsheet has no sheets");
    const sheet = wb.Sheets[firstSheet];
    if (!sheet) throw new Error("Spreadsheet sheet missing");
    const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
    const headers = json[0] ? Object.keys(json[0]) : [];
    return prepareRows(headers, json);
  }
  throw new Error("Unsupported file. Please upload a .csv or .xlsx file.");
}

export function ImportLeadsButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [prepared, setPrepared] = React.useState<PreparedImport | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<LeadImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setPrepared(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    try {
      const p = await parseFile(file);
      setPrepared(p);
      if (Object.keys(p.mapping).length === 0) {
        toast.warning("No columns could be auto-mapped. Check that your file has headers like Company, Email, Name…");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function doImport() {
    if (!prepared || prepared.rows.length === 0) return;
    setSubmitting(true);
    try {
      const r = await api<LeadImportResult>("/leads/import", {
        method: "POST",
        body: { leads: prepared.rows },
      });
      setResult(r);
      toast.success(
        `Imported ${r.imported} ${r.imported === 1 ? "lead" : "leads"}` +
          (r.skipped ? `, ${r.skipped} duplicate${r.skipped === 1 ? "" : "s"} skipped` : "") +
          (r.errors.length ? `, ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}` : ""),
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-1 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel (.xlsx) file. Columns are auto-detected from headers like
            <span className="font-mono"> Company</span>, <span className="font-mono">Email</span>,
            <span className="font-mono"> Phone</span>, <span className="font-mono">Industry</span>, etc.
            Existing emails in your workspace are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!prepared && !result && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors hover:bg-muted/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
          >
            <FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground" />
            <div className="mb-1 text-sm font-medium">Drop a file here, or click to choose</div>
            <div className="text-xs text-muted-foreground">.csv or .xlsx</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? "Parsing…" : "Choose file"}
            </Button>
          </div>
        )}

        {prepared && !result && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">
                Ready to import {prepared.rows.length} {prepared.rows.length === 1 ? "lead" : "leads"}
              </div>
              <div className="text-xs text-muted-foreground">
                {prepared.totalRows} row{prepared.totalRows === 1 ? "" : "s"} in file ·{" "}
                {prepared.totalRows - prepared.rows.length} skipped (missing company name)
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Detected columns
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(prepared.mapping).map(([orig, target]) => (
                  <span
                    key={orig}
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{orig}</span> →{" "}
                    <span className="font-medium">{target}</span>
                  </span>
                ))}
              </div>
              {prepared.unmapped.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Ignored columns: {prepared.unmapped.join(", ")}
                </div>
              )}
            </div>

            {prepared.rows.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Preview (first 5)
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        {Object.values(prepared.mapping).slice(0, 6).map((field) => (
                          <th key={field} className="px-2 py-1.5 text-left font-medium">{field}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prepared.rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {Object.values(prepared.mapping).slice(0, 6).map((field) => (
                            <td key={field} className="px-2 py-1.5">
                              {(r[field] as string) ?? <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Choose a different file</Button>
              <Button onClick={doImport} disabled={submitting || prepared.rows.length === 0}>
                {submitting ? "Importing…" : `Import ${prepared.rows.length} leads`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-md border bg-emerald-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Imported {result.imported} {result.imported === 1 ? "lead" : "leads"}
              </div>
              {result.skipped > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {result.skipped} duplicate{result.skipped === 1 ? "" : "s"} skipped (email already in workspace)
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border bg-destructive/10 p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} row error{result.errors.length === 1 ? "" : "s"}
                </div>
                <div className="max-h-40 space-y-0.5 overflow-auto text-xs">
                  {result.errors.slice(0, 20).map((e) => (
                    <div key={e.row}>
                      <span className="text-muted-foreground">Row {e.row}:</span> {e.error}
                    </div>
                  ))}
                  {result.errors.length > 20 && (
                    <div className="text-muted-foreground">…and {result.errors.length - 20} more</div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Import another file</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
