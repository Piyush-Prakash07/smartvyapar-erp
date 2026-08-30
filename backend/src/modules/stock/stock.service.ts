import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  safeParseItemsData,
  safeParseLogisticsData,
} from '../../common/utils/json-parser';

export type StockTransactionType =
  'PURCHASE' | 'PURCHASE_RETURN' | 'SALE' | 'SALE_RETURN';

/**
 * Identifies the official transaction document type using the structured docType field in logisticsData,
 * with fallback to invoice number prefix for legacy records.
 */
export function getDocumentTransactionType(
  isPurchase: boolean,
  logisticsData?: string | null,
  invoiceNo?: string | null,
): StockTransactionType {
  let docType = '';
  if (logisticsData) {
    const parsed = safeParseLogisticsData(logisticsData);
    if (parsed.docType) {
      docType = String(parsed.docType).toLowerCase().trim();
    }
  }

  const no = String(invoiceNo || '').toUpperCase();

  if (isPurchase) {
    if (
      docType === 'purchase_return' ||
      docType === 'debit_note' ||
      no.includes('-DR/') ||
      no.startsWith('DR/')
    ) {
      return 'PURCHASE_RETURN';
    }
    return 'PURCHASE';
  } else {
    if (
      docType === 'sale_return' ||
      docType === 'credit_note' ||
      no.includes('-CR/') ||
      no.startsWith('CR/')
    ) {
      return 'SALE_RETURN';
    }
    return 'SALE';
  }
}

/**
 * Returns the net stock movement delta for a given transaction type.
 * PURCHASE:        +quantity (Stock increases)
 * PURCHASE_RETURN: -quantity (Stock decreases)
 * SALE:            -quantity (Stock decreases)
 * SALE_RETURN:     +quantity (Stock increases)
 */
export function getStockDelta(
  transactionType: StockTransactionType,
  quantity: number,
): number {
  switch (transactionType) {
    case 'PURCHASE':
      return +quantity;
    case 'PURCHASE_RETURN':
      return -quantity;
    case 'SALE':
      return -quantity;
    case 'SALE_RETURN':
      return +quantity;
    default:
      return 0;
  }
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async getDailyStock(companyId: string, dateStr?: string, subpartId?: string) {
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

    // 1. Fetch all items in company's catalog
    const catalogItems = await this.prisma.item.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all sales invoices of the company
    const salesInvoices = await this.prisma.invoice.findMany({
      where: { companyId },
    });

    // 3. Fetch purchase invoices of the company (filtered by subpartId if provided)
    const isSubpartFilter =
      subpartId && subpartId !== 'ALL' && subpartId !== 'all';
    const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        ...(isSubpartFilter ? { buyerSubpartId: subpartId } : {}),
      },
      include: {
        buyerSubpart: true,
      },
    });

    // 4. Fetch all stock adjustments
    const adjustments = await this.prisma.stockAdjustment.findMany({
      where: {
        companyId,
        ...(isSubpartFilter ? { buyerSubpartId: subpartId } : {}),
      },
    });

    // 5. Fetch all company store subparts (multiple buyers)
    const subparts = await this.prisma.storeSubpart.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    // Map of item name -> stock metrics
    const stockMap = new Map<
      string,
      {
        id: string;
        name: string;
        unit: string;
        rate: number;
        cost: number;
        mrp: number;
        openingStock: number;
        inward: number;
        outward: number;
        adjustment: number;
      }
    >();

    // Initialize map with catalog items
    for (const item of catalogItems) {
      stockMap.set(item.name.toLowerCase().trim(), {
        id: item.id,
        name: item.name,
        unit: item.unit,
        rate: item.rate,
        cost: item.cost || item.rate,
        mrp: item.mrp || 0,
        openingStock: 0,
        inward: 0,
        outward: 0,
        adjustment: 0,
      });
    }

    // Process Purchase Invoices (Purchases & Purchase Returns)
    for (const pinv of purchaseInvoices) {
      const invDate = new Date(pinv.invoiceDate);
      const itemsList = safeParseItemsData(pinv.itemsData);

      const txType = getDocumentTransactionType(
        true,
        pinv.logisticsData,
        pinv.invoiceNo,
      );
      const isBeforeDay = invDate < startOfDay;
      const isDuringDay = invDate >= startOfDay && invDate <= endOfDay;

      for (const item of itemsList) {
        if (!item || !item.name) continue;
        const key = item.name.toLowerCase().trim();
        const rawQty = item.isOpenItem
          ? (Number(item.quantity) || 0) +
            (Number(item.looseQty) || 0) / (Number(item.conversionFactor) || 1)
          : Number(item.quantity) || 0;

        let entry = stockMap.get(key);
        if (!entry) {
          entry = {
            id: item.id || '',
            name: item.name,
            unit: item.unit || 'PCS',
            rate: Number(item.rate) || 0,
            cost: Number(item.rate) || 0,
            mrp: Number(item.mrp) || 0,
            openingStock: 0,
            inward: 0,
            outward: 0,
            adjustment: 0,
          };
          stockMap.set(key, entry);
        }

        const delta = getStockDelta(txType, rawQty);

        if (isBeforeDay) {
          entry.openingStock += delta;
        } else if (isDuringDay) {
          if (txType === 'PURCHASE') {
            entry.inward += rawQty;
          } else if (txType === 'PURCHASE_RETURN') {
            // Purchase return reduces inward stock / returns goods to vendor
            entry.inward -= rawQty;
          }
        }
      }
    }

    // Process Sales Invoices (Sales & Sale Returns)
    for (const inv of salesInvoices) {
      const invDate = new Date(inv.invoiceDate);
      const itemsList = safeParseItemsData(inv.itemsData);

      const txType = getDocumentTransactionType(
        false,
        inv.logisticsData,
        inv.invoiceNo,
      );
      const isBeforeDay = invDate < startOfDay;
      const isDuringDay = invDate >= startOfDay && invDate <= endOfDay;

      for (const item of itemsList) {
        if (!item || !item.name) continue;
        const key = item.name.toLowerCase().trim();
        const rawQty = item.isOpenItem
          ? (Number(item.quantity) || 0) +
            (Number(item.looseQty) || 0) / (Number(item.conversionFactor) || 1)
          : Number(item.quantity) || 0;

        let entry = stockMap.get(key);
        if (!entry) {
          entry = {
            id: item.id || '',
            name: item.name,
            unit: item.unit || 'PCS',
            rate: Number(item.rate) || 0,
            cost: Number(item.rate) || 0,
            mrp: Number(item.mrp) || 0,
            openingStock: 0,
            inward: 0,
            outward: 0,
            adjustment: 0,
          };
          stockMap.set(key, entry);
        }

        const delta = getStockDelta(txType, rawQty);

        if (isBeforeDay) {
          entry.openingStock += delta;
        } else if (isDuringDay) {
          if (txType === 'SALE') {
            entry.outward += rawQty;
          } else if (txType === 'SALE_RETURN') {
            // Sale return reduces outward stock / returns goods to inventory
            entry.outward -= rawQty;
          }
        }
      }
    }

    // Process Stock Adjustments
    for (const adj of adjustments) {
      const adjDate = new Date(adj.date);
      const isBeforeDay = adjDate < startOfDay;
      const isDuringDay = adjDate >= startOfDay && adjDate <= endOfDay;

      // Match by itemId
      const entry = Array.from(stockMap.values()).find(
        (x) => x.id === adj.itemId,
      );
      if (!entry) continue;

      const qty = Number(adj.quantity) || 0;

      if (isBeforeDay) {
        entry.openingStock += qty; // carry forward adjustments into opening stock
      } else if (isDuringDay) {
        entry.adjustment += qty; // record current day adjustment
      }
    }

    // Map to final values
    const items = Array.from(stockMap.values()).map((entry) => {
      const closingStock =
        entry.openingStock + entry.inward - entry.outward + entry.adjustment;
      const valuation = Math.max(0, closingStock) * entry.cost;

      return {
        id: entry.id,
        name: entry.name,
        unit: entry.unit,
        rate: entry.rate,
        cost: entry.cost,
        mrp: entry.mrp,
        openingStock: entry.openingStock,
        inward: entry.inward,
        outward: entry.outward,
        adjustment: entry.adjustment,
        closingStock,
        valuation,
      };
    });

    // Sort items alphabetically in ascending order (A to Z)
    items.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );

    const totalValuation = items.reduce((sum, item) => sum + item.valuation, 0);
    const totalClosingQty = items.reduce(
      (sum, item) => sum + Math.max(0, item.closingStock),
      0,
    );

    return {
      date: targetDateStr,
      subpartId: isSubpartFilter ? subpartId : 'ALL',
      subparts,
      items,
      summary: {
        totalItems: catalogItems.length,
        totalClosingQty,
        totalValuation,
      },
    };
  }

  async adjustStock(
    companyId: string,
    dto: {
      itemId: string;
      date: string;
      quantity: number;
      note?: string;
      subpartId?: string;
    },
  ) {
    const targetDate = new Date(dto.date);
    const dateObj = isNaN(targetDate.getTime()) ? new Date() : targetDate;
    const startOfDay = new Date(dateObj.getTime());
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Verify item exists
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, companyId },
    });
    if (!item) {
      throw new NotFoundException('Item not found in your company catalog');
    }

    const subpartId =
      dto.subpartId && dto.subpartId !== 'ALL' && dto.subpartId !== 'all'
        ? dto.subpartId
        : null;

    if (dto.quantity === 0) {
      // Delete adjustment record if quantity is reset to 0
      try {
        await this.prisma.stockAdjustment.deleteMany({
          where: {
            companyId,
            itemId: dto.itemId,
            date: startOfDay,
          },
        });
      } catch {
        // Record does not exist, ignore
      }
      return { success: true, message: 'Stock adjustment reset' };
    }

    const existingAdj = await this.prisma.stockAdjustment.findFirst({
      where: {
        companyId,
        itemId: dto.itemId,
        date: startOfDay,
      },
    });

    if (existingAdj) {
      return this.prisma.stockAdjustment.update({
        where: { id: existingAdj.id },
        data: {
          quantity: dto.quantity,
          note: dto.note,
          buyerSubpartId: subpartId,
        },
      });
    }

    return this.prisma.stockAdjustment.create({
      data: {
        companyId,
        itemId: dto.itemId,
        buyerSubpartId: subpartId,
        date: startOfDay,
        quantity: dto.quantity,
        note: dto.note,
      },
    });
  }

  async createItemAndStock(
    companyId: string,
    dto: {
      name: string;
      rate: number;
      cost: number;
      hsn: string;
      unit: string;
      description?: string;
      date: string;
      initialStock: number;
    },
  ) {
    const nameTrimmed = dto.name.trim();

    // Check duplicate name inside the company context
    const existing = await this.prisma.item.findFirst({
      where: {
        companyId,
        name: {
          equals: nameTrimmed,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new Error(
        `Item with name "${dto.name}" already exists in this company.`,
      );
    }

    // Create item
    const item = await this.prisma.item.create({
      data: {
        companyId,
        name: nameTrimmed,
        rate: dto.rate,
        cost: dto.cost || 0,
        hsn: dto.hsn || '21069099',
        unit: dto.unit || 'PCS',
        description: dto.description || null,
      },
    });

    // Create stock adjustment for initialStock if initialStock > 0
    if (dto.initialStock > 0) {
      const targetDate = new Date(dto.date);
      const dateObj = isNaN(targetDate.getTime()) ? new Date() : targetDate;
      const startOfDay = new Date(dateObj.getTime());
      startOfDay.setUTCHours(0, 0, 0, 0);

      await this.prisma.stockAdjustment.create({
        data: {
          companyId,
          itemId: item.id,
          date: startOfDay,
          quantity: dto.initialStock,
          note: 'Initial stock setup',
        },
      });
    }

    return item;
  }
}
