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
) => scoreCatalogSearch(product, query) > 0;

const includesWord = (value: string, needle: string) =>
  value
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .some((word) => word === needle || word.startsWith(needle));

/**
 * Gives shopper-facing product fields more weight than incidental prose.
 * A description may mention that a nightstand works "beside a sofa", but it
 * must never outrank products whose actual type is Sofa.
 */
export const scoreCatalogSearch = (
  product: CatalogProduct,
  query: string,
) => {
  const needles = query
    .split("|")
    .map(normalizeCatalogValue)
    .filter(Boolean);
  if (!needles.length) return 1;

  const name = normalizeCatalogValue(product.name);
  const category = normalizeCatalogValue(product.category);
  const subcategory = normalizeCatalogValue(product.subcategory);
  const color = normalizeCatalogValue(product.color);
  const material = normalizeCatalogValue(product.material);
  const description = normalizeCatalogValue(product.description);

  return needles.reduce((bestScore, needle) => {
    let score = 0;
    if (name === needle) score = 120;
    else if (name.startsWith(needle)) score = 108;
    else if (includesWord(name, needle)) score = 100;
    else if (name.includes(needle)) score = 92;
    else if (subcategory === needle) score = 90;
    else if (includesWord(subcategory, needle)) score = 82;
    else if (subcategory.includes(needle)) score = 76;
    else if (category === needle) score = 70;
    else if (includesWord(category, needle)) score = 62;
    else if (category.includes(needle)) score = 56;
    else if (includesWord(material, needle) || includesWord(color, needle)) score = 32;
    else if (material.includes(needle) || color.includes(needle)) score = 26;
    else if (description.includes(needle)) score = 10;

    return Math.max(bestScore, score);
  }, 0);
};

export const rankCatalogSearch = <T extends CatalogProduct>(
  products: readonly T[],
  query: string,
) =>
  products
    .map((product, index) => ({
      product,
      index,
      score: scoreCatalogSearch(product, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.product);
