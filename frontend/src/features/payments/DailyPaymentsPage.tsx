import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getDailyPayments } from './api';
import { getStoreSubparts } from '../dashboard/api';
import type { DailyPaymentsResponse, PaymentTransaction } from './api';
import type { StoreSubpart } from '../dashboard/types';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUS_CONFIG,
} from '../khata/paymentMethodConfig';
import type { PaymentMethod, PaymentStatus } from '../dashboard/types';
import {
  Calendar,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  RefreshCw,
  Info,
  AlertCircle,
  Receipt,
  Building,
  Filter
} from 'lucide-react';

export default function DailyPaymentsPage() {
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
  const [data, setData] = useState<DailyPaymentsResponse | null>(null);
  const [storeSubparts, setStoreSubparts] = useState<StoreSubpart[]>([]);
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchPaymentsData = async (showRefreshIndicator = false) => {
    if (!activeCompany) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const [result, subparts] = await Promise.all([
        getDailyPayments(selectedDate),
        getStoreSubparts().catch(() => [] as StoreSubpart[])
      ]);
      setData(result);
      setStoreSubparts(subparts);
    } catch (err: any) {
      console.error('Failed to fetch daily payments:', err);
      setError(err.response?.data?.message || 'Failed to retrieve daily payments records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
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

  // Helper to format payment transaction timestamp
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const rawReceived = data?.received || [];
  const rawPaid = data?.paid || [];

  // Compute unique farm/business firm names
  const uniqueFarmNames = useMemo(() => {
    const set = new Set<string>();
    storeSubparts.forEach(sp => set.add(sp.name));
    rawReceived.forEach(p => {
      if (p.farmName) set.add(p.farmName);
    });
    rawPaid.forEach(p => {
      if (p.farmName) set.add(p.farmName);
    });
    if (set.size === 0 && activeCompany?.name) set.add(activeCompany.name);
    return Array.from(set).sort();
  }, [storeSubparts, rawReceived, rawPaid, activeCompany]);

  // Filtered lists by selected farm
  const received = useMemo(() => {
    if (selectedFarmFilter === 'ALL') return rawReceived;
    return rawReceived.filter(p => (p.farmName || 'Primary Store') === selectedFarmFilter);
  }, [rawReceived, selectedFarmFilter]);

  const paid = useMemo(() => {
    if (selectedFarmFilter === 'ALL') return rawPaid;
    return rawPaid.filter(p => (p.farmName || 'Primary Store') === selectedFarmFilter);
  }, [rawPaid, selectedFarmFilter]);

  // Farm-scoped summary
  const summary = useMemo(() => {
    const totalReceived = received.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    return {
      totalReceived,
      totalPaid,
      netCashflow: totalReceived - totalPaid,
    };
  }, [received, paid]);

  // Compute breakdown by payment method
  const methodBreakdown = useMemo(() => {
    const map: Record<string, { label: string; emoji: string; received: number; paid: number }> = {};
    
    Object.values(PAYMENT_METHODS).forEach(m => {
      map[m.key] = { label: m.label, emoji: m.emoji, received: 0, paid: 0 };
    });

    received.forEach(p => {
      const k = p.paymentMethod || 'CASH';
      if (!map[k]) map[k] = { label: k, emoji: '💰', received: 0, paid: 0 };
      map[k].received += p.amount;
    });

    paid.forEach(p => {
      const k = p.paymentMethod || 'CASH';
      if (!map[k]) map[k] = { label: k, emoji: '💰', received: 0, paid: 0 };
      map[k].paid += p.amount;
    });

    return Object.entries(map)
      .filter(([_, v]) => v.received > 0 || v.paid > 0)
      .map(([key, v]) => ({ key, ...v }));
  }, [received, paid]);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#004870] border-t-transparent mb-2"></div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Payments Ledger...</p>
      </div>
    );
  }

  // Render a payment method & details badge cell
  const renderPaymentDetails = (p: PaymentTransaction) => {
    const methodKey = (p.paymentMethod as PaymentMethod) || 'CASH';
    const methodDef = PAYMENT_METHODS[methodKey] || PAYMENT_METHODS.CASH;
    const statusKey = (p.paymentStatus as PaymentStatus) || 'COMPLETED';
    const statusDef = PAYMENT_STATUS_CONFIG[statusKey] || PAYMENT_STATUS_CONFIG.COMPLETED;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Method badge */}
          <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-800 text-[10px] shadow-2xs">
            <span>{methodDef.emoji}</span>
            <span>{methodDef.label}</span>
          </span>

          {/* Status badge */}
          <span className={`inline-flex items-center px-1.5 py-0.2 rounded font-extrabold text-[9px] border ${statusDef.bg} ${statusDef.text} ${statusDef.border}`}>
            {statusDef.label}
          </span>
        </div>

        {/* Dynamic transaction metadata */}
        <div className="text-[10px] text-slate-600 flex items-center gap-1.5 flex-wrap font-medium">
          {p.provider && (
            <span className="bg-slate-200/60 px-1 py-0.2 rounded text-slate-700 font-semibold">
              {p.provider}
            </span>
          )}
          {p.paymentSubType && (
            <span className="text-slate-500">• {p.paymentSubType}</span>
          )}
          {p.bankName && (
            <span className="text-slate-700 font-semibold">
              {p.bankName} {p.transferType ? `(${p.transferType})` : ''}
            </span>
          )}
          {p.chequeNumber && (
            <span className="text-amber-800 font-bold">
              Chq #{p.chequeNumber}
            </span>
          )}
          {p.cardLastFour && (
            <span className="text-slate-700">
              {p.cardType || 'Card'} ••••{p.cardLastFour}
            </span>
          )}
          {p.referenceNumber && (
            <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
              Ref: {p.referenceNumber}
            </span>
          )}
          {p.receiptNumber && (
            <span className="text-slate-600">
              Rcpt: {p.receiptNumber}
            </span>
          )}
          {p.notes && (
            <span className="text-slate-400 italic">
              "{p.notes}"
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Printable Header - Only visible when printing */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase text-center tracking-tight text-slate-900">
          {activeCompany?.name || 'SmartBiz ERP'}
        </h1>
        <p className="text-xs text-center text-slate-500 font-semibold uppercase tracking-widest mt-1">
          Daily Cash &amp; Payments Inflow/Outflow Register {selectedFarmFilter !== 'ALL' ? `(${selectedFarmFilter})` : ''}
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
            <Receipt size={22} className="text-[#004870]" />
            Daily Payments Ledger
            <span className="text-[10px] font-bold text-[#004870] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">
              Cashflow &amp; Payment Methods
            </span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Real-time multi-method payment records for: <strong className="text-slate-700">{activeCompany?.name}</strong>
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
            onClick={() => fetchPaymentsData(true)}
            disabled={isRefreshing}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Refresh payments list"
          >
            <RefreshCw size={15} className={`${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="bg-[#004870] hover:bg-[#003858] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Printer size={14} /> Print Registry
          </button>
        </div>
      </div>

      {/* Farm / Business Firm Filter Bar */}
      {uniqueFarmNames.length > 0 && (
        <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building size={12} className="text-[#004870]" /> Filter Payments by Farm / Business Firm:
            </span>
            {selectedFarmFilter !== 'ALL' && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                Active: {selectedFarmFilter}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedFarmFilter('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFarmFilter === 'ALL'
                  ? 'bg-[#004870] text-white border-[#004870] shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter size={12} />
              All Farms Payments
            </button>
            {uniqueFarmNames.map(fName => (
              <button
                key={fName}
                type="button"
                onClick={() => setSelectedFarmFilter(fName)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFarmFilter === fName
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Building size={12} />
                {fName}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Cashflow Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Inflow Receipts Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100 flex items-center gap-1.5">
              <ArrowUpRight size={14} /> Cash Inflow (Customer Receipts) {selectedFarmFilter !== 'ALL' ? `• ${selectedFarmFilter}` : ''}
            </span>
            <h3 className="text-2xl font-black mt-2">{formatMoney(summary.totalReceived)}</h3>
            <p className="text-[10px] text-emerald-100 font-semibold mt-3 pt-2 border-t border-white/10">
              {received.length} receipt{received.length !== 1 ? 's' : ''} received today
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <ArrowUpRight size={100} />
          </div>
        </div>

        {/* Total Outflow Disbursements Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-100 flex items-center gap-1.5">
              <ArrowDownRight size={14} /> Cash Outflow (Supplier Disbursements) {selectedFarmFilter !== 'ALL' ? `• ${selectedFarmFilter}` : ''}
            </span>
            <h3 className="text-2xl font-black mt-2">{formatMoney(summary.totalPaid)}</h3>
            <p className="text-[10px] text-orange-100 font-semibold mt-3 pt-2 border-t border-white/10">
              {paid.length} disbursement{paid.length !== 1 ? 's' : ''} made today
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <ArrowDownRight size={100} />
          </div>
        </div>

        {/* Net Flow Margin Card */}
        <div className={`p-5 rounded-2xl shadow-sm relative overflow-hidden ${
          summary.netCashflow >= 0 
            ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white' 
            : 'bg-gradient-to-br from-rose-600 to-rose-800 text-white'
        }`}>
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 flex items-center gap-1.5">
              <Scale size={14} /> Net Cash Flow Balance
            </span>
            <h3 className="text-2xl font-black mt-2">
              {summary.netCashflow >= 0 ? '+' : ''}{formatMoney(summary.netCashflow)}
            </h3>
            <p className="text-[10px] text-white/80 font-semibold mt-3 pt-2 border-t border-white/10">
              {summary.netCashflow >= 0 ? 'Net Cash Surplus' : 'Net Cash Deficit'} for today
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <Scale size={100} />
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown Summary Chips */}
      {methodBreakdown.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Payment Method Breakdown for {formatHumanDate(selectedDate)}</span>
            <span className="text-[10px] font-semibold text-slate-400">
              {methodBreakdown.length} active method{methodBreakdown.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {methodBreakdown.map((m) => (
              <div key={m.key} className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </div>
                {m.received > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-emerald-700 font-semibold">Inflow:</span>
                    <span className="font-extrabold text-emerald-700">{formatMoney(m.received)}</span>
                  </div>
                )}
                {m.paid > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-orange-700 font-semibold">Outflow:</span>
                    <span className="font-extrabold text-orange-700">{formatMoney(m.paid)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments Registry Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Customer Receipts (Sales Inflow) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50/30 flex justify-between items-center">
            <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-emerald-600" /> Customer Receipts (Sales Inflow)
            </h3>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
              {received.length} receipt{received.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {received.length === 0 ? (
              <div className="p-8 text-center text-slate-400 my-auto">
                <ArrowUpRight size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold uppercase">No Customer Receipts</p>
                <p className="text-[10px] mt-1 text-slate-400">Payments recorded on customer invoices for this day will list here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100">
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Farm / Firm</th>
                    <th className="py-3 px-3">Invoice Details</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {received.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors align-top">
                      {/* Time */}
                      <td className="py-3 px-3 font-bold text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatTime(p.createdAt)}
                      </td>

                      {/* Farm / Firm Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[10px] font-bold">
                          <Building size={10} className="text-[#004870]" />
                          {p.farmName || 'Primary Store'}
                        </span>
                      </td>

                      {/* Invoice Details & Date */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-slate-800 text-[11px]">{p.invoiceNo}</div>
                        {p.invoiceDate && (
                          <div className="text-[9px] text-slate-400 font-sans mt-0.5">
                            Dated: {new Date(p.invoiceDate).toLocaleDateString('en-IN')}
                          </div>
                        )}
                        {p.invoiceTotal !== undefined && p.invoiceTotal > 0 && (
                          <div className="text-[9px] text-slate-400 font-sans">
                            Total: {formatMoney(p.invoiceTotal)}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 font-semibold text-slate-700 max-w-[130px]">
                        <div className="truncate font-bold">{p.partyName}</div>
                        {p.gstin && (
                          <div className="text-[9px] text-slate-400 font-mono uppercase truncate">GST: {p.gstin}</div>
                        )}
                        {p.receivedBy && (
                          <div className="text-[9px] text-emerald-700 truncate">By: {p.receivedBy}</div>
                        )}
                      </td>

                      {/* Payment Method & Details */}
                      <td className="py-3 px-3">
                        {renderPaymentDetails(p)}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                        {formatMoney(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Supplier Disbursements (Purchase Outflow) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-orange-50/30 flex justify-between items-center">
            <h3 className="text-xs font-black text-orange-850 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownRight size={14} className="text-orange-600" /> Supplier Disbursements (Purchase Outflow)
            </h3>
            <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
              {paid.length} payment{paid.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {paid.length === 0 ? (
              <div className="p-8 text-center text-slate-400 my-auto">
                <ArrowDownRight size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold uppercase">No Supplier Disbursements</p>
                <p className="text-[10px] mt-1 text-slate-400">Payments recorded on supplier purchase bills for this day will list here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100">
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Farm / Firm</th>
                    <th className="py-3 px-3">Bill Details</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paid.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors align-top">
                      {/* Time */}
                      <td className="py-3 px-3 font-bold text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatTime(p.createdAt)}
                      </td>

                      {/* Farm / Firm Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-950 border border-orange-200 rounded-md text-[10px] font-bold">
                          <Building size={10} className="text-orange-600" />
                          {p.farmName || 'Primary Store'}
                        </span>
                      </td>

                      {/* Bill Details */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-slate-800 text-[11px]">{p.invoiceNo}</div>
                        {p.invoiceDate && (
                          <div className="text-[9px] text-slate-400 font-sans mt-0.5">
                            Dated: {new Date(p.invoiceDate).toLocaleDateString('en-IN')}
                          </div>
                        )}
                        {p.invoiceTotal !== undefined && p.invoiceTotal > 0 && (
                          <div className="text-[9px] text-slate-400 font-sans">
                            Total: {formatMoney(p.invoiceTotal)}
                          </div>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-3 font-semibold text-slate-700 max-w-[130px]">
                        <div className="truncate font-bold">{p.partyName}</div>
                        {p.gstin && (
                          <div className="text-[9px] text-slate-400 font-mono uppercase truncate">GST: {p.gstin}</div>
                        )}
                      </td>

                      {/* Payment Method & Details */}
                      <td className="py-3 px-3">
                        {renderPaymentDetails(p)}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                        {formatMoney(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
      </div>
      
      {/* Information Box */}
      <div className="print:hidden bg-slate-100 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600 items-start">
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <p className="font-bold text-slate-700">How the Payments Ledger Works:</p>
          <p className="mt-1">
            This register queries individual **Payment entries** recorded across all invoices and bills on this selected date (including collections made today on older historical invoices). It displays full payment methods (Cash, UPI/QR, Bank Transfer, Cheque, Cards, etc.) with real-time status, Farm / Firm badges, and transaction references.
          </p>
        </div>
      </div>
      
    </div>
  );
}
