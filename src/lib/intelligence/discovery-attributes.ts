import type { Product } from "@/app/core";
import { parseMaterialSpecs } from "@/lib/catalog/product-specs";
import {
  COLORS,
  FEATURES,
  MATERIALS,
  DISCOVERY_VERSION,
  photoKey,
  type VisualProfile,
} from "../../../supabase/functions/_shared/furniture-discovery";

export const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b(?:kulay abo|grey|gray|abo)\b/g, "grey")
    .replace(/\bitim\b/g, "black")
    .replace(/\bputi\b/g, "white")
    .replace(/\basul\b/g, "blue")
    .replace(/\bberde\b/g, "green")
    .replace(/\bpula\b/g, "red")
    .replace(/\bdilaw\b/g, "yellow")
    .replace(/\bkayumanggi\b/g, "brown")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (text: string, word: string) =>
  new RegExp(`\\b${word.replace(/ /g, "[ -]")}\\b`, "i").test(text);
export function colorTerms(value: string) {
  let text = normalize(value);
  text = text
    .replace(/navy|teal|turquoise/g, "blue")
    .replace(/ivory|off[ -]white/g, "cream")
    .replace(/taupe|sand|oatmeal/g, "beige")
    .replace(/charcoal/g, "grey")
    .replace(/walnut|chocolate|espresso/g, "brown");
  return COLORS.filter((word) => has(text, word));
}
export function materialTerms(value: string) {
  let text = normalize(value)
    .replace(/timber/g, "wood")
    .replace(/aluminium/g, "aluminum")
    .replace(/\bmdf\b|fibreboard/g, "fiberboard")
    .replace(/\brayon\b/g, "viscose")
    .replace(/polypropylene|resin/g, "plastic");
  const faux =
    /faux leather|synthetic leather|imitation leather|leatherette/.test(text);
  if (faux)
    text = text.replace(
      /faux leather|synthetic leather|imitation leather|leatherette/g,
      "imitation-hide",
    );
  const values = new Set<string>(MATERIALS.filter((word) => has(text, word)));
  if (faux) values.add("faux leather");
  if (
    /\b(?:pine|oak|beech|birch|walnut|acacia|teak|rubberwood|plywood|particleboard|fiberboard|wood|veneer)\b/.test(
      text,
    )
  )
    values.add("wood");
  if (
    /\bsolid (?:wood|pine|oak|beech|birch|walnut|acacia|teak|rubberwood)\b/.test(
      text,
    )
  )
    values.add("solid wood");
  if (/\b(?:plywood|particleboard|fiberboard)\b/.test(text))
    values.add("engineered wood");
  if (/\b(?:steel|aluminum|iron)\b/.test(text)) values.add("metal");
  if (
    /\b(?:fabric|polyester|velvet|cotton|linen|wool|viscose)\b/.test(
      text.replace(/polyester powder coating/g, ""),
    )
  )
    values.add("fabric");
  return [...values];
}
export function featureTerms(value: string) {
  const text = normalize(value)
    .replace(/2[ -]seater|two[ -]seat(?:er)?/g, "two seater")
    .replace(/3[ -]seater|three[ -]seat(?:er)?/g, "three seater")
    .replace(/recliner/g, "reclining")
    .replace(/sleeper sofa|convertible sofa/g, "sofa bed")
    .replace(/l[ -]shaped/g, "sectional")
    .replace(/casters|castors|trolley/g, "wheels")
    .replace(/shelf/g, "shelves")
    .replace(/drawer\b/g, "drawers")
    .replace(/door\b/g, "doors")
    .replace(/floating/g, "wall mounted");
  return FEATURES.filter(
    (word) =>
      has(text, word) &&
      !new RegExp(
        `\\b(?:no|without|not|non)[ -]+(?:\\w+[ -]+){0,2}${word.replace(/ /g, "[ -]")}\\b`,
      ).test(text),
  );
}
export function productAttributes(product: Product, profile?: VisualProfile) {
  const current =
    profile?.version === DISCOVERY_VERSION &&
    profile.image_key === photoKey(product) &&
    profile.clarity === "clear"
      ? profile
      : undefined;
  const namedColors = colorTerms(product.color || "");
  // An explicit colour field overrides inferred photos. Never infer colour from filename/background.
  const colors = namedColors.length ? namedColors : (current?.colors ?? []);
  const rows = parseMaterialSpecs(product.material);
  const allMaterials = rows.flatMap((row) =>
    materialTerms(`${row.type} ${row.description}`),
  );
  // A hidden wooden sofa frame is not a wooden-looking sofa. For upholstered
  // seating, affirmative material searches refer to the documented outer cover.
  const covers = rows.filter(
    (row) =>
      /\b(?:fabric|cover|upholstery|upholstered)\b/i.test(row.type) &&
      !/\b(?:frame|lining|back cushion|filling)\b/i.test(row.type),
  );
  const seating = /sofa|couch|recliner|chair/i.test(product.subcategory || "");
  const materials = (seating && covers.length ? covers : rows).flatMap((row) =>
    materialTerms(`${row.type} ${row.description}`),
  );
  const factual = featureTerms(
    `${product.subcategory || ""} ${product.description || ""}`,
  );
  const structural = parseMaterialSpecs(product.material).flatMap((row) =>
    featureTerms(row.type),
  );
  // Moving mechanisms/capabilities require catalog evidence, not a photograph.
  const visible =
    current?.features.filter((f) =>
      [
        "round",
        "rectangular",
        "square",
        "oval",
        "upholstered",
        "drawers",
        "shelves",
        "doors",
        "wheels",
        "two seater",
        "three seater",
      ].includes(f),
    ) ?? [];
  return {
    colors,
    colorSource: namedColors.length
      ? "catalog"
      : current?.colors.length
        ? "photo"
        : "unknown",
    materials: [...new Set(materials)],
    allMaterials: [...new Set(allMaterials)],
    features: [...new Set([...factual, ...structural, ...visible])],
    visual: current,
  };
}
