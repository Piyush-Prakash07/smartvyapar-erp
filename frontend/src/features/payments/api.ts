import api from '../../lib/axios';

export interface PaymentTransaction {
  id: string;
  invoiceId?: string | null;
  purchaseInvoiceId?: string | null;
  invoiceNo: string;
  invoiceDate?: string | null;
  invoiceTotal?: number;
  partyName: string;
  gstin: string;
  farmName?: string | null;
  amount: number;
  date: string;
  paymentMethod?: string;
  paymentStatus?: string;
  referenceNumber?: string | null;
  provider?: string | null;
  bankName?: string | null;
  transferType?: string | null;
  maskedAccountReference?: string | null;
  paymentSubType?: string | null;
  senderMobileMasked?: string | null;
  receiverMobileMasked?: string | null;
  cardLastFour?: string | null;
  cardType?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  receiptNumber?: string | null;
  receivedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface PaymentsSummary {
  totalReceived: number;
  totalPaid: number;
  netCashflow: number;
}

export interface DailyPaymentsResponse {
  date: string;
  received: PaymentTransaction[];
  paid: PaymentTransaction[];
  summary: PaymentsSummary;
}

export const getDailyPayments = async (date?: string): Promise<DailyPaymentsResponse> => {
  const res = await api.get<DailyPaymentsResponse>('/payments/daily', {
    params: date ? { date } : undefined,
  });
  return res.data;
};
