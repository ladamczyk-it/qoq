export type OrderRow = {
  id: string;
  customerId: string;
  totalCents: number;
  status: 'open' | 'paid';
};

export const orders: OrderRow[] = [
  { id: 'o1', customerId: 'c1', totalCents: 1999, status: 'open' },
];
