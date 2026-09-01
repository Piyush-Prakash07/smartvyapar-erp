import { calculateLineItem, convertNumberToWords } from './invoiceCalculations';

export interface InvoiceTemplateData {
  invoiceNo?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerGSTIN?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerState?: string;
  sellerStateCode?: string;
  sellerPAN?: string;
  sellerFssai?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerGSTIN?: string;
  buyerPhone?: string;
  buyerState?: string;
  buyerStateCode?: string;
  items?: any[];
  subtotal?: number;
  totalGst?: number;
  totalAmount?: number;
  paidAmount?: number;
  isInterstate?: boolean;
  upiId?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  transport?: string;
  vehicleNo?: string;
  station?: string;
  grRrNo?: string;
  reverseCharge?: string;
  freightAmt?: string;
  ewayBillNo?: string;
  orderNo?: string;
  orderDate?: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  terms?: string;
  visibleColumns?: Record<string, boolean>;
  docType?: 'sales' | 'purchase' | 'sale_return' | 'purchase_return' | 'credit_note' | 'debit_note';
  originalInvoiceNo?: string;
  originalInvoiceDate?: string;
  reasonForReturn?: string;
  showPaymentKhata?: boolean;
  showBankingDetails?: boolean;
}

interface InvoicePrintTemplateProps {
  data: InvoiceTemplateData;
  id?: string;
}

export default function InvoicePrintTemplate({ data, id = 'whatsapp-modal-tax-invoice' }: InvoicePrintTemplateProps) {
  const items = Array.isArray(data.items) ? data.items : [];
  const vis = data.visibleColumns || {};

  const isSaleReturn = data.docType === 'sale_return' || data.docType === 'credit_note';
  const isPurchaseReturn = data.docType === 'purchase_return' || data.docType === 'debit_note';
  const docTitle = isSaleReturn ? 'CREDIT NOTE' : isPurchaseReturn ? 'DEBIT NOTE' : (data.docType === 'purchase' ? 'PURCHASE INVOICE' : 'SALE INVOICE');
  const docSubtitle = isSaleReturn 
    ? 'ORIGINAL FOR RECIPIENT / (ISSUED UNDER SECTION 34 OF CGST ACT - SALE RETURN)' 
    : isPurchaseReturn 
    ? 'ORIGINAL FOR SUPPLIER / (ISSUED UNDER SECTION 34 OF CGST ACT - PURCHASE RETURN)' 
    : 'ORIGINAL FOR RECIPIENT';

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
  
  const formatMoney = (amount: number = 0) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

  let subtotalCalc = 0;
  let gstTotalCalc = 0;
  let totalPieces = 0;
  const gstBreakdownMap: { [rate: number]: { base: number; gst: number } } = {};

  items.forEach(it => {
    const calc = calculateLineItem(it);
    subtotalCalc += calc.taxableAmount;
    gstTotalCalc += calc.gstAmount;
    totalPieces += calc.totalPcs || Number(it.quantity) || 1;
    const rKey = Number(it.gstRate) || 0;
    if (!gstBreakdownMap[rKey]) gstBreakdownMap[rKey] = { base: 0, gst: 0 };
    gstBreakdownMap[rKey].base += calc.taxableAmount;
    gstBreakdownMap[rKey].gst += calc.gstAmount;
  });

  const subtotal = data.subtotal ?? subtotalCalc;
  const totalGst = data.totalGst ?? gstTotalCalc;
  const totalAmount = data.totalAmount ?? (subtotal + totalGst);
  const paidAmount = data.paidAmount ?? 0;
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  interface HtmlColDef {
    id: string;
    label: string;
    headerClass: string;
    cellClass: string;
    render: (it: any, calc: any, idx: number) => React.ReactNode;
  }

  const columns: HtmlColDef[] = [
    {
      id: 'num',
      label: '#',
      headerClass: 'w-7 text-center',
      cellClass: 'text-center font-mono text-slate-500',
      render: (_, __, idx) => idx + 1,
    },
    {
      id: 'product',
      label: 'Product',
      headerClass: 'text-left px-2 min-w-[120px]',
      cellClass: 'font-bold text-slate-900 px-2',
      render: (it) => it.name || 'Item',
    },
  ];

  if (hasPacking) {
    columns.push({ id: 'packing', label: 'Packing', headerClass: 'w-14 text-center', cellClass: 'text-center text-slate-700', render: (it) => it.packing || it.unit || '' });
  }
  if (hasPcsPerUnit) {
    columns.push({ id: 'pcsPerUnit', label: 'Pcs/Unit', headerClass: 'w-12 text-center', cellClass: 'text-center font-bold text-slate-800', render: (it) => it.conversionFactor || 1 });
  }
  if (hasHsn) {
    columns.push({ id: 'hsn', label: 'HSN', headerClass: 'w-14 text-center', cellClass: 'text-center font-mono text-slate-700', render: (it) => it.hsn || '' });
  }
  if (hasMrp) {
    columns.push({ id: 'mrp', label: 'M.R.P', headerClass: 'w-14 text-right pr-1', cellClass: 'text-right font-mono text-slate-700 pr-1', render: (it) => Number(it.mrp || 0).toFixed(2) });
  }
  if (hasUnit1) {
    columns.push({ id: 'unit1', label: 'Unit-1', headerClass: 'w-12 text-center', cellClass: 'text-center font-bold text-[#004870]', render: (it, calc) => calc.packageQty || Number(it.unit1) || Number(it.quantity) || 1 });
  }
  if (hasUnit2) {
    columns.push({ id: 'unit2', label: 'Unit-2', headerClass: 'w-12 text-center', cellClass: 'text-center font-bold text-amber-900', render: (it, calc) => calc.loosePiecesQty || Number(it.unit2) || Number(it.looseQty) || 0 });
  }
  columns.push({ id: 'rate', label: 'Sale Rate', headerClass: 'w-16 text-right pr-1', cellClass: 'text-right font-medium text-slate-700 pr-1', render: (it) => Number(it.rate || 0).toFixed(2) });
  if (hasDiscount1) {
    columns.push({ id: 'discount1', label: 'Disc 1%', headerClass: 'w-12 text-right pr-1', cellClass: 'text-right font-mono text-slate-700 pr-1', render: (it) => `${Number(it.discount1 || 0)}%` });
  }
  if (hasDiscount2) {
    columns.push({ id: 'discount2', label: 'Disc 2%', headerClass: 'w-12 text-right pr-1', cellClass: 'text-right font-mono text-slate-700 pr-1', render: (it) => `${Number(it.discount2 || 0)}%` });
  }
  if (hasVolDisc) {
    columns.push({ id: 'volDisc1', label: 'Vol. Disc', headerClass: 'w-14 text-right pr-1', cellClass: 'text-right font-mono text-slate-700 pr-1', render: (it) => Number(it.volDisc1 || 0).toFixed(2) });
  }
  if (hasTaxable) {
    columns.push({ id: 'taxable', label: 'Taxable Val', headerClass: 'w-20 text-right pr-1', cellClass: 'text-right font-medium text-slate-700 pr-1', render: (_, calc) => calc.taxableAmount.toFixed(2) });
  }
  if (hasGst) {
    columns.push({ id: 'gst', label: 'GST%', headerClass: 'w-12 text-center', cellClass: 'text-center font-mono text-slate-600', render: (it) => `${Number(it.gstRate || 0)}%` });
  }
  columns.push({ id: 'amount', label: 'Amount (₹)', headerClass: 'w-24 text-right pr-2', cellClass: 'text-right font-black text-slate-900 pr-2', render: (_, calc) => calc.finalAmount.toFixed(2) });

  const totalColCount = columns.length;
  const preQtyColIdx = columns.findIndex(c => c.id === 'unit1');
  const leadingColSpan = preQtyColIdx > 0 ? preQtyColIdx : 2;
  const middleColSpan = totalColCount - leadingColSpan - 2;

  return (
    <div id={id} className="bg-white text-slate-900 font-sans text-[10px] leading-tight border-[1.5px] border-slate-900 w-[780px] p-0" style={{ boxSizing: 'border-box' }}>
      {data.irn ? (
        <div className="grid grid-cols-12 border-b border-slate-900 bg-slate-50/50">
          <div className="col-span-8 p-3 space-y-1">
            <div className={`text-sm font-black tracking-wider uppercase ${isSaleReturn ? 'text-purple-900' : isPurchaseReturn ? 'text-rose-900' : 'text-slate-900'}`}>{docTitle}</div>
            <div className="text-[8.5px] font-bold text-slate-600 uppercase tracking-wide">{docSubtitle}</div>
            <div className="pt-1 text-[8px] font-mono text-slate-700 break-all leading-none"><span className="font-bold font-sans uppercase text-slate-900">IRN: </span>{data.irn}</div>
          </div>
          <div className="col-span-4 p-2 border-l border-slate-900/10 flex items-center justify-between gap-2">
            <div className="text-[8px] leading-normal text-right font-medium">{data.ackNo && <div><span className="font-bold">Ack No:</span> {data.ackNo}</div>}{data.ackDate && <div><span className="font-bold">Ack Date:</span> {new Date(data.ackDate).toLocaleDateString('en-IN')}</div>}</div>
          </div>
        </div>
      ) : (
        <div className={`p-3 text-center border-b border-slate-900 ${isSaleReturn ? 'bg-purple-50/50' : isPurchaseReturn ? 'bg-rose-50/50' : 'bg-slate-50/30'}`}>
          <div className={`text-sm font-black tracking-widest uppercase ${isSaleReturn ? 'text-purple-950' : isPurchaseReturn ? 'text-rose-950' : 'text-slate-950'}`}>{docTitle}</div>
          <div className="text-[8.5px] font-bold text-slate-500 tracking-wider uppercase">{docSubtitle}</div>
        </div>
      )}

      <div className="grid grid-cols-12 border-b border-slate-900 bg-slate-50/20 p-2.5 text-left">
        <div className="col-span-7 space-y-1">
          <div className="text-[12px] font-black tracking-wide text-slate-900 uppercase">{data.sellerName || 'MERCHANT STORE'}</div>
          <div className="text-[8.5px] leading-normal text-slate-600 font-medium whitespace-pre-wrap">{data.sellerAddress || ''}</div>
          <div className="text-[9px] text-slate-800">{data.sellerPhone && <span><span className="font-bold">Tel: </span>{data.sellerPhone}</span>}{data.sellerEmail && <span>{data.sellerPhone ? ' | ' : ''}<span className="font-bold">Email: </span>{data.sellerEmail}</span>}</div>
        </div>
        <div className="col-span-5 border-l border-slate-900/10 pl-3 space-y-0.5 text-right flex flex-col justify-center">
          {data.sellerFssai && <div><span className="font-bold">FSSAI Lic: </span><span className="font-mono">{data.sellerFssai}</span></div>}
          {data.sellerPAN && <div><span className="font-bold">PAN: </span><span className="font-mono">{data.sellerPAN}</span></div>}
          {data.sellerGSTIN && <div><span className="font-bold">GSTIN: </span><span className="font-mono font-bold">{data.sellerGSTIN}</span></div>}
          {(data.sellerState || data.sellerStateCode) && (
            <div>
              <span className="font-bold">State: </span>
              {data.sellerState && data.sellerStateCode ? `${data.sellerState} (${data.sellerStateCode})` : (data.sellerState || data.sellerStateCode)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 border-b border-slate-900 text-left text-[9px]">
        <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-0.5"><span className="font-bold block text-[8px] text-slate-500 uppercase">{isSaleReturn ? 'Credit Note No' : isPurchaseReturn ? 'Debit Note No' : 'Invoice No'}</span><span className="font-bold text-[10.5px] font-mono">{data.invoiceNo || 'INV-001'}</span><div className="font-medium">{data.invoiceDate ? new Date(data.invoiceDate).toLocaleDateString('en-IN') : 'N/A'}</div></div>
        <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-0.5"><span className="font-bold block text-[8px] text-slate-500 uppercase">Transport / Carrier</span><span className="font-medium text-slate-800">{data.transport || 'N/A'}</span><div className="font-mono font-bold">{data.vehicleNo || 'N/A'}</div></div>
        <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-0.5"><span className="font-bold block text-[8px] text-slate-500 uppercase">GR/RR Number</span><span className="font-medium font-mono">{data.grRrNo || 'N/A'}</span><div>{data.station || 'N/A'}</div></div>
        <div className="col-span-3 p-1.5 space-y-0.5"><span className="font-bold block text-[8px] text-slate-500 uppercase">Reverse Charge</span><span className="font-bold">{data.reverseCharge || 'N'}</span><div className="font-medium">{data.freightAmt || 'FREIGHT TO PAY'}</div></div>
      </div>

      {(isSaleReturn || isPurchaseReturn) && (data.originalInvoiceNo || data.reasonForReturn) && (
        <div className="grid grid-cols-12 border-b border-slate-900 bg-amber-50/60 p-2 text-[8.5px] text-left">
          <div className="col-span-6 space-x-1">
            <span className="font-black text-amber-900 uppercase text-[8px]">Original Invoice Ref: </span>
            <span className="font-mono font-bold text-slate-900">{data.originalInvoiceNo || 'N/A'}</span>
            {data.originalInvoiceDate && <span className="text-slate-600 font-semibold">({new Date(data.originalInvoiceDate).toLocaleDateString('en-IN')})</span>}
          </div>
          <div className="col-span-6 text-right">
            {data.reasonForReturn && (
              <span>
                <span className="font-black text-amber-900 uppercase text-[8px]">Reason for Return: </span>
                <span className="font-bold text-slate-800">{data.reasonForReturn}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-slate-900 p-2.5 text-left bg-slate-50/20">
        <span className="font-black text-[9px] text-[#004870] uppercase block mb-1">Billed to / Customer Details :</span>
        <div className="text-[12px] font-black text-slate-900">{data.buyerName || 'Valued Customer'}</div>
        <div className="text-[9px] text-slate-600 leading-tight whitespace-pre-wrap font-medium">{data.buyerAddress}</div>
        <div className="flex flex-wrap gap-4 text-[9px] pt-1 text-slate-800">
          <div><span className="font-bold">GSTIN: </span>{data.buyerGSTIN || 'N/A'}</div>
          {(data.buyerState || data.buyerStateCode) && (
            <div>
              <span className="font-bold">State: </span>
              {data.buyerState && data.buyerStateCode ? `${data.buyerState} (${data.buyerStateCode})` : (data.buyerState || data.buyerStateCode)}
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="bg-[#8faeab] border-b border-slate-900 text-slate-900 font-bold uppercase text-center text-[9.5px]">
              {columns.map((col, cIdx) => <th key={col.id} className={`py-2 px-1 ${cIdx < columns.length - 1 ? 'border-r border-slate-900' : ''} ${col.headerClass} whitespace-nowrap`}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {items.length === 0 ? <tr><td colSpan={totalColCount} className="py-6 text-center text-slate-400">No items</td></tr> : items.map((it: any, idx: number) => {
              const calc = calculateLineItem(it);
              return <tr key={idx}>{columns.map((col, cIdx) => <td key={col.id} className={`py-1.5 px-1 ${cIdx < columns.length - 1 ? 'border-r border-slate-900' : ''} ${col.cellClass}`}>{col.render(it, calc, idx)}</td>)}</tr>;
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-900 font-bold text-[9.5px] bg-slate-50/60">
              <td colSpan={leadingColSpan} className="py-1.5 px-2 text-right uppercase">Grand Total</td>
              <td className="py-1.5 px-1 text-center font-mono">{totalPieces}</td>
              {middleColSpan > 0 && <td colSpan={middleColSpan} className="py-1.5"></td>}
              <td className="py-1.5 px-2 text-right font-black text-slate-900">{formatMoney(totalAmount)}</td>
            </tr>
            {data.showPaymentKhata !== false && (
              <>
                <tr className="border-t border-slate-200 text-[9px]"><td colSpan={totalColCount - 1} className="py-1 px-2 text-right uppercase font-semibold text-emerald-700">Amount Paid</td><td className="py-1 px-2 text-right font-bold text-emerald-700">{formatMoney(paidAmount)}</td></tr>
                <tr className="border-t border-slate-200 text-[9.5px]"><td colSpan={totalColCount - 1} className="py-1 px-2 text-right uppercase font-extrabold text-rose-700">Balance Debt Due</td><td className="py-1 px-2 text-right font-black text-rose-700">{formatMoney(balanceDue)}</td></tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-12 border-t border-slate-900 text-left">
        <div className="col-span-7 p-3 border-r border-slate-900 space-y-3 text-[8.5px]">
          <div>
            <span className="font-bold text-[7.5px] text-slate-400 uppercase tracking-wider block">Amount in Words:</span>
            <div className="text-[10px] font-black text-slate-900 capitalize italic leading-tight mt-0.5">
              {convertNumberToWords(totalAmount)}
            </div>
          </div>

          {data.showBankingDetails !== false && (data.bankName || data.bankAccountNo || data.upiId) && (
            <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-1">
              <span className="font-bold text-[8px] text-[#004870] uppercase block">Payment &amp; Bank Settlement</span>
              <div className="grid grid-cols-2 gap-1.5 text-[8px]">
                {data.bankName && <div><span className="text-slate-500 font-medium">Bank:</span> <strong className="text-slate-800">{data.bankName}</strong></div>}
                {data.bankAccountNo && <div><span className="text-slate-500 font-medium">A/C No:</span> <strong className="font-mono text-slate-800">{data.bankAccountNo}</strong></div>}
                {data.bankIfsc && <div><span className="text-slate-500 font-medium">IFSC:</span> <strong className="font-mono text-[#004870]">{data.bankIfsc}</strong></div>}
                {data.upiId && <div className="col-span-2 text-emerald-700 font-bold">📲 UPI: {data.upiId}</div>}
              </div>
            </div>
          )}

          <div className="space-y-0.5 text-slate-500 text-[7.5px] border-t border-slate-100 pt-1.5">
            <span className="font-bold uppercase block text-slate-700">Declaration &amp; Terms:</span>
            <p className="leading-tight">
              E.&amp;O.E. 1. Goods once sold will not be taken back or exchanged.<br />
              2. Subject to local jurisdiction only.
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-5 p-2.5 space-y-3 text-[8px] flex flex-col justify-between">
          
          {/* Tax Slabs Table */}
          <div className="border border-slate-900">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-900 font-bold uppercase text-[7px]">
                  <th className="py-0.5 border-r border-slate-900">Tax Slab</th>
                  <th className="py-0.5 border-r border-slate-900">Taxable Val</th>
                  <th className="py-0.5">{data.isInterstate ? 'IGST' : 'CGST+SGST'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {Object.keys(gstBreakdownMap).length === 0 ? (
                  <tr>
                    <td className="py-0.5 border-r border-slate-900 font-bold">5%</td>
                    <td className="py-0.5 border-r border-slate-900 font-mono">{subtotal.toFixed(2)}</td>
                    <td className="py-0.5 font-mono">{totalGst.toFixed(2)}</td>
                  </tr>
                ) : (
                  Object.entries(gstBreakdownMap).map(([rate, vals]) => (
                    <tr key={rate}>
                      <td className="py-0.5 border-r border-slate-900 font-bold">{rate}%</td>
                      <td className="py-0.5 border-r border-slate-900 font-mono">{vals.base.toFixed(2)}</td>
                      <td className="py-0.5 font-mono">{vals.gst.toFixed(2)}</td>
                    </tr>
                  ))
                )}
                <tr className="bg-slate-100 border-t border-slate-900 font-bold">
                  <td className="py-0.5 border-r border-slate-900">Total</td>
                  <td className="py-0.5 border-r border-slate-900 font-mono">{subtotal.toFixed(2)}</td>
                  <td className="py-0.5 font-mono">{totalGst.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-2 text-center text-[7.5px] pt-3">
            <div className="space-y-4 border-t border-slate-300 pt-1">
              <div className="text-slate-400 italic">Receiver's Signature</div>
              <div className="font-bold uppercase text-slate-600">Receiver</div>
            </div>
            <div className="space-y-4 border-t border-slate-300 pt-1">
              <div className="font-bold text-slate-900 break-words uppercase text-[7.5px] leading-tight">
                For {data.sellerName || 'Merchant'}
              </div>
              <div className="font-black uppercase text-slate-900 text-[7.5px] border-t border-slate-900/10 pt-0.5">
                Authorized Signatory
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
