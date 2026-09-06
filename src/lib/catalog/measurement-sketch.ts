import type { DimensionSpec } from "./product-specs";

export type SketchKind = "sofa" | "sectional" | "recliner" | "chair" | "bed" | "bunk" | "table" | "round-table" | "storage-table" | "wardrobe" | "corner-wardrobe" | "open-wardrobe" | "nightstand" | "floating-nightstand" | "tv-stand" | "floating-tv" | "tv-cart" | "trolley" | "cabinet" | "wine-rack" | "unknown";

export function sketchKind(type: string, specs: DimensionSpec[]): SketchKind {
  const value = type.toLowerCase();
  if (value.includes("sectional")) return "sectional";
  if (value.includes("recliner")) return "recliner";
  if (value.includes("sofa")) return "sofa";
  if (value.includes("chair")) return "chair";
  if (value.includes("bunk")) return "bunk";
  if (value.includes("bed")) return "bed";
  if (value.includes("corner wardrobe")) return "corner-wardrobe";
  if (value.includes("walk-in")) return "open-wardrobe";
  if (value.includes("wardrobe")) return "wardrobe";
  if (value.includes("floating nightstand")) return "floating-nightstand";
  if (value.includes("nightstand")) return "nightstand";
  if (value.includes("tv cart")) return "tv-cart";
  if (value.includes("floating tv")) return "floating-tv";
  if (value.includes("tv stand")) return "tv-stand";
  if (value.includes("trolle")) return "trolley";
  if (value.includes("wine")) return "wine-rack";
  if (value.includes("cabinet")) return "cabinet";
  if (value.includes("table")) {
    if (value.includes("round") || specs.some(s => s.label.toLowerCase() === "diameter")) return "round-table";
    if (value.includes("storage")) return "storage-table";
    return "table";
  }
  return "unknown";
}

const units: Record<string, number> = {cm:1, mm:.1, m:100, in:2.54, inch:2.54, inches:2.54, '"':2.54, ft:30.48};
export type SketchMeasure = { label: string; cm: number; text: string };

// Only numeric measurements, optionally with a parenthesized alternate unit.
// Never assign an unlabelled triple or a range to W/D/H by guessing its order.
export function sketchMeasure(specs: DimensionSpec[], labels: string[]): SketchMeasure | null {
  for (const label of labels) {
    const spec = specs.find(s => s.label.trim().toLowerCase() === label);
    if (!spec) continue;
    const match = spec.value.trim().match(/^(\d+(?:\.\d+)?)\s*(cm|mm|m|in|inch|inches|ft|")?\s*(?:\([^)]*\))?$/i);
    if (!match) continue;
    const unit = (match[2] || spec.unit).toLowerCase();
    const cm = Math.round(Number(match[1]) * units[unit] * 100) / 100;
    if (Number.isFinite(cm) && cm > 0) return {label:spec.label, cm, text:`${cm} cm`};
  }
  // A combined string is safe only when each value explicitly names its axis.
  for (const spec of specs.filter(s => /^(dimensions?|overall)$/i.test(s.label))) {
    for (const match of spec.value.matchAll(/(\d+(?:\.\d+)?)\s*("|cm|mm|in|ft)?\s*([WDHL])\b/gi)) {
      const label = ({W:"width",D:"depth",H:"height",L:"length"} as Record<string,string>)[match[3].toUpperCase()];
      if (!labels.includes(label)) continue;
      const cm = Math.round(Number(match[1]) * units[(match[2] || spec.unit).toLowerCase()] * 100) / 100;
      if (Number.isFinite(cm) && cm > 0) return {label,cm,text:`${cm} cm`};
    }
  }
  return null;
}

export function sketchAxes(specs: DimensionSpec[], kind: SketchKind) {
  const isBed = kind === "bed" || kind === "bunk";
  const minLength = sketchMeasure(specs,["min. length", "min length"]);
  const maxLength = sketchMeasure(specs,["max. length", "max length"]);
  const lengthRange = minLength && maxLength && minLength.cm <= maxLength.cm ? {label:"length",cm:minLength.cm,text:`${minLength.cm}–${maxLength.cm} cm`} : null;
  return {
    width: sketchMeasure(specs, ["width", "overall width", ...(isBed ? ["bed width"] : []), ...(["corner-wardrobe", "sectional"].includes(kind) ? ["width left"] : []), "diameter"]),
    depth: sketchMeasure(specs, ["depth", "overall depth", "length", ...(isBed ? ["bed length"] : []), ...(kind === "corner-wardrobe" ? ["width right"] : [])]) || lengthRange,
    height: sketchMeasure(specs, ["height", "overall height", ...(isBed ? ["headboard height"] : []), ...(["sofa","sectional","recliner"].includes(kind) ? ["back cushions height","backrest height"] : [])]),
  };
}
