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
  Undo2,
  AlertCircle,
  Eye,
  MessageCircle,
} from 'lucide-react';
import { calculateLineItem } from '../invoices/invoiceCalculations';
import WhatsAppShareModal from '../invoices/WhatsAppShareModal';
import { generateInvoiceWhatsAppMessage } from '../../lib/whatsapp';

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
  isReturn?: boolean;
  reasonForReturn?: string;
  originalInvoiceNo?: string;
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
  const [docTypeFilter, setDocTabFilter] = useState<'ALL' | 'INVOICES' | 'RETURNS'>('ALL');
  const [activeViewMode, setActiveViewMode] = useState<'invoices' | 'items_by_buyer'>('invoices');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals Visibility
  const [showModal, setShowModal] = useState(false);
  const [editingMahajan, setEditingMahajan] = useState<Mahajan | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalPayload, setWhatsAppModalPayload] = useState<{
    phone: string;
    name: string;
    message: string;
    title: string;
    invoiceNo?: string;
    invoiceData?: any;
  }>({ phone: '', name: '', message: '', title: '' });

  // Document & Returned Items Inspection Modal State
  const [viewingReturnDetails, setViewingReturnDetails] = useState<{
    inv: PurchaseInvoice;
    itemsList: any[];
    returnInfo: any;
    isReturn: boolean;
  } | null>(null);

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
    setDocTabFilter('ALL');
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

  // Helper to detect if a purchase invoice is a Return (Debit Note / Purchase Return)
  const isPurchaseInvoiceReturn = (inv: PurchaseInvoice): boolean => {
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
      if (log?.docType === 'purchase_return' || log?.docType === 'debit_note') {
        return true;
      }
    } catch { /* silent */ }
    const no = String(inv.invoiceNo || '');
    return no.includes('-DR/') || no.startsWith('DR/');
  };

  // Helper to extract purchase return metadata
  const getPurchaseReturnInfo = (inv: PurchaseInvoice) => {
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
      return {
        docType: log?.docType || (isPurchaseInvoiceReturn(inv) ? 'purchase_return' : 'purchase'),
        originalInvoiceNo: log?.originalInvoiceNo,
        originalInvoiceDate: log?.originalInvoiceDate,
        reasonForReturn: log?.reasonForReturn || 'Supplier Goods Return / Damaged stock return',
        returnStatus: log?.returnStatus || 'CONFIRMED',
      };
    } catch {
      return {
        docType: isPurchaseInvoiceReturn(inv) ? 'purchase_return' : 'purchase',
        originalInvoiceNo: '',
        originalInvoiceDate: '',
        reasonForReturn: 'Supplier Goods Return',
        returnStatus: 'CONFIRMED',
      };
    }
  };

  // Helper to resolve buyer / receiving firm name from an invoice
  const getInvoiceBuyerName = (inv: PurchaseInvoice): string => {
    if (inv.buyerSubpart?.name) return inv.buyerSubpart.name;
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : inv.logisticsData;
      if (log?.buyerName && log.buyerName.trim()) return log.buyerName.trim();
    } catch { /* silent */ }
    return activeCompany?.name || 'Primary Store';
  };

  // Extract all individual line items from invoices for itemized view
  const allExtractedItems: ExtractedItem[] = useMemo(() => {
    if (!selectedMahajan?.purchaseInvoices) return [];
    const list: ExtractedItem[] = [];
    selectedMahajan.purchaseInvoices.forEach(inv => {
      const buyer = getInvoiceBuyerName(inv);
      const isRet = isPurchaseInvoiceReturn(inv);
      const retInfo = getPurchaseReturnInfo(inv);

      try {
        const parsedItems = typeof inv.itemsData === 'string' ? JSON.parse(inv.itemsData) : inv.itemsData;
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
                totalGst: isRet ? -calc.gstAmount : calc.gstAmount,
                taxableAmount: isRet ? -calc.taxableAmount : calc.taxableAmount,
                finalAmount: isRet ? -calc.finalAmount : calc.finalAmount,
                invoiceNo: inv.invoiceNo,
                invoiceDate: inv.invoiceDate,
                buyerName: buyer,
                buyerSubpartId: inv.buyerSubpartId,
                isReturn: isRet,
                reasonForReturn: retInfo.reasonForReturn,
                originalInvoiceNo: retInfo.originalInvoiceNo,
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
    const map = new Map<string, { count: number; totalAmount: number; itemsCount: number; returnsCount: number; returnAmount: number }>();
    if (!selectedMahajan?.purchaseInvoices) return map;

    selectedMahajan.purchaseInvoices.forEach(inv => {
      const bName = getInvoiceBuyerName(inv);
      const isRet = isPurchaseInvoiceReturn(inv);
      const cur = map.get(bName) || { count: 0, totalAmount: 0, itemsCount: 0, returnsCount: 0, returnAmount: 0 };
      
      if (isRet) {
        cur.returnsCount += 1;
        cur.returnAmount += inv.totalAmount;
      } else {
        cur.count += 1;
        cur.totalAmount += inv.totalAmount;
      }
      map.set(bName, cur);
    });

    allExtractedItems.forEach(it => {
      const cur = map.get(it.buyerName);
      if (cur) cur.itemsCount += 1;
    });

    return map;
  }, [selectedMahajan?.purchaseInvoices, allExtractedItems, activeCompany]);

  const uniqueBuyerNames = useMemo(() => Array.from(buyerSummaryMap.keys()), [buyerSummaryMap]);

  // Filtered invoices by selected buyer, document type filter, and search query
  const filteredInvoices = useMemo(() => {
    if (!selectedMahajan?.purchaseInvoices) return [];
    return selectedMahajan.purchaseInvoices.filter(inv => {
      const bName = getInvoiceBuyerName(inv);
      const isRet = isPurchaseInvoiceReturn(inv);

      if (selectedBuyerFilter !== 'ALL' && bName !== selectedBuyerFilter) return false;
      if (docTypeFilter === 'INVOICES' && isRet) return false;
      if (docTypeFilter === 'RETURNS' && !isRet) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesNo = inv.invoiceNo.toLowerCase().includes(q);
        const matchesBuyer = bName.toLowerCase().includes(q);
        const retInfo = getPurchaseReturnInfo(inv);
        const matchesOrig = retInfo.originalInvoiceNo?.toLowerCase().includes(q) || false;
        const matchesReason = retInfo.reasonForReturn?.toLowerCase().includes(q) || false;
        return matchesNo || matchesBuyer || matchesOrig || matchesReason;
      }
      return true;
    });
  }, [selectedMahajan?.purchaseInvoices, selectedBuyerFilter, docTypeFilter, searchFilter, activeCompany]);

  // Grouped items by buyer (filtered)
  const groupedItemsByBuyer = useMemo(() => {
    const groups: { [buyer: string]: ExtractedItem[] } = {};
    allExtractedItems.forEach(item => {
      if (selectedBuyerFilter !== 'ALL' && item.buyerName !== selectedBuyerFilter) return;
      if (docTypeFilter === 'INVOICES' && item.isReturn) return;
      if (docTypeFilter === 'RETURNS' && !item.isReturn) return;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchBuyer = item.buyerName.toLowerCase().includes(q);
        const matchInv = item.invoiceNo.toLowerCase().includes(q);
        const matchOrig = item.originalInvoiceNo?.toLowerCase().includes(q) || false;
        if (!matchName && !matchBuyer && !matchInv && !matchOrig) return;
      }
      if (!groups[item.buyerName]) groups[item.buyerName] = [];
      groups[item.buyerName].push(item);
    });
    return groups;
  }, [allExtractedItems, selectedBuyerFilter, docTypeFilter, searchFilter]);

  // Calculate comprehensive supplier statistics (Purchases vs Debit Note Returns)
  const getStats = (invoices: PurchaseInvoice[] = []) => {
    let totalPurchases = 0;
    let totalReturns = 0;
    let invoiceCount = 0;
    let returnCount = 0;

    invoices.forEach(inv => {
      if (isPurchaseInvoiceReturn(inv)) {
        totalReturns += inv.totalAmount;
        returnCount += 1;
      } else {
        totalPurchases += inv.totalAmount;
        invoiceCount += 1;
      }
    });

    const netPurchases = Math.max(0, totalPurchases - totalReturns);
    return { totalPurchases, totalReturns, netPurchases, invoiceCount, returnCount, totalDocs: invoices.length };
  };

  const currentStats = getStats(selectedMahajan?.purchaseInvoices || []);

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
                Supplier Purchases &amp; Debit Ledger
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

              {/* Sourced vs Returns Summary */}
              <div className="grid grid-cols-2 gap-3 border-t border-b border-slate-100 py-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Gross Purchases</span>
                  <div className="text-base font-black text-orange-600">
                    {formatMoney(currentStats.totalPurchases)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{currentStats.invoiceCount} purchase bills</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                    <Undo2 size={10} /> Debit Returns
                  </span>
                  <div className="text-base font-black text-rose-700">
                    - {formatMoney(currentStats.totalReturns)}
                  </div>
                  <span className="text-[10px] text-rose-600 font-semibold">{currentStats.returnCount} debit note(s)</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase">Net Payable Sourced:</span>
                  <span className="text-lg font-black text-emerald-700">{formatMoney(currentStats.netPurchases)}</span>
                </div>
              </div>

              {/* Receiving Buyers Breakdown Summary */}
              {uniqueBuyerNames.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Receiving Buyers / Godowns / Farms
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
                            <span className="text-[9px] text-slate-400 font-semibold">
                              {st?.count || 0} bills {st?.returnsCount ? `• ${st.returnsCount} returns` : ''}
                            </span>
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
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">State &amp; Code</span>
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
                      Supplier Purchase &amp; Return Ledger
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      View full purchase bills, inspect returned goods, and track debit notes.
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
                      <FileText size={13} /> Documents Register
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

                {/* Document Type Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDocTabFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      docTypeFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Documents ({selectedMahajan.purchaseInvoices?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTabFilter('INVOICES')}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      docTypeFilter === 'INVOICES'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    📦 Purchase Invoices ({currentStats.invoiceCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTabFilter('RETURNS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      docTypeFilter === 'RETURNS'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <Undo2 size={12} />
                    ↩️ Returns / Debit Notes ({currentStats.returnCount})
                  </button>
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
                      All Buyers
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
                              ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Building size={11} /> {bName} ({st?.count || 0})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search bill no, return ref, item..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {isDetailLoading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading Supplier records...</p>
                </div>
              ) : !selectedMahajan.purchaseInvoices || selectedMahajan.purchaseInvoices.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <FileText size={32} className="text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider">No Purchase Invoices Found</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Purchase invoices &amp; debit notes from this supplier recorded via the Generator will appear here.
                  </p>
                </div>
              ) : activeViewMode === 'invoices' ? (
                
                // VIEW 1: INVOICES & DEBIT NOTES LEDGER TABLE
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-10"></th>
                        <th className="py-3.5 px-4">Doc No. &amp; Type</th>
                        <th className="py-3.5 px-4">Buyer / Receiving Firm</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4 text-right">Subtotal</th>
                        <th className="py-3.5 px-4 text-right">GST</th>
                        <th className="py-3.5 px-4 text-right">Total (₹)</th>
                        <th className="py-3.5 px-6 text-center w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-semibold">
                            No documents match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv) => {
                          const buyerName = getInvoiceBuyerName(inv);
                          const isRet = isPurchaseInvoiceReturn(inv);
                          const retInfo = getPurchaseReturnInfo(inv);
                          const isExpanded = expandedInvoiceId === inv.id;
                          let parsedItemsList: any[] = [];
                          try {
                            parsedItemsList = typeof inv.itemsData === 'string' ? JSON.parse(inv.itemsData) : inv.itemsData || [];
                          } catch { /* silent */ }

                          return (
                            <Fragment key={inv.id}>
                              <tr 
                                className={`transition-colors text-xs hover:bg-slate-50/70 ${isRet ? 'bg-rose-50/20' : ''} ${isExpanded ? 'bg-orange-50/20' : ''}`}
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
                                <td className="py-3 px-4">
                                  <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                    <span>{inv.invoiceNo}</span>
                                    {isRet && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                        <Undo2 size={9} /> Debit Note
                                      </span>
                                    )}
                                  </div>
                                  {isRet && retInfo.originalInvoiceNo && (
                                    <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                                      Ref: <span className="font-mono font-bold text-slate-700">{retInfo.originalInvoiceNo}</span>
                                    </div>
                                  )}
                                  {isRet && retInfo.reasonForReturn && (
                                    <div className="text-[9.5px] text-rose-700 font-semibold truncate max-w-xs">
                                      {retInfo.reasonForReturn}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[11px] font-bold">
                                    <Building size={11} className="text-[#004870]" />
                                    {buyerName}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-500 whitespace-nowrap">
                                  {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-600">
                                  {isRet ? `- ${formatMoney(inv.subtotal)}` : formatMoney(inv.subtotal)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-600">
                                  {isRet ? `- ${formatMoney(inv.totalGst)}` : formatMoney(inv.totalGst)}
                                </td>
                                <td className={`py-3 px-4 text-right font-black ${isRet ? 'text-rose-700 font-mono' : 'text-slate-900 font-mono'}`}>
                                  {isRet ? `- ${formatMoney(inv.totalAmount)}` : formatMoney(inv.totalAmount)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1 justify-end flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => setViewingReturnDetails({
                                        inv,
                                        itemsList: parsedItemsList,
                                        returnInfo: retInfo,
                                        isReturn: isRet
                                      })}
                                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border shadow-2xs transition-colors cursor-pointer ${
                                        isRet 
                                          ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100' 
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                      title={isRet ? 'Inspect Returned Goods' : 'Inspect Billed Items'}
                                    >
                                      <Eye size={11} className={isRet ? 'text-rose-600' : 'text-orange-600'} />
                                      {isRet ? 'Returned' : 'Items'}
                                    </button>

                                    <button
                                      onClick={() => onLoadInvoice(inv)}
                                      className="flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                      title="Load Document in Generator / Print"
                                    >
                                      <Printer size={11} /> Load
                                    </button>

                                    <button
                                      onClick={() => {
                                        const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
                                        const upiId = localStorage.getItem('smartvyapar_upi_id') || '';
                                        const msg = generateInvoiceWhatsAppMessage({
                                          companyName: activeCompany?.name || 'SmartVyapar Merchant',
                                          invoiceNo: inv.invoiceNo,
                                          invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                          customerName: selectedMahajan?.name || 'Supplier',
                                          customerPhone: selectedMahajan?.phone || undefined,
                                          items: Array.isArray(parsedItemsList) ? parsedItemsList.map((i: any) => ({ name: i.name, quantity: Number(i.quantity) || 1, unit: i.unit, rate: Number(i.rate) || 0 })) : [],
                                          totalAmount: inv.totalAmount,
                                          paidAmount: inv.paidAmount || 0,
                                          upiId: log?.upiId || upiId,
                                          bankName: log?.bankName,
                                          bankAccountNo: log?.bankAccountNo,
                                          bankIfsc: log?.bankIfsc,
                                          docType: isRet ? 'purchase_return' : 'purchase',
                                        });
                                        const invoiceData = {
                                          invoiceNo: inv.invoiceNo,
                                          invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                          docType: isRet ? 'purchase_return' : 'purchase',
                                          originalInvoiceNo: log?.originalInvoiceNo,
                                          originalInvoiceDate: log?.originalInvoiceDate,
                                          reasonForReturn: log?.reasonForReturn,
                                          sellerName: selectedMahajan?.name || 'Supplier',
                                          sellerAddress: selectedMahajan?.address || log?.sellerAddress || '',
                                          sellerGSTIN: selectedMahajan?.gstin || log?.sellerGSTIN || '',
                                          sellerPhone: selectedMahajan?.phone || log?.sellerPhone || '',
                                          sellerEmail: log?.sellerEmail || '',
                                          sellerState: selectedMahajan?.state || log?.sellerState || 'Assam',
                                          sellerStateCode: selectedMahajan?.stateCode || log?.sellerStateCode || '18',
                                          buyerName: log?.buyerName || activeCompany?.name || 'SmartVyapar Merchant',
                                          buyerAddress: log?.buyerAddress || activeCompany?.address || '',
                                          buyerGSTIN: log?.buyerGSTIN || activeCompany?.gstin || '',
                                          buyerPhone: log?.buyerPhone || activeCompany?.phone || '',
                                          buyerState: log?.buyerState || 'Assam',
                                          buyerStateCode: log?.buyerStateCode || '18',
                                          items: Array.isArray(parsedItemsList) ? parsedItemsList : [],
                                          subtotal: inv.subtotal,
                                          totalGst: inv.totalGst,
                                          totalAmount: inv.totalAmount,
                                          paidAmount: inv.paidAmount || 0,
                                          isInterstate: inv.isInterstate || false,
                                        };
                                        setWhatsAppModalPayload({
                                          phone: selectedMahajan?.phone || '',
                                          name: selectedMahajan?.name || 'Supplier',
                                          message: msg,
                                          title: `Share ${isRet ? 'Debit Note' : 'Invoice'} ${inv.invoiceNo} on WhatsApp`,
                                          invoiceNo: inv.invoiceNo,
                                          invoiceData,
                                        });
                                        setShowWhatsAppModal(true);
                                      }}
                                      className="flex items-center justify-center gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                      title="Share Document on WhatsApp"
                                    >
                                      <MessageCircle size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Inline Items Drawer */}
                              {isExpanded && (
                                <tr className={`${isRet ? 'bg-rose-50/40 border-b border-rose-200' : 'bg-orange-50/30 border-b border-slate-200'}`}>
                                  <td colSpan={8} className="p-4 pl-12">
                                    <div className={`bg-white rounded-xl border p-4 space-y-3 shadow-sm ${isRet ? 'border-rose-200' : 'border-orange-200'}`}>
                                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
                                        <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isRet ? 'text-rose-950' : 'text-orange-950'}`}>
                                          {isRet ? <Undo2 size={13} className="text-rose-600" /> : <Package size={13} className="text-orange-500" />}
                                          {isRet ? 'Goods Returned back to Supplier by:' : 'Items Sourced for:'} <strong className="text-[#004870]">{buyerName}</strong> ({isRet ? 'Debit Note' : 'Invoice'} #{inv.invoiceNo})
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                          {parsedItemsList.length} line item(s)
                                        </span>
                                      </div>

                                      {/* Return Audit Context Alert if Return */}
                                      {isRet && (
                                        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                                          <div className="flex items-center gap-2 text-rose-900 font-bold">
                                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                            <span>
                                              Original Invoice Ref: <strong className="font-mono text-slate-900">{retInfo.originalInvoiceNo || 'N/A'}</strong>
                                              {retInfo.originalInvoiceDate && ` (${new Date(retInfo.originalInvoiceDate).toLocaleDateString('en-IN')})`}
                                            </span>
                                          </div>
                                          <div className="text-rose-800 text-[11px] font-semibold">
                                            Reason: <strong>{retInfo.reasonForReturn}</strong>
                                          </div>
                                        </div>
                                      )}

                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                          <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                            <th className="py-1.5 px-2">#</th>
                                            <th className="py-1.5 px-3">Item Name</th>
                                            <th className="py-1.5 px-2">HSN</th>
                                            <th className="py-1.5 px-2 text-right">{isRet ? 'Returned Qty' : 'Quantity'}</th>
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
                                                  {isRet && (
                                                    <span className="ml-2 inline-block text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                                                      [RETURNED / DEBIT NOTE]
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{it.hsn || '--'}</td>
                                                <td className={`py-1.5 px-2 text-right font-bold ${isRet ? 'text-rose-700 font-mono' : 'text-slate-700'}`}>
                                                  {qty} {it.unit || 'PCS'}
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-semibold text-slate-600">{formatMoney(rate)}</td>
                                                <td className="py-1.5 px-2 text-right text-slate-500 font-mono">{gst}%</td>
                                                <td className={`py-1.5 px-3 text-right font-black ${isRet ? 'text-rose-700' : 'text-slate-900'}`}>
                                                  {isRet ? `- ${formatMoney(calc.finalAmount)}` : formatMoney(calc.finalAmount)}
                                                </td>
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
                                  {itemsList.length} item entry{itemsList.length !== 1 ? 'ies' : ''} sourced or returned on this farm/buyer name
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-blue-200 block">Net Sourced Amount</span>
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
                                  <th className="py-2.5 px-4 text-center">Invoice / Ref</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {itemsList.map((item, idx) => (
                                  <tr key={item.id} className={`hover:bg-orange-50/20 transition-colors ${item.isReturn ? 'bg-rose-50/20' : ''}`}>
                                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                    <td className="py-2.5 px-4">
                                      <div className="font-extrabold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{item.name}</span>
                                        {item.packing && (
                                          <span className="text-[10px] text-slate-400 font-medium">[{item.packing}]</span>
                                        )}
                                        {item.isReturn && (
                                          <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                                            ↩️ [RETURNED / DEBIT]
                                          </span>
                                        )}
                                      </div>
                                      {item.isReturn && item.reasonForReturn && (
                                        <div className="text-[9px] text-rose-600 italic">
                                          Reason: {item.reasonForReturn}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{item.hsn}</td>
                                    <td className={`py-2.5 px-3 text-right font-bold ${item.isReturn ? 'text-rose-700' : 'text-slate-700'}`}>
                                      {item.isReturn ? '-' : ''}{item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">{formatMoney(item.rate)}</td>
                                    <td className={`py-2.5 px-3 text-right font-medium ${item.isReturn ? 'text-rose-700' : 'text-slate-600'}`}>
                                      {item.isReturn ? `- ${formatMoney(Math.abs(item.taxableAmount))}` : formatMoney(item.taxableAmount)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">
                                      <span className="text-[10px] font-mono">{item.gstRate}%</span>
                                    </td>
                                    <td className={`py-2.5 px-4 text-right font-black ${item.isReturn ? 'text-rose-700' : 'text-slate-900'}`}>
                                      {item.isReturn ? `- ${formatMoney(Math.abs(item.finalAmount))}` : formatMoney(item.finalAmount)}
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${item.isReturn ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-orange-700 bg-orange-50 border-orange-200'}`}>
                                        {item.invoiceNo}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700 text-xs">
                                  <td colSpan={5} className="py-2.5 px-4 text-right uppercase text-[10px] text-slate-500 font-extrabold">
                                    Net Sourced for {buyerName}:
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
                  Purchase &amp; Debit Ledger
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Track wholesale suppliers, manage purchase invoices, inspect returned goods, and monitor itemized stock.
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
                    Add your wholesale suppliers here. When you save a Purchase Invoice or Return, the Supplier profile will also be updated.
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

      {/* DETAILED DOCUMENT & RETURNED GOODS INSPECTION MODAL */}
      {viewingReturnDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between shrink-0 ${viewingReturnDetails.isReturn ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${viewingReturnDetails.isReturn ? 'bg-rose-600 text-white shadow-sm' : 'bg-orange-500 text-white shadow-sm'}`}>
                  {viewingReturnDetails.isReturn ? <Undo2 size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      {viewingReturnDetails.isReturn ? '↩️ Purchase Return (Debit Note)' : '📦 Purchase Invoice'}
                    </h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${viewingReturnDetails.isReturn ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>
                      {viewingReturnDetails.inv.invoiceNo}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Supplier: <strong className="text-slate-800">{selectedMahajan?.name}</strong> • Date: {new Date(viewingReturnDetails.inv.invoiceDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReturnDetails(null)}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center border border-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Return Audit Context */}
              {viewingReturnDetails.isReturn && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs uppercase tracking-wide">
                    <AlertCircle size={15} className="text-rose-700" />
                    Purchase Return (Debit Note) Context &amp; Reason
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 pt-1">
                    <div className="bg-white/90 p-2.5 rounded-lg border border-rose-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Original Purchase Invoice Ref:</span>
                      <strong className="font-mono text-slate-900 text-xs">
                        {viewingReturnDetails.returnInfo?.originalInvoiceNo || 'N/A'}
                      </strong>
                      {viewingReturnDetails.returnInfo?.originalInvoiceDate && (
                        <span className="text-slate-500 text-[11px] block mt-0.5">
                          Dated: {new Date(viewingReturnDetails.returnInfo.originalInvoiceDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-rose-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Reason for Return:</span>
                      <strong className="text-rose-950 text-xs block">
                        {viewingReturnDetails.returnInfo?.reasonForReturn || 'Returned to supplier'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-orange-600" />
                    {viewingReturnDetails.isReturn ? 'Goods Returned to Supplier' : 'Billed Line Items'} ({viewingReturnDetails.itemsList.length})
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Calculated with tax &amp; unit packing
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase">
                        <th className="py-2.5 px-3 text-center w-10">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-center">Packing</th>
                        <th className="py-2.5 px-3 text-center">{viewingReturnDetails.isReturn ? 'Returned Qty' : 'Quantity'}</th>
                        <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">GST %</th>
                        <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {viewingReturnDetails.itemsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold">
                            No individual line items found.
                          </td>
                        </tr>
                      ) : (
                        viewingReturnDetails.itemsList.map((it: any, idx: number) => {
                          const calc = calculateLineItem(it);
                          const qty = calc.packageQty || Number(it.quantity) || 1;
                          const rate = Number(it.rate) || 0;
                          const gstRate = Number(it.gstRate) || 0;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                <div>{it.name || 'Product'}</div>
                                {it.hsn && <span className="text-[9.5px] font-mono text-slate-400 font-normal">HSN: {it.hsn}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                                {it.packing || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-900">
                                {qty} {it.unit || 'PCS'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                                ₹{rate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {gstRate}%
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono font-black ${viewingReturnDetails.isReturn ? 'text-rose-700' : 'text-slate-900'}`}>
                                {viewingReturnDetails.isReturn ? '- ' : ''}₹{calc.finalAmount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                        <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider">
                          {viewingReturnDetails.isReturn ? 'Total Returned Debit Value:' : 'Grand Total Amount:'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono text-sm ${viewingReturnDetails.isReturn ? 'text-rose-700' : 'text-orange-600'}`}>
                          {viewingReturnDetails.isReturn ? '- ' : ''}{formatMoney(viewingReturnDetails.inv.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const inv = viewingReturnDetails.inv;
                  setViewingReturnDetails(null);
                  onLoadInvoice(inv);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={13} /> Load in Generator / Print
              </button>
              <button
                type="button"
                onClick={() => setViewingReturnDetails(null)}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold py-2 px-5 rounded-xl transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
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

      {/* WhatsApp Interactive Share Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        defaultPhone={whatsAppModalPayload.phone}
        defaultRecipientName={whatsAppModalPayload.name}
        messageText={whatsAppModalPayload.message}
        title={whatsAppModalPayload.title || 'Send WhatsApp Reminder'}
        invoiceNo={whatsAppModalPayload.invoiceNo}
        invoiceData={whatsAppModalPayload.invoiceData}
      />
    </div>
  );
}
