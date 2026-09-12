import { useEffect } from "react";

const controls = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
const visible = (node: HTMLElement) => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== "hidden";

/** Keyboard fallback for legacy sheets. Native dialogs keep their own focus
 * handling; already-focused dialogs are never refocused while a user types. */
export function DialogAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let initiator: HTMLElement | null = null;
    const restore = new Map<HTMLElement, HTMLElement | null>();
    let frame = 0;
    const remember = (event: Event) => { initiator = (event.target as HTMLElement)?.closest<HTMLElement>(controls) ?? null; };
    const reconcile = () => {
      const native = document.querySelector("dialog[open]");
      const next = native ? null : Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(visible)
        .map((element, order) => {
          let layer = 0;
          for (let node: HTMLElement | null = element; node; node = node.parentElement) layer = Math.max(layer, parseInt(getComputedStyle(node).zIndex) || 0);
          return { element, layer, order };
        }).sort((a, b) => a.layer - b.layer || a.order - b.order).at(-1)?.element ?? null;
      if (next === active) return;
      const previous = active; active = next;
      if (previous && !previous.isConnected) {
        const target = restore.get(previous);
        if (!native && target?.isConnected && (!next || next.contains(target))) target.focus({ preventScroll: true });
        restore.delete(previous);
      }
      if (!next) return;
      if (!restore.has(next)) {
        const focused = document.activeElement as HTMLElement | null;
        restore.set(next, focused && focused !== document.body && !next.contains(focused) ? focused : initiator && !next.contains(initiator) ? initiator : null);
      }
      next.tabIndex = -1;
      if (!next.contains(document.activeElement) && !next.hasAttribute("data-cozy-focus-managed")) {
        next.focus({ preventScroll: true });
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (!active || event.defaultPrevented || active.hasAttribute("data-cozy-focus-managed")) return;
      const items = Array.from(active.querySelectorAll<HTMLElement>(controls)).filter(visible);
      if (event.key === "Escape") {
        const close = active.querySelector<HTMLButtonElement>('button[data-dialog-close]:not(:disabled), button[aria-label^="Close"]:not(:disabled)');
        if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
      }
      if (event.key !== "Tab") return;
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); event.stopPropagation(); active.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) { event.preventDefault(); event.stopPropagation(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); event.stopPropagation(); first.focus(); }
    };
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; reconcile(); }); });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", remember, true);
    reconcile();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", remember, true); };
  }, []);
  return null;
}
