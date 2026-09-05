import { measurementCm } from "@/lib/catalog/product-quality";
import type { DimensionSpec } from "@/lib/catalog/product-specs";

export function ProductMeasurements({ specs }: { specs: DimensionSpec[] }) {
  const width = measurementCm(specs, "width");
  const depth = measurementCm(specs, "depth");
  const height = measurementCm(specs, "height");
  if (width === null || depth === null || height === null) return null;
  return <figure className="mt-4 rounded-xl border border-border bg-background p-4">
    <svg viewBox="0 0 340 200" className="mx-auto max-h-48 w-full" role="img" aria-label={`Overall measurements: width ${width} cm, depth ${depth} cm, height ${height} cm. Diagram not to scale.`}>
      <path d="M80 55 145 25 260 25 195 55Z" fill="var(--secondary)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M80 55H195V135H80Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M195 55 260 25V105L195 135Z" fill="var(--secondary)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M80 157H195M80 151V163M195 151V163M55 55V135M49 55H61M49 135H61M211 149 276 119M208 144 214 154M273 114 279 124" fill="none" stroke="currentColor" opacity=".5" />
      <g fill="currentColor" fontSize="12" fontFamily="sans-serif"><text x="138" y="180" textAnchor="middle">W {width} cm</text><text x="40" y="96" textAnchor="middle" transform="rotate(-90 40 96)">H {height} cm</text><text x="264" y="155" textAnchor="middle">D {depth} cm</text></g>
    </svg>
    <figcaption className="text-center text-[10px] leading-4 text-muted-foreground">Overall size · diagram not to scale. Check doorways and assembly clearance before ordering.</figcaption>
  </figure>;
}
