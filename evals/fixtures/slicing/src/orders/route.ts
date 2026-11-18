import { orders } from '../db/schema.js';

export const getOrder = (orderId: string, callerId: string) => {
  const order = orders.find((row) => row.id === orderId);
  if (!order) return { status: 404 };
  if (order.customerId !== callerId) return { status: 404 };
  return { status: 200, body: order };
};

export const listOrders = (callerId: string) => ({
  status: 200,
  body: orders.filter((row) => row.customerId === callerId),
});
