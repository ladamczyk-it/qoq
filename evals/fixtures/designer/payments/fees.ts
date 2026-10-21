import type { IPayment } from './types';

const round = (amount: number, currency: string) =>
  currency === 'JPY' ? Math.round(amount) : Math.round(amount * 100) / 100;

export const fee = (payment: IPayment): number => {
  switch (payment.provider) {
    case 'stripe':
      return round(payment.amount * 0.029 + 0.3, payment.currency);
    case 'paypal':
      return round(payment.amount * 0.0349 + 0.49, payment.currency);
    case 'adyen':
      return round(Math.max(payment.amount * 0.012, 0.11) + 0.12, payment.currency);
  }
};
