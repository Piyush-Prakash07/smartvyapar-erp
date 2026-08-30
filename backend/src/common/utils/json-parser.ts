import { InvoiceItemData, LogisticsData, PaymentMetadata } from '../types';

/**
 * Safely parses a JSON string into an array of typed invoice items.
 * If input is invalid or not an array, returns an empty array.
 */
export function safeParseItemsData(
  raw: string | null | undefined,
): InvoiceItemData[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : undefined,
        name: typeof item.name === 'string' ? item.name : '',
        hsn: typeof item.hsn === 'string' ? item.hsn : undefined,
        rate: Number(item.rate) || 0,
        quantity: Number(item.quantity) || 0,
        unit: typeof item.unit === 'string' ? item.unit : 'PCS',
        gstRate:
          typeof item.gstRate === 'number'
            ? item.gstRate
            : Number(item.gstRate) || 0,
        mrp: Number(item.mrp) || 0,
        cost: Number(item.cost) || 0,
        packing: typeof item.packing === 'string' ? item.packing : undefined,
        isOpenItem: Boolean(item.isOpenItem),
        looseQty: Number(item.looseQty) || 0,
        conversionFactor: Number(item.conversionFactor) || 1,
        discount1: Number(item.discount1) || 0,
        discount2: Number(item.discount2) || 0,
        volDisc1: Number(item.volDisc1) || 0,
        volDisc2: Number(item.volDisc2) || 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Safely parses a JSON string into a typed LogisticsData object.
 * Returns default empty object if malformed or null.
 */
export function safeParseLogisticsData(
  raw: string | null | undefined,
): LogisticsData {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Safely parses payment records from array or JSON string.
 */
export function safeParsePayments(payments: unknown): PaymentMetadata[] {
  if (!payments) return [];
  let list: unknown[] = [];
  if (typeof payments === 'string') {
    try {
      const parsed = JSON.parse(payments) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  } else if (Array.isArray(payments)) {
    list = payments;
  }

  return list
    .filter(
      (p): p is Record<string, unknown> => typeof p === 'object' && p !== null,
    )
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : undefined,
      amount: Number(p.amount) || 0,
      date: typeof p.date === 'string' ? p.date : new Date().toISOString(),
      paymentMethod:
        typeof p.paymentMethod === 'string' ? p.paymentMethod : 'CASH',
      paymentStatus:
        typeof p.paymentStatus === 'string' ? p.paymentStatus : 'COMPLETED',
      referenceNumber:
        typeof p.referenceNumber === 'string' ? p.referenceNumber : null,
      provider: typeof p.provider === 'string' ? p.provider : null,
      bankName: typeof p.bankName === 'string' ? p.bankName : null,
      transferType: typeof p.transferType === 'string' ? p.transferType : null,
      maskedAccountReference:
        typeof p.maskedAccountReference === 'string'
          ? p.maskedAccountReference
          : null,
      paymentSubType:
        typeof p.paymentSubType === 'string' ? p.paymentSubType : null,
      senderMobileMasked:
        typeof p.senderMobileMasked === 'string' ? p.senderMobileMasked : null,
      receiverMobileMasked:
        typeof p.receiverMobileMasked === 'string'
          ? p.receiverMobileMasked
          : null,
      cardLastFour: typeof p.cardLastFour === 'string' ? p.cardLastFour : null,
      cardType: typeof p.cardType === 'string' ? p.cardType : null,
      chequeNumber: typeof p.chequeNumber === 'string' ? p.chequeNumber : null,
      chequeDate: typeof p.chequeDate === 'string' ? p.chequeDate : null,
      receiptNumber:
        typeof p.receiptNumber === 'string' ? p.receiptNumber : null,
      receivedBy: typeof p.receivedBy === 'string' ? p.receivedBy : null,
      notes: typeof p.notes === 'string' ? p.notes : null,
    }));
}
