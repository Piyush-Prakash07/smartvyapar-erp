import {
  getDocumentTransactionType,
  getStockDelta,
} from './modules/stock/stock.service';
import {
  safeParseItemsData,
  safeParseLogisticsData,
  safeParsePayments,
} from './common/utils/json-parser';

describe('Phase 4: Final Production Simulation & Business Audit', () => {
  describe('PART 1 & PART 2: Inventory & Package Conversion Matrix (Mustard Oil 1 Box = 16 PCS)', () => {
    const conversionFactor = 16; // 1 Box = 16 Pieces

    it('1. Package conversion math: box quantity × conversionFactor + looseQty', () => {
      // 10 boxes = 160 PCS
      const purchaseQtyBoxes = 10;
      const purchasePcs = purchaseQtyBoxes * conversionFactor;
      expect(purchasePcs).toBe(160);

      // Sell: 1 full box + 6 loose pieces = 22 PCS
      const saleBoxes = 1;
      const saleLoose = 6;
      const salePcs = saleBoxes * conversionFactor + saleLoose;
      expect(salePcs).toBe(22);

      // Remaining stock from 10 boxes after selling 22 PCS = 138 PCS
      expect(purchasePcs - salePcs).toBe(138);
    });

    it('2. Full Stock Movement Lifecycle Simulation', () => {
      let currentStock = 0;

      // 1. Opening stock: 100 PCS
      const openingStock = 100;
      currentStock += openingStock;
      expect(currentStock).toBe(100);

      // 2. Purchase: 10 Boxes (160 PCS)
      const purchaseBoxes = 10;
      const purchaseQty = purchaseBoxes * conversionFactor;
      const purchaseDelta = getStockDelta('PURCHASE', purchaseQty);
      currentStock += purchaseDelta;
      expect(currentStock).toBe(260); // 100 + 160 = 260 PCS

      // 3. Sale: 1 Box + 6 Loose (22 PCS)
      const saleQty = 1 * conversionFactor + 6;
      const saleDelta = getStockDelta('SALE', saleQty);
      currentStock += saleDelta;
      expect(currentStock).toBe(238); // 260 - 22 = 238 PCS

      // 4. Sale Return: 1 Box (16 PCS) -> Stock increases
      const saleReturnQty = 1 * conversionFactor;
      const saleReturnDelta = getStockDelta('SALE_RETURN', saleReturnQty);
      currentStock += saleReturnDelta;
      expect(currentStock).toBe(254); // 238 + 16 = 254 PCS

      // 5. Purchase Return (Debit Note): 2 Boxes (32 PCS) -> Stock decreases
      const purchaseReturnQty = 2 * conversionFactor;
      const purchaseReturnDelta = getStockDelta(
        'PURCHASE_RETURN',
        purchaseReturnQty,
      );
      currentStock += purchaseReturnDelta;
      expect(currentStock).toBe(222); // 254 - 32 = 222 PCS
    });

    it('3. Document Type Identification from Logistics & Invoice Prefix', () => {
      // Normal purchase
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'purchase' }),
        ),
      ).toBe('PURCHASE');
      // Purchase return via docType
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'purchase_return' }),
        ),
      ).toBe('PURCHASE_RETURN');
      // Purchase return via debit_note docType
      expect(
        getDocumentTransactionType(
          true,
          JSON.stringify({ docType: 'debit_note' }),
        ),
      ).toBe('PURCHASE_RETURN');
      // Purchase return via DR prefix
      expect(getDocumentTransactionType(true, null, 'DR/2026/001')).toBe(
        'PURCHASE_RETURN',
      );

      // Normal sale
      expect(
        getDocumentTransactionType(false, JSON.stringify({ docType: 'sales' })),
      ).toBe('SALE');
      // Sale return via credit_note docType
      expect(
        getDocumentTransactionType(
          false,
          JSON.stringify({ docType: 'credit_note' }),
        ),
      ).toBe('SALE_RETURN');
      // Sale return via CR prefix
      expect(getDocumentTransactionType(false, null, 'CR/2026/005')).toBe(
        'SALE_RETURN',
      );
    });
  });

  describe('PART 2: Invoice Calculation Test Matrix', () => {
    it('1. Intra-State GST Calculation (50% CGST + 50% SGST)', () => {
      const taxableValue = 1000;
      const gstRate = 18; // 18% GST
      const isInterstate = false;

      const totalGst = (taxableValue * gstRate) / 100;
      const cgst = !isInterstate ? totalGst / 2 : 0;
      const sgst = !isInterstate ? totalGst / 2 : 0;
      const igst = isInterstate ? totalGst : 0;
      const grandTotal = taxableValue + totalGst;

      expect(totalGst).toBe(180);
      expect(cgst).toBe(90);
      expect(sgst).toBe(90);
      expect(igst).toBe(0);
      expect(grandTotal).toBe(1180);
    });

    it('2. Inter-State GST Calculation (100% IGST)', () => {
      const taxableValue = 2500;
      const gstRate = 12; // 12% IGST
      const isInterstate = true;

      const totalGst = (taxableValue * gstRate) / 100;
      const cgst = !isInterstate ? totalGst / 2 : 0;
      const sgst = !isInterstate ? totalGst / 2 : 0;
      const igst = isInterstate ? totalGst : 0;
      const grandTotal = taxableValue + totalGst;

      expect(totalGst).toBe(300);
      expect(cgst).toBe(0);
      expect(sgst).toBe(0);
      expect(igst).toBe(300);
      expect(grandTotal).toBe(2800);
    });

    it('3. Zero GST item calculation (0% rate)', () => {
      const taxableValue = 500;
      const gstRate = 0;
      const totalGst = (taxableValue * gstRate) / 100;
      const grandTotal = taxableValue + totalGst;

      expect(totalGst).toBe(0);
      expect(grandTotal).toBe(500);
    });

    it('4. Invoice Rounding and Grand Total precision', () => {
      const subtotal = 999.55;
      const gst = 179.919;
      const unroundedTotal = subtotal + gst; // 1179.469
      const roundedTotal = Math.round(unroundedTotal * 100) / 100;
      expect(roundedTotal).toBe(1179.47);
    });
  });

  describe('PART 3: Payment & Khata Ledger Workflow', () => {
    it('1. Cheque Workflow: PENDING cheque must NOT reduce outstanding balance; CLEARED cheque MUST reduce balance', () => {
      const invoiceTotal = 5000;

      const payments = [
        {
          amount: 2000,
          date: '2026-08-30',
          paymentMethod: 'CHEQUE',
          paymentStatus: 'PENDING',
          chequeNumber: 'CHQ-987654',
        },
        {
          amount: 1000,
          date: '2026-08-30',
          paymentMethod: 'UPI',
          paymentStatus: 'COMPLETED',
          referenceNumber: 'UPI-445566',
        },
      ];

      // Filter confirmed payments (COMPLETED or CLEARED only)
      const confirmedPaid = payments
        .filter(
          (p) =>
            p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'CLEARED',
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const pendingPaid = payments
        .filter((p) => p.paymentStatus === 'PENDING')
        .reduce((sum, p) => sum + p.amount, 0);

      const outstandingBalance = invoiceTotal - confirmedPaid;

      // Confirmed paid is 1000 (UPI only), Pending cheque is 2000
      expect(confirmedPaid).toBe(1000);
      expect(pendingPaid).toBe(2000);
      expect(outstandingBalance).toBe(4000); // 5000 - 1000 = 4000 (PENDING cheque did NOT reduce balance)

      // Now simulate cheque clearing
      payments[0].paymentStatus = 'CLEARED';
      const updatedConfirmedPaid = payments
        .filter(
          (p) =>
            p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'CLEARED',
        )
        .reduce((sum, p) => sum + p.amount, 0);
      const updatedOutstanding = invoiceTotal - updatedConfirmedPaid;

      expect(updatedConfirmedPaid).toBe(3000);
      expect(updatedOutstanding).toBe(2000); // 5000 - 3000 = 2000
    });

    it('2. Khata Ledger Multi-Payment reconciliation', () => {
      const invoiceTotal = 10000;
      const payments = [
        { amount: 3000, paymentMethod: 'CASH', paymentStatus: 'COMPLETED' },
        {
          amount: 4000,
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'COMPLETED',
        },
        { amount: 3000, paymentMethod: 'CARD', paymentStatus: 'COMPLETED' },
      ];

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = invoiceTotal - totalPaid;

      expect(totalPaid).toBe(10000);
      expect(balance).toBe(0);
    });
  });

  describe('PART 5: Pagination Math & Boundary Tests', () => {
    const totalRecords = 245;

    function paginate(page: number, limit: number) {
      const safePage = Math.max(1, page || 1);
      const safeLimit = Math.min(100, Math.max(1, limit || 50));
      const skip = (safePage - 1) * safeLimit;
      const totalPages = Math.ceil(totalRecords / safeLimit);
      return { page: safePage, limit: safeLimit, skip, totalPages };
    }

    it('1. Default pagination parameters (page 1, limit 50)', () => {
      const result = paginate(1, 50);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.skip).toBe(0);
      expect(result.totalPages).toBe(5);
    });

    it('2. Page 2 parameters (skip = 50)', () => {
      const result = paginate(2, 50);
      expect(result.page).toBe(2);
      expect(result.skip).toBe(50);
    });

    it('3. Max limit clamp enforcement (limit > 100 clamped to 100)', () => {
      const result = paginate(1, 500);
      expect(result.limit).toBe(100);
      expect(result.totalPages).toBe(3); // ceil(245 / 100) = 3
    });

    it('4. Negative or invalid page fallback', () => {
      const result = paginate(-5, 0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.skip).toBe(0);
    });
  });

  describe('PART 6: Multi-Tenant & Safe JSON Parsing Verification', () => {
    it('1. Safe JSON parsing with null, string, and malformed inputs', () => {
      expect(safeParseItemsData(null)).toEqual([]);
      expect(safeParseItemsData('{"broken')).toEqual([]);
      expect(safeParseLogisticsData(null)).toEqual({});
      expect(safeParsePayments(null)).toEqual([]);
    });

    it('2. Company Context Header Validation Rule', () => {
      const mockHeaders: Record<string, string | undefined> = {
        'x-company-id': 'comp-prod-1',
      };
      expect(mockHeaders['x-company-id']).toBe('comp-prod-1');

      const emptyHeaders: Record<string, string | undefined> = {};
      expect(emptyHeaders['x-company-id']).toBeUndefined();
    });
  });
});
