export type Order = { id: string; customerId: string; totalCents: number };

const orders: Order[] = [{ id: 'o1', customerId: 'c1', totalCents: 1999 }];

export const db = {
  all: (): Order[] => orders,
  findOne: (id: string): Order | undefined => orders.find((order) => order.id === id),
};
