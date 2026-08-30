export type AccountType = 'CASH' | 'BANK' | 'CREDIT_CARD' | 'OTHER';
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Account {
  id: string;
  companyId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  type: TransactionType;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  companyId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  date: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    name: string;
    type: AccountType;
  };
  category: {
    id: string;
    name: string;
    type: TransactionType;
    color: string;
  };
}

export interface TransactionStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  categoryBreakdown: {
    id: string;
    name: string;
    color: string;
    amount: number;
  }[];
}

export interface CreateTransactionDto {
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description?: string;
  date?: string;
}

export interface CreateAccountDto {
  name: string;
  type: AccountType;
  initialBalance?: number;
}

export interface CreateCategoryDto {
  name: string;
  type: TransactionType;
  color?: string;
}

export interface Item {
  id: string;
  companyId: string;
  name: string;
  rate: number;
  cost: number;
  mrp: number;
  hsn: string;
  unit: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemDto {
  name: string;
  rate: number;
  cost?: number;
  mrp?: number;
  hsn?: string;
  unit?: string;
  description?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  createdAt: string;
  updatedAt: string;
  invoices?: Invoice[];
}

export interface CreateCustomerDto {
  name: string;
  gstin?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  stateCode?: string;
}

export type PaymentMethod =
  | 'CASH'
  | 'UPI_QR'
  | 'BANK_TRANSFER'
  | 'MOBILE_TRANSFER'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'CHEQUE'
  | 'WALLET'
  | 'OTHER';

export type PaymentStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'FAILED'
  | 'REVERSED'
  | 'BOUNCED'
  | 'CLEARED';

export interface Payment {
  id: string;
  invoiceId?: string;
  purchaseInvoiceId?: string;
  amount: number;
  date: string;
  paymentMethod?: PaymentMethod | string;
  paymentStatus?: PaymentStatus | string;
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
  updatedAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string | null;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  subtotal: number;
  totalGst: number;
  isInterstate: boolean;
  logisticsData: string;
  itemsData: string;
  createdAt: string;
  updatedAt: string;
  payments?: Payment[];
  customer?: Customer;
}

export interface CreateInvoiceDto {
  customerId?: string;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount?: number;
  subtotal: number;
  totalGst: number;
  isInterstate: boolean;
  logisticsData: string;
  itemsData: string;
}

export interface Mahajan {
  id: string;
  companyId: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseInvoices?: PurchaseInvoice[];
}

export interface CreateMahajanDto {
  name: string;
  gstin?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  stateCode?: string;
}

export interface StoreSubpart {
  id: string;
  companyId: string;
  name: string;
  code?: string | null;
  gstin?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  stateCode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreSubpartDto {
  name: string;
  code?: string;
  gstin?: string;
  phone?: string;
  address?: string;
  state?: string;
  stateCode?: string;
  isDefault?: boolean;
}

export interface PurchaseInvoice {
  id: string;
  companyId: string;
  mahajanId: string | null;
  buyerSubpartId?: string | null;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  subtotal: number;
  totalGst: number;
  isInterstate: boolean;
  logisticsData: string;
  itemsData: string;
  createdAt: string;
  updatedAt: string;
  payments?: Payment[];
  mahajan?: Mahajan;
  buyerSubpart?: StoreSubpart;
}

export interface CreatePurchaseInvoiceDto {
  mahajanId?: string;
  buyerSubpartId?: string;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount?: number;
  subtotal: number;
  totalGst: number;
  isInterstate: boolean;
  logisticsData: string;
  itemsData: string;
}

