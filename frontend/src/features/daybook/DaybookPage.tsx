import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getDaybook } from './api';
import type { DaybookResponse, DaybookTransaction } from './api';
import {
  Calendar,
  FileText,
  Store,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  RefreshCw,
  Eye,
  Info,
  AlertCircle
} from 'lucide-react';

interface DaybookPageProps {
  onLoadInvoice?: (invoice: any) => void;
  onLoadPurchaseInvoice?: (invoice: any) => void;
}

export default function DaybookPage({ onLoadInvoice, onLoadPurchaseInvoice }: DaybookPageProps) {
  const { activeCompany } = useAuth();
  
  // Date selection state, defaults to today's date in local YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [data, setData] = useState<DaybookResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDaybookData = async (showRefreshIndicator = false) => {
    if (!activeCompany) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const result = await getDaybook(selectedDate);
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch Daybook data:', err);
      setError(err.response?.data?.message || 'Failed to retrieve daybook records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch when activeCompany or selectedDate changes
  useEffect(() => {
    fetchDaybookData();
  }, [activeCompany?.id, selectedDate]);

  // Format currency helper (Indian Rupee)
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Helper to format date for human consumption
  const formatHumanDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
  };

  const handlePrint = () => {
    window.print();
  };

  // Action for loading details of Sales Invoice
  const handleViewSale = (item: DaybookTransaction) => {
    if (onLoadInvoice) {
      onLoadInvoice(item);
    }
  };

  // Action for loading details of Purchase Invoice
  const handleViewPurchase = (item: DaybookTransaction) => {
    if (onLoadPurchaseInvoice) {
      onLoadPurchaseInvoice(item);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#004870] border-t-transparent mb-2"></div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Daybook...</p>
      </div>
    );
  }

  const sales = data?.sales || [];
  const purchases = data?.purchases || [];
  const summary = data?.summary || {
    totalSales: 0,
    totalSalesPaid: 0,
    totalSalesPending: 0,
    totalPurchases: 0,
    totalPurchasesPaid: 0,
    totalPurchasesPending: 0,
    netAmount: 0,
    netPaidAmount: 0,
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Printable Header - Only visible when printing */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase text-center tracking-tight text-slate-900">
          {activeCompany?.name || 'SmartBiz ERP'}
        </h1>
        <p className="text-xs text-center text-slate-500 font-semibold uppercase tracking-widest mt-1">
          Daily Transaction Register (Daybook)
        </p>
        <div className="flex justify-between items-center mt-6 text-xs text-slate-700 font-semibold">
          <div>
            <span className="text-slate-400">Date Filtered:</span> {formatHumanDate(selectedDate)}
          </div>
          <div>
            <span className="text-slate-400">Generated:</span> {new Date().toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Screen Control Panel - Hidden in print */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            Daybook Register
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">
              Daily Ledger
            </span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Sales &amp; Purchase log for: <strong className="text-slate-700">{activeCompany?.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Picker Form */}
          <div className="relative flex items-center bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200 px-3 py-2 transition-colors w-full sm:w-auto">
            <Calendar size={15} className="text-slate-500 mr-2 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer w-full sm:w-auto"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDaybookData(true)}
            disabled={isRefreshing}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Refresh daybook transactions"
          >
            <RefreshCw size={15} className={`${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="bg-[#004870] hover:bg-[#003858] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Printer size={14} /> Print Daybook
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales Total Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 flex items-center gap-1.5">
              <FileText size={12} /> Total Sales (Credit Ledger)
            </span>
            <h3 className="text-2xl font-black mt-2">{formatMoney(summary.totalSales)}</h3>
            <div className="mt-3 flex justify-between items-center text-[10px] text-blue-100 border-t border-white/10 pt-2 font-medium">
              <span>Paid: {formatMoney(summary.totalSalesPaid)}</span>
              <span>Pending: {formatMoney(summary.totalSalesPending)}</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <ArrowUpRight size={100} />
          </div>
        </div>

        {/* Purchases Total Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-200 flex items-center gap-1.5">
              <Store size={12} /> Total Purchases (Debit Ledger)
            </span>
            <h3 className="text-2xl font-black mt-2">{formatMoney(summary.totalPurchases)}</h3>
            <div className="mt-3 flex justify-between items-center text-[10px] text-orange-100 border-t border-white/10 pt-2 font-medium">
              <span>Paid: {formatMoney(summary.totalPurchasesPaid)}</span>
              <span>Pending: {formatMoney(summary.totalPurchasesPending)}</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <ArrowDownRight size={100} />
          </div>
        </div>

        {/* Net Flow Balance Card */}
        <div className={`p-5 rounded-2xl shadow-sm relative overflow-hidden ${
          summary.netAmount >= 0 
            ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white' 
            : 'bg-gradient-to-br from-rose-600 to-rose-800 text-white'
        }`}>
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 flex items-center gap-1.5">
              <Scale size={12} /> Net Balance Margin
            </span>
            <h3 className="text-2xl font-black mt-2">
              {summary.netAmount >= 0 ? '+' : ''}{formatMoney(summary.netAmount)}
            </h3>
            <div className="mt-3 flex justify-between items-center text-[10px] text-white/80 border-t border-white/10 pt-2 font-medium">
              <span>Net Cash Flow: {formatMoney(summary.netPaidAmount)}</span>
              <span>
                {summary.netAmount >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <Scale size={100} />
          </div>
        </div>
      </div>

      {/* Main Tables Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Invoices List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-blue-50/30 flex justify-between items-center">
            <h3 className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-blue-500" /> Sales (Outward Register)
            </h3>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
              {sales.length} sale{sales.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {sales.length === 0 ? (
              <div className="p-8 text-center text-slate-400 my-auto">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold uppercase">No Sales Recorded</p>
                <p className="text-[10px] mt-1 text-slate-400">Invoices generated on this date will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100">
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                    <th className="py-3 px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600 max-w-[130px] truncate">
                        <div>{inv.partyName}</div>
                        {inv.gstin && (
                          <div className="text-[9px] text-slate-400 font-mono tracking-tight uppercase mt-0.5">GST: {inv.gstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatMoney(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatMoney(inv.paidAmount)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${inv.balanceAmount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {formatMoney(inv.balanceAmount)}
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          onClick={() => handleViewSale(inv)}
                          className="text-[#004870] hover:text-blue-900 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                          title="Open in Generator to View/Print"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Purchase Invoices List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-orange-50/30 flex justify-between items-center">
            <h3 className="text-xs font-black text-orange-850 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-orange-600" /> Purchases (Inward Register)
            </h3>
            <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
              {purchases.length} purchase{purchases.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {purchases.length === 0 ? (
              <div className="p-8 text-center text-slate-400 my-auto">
                <Store size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold uppercase">No Purchases Recorded</p>
                <p className="text-[10px] mt-1 text-slate-400">Supplier bills entered on this date will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100">
                    <th className="py-3 px-4">Bill No</th>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                    <th className="py-3 px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600 max-w-[130px] truncate">
                        <div>{inv.partyName}</div>
                        {inv.gstin && (
                          <div className="text-[9px] text-slate-400 font-mono tracking-tight uppercase mt-0.5">GST: {inv.gstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatMoney(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatMoney(inv.paidAmount)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${inv.balanceAmount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {formatMoney(inv.balanceAmount)}
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          onClick={() => handleViewPurchase(inv)}
                          className="text-orange-700 hover:text-orange-950 hover:bg-orange-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                          title="Open in Generator to View/Print"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
      </div>
      
      {/* Informational Help Alert - Screen only */}
      <div className="print:hidden bg-slate-100 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600 items-start">
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <p className="font-bold text-slate-700">How the Daybook Works:</p>
          <p className="mt-1">
            The Daybook matches transactions based on their **Invoice/Supply Date**. All invoices and bills created in the GST Invoice Generator automatically update the totals here in real-time. Use the date selector to search any historical date. If relational details like Party names or GSTIN are not linked directly, the register dynamically extracts fallback identifiers from the invoice logistics payload. Click **View** to inspect or reprint any register item.
          </p>
        </div>
      </div>
      
    </div>
  );
}
