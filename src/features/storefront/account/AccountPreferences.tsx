import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/services/supabase/client";
import { localStore } from "@/lib/shared/browser-storage";
import { isOffline, OFFLINE_MESSAGE } from "@/lib/shared/network";

type Preferences = { delivery_updates: boolean; home_circle_notes: boolean };
const cache = new Map<string, { data: Preferences; at: number }>();
export const TEXT_SIZE_KEY = "cozycraft-text-size-v1";
export function applyTextSize(value: string | null) {
  const size = value === "large" ? "20px" : value === "comfortable" ? "18px" : "16px";
  document.documentElement.style.fontSize = size;
}
export function AccountPreferences({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [textSize, setTextSize] = useState(() => localStore.getItem(TEXT_SIZE_KEY) ?? "standard");
  const dirtyRef = useRef(false);
  const alive = useRef(true);
  const saveInFlight = useRef(false);
  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(saved);
  dirtyRef.current = Boolean(dirty);
  useEffect(() => {
    alive.current = true;
    let active = true;
    let inFlight = false;
    let queued = false;
    const apply = (data: Preferences) => {
      if (!active || dirtyRef.current) return;
      setSaved(data); setDraft(data); setNotice("");
    };
    const load = async (fresh = false) => {
      if (inFlight) { queued = queued || fresh; return; }
      const prior = cache.get(userId);
      if (!fresh && prior && Date.now() - prior.at < 300_000) { apply(prior.data); return; }
      inFlight = true;
      try {
        const { data, error } = await supabase.from("customer_preferences").select("delivery_updates,home_circle_notes").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        const value = { delivery_updates: data?.delivery_updates !== false, home_circle_notes: data?.home_circle_notes === true };
        if (active) { cache.set(userId, { data: value, at: Date.now() }); apply(value); }
      } catch { if (active) setNotice("Communication preferences couldn't be loaded. Try again when connected."); }
      finally { inFlight = false; if (queued && active) { queued = false; void load(true); } }
    };
    void load();
    const refresh = () => { void load(true); };
    window.addEventListener("online", refresh);
    const channel = supabase.channel(`web-preferences-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "customer_preferences", filter: `user_id=eq.${userId}` }, refresh).subscribe();
    return () => { active = false; alive.current = false; window.removeEventListener("online", refresh); void supabase.removeChannel(channel); };
  }, [userId, attempt]);
  const save = useCallback(async () => {
    if (!draft || saveInFlight.current) return;
    if (isOffline()) { setNotice(OFFLINE_MESSAGE); return; }
    const snapshot = { ...draft };
    saveInFlight.current = true;
    setBusy(true); setNotice("");
    try {
      const { error } = await supabase.from("customer_preferences").upsert({ user_id: userId, ...snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      if (!alive.current) return;
      cache.set(userId, { data: snapshot, at: Date.now() }); setSaved(snapshot); setNotice("Communication preferences saved across CozyCraft.");
    } catch { if (alive.current) setNotice("Preferences were not saved. Please reconnect and try again."); }
    finally { saveInFlight.current = false; if (alive.current) setBusy(false); }
  }, [busy, draft, userId]);
  return <section aria-label="Shopping preferences" className="mt-8 grid gap-6 rounded-2xl border border-border bg-[#fcfbf8] p-4 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Make yourself comfortable</p><h3 className="mt-2 font-serif text-2xl">Your shopping preferences.</h3></div>
    <fieldset><legend className="mb-3 text-sm font-semibold">Text size on this browser</legend><div className="flex flex-wrap gap-2">{["standard", "comfortable", "large"].map(size => <label key={size} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm capitalize"><input type="radio" name="cozy-text-size" checked={textSize === size} onChange={() => { setTextSize(size); localStore.setItem(TEXT_SIZE_KEY, size); applyTextSize(size); }} />{size}</label>)}</div></fieldset>
    <fieldset disabled={!draft || busy} className="grid gap-3"><legend className="mb-3 text-sm font-semibold">Communication preferences</legend>{([["delivery_updates", "Delivery updates", "Receive delivery-status notifications."], ["home_circle_notes", "Home Circle notes", "Opt in to promotional notes and store announcements."]] as const).map(([key, label, description]) => <label key={key} className="flex min-h-14 items-start gap-3 rounded-xl border border-border bg-card p-3"><input type="checkbox" checked={draft?.[key] ?? false} onChange={event => setDraft(current => current && ({ ...current, [key]: event.target.checked }))} className="mt-1 h-5 w-5 shrink-0"/><span><strong className="text-sm">{label}</strong><span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span></span></label>)}</fieldset>
    <p className="text-xs leading-6 text-muted-foreground">These preferences use the same account settings as the mobile app. Essential security and transaction messages are separate.</p>
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!dirty || busy} onClick={() => void save()} className="min-h-11 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving…" : "Save preferences"}</button>{!draft && <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 px-3 text-sm font-semibold underline">Retry loading</button>}</div>
    {notice && <p role="status" className="text-sm leading-6">{notice}</p>}
  </section>;
}
