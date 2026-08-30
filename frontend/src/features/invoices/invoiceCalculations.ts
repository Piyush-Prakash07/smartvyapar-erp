/**
 * Invoice Line Item Calculation Engine
 *
 * Single source of truth for all invoice line item calculations.
 * Used by the invoice generator UI, preview table, and persistence layer.
 *
 * LEGACY MODE  (isOpenItem = false/undefined):
 *   Behaviour is bit-for-bit identical to the original getItemFinalRate() logic.
 *
 * OPEN/UNBOX MODE (isOpenItem = true):
 *   Supports mixed package + loose-piece billing, scoped discounts,
 *   volume discount rules, and auto-normalization of excess loose pieces.
 */

export interface InvoiceItem {
  id: string;
  name: string;
  hsn: string;
  rate: number | string;
  quantity: number | string;
  unit: string;
  gstRate: number | string;
  packing?: string;
  mrp?: number | string;
  unit1?: string;
  unit2?: string;
  conversionFactor?: number | string;
  discount1?: number | string;
  discount2?: number | string;
  volDisc1?: number | string;
  volDisc2?: number | string;
  isOpenItem?: boolean;
  looseQty?: number | string;
  piecePriceMode?: 'AUTO' | 'MANUAL';
  manualPiecePrice?: number | string;
  disc1AppliesTo?: 'LINE' | 'PACKAGE' | 'LOOSE';
  disc2AppliesTo?: 'LINE' | 'PACKAGE' | 'LOOSE';
  volDisc1MinQty?: number | string;
  volDisc2MinQty?: number | string;
}

export interface LineItemResult {
  packageQty: number;
  looseQty: number;
  totalPcs: number;
  piecePrice: number;
  packageAmount: number;
  looseAmount: number;
  discountOnPackage: number;
  discountOnLoose: number;
  discountOnLine: number;
  volumeDiscount: number;
  taxableAmount: number;
  gstAmount: number;
  finalAmount: number;
}

export function normalizeLooseQty(
  packageQty: number,
  looseQty: number,
  piecesPerPackage: number
): { packageQty: number; looseQty: number } {
  if (piecesPerPackage <= 0) return { packageQty, looseQty };
  if (looseQty < piecesPerPackage) return { packageQty, looseQty };
  const additional = Math.floor(looseQty / piecesPerPackage);
  return {
    packageQty: packageQty + additional,
    looseQty: looseQty % piecesPerPackage,
  };
}

export function calculateLineItem(item: InvoiceItem): LineItemResult {
  const num = (v: any, def = 0): number => {
    if (v === '' || v === undefined || v === null) return def;
    const p = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(p) ? def : p;
  };

  const piecesPerPackage = Math.max(1, num(item.conversionFactor, 1));
  const gstRate = Math.max(0, num(item.gstRate, 0));
  const gstMultiplier = 1 + gstRate / 100;
  const rate = Math.max(0, num(item.rate, 0));
  const quantity = Math.max(0, num(item.quantity, 0));
  const rawLoose = Math.max(0, num(item.looseQty, 0));
  const discount1 = num(item.discount1, 0);
  const discount2 = num(item.discount2, 0);
  const volDisc1 = num(item.volDisc1, 0);
  const volDisc2 = num(item.volDisc2, 0);

  // Auto-detect package + loose calculation if looseQty is present or isOpenItem is true
  const hasLoose = rawLoose > 0 || item.isOpenItem;

  if (!hasLoose) {
    let r = rate;
    if (discount1) r *= 1 - discount1 / 100;
    if (discount2) r *= 1 - discount2 / 100;
    if (volDisc1) r -= volDisc1 * piecesPerPackage;
    if (volDisc2) r -= volDisc2 * piecesPerPackage;
    r = Math.max(0, r);
    const taxableAmount = (r / gstMultiplier) * quantity;
    const gstAmount = taxableAmount * (gstRate / 100);
    return {
      packageQty: quantity,
      looseQty: 0,
      totalPcs: quantity * piecesPerPackage,
      piecePrice: rate / piecesPerPackage,
      packageAmount: rate * quantity,
      looseAmount: 0,
      discountOnPackage: 0,
      discountOnLoose: 0,
      discountOnLine: 0,
      volumeDiscount: 0,
      taxableAmount,
      gstAmount,
      finalAmount: taxableAmount + gstAmount,
    };
  }

  // MIXED PACKAGE + LOOSE MODE
  const packageQty = quantity;
  const looseQty = rawLoose;
  const packagePrice = rate;
  const manualPiecePrice = num(item.manualPiecePrice, 0);
  const piecePrice =
    item.piecePriceMode === 'MANUAL' && manualPiecePrice > 0
      ? manualPiecePrice
      : packagePrice / piecesPerPackage;
  const totalPcs = packageQty * piecesPerPackage + looseQty;
  const grossPackage = packageQty * packagePrice;
  const grossLoose = looseQty * piecePrice;
  let wPackage = grossPackage;
  let wLoose = grossLoose;
  let discountOnPackage = 0;
  let discountOnLoose = 0;
  let discountOnLine = 0;

  function applyPctDiscount(pct: number, target: 'LINE' | 'PACKAGE' | 'LOOSE') {
    if (!(pct > 0)) return;
    if (target === 'PACKAGE') {
      const d = wPackage * (pct / 100);
      discountOnPackage += d;
      wPackage -= d;
    } else if (target === 'LOOSE') {
      const d = wLoose * (pct / 100);
      discountOnLoose += d;
      wLoose -= d;
    } else {
      const lineTotal = wPackage + wLoose;
      if (lineTotal > 0) {
        const d = lineTotal * (pct / 100);
        discountOnLine += d;
        wPackage -= d * (wPackage / lineTotal);
        wLoose -= d * (wLoose / lineTotal);
      }
    }
  }

  if (discount1 > 0) applyPctDiscount(discount1, item.disc1AppliesTo || 'LINE');
  if (discount2 > 0) applyPctDiscount(discount2, item.disc2AppliesTo || 'LINE');

  let volumeDiscount = 0;
  const eligible: { minQty: number; ratePerPc: number }[] = [];
  const vd1Rate = volDisc1;
  const vd1Min = num(item.volDisc1MinQty, 0);
  const vd2Rate = volDisc2;
  const vd2Min = num(item.volDisc2MinQty, 0);
  if (vd1Rate > 0 && totalPcs >= vd1Min) eligible.push({ minQty: vd1Min, ratePerPc: vd1Rate });
  if (vd2Rate > 0 && totalPcs >= vd2Min) eligible.push({ minQty: vd2Min, ratePerPc: vd2Rate });
  if (eligible.length > 0) {
    eligible.sort((a, b) => b.minQty - a.minQty);
    volumeDiscount = totalPcs * eligible[0].ratePerPc;
  }

  const grossAfterAll = Math.max(0, wPackage + wLoose - volumeDiscount);
  const taxableAmount = grossAfterAll / gstMultiplier;
  const gstAmount = grossAfterAll - taxableAmount;

  return {
    packageQty,
    looseQty,
    totalPcs,
    piecePrice,
    packageAmount: grossPackage,
    looseAmount: grossLoose,
    discountOnPackage,
    discountOnLoose,
    discountOnLine,
    volumeDiscount,
    taxableAmount,
    gstAmount,
    finalAmount: grossAfterAll,
  };
}

export function convertNumberToWords(num: number): string {
  const rounded = Math.round(num);
  if (rounded === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function translate(n: number): string {
    let word = '';
    if (n < 20) {
      word = a[n];
    } else if (n < 100) {
      word = b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    } else {
      word = a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + translate(n % 100) : '');
    }
    return word.trim();
  }

  let k = rounded;
  let word = '';
  
  if (Math.floor(k / 10000000) > 0) {
    word += translate(Math.floor(k / 10000000)) + ' Crore ';
    k %= 10000000;
  }
  if (Math.floor(k / 100000) > 0) {
    word += translate(Math.floor(k / 100000)) + ' Lakh ';
    k %= 100000;
  }
  if (Math.floor(k / 1000) > 0) {
    word += translate(Math.floor(k / 1000)) + ' Thousand ';
    k %= 1000;
  }
  if (k > 0) {
    word += translate(k);
  }

  return word.trim() + ' Rupees Only';
}

