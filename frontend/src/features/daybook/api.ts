import api from '../../lib/axios';

export interface DaybookTransaction {
  id: string;
  companyId: string;
  customerId?: string | null;
  mahajanId?: string | null;
  invoiceNo: string;
  invoiceDate: string;
  partyName: string;
  gstin: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  subtotal: number;
  totalGst: number;
  isInterstate: boolean;
  logisticsData: string;
  itemsData: string;
  createdAt: string;
  updatedAt: string;
  payments: any[];
  customer?: any;
  mahajan?: any;
}

export interface DaybookSummary {
  totalSales: number;
  totalSalesPaid: number;
  totalSalesPending: number;
  totalPurchases: number;
  totalPurchasesPaid: number;
  totalPurchasesPending: number;
  netAmount: number;
  netPaidAmount: number;
}

export interface DaybookResponse {
  date: string;
  sales: DaybookTransaction[];
  purchases: DaybookTransaction[];
  summary: DaybookSummary;
}

export const getDaybook = async (date?: string): Promise<DaybookResponse> => {
  const res = await api.get<DaybookResponse>('/daybook', {
    params: date ? { date } : undefined,
  });
  return res.data;
};
