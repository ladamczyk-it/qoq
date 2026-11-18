import type { OrderRow } from '../db/schema.js';

export const renderOrderPage = (order: OrderRow) =>
  `<h1>Order ${order.id}</h1><p>Customer ${order.customerId}</p><p>${order.status}</p>`;
