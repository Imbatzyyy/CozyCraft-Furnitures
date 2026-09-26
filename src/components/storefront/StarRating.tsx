import { Star } from "lucide-react";

/** Read-only rating with partially filled stars. */
export function StarRating({
  value,
  count,
  size = 13,
  className = "",
  showValue = false,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  const rating = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0));
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-flex" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars${count !== undefined ? `, ${count} review${count === 1 ? "" : "s"}` : ""}`}>
        <span className="flex gap-0.5 text-[#d8cebf]" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <Star key={index} size={size} fill="currentColor" strokeWidth={0} />)}
        </span>
        <span className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-[#a4814f]" style={{ width: `${(rating / 5) * 100}%` }} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <Star key={index} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
        </span>
      </span>
      {showValue && <span className="text-xs font-semibold tabular-nums">{rating.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">({count})</span>}
    </span>
  );
}
