import { parseDimensionSpecs, parseMaterialSpecs, type DimensionSpec } from "./product-specs";

const cmPerUnit: Record<string, number> = { cm: 1, mm: .1, m: 100, in: 2.54, inch: 2.54, inches: 2.54, '"': 2.54, ft: 30.48, feet: 30.48 };
export function measurementCm(specs: DimensionSpec[], axis: "width" | "depth" | "height"): number | null {
  const aliases = axis === "width" ? ["width", "w", "overall width"] : axis === "depth" ? ["depth", "d", "length", "overall depth"] : ["height", "h", "overall height"];
  const item = specs.find((spec) => aliases.includes(spec.label.trim().toLowerCase()));
  if (!item || !/^\d+(?:\.\d+)?$/.test(item.value.trim())) return null;
  const unit = cmPerUnit[item.unit.trim().toLowerCase()];
  const value = Number(item.value) * unit;
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function productQualityGaps(product: { name: string; description: string; images: string[]; price: number; material?: string; dimensions: string; category: string }): string[] {
  const gaps: string[] = [];
  if (!product.name.trim()) gaps.push("Product name");
  if (product.description.trim().length < 30) gaps.push("Helpful description");
  if (product.images.filter((image) => image.trim()).length < 4) gaps.push("Four product photos");
  if (!Number.isFinite(product.price) || product.price <= 0) gaps.push("Valid price");
  if (!product.category.trim()) gaps.push("Room category");
  if (!parseMaterialSpecs(product.material).some((item) => item.type.trim() && item.description.trim())) gaps.push("Material details");
  const dimensions = parseDimensionSpecs(product.dimensions);
  if (["width", "depth", "height"].some((axis) => measurementCm(dimensions, axis as "width" | "depth" | "height") === null)) gaps.push("Clear width, depth and height with units");
  return gaps;
}
