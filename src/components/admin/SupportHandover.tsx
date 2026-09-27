import { useEffect, useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { adminSupabase } from "@/services/supabase/client";
import { formatDateTime } from "@/lib/admin/format";

type Note = { id: string; body: string; created_at: string; author_id: string };
export function SupportHandover({ ticketId, authorId }: { ticketId: string; authorId: string | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    void adminSupabase.from("support_internal_notes").select("id,body,created_at,author_id").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(20).abortSignal(controller.signal).then(({ data, error: issue }) => {
      if (!active) return;
      setNotes((data ?? []) as Note[]);
      setError(issue?.message ?? "");
      setLoading(false);
      window.clearTimeout(timeout);
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [ticketId, revision, open]);
  const save = async () => {
    if (busy || draft.trim().length < 3 || !authorId) return;
    setBusy(true);
    setError("");
    const sent = draft.trim();
    try {
      const { error: issue } = await adminSupabase.from("support_internal_notes").insert({ ticket_id: ticketId, body: draft.trim(), author_id: authorId });
      if (issue) throw issue;
      setDraft((current) => (current.trim() === sent ? "" : current));
      setRevision((value) => value + 1);
    } catch {
      setError("The internal note could not be saved. Your draft is still here; please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="group mt-4 rounded-2xl border border-dashed border-line-strong bg-warning-soft/40 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <NotebookPen size={15} className="text-warning-ink" />
        Staff handover
        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Internal only</span>
        <ChevronDown size={14} className="ml-auto text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Notes stay with this ticket and are never shown to the customer.</p>
      <label className="adm-label mt-3">
        Add a handover note
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} className="adm-textarea bg-card font-normal" placeholder="What has been checked and what should the next staff member do?" />
      </label>
      <button type="button" disabled={busy || draft.trim().length < 3} onClick={() => void save()} className="adm-btn adm-btn-sm mt-2">{busy ? "Saving note…" : "Save internal note"}</button>
      {error && <p role="alert" className="mt-2 text-xs text-danger-ink">{error} <button className="underline" onClick={() => setRevision((value) => value + 1)}>Reload notes</button></p>}
      {loading ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">Loading notes…</p>
      ) : (
        <ol className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-border bg-card p-3">
              <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
              <p className="mt-2 text-[10.5px] text-muted-foreground">{note.author_id === authorId ? "You" : "Team member"} · {formatDateTime(note.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
      {!loading && !notes.length && !error && <p className="mt-3 text-xs text-muted-foreground">No internal notes yet.</p>}
      {notes.length === 20 && <p className="mt-2 text-[10.5px] text-muted-foreground">Showing the latest 20 notes.</p>}
    </details>
  );
}
