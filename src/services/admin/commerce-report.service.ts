import { adminSupabase } from "@/services/supabase/client";
import { reportFilterError, type CommerceReport, type CommerceReportDetails, type CommerceReportFilters, type CommerceReportKind, type CommerceReportPage } from "@/lib/admin/commerce-report";

export async function loadCommerceReport(kind: CommerceReportKind, filters: CommerceReportFilters, details: CommerceReportDetails, format: "csv" | "pdf", signal: AbortSignal, progress: (count: number, total: number) => void): Promise<CommerceReport> {
  const invalid = reportFilterError(filters);
  if (invalid) throw new Error(invalid);
  const rows: CommerceReportPage["rows"] = [];
  let first: CommerceReportPage | undefined;
  let after: CommerceReportPage["nextCursor"] = null;
  const seen = new Set<string>();
  for (let page = 0; page < 201; page++) {
    if (signal.aborted) throw new Error("Export cancelled.");
    const { data, error } = await adminSupabase.rpc("admin_commerce_report_page", {
      p_kind: kind, p_filters: filters, p_details: details, p_size: 250, p_after: after, p_as_of: first?.asOf ?? null,
    }).abortSignal(signal);
    if (error) throw new Error(error.message || "The report could not be loaded. Please retry.");
    const batch = data as CommerceReportPage | null;
    if (!batch || !Array.isArray(batch.rows) || !Number.isSafeInteger(batch.total) || batch.total < 0 || !batch.summary || !batch.snapshotKey || !Number.isFinite(Date.parse(batch.asOf))) throw new Error("The report response is incomplete. Please retry.");
    if (!first) {
      first = batch;
      const limit = format === "pdf" ? 5000 : 50_000;
      if (batch.total > limit) throw new Error(`This ${format.toUpperCase()} contains more than ${limit.toLocaleString()} records. Narrow the dates or filters${format === "pdf" ? ", or choose CSV" : ""}.`);
    } else if (first.snapshotKey !== batch.snapshotKey || first.total !== batch.total || first.asOf !== batch.asOf) {
      throw new Error("Orders or payments changed while preparing the report. Please export again for a consistent result.");
    }
    for (const row of batch.rows) {
      if (!row.id || seen.has(row.id)) throw new Error("Report pagination could not be verified. Please retry.");
      seen.add(row.id); rows.push(row);
    }
    progress(rows.length, first.total);
    if (!batch.hasMore) {
      if (rows.length !== first.total) throw new Error("The complete report could not be loaded. Please retry.");
      return { ...first, rows, kind, filters: { ...filters }, details: { ...details } };
    }
    if (!batch.nextCursor || batch.rows.length === 0 || JSON.stringify(after) === JSON.stringify(batch.nextCursor)) throw new Error("Report pagination stopped unexpectedly. Please retry.");
    after = batch.nextCursor;
  }
  throw new Error("The report is too large. Narrow the dates or filters.");
}

export function downloadReportBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
