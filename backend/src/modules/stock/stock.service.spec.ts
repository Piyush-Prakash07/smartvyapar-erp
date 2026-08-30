import { Test, TestingModule } from '@nestjs/testing';
import {
  StockService,
  getDocumentTransactionType,
  getStockDelta,
} from './stock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StockService - Return Logic & Calculations', () => {
  describe('Document Type and Stock Delta Helpers', () => {
    it('should correctly classify transaction types for purchases and debit notes', () => {
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'purchase' }),
        ),
      ).toBe('PURCHASE');
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'purchase_return' }),
        ),
      ).toBe('PURCHASE_RETURN');
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'debit_note' }),
        ),
      ).toBe('PURCHASE_RETURN');
      // Legacy fallback
      expect(getDocumentTransactionType(true, null, 'TE-DR/26-27/1')).toBe(
        'PURCHASE_RETURN',
      );
    });

    it('should correctly classify transaction types for sales and credit notes', () => {
      expect(
        getDocumentTransactionType(false, JSON.stringify({ docType: 'sales' })),
      ).toBe('SALE');
      expect(
        getDocumentTransactionType(
          false,
          JSON.stringify({ docType: 'sale_return' }),
        ),
      ).toBe('SALE_RETURN');
      expect(
        getDocumentTransactionType(
          false,
          JSON.stringify({ docType: 'credit_note' }),
        ),
      ).toBe('SALE_RETURN');
      // Legacy fallback
      expect(getDocumentTransactionType(false, null, 'TE-CR/26-27/1')).toBe(
        'SALE_RETURN',
      );
    });

    it('should calculate correct stock deltas for all 4 transaction types', () => {
      expect(getStockDelta('PURCHASE', 50)).toBe(50);
      expect(getStockDelta('PURCHASE_RETURN', 10)).toBe(-10);
      expect(getStockDelta('SALE', 20)).toBe(-20);
      expect(getStockDelta('SALE_RETURN', 5)).toBe(5);
    });
  });

  describe('Daily Stock Calculation Workflow', () => {
    let service: StockService;
    let mockPrisma: {
      item: { findMany: jest.Mock };
      invoice: { findMany: jest.Mock };
      purchaseInvoice: { findMany: jest.Mock };
      stockAdjustment: { findMany: jest.Mock };
      storeSubpart: { findMany: jest.Mock };
    };

    beforeEach(async () => {
      mockPrisma = {
        item: { findMany: jest.fn() },
        invoice: { findMany: jest.fn() },
        purchaseInvoice: { findMany: jest.fn() },
        stockAdjustment: { findMany: jest.fn() },
        storeSubpart: { findMany: jest.fn() },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StockService,
          { provide: PrismaService, useValue: mockPrisma },
        ],
      }).compile();

      service = module.get<StockService>(StockService);
    });

    it('Scenario 1 to 4: Opening Stock 100 -> Purchase 50 -> Sale 20 -> Sale Return 5 -> Purchase Return 10 = 125 PCS', async () => {
      const today = '2026-08-30';
      const companyId = 'comp-1';

      mockPrisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Sugar 1KG',
          unit: 'PCS',
          rate: 50,
          cost: 40,
          mrp: 55,
        },
      ]);

      mockPrisma.storeSubpart.findMany.mockResolvedValue([]);

      // Stock adjustment for opening stock of 100 (dated prior to today)
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([
        {
          id: 'adj-1',
          companyId,
          itemId: 'item-1',
          date: new Date('2026-08-01T00:00:00.000Z'),
          quantity: 100,
        },
      ]);

      // Purchase invoices on today:
      // 1. Normal purchase 50 PCS
      // 2. Purchase return 10 PCS
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          id: 'pinv-1',
          invoiceNo: 'PUR-101',
          invoiceDate: new Date('2026-08-30T10:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'purchase' }),
          itemsData: JSON.stringify([
            { name: 'Sugar 1KG', quantity: 50, rate: 40 },
          ]),
        },
        {
          id: 'pinv-2',
          invoiceNo: 'TE-DR/26-27/1',
          invoiceDate: new Date('2026-08-30T14:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'purchase_return' }),
          itemsData: JSON.stringify([
            { name: 'Sugar 1KG', quantity: 10, rate: 40 },
          ]),
        },
      ]);

      // Sales invoices on today:
      // 1. Normal sale 20 PCS
      // 2. Sale return 5 PCS
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'sinv-1',
          invoiceNo: 'TE/26-27/1',
          invoiceDate: new Date('2026-08-30T11:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'sales' }),
          itemsData: JSON.stringify([
            { name: 'Sugar 1KG', quantity: 20, rate: 50 },
          ]),
        },
        {
          id: 'sinv-2',
          invoiceNo: 'TE-CR/26-27/1',
          invoiceDate: new Date('2026-08-30T16:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'sale_return' }),
          itemsData: JSON.stringify([
            { name: 'Sugar 1KG', quantity: 5, rate: 50 },
          ]),
        },
      ]);

      const result = await service.getDailyStock(companyId, today);
      expect(result.items.length).toBe(1);

      const itemStock = result.items[0];
      expect(itemStock.openingStock).toBe(100);
      // Net Inward = 50 (purchase) - 10 (purchase return) = 40
      expect(itemStock.inward).toBe(40);
      // Net Outward = 20 (sale) - 5 (sale return) = 15
      expect(itemStock.outward).toBe(15);
      // Closing Stock = 100 + 40 - 15 = 125 PCS
      expect(itemStock.closingStock).toBe(125);
    });

    it('Package Conversion: 1 Carton = 16 PCS, Opening 160 PCS, Sell 2 Cartons + 5 PCS -> 123 PCS, Return 1 Carton + 2 PCS -> 141 PCS', async () => {
      const today = '2026-08-30';
      const companyId = 'comp-1';

      mockPrisma.item.findMany.mockResolvedValue([
        {
          id: 'item-2',
          name: 'Juice 200ML Pack (16 PCS/CTN)',
          unit: 'PCS',
          rate: 100,
          cost: 80,
          mrp: 120,
        },
      ]);

      mockPrisma.storeSubpart.findMany.mockResolvedValue([]);

      // Opening stock: 160 PCS
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([
        {
          id: 'adj-2',
          companyId,
          itemId: 'item-2',
          date: new Date('2026-08-01T00:00:00.000Z'),
          quantity: 160,
        },
      ]);

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([]);

      // Sell: 2 Cartons + 5 PCS (loose) -> 2 * 16 + 5 = 37 PCS
      // Return: 1 Carton + 2 PCS (loose) -> 1 * 16 + 2 = 18 PCS
      // Note: when unit is PCS and looseQty is given with conversionFactor = 16,
      // quantity = 32 and looseQty = 5 or quantity = 2 (CTN) with factor 16 and loose = 5.
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'sinv-pack-1',
          invoiceNo: 'TE/26-27/2',
          invoiceDate: new Date('2026-08-30T10:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'sales' }),
          itemsData: JSON.stringify([
            {
              name: 'Juice 200ML Pack (16 PCS/CTN)',
              isOpenItem: true,
              quantity: 2 * 16, // in PCS base unit: 32 PCS (2 Cartons)
              looseQty: 5,
              conversionFactor: 1, // base in PCS
            },
          ]),
        },
        {
          id: 'sinv-pack-2',
          invoiceNo: 'TE-CR/26-27/2',
          invoiceDate: new Date('2026-08-30T15:00:00.000Z'),
          logisticsData: JSON.stringify({ docType: 'sale_return' }),
          itemsData: JSON.stringify([
            {
              name: 'Juice 200ML Pack (16 PCS/CTN)',
              isOpenItem: true,
              quantity: 1 * 16, // 1 Carton = 16 PCS
              looseQty: 2,
              conversionFactor: 1,
            },
          ]),
        },
      ]);

      const result = await service.getDailyStock(companyId, today);
      const itemStock = result.items[0];

      expect(itemStock.openingStock).toBe(160);
      // Sale = 37 PCS, Return = 18 PCS -> Net outward = 19 PCS
      expect(itemStock.outward).toBe(19);
      // Closing = 160 - 37 + 18 = 141 PCS
      expect(itemStock.closingStock).toBe(141);
    });
  });
});
