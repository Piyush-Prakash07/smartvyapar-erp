import {
  safeParseItemsData,
  safeParseLogisticsData,
  safeParsePayments,
} from './json-parser';

describe('Safe JSON Parser Utilities', () => {
  describe('safeParseItemsData', () => {
    it('should return empty array when input is null, undefined, or empty string', () => {
      expect(safeParseItemsData(null)).toEqual([]);
      expect(safeParseItemsData(undefined)).toEqual([]);
      expect(safeParseItemsData('')).toEqual([]);
    });

    it('should return empty array when input is invalid malformed JSON', () => {
      expect(safeParseItemsData('{"invalid": json')).toEqual([]);
      expect(safeParseItemsData('12345')).toEqual([]);
    });

    it('should parse valid items array with correct fallbacks', () => {
      const input = JSON.stringify([
        {
          id: 'item-1',
          name: 'Atta 10KG',
          rate: '350',
          quantity: 2,
          gstRate: '5',
          looseQty: '0',
          conversionFactor: '1',
        },
      ]);
      const result = safeParseItemsData(input);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Atta 10KG');
      expect(result[0].rate).toBe(350);
      expect(result[0].quantity).toBe(2);
      expect(result[0].gstRate).toBe(5);
      expect(result[0].unit).toBe('PCS');
    });
  });

  describe('safeParseLogisticsData', () => {
    it('should return empty object when input is invalid or null', () => {
      expect(safeParseLogisticsData(null)).toEqual({});
      expect(safeParseLogisticsData('invalid JSON')).toEqual({});
      expect(safeParseLogisticsData('[]')).toEqual({});
    });

    it('should correctly parse valid logistics payload', () => {
      const input = JSON.stringify({
        docType: 'sale_return',
        buyerName: 'Pooja Kirana Store',
        buyerGSTIN: '07AAAAA0000A1Z5',
      });
      const result = safeParseLogisticsData(input);
      expect(result.docType).toBe('sale_return');
      expect(result.buyerName).toBe('Pooja Kirana Store');
      expect(result.buyerGSTIN).toBe('07AAAAA0000A1Z5');
    });
  });

  describe('safeParsePayments', () => {
    it('should return empty array for null or malformed payment inputs', () => {
      expect(safeParsePayments(null)).toEqual([]);
      expect(safeParsePayments('not json')).toEqual([]);
    });

    it('should parse payments from JSON string or raw array', () => {
      const paymentList = [
        {
          amount: 500,
          paymentMethod: 'UPI',
          paymentStatus: 'COMPLETED',
          referenceNumber: 'UPI-12345',
        },
      ];
      const parsedFromArray = safeParsePayments(paymentList);
      expect(parsedFromArray).toHaveLength(1);
      expect(parsedFromArray[0].amount).toBe(500);
      expect(parsedFromArray[0].paymentMethod).toBe('UPI');

      const parsedFromString = safeParsePayments(JSON.stringify(paymentList));
      expect(parsedFromString).toHaveLength(1);
      expect(parsedFromString[0].referenceNumber).toBe('UPI-12345');
    });
  });
});
