import type { TRegion } from './types';

const label = (region: TRegion): string => {
  switch (region) {
    case 'eu':
      return 'VAT';
    case 'uk':
      return 'VAT (UK)';
    case 'us':
      return 'Sales tax';
  }
};

const RATES: Record<TRegion, number> = { eu: 0.21, uk: 0.2, us: 0.0725 };

export const tax = (region: TRegion, net: number) => ({
  label: label(region),
  amount: Math.round(net * RATES[region] * 100) / 100,
});
