export type FinancialOrder = {
  total: number | string;
  status: string;
  payment_status: string;
  user_id?: string;
};

export const isSettledSale = (order: FinancialOrder) =>
  order.payment_status === "paid" && order.status !== "cancelled";

export const settledRevenue = (orders: FinancialOrder[]) =>
  orders
    .filter(isSettledSale)
    .reduce((total, order) => total + Number(order.total), 0);

export const customerLifetimeValue = (
  orders: FinancialOrder[],
  customerId?: string,
) =>
  settledRevenue(
    customerId
      ? orders.filter((order) => order.user_id === customerId)
      : orders,
  );

export type AdminReportRange = "This week" | "This month" | "Quarter";

export const reportRangeStart = (range: AdminReportRange, now = new Date()) => {
  if (range === "This month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === "Quarter") {
    return new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 3), 1);
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
};
