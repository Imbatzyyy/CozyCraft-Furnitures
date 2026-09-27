import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { usePresence } from "@/components/storefront/motion";

type BaseOptions = {
  title: string;
  description?: ReactNode;
  /** Plain-text fallback when no dialog host is mounted (tests, early screens). */
  fallbackText?: string;
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  eyebrow?: string;
};

export type ConfirmOptions = BaseOptions & {
  /** Ask the person to type this exact text before the action unlocks. */
  requireText?: string;
};

export type PromptOptions = BaseOptions & {
  label: string;
  placeholder?: string;
  initialValue?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
};

type Request =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

let enqueue: ((request: Request) => void) | null = null;

const plainText = (options: BaseOptions) =>
  [options.title, options.fallbackText ?? (typeof options.description === "string" ? options.description : "")]
    .filter(Boolean)
    .join("\n\n");

/** Styled confirmation. Resolves false when dismissed. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!enqueue) {
    return Promise.resolve(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(plainText(options)) : false);
  }
  const push = enqueue;
  return new Promise((resolve) => push({ kind: "confirm", options, resolve }));
}

/** Styled single-field prompt. Resolves null when dismissed. */
export function promptAction(options: PromptOptions): Promise<string | null> {
  if (!enqueue) {
    return Promise.resolve(typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt(plainText(options), options.initialValue ?? "") : null);
  }
  const push = enqueue;
  return new Promise((resolve) => push({ kind: "prompt", options, resolve }));
}

/** Mounted once by the admin shell; renders queued confirmations one at a time. */
export function ConfirmHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  useEffect(() => {
    enqueue = (request) => setQueue((current) => [...current, request]);
    return () => {
      enqueue = null;
    };
  }, []);
  const active = queue[0] ?? null;
  const finish = (value: boolean | string | null) => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(Boolean(value));
    else active.resolve(typeof value === "string" ? value : null);
    setQueue((current) => current.slice(1));
  };
  return <ConfirmDialog request={active} finish={finish} />;
}

function ConfirmDialog({ request, finish }: { request: Request | null; finish: (value: boolean | string | null) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const [shown, setShown] = useState<Request | null>(request);
  const { mounted, state } = usePresence(Boolean(request), 200);
  const [typed, setTyped] = useState("");
  const [value, setValue] = useState(request?.kind === "prompt" ? request.options.initialValue ?? "" : "");
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!request) return;
    setShown(request);
    setTyped("");
    setError("");
    setValue(request.kind === "prompt" ? request.options.initialValue ?? "" : "");
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      if (request.kind === "prompt" || request.options.requireText) inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishRef.current(request.kind === "confirm" ? false : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [request]);

  const current = request ?? shown;
  if (!mounted || !current) return null;
  const { options } = current;
  const danger = options.tone === "danger";
  const requireText = current.kind === "confirm" ? current.options.requireText : undefined;
  const locked = Boolean(requireText && typed.trim() !== requireText);
  const submit = () => {
    if (!request) return;
    if (request.kind === "prompt") {
      const trimmed = value.trim();
      const issue = request.options.validate?.(trimmed) ?? (trimmed ? null : `${request.options.label} is required.`);
      if (issue) {
        setError(issue);
        inputRef.current?.focus();
        return;
      }
      finish(trimmed);
      return;
    }
    if (locked) return;
    finish(true);
  };

  return createPortal(
    <div
      data-state={state}
      className="cc-backdrop fixed inset-0 z-[300] grid place-items-end bg-[#161412]/55 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) finish(current.kind === "confirm" ? false : null);
      }}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.description ? descriptionId : undefined}
        data-state={state}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="cc-quickview w-full max-w-md rounded-t-[1.5rem] border border-border bg-card p-6 text-card-foreground shadow-[var(--adm-shadow-pop)] sm:rounded-[1.5rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${danger ? "bg-danger-soft text-danger-ink" : "bg-secondary text-foreground"}`}>
            {danger ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />}
          </span>
          <button type="button" onClick={() => finish(current.kind === "confirm" ? false : null)} className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {options.eyebrow && <p className={`mt-4 adm-eyebrow ${danger ? "!text-danger-ink" : ""}`}>{options.eyebrow}</p>}
        <h2 id={titleId} className={`${options.eyebrow ? "mt-1.5" : "mt-4"} font-serif text-[1.65rem] leading-tight`}>{options.title}</h2>
        {options.description && <div id={descriptionId} className="mt-2.5 text-sm leading-6 text-muted-foreground">{options.description}</div>}
        {options.details && <div className="mt-4 rounded-xl border border-border bg-subtle p-3.5 text-xs leading-5">{options.details}</div>}
        {current.kind === "prompt" && (
          <label className="adm-label mt-5">
            {current.options.label}
            <input
              ref={inputRef}
              value={value}
              maxLength={current.options.maxLength ?? 120}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              placeholder={current.options.placeholder}
              className="adm-input font-normal"
              aria-invalid={Boolean(error)}
            />
            {error && <span role="alert" className="text-xs font-semibold text-danger-ink">{error}</span>}
          </label>
        )}
        {requireText && (
          <label className="adm-label mt-5">
            <span>Type <b className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px]">{requireText}</b> to confirm</span>
            <input ref={inputRef} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} className="adm-input font-normal" />
          </label>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => finish(current.kind === "confirm" ? false : null)} className="adm-btn">
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button ref={confirmRef} type="submit" disabled={locked} className={`adm-btn ${danger ? "adm-btn-danger" : "adm-btn-primary"}`}>
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
