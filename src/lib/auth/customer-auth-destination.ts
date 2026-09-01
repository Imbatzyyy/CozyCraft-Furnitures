const safeInternalPath = (value: string | null) =>
  Boolean(value?.startsWith("/") && !value.startsWith("//"));

const protectedCustomerPaths = new Set([
  "/checkout",
  "/orders",
  "/profile",
  "/wishlist",
]);

export const resolveCustomerAuthDestination = (
  pathname: string,
  search: string,
) => {
  const requested = new URLSearchParams(search).get("next");
  if (safeInternalPath(requested)) return requested as string;
  if (protectedCustomerPaths.has(pathname)) return `${pathname}${search}`;
  return "/profile";
};

export const customerAuthHref = (
  pathname: "/login" | "/signup",
  destination: string,
) =>
  destination === "/profile"
    ? pathname
    : `${pathname}?next=${encodeURIComponent(destination)}`;

export const isCheckoutAuthDestination = (destination: string) =>
  destination === "/checkout" || destination.startsWith("/checkout?");
