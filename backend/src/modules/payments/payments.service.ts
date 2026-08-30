import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { safeParseLogisticsData } from '../../common/utils/json-parser';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async getDailyPayments(companyId: string, dateStr?: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = dateStr || todayStr;

    // Parse the dateStr. It is expected to be 'YYYY-MM-DD'
    const targetDate = new Date(targetDateStr);

    // Fallback if date is invalid
    const dateObj = isNaN(targetDate.getTime())
      ? new Date(todayStr)
      : targetDate;

    // Query range of that calendar date in UTC
    const startOfDay = new Date(dateObj.getTime());
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(dateObj.getTime());
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 1. Fetch customer payments (Received cash/inflow)
    const customerPayments = await this.prisma.payment.findMany({
      where: {
        invoice: {
          companyId,
        },
        OR: [
          {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 2. Fetch supplier payments (Paid cash/outflow)
    const supplierPayments = await this.prisma.payment.findMany({
      where: {
        purchaseInvoice: {
          companyId,
        },
        OR: [
          {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      include: {
        purchaseInvoice: {
          include: {
            mahajan: true,
            buyerSubpart: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Process customer payments list
    const received = customerPayments.map((p) => {
      const inv = p.invoice;
      let customerName = inv?.customer?.name || '';
      let buyerGSTIN = inv?.customer?.gstin || '';
      let farmName = '';

      if (inv) {
        const logistics = safeParseLogisticsData(inv.logisticsData);
        if (!customerName) customerName = logistics.buyerName || 'Walk-in';
        if (!buyerGSTIN) buyerGSTIN = logistics.buyerGSTIN || '';
        farmName = logistics.sellerName || '';
      }

      return {
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNo: inv?.invoiceNo || '',
        invoiceDate: inv?.invoiceDate ? inv.invoiceDate.toISOString() : null,
        invoiceTotal: inv?.totalAmount || 0,
        partyName: customerName,
        gstin: buyerGSTIN,
        farmName: farmName || 'Primary Store',
        amount: p.amount,
        date: p.date.toISOString(),
        paymentMethod: p.paymentMethod || 'CASH',
        paymentStatus: p.paymentStatus || 'COMPLETED',
        referenceNumber: p.referenceNumber || null,
        provider: p.provider || null,
        bankName: p.bankName || null,
        transferType: p.transferType || null,
        maskedAccountReference: p.maskedAccountReference || null,
        paymentSubType: p.paymentSubType || null,
        senderMobileMasked: p.senderMobileMasked || null,
        receiverMobileMasked: p.receiverMobileMasked || null,
        cardLastFour: p.cardLastFour || null,
        cardType: p.cardType || null,
        chequeNumber: p.chequeNumber || null,
        chequeDate: p.chequeDate ? p.chequeDate.toISOString() : null,
        receiptNumber: p.receiptNumber || null,
        receivedBy: p.receivedBy || null,
        notes: p.notes || null,
        createdAt: p.createdAt.toISOString(),
      };
    });

    // Process supplier payments list
    const paid = supplierPayments.map((p) => {
      const pinv = p.purchaseInvoice;
      let supplierName = pinv?.mahajan?.name || '';
      let sellerGSTIN = pinv?.mahajan?.gstin || '';
      let farmName = pinv?.buyerSubpart?.name || '';

      if (pinv) {
        const logistics = safeParseLogisticsData(pinv.logisticsData);
        if (!supplierName)
          supplierName = logistics.sellerName || 'Direct Vendor';
        if (!sellerGSTIN) sellerGSTIN = logistics.sellerGSTIN || '';
        if (!farmName) farmName = logistics.buyerName || '';
      }

      return {
        id: p.id,
        purchaseInvoiceId: p.purchaseInvoiceId,
        invoiceNo: pinv?.invoiceNo || '',
        invoiceDate: pinv?.invoiceDate ? pinv.invoiceDate.toISOString() : null,
        invoiceTotal: pinv?.totalAmount || 0,
        partyName: supplierName,
        gstin: sellerGSTIN,
        farmName: farmName || 'Primary Store',
        amount: p.amount,
        date: p.date.toISOString(),
        paymentMethod: p.paymentMethod || 'CASH',
        paymentStatus: p.paymentStatus || 'COMPLETED',
        referenceNumber: p.referenceNumber || null,
        provider: p.provider || null,
        bankName: p.bankName || null,
        transferType: p.transferType || null,
        maskedAccountReference: p.maskedAccountReference || null,
        paymentSubType: p.paymentSubType || null,
        senderMobileMasked: p.senderMobileMasked || null,
        receiverMobileMasked: p.receiverMobileMasked || null,
        cardLastFour: p.cardLastFour || null,
        cardType: p.cardType || null,
        chequeNumber: p.chequeNumber || null,
        chequeDate: p.chequeDate ? p.chequeDate.toISOString() : null,
        receiptNumber: p.receiptNumber || null,
        receivedBy: p.receivedBy || null,
        notes: p.notes || null,
        createdAt: p.createdAt.toISOString(),
      };
    });

    // Calculate daily summary
    const totalReceived = received.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    const netCashflow = totalReceived - totalPaid;

    return {
      date: targetDateStr,
      received,
      paid,
      summary: {
        totalReceived,
        totalPaid,
        netCashflow,
      },
    };
  }
}
