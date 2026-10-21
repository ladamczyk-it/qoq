import type { IPayment } from './types';

export const refund = async (payment: IPayment, amount: number): Promise<string> => {
  switch (payment.provider) {
    case 'stripe': {
      const response = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        body: new URLSearchParams({
          payment_intent: payment.id,
          amount: String(Math.round(amount * 100)),
        }),
      });

      return ((await response.json()) as { id: string }).id;
    }
    case 'paypal': {
      const response = await fetch(
        `https://api.paypal.com/v2/payments/captures/${payment.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: { value: amount.toFixed(2), currency_code: payment.currency },
          }),
        }
      );

      return ((await response.json()) as { id: string }).id;
    }
    case 'adyen': {
      if (amount < payment.amount) {
        throw new Error(
          'adyen: partial refunds go through the modifications API, not supported yet'
        );
      }
      const response = await fetch(
        `https://checkout.adyen.com/v71/payments/${payment.id}/refunds`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: { value: Math.round(amount * 100), currency: payment.currency },
          }),
        }
      );

      return ((await response.json()) as { pspReference: string }).pspReference;
    }
  }
};
