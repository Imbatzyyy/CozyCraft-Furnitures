// One set of Philippine-time formats for every operations screen.
const timeZone = "Asia/Manila";

const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone, month: "short", day: "numeric", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("en-PH", { timeZone, weekday: "long", month: "short", day: "numeric" });
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

const valid = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "Sep 27, 2026" */
export function formatDate(value: string | number | Date | null | undefined, fallback = "—") {
  const date = valid(value);
  return date ? dateFormatter.format(date) : fallback;
}

/** "8:05 AM" */
export function formatTime(value: string | number | Date | null | undefined, fallback = "—") {
  const date = valid(value);
  return date ? timeFormatter.format(date) : fallback;
}

/** "Sep 27, 2026 · 8:05 AM" */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = "—") {
  const date = valid(value);
  return date ? `${dateFormatter.format(date)} · ${timeFormatter.format(date)}` : fallback;
}

/** Calendar day in Manila, e.g. "2026-09-27", for grouping. */
export function manilaDayKey(value: string | number | Date) {
  const date = valid(value);
  return date ? dayKeyFormatter.format(date) : "";
}

/** "Today", "Yesterday", or "Friday, Sep 25". */
export function dayLabel(value: string | number | Date, now: Date = new Date()) {
  const date = valid(value);
  if (!date) return "";
  const key = manilaDayKey(date);
  if (key === manilaDayKey(now)) return "Today";
  if (key === manilaDayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return weekdayFormatter.format(date);
}

/** "Just now", "12m ago", "3h ago", "Yesterday", "4d ago", then the date. */
export function relativeTime(value: string | number | Date | null | undefined, now: Date = new Date()) {
  const date = valid(value);
  if (!date) return "—";
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  // Beyond a day, count Manila calendar days so labels match day groupings.
  const days = Math.round((Date.parse(manilaDayKey(now)) - Date.parse(manilaDayKey(date))) / 86_400_000);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/** Compact age for queues: "18m", "5h", "3d". */
export function ageLabel(value: string | number | Date | null | undefined, now: Date = new Date()) {
  const date = valid(value);
  if (!date) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function hoursSince(value: string | number | Date | null | undefined, now: Date = new Date()) {
  const date = valid(value);
  return date ? Math.max(0, (now.getTime() - date.getTime()) / 3_600_000) : 0;
}

/** "1 order", "3 orders", "2 boxes" (with an explicit plural). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString("en-PH")} ${count === 1 ? singular : pluralForm}`;
}

/** "Pending", "In progress", "Refund processing" from snake_case values. */
export function humanize(value: string | null | undefined) {
  const text = String(value ?? "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** 1.2K, 4.2M */
export function compactNumber(value: number) {
  return new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
