import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { calculateLineItem, convertNumberToWords } from '../features/invoices/invoiceCalculations';
import type { InvoiceTemplateData } from '../features/invoices/InvoicePrintTemplate';

/**
 * Checks if the user's browser / device supports Native Web Share with file attachments
 */
export function isNativeFileShareSupported(): boolean {
  try {
    if (typeof navigator !== 'undefined' && 'canShare' in navigator && typeof navigator.canShare === 'function') {
      const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [testFile] });
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Generates an official, high-resolution A4 GST Tax Invoice in pure vector format.
 * Features:
 * 1. Standard Formal "TAX INVOICE / ORIGINAL FOR RECIPIENT" Header
 * 2. Full Seller & Buyer GSTIN / State / PAN identities
 * 3. 4-column x 2-row structured Logistics Metadata Grid
 * 4. Itemized Product Table with default UNIT-1 (Qty) and vertical grid lines
 * 5. Clean in-line Totals without any text overlapping
 * 6. Amount in Words (Indian numbering format)
 * 7. Official Tax Slab Summary Table with column separators
 * 8. Real Scannable UPI QR Code (Scan & Pay) + Bank details
 * 9. Dual Signature block (Receiver & Authorized Signatory)
 */
export async function generateDirectInvoicePdfBlob(data: InvoiceTemplateData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm
  const rightEdge = margin + contentWidth; // 200mm

  // Outer Page Frame
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.35);
  pdf.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // 1. Formal Standard Header
  const isSaleReturn = data.docType === 'sale_return' || data.docType === 'credit_note';
  const isPurchaseReturn = data.docType === 'purchase_return' || data.docType === 'debit_note';
  const isReturnDoc = isSaleReturn || isPurchaseReturn;
  const pdfTitle = isSaleReturn ? 'CREDIT NOTE' : isPurchaseReturn ? 'DEBIT NOTE' : (data.docType === 'purchase' ? 'PURCHASE INVOICE' : 'SALE INVOICE');
  const pdfSubtitle = isSaleReturn 
    ? 'ORIGINAL FOR RECIPIENT / (ISSUED UNDER SECTION 34 OF CGST ACT - SALE RETURN)' 
    : isPurchaseReturn 
    ? 'ORIGINAL FOR SUPPLIER / (ISSUED UNDER SECTION 34 OF CGST ACT - PURCHASE RETURN)' 
    : 'ORIGINAL FOR RECIPIENT';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text(pdfTitle, pageWidth / 2, margin + 5.5, { align: 'center' });
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text(pdfSubtitle, pageWidth / 2, margin + 9.5, { align: 'center' });
  pdf.line(margin, margin + 11.5, rightEdge, margin + 11.5);

  // 2. Seller Section (Left) & Tax Registration (Right)
  let curY = margin + 11.5;
  const sellerHeight = 23;

  // Seller Details
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(15, 23, 42);
  const sellerName = (data.sellerName || 'MERCHANT STORE').toUpperCase();
  const sellerNameLines = pdf.splitTextToSize(sellerName, 106);
  pdf.text(sellerNameLines, margin + 3, curY + 4.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  const addressLines = pdf.splitTextToSize(data.sellerAddress || 'Store Address', 106);
  const addressY = curY + (sellerNameLines.length > 1 ? 9.5 : 8.5);
  pdf.text(addressLines.slice(0, 2), margin + 3, addressY);

  let contactStr = '';
  if (data.sellerPhone) contactStr += `Tel: ${data.sellerPhone}`;
  if (data.sellerEmail) contactStr += (contactStr ? ' | ' : '') + `Email: ${data.sellerEmail}`;
  if (contactStr) {
    pdf.setFontSize(7.5);
    pdf.text(contactStr, margin + 3, curY + 18.5);
  }

  // Divider between seller & registration
  pdf.setDrawColor(220, 226, 235);
  pdf.line(margin + 115, curY, margin + 115, curY + sellerHeight);

  // Seller Registration (Right)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(30, 41, 59);
  let rightY = curY + 4.5;
  if (data.sellerGSTIN) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`GSTIN: `, margin + 118, rightY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.sellerGSTIN, margin + 130, rightY);
    rightY += 4.5;
  }
  if (data.sellerPAN) {
    pdf.text(`PAN: ${data.sellerPAN}`, margin + 118, rightY);
    rightY += 4.5;
  }
  if (data.sellerFssai) {
    pdf.text(`FSSAI: ${data.sellerFssai}`, margin + 118, rightY);
    rightY += 4.5;
  }
  if (data.sellerState || data.sellerStateCode) {
    let sStr = 'State: ';
    if (data.sellerState && data.sellerStateCode) {
      sStr += `${data.sellerState} (${data.sellerStateCode})`;
    } else {
      sStr += data.sellerState || data.sellerStateCode || '';
    }
    pdf.text(sStr, margin + 118, rightY);
  }

  curY += sellerHeight;
  pdf.setDrawColor(30, 41, 59);
  pdf.line(margin, curY, rightEdge, curY);

  // 3. Invoice & Logistics Metadata Grid (4 Columns x 2 Separate Rows)
  const showReturnRow = isReturnDoc && (!!data.originalInvoiceNo || !!data.reasonForReturn);
  const metaHeight = showReturnRow ? 24 : 18;
  const colW = contentWidth / 4; // 47.5mm

  // Row 1 (y = curY to curY + 9)
  const docNoLabel = isSaleReturn ? 'CREDIT NOTE NO' : isPurchaseReturn ? 'DEBIT NOTE NO' : 'INVOICE NO';
  pdf.setFontSize(6.8);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'bold');
  pdf.text(docNoLabel, margin + 3, curY + 3.5);
  pdf.text('TRANSPORT / CARRIER', margin + colW + 3, curY + 3.5);
  pdf.text('GR/RR NUMBER', margin + colW * 2 + 3, curY + 3.5);
  pdf.text('REVERSE CHARGE (Y/N)', margin + colW * 3 + 3, curY + 3.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.invoiceNo || 'INV-001', margin + 3, curY + 7.5);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text((data.transport || 'N/A').slice(0, 20), margin + colW + 3, curY + 7.5);
  pdf.text((data.grRrNo || 'N/A').slice(0, 20), margin + colW * 2 + 3, curY + 7.5);
  pdf.text(data.reverseCharge || 'N', margin + colW * 3 + 3, curY + 7.5);

  // Sub-row horizontal divider
  pdf.setDrawColor(230, 235, 242);
  pdf.line(margin, curY + 9, rightEdge, curY + 9);

  // Row 2 (y = curY + 9 to curY + 18)
  pdf.setFontSize(6.8);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DATE OF SUPPLY', margin + 3, curY + 12.5);
  pdf.text('VEHICLE NO.', margin + colW + 3, curY + 12.5);
  pdf.text('STATION / DESTINATION', margin + colW * 2 + 3, curY + 12.5);
  pdf.text('FREIGHT STATUS', margin + colW * 3 + 3, curY + 12.5);

  const formattedDate = data.invoiceDate 
    ? new Date(data.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formattedDate, margin + 3, curY + 16.5);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text((data.vehicleNo || 'N/A').slice(0, 20), margin + colW + 3, curY + 16.5);
  pdf.text((data.station || 'N/A').slice(0, 20), margin + colW * 2 + 3, curY + 16.5);
  pdf.text((data.freightAmt || 'FREIGHT TO PAY').slice(0, 20), margin + colW * 3 + 3, curY + 16.5);

  // Optional Row 3: Return Reference and Reason (ONLY for Return documents)
  if (showReturnRow) {
    pdf.setDrawColor(230, 235, 242);
    pdf.line(margin, curY + 18, rightEdge, curY + 18);

    pdf.setFontSize(6.8);
    pdf.setTextColor(180, 83, 9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ORIGINAL INVOICE REF', margin + 3, curY + 20.5);
    pdf.text('REASON FOR RETURN', margin + colW * 2 + 3, curY + 20.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(15, 23, 42);
    let origText = data.originalInvoiceNo || 'N/A';
    if (data.originalInvoiceDate) {
      origText += ` (${new Date(data.originalInvoiceDate).toLocaleDateString('en-IN')})`;
    }
    pdf.text(origText, margin + 3, curY + 23.5);

    pdf.setFont('helvetica', 'normal');
    pdf.text((data.reasonForReturn || 'Customer Return').slice(0, 45), margin + colW * 2 + 3, curY + 23.5);
  }

  // Vertical dividers for logistics
  pdf.setDrawColor(220, 226, 235);
  pdf.line(margin + colW, curY, margin + colW, curY + metaHeight);
  pdf.line(margin + colW * 2, curY, margin + colW * 2, curY + metaHeight);
  pdf.line(margin + colW * 3, curY, margin + colW * 3, curY + metaHeight);

  curY += metaHeight;
  pdf.setDrawColor(30, 41, 59);
  pdf.line(margin, curY, rightEdge, curY);

  // 4. Buyer Details (Billed To)
  const buyerHeight = 15;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(0, 72, 112);
  pdf.text('BILLED TO / CUSTOMER DETAILS :', margin + 3, curY + 3.8);

  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  const buyerName = (data.buyerName || 'Valued Customer').toUpperCase();
  pdf.text(buyerName.slice(0, 55), margin + 3, curY + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  let buyerSub = '';
  if (data.buyerAddress) buyerSub += data.buyerAddress.slice(0, 50);
  if (data.buyerPhone) buyerSub += (buyerSub ? ' | Tel: ' : 'Tel: ') + data.buyerPhone;
  pdf.text(buyerSub || 'Local Customer', margin + 3, curY + 12);

  // Buyer GSTIN & State (Right)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(30, 41, 59);
  let bGstStr = `GSTIN / UIN: ${data.buyerGSTIN || 'N/A'}`;
  pdf.text(bGstStr, margin + 118, curY + 6.5);
  
  let bStateStr = '';
  if (data.buyerState && data.buyerStateCode) {
    bStateStr = `State / Code: ${data.buyerState} (${data.buyerStateCode})`;
  } else if (data.buyerState) {
    bStateStr = `State: ${data.buyerState}`;
  } else if (data.buyerStateCode) {
    bStateStr = `State Code: ${data.buyerStateCode}`;
  }
  if (bStateStr) {
    pdf.text(bStateStr, margin + 118, curY + 11.5);
  }

  curY += buyerHeight;
  pdf.setDrawColor(30, 41, 59);
  pdf.line(margin, curY, rightEdge, curY);

  // 5. Dynamic Self-Adjusting Items Table Definition (total available width = 190mm)
  interface ColumnSpec {
    id: string;
    label: string;
    preferredWidth: number;
    align: 'left' | 'center' | 'right';
    render: (item: any, calc: any, idx: number) => string;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const vis = data.visibleColumns || {};

  const hasPacking = vis.packing !== undefined ? !!vis.packing : items.some((it: any) => it.packing && String(it.packing).trim() !== '');
  const hasPcsPerUnit = !!vis.pcsPerUnit;
  const hasHsn = vis.hsn !== undefined ? !!vis.hsn : items.some((it: any) => it.hsn && String(it.hsn).trim() !== '');
  const hasMrp = !!vis.mrp;
  const hasUnit1 = vis.unit1 !== undefined ? !!vis.unit1 : true;
  const hasUnit2 = !!vis.unit2;
  const hasDiscount1 = !!vis.discount1;
  const hasDiscount2 = !!vis.discount2;
  const hasVolDisc = !!vis.volDisc1;
  const hasTaxable = vis.taxable !== undefined ? !!vis.taxable : true;
  const hasGst = vis.gst !== undefined ? !!vis.gst : true;

  const colSpecs: ColumnSpec[] = [
    {
      id: 'num',
      label: '#',
      preferredWidth: 8,
      align: 'center',
      render: (_, __, idx) => String(idx + 1),
    },
    {
      id: 'product',
      label: 'PRODUCT',
      preferredWidth: 60, // Flexible base width, will expand to take remaining width
      align: 'left',
      render: (it) => String(it.name || 'Item'),
    },
  ];

  if (hasPacking) {
    colSpecs.push({
      id: 'packing',
      label: 'PACKING',
      preferredWidth: 16,
      align: 'center',
      render: (it) => String(it.packing || it.unit || ''),
    });
  }

  if (hasPcsPerUnit) {
    colSpecs.push({
      id: 'pcsPerUnit',
      label: 'PCS/UNIT',
      preferredWidth: 14,
      align: 'center',
      render: (it) => String(it.conversionFactor || 1),
    });
  }

  if (hasHsn) {
    colSpecs.push({
      id: 'hsn',
      label: 'HSN',
      preferredWidth: 15,
      align: 'center',
      render: (it) => String(it.hsn || ''),
    });
  }

  if (hasMrp) {
    colSpecs.push({
      id: 'mrp',
      label: 'M.R.P',
      preferredWidth: 16,
      align: 'right',
      render: (it) => Number(it.mrp || 0).toFixed(2),
    });
  }

  if (hasUnit1) {
    colSpecs.push({
      id: 'qty',
      label: 'UNIT-1',
      preferredWidth: 14,
      align: 'center',
      render: (it, calc) => String(calc.packageQty || Number(it.unit1) || Number(it.quantity) || 1),
    });
  }

  if (hasUnit2) {
    colSpecs.push({
      id: 'unit2',
      label: 'UNIT-2',
      preferredWidth: 14,
      align: 'center',
      render: (it, calc) => String(calc.loosePiecesQty || Number(it.unit2) || Number(it.looseQty) || 0),
    });
  }

  colSpecs.push({
    id: 'rate',
    label: 'SALE RATE',
    preferredWidth: 18,
    align: 'right',
    render: (it) => Number(it.rate || 0).toFixed(2),
  });

  if (hasDiscount1) {
    colSpecs.push({
      id: 'discount1',
      label: 'DISC 1%',
      preferredWidth: 13,
      align: 'right',
      render: (it) => `${Number(it.discount1 || 0)}%`,
    });
  }

  if (hasDiscount2) {
    colSpecs.push({
      id: 'discount2',
      label: 'DISC 2%',
      preferredWidth: 13,
      align: 'right',
      render: (it) => `${Number(it.discount2 || 0)}%`,
    });
  }

  if (hasVolDisc) {
    colSpecs.push({
      id: 'volDisc',
      label: 'VOL. DISC',
      preferredWidth: 15,
      align: 'right',
      render: (it) => Number(it.volDisc1 || 0).toFixed(2),
    });
  }

  if (hasTaxable) {
    colSpecs.push({
      id: 'taxable',
      label: 'TAXABLE VAL',
      preferredWidth: 21,
      align: 'right',
      render: (_, calc) => calc.taxableAmount.toFixed(2),
    });
  }

  if (hasGst) {
    colSpecs.push({
      id: 'gst',
      label: 'GST%',
      preferredWidth: 12,
      align: 'center',
      render: (it) => `${Number(it.gstRate || 0)}%`,
    });
  }

  colSpecs.push({
    id: 'amount',
    label: 'AMOUNT (Rs.)',
    preferredWidth: 22,
    align: 'right',
    render: (_, calc) => calc.finalAmount.toFixed(2),
  });

  // Calculate dynamic column widths to fit contentWidth (190mm) exactly
  const nonProductWidth = colSpecs
    .filter(c => c.id !== 'product')
    .reduce((sum, c) => sum + c.preferredWidth, 0);

  const productWidth = Math.max(34, contentWidth - nonProductWidth);

  let curColX = margin;
  const layoutColumns = colSpecs.map(col => {
    const w = col.id === 'product' ? productWidth : col.preferredWidth;
    const x = curColX;
    curColX += w;
    return {
      ...col,
      width: w,
      x: x,
    };
  });

  // If sum exceeds contentWidth, scale columns proportionally to fit precisely
  const totalCalculatedW = curColX - margin;
  if (totalCalculatedW > contentWidth) {
    const scaleFactor = contentWidth / totalCalculatedW;
    let scaledX = margin;
    layoutColumns.forEach(c => {
      c.width = c.width * scaleFactor;
      c.x = scaledX;
      scaledX += c.width;
    });
  }

  const tableHeaderY = curY;
  const thH = 7;
  pdf.setFillColor(143, 174, 171); // Brand Teal #8faeab
  pdf.rect(margin, curY, contentWidth, thH, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.setTextColor(15, 23, 42);

  layoutColumns.forEach(col => {
    let tx = col.x;
    if (col.align === 'center') {
      tx = col.x + col.width / 2;
    } else if (col.align === 'right') {
      tx = col.x + col.width - 1.5;
    } else {
      tx = col.x + 1.5;
    }
    pdf.text(col.label, tx, curY + 4.8, { align: col.align });
  });

  curY += thH;
  pdf.setDrawColor(30, 41, 59);
  pdf.line(margin, curY, rightEdge, curY);

  // 6. Items Rows
  let subtotalCalc = 0;
  let gstTotalCalc = 0;
  let totalUnit1Qty = 0;
  const gstBreakdownMap: { [rate: number]: { base: number; gst: number } } = {};

  const maxItemsY = 175; // Ceiling before totals block
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.8);

  if (items.length === 0) {
    pdf.setTextColor(148, 163, 184);
    pdf.text('No line items recorded', pageWidth / 2, curY + 15, { align: 'center' });
    curY += 35;
  } else {
    items.forEach((it: any, idx: number) => {
      if (curY > maxItemsY) return;

      const calc = calculateLineItem(it);
      const unit1Qty = calc.packageQty || Number(it.unit1) || Number(it.quantity) || 1;
      const gstRate = Number(it.gstRate) || 0;

      subtotalCalc += calc.taxableAmount;
      gstTotalCalc += calc.gstAmount;
      totalUnit1Qty += unit1Qty;

      if (!gstBreakdownMap[gstRate]) gstBreakdownMap[gstRate] = { base: 0, gst: 0 };
      gstBreakdownMap[gstRate].base += calc.taxableAmount;
      gstBreakdownMap[gstRate].gst += calc.gstAmount;

      const rowH = 6.5;
      pdf.setTextColor(30, 41, 59);

      layoutColumns.forEach(col => {
        const cellStr = col.render(it, calc, idx);
        let tx = col.x;
        if (col.align === 'center') {
          tx = col.x + col.width / 2;
        } else if (col.align === 'right') {
          tx = col.x + col.width - 1.5;
        } else {
          tx = col.x + 1.5;
        }

        if (col.id === 'product') {
          const maxChars = Math.max(12, Math.floor(col.width * 0.52));
          pdf.text(cellStr.slice(0, maxChars), tx, curY + 4.5, { align: col.align });
        } else if (col.id === 'amount') {
          pdf.setFont('helvetica', 'bold');
          pdf.text(cellStr, tx, curY + 4.5, { align: col.align });
          pdf.setFont('helvetica', 'normal');
        } else {
          pdf.text(cellStr, tx, curY + 4.5, { align: col.align });
        }
      });

      curY += rowH;
      pdf.setDrawColor(230, 235, 242);
      pdf.line(margin, curY, rightEdge, curY);
    });
  }

  // Draw Full Vertical Lines through the main items table (from header down to items bottom)
  const itemsEndY = Math.max(curY, 175);
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.3);
  layoutColumns.slice(1).forEach(col => {
    pdf.line(col.x, tableHeaderY, col.x, itemsEndY);
  });

  // 7. Table In-Line Totals (Grand Total, Amount Paid, Balance Due)
  const totalsBlockY = itemsEndY;
  pdf.setDrawColor(30, 41, 59);
  pdf.line(margin, totalsBlockY, rightEdge, totalsBlockY);

  const subtotal = data.subtotal ?? subtotalCalc;
  const totalGst = data.totalGst ?? gstTotalCalc;
  const grandTotal = data.totalAmount ?? (subtotal + totalGst);
  const paidAmt = data.paidAmount ?? 0;
  const balanceDue = Math.max(0, grandTotal - paidAmt);

  const prodCol = layoutColumns.find(c => c.id === 'product') || layoutColumns[1];
  const qtyCol = layoutColumns.find(c => c.id === 'qty');
  const amtCol = layoutColumns.find(c => c.id === 'amount') || layoutColumns[layoutColumns.length - 1];

  // Grand Total Row
  pdf.setFillColor(250, 252, 255);
  pdf.rect(margin, totalsBlockY, contentWidth, 5.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('GRAND TOTAL', prodCol.x + 1.5, totalsBlockY + 4);
  if (qtyCol) {
    pdf.text(`${totalUnit1Qty}`, qtyCol.x + qtyCol.width / 2, totalsBlockY + 4, { align: 'center' });
  }
  pdf.text(`Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, amtCol.x + amtCol.width - 1.5, totalsBlockY + 4, { align: 'right' });
  pdf.line(margin, totalsBlockY + 5.5, rightEdge, totalsBlockY + 5.5);

  const showPaymentKhata = (data as any).showPaymentKhata !== false;
  let totalsHeight = 5.5;

  if (showPaymentKhata) {
    // Amount Paid Row
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(16, 149, 106);
    pdf.text('AMOUNT PAID', prodCol.x + 1.5, totalsBlockY + 9.5);
    pdf.text(`Rs. ${paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, amtCol.x + amtCol.width - 1.5, totalsBlockY + 9.5, { align: 'right' });
    pdf.setDrawColor(220, 226, 235);
    pdf.line(margin, totalsBlockY + 11, rightEdge, totalsBlockY + 11);

    // Balance Due Row
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(balanceDue > 0 ? 225 : 16, balanceDue > 0 ? 29 : 149, balanceDue > 0 ? 72 : 106);
    pdf.text('BALANCE DEBT DUE', prodCol.x + 1.5, totalsBlockY + 15);
    pdf.text(`Rs. ${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, amtCol.x + amtCol.width - 1.5, totalsBlockY + 15, { align: 'right' });
    pdf.setDrawColor(30, 41, 59);
    pdf.line(margin, totalsBlockY + 17, rightEdge, totalsBlockY + 17);
    totalsHeight = 17;
  }

  // 8. Lower Split Section
  const lowerY = totalsBlockY + totalsHeight;

  // Left Column (x = margin + 3 to 118mm): Amount in Words, UPI QR Code + Bank Details, Declaration
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('AMOUNT IN WORDS:', margin + 3, lowerY + 4.5);

  const amountInWords = convertNumberToWords(grandTotal);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  const wordsLines = pdf.splitTextToSize(amountInWords, 110);
  pdf.text(wordsLines, margin + 3, lowerY + 8.5);

  // Bank & UPI Section with Real Scannable QR Code (Optional)
  let bankY = lowerY + (wordsLines.length > 1 ? 15 : 13.5);
  const showBanking = (data as any).showBankingDetails !== false;
  
  if (showBanking && ((data.bankName || data.bankAccountNo || data.bankIfsc) || (data.upiId && data.upiId.trim()))) {
    const upiId = (data.upiId || 'smartvyapar@okaxis').trim();
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(sellerName)}&am=${balanceDue > 0 ? balanceDue.toFixed(2) : grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Inv ${data.invoiceNo || ''}`)}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(upiUri, {
        margin: 1,
        width: 140,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });

      // Draw QR Container Box
      const qrSize = 19;
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(200, 210, 220);
      pdf.roundedRect(margin + 3, bankY, qrSize, qrSize, 1, 1, 'FD');
      pdf.addImage(qrDataUrl, 'PNG', margin + 3.5, bankY + 0.5, qrSize - 1, qrSize - 1);

      // QR Label (Scan & Pay)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(0, 72, 112);
      pdf.text('SCAN & PAY', margin + 3 + qrSize / 2, bankY + qrSize + 3, { align: 'center' });

      // Bank Details (Right of QR Code)
      const bankDetailsX = margin + qrSize + 7;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(0, 72, 112);
      pdf.text('PAYMENT & BANK SETTLEMENT:', bankDetailsX, bankY + 3);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(51, 65, 85);
      let bTextY = bankY + 7;
      if (data.bankName) {
        pdf.text(`Bank: ${data.bankName}`, bankDetailsX, bTextY);
        bTextY += 3.8;
      }
      if (data.bankAccountNo) {
        pdf.text(`A/C: ${data.bankAccountNo}`, bankDetailsX, bTextY);
        bTextY += 3.8;
      }
      if (data.bankIfsc) {
        pdf.text(`IFSC: ${data.bankIfsc}`, bankDetailsX, bTextY);
        bTextY += 3.8;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(16, 149, 106);
      pdf.text(`UPI ID: ${upiId}`, bankDetailsX, bTextY);

      bankY += qrSize + 5;
    } catch (err) {
      console.warn('QR Code generation failed:', err);
      bankY += 15;
    }
  }

  // Declaration & Terms
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('DECLARATION & TERMS:', margin + 3, bankY + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('E.&O.E. 1. Goods once sold will not be taken back or exchanged.', margin + 3, bankY + 8);
  pdf.text('2. Subject to local jurisdiction only.', margin + 3, bankY + 11.5);

  // Vertical Divider between Left Details & Right Column
  pdf.setDrawColor(220, 226, 235);
  pdf.line(margin + 116, lowerY, margin + 116, pageHeight - margin);

  // Right Column: Official Tax Slab Summary Table with explicit vertical lines
  const taxSlabStartY = lowerY + 2;
  const taxSlabW = contentWidth - 118; // 72mm: [128 to 200]
  const tsCol1 = margin + 118; // 128
  const tsCol2 = tsCol1 + 22;  // 150
  const tsCol3 = tsCol2 + 25;  // 175
  const tsEnd = rightEdge;     // 200

  const breakdownEntries = Object.entries(gstBreakdownMap);
  // Sort tax slabs in ascending rate order (e.g. 5%, 12%, 18%, 28%)
  breakdownEntries.sort(([a], [b]) => Number(a) - Number(b));

  const numSlabRows = Math.max(1, breakdownEntries.length);
  const tsRowH = 3.5;
  const tsHeaderH = 4.5;
  const tsTotalH = 4.0;
  const taxTableH = tsHeaderH + (numSlabRows * tsRowH) + tsTotalH;

  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.3);
  pdf.rect(tsCol1, taxSlabStartY, taxSlabW, taxTableH);

  // Tax Slab Table Header
  pdf.setFillColor(245, 247, 250);
  pdf.rect(tsCol1, taxSlabStartY, taxSlabW, tsHeaderH, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TAX SLAB', tsCol1 + 11, taxSlabStartY + 3.2, { align: 'center' });
  pdf.text('TAXABLE VAL', tsCol2 + 23, taxSlabStartY + 3.2, { align: 'right' });
  pdf.text(data.isInterstate ? 'IGST' : 'CGST+SGST', tsCol3 + 23, taxSlabStartY + 3.2, { align: 'right' });
  pdf.line(tsCol1, taxSlabStartY + tsHeaderH, tsEnd, taxSlabStartY + tsHeaderH);

  // Tax Slab Rows (Include ALL tax slabs)
  let tRowY = taxSlabStartY + tsHeaderH;
  if (breakdownEntries.length === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text('5%', tsCol1 + 11, tRowY + 2.5, { align: 'center' });
    pdf.text(subtotal.toFixed(2), tsCol2 + 23, tRowY + 2.5, { align: 'right' });
    pdf.text(totalGst.toFixed(2), tsCol3 + 23, tRowY + 2.5, { align: 'right' });
    tRowY += tsRowH;
  } else {
    breakdownEntries.forEach(([rKey, val]) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.text(`${rKey}%`, tsCol1 + 11, tRowY + 2.5, { align: 'center' });
      pdf.text(val.base.toFixed(2), tsCol2 + 23, tRowY + 2.5, { align: 'right' });
      pdf.text(val.gst.toFixed(2), tsCol3 + 23, tRowY + 2.5, { align: 'right' });
      tRowY += tsRowH;
    });
  }

  // Tax Slab Total Row
  pdf.setFillColor(245, 247, 250);
  pdf.rect(tsCol1, tRowY, taxSlabW, tsTotalH, 'F');
  pdf.line(tsCol1, tRowY, tsEnd, tRowY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text('Total', tsCol1 + 11, tRowY + 2.8, { align: 'center' });
  pdf.text(subtotal.toFixed(2), tsCol2 + 23, tRowY + 2.8, { align: 'right' });
  pdf.text(totalGst.toFixed(2), tsCol3 + 23, tRowY + 2.8, { align: 'right' });

  // Draw Vertical lines in Tax Slab Table
  pdf.line(tsCol2, taxSlabStartY, tsCol2, taxSlabStartY + taxTableH);
  pdf.line(tsCol3, taxSlabStartY, tsCol3, taxSlabStartY + taxTableH);

  // 9. Signatures Block (Inside Right Column, beneath Tax Slab Table)
  const sigY = Math.max(lowerY + 22, taxSlabStartY + taxTableH + 5);

  // Receiver Signature (Left side of right column)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Receiver's Signature", margin + 133, sigY + 18, { align: 'center' });
  pdf.setDrawColor(200, 210, 220);
  pdf.line(margin + 120, sigY + 20, margin + 146, sigY + 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('RECEIVER', margin + 133, sigY + 24, { align: 'center' });

  // Authorized Signatory (Right side of right column)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(15, 23, 42);
  const sigFor = `FOR ${(data.sellerName || 'MERCHANT STORE').toUpperCase()}`;
  const sigForLines = pdf.splitTextToSize(sigFor, 36);
  pdf.text(sigForLines, margin + 172, sigY + 12, { align: 'center' });

  pdf.setDrawColor(200, 210, 220);
  pdf.line(margin + 154, sigY + 20, rightEdge - 3, sigY + 20);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('AUTHORIZED SIGNATORY', margin + 172, sigY + 24, { align: 'center' });

  return pdf.output('blob');
}

/**
 * Downloads the A4 PDF invoice directly to the user's computer
 */
export async function downloadDirectInvoicePdf(data: InvoiceTemplateData, fileName: string = 'Invoice.pdf'): Promise<boolean> {
  try {
    const blob = await generateDirectInvoicePdfBlob(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('Direct PDF download failed:', err);
    return false;
  }
}

/**
 * Shares the PDF using the browser's Native Web Share API (mobile/desktop app direct attachment)
 */
export async function sharePdfViaNativeShare(blob: Blob, fileName: string, text: string): Promise<boolean> {
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: fileName,
        text: text,
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    console.warn('Native share failed or dismissed:', err);
  }
  return false;
}
