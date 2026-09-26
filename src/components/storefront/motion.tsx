import { useEffect, useRef, useState } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.(reducedMotionQuery).matches);

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const query = window.matchMedia?.(reducedMotionQuery);
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/**
 * Keeps an overlay mounted long enough to play its exit animation. Consumers
 * render while `mounted` and put `state` on `data-state` for storefront.css.
 */
export function usePresence(open: boolean, exitMs = 240) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted: open || mounted, state: open ? "open" : "closed" } as const;
}

/**
 * Reveals every `[data-reveal]` element once it scrolls into view. Content
 * stays visible when IntersectionObserver is missing or motion is reduced.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      root.classList.remove("cc-reveal-on");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const watch = (scope: ParentNode) => {
      scope.querySelectorAll?.("[data-reveal]:not([data-revealed])").forEach((node) => observer.observe(node));
    };
    root.classList.add("cc-reveal-on");
    watch(document);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("[data-reveal]:not([data-revealed])")) observer.observe(node);
          watch(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    // Never leave content hidden if an element is never reported (e.g. print).
    const safety = window.setTimeout(() => {
      document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) node.setAttribute("data-revealed", "");
      });
    }, 2500);
    return () => {
      window.clearTimeout(safety);
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
  return null;
}

/** True once the element has entered the viewport (or immediately without IO). */
export function useInView<T extends Element>(options: IntersectionObserverInit = {}, once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { root = null, rootMargin = "0px", threshold = 0 } = options;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting && once) observer.disconnect();
    }, { root, rootMargin, threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold, once]);
  return [ref, inView] as const;
}

/** Eases a number toward its target, used for totals and counters. */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target || prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      current.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const next = from + (target - from) * eased;
      current.current = next;
      setValue(progress === 1 ? target : next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/** Smoothly collapses a row before it is removed from the list. */
export function collapseElement(element: HTMLElement | null, duration = 360) {
  if (!element || prefersReducedMotion() || typeof element.animate !== "function") return Promise.resolve();
  const height = element.getBoundingClientRect().height;
  const style = getComputedStyle(element);
  const animation = element.animate(
    [
      { height: `${height}px`, opacity: 1, transform: "translateX(0)", paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: `${height}px`, opacity: 0, transform: "translateX(-16px)", offset: 0.45, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: "0px", opacity: 0, transform: "translateX(-16px)", paddingTop: "0px", paddingBottom: "0px" },
    ],
    { duration, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" },
  );
  element.style.overflow = "hidden";
  return animation.finished.then(() => undefined, () => undefined);
}
