import { parseDimensionSpecs, parseMaterialSpecs } from "@/lib/catalog/product-specs";
import type { Product } from "@/app/core";

export const FURNITURE_TYPES = ["Sofa", "Coffee table", "TV stand", "Bed", "Wardrobe", "Nightstand", "Dining table", "Dining chair", "Storage"] as const;
export type FurnitureType = typeof FURNITURE_TYPES[number];
export type MatchPreferences = { type: FurnitureType | ""; budget: number | null; width: number | null; depth: number | null; style: string; finish: string; needs: string };
export const emptyPreferences: MatchPreferences = { type: "", budget: null, width: null, depth: null, style: "", finish: "", needs: "" };
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
const stop = new Set("a an the and or of for in with to this that is it your our you furniture piece cm mm width depth height product cozycraft".split(" "));
const tokens = (value: string) => normalize(value).split(/\s+/).filter(t => t.length > 1 && !stop.has(t)).map(t => t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t);

export function furnitureType(product: Pick<Product, "name" | "subcategory">): FurnitureType | "" {
  const value = normalize(`${product.subcategory || ""} ${product.name}`);
  // Product identity only. Incidental words in descriptions cannot change type.
  if (/\bsofa\b|\bcouch\b|\brecliner\b/.test(value)) return "Sofa";
  if (/\bcoffee table\b/.test(value)) return "Coffee table";
  if (/\btv\b|\btelevision\b/.test(value)) return "TV stand";
  if (/\bnightstand\b|\bbedside\b/.test(value)) return "Nightstand";
  if (/\bwardrobe\b/.test(value)) return "Wardrobe";
  if (/\bdining.*chair|\bchair.*dining/.test(value)) return "Dining chair";
  if (/\bdining.*table|\btable.*dining/.test(value)) return "Dining table";
  if (/\bbed\b/.test(value)) return "Bed";
  if (/\bcabinet\b|\bpantry\b|\bhutch\b|\btrolleys?\b|\bstorage\b/.test(value)) return "Storage";
  return "";
}

export function measurementCm(product: Pick<Product, "dimensions">, axis: "width" | "depth"): number | null {
  const row = parseDimensionSpecs(product.dimensions).find(spec => new RegExp(`^(overall |assembled )?${axis}$`, "i").test(spec.label.trim()));
  // Imported catalog values often retain an equivalent imperial measurement.
  // Accept only a single primary number plus a clearly unit-labelled equivalent;
  // never parse ranges, seat dimensions, or arbitrary descriptive text as fit.
  const numeric = row?.value.replace(/\\/g, "").trim().match(/^(\d+(?:\.\d+)?)(?:\s*\(\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?\s*(?:"|″|'|′|mm|cm|m|in|ft)\s*\))?$/i);
  if (!row || !numeric) return null;
  const factors: Record<string, number> = { mm: .1, cm: 1, m: 100, in: 2.54, ft: 30.48 };
  const factor = factors[row.unit.trim().toLowerCase()];
  const value = Number(numeric[1]) * factor;
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Vector = Map<string, number>;
const normalizeVector = (vector: Vector) => {
  const length = Math.sqrt([...vector.values()].reduce((s, v) => s + v * v, 0)) || 1;
  return new Map([...vector].map(([term, value]) => [term, value / length]));
};
const dot = (a: Vector, b: Vector) => [...a].reduce((sum, [term, value]) => sum + value * (b.get(term) || 0), 0);

/** TF-IDF learns vocabulary and inverse-document weights from this catalog.
 * Cosine ranking is content-based retrieval, not generative advice or a
 * claimed purchase probability. No history, tracking or third-party call.
 */
export function trainFurnitureMatcher(products: Product[]) {
  const catalog = products.filter(p => p.status === "active" && Number.isFinite(p.price) && p.price > 0);
  const documents = catalog.map(p => tokens(`${p.name} ${p.subcategory || ""} ${p.subcategory || ""} ${p.category} ${p.color} ${parseMaterialSpecs(p.material).map(m => `${m.type} ${m.description}`).join(" ")} ${p.description || ""}`));
  const frequencies = new Map<string, number>();
  documents.forEach(document => new Set(document).forEach(term => frequencies.set(term, (frequencies.get(term) || 0) + 1)));
  const vector = (document: string[]) => {
    const counts: Vector = new Map();
    document.forEach(term => { if (frequencies.has(term)) counts.set(term, (counts.get(term) || 0) + 1); });
    return normalizeVector(new Map([...counts].map(([term, count]) => [term, (1 + Math.log(count)) * (Math.log((1 + catalog.length) / (1 + frequencies.get(term)!)) + 1)])));
  };
  const vectors = documents.map(vector);
  return {
    version: "catalog-tfidf-v1", catalogSize: catalog.length,
    match(preferences: MatchPreferences) {
      const invalid = [preferences.budget, preferences.width, preferences.depth].some(v => v !== null && (!Number.isFinite(v) || v <= 0));
      if (invalid) return { matches: [], eligible: 0, missingMeasurements: 0, error: "Use positive numbers for the budget and available space." };
      const query = vector(tokens(`${preferences.style} ${preferences.finish} ${preferences.needs}`));
      let missingMeasurements = 0;
      const candidates = catalog.flatMap((product, index) => {
        if (!Number.isFinite(product.stockQuantity) || (product.stockQuantity ?? 0) <= 0) return [];
        if (preferences.type && furnitureType(product) !== preferences.type) return [];
        if (preferences.budget !== null && product.price > preferences.budget) return [];
        const width = measurementCm(product, "width"), depth = measurementCm(product, "depth");
        if ((preferences.width !== null && width === null) || (preferences.depth !== null && depth === null)) { missingMeasurements++; return []; }
        if ((preferences.width !== null && width! > preferences.width) || (preferences.depth !== null && depth! > preferences.depth)) return [];
        const reasons: string[] = [];
        if (preferences.budget !== null) reasons.push("Within your selected budget");
        if (preferences.width !== null || preferences.depth !== null) reasons.push("Listed dimensions meet your size limits");
        const identity = `${product.subcategory || ""} ${product.color} ${parseMaterialSpecs(product.material).map(m => `${m.type} ${m.description}`).join(" ")}`;
        const verifiedTerms = new Set(tokens(identity));
        const matched = [...new Set(tokens(`${preferences.style} ${preferences.finish} ${preferences.needs}`))].filter(term => verifiedTerms.has(term));
        if (matched.length) reasons.push(`Catalog match: ${matched.slice(0, 3).join(", ")}`);
        if (!reasons.length) reasons.push(`${furnitureType(product) || product.category} available in the catalog`);
        return [{ product, score: dot(query, vectors[index]), reasons, width, depth, preferenceMatch: matched.length > 0 }];
      }).sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id));
      return { matches: candidates, eligible: candidates.length, missingMeasurements, error: "" };
    },
  };
}
