export type ProductIdentity = {
  name: string;
  category: string;
  subcategory: string;
};

export const normalizeProductIdentityPart = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");

export const productsShareCatalogIdentity = (
  left: ProductIdentity,
  right: ProductIdentity,
) =>
  normalizeProductIdentityPart(left.name) ===
    normalizeProductIdentityPart(right.name) &&
  normalizeProductIdentityPart(left.category) ===
    normalizeProductIdentityPart(right.category) &&
  normalizeProductIdentityPart(left.subcategory) ===
    normalizeProductIdentityPart(right.subcategory);

const slugPart = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product";

export const createProductId = (
  product: ProductIdentity,
  uniqueSuffix: string,
) => {
  const suffix = slugPart(uniqueSuffix).slice(0, 8);
  return [
    slugPart(product.name),
    slugPart(product.category),
    slugPart(product.subcategory),
    suffix,
  ].join("-");
};

