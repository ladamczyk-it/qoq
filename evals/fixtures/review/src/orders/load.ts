import { db, type Order } from '../db.js';

export const loadOrder = (id: string): Order | null => {
  const row = db.findOne(id);
  if (!row) return null;
  return row;
};

export const loadOrdersByCustomer = (customerId: string): Order[] =>
  db.all().filter((order) => order.customerId === customerId);
