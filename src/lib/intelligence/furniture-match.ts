import {
  parseDimensionSpecs,
  parseMaterialSpecs,
} from "@/lib/catalog/product-specs";
import type { Product } from "@/app/core";
import {
  normalize,
  productAttributes,
  colorTerms,
  materialTerms,
  featureTerms,
} from "./discovery-attributes";
import {
  type SearchIntent,
  type VisualProfile,
  blankIntent,
} from "../../../supabase/functions/_shared/furniture-discovery";

export const FURNITURE_TYPES = [
  "Sofa",
  "Coffee table",
  "TV stand",
  "Bed",
  "Wardrobe",
  "Nightstand",
  "Dining table",
  "Dining chair",
  "Storage",
] as const;
export type FurnitureType = (typeof FURNITURE_TYPES)[number];
export type MatchPreferences = {
  type: FurnitureType | "";
  budget: number | null;
  width: number | null;
  depth: number | null;
  height?: number | null;
  style: string;
  finish: string;
  needs: string;
  color?: string;
  material?: string;
  subtype?: string;
  intent?: SearchIntent;
};
export const emptyPreferences: MatchPreferences = {
  type: "",
  budget: null,
  width: null,
  depth: null,
  style: "",
  finish: "",
  needs: "",
};
const stop = new Set(
  "a an the and or of for in with to this that is it your our you furniture piece cm mm width depth height product cozycraft".split(
    " ",
  ),
);
const tokens = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stop.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));

export function furnitureType(
  product: Pick<Product, "name" | "subcategory">,
): FurnitureType | "" {
  return classifyType(product.subcategory || "") || classifyType(product.name);
}

function classifyType(identity: string): FurnitureType | "" {
  const value = normalize(identity);
  // Product identity only. Incidental words in descriptions cannot change type.
  if (/\bsofa\b|\bcouch\b|\brecliner\b/.test(value)) return "Sofa";
  if (/\bcoffee table\b/.test(value)) return "Coffee table";
  if (/\btv\b|\btelevision\b/.test(value)) return "TV stand";
  if (/\bnightstand\b|\bbedside\b/.test(value)) return "Nightstand";
  if (/\bwardrobe\b/.test(value)) return "Wardrobe";
  if (/\bdining.*chair|\bchair.*dining/.test(value)) return "Dining chair";
  if (/\bdining.*table|\btable.*dining/.test(value)) return "Dining table";
  if (/\bbed\b/.test(value)) return "Bed";
  if (/\bcabinet\b|\bpantry\b|\bhutch\b|\btrolleys?\b|\bstorage\b/.test(value))
    return "Storage";
  return "";
}

export function measurementCm(
  product: Pick<Product, "dimensions"> &
    Partial<Pick<Product, "name" | "subcategory">>,
  axis: "width" | "depth" | "height",
): number | null {
  const specs = parseDimensionSpecs(product.dimensions);
  const type = furnitureType({
    name: product.name || "",
    subcategory: product.subcategory,
  });
  // Corner/L-shaped side widths are not interchangeable with a rectangular
  // depth. Do not claim that the shallow seating section is the whole footprint.
  if (
    axis !== "height" &&
    specs.some((s) => /^width (left|right)$/i.test(s.label.trim()))
  )
    return null;
  let row = specs.find((spec) =>
    new RegExp(`^(overall |assembled )?${axis}$`, "i").test(spec.label.trim()),
  );
  if (!row && type === "Bed")
    row = specs.find((s) =>
      new RegExp(`^bed ${axis === "depth" ? "length" : axis}$`, "i").test(
        s.label.trim(),
      ),
    );
  // A bed's front-to-back footprint is its overall length, never mattress length.
  if (
    !row &&
    axis === "depth" &&
    ["Bed", "Dining table", "Coffee table", "Storage"].includes(type)
  )
    row = specs.find((spec) =>
      /^(overall |assembled )?length$/i.test(spec.label.trim()),
    );
  // Require clearance for an extendable table at its listed maximum extension.
  if (axis === "depth" && /extendable/i.test(product.subcategory || ""))
    row =
      specs.find((s) => /^(max\.?|maximum) length$/i.test(s.label.trim())) ??
      row;
  if (!row && (axis === "width" || axis === "depth"))
    row = specs.find((spec) =>
      /^(overall |assembled )?diameter$/i.test(spec.label.trim()),
    );
  if (!row) {
    const combined = specs.find((s) =>
      /^(?:overall|dimensions?)$/i.test(s.label.trim()),
    );
    const letter = axis === "width" ? "W" : axis === "depth" ? "D" : "H";
    const match = combined?.value
      .replace(/\\/g, "")
      .match(
        new RegExp(
          `(\\d+(?:\\.\\d+)?)\\s*("|″|cm|mm|in|m|ft)?\\s*${letter}\\b`,
          "i",
        ),
      );
    if (match && combined)
      row = {
        label: axis,
        value: match[1],
        unit:
          match[2] === '"' || match[2] === "″"
            ? "in"
            : match[2] || combined.unit,
      };
  }
  // Imported catalog values often retain an equivalent imperial measurement.
  // Accept only a single primary number plus a clearly unit-labelled equivalent;
  // never parse ranges, seat dimensions, or arbitrary descriptive text as fit.
  const numeric = row?.value
    .replace(/\\/g, "")
    .trim()
    .match(
      /^(\d+(?:\.\d+)?)(?:\s*(mm|cm|m|in|ft))?(?:\s*\(\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?\s*(?:"|″|'|′|mm|cm|m|in|ft)\s*\))?$/i,
    );
  if (!row || !numeric) return null;
  if (numeric[2] && numeric[2].toLowerCase() !== row.unit.trim().toLowerCase())
    return null;
  const factors: Record<string, number> = {
    mm: 0.1,
    cm: 1,
    m: 100,
    in: 2.54,
    ft: 30.48,
  };
  const factor = factors[row.unit.trim().toLowerCase()];
  const value = Number(numeric[1]) * factor;
  // Suspected inch values labeled cm are not silently converted or accepted.
  if (type === "Dining chair" && value < (axis === "height" ? 45 : 25))
    return null;
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Vector = Map<string, number>;
const normalizeVector = (vector: Vector) => {
  const length =
    Math.sqrt([...vector.values()].reduce((s, v) => s + v * v, 0)) || 1;
  return new Map([...vector].map(([term, value]) => [term, value / length]));
};
const dot = (a: Vector, b: Vector) =>
  [...a].reduce((sum, [term, value]) => sum + value * (b.get(term) || 0), 0);

/** TF-IDF learns vocabulary and inverse-document weights from this catalog.
 * Cosine ranking is content-based retrieval, not generative advice or a
 * claimed purchase probability. No history, tracking or third-party call.
 */
export function trainFurnitureMatcher(
  products: Product[],
  profiles: VisualProfile[] = [],
) {
  const catalog = products.filter(
    (p) => p.status === "active" && Number.isFinite(p.price) && p.price > 0,
  );
  const byId = new Map(profiles.map((p) => [p.product_id, p]));
  const attributes = catalog.map((p) => productAttributes(p, byId.get(p.id)));
  const documents = catalog.map((p, i) =>
    tokens(
      `${p.name} ${p.subcategory || ""} ${p.category} ${attributes[i].colors.join(" ")} ${attributes[i].visual?.caption || ""} ${parseMaterialSpecs(
        p.material,
      )
        .map((m) => `${m.type} ${m.description}`)
        .join(" ")} ${p.description || ""}`,
    ),
  );
  const frequencies = new Map<string, number>();
  documents.forEach((document) =>
    new Set(document).forEach((term) =>
      frequencies.set(term, (frequencies.get(term) || 0) + 1),
    ),
  );
  const vector = (document: string[]) => {
    const counts: Vector = new Map();
    document.forEach((term) => {
      if (frequencies.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
    });
    return normalizeVector(
      new Map(
        [...counts].map(([term, count]) => [
          term,
          (1 + Math.log(count)) *
            (Math.log((1 + catalog.length) / (1 + frequencies.get(term)!)) + 1),
        ]),
      ),
    );
  };
  const vectors = documents.map(vector);
  return {
    version: "photo-grounded-v2",
    catalogSize: catalog.length,
    colorCoverage: attributes.filter((a) => a.colors.length > 0).length,
    match(preferences: MatchPreferences) {
      const intent = preferences.intent ?? {
        ...blankIntent(),
        colors: colorTerms(preferences.finish),
        materials: materialTerms(preferences.finish),
        features: featureTerms(preferences.needs),
      };
      const invalid = [
        preferences.budget,
        preferences.width,
        preferences.depth,
        preferences.height,
      ].some((v) => v != null && (!Number.isFinite(v) || v <= 0));
      if (invalid)
        return {
          matches: [],
          eligible: 0,
          missingMeasurements: 0,
          error: "Use positive numbers for the budget and available space.",
        };
      if (intent.clarification)
        return {
          matches: [],
          eligible: 0,
          missingMeasurements: 0,
          error: intent.clarification,
        };
      const stricter = (a: number | null | undefined, b: number | null) =>
        a != null && b != null ? Math.min(a, b) : (a ?? b);
      const type = preferences.type || intent.type;
      if (
        preferences.subtype &&
        intent.subtype &&
        preferences.subtype !== intent.subtype
      )
        return {
          matches: [],
          eligible: 0,
          missingMeasurements: 0,
          error:
            "The selected product subtype conflicts with your description.",
        };
      if (preferences.type && intent.type && preferences.type !== intent.type)
        return {
          matches: [],
          eligible: 0,
          missingMeasurements: 0,
          error:
            "The selected furniture type conflicts with your description. Choose one type or edit the request.",
        };
      const budget = stricter(preferences.budget, intent.budget),
        maxWidth = stricter(preferences.width, intent.width),
        maxDepth = stricter(preferences.depth, intent.depth),
        maxHeight = stricter(preferences.height, intent.height);
      const colors = preferences.color ? [preferences.color] : intent.colors;
      if (
        preferences.color &&
        intent.colors.length &&
        !intent.colors.includes(preferences.color)
      )
        return {
          matches: [],
          eligible: 0,
          missingMeasurements: 0,
          error:
            "The chosen colour conflicts with the colour in your description.",
        };
      const materials = [
        ...new Set([
          ...intent.materials,
          ...(preferences.material ? [preferences.material] : []),
        ]),
      ];
      const query = vector(
        tokens(
          `${preferences.style} ${preferences.finish} ${preferences.needs}`,
        ),
      );
      let missingMeasurements = 0;
      const candidates = catalog
        .flatMap((product, index) => {
          if (
            !Number.isFinite(product.stockQuantity) ||
            (product.stockQuantity ?? 0) <= 0
          )
            return [];
          if (type && furnitureType(product) !== type) return [];
          if (
            preferences.subtype &&
            product.subcategory !== preferences.subtype
          )
            return [];
          if (intent.subtype && product.subcategory !== intent.subtype)
            return [];
          if (budget !== null && product.price > budget) return [];
          const facts = attributes[index];
          if (colors.length && !colors.some((c) => facts.colors.includes(c)))
            return [];
          if (
            intent.excludedColors.length &&
            (!facts.colors.length ||
              intent.excludedColors.some((c) => facts.colors.includes(c)))
          )
            return [];
          if (
            !materials.every((m) => facts.materials.includes(m)) ||
            intent.excludedMaterials.some((m) => facts.allMaterials.includes(m))
          )
            return [];
          if (intent.excludedMaterials.length && !facts.allMaterials.length)
            return [];
          if (
            !intent.features.every((f) => facts.features.includes(f)) ||
            intent.excludedFeatures.some((f) => facts.features.includes(f))
          )
            return [];
          const width = measurementCm(product, "width"),
            depth = measurementCm(product, "depth"),
            height = measurementCm(product, "height");
          if (
            (maxWidth !== null && width === null) ||
            (maxDepth !== null && depth === null) ||
            (maxHeight !== null && height === null)
          ) {
            missingMeasurements++;
            return [];
          }
          if (
            (maxWidth !== null && width! > maxWidth) ||
            (maxDepth !== null && depth! > maxDepth) ||
            (maxHeight !== null && height! > maxHeight)
          )
            return [];
          const reasons: string[] = [];
          if (budget !== null) reasons.push("Within your maximum budget");
          if (maxWidth !== null || maxDepth !== null || maxHeight !== null)
            reasons.push("Listed overall dimensions meet your size limits");
          if (colors.length)
            reasons.push(
              `${facts.colors.filter((c) => colors.includes(c)).join(" / ")} · ${facts.colorSource === "photo" ? "observed in product photos" : "listed colour"}`,
            );
          if (materials.length)
            reasons.push(`Materials listed: ${materials.join(", ")}`);
          if (intent.features.length)
            reasons.push(`Required features: ${intent.features.join(", ")}`);
          const identity = `${product.subcategory || ""} ${product.color} ${parseMaterialSpecs(
            product.material,
          )
            .map((m) => `${m.type} ${m.description}`)
            .join(" ")}`;
          const verifiedTerms = new Set(tokens(identity));
          const matched = [
            ...new Set(
              tokens(
                `${preferences.style} ${preferences.finish} ${preferences.needs}`,
              ),
            ),
          ].filter((term) => verifiedTerms.has(term));
          if (matched.length)
            reasons.push(`Catalog match: ${matched.slice(0, 3).join(", ")}`);
          if (!reasons.length)
            reasons.push(
              `${furnitureType(product) || product.category} available in the catalog`,
            );
          return [
            {
              product,
              score: dot(query, vectors[index]),
              reasons,
              width,
              depth,
              height,
              photoBased: facts.colorSource === "photo" && colors.length > 0,
              preferenceMatch: matched.length > 0,
            },
          ];
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.product.price - b.product.price ||
            a.product.id.localeCompare(b.product.id),
        );
      return {
        matches: candidates,
        eligible: candidates.length,
        missingMeasurements,
        error: "",
      };
    },
  };
}
