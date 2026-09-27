const adminTitles: Array<[RegExp, string]> = [
  [/^\/admin\/?$/, "Overview"],
  [/^\/admin\/login/, "Sign in"],
  [/^\/admin\/setup-account/, "Account setup"],
  [/^\/admin\/team/, "Team access"],
  [/^\/admin\/products\/new/, "New product"],
  [/^\/admin\/products/, "Products"],
  [/^\/admin\/categories/, "Categories"],
  [/^\/admin\/inventory/, "Inventory"],
  [/^\/admin\/orders/, "Orders"],
  [/^\/admin\/payments/, "Payments"],
  [/^\/admin\/customers/, "Customers"],
  [/^\/admin\/member-tiers/, "Member tiers"],
  [/^\/admin\/experience/, "Merchandising"],
  [/^\/admin\/content/, "Content"],
  [/^\/admin\/reviews/, "Reviews"],
  [/^\/admin\/reports/, "Reports"],
  [/^\/admin\/system-health/, "Operations health"],
  [/^\/admin\/activity-logs/, "Activity logs"],
  [/^\/admin\/support/, "Support"],
  [/^\/admin\/settings/, "Settings"],
];

/** Short page name shown in the admin header, e.g. "Orders". */
export function adminPageLabel(pathname: string) {
  return adminTitles.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Operations";
}

/** "Orders · CozyCraft Operations" */
export function adminTitleForPath(pathname: string, storeName = "CozyCraft") {
  const label = adminPageLabel(pathname);
  const brand = storeName.replace(/\s+Furnitures?$/i, "").trim() || "CozyCraft";
  return `${label} · ${brand} Operations`;
}
