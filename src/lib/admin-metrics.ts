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
