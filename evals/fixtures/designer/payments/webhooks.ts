import type { TProvider } from './types';

export interface IWebhookEvent {
  paymentId: string;
  status: 'succeeded' | 'failed' | 'refunded';
}

export const parseWebhook = (provider: TProvider, body: unknown): IWebhookEvent => {
  switch (provider) {
    case 'stripe': {
      const event = body as { type: string; data: { object: { id: string } } };

      return {
        paymentId: event.data.object.id,
        status:
          event.type === 'charge.refunded'
            ? 'refunded'
            : event.type.endsWith('succeeded')
              ? 'succeeded'
              : 'failed',
      };
    }
    case 'paypal': {
      const event = body as { event_type: string; resource: { id: string } };

      return {
        paymentId: event.resource.id,
        status:
          event.event_type === 'PAYMENT.CAPTURE.REFUNDED'
            ? 'refunded'
            : event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
              ? 'succeeded'
              : 'failed',
      };
    }
    case 'adyen': {
      const item = (
        body as {
          notificationItems: {
            NotificationRequestItem: { pspReference: string; eventCode: string; success: string };
          }[];
        }
      ).notificationItems[0].NotificationRequestItem;

      return {
        paymentId: item.pspReference,
        status:
          item.eventCode === 'REFUND'
            ? 'refunded'
            : item.success === 'true'
              ? 'succeeded'
              : 'failed',
      };
    }
  }
};
