export type TProvider = 'stripe' | 'paypal' | 'adyen';

export interface IPayment {
  id: string;
  provider: TProvider;
  amount: number;
  currency: string;
}
