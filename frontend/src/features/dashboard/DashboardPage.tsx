import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getInvoices,
  getPurchaseInvoices,
} from './api';
import type { Invoice, PurchaseInvoice } from './types';
import {
  ShoppingCart,
  FileText,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CreditCard,
  Layers,
  Sparkles
} from 'lucide-react';

export default function DashboardPage() {
  const { activeCompany } = useAuth();
  
  // Data States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  
  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch data on activeCompany change
  useEffect(() => {
    if (!activeCompany) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [invData, purchData] = await Promise.all([
          getInvoices(),
          getPurchaseInvoices(),
        ]);

        setInvoices(invData);
        setPurchaseInvoices(purchData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeCompany?.id]);

  // Format currency helper
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredInvoices = invoices;
  const filteredPurchaseInvoices = purchaseInvoices;

  const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPurchases = filteredPurchaseInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const netMargin = totalSales - totalPurchases;

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-[#004870] border-t-transparent mb-3"></div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading Dashboard Metrics...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Welcome Graphic Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#003859] via-[#004870] to-[#002f4a] p-6 md:p-8 rounded-3xl text-white shadow-xl border border-blue-950/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/15 px-3 py-1 rounded-full border border-amber-400/30 flex items-center gap-1.5">
                <Sparkles size={11} /> Live Store Overview
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-display text-white tracking-tight">
              {activeCompany?.name || 'Store Ledger Dashboard'}
            </h2>
            <p className="text-xs text-blue-200/90 font-medium mt-1">
              Real-time GST billing records, customer receivables &amp; purchase ledger tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-right">
              <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider block">Net Trade Position</span>
              <span className={`text-lg font-black font-display ${netMargin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatMoney(netMargin)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold">
          Error: {error}
        </div>
      )}

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

        {/* Total Sales */}
        <div className="glow-card bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-6 rounded-3xl shadow-lg border border-blue-500/50 flex justify-between items-center relative overflow-hidden text-white">
          <div className="z-10">
            <p className="text-[11px] uppercase font-bold text-blue-200 tracking-wider flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-300" /> Total Sales Revenue
            </p>
            <h3 className="text-2xl md:text-3xl font-black font-display mt-2">
              {formatMoney(totalSales)}
            </h3>
            <span className="text-[11px] text-blue-200/90 flex items-center gap-1.5 mt-2 font-semibold">
              <FileText size={12} />
              {filteredInvoices.length} sales invoice{filteredInvoices.length !== 1 ? 's' : ''} issued
            </span>
          </div>
          <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-white z-10 shrink-0 shadow-inner">
            <ArrowUpRight size={28} />
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Total Purchases */}
        <div className="glow-card bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 p-6 rounded-3xl shadow-lg border border-amber-500/50 flex justify-between items-center relative overflow-hidden text-white">
          <div className="z-10">
            <p className="text-[11px] uppercase font-bold text-amber-200 tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-amber-300" /> Total Supplier Purchases
            </p>
            <h3 className="text-2xl md:text-3xl font-black font-display mt-2">
              {formatMoney(totalPurchases)}
            </h3>
            <span className="text-[11px] text-amber-200/90 flex items-center gap-1.5 mt-2 font-semibold">
              <ShoppingCart size={12} />
              {filteredPurchaseInvoices.length} purchase bill{filteredPurchaseInvoices.length !== 1 ? 's' : ''} recorded
            </span>
          </div>
          <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-white z-10 shrink-0 shadow-inner">
            <ArrowDownRight size={28} />
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

        {/* Net Business Flow */}
        <div className="glow-card bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 rounded-3xl shadow-lg border border-slate-700/50 flex justify-between items-center relative overflow-hidden text-white">
          <div className="z-10">
            <p className="text-[11px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-amber-300" /> Ledger Balance Margin
            </p>
            <h3 className={`text-2xl md:text-3xl font-black font-display mt-2 ${netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatMoney(netMargin)}
            </h3>
            <span className="text-[11px] text-slate-300/90 flex items-center gap-1.5 mt-2 font-semibold">
              <CreditCard size={12} />
              {netMargin >= 0 ? 'Surplus sales over inwards' : 'Deficit / Inward heavier'}
            </span>
          </div>
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-amber-300 z-10 shrink-0 shadow-inner font-black">
            ₹
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>

      </div>

      {/* Recent Invoices — Sales + Purchases side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Sales Invoices */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4.5 border-b border-slate-100 bg-blue-50/50 flex items-center justify-between">
              <h3 className="text-xs font-black text-blue-900 flex items-center gap-2 uppercase tracking-wider">
                <div className="w-6 h-6 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold">
                  <FileText size={13} />
                </div>
                Recent Sales Invoices
              </h3>
              <span className="text-[10px] font-black text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full">
                {filteredInvoices.length} total
              </span>
            </div>
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-xs font-bold uppercase">No sales invoices recorded yet</p>
                <p className="text-[10px] mt-1 text-slate-400">Create new tax invoices in the Tax Billing tab</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] text-slate-400 font-black uppercase border-b border-slate-100">
                      <th className="py-3.5 px-5">Invoice #</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filteredInvoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-5 font-mono font-bold text-slate-800 text-[11px]">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 max-w-[140px] truncate">
                          {inv.customer?.name || (() => {
                            try {
                              const l = JSON.parse(inv.logisticsData);
                              return l.buyerName || <span className="text-slate-400 italic font-normal">Walk-in</span>;
                            } catch { return '—'; }
                          })()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap text-[11px]">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="py-3 px-5 text-right font-black text-blue-700">
                          {formatMoney(inv.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Purchase Invoices */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4.5 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between">
              <h3 className="text-xs font-black text-amber-900 flex items-center gap-2 uppercase tracking-wider">
                <div className="w-6 h-6 rounded-lg bg-amber-600/10 text-amber-700 flex items-center justify-center font-bold">
                  <ShoppingCart size={13} />
                </div>
                Recent Purchase Bills
              </h3>
              <span className="text-[10px] font-black text-amber-700 bg-amber-100/80 px-3 py-1 rounded-full">
                {filteredPurchaseInvoices.length} total
              </span>
            </div>
            {filteredPurchaseInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShoppingCart size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-xs font-bold uppercase">No purchase bills recorded yet</p>
                <p className="text-[10px] mt-1 text-slate-400">Enter supplier purchases under the Supplier Ledger</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] text-slate-400 font-black uppercase border-b border-slate-100">
                      <th className="py-3.5 px-5">Invoice #</th>
                      <th className="py-3.5 px-4">Supplier / Vendor</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filteredPurchaseInvoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-5 font-mono font-bold text-slate-800 text-[11px]">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 max-w-[140px] truncate">
                          {inv.mahajan?.name || (() => {
                            try {
                              const l = JSON.parse(inv.logisticsData);
                              return l.sellerName || <span className="text-slate-400 italic font-normal">Unknown</span>;
                            } catch { return '—'; }
                          })()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap text-[11px]">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="py-3 px-5 text-right font-black text-amber-700">
                          {formatMoney(inv.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
