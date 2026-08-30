export interface InvoiceItemData {
  id?: string;
  name: string;
  hsn?: string;
  rate: number;
  quantity: number;
  unit?: string;
  gstRate?: number;
  mrp?: number;
  cost?: number;
  packing?: string;
  isOpenItem?: boolean;
  looseQty?: number;
  conversionFactor?: number;
  discount1?: number;
  discount2?: number;
  volDisc1?: number;
  volDisc2?: number;
}

export interface LogisticsData {
  docType?: string;
  returnStatus?: string;
  verifiedAt?: string;
  originalInvoiceNo?: string;
  originalInvoiceDate?: string;
  reasonForReturn?: string;
  sellerSubpartId?: string;
  buyerSubpartId?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerGSTIN?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerState?: string;
  sellerStateCode?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerGSTIN?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerState?: string;
  buyerStateCode?: string;
  transport?: string;
  vehicleNo?: string;
  station?: string;
  grRrNo?: string;
  freightAmt?: string | number;
  reverseCharge?: string;
  ewayBillNo?: string;
  orderNo?: string;
  orderDate?: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  upiId?: string;
  showUpiQr?: boolean;
  showBankingDetails?: boolean;
  showPaymentKhata?: boolean;
}

export interface PaymentMetadata {
  id?: string;
  amount: number;
  date: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
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
}

export interface PaginationQueryDto {
  page?: number;
  limit?: number;
  all?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
