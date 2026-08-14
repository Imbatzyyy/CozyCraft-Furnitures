export type DeliveryServiceArea = {
  id: number;
  area_code: string;
  name: string;
  description: string;
  delivery_fee: number;
  free_delivery_minimum: number | null;
  lead_time_min_days: number;
  lead_time_max_days: number;
  assembly_available: boolean;
  active: boolean;
  sort_order: number;
};

export type DeliveryAddress = {
  province?: string | null;
  city?: string | null;
};

/**
 * Safe first-render values that mirror the seeded delivery configuration.
 * The storefront replaces these with the live Supabase rows as soon as they
 * load, while the order RPC remains the final authority for the charged fee.
 */
export const DEFAULT_DELIVERY_SERVICE_AREAS: DeliveryServiceArea[] = [
  { id: -1, area_code: "metro-manila", name: "Metro Manila", description: "NCR deliveries", delivery_fee: 650, free_delivery_minimum: 50_000, lead_time_min_days: 2, lead_time_max_days: 4, assembly_available: true, active: true, sort_order: 10 },
  { id: -2, area_code: "greater-manila", name: "Greater Manila Area", description: "Bulacan, Cavite, Laguna, and Rizal", delivery_fee: 950, free_delivery_minimum: 75_000, lead_time_min_days: 3, lead_time_max_days: 6, assembly_available: true, active: true, sort_order: 20 },
  { id: -3, area_code: "luzon", name: "Other Luzon areas", description: "Other serviceable Luzon destinations", delivery_fee: 1_450, free_delivery_minimum: 100_000, lead_time_min_days: 5, lead_time_max_days: 9, assembly_available: false, active: true, sort_order: 30 },
  { id: -4, area_code: "visayas", name: "Visayas", description: "Serviceable Visayas destinations", delivery_fee: 2_250, free_delivery_minimum: 150_000, lead_time_min_days: 8, lead_time_max_days: 14, assembly_available: false, active: true, sort_order: 40 },
  { id: -5, area_code: "mindanao", name: "Mindanao", description: "Serviceable Mindanao destinations", delivery_fee: 2_450, free_delivery_minimum: 150_000, lead_time_min_days: 9, lead_time_max_days: 16, assembly_available: false, active: true, sort_order: 50 },
];

const includesAny = (value: string, names: string[]) =>
  names.some((name) => value.includes(name));

export function deliveryAreaCodeForAddress(address: DeliveryAddress): string {
  const location = ` ${address.province ?? ""} ${address.city ?? ""} `
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  if (includesAny(location, ["metro manila", "national capital region", " ncr "])) {
    return "metro-manila";
  }
  if (includesAny(location, ["bulacan", "cavite", "laguna", "rizal"])) {
    return "greater-manila";
  }
  if (includesAny(location, [
    "western visayas", "central visayas", "eastern visayas", "aklan", "antique",
    "capiz", "guimaras", "iloilo", "negros", "bacolod", "bohol", "cebu",
    "siquijor", "biliran", "samar", "leyte",
  ])) {
    return "visayas";
  }
  if (includesAny(location, [
    "mindanao", "bangsamoro", "barmm", "zamboanga", "bukidnon", "camiguin",
    "lanao", "misamis", "davao", "cotabato", "sarangani", "sultan kudarat",
    "agusan", "dinagat", "surigao", "basilan", "sulu", "tawi tawi", "caraga",
    "soccsksargen", "cagayan de oro",
  ])) {
    return "mindanao";
  }
  return "luzon";
}

export function deliveryAreaForAddress(
  areas: DeliveryServiceArea[],
  address: DeliveryAddress,
): DeliveryServiceArea | null {
  const areaCode = deliveryAreaCodeForAddress(address);
  return areas.find((area) => area.active && area.area_code === areaCode) ?? null;
}

export function deliveryFeeFor(area: DeliveryServiceArea, subtotal: number): number {
  return area.free_delivery_minimum !== null && subtotal >= area.free_delivery_minimum
    ? 0
    : area.delivery_fee;
}

export function deliveryDateRange(
  area: Pick<DeliveryServiceArea, "lead_time_min_days" | "lead_time_max_days">,
  from = new Date(),
): { earliest: Date; latest: Date } {
  const earliest = new Date(from);
  const latest = new Date(from);
  earliest.setDate(earliest.getDate() + area.lead_time_min_days);
  latest.setDate(latest.getDate() + area.lead_time_max_days);
  return { earliest, latest };
}
