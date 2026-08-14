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
