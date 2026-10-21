import type { IInvoice } from './types';

import { tax } from './tax';

export const net = (invoice: IInvoice): number =>
  invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

export const totals = (invoice: IInvoice) => {
  const subtotal = net(invoice);
  const taxLine = tax(invoice.region, subtotal);

  return { subtotal, tax: taxLine, total: subtotal + taxLine.amount };
};
