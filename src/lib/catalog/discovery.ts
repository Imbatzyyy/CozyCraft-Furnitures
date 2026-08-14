export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  color?: string | null;
  material?: string | null;
  description?: string | null;
};

export const normalizeCatalogValue = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");

export const catalogValuesMatch = (
  left: string | null | undefined,
  right: string | null | undefined,
) => normalizeCatalogValue(left) === normalizeCatalogValue(right);

export const matchesCatalogSubcategory = (
  product: CatalogProduct,
  subcategory: string,
  fallbackProductIds: readonly string[] = [],
) =>
  catalogValuesMatch(product.subcategory, subcategory) ||
  (!normalizeCatalogValue(product.subcategory) &&
    fallbackProductIds.some((id) => catalogValuesMatch(id, product.id)));

export const matchesCatalogSearch = (
  product: CatalogProduct,
  query: string,
) => {
  const needles = query
    .split("|")
    .map(normalizeCatalogValue)
    .filter(Boolean);
  if (!needles.length) return true;
  const haystack = normalizeCatalogValue(
    [
      product.name,
      product.category,
      product.subcategory,
      product.color,
      product.material,
      product.description,
    ].join(" "),
  );
  return needles.some((needle) => haystack.includes(needle));
};
