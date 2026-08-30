/**
 * SmartVyapar WhatsApp Utility
 * Formats cross-platform WhatsApp messages and opens direct WhatsApp web/app links
 */

export function sanitizeIndianPhone(phone: string): string {
  // Remove all non-digits
  const clean = (phone || '').replace(/\D/g, '');
  if (!clean) return '';
  // If 10 digits, prepend 91 (India country code)
  if (clean.length === 10) {
    return `91${clean}`;
  }
  // If starts with 0 and is 11 digits, replace 0 with 91
  if (clean.length === 11 && clean.startsWith('0')) {
    return `91${clean.slice(1)}`;
  }
  return clean;
}

export function getWhatsAppUniversalUrl(phone: string, text: string): string {
  const cleanPhone = sanitizeIndianPhone(phone);
  const encodedText = encodeURIComponent(text);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

export function getWhatsAppWebUrl(phone: string, text: string): string {
  const cleanPhone = sanitizeIndianPhone(phone);
  const encodedText = encodeURIComponent(text);
  return cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?text=${encodedText}`;
}

export function openWhatsApp(phone: string, text: string, preferWeb: boolean = true) {
  const url = preferWeb ? getWhatsAppWebUrl(phone, text) : getWhatsAppUniversalUrl(phone, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface InvoiceWhatsAppPayload {
  companyName: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{ name: string; quantity: number; unit?: string; rate?: number }>;
  totalAmount: number;
  paidAmount: number;
  upiId?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  docType?: string;
}

export function generateInvoiceWhatsAppMessage(payload: InvoiceWhatsAppPayload): string {
  const balanceDue = Math.max(0, payload.totalAmount - payload.paidAmount);
  const isPaid = balanceDue === 0;
  const formattedTotal = payload.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedPaid = payload.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedDue = balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const docTitle = payload.docType === 'sale_return' || payload.docType === 'credit_note'
    ? 'CREDIT NOTE'
    : payload.docType === 'purchase_return' || payload.docType === 'debit_note'
    ? 'DEBIT NOTE'
    : payload.docType === 'purchase'
    ? 'PURCHASE INVOICE'
    : 'SALE INVOICE';

  let msg = `*${docTitle} - ${payload.companyName.toUpperCase()}*\n`;
  msg += `----------------------------------------\n`;
  msg += `*Invoice No:* ${payload.invoiceNo || 'Draft'}\n`;
  msg += `*Date:* ${payload.invoiceDate || new Date().toISOString().split('T')[0]}\n`;
  msg += `*Customer:* ${payload.customerName || 'Valued Customer'}\n\n`;

  // Itemized summary (up to 4 items)
  if (payload.items && payload.items.length > 0) {
    msg += `*Items Summary:*\n`;
    payload.items.slice(0, 4).forEach((item, idx) => {
      msg += `  ${idx + 1}. ${item.name || 'Item'} (${item.quantity} ${item.unit || 'PCS'})\n`;
    });
    if (payload.items.length > 4) {
      msg += `  ...and ${payload.items.length - 4} more item(s)\n`;
    }
    msg += `\n`;
  }

  msg += `*Total Amount:* Rs. ${formattedTotal}\n`;
  msg += `*Amount Paid:* Rs. ${formattedPaid}\n`;

  if (isPaid) {
    msg += `*Payment Status:* [PAID IN FULL]\n\n`;
  } else {
    msg += `*Balance Due:* *Rs. ${formattedDue}*\n\n`;
  }

  // UPI Payment Link
  if (!isPaid && payload.upiId && payload.upiId.trim()) {
    const upiUri = `upi://pay?pa=${encodeURIComponent(payload.upiId.trim())}&pn=${encodeURIComponent(payload.companyName.trim())}&am=${balanceDue.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Inv ${payload.invoiceNo}`)}`;
    msg += `*Pay via UPI:* ${payload.upiId}\n`;
    msg += `*UPI Payment Link:*\n${upiUri}\n\n`;
  }

  // Bank Settlement Details
  if (!isPaid && (payload.bankName || payload.bankAccountNo)) {
    msg += `*Bank Settlement Details:*\n`;
    if (payload.bankName) msg += `- Bank: ${payload.bankName}\n`;
    if (payload.bankAccountNo) msg += `- A/C No: ${payload.bankAccountNo}\n`;
    if (payload.bankIfsc) msg += `- IFSC Code: ${payload.bankIfsc}\n`;
    msg += `\n`;
  }

  msg += `_Thank you for doing business with ${payload.companyName}!_`;
  return msg;
}

export interface KhataReminderPayload {
  companyName: string;
  customerName: string;
  customerPhone?: string;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  pendingInvoicesCount: number;
  upiId?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}

export function generateKhataReminderMessage(payload: KhataReminderPayload): string {
  const formattedBilled = payload.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedPaid = payload.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedDue = payload.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  let msg = `*Namaste ${payload.customerName},*\n\n`;
  msg += `This is a friendly payment update and ledger balance reminder from *${payload.companyName}*.\n\n`;
  msg += `*Account Summary:*\n`;
  msg += `----------------------------------------\n`;
  msg += `- Total Billed: Rs. ${formattedBilled}\n`;
  msg += `- Total Paid: Rs. ${formattedPaid}\n`;
  msg += `- *Outstanding Balance Due:* *Rs. ${formattedDue}*\n`;
  msg += `- Pending Invoices: ${payload.pendingInvoicesCount}\n\n`;

  if (payload.upiId && payload.upiId.trim()) {
    const upiUri = `upi://pay?pa=${encodeURIComponent(payload.upiId.trim())}&pn=${encodeURIComponent(payload.companyName.trim())}&am=${payload.balanceDue.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Khata Settlement`)}`;
    msg += `*Pay instantly via UPI:* ${payload.upiId}\n`;
    msg += `*UPI Pay Link:*\n${upiUri}\n\n`;
  }

  if (payload.bankName || payload.bankAccountNo) {
    msg += `*Bank Transfer Details:*\n`;
    if (payload.bankName) msg += `- Bank: ${payload.bankName}\n`;
    if (payload.bankAccountNo) msg += `- Account No: ${payload.bankAccountNo}\n`;
    if (payload.bankIfsc) msg += `- IFSC Code: ${payload.bankIfsc}\n`;
    msg += `\n`;
  }

  msg += `Kindly arrange to settle the outstanding balance at your earliest convenience.\n`;
  msg += `If already paid, please ignore this reminder.\n\n`;
  msg += `Warm regards,\n*${payload.companyName}*`;
  return msg;
}
