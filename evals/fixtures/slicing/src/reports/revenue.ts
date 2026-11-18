import { orders } from '../db/schema.js';

export const revenueByCustomer = () => {
  const totals = new Map<string, number>();
  for (const order of orders)
    totals.set(order.customerId, (totals.get(order.customerId) ?? 0) + order.totalCents);
  return totals;
};
