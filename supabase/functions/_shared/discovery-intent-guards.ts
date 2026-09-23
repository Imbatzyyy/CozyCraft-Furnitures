import {
  COLORS,
  MATERIALS,
  validateIntent,
  type SearchIntent,
} from "./furniture-discovery.ts";

/** Deterministic checks for explicit requirements a language model might omit.
 * This is a guard, not a substitute for interpretation. Unsupported precision
 * asks for clarification rather than weakening an exact requirement. */
export function guardIntent(source: string, input: SearchIntent): SearchIntent {
  const text = source
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bputi(?:ng)?\b/g, "white")
    .replace(/\bitim(?: na)?\b/g, "black")
    .replace(/\basul(?: na)?\b/g, "blue")
    .replace(/\bberde(?:ng)?\b/g, "green")
    .replace(/\bpula(?:ng)?\b/g, "red")
    .replace(/\bdilaw(?: na)?\b/g, "yellow")
    .replace(/\b(?:kulay )?abo(?:ng)?\b/g, "grey")
    .replace(/\bkayumanggi(?:ng)?\b/g, "brown")
    .replace(/\bgray\b/g, "grey");
  const colors = new Set(input.colors),
    excluded = new Set(input.excludedColors);
  const mentioned = new Set<string>(),
    positive = new Set<string>(),
    negative = new Set<string>();
  for (const clause of text.split(/\b(?:but|pero|however)\b|[.;]/))
    for (const color of COLORS) {
      const pattern = new RegExp(`\\b${color}\\b`, "g");
      for (const found of clause.matchAll(pattern)) {
        mentioned.add(color);
        const before = clause.slice(0, found.index).trim();
        const negated =
          /\b(?:not|no|without|hindi|ayaw|except(?: for)?|other than)(?:\s+\w+){0,2}$/.test(
            before,
          );
        (negated ? negative : positive).add(color);
      }
    }
  for (const color of mentioned) {
    colors.delete(color);
    excluded.delete(color);
  }
  positive.forEach((c) => colors.add(c));
  negative.forEach((c) => excluded.add(c));
  const result = {
    ...input,
    colors: [...colors],
    excludedColors: [...excluded],
  };
  // Descriptive catalog categories are not exclusive product identities:
  // a wooden storage coffee table may be filed under Storage Coffee Table.
  const attributeSubtypes: Record<
    string,
    { type: string; materials?: string[]; features?: string[] }
  > = {
    "2-Seater Fabric Sofa": {
      type: "Sofa",
      materials: ["fabric"],
      features: ["two seater"],
    },
    "3-Seater Fabric Sofa": {
      type: "Sofa",
      materials: ["fabric"],
      features: ["three seater"],
    },
    "Sectional Sofa": { type: "Sofa", features: ["sectional"] },
    "Recliner Sofa": { type: "Sofa", features: ["reclining"] },
    "Sofa Bed": { type: "Sofa", features: ["sofa bed"] },
    "Wooden Coffee Table": { type: "Coffee table", materials: ["wood"] },
    "Glass Coffee Table": { type: "Coffee table", materials: ["glass"] },
    "Marble Coffee Table": { type: "Coffee table", materials: ["marble"] },
    "Round Coffee Table": { type: "Coffee table", features: ["round"] },
    "Storage Coffee Table": { type: "Coffee table", features: ["storage"] },
    "Wooden TV Stand": { type: "TV stand", materials: ["wood"] },
    "Modern TV Stand": { type: "TV stand" },
    "Floating TV Stand": { type: "TV stand", features: ["wall mounted"] },
    "Wooden Nightstand": { type: "Nightstand", materials: ["wood"] },
    "Metal Nightstand": { type: "Nightstand", materials: ["metal"] },
    "Modern Nightstand": { type: "Nightstand" },
    "Floating Nightstand": { type: "Nightstand", features: ["wall mounted"] },
    "Nightstand with Drawer": { type: "Nightstand", features: ["drawers"] },
    "Glass Dining Table": { type: "Dining table", materials: ["glass"] },
    "Marble Top Dining Table": { type: "Dining table", materials: ["marble"] },
    "Extendable Dining Table": {
      type: "Dining table",
      features: ["extendable"],
    },
    "Luxury Velvet Dining Chairs": {
      type: "Dining chair",
      materials: ["velvet"],
    },
    "Modern Plastic Dining Chairs": {
      type: "Dining chair",
      materials: ["plastic"],
    },
    "Molded Resin Dining Chairs": {
      type: "Dining chair",
      materials: ["plastic"],
    },
  };
  const attributes = attributeSubtypes[result.subtype];
  if (attributes) {
    result.type = attributes.type;
    result.subtype = "";
    result.materials = [
      ...new Set([...result.materials, ...(attributes.materials || [])]),
    ];
    result.features = [
      ...new Set([...result.features, ...(attributes.features || [])]),
    ];
  }
  const subtypes: [RegExp, string][] = [
    [/\bpantry\b/, "Pantry Cabinets"],
    [/\bwine (?:storage|cabinet|rack)\b/, "Wine Storage Cabinet"],
    [/\bbuffet\b/, "Buffet Cabinet"],
    [/\bhutch\b/, "Dining Hutch Cabinet"],
    [/\b(?:serving trolley|bar cart)\b/, "Serving Trolleys"],
    [/\btv cart\b/, "TV Cart"],
    [/\bcorner wardrobe\b/, "Corner Wardrobe"],
    [/\bsliding(?: door)? wardrobe\b/, "Sliding Door Wardrobe"],
    [/\bwalk[ -]in wardrobe\b/, "Walk-in Wardrobe"],
  ];
  const specific = subtypes
    .filter(([pattern]) => {
      const found = text.match(pattern);
      if (!found) return false;
      return !/\b(?:not|no|without|hindi|ayaw)(?:\s+\w+){0,2}\s*$/.test(
        text.slice(0, found.index),
      );
    })
    .map(([, value]) => value);
  if (specific.length === 1) result.subtype = specific[0];
  if (specific.length > 1)
    result.clarification =
      "Please search for one specific furniture type at a time, or use the type filter.";
  if (
    /\b(?:navy|teal|turquoise|burgundy|maroon|ivory|peach|taupe|charcoal|off[ -]white|light (?:blue|grey|brown|green)|dark (?:blue|grey|brown|green))\b/.test(
      text,
    )
  )
    result.clarification =
      "We can match colour families, but cannot verify an exact shade from photos. Would a general colour such as blue, grey, cream or brown work? Choose a colour family in the filters.";
  if (/\b(?:at least|minimum|exactly)\s*\d/.test(text))
    result.clarification =
      "The size and budget filters support maximum limits. Please give a maximum overall size or budget, then check exact dimensions on the product page.";
  const materials = MATERIALS.join("|");
  if (new RegExp(`\\b(?:${materials})\\s+or\\s+(?:${materials})\\b`).test(text))
    result.clarification =
      "Please choose one required material, or run a separate search for each material.";
  if (
    /\b(?:small|compact|maliit)\b/.test(text) &&
    !result.width &&
    !result.depth &&
    !result.height
  )
    result.clarification =
      "What is the maximum width or depth that will fit your space? Enter centimetres in the size filters so we can check it properly.";
  if (
    /\b(?:cheap|affordable|mura|budget friendly)\b/.test(text) &&
    !result.budget
  )
    result.clarification =
      "What is your maximum product budget in pesos? Add it in the budget filter to see pieces within that amount.";
  return validateIntent(result);
}
