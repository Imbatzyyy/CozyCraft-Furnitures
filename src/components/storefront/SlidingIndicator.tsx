import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Measures the `[data-active="true"]` child of a relatively positioned
 * container and returns a style that glides a highlight onto it.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeKey: string | number | boolean) {
  const containerRef = useRef<T | null>(null);
  const measured = useRef(false);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const active = container.querySelector<HTMLElement>('[data-active="true"]');
      if (!active || !active.offsetWidth) {
        setStyle((current) => ({ ...current, opacity: 0 }));
        return;
      }
      setStyle({
        opacity: 1,
        width: active.offsetWidth,
        height: active.offsetHeight,
        transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`,
        transition: measured.current
          ? "transform .5s var(--ease-out), width .5s var(--ease-out), height .5s var(--ease-out), opacity .2s"
          : "none",
      });
      measured.current = true;
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeKey]);

  return { containerRef, indicatorStyle: style };
}

export function SlidingIndicator({ style, className = "" }: { style: CSSProperties; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 top-0 ${className}`}
      style={style}
    />
  );
}
