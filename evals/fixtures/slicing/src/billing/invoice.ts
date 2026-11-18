import type { OrderRow } from '../db/schema.js';

export const invoiceFor = (order: OrderRow) => ({
  billTo: order.customerId,
  amountCents: order.totalCents,
});
