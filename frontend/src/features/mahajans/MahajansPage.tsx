import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getMahajans, createMahajan, updateMahajan, deleteMahajan, getMahajan } from '../dashboard/api';
import type { Mahajan, PurchaseInvoice } from '../dashboard/types';
import {
  Store,
  Plus,
  Trash2,
  Edit3,
  X,
  Save,
  ArrowLeft,
  FileText,
  Printer,
  Building,
  ChevronDown,
  ChevronUp,
  Package,
  Search,
  Layers,
} from 'lucide-react';
import { calculateLineItem } from '../invoices/invoiceCalculations';

interface MahajansPageProps {
  onLoadInvoice: (invoice: PurchaseInvoice) => void;
}

interface ExtractedItem {
  id: string;
  name: string;
  packing?: string;
  unit: string;
  hsn: string;
  quantity: number;
  rate: number;
  gstRate: number;
  totalGst: number;
  taxableAmount: number;
  finalAmount: number;
  invoiceNo: string;
  invoiceDate: string;
  buyerName: string;
  buyerSubpartId?: string | null;
}

export default function MahajansPage({ onLoadInvoice }: MahajansPageProps) {
  const { activeCompany } = useAuth();

  const [mahajans, setMahajans] = useState<Mahajan[]>([]);
  const [selectedMahajan, setSelectedMahajan] = useState<Mahajan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Profile View Filters and Modes
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState<string>('ALL');
  const [activeViewMode, setActiveViewMode] = useState<'invoices' | 'items_by_buyer'>('invoices');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [editingMahajan, setEditingMahajan] = useState<Mahajan | null>(null);

  const [formName, setFormName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formState, setFormState] = useState('');
  const [formStateCode, setFormStateCode] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    const fetchMahajans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getMahajans();
        setMahajans(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch Suppliers directory.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMahajans();
  }, [activeCompany?.id, refreshTrigger]);

  const handleSelectMahajan = async (mahajan: Mahajan) => {
    setIsDetailLoading(true);
    setSelectedBuyerFilter('ALL');
    setExpandedInvoiceId(null);
    setSearchFilter('');
    try {
      const data = await getMahajan(mahajan.id);
      setSelectedMahajan(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load Supplier profile details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMahajan(null);
    setFormName(''); setFormGstin(''); setFormEmail('');
    setFormPhone(''); setFormAddress(''); setFormState(''); setFormStateCode('');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (mahajan: Mahajan, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMahajan(mahajan);
    setFormName(mahajan.name);
    setFormGstin(mahajan.gstin || '');
    setFormEmail(mahajan.email || '');
    setFormPhone(mahajan.phone || '');
    setFormAddress(mahajan.address || '');
    setFormState(mahajan.state || '');
    setFormStateCode(mahajan.stateCode || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) return setFormError('Supplier name is required');

    try {
      const payload = {
        name: formName.trim(),
        gstin: formGstin.trim() || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        state: formState.trim() || undefined,
        stateCode: formStateCode.trim() || undefined,
      };

      if (editingMahajan) {
        await updateMahajan(editingMahajan.id, payload);
        if (selectedMahajan?.id === editingMahajan.id) {
          const refreshed = await getMahajan(editingMahajan.id);
          setSelectedMahajan(refreshed);
        }
      } else {
        await createMahajan(payload);
      }

      setShowModal(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Operation failed. Check details.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this Supplier? Their archived purchase invoices will be unlinked.')) return;
    try {
      await deleteMahajan(id);
      if (selectedMahajan?.id === id) setSelectedMahajan(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete Supplier.');
    }
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

  // Helper to resolve buyer / receiving firm name from an invoice
  const getInvoiceBuyerName = (inv: PurchaseInvoice): string => {
    if (inv.buyerSubpart?.name) return inv.buyerSubpart.name;
    try {
      const log = JSON.parse(inv.logisticsData);
      if (log.buyerName && log.buyerName.trim()) return log.buyerName.trim();
    } catch { /* silent */ }
    return activeCompany?.name || 'Primary Store';
  };

  // Extract all individual line items from invoices for itemized view
  const allExtractedItems: ExtractedItem[] = useMemo(() => {
    if (!selectedMahajan?.purchaseInvoices) return [];
    const list: ExtractedItem[] = [];
    selectedMahajan.purchaseInvoices.forEach(inv => {
      const buyer = getInvoiceBuyerName(inv);
      try {
        const parsedItems = JSON.parse(inv.itemsData);
        if (Array.isArray(parsedItems)) {
          parsedItems.forEach((it: any, idx: number) => {
            if (it && it.name && it.name.trim()) {
              const calc = calculateLineItem(it);
              list.push({
                id: `${inv.id}-${idx}`,
                name: it.name,
                packing: it.packing || it.unit || '',
                unit: it.unit || 'PCS',
                hsn: it.hsn || '21069099',
                quantity: calc.packageQty || Number(it.quantity) || 1,
                rate: Number(it.rate) || 0,
                gstRate: Number(it.gstRate) || 0,
                totalGst: calc.gstAmount,
                taxableAmount: calc.taxableAmount,
                finalAmount: calc.finalAmount,
                invoiceNo: inv.invoiceNo,
                invoiceDate: inv.invoiceDate,
                buyerName: buyer,
                buyerSubpartId: inv.buyerSubpartId,
              });
            }
          });
        }
      } catch { /* silent */ }
    });
    return list;
  }, [selectedMahajan?.purchaseInvoices, activeCompany]);

  // Distinct buyers list with counts and amounts
  const buyerSummaryMap = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; itemsCount: number }>();
    if (!selectedMahajan?.purchaseInvoices) return map;

    selectedMahajan.purchaseInvoices.forEach(inv => {
      const bName = getInvoiceBuyerName(inv);
      const cur = map.get(bName) || { count: 0, totalAmount: 0, itemsCount: 0 };
      cur.count += 1;
      cur.totalAmount += inv.totalAmount;
      map.set(bName, cur);
    });

    allExtractedItems.forEach(it => {
      const cur = map.get(it.buyerName);
      if (cur) cur.itemsCount += 1;
    });

    return map;
  }, [selectedMahajan?.purchaseInvoices, allExtractedItems, activeCompany]);

  const uniqueBuyerNames = useMemo(() => Array.from(buyerSummaryMap.keys()), [buyerSummaryMap]);

  // Filtered invoices by selected buyer and search query
  const filteredInvoices = useMemo(() => {
    if (!selectedMahajan?.purchaseInvoices) return [];
    return selectedMahajan.purchaseInvoices.filter(inv => {
      const bName = getInvoiceBuyerName(inv);
      if (selectedBuyerFilter !== 'ALL' && bName !== selectedBuyerFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesNo = inv.invoiceNo.toLowerCase().includes(q);
        const matchesBuyer = bName.toLowerCase().includes(q);
        return matchesNo || matchesBuyer;
      }
      return true;
    });
  }, [selectedMahajan?.purchaseInvoices, selectedBuyerFilter, searchFilter, activeCompany]);

  // Grouped items by buyer (filtered)
  const groupedItemsByBuyer = useMemo(() => {
    const groups: { [buyer: string]: ExtractedItem[] } = {};
    allExtractedItems.forEach(item => {
      if (selectedBuyerFilter !== 'ALL' && item.buyerName !== selectedBuyerFilter) return;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchBuyer = item.buyerName.toLowerCase().includes(q);
        const matchInv = item.invoiceNo.toLowerCase().includes(q);
        if (!matchName && !matchBuyer && !matchInv) return;
      }
      if (!groups[item.buyerName]) groups[item.buyerName] = [];
      groups[item.buyerName].push(item);
    });
    return groups;
  }, [allExtractedItems, selectedBuyerFilter, searchFilter]);

  const getStats = (invoices: PurchaseInvoice[] = []) => ({
    totalPurchased: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    invoiceCount: invoices.length,
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">

      {selectedMahajan ? (
        // SUPPLIER PROFILE & LEDGER VIEW
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setSelectedMahajan(null)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Suppliers Directory
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Supplier Ledger Book
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Sidebar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 h-fit">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedMahajan.name}</h3>
                {selectedMahajan.gstin ? (
                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 mt-1.5 w-fit uppercase tracking-wider">
                    GSTIN: {selectedMahajan.gstin}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 mt-1.5 w-fit uppercase tracking-wider">
                    Unregistered Supplier
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Purchased</span>
                  <div className="text-lg font-black text-orange-600">
                    {formatMoney(getStats(selectedMahajan.purchaseInvoices).totalPurchased)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Bills Sourced</span>
                  <div className="text-lg font-black text-slate-800">
                    {getStats(selectedMahajan.purchaseInvoices).invoiceCount}
                  </div>
                </div>
              </div>

              {/* Receiving Buyers Breakdown Summary */}
              {uniqueBuyerNames.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Receiving Buyers / Farms
                  </span>
                  <div className="space-y-1.5">
                    {uniqueBuyerNames.map(bName => {
                      const st = buyerSummaryMap.get(bName);
                      return (
                        <div 
                          key={bName} 
                          onClick={() => setSelectedBuyerFilter(selectedBuyerFilter === bName ? 'ALL' : bName)}
                          className={`p-2.5 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition-all ${
                            selectedBuyerFilter === bName 
                              ? 'bg-orange-50 border-orange-300 shadow-2xs' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Building size={12} className="text-[#004870]" />
                            <span>{bName}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-slate-900 text-xs block">{formatMoney(st?.totalAmount || 0)}</span>
                            <span className="text-[9px] text-slate-400 font-semibold">{st?.count} bill(s)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
                {selectedMahajan.phone && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Phone Number</span>
                    <span className="font-semibold text-slate-700">{selectedMahajan.phone}</span>
                  </div>
                )}
                {selectedMahajan.email && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Email Address</span>
                    <span className="font-semibold text-slate-700">{selectedMahajan.email}</span>
                  </div>
                )}
                {selectedMahajan.state && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">State & Code</span>
                    <span className="font-semibold text-slate-700">
                      {selectedMahajan.state} ({selectedMahajan.stateCode || '--'})
                    </span>
                  </div>
                )}
                {selectedMahajan.address && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Address</span>
                    <span className="font-medium text-slate-600 block mt-0.5 whitespace-pre-line leading-relaxed">
                      {selectedMahajan.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Purchase History Ledger Panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Header with View Toggle & Search */}
              <div className="p-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-orange-500" />
                      Supplier Purchase Ledger
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      View full bills or browse itemized purchases separated by buyer/farm.
                    </p>
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('invoices')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeViewMode === 'invoices'
                          ? 'bg-white text-orange-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText size={13} /> Invoices Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('items_by_buyer')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeViewMode === 'items_by_buyer'
                          ? 'bg-white text-orange-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Layers size={13} /> Itemized by Buyer / Farm
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Buyer filter tabs */}
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedBuyerFilter('ALL')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        selectedBuyerFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Buyers ({selectedMahajan.purchaseInvoices?.length || 0})
                    </button>
                    {uniqueBuyerNames.map(bName => {
                      const st = buyerSummaryMap.get(bName);
                      return (
                        <button
                          key={bName}
                          type="button"
                          onClick={() => setSelectedBuyerFilter(bName)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            selectedBuyerFilter === bName
                              ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Building size={11} /> {bName} ({st?.count || 0})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[180px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search invoice or item..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {isDetailLoading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading history...</p>
                </div>
              ) : !selectedMahajan.purchaseInvoices || selectedMahajan.purchaseInvoices.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <FileText size={32} className="text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider">No Purchase Invoices Found</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Purchase invoices from this supplier recorded via the Invoice Generator will appear here.
                  </p>
                </div>
              ) : activeViewMode === 'invoices' ? (
                
                // VIEW 1: INVOICES LEDGER TABLE
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-10"></th>
                        <th className="py-3.5 px-4">Invoice No.</th>
                        <th className="py-3.5 px-4">Buyer / Receiving Firm</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4 text-right">Subtotal</th>
                        <th className="py-3.5 px-4 text-right">GST</th>
                        <th className="py-3.5 px-4 text-right">Total (₹)</th>
                        <th className="py-3.5 px-6 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-semibold">
                            No invoices match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv) => {
                          const buyerName = getInvoiceBuyerName(inv);
                          const isExpanded = expandedInvoiceId === inv.id;
                          let parsedItemsList: any[] = [];
                          try {
                            parsedItemsList = JSON.parse(inv.itemsData) || [];
                          } catch { /* silent */ }

                          return (
                            <Fragment key={inv.id}>
                              <tr 
                                className={`transition-colors text-xs hover:bg-slate-50/70 ${isExpanded ? 'bg-orange-50/20' : ''}`}
                              >
                                <td className="py-3 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                    className="p-1 rounded text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    title={isExpanded ? 'Hide Items' : 'View Items'}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.invoiceNo}</td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[11px] font-bold">
                                    <Building size={11} className="text-[#004870]" />
                                    {buyerName}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-500 whitespace-nowrap">
                                  {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-600">{formatMoney(inv.subtotal)}</td>
                                <td className="py-3 px-4 text-right font-medium text-slate-600">{formatMoney(inv.totalGst)}</td>
                                <td className="py-3 px-4 text-right font-black text-slate-900">{formatMoney(inv.totalAmount)}</td>
                                <td className="py-3 px-6">
                                  <button
                                    onClick={() => onLoadInvoice(inv)}
                                    className="w-full flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Printer size={11} /> Load/Print
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Inline Items Drawer */}
                              {isExpanded && (
                                <tr className="bg-orange-50/30 border-b border-slate-200">
                                  <td colSpan={8} className="p-4 pl-12">
                                    <div className="bg-white rounded-xl border border-orange-200 p-4 space-y-2 shadow-sm">
                                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <span className="text-[11px] font-black text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                                          <Package size={13} className="text-orange-500" />
                                          Items Sourced for: <strong className="text-[#004870]">{buyerName}</strong> (Invoice #{inv.invoiceNo})
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                          {parsedItemsList.length} line item(s)
                                        </span>
                                      </div>

                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                          <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                            <th className="py-1.5 px-2">#</th>
                                            <th className="py-1.5 px-3">Item Name</th>
                                            <th className="py-1.5 px-2">HSN</th>
                                            <th className="py-1.5 px-2 text-right">Quantity</th>
                                            <th className="py-1.5 px-2 text-right">Rate</th>
                                            <th className="py-1.5 px-2 text-right">GST%</th>
                                            <th className="py-1.5 px-3 text-right">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {parsedItemsList.map((it: any, i: number) => {
                                            const calc = calculateLineItem(it);
                                            const qty = calc.packageQty || Number(it.quantity) || 1;
                                            const rate = Number(it.rate) || 0;
                                            const gst = Number(it.gstRate) || 0;
                                            return (
                                              <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="py-1.5 px-2 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                                <td className="py-1.5 px-3 font-bold text-slate-800">
                                                  {it.name} {it.packing ? <span className="text-[10px] text-slate-400 font-normal">({it.packing})</span> : ''}
                                                </td>
                                                <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{it.hsn || '--'}</td>
                                                <td className="py-1.5 px-2 text-right font-bold text-slate-700">
                                                  {qty} {it.unit || 'PCS'}
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-semibold text-slate-600">{formatMoney(rate)}</td>
                                                <td className="py-1.5 px-2 text-right text-slate-500 font-mono">{gst}%</td>
                                                <td className="py-1.5 px-3 text-right font-black text-slate-900">{formatMoney(calc.finalAmount)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              ) : (

                // VIEW 2: ITEMIZED ITEMS GROUPED SEPARATELY BY BUYER / FARM
                <div className="p-5 space-y-6">
                  {Object.keys(groupedItemsByBuyer).length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                      No items found for the selected buyer or search filter.
                    </div>
                  ) : (
                    Object.entries(groupedItemsByBuyer).map(([buyerName, itemsList]) => {
                      const buyerTotalAmt = itemsList.reduce((sum, it) => sum + it.finalAmount, 0);
                      const buyerTotalTaxable = itemsList.reduce((sum, it) => sum + it.taxableAmount, 0);
                      const buyerTotalGst = itemsList.reduce((sum, it) => sum + it.totalGst, 0);

                      return (
                        <div key={buyerName} className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                          {/* Buyer Firm Header Banner */}
                          <div className="bg-gradient-to-r from-[#004870] to-blue-900 text-white px-5 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Building size={16} className="text-amber-400" />
                              <div>
                                <h4 className="text-sm font-black tracking-tight">{buyerName}</h4>
                                <p className="text-[10px] text-blue-200 font-semibold">
                                  {itemsList.length} item entry{itemsList.length !== 1 ? 'ies' : ''} purchased on this farm/buyer name
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-blue-200 block">Total Sourced</span>
                              <span className="text-base font-black text-amber-300">{formatMoney(buyerTotalAmt)}</span>
                            </div>
                          </div>

                          {/* Items Table for this specific Buyer */}
                          <div className="overflow-x-auto bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100/70 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                  <th className="py-2.5 px-3 w-8">#</th>
                                  <th className="py-2.5 px-4">Item Name &amp; Pack</th>
                                  <th className="py-2.5 px-3 font-mono">HSN</th>
                                  <th className="py-2.5 px-3 text-right">Qty</th>
                                  <th className="py-2.5 px-3 text-right">Rate</th>
                                  <th className="py-2.5 px-3 text-right">Taxable</th>
                                  <th className="py-2.5 px-3 text-right">GST</th>
                                  <th className="py-2.5 px-4 text-right">Total (₹)</th>
                                  <th className="py-2.5 px-4 text-center">Invoice Ref</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {itemsList.map((item, idx) => (
                                  <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                    <td className="py-2.5 px-4">
                                      <span className="font-extrabold text-slate-800">{item.name}</span>
                                      {item.packing && (
                                        <span className="text-[10px] text-slate-400 font-medium ml-1.5">[{item.packing}]</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{item.hsn}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                                      {item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">{formatMoney(item.rate)}</td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">{formatMoney(item.taxableAmount)}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">
                                      <span className="text-[10px] font-mono">{item.gstRate}%</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatMoney(item.finalAmount)}</td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className="font-mono text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                                        {item.invoiceNo}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700 text-xs">
                                  <td colSpan={5} className="py-2.5 px-4 text-right uppercase text-[10px] text-slate-500 font-extrabold">
                                    Subtotal for {buyerName}:
                                  </td>
                                  <td className="py-2.5 px-3 text-right">{formatMoney(buyerTotalTaxable)}</td>
                                  <td className="py-2.5 px-3 text-right">{formatMoney(buyerTotalGst)}</td>
                                  <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatMoney(buyerTotalAmt)}</td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (
        // SUPPLIERS DIRECTORY VIEW
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Store className="text-orange-500" />
                Suppliers &amp; Vendors Directory
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200 uppercase tracking-wide">
                  Purchase Ledger
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Track wholesale suppliers, manage purchase invoices, and monitor itemized stock sourced for each buyer firm.
              </p>
            </div>
            <button 
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer"
            >
              <Plus size={15} /> Add New Supplier
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
              Error: {error}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Syncing Supplier profiles...</p>
              </div>
            ) : mahajans.length === 0 ? (
              <div className="p-16 text-center max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-orange-50 border border-orange-200 rounded-2xl mx-auto flex items-center justify-center text-orange-400">
                  <Store size={28} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">No Suppliers Added Yet</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Add your wholesale suppliers here. When you save a Purchase Invoice, the Supplier profile will also be created automatically.
                  </p>
                </div>
                <button 
                  onClick={handleOpenCreate}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                >
                  Add First Supplier
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Supplier / Vendor Name</th>
                      <th className="py-4 px-4 text-center w-24">State Code</th>
                      <th className="py-4 px-5">GSTIN</th>
                      <th className="py-4 px-5">Phone</th>
                      <th className="py-4 px-5">Email</th>
                      <th className="py-4 px-6 text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {mahajans.map((m) => (
                      <tr 
                        key={m.id} 
                        onClick={() => handleSelectMahajan(m)}
                        className="hover:bg-orange-50/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                            {m.name}
                          </div>
                          {m.address ? (
                            <div className="text-[11px] text-slate-500 max-w-xs truncate">{m.address}</div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">No address registered</div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {m.stateCode ? (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs">
                              {m.stateCode}
                            </span>
                          ) : <span className="text-slate-400 text-xs">--</span>}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-600 text-xs font-semibold">
                          {m.gstin || <span className="text-slate-400 italic font-sans">Unregistered</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-600 text-xs font-semibold">
                          {m.phone || <span className="text-slate-300">--</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-600 text-xs font-semibold">
                          {m.email || <span className="text-slate-300">--</span>}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={(e) => handleOpenEdit(m, e)}
                              className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg hover:bg-orange-50 transition-all cursor-pointer" 
                              title="Edit Supplier"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={(e) => handleDelete(m.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer" 
                              title="Delete Supplier"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Store size={16} className="text-orange-200" />
                {editingMahajan ? 'Edit Supplier Profile' : 'New Supplier Profile'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-orange-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">{formError}</div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Supplier / Vendor Name *
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Tulsi Wholesalers" 
                  value={formName} 
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  GSTIN (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="15-digit GST Registration" 
                  value={formGstin} 
                  onChange={e => setFormGstin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">State</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Assam" 
                    value={formState} 
                    onChange={e => setFormState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">State Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 18" 
                    value={formStateCode} 
                    onChange={e => setFormStateCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 9876543210" 
                    value={formPhone} 
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. supplier@gmail.com" 
                    value={formEmail} 
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Supplier Address (Optional)
                </label>
                <textarea 
                  placeholder="Street, City, Pincode..." 
                  value={formAddress} 
                  onChange={e => setFormAddress(e.target.value)} 
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none" 
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3.5 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow transition-colors cursor-pointer"
                >
                  <Save size={14} /> Save Supplier Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
