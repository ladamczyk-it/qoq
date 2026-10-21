import type { IInvoice } from './types';

import { totals } from './totals';

const money = (amount: number) => amount.toFixed(2);

export const formatInvoice = (invoice: IInvoice): string => {
  const { subtotal, tax, total } = totals(invoice);
  const lines = invoice.lines.map(
    (line) => `${line.sku}  ${line.quantity} x ${money(line.unitPrice)}`
  );

  return [
    ...lines,
    `Subtotal  ${money(subtotal)}`,
    `${tax.label}  ${money(tax.amount)}`,
    `Total  ${money(total)}`,
  ].join('\n');
};
