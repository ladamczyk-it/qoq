export type TRegion = 'eu' | 'uk' | 'us';

export interface ILine {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface IInvoice {
  region: TRegion;
  lines: ILine[];
}
