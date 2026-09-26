export function DataPagination({ page, total, size, onChange, busy = false, label }: {
  page: number; total: number; size: number; onChange: (page: number) => void; busy?: boolean; label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav aria-label={label} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-xs">
    <span aria-live="polite">{busy ? "Updating…" : total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}` : "No results"}</span>
    <div className="flex items-center gap-3">
      <button type="button" disabled={busy || page <= 1} onClick={() => onChange(page - 1)} className="min-h-11 rounded-xl border border-border px-3 font-semibold disabled:opacity-40">Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" disabled={busy || page >= pages} onClick={() => onChange(page + 1)} className="min-h-11 rounded-xl border border-border px-3 font-semibold disabled:opacity-40">Next</button>
    </div>
  </nav>;
}
