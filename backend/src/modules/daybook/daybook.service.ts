import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { safeParseLogisticsData } from '../../common/utils/json-parser';

@Injectable()
export class DaybookService {
  constructor(private prisma: PrismaService) {}

  async getDaybookData(companyId: string, dateStr?: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = dateStr || todayStr;

    // Parse the dateStr. It is expected to be 'YYYY-MM-DD'
    const targetDate = new Date(targetDateStr);

    // Fallback if date is invalid
    const dateObj = isNaN(targetDate.getTime())
      ? new Date(todayStr)
      : targetDate;

    // Set the query range from 00:00:00.000 to 23:59:59.999 UTC of that calendar date
    const startOfDay = new Date(dateObj.getTime());
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(dateObj.getTime());
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all sales invoices of that day
    const sales = await this.prisma.invoice.findMany({
      where: {
        companyId,
        invoiceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        customer: true,
        payments: true,
      },
      orderBy: [{ invoiceNo: 'asc' }, { createdAt: 'asc' }],
    });

    // Fetch all purchase invoices of that day
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        invoiceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        mahajan: true,
        payments: true,
      },
      orderBy: [{ invoiceNo: 'asc' }, { createdAt: 'asc' }],
    });

    // Calculate aggregated metrics
    const totalSales = sales.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalSalesPaid = sales.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalSalesPending = totalSales - totalSalesPaid;

    const totalPurchases = purchases.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const totalPurchasesPaid = purchases.reduce(
      (sum, inv) => sum + inv.paidAmount,
      0,
    );
    const totalPurchasesPending = totalPurchases - totalPurchasesPaid;

    const netAmount = totalSales - totalPurchases;
    const netPaidAmount = totalSalesPaid - totalPurchasesPaid;

    return {
      date: targetDateStr,
      sales: sales.map((s) => {
        let customerName = s.customer?.name || '';
        let buyerGSTIN = s.customer?.gstin || '';

        // Parse logistics data if details are missing
        if (!customerName || !buyerGSTIN) {
          const logistics = safeParseLogisticsData(s.logisticsData);
          if (!customerName) customerName = logistics.buyerName || 'Walk-in';
          if (!buyerGSTIN) buyerGSTIN = logistics.buyerGSTIN || '';
        }

        return {
          id: s.id,
          companyId: s.companyId,
          customerId: s.customerId,
          invoiceNo: s.invoiceNo,
          invoiceDate: s.invoiceDate.toISOString(),
          partyName: customerName,
          gstin: buyerGSTIN,
          totalAmount: s.totalAmount,
          paidAmount: s.paidAmount,
          balanceAmount: s.totalAmount - s.paidAmount,
          subtotal: s.subtotal,
          totalGst: s.totalGst,
          isInterstate: s.isInterstate,
          logisticsData: s.logisticsData,
          itemsData: s.itemsData,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          payments: s.payments,
          customer: s.customer,
        };
      }),
      purchases: purchases.map((p) => {
        let supplierName = p.mahajan?.name || '';
        let sellerGSTIN = p.mahajan?.gstin || '';

        // Parse logistics data if details are missing
        if (!supplierName || !sellerGSTIN) {
          const logistics = safeParseLogisticsData(p.logisticsData);
          if (!supplierName)
            supplierName = logistics.sellerName || 'Direct Vendor';
          if (!sellerGSTIN) sellerGSTIN = logistics.sellerGSTIN || '';
        }

        return {
          id: p.id,
          companyId: p.companyId,
          mahajanId: p.mahajanId,
          invoiceNo: p.invoiceNo,
          invoiceDate: p.invoiceDate.toISOString(),
          partyName: supplierName,
          gstin: sellerGSTIN,
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          balanceAmount: p.totalAmount - p.paidAmount,
          subtotal: p.subtotal,
          totalGst: p.totalGst,
          isInterstate: p.isInterstate,
          logisticsData: p.logisticsData,
          itemsData: p.itemsData,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          payments: p.payments,
          mahajan: p.mahajan,
        };
      }),
      summary: {
        totalSales,
        totalSalesPaid,
        totalSalesPending,
        totalPurchases,
        totalPurchasesPaid,
        totalPurchasesPending,
        netAmount,
        netPaidAmount,
      },
    };
  }
}
