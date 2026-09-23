// Shared, bounded discovery protocol. Photo observations are never material or size facts.
import { FURNITURE_SUBTYPES } from "./catalog-taxonomy.ts";
export const DISCOVERY_VERSION = 2;
export const COLORS = [
  "black",
  "white",
  "grey",
  "beige",
  "cream",
  "brown",
  "blue",
  "green",
  "red",
  "pink",
  "yellow",
  "orange",
  "purple",
  "gold",
  "silver",
  "clear",
  "natural",
] as const;
export const MATERIALS = [
  "fabric",
  "velvet",
  "leather",
  "faux leather",
  "wood",
  "solid wood",
  "oak",
  "pine",
  "bamboo",
  "rattan",
  "metal",
  "steel",
  "glass",
  "marble",
  "plastic",
  "polyester",
  "cotton",
  "linen",
  "wool",
  "viscose",
  "birch",
  "beech",
  "walnut",
  "acacia",
  "teak",
  "rubberwood",
  "engineered wood",
  "plywood",
  "particleboard",
  "fiberboard",
  "veneer",
  "aluminum",
  "iron",
  "acrylic",
  "ceramic",
] as const;
export const FEATURES = [
  "storage",
  "drawers",
  "shelves",
  "doors",
  "extendable",
  "foldable",
  "reclining",
  "sofa bed",
  "sectional",
  "round",
  "rectangular",
  "square",
  "oval",
  "upholstered",
  "wheels",
  "wall mounted",
  "two seater",
  "three seater",
  "single",
  "double",
  "queen",
  "king",
  "bunk",
] as const;
export type VisualProfile = {
  product_id: string;
  image_key: string;
  version: number;
  colors: string[];
  appearance: string[];
  features: string[];
  caption: string;
  clarity: "clear" | "uncertain";
  analysed_at?: string;
};
export type SearchIntent = {
  type: string;
  subtype: string;
  colors: string[];
  excludedColors: string[];
  materials: string[];
  excludedMaterials: string[];
  features: string[];
  excludedFeatures: string[];
  budget: number | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  clarification: string;
};
export const blankIntent = (): SearchIntent => ({
  type: "",
  subtype: "",
  colors: [],
  excludedColors: [],
  materials: [],
  excludedMaterials: [],
  features: [],
  excludedFeatures: [],
  budget: null,
  width: null,
  depth: null,
  height: null,
  clarification: "",
});
export const TYPES = [
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
export const cleanText = (value: unknown, limit = 200) =>
  typeof value === "string"
    ? value
        .replace(/[<>\u0000-\u001f]/g, " ")
        .trim()
        .slice(0, limit)
    : "";
const list = (value: unknown, allowed: readonly string[]) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (v): v is string => typeof v === "string" && allowed.includes(v),
          ),
        ),
      ].slice(0, 8)
    : [];
export function validateIntent(input: unknown): SearchIntent {
  if (!input || typeof input !== "object")
    throw new Error("Invalid search interpretation");
  const r = input as Record<string, unknown>;
  const result = blankIntent();
  result.type = TYPES.includes(r.type as (typeof TYPES)[number])
    ? String(r.type)
    : "";
  result.subtype =
    typeof r.subtype === "string" && FURNITURE_SUBTYPES.includes(r.subtype)
      ? r.subtype
      : "";
  for (const key of ["colors", "excludedColors"] as const)
    result[key] = list(r[key], COLORS);
  for (const key of ["materials", "excludedMaterials"] as const)
    result[key] = list(r[key], MATERIALS);
  for (const key of ["features", "excludedFeatures"] as const)
    result[key] = list(r[key], FEATURES);
  for (const key of ["budget", "width", "depth", "height"] as const) {
    const v = r[key];
    result[key] =
      typeof v === "number" &&
      Number.isFinite(v) &&
      v > 0 &&
      v <= (key === "budget" ? 10000000 : 10000)
        ? v
        : null;
  }
  result.clarification = cleanText(r.clarification, 180);
  // Reject lossy interpretations instead of silently widening a customer's search.
  const vocabulary = {
    colors: COLORS,
    excludedColors: COLORS,
    materials: MATERIALS,
    excludedMaterials: MATERIALS,
    features: FEATURES,
    excludedFeatures: FEATURES,
  };
  const unsupported = Object.entries(vocabulary).some(
    ([key, allowed]) =>
      r[key] != null &&
      (!Array.isArray(r[key]) ||
        (r[key] as unknown[]).some(
          (v) =>
            typeof v !== "string" ||
            !(allowed as readonly string[]).includes(v),
        ) ||
        (r[key] as unknown[]).length > 8),
  );
  const invalidNumber = (["budget", "width", "depth", "height"] as const).some(
    (key) => r[key] != null && result[key] === null,
  );
  const contradiction =
    result.colors.some((c) => result.excludedColors.includes(c)) ||
    result.materials.some((m) => result.excludedMaterials.includes(m)) ||
    result.features.some((f) => result.excludedFeatures.includes(f));
  if (
    !result.clarification &&
    (unsupported ||
      invalidNumber ||
      (r.type && !result.type) ||
      (r.subtype && !result.subtype))
  )
    result.clarification =
      "Some requirements could not be checked reliably. Please use the filters or describe one furniture type with a colour, material and maximum size or budget.";
  if (contradiction)
    result.clarification =
      "Your request includes and excludes the same requirement. Please choose which one you want.";
  if (
    !result.clarification &&
    !result.type &&
    !result.subtype &&
    !Object.keys(vocabulary).some(
      (k) => result[k as keyof typeof vocabulary].length,
    ) &&
    !result.budget &&
    !result.width &&
    !result.depth &&
    !result.height
  )
    result.clarification =
      "What kind of furniture are you looking for? Add a product type, colour, material, budget or size, or use the filters.";
  return result;
}
export function validateVisual(input: unknown) {
  if (!input || typeof input !== "object")
    throw new Error("Invalid visual analysis");
  const r = input as Record<string, unknown>;
  return {
    colors: list(r.colors, COLORS),
    appearance: list(r.appearance, [
      "wood look",
      "velvet look",
      "leather look",
      "fabric look",
      "glossy",
      "matte",
      "woven",
      "transparent",
    ]),
    features: list(r.features, FEATURES),
    caption: cleanText(r.caption, 220),
    clarity:
      r.clarity === "clear" ? ("clear" as const) : ("uncertain" as const),
  };
}
export function photoKey(product: {
  images: string[];
  mainImageIndex?: number | null;
}) {
  const index = Math.min(
    Math.max(product.mainImageIndex ?? 0, 0),
    Math.max(0, product.images.length - 1),
  );
  const main = product.images[index];
  return JSON.stringify(
    main ? [main, ...product.images.filter((x) => x !== main)].slice(0, 2) : [],
  );
}
