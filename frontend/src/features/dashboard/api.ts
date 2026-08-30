import api from '../../lib/axios';
import type {
  Item,
  CreateItemDto,
  Customer,
  CreateCustomerDto,
  Invoice,
  CreateInvoiceDto,
  Mahajan,
  CreateMahajanDto,
  PurchaseInvoice,
  CreatePurchaseInvoiceDto,
  Payment,
  StoreSubpart,
  CreateStoreSubpartDto,
} from './types';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function extractData<T>(resData: T[] | PaginatedResponse<T> | unknown): T[] {
  if (resData && typeof resData === 'object' && 'data' in resData && Array.isArray((resData as PaginatedResponse<T>).data)) {
    return (resData as PaginatedResponse<T>).data;
  }
  return Array.isArray(resData) ? (resData as T[]) : [];
}

// Items API
export const getItems = async (params?: { page?: number; limit?: number; all?: boolean }): Promise<Item[]> => {
  const res = await api.get<Item[] | PaginatedResponse<Item>>('/items', { params: params || { all: true } });
  return extractData<Item>(res.data);
};

export const createItem = async (data: CreateItemDto): Promise<Item> => {
  const res = await api.post<Item>('/items', data);
  return res.data;
};

export const updateItem = async (id: string, data: CreateItemDto): Promise<Item> => {
  const res = await api.put<Item>(`/items/${id}`, data);
  return res.data;
};

export const deleteItem = async (id: string): Promise<void> => {
  await api.delete(`/items/${id}`);
};

// Customers API
export const getCustomers = async (params?: { page?: number; limit?: number; all?: boolean }): Promise<Customer[]> => {
  const res = await api.get<Customer[] | PaginatedResponse<Customer>>('/customers', { params: params || { all: true } });
  return extractData<Customer>(res.data);
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const res = await api.get<Customer>(`/customers/${id}`);
  return res.data;
};

export const createCustomer = async (data: CreateCustomerDto): Promise<Customer> => {
  const res = await api.post<Customer>('/customers', data);
  return res.data;
};

export const updateCustomer = async (id: string, data: CreateCustomerDto): Promise<Customer> => {
  const res = await api.put<Customer>(`/customers/${id}`, data);
  return res.data;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await api.delete(`/customers/${id}`);
};

// Invoices API
export const getInvoices = async (params?: { page?: number; limit?: number; all?: boolean }): Promise<Invoice[]> => {
  const res = await api.get<Invoice[] | PaginatedResponse<Invoice>>('/invoices', { params: params || { all: true } });
  return extractData<Invoice>(res.data);
};

export const createInvoice = async (data: CreateInvoiceDto): Promise<Invoice> => {
  const res = await api.post<Invoice>('/invoices', data);
  return res.data;
};

export const deleteInvoice = async (id: string): Promise<void> => {
  await api.delete(`/invoices/${id}`);
};

export const updateInvoicePayment = async (id: string, paidAmount: number, payments?: Partial<Payment>[]): Promise<Invoice> => {
  const res = await api.patch<Invoice>(`/invoices/${id}/payment`, { paidAmount, payments });
  return res.data;
};

export const updateInvoiceLogistics = async (id: string, logisticsData: string): Promise<Invoice> => {
  const res = await api.patch<Invoice>(`/invoices/${id}/logistics`, { logisticsData });
  return res.data;
};

// Mahajans API
export const getMahajans = async (params?: { page?: number; limit?: number; all?: boolean }): Promise<Mahajan[]> => {
  const res = await api.get<Mahajan[] | PaginatedResponse<Mahajan>>('/mahajans', { params: params || { all: true } });
  return extractData<Mahajan>(res.data);
};

export const getMahajan = async (id: string): Promise<Mahajan> => {
  const res = await api.get<Mahajan>(`/mahajans/${id}`);
  return res.data;
};

export const createMahajan = async (data: CreateMahajanDto): Promise<Mahajan> => {
  const res = await api.post<Mahajan>('/mahajans', data);
  return res.data;
};

export const updateMahajan = async (id: string, data: CreateMahajanDto): Promise<Mahajan> => {
  const res = await api.put<Mahajan>(`/mahajans/${id}`, data);
  return res.data;
};

export const deleteMahajan = async (id: string): Promise<void> => {
  await api.delete(`/mahajans/${id}`);
};

// Purchase Invoices API
export const getPurchaseInvoices = async (params?: { page?: number; limit?: number; all?: boolean }): Promise<PurchaseInvoice[]> => {
  const res = await api.get<PurchaseInvoice[] | PaginatedResponse<PurchaseInvoice>>('/purchase-invoices', { params: params || { all: true } });
  return extractData<PurchaseInvoice>(res.data);
};

export const createPurchaseInvoice = async (data: CreatePurchaseInvoiceDto): Promise<PurchaseInvoice> => {
  const res = await api.post<PurchaseInvoice>('/purchase-invoices', data);
  return res.data;
};

export const deletePurchaseInvoice = async (id: string): Promise<void> => {
  await api.delete(`/purchase-invoices/${id}`);
};

export const updatePurchaseInvoicePayment = async (id: string, paidAmount: number, payments?: Partial<Payment>[]): Promise<PurchaseInvoice> => {
  const res = await api.patch<PurchaseInvoice>(`/purchase-invoices/${id}/payment`, { paidAmount, payments });
  return res.data;
};

export const updatePurchaseInvoiceLogistics = async (id: string, logisticsData: string): Promise<PurchaseInvoice> => {
  const res = await api.patch<PurchaseInvoice>(`/purchase-invoices/${id}/logistics`, { logisticsData });
  return res.data;
};

// Store Subparts (Multiple Buyers / Godowns / Branches) API
export const getStoreSubparts = async (): Promise<StoreSubpart[]> => {
  const res = await api.get<StoreSubpart[]>('/store-subparts');
  return res.data;
};

export const createStoreSubpart = async (data: CreateStoreSubpartDto): Promise<StoreSubpart> => {
  const res = await api.post<StoreSubpart>('/store-subparts', data);
  return res.data;
};

export const updateStoreSubpart = async (id: string, data: CreateStoreSubpartDto): Promise<StoreSubpart> => {
  const res = await api.put<StoreSubpart>(`/store-subparts/${id}`, data);
  return res.data;
};

export const deleteStoreSubpart = async (id: string): Promise<void> => {
  await api.delete(`/store-subparts/${id}`);
};
