import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Search, X, type LucideIcon } from "lucide-react";
import { useCountUp, usePresence } from "@/components/storefront/motion";
import { SlidingIndicator, useSlidingIndicator } from "@/components/storefront/SlidingIndicator";

type IconType = LucideIcon;
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "inverse";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  brand: "bg-brand text-brand-foreground",
  inverse: "bg-foreground text-background",
};

/* ------------------------------------------------------------------ */
/* Page structure                                                      */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 sm:mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}
          <h1 className="mt-1.5 font-serif text-[1.8rem] leading-[1.08] tracking-[-.02em] sm:text-[2.15rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  flat = false,
  as: Element = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  as?: "section" | "div" | "article" | "aside" | "form";
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <Element className={`${flat ? "adm-card-flat" : "adm-card"} min-w-0 ${className}`} {...rest}>
      {children}
    </Element>
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}
        <h2 className={`${eyebrow ? "mt-1" : ""} text-[15px] font-semibold leading-tight`}>{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Numbers and stats                                                   */
/* ------------------------------------------------------------------ */

export function CountUp({ value, format }: { value: number; format?: (value: number) => string }) {
  const current = useCountUp(Number.isFinite(value) ? value : 0, 700);
  return <>{format ? format(current) : Math.round(current).toLocaleString("en-PH")}</>;
}

export type StatItem = {
  label: string;
  value: number | string | null | undefined;
  format?: (value: number) => string;
  note?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  to?: string;
  emphasis?: boolean;
};

export function StatStrip({ items, loading = false, className = "" }: { items: StatItem[]; loading?: boolean; className?: string }) {
  const columns = items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div className={`adm-card grid grid-cols-2 overflow-hidden ${columns} ${className}`}>
      {items.map((item, index) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="adm-eyebrow leading-4">{item.label}</p>
              {item.icon && (
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${toneClasses[item.tone ?? "neutral"]}`}>
                  <item.icon size={14} />
                </span>
              )}
            </div>
            <p className="adm-num mt-2 truncate text-[1.55rem] font-semibold leading-none tracking-[-.02em] sm:text-[1.75rem]">
              {loading || item.value === null || item.value === undefined ? (
                <span className="adm-skeleton inline-block h-6 w-16 align-middle" />
              ) : typeof item.value === "number" ? (
                <CountUp value={item.value} format={item.format} />
              ) : (
                item.value
              )}
            </p>
            {item.note && <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.note}</p>}
          </>
        );
        const cell = `relative min-w-0 p-4 sm:p-5 ${index % 2 === 1 ? "border-l border-border" : ""} ${index >= 2 ? "border-t border-border lg:border-t-0" : ""} ${index > 0 ? "lg:border-l" : ""}`;
        return item.to ? (
          <Link key={item.label} to={item.to} className={`${cell} group transition-colors hover:bg-subtle`}>
            {body}
            <ArrowUpRight size={13} className="absolute bottom-3 right-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ) : (
          <div key={item.label} className={cell}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

export function Pill({ tone = "neutral", children, dot = false, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex min-h-[1.35rem] items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none ${toneClasses[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function LiveBadge({ live, liveLabel = "Live", offlineLabel = "Reconnecting…" }: { live: boolean; liveLabel?: string; offlineLabel?: string }) {
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${live ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink"}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${live ? "adm-live-dot" : "animate-pulse"}`} />
      {live ? liveLabel : offlineLabel}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`adm-skeleton block ${className}`} />;
}

export function BusyBar({ active, className = "" }: { active: boolean; className?: string }) {
  return <div aria-hidden="true" className={`adm-busy-bar transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"} ${className}`} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon?: IconType;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`adm-swap grid place-items-center text-center ${compact ? "px-4 py-8" : "px-6 py-14"} ${className}`}>
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-muted-foreground">
          <Icon size={19} />
        </span>
      )}
      <p className={`${Icon ? "mt-3" : ""} text-sm font-semibold`}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = "md", className = "" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const dimension = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs";
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-bold text-brand-foreground ${dimension} ${className}`} aria-hidden="true">
      {initials || "?"}
      {src && !failed && <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}

export function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined);
      }}
      className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground ${className}`}
    >
      {copied ? <Check size={12} className="text-success-ink" /> : <Copy size={12} />}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors ${checked ? "border-line-strong" : ""} ${className}`}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <b className="block text-sm font-semibold">{label}</b>
        {description && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? "bg-foreground" : "bg-switch-background"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform duration-200 [transition-timing-function:var(--ease-out)] ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

/** Pill tabs with a gliding highlight. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
}: {
  items: Array<{ value: T; label: ReactNode; count?: number | null }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const { containerRef, indicatorStyle } = useSlidingIndicator<HTMLDivElement>(value);
  return (
    <div role="tablist" aria-label={label} ref={containerRef} className={`relative inline-flex max-w-full gap-1 rounded-xl bg-secondary p-1 adm-scroll-x ${className}`}>
      <SlidingIndicator style={indicatorStyle} className="rounded-lg bg-card shadow-sm" />
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(item.value)}
            className={`relative z-[1] inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
            {item.count !== undefined && item.count !== null && <span className="adm-num rounded-full bg-background/70 px-1.5 text-[10px]">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        data-admin-search=""
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
          onKeyDown?.(event);
        }}
        placeholder={placeholder}
        className="adm-input h-11 pl-10 pr-16"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Clear search">
          <X size={14} />
        </button>
      ) : (
        <kbd className="adm-kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-grid">/</kbd>
      )}
    </label>
  );
}

export function Pagination({
  page,
  total,
  size,
  onChange,
  busy = false,
  label,
  className = "",
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
  busy?: boolean;
  label: string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);
  return (
    <nav aria-label={label} className={`flex items-center justify-between gap-3 border-t border-border bg-subtle/60 px-4 py-2.5 text-xs text-muted-foreground ${className}`}>
      <span aria-live="polite" className="adm-num">
        {total ? (
          <>
            <b className="text-foreground">{from.toLocaleString("en-PH")}–{to.toLocaleString("en-PH")}</b> of {total.toLocaleString("en-PH")}
          </>
        ) : (
          "No results"
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="adm-num mr-1 hidden sm:inline">
          Page {page} of {pages}
        </span>
        <button type="button" disabled={busy || page <= 1} onClick={() => onChange(page - 1)} className="adm-btn adm-btn-sm adm-btn-icon" aria-label="Previous page">
          <ChevronLeft size={15} />
        </button>
        <button type="button" disabled={busy || page >= pages} onClick={() => onChange(page + 1)} className="adm-btn adm-btn-sm adm-btn-icon" aria-label="Next page">
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function useOverlayBehaviour(open: boolean, onClose: () => void, lockScroll = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (lockScroll) document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, lockScroll]);
}

/** Right-side panel from tablet up, full-height sheet on phones. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = "max-w-2xl",
  headerAction,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  headerAction?: ReactNode;
}) {
  const { mounted, state } = usePresence(open, 220);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose);
  useEffect(() => {
    if (open) window.setTimeout(() => panelRef.current?.focus(), 20);
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <div data-state={state} className="cc-backdrop absolute inset-0 bg-[#161412]/45 backdrop-blur-[2px]" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-state={state}
        className={`cc-sheet absolute inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),.75rem)] flex flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-card text-card-foreground shadow-[var(--adm-shadow-pop)] md:inset-y-3 md:left-auto md:right-3 md:top-3 md:w-full md:rounded-[1.5rem] ${width}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="truncate text-base font-semibold">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerAction}
            <button type="button" onClick={onClose} className="adm-btn adm-btn-icon adm-btn-sm" aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Centred dialog from tablet up, bottom sheet on phones. */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "max-w-lg",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: string;
  busy?: boolean;
}) {
  const { mounted, state } = usePresence(open, 200);
  const titleId = useId();
  const safeClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  useOverlayBehaviour(open, safeClose);
  if (!mounted) return null;
  return createPortal(
    <div data-state={state} className="cc-backdrop fixed inset-0 z-[210] grid place-items-end bg-[#161412]/55 backdrop-blur-[2px] sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) safeClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-state={state} className={`cc-quickview flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-card text-card-foreground shadow-[var(--adm-shadow-pop)] sm:rounded-[1.5rem] ${size}`}>
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
          <div className="min-w-0">
            {eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 font-serif text-[1.55rem] leading-tight">{title}</h2>
          </div>
          <button type="button" onClick={safeClose} disabled={busy} className="adm-btn adm-btn-icon adm-btn-sm" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-3.5 pb-[max(.875rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export type MenuItem = {
  label: string;
  icon?: IconType;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  hint?: string;
};

/** Accessible overflow menu with outside-click and Escape handling. */
export function ActionMenu({ label, items, align = "right", trigger }: { label: string; items: MenuItem[]; align?: "left" | "right"; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { mounted, state } = usePresence(open, 140);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus(), 10);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`adm-btn adm-btn-ghost adm-btn-sm ${trigger ? "" : "adm-btn-icon"}`}
      >
        {trigger ?? <MoreHorizontal size={17} />}
      </button>
      {mounted && (
        <div id={menuId} role="menu" data-state={state} className={`cc-popover absolute top-[calc(100%+6px)] z-40 w-52 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--adm-shadow-pop)] ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none disabled:opacity-40 ${item.tone === "danger" ? "text-danger-ink" : ""}`}
            >
              {item.icon && <item.icon size={14} />}
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-[10px] text-muted-foreground">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string) {
  const get = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

export type NoticeTone = "success" | "error" | "info";
export type Notice = { message: string; tone?: NoticeTone; action?: { label: string; onClick: () => void } } | null;

/** Toast state with an explicit tone so failures never look like successes. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const notify = useCallback((message: string, tone: NoticeTone = "success", action?: { label: string; onClick: () => void }) => {
    setNotice({ message, tone, action });
  }, []);
  const report = useCallback((error: string | null | undefined, success: string, action?: { label: string; onClick: () => void }) => {
    setNotice(error ? { message: error, tone: "error" } : { message: success, tone: "success", action });
  }, []);
  const clear = useCallback(() => setNotice(null), []);
  return { notice, notify, report, clear };
}

/** Ignore single-key shortcuts while someone is typing. */
export function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}
