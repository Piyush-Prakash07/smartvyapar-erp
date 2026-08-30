import api from '../../lib/axios';
import type { StoreSubpart } from '../dashboard/types';

export interface DailyStockItem {
  id: string;
  name: string;
  unit: string;
  rate: number;
  cost: number;
  mrp: number;
  openingStock: number;
  inward: number;
  outward: number;
  adjustment: number;
  closingStock: number;
  valuation: number;
}

export interface StockSummary {
  totalItems: number;
  totalClosingQty: number;
  totalValuation: number;
}

export interface DailyStockResponse {
  date: string;
  subpartId?: string;
  subparts?: StoreSubpart[];
  items: DailyStockItem[];
  summary: StockSummary;
}

export const getDailyStock = async (date?: string, subpartId?: string): Promise<DailyStockResponse> => {
  const res = await api.get<DailyStockResponse>('/stock/daily', {
    params: {
      ...(date ? { date } : {}),
      ...(subpartId && subpartId !== 'ALL' ? { subpartId } : {}),
    },
  });
  return res.data;
};

export const adjustStock = async (dto: {
  itemId: string;
  date: string;
  quantity: number;
  note?: string;
  subpartId?: string;
}): Promise<any> => {
  const res = await api.post('/stock/adjust', dto);
  return res.data;
};

export const createItemAndStock = async (dto: {
  name: string;
  rate: number;
  cost: number;
  hsn: string;
  unit: string;
  description?: string;
  date: string;
  initialStock: number;
}): Promise<any> => {
  const res = await api.post('/stock/item', dto);
  return res.data;
};
