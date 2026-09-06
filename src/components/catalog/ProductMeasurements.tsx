import { ResilientImage } from "@/components/media/ResilientImage";
import type { DimensionSpec } from "@/lib/catalog/product-specs";

/** Actual photos avoid misrepresenting different products with a generic silhouette. */
export function ProductMeasurements({ specs, name, image }: { specs: DimensionSpec[]; name: string; image: string }) {
  const measurements = specs.filter((spec) => spec.value.trim());
  return <figure className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-border bg-background">
    <div className="border-b border-border px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Size & proportions</p>
      <p className="mt-1 break-words text-sm font-semibold">{name}</p>
    </div>
    <div className="p-4 sm:p-5">
      <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl bg-white sm:h-64">
        {image ? <ResilientImage key={image} src={image} alt={name + " — product reference for the measurements below"} loading="lazy" className="h-full w-full object-contain" />
          : <p className="p-4 text-center text-sm text-muted-foreground">Product photo unavailable</p>}
      </div>
      <dl className="mt-4 grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {measurements.map((spec, index) => <div key={index} className="min-w-0 rounded-lg border border-border px-3 py-2.5">
          <dt className="break-words text-[11px] text-muted-foreground">{spec.label || "Measurement"}</dt>
          <dd className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{spec.value}{spec.unit ? " " + spec.unit : ""}</dd>
        </div>)}
      </dl>
      {!measurements.length && <p className="mt-3 text-sm text-muted-foreground">Measurements are not yet available. Contact support before ordering for a specific space.</p>}
      <figcaption className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Product photo for reference, not to scale. Measurements are listed as supplied in the product specifications. Check doorways and assembly clearance before ordering.</figcaption>
    </div>
  </figure>;
}
