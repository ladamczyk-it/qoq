import type { OrderRow } from '../db/schema.js';

export const chargeKey = (order: OrderRow) => `${order.customerId}:${order.id}`;
