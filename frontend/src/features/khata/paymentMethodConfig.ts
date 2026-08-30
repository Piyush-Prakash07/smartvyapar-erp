import type { PaymentMethod, PaymentStatus } from '../dashboard/types';

export interface PaymentMethodDefinition {
  key: PaymentMethod;
  label: string;
  shortLabel: string;
  iconName: string;
  emoji: string;
  referenceLabel?: string;
  referencePlaceholder?: string;
  defaultStatus: PaymentStatus;
  hasProvider?: boolean;
  providerList?: string[];
  hasSubType?: boolean;
  subTypeList?: string[];
  hasBankName?: boolean;
  hasTransferType?: boolean;
  transferTypeList?: string[];
  hasCardType?: boolean;
  cardTypeList?: string[];
  hasCardLastFour?: boolean;
  hasChequeDetails?: boolean;
  hasMobileNumbers?: boolean;
  hasReceiptNumber?: boolean;
  hasReceivedBy?: boolean;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodDefinition> = {
  CASH: {
    key: 'CASH',
    label: 'Cash',
    shortLabel: 'Cash',
    iconName: 'Banknote',
    emoji: '💵',
    defaultStatus: 'COMPLETED',
    hasReceivedBy: true,
    hasReceiptNumber: true,
  },
  UPI_QR: {
    key: 'UPI_QR',
    label: 'UPI / QR',
    shortLabel: 'UPI/QR',
    iconName: 'QrCode',
    emoji: '📱',
    referenceLabel: 'Transaction ID / UTR',
    referencePlaceholder: 'e.g. T240826XXXXX or UTR',
    defaultStatus: 'COMPLETED',
    hasSubType: true,
    subTypeList: ['QR Scan', 'UPI ID', 'Mobile Number'],
    hasProvider: true,
    providerList: ['PhonePe', 'Google Pay', 'Paytm', 'BHIM', 'Amazon Pay', 'Other'],
  },
  BANK_TRANSFER: {
    key: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    shortLabel: 'Bank Transfer',
    iconName: 'Building2',
    emoji: '🏦',
    referenceLabel: 'UTR / Reference Number',
    referencePlaceholder: 'e.g. HDFC20260826XXXX',
    defaultStatus: 'COMPLETED',
    hasBankName: true,
    hasTransferType: true,
    transferTypeList: ['NEFT', 'RTGS', 'IMPS', 'Bank Transfer', 'Other'],
  },
  MOBILE_TRANSFER: {
    key: 'MOBILE_TRANSFER',
    label: 'Mobile Transfer',
    shortLabel: 'Mobile Transfer',
    iconName: 'Smartphone',
    emoji: '📲',
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g. TXN12345678',
    defaultStatus: 'COMPLETED',
    hasMobileNumbers: true,
    hasProvider: true,
    providerList: ['PhonePe', 'Google Pay', 'Paytm', 'Other'],
  },
  DEBIT_CARD: {
    key: 'DEBIT_CARD',
    label: 'Debit Card',
    shortLabel: 'Debit Card',
    iconName: 'CreditCard',
    emoji: '💳',
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g. POS-987654',
    defaultStatus: 'COMPLETED',
    hasCardType: true,
    cardTypeList: ['Visa', 'Mastercard', 'RuPay', 'Other'],
    hasCardLastFour: true,
    hasBankName: true,
  },
  CREDIT_CARD: {
    key: 'CREDIT_CARD',
    label: 'Credit Card',
    shortLabel: 'Credit Card',
    iconName: 'CreditCard',
    emoji: '💳',
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g. POS-987654',
    defaultStatus: 'COMPLETED',
    hasCardType: true,
    cardTypeList: ['Visa', 'Mastercard', 'RuPay', 'American Express', 'Other'],
    hasCardLastFour: true,
    hasBankName: true,
  },
  CHEQUE: {
    key: 'CHEQUE',
    label: 'Cheque',
    shortLabel: 'Cheque',
    iconName: 'FileCheck',
    emoji: '🧾',
    referenceLabel: 'Cheque Number',
    referencePlaceholder: 'e.g. 000124',
    defaultStatus: 'PENDING',
    hasChequeDetails: true,
    hasBankName: true,
  },
  WALLET: {
    key: 'WALLET',
    label: 'Wallet',
    shortLabel: 'Wallet',
    iconName: 'Wallet',
    emoji: '💰',
    referenceLabel: 'Transaction ID',
    referencePlaceholder: 'e.g. WLT-456789',
    defaultStatus: 'COMPLETED',
    hasProvider: true,
    providerList: ['Paytm Wallet', 'Amazon Pay Wallet', 'Mobikwik', 'Other'],
  },
  OTHER: {
    key: 'OTHER',
    label: 'Other',
    shortLabel: 'Other',
    iconName: 'Pin',
    emoji: '📌',
    referenceLabel: 'Reference Number',
    referencePlaceholder: 'Reference / Voucher No',
    defaultStatus: 'COMPLETED',
  },
};

export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS);

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string; border: string }> = {
  COMPLETED: { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CLEARED: { label: 'Cleared', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  BOUNCED: { label: 'Bounced', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  FAILED: { label: 'Failed', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  REVERSED: { label: 'Reversed', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

/**
 * Mask mobile number to hide sensitive parts (e.g. 98765XXXXX)
 */
export function maskMobile(num?: string | null): string {
  if (!num) return '';
  const clean = num.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return clean.slice(0, 5) + 'X'.repeat(Math.max(0, clean.length - 5));
}

/**
 * Mask account number or card digits (e.g. ••••1234)
 */
export function maskDigits(lastFour?: string | null): string {
  if (!lastFour) return '';
  const clean = lastFour.trim();
  if (clean.length <= 4) return `••••${clean}`;
  return `••••${clean.slice(-4)}`;
}
