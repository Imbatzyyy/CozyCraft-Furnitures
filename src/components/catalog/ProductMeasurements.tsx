import { FurnitureSketch } from "./FurnitureSketch";
import { sketchAxes, sketchKind } from "@/lib/catalog/measurement-sketch";
import type { DimensionSpec } from "@/lib/catalog/product-specs";

export function ProductMeasurements({ specs, name, type }: { specs: DimensionSpec[]; name: string; type: string }) {
  const measurements = specs.filter((spec) => spec.value.trim());
  const kind = sketchKind(type, specs);
  const axes = sketchAxes(specs, kind);
  const incomplete = !axes.width || !axes.height || (!axes.depth && kind !== "round-table");
  return <figure className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-border bg-background">
    <div className="border-b border-border px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Size sketch</p>
      <p className="mt-1 break-words text-sm font-semibold">{name}</p>
    </div>
    <div className="p-4 sm:p-5">
      {kind !== "unknown" ? <FurnitureSketch kind={kind} type={type} specs={specs} name={name}/> : <p className="py-5 text-sm text-muted-foreground">A sketch for this product type is not available yet.</p>}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">W · width &nbsp; H · height &nbsp; D · depth &nbsp; L · length &nbsp; Ø · diameter</p>
      {axes.height && /headboard|back/i.test(axes.height.label) && <p className="mt-1 text-center text-[11px] text-muted-foreground">Height guide: {axes.height.label.toLowerCase()}</p>}
      {incomplete && <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">— means an overall measurement is not separately specified. See the supplied dimensions below.</p>}
      <details className="mt-4 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">All supplied measurements</summary>
      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {measurements.map((spec, index) => <div key={index} className="min-w-0 rounded-lg border border-border px-3 py-2.5">
          <dt className="break-words text-[11px] text-muted-foreground">{spec.label || "Measurement"}</dt>
          <dd className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{spec.value}{spec.unit ? " " + spec.unit : ""}</dd>
        </div>)}
      </dl>
      </details>
      {!measurements.length && <p className="mt-3 text-sm text-muted-foreground">Measurements are not yet available. Contact support before ordering for a specific space.</p>}
      <figcaption className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{type} schematic · not to scale. Shape and details are illustrative; refer to the product photos for the exact design. Guides use catalog measurements in cm. Check doorways and assembly clearance before ordering.</figcaption>
    </div>
  </figure>;
}
