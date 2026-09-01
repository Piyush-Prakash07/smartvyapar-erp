import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../auth/AuthContext';
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  getCustomer 
} from '../dashboard/api';
import type { Customer, Invoice } from '../dashboard/types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  User, 
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
  MessageCircle,
  Undo2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { calculateLineItem } from '../invoices/invoiceCalculations';
import WhatsAppShareModal from '../invoices/WhatsAppShareModal';
import { generateInvoiceWhatsAppMessage } from '../../lib/whatsapp';

interface CustomersPageProps {
  onLoadInvoice: (invoice: Invoice) => void;
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
  sellerName: string;
  isReturn?: boolean;
  reasonForReturn?: string;
  originalInvoiceNo?: string;
}

export default function CustomersPage({ onLoadInvoice }: CustomersPageProps) {
  const { activeCompany } = useAuth();
  
  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Profile View Filters and Modes
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [docTypeFilter, setDocTabFilter] = useState<'ALL' | 'INVOICES' | 'RETURNS'>('ALL');
  const [activeViewMode, setActiveViewMode] = useState<'invoices' | 'items_by_seller'>('invoices');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals Visibility
  const [showModal, setShowModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalPayload, setWhatsAppModalPayload] = useState<{
    phone: string;
    name: string;
    message: string;
    title: string;
    invoiceNo?: string;
    invoiceData?: any;
  }>({ phone: '', name: '', message: '', title: '' });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Document & Returned Items Inspection Modal State
  const [viewingReturnDetails, setViewingReturnDetails] = useState<{
    inv: Invoice;
    itemsList: any[];
    returnInfo: any;
    isReturn: boolean;
  } | null>(null);

  // Form Inputs
  const [formName, setFormName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formState, setFormState] = useState('');
  const [formStateCode, setFormStateCode] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Customers list
  useEffect(() => {
    if (!activeCompany) return;

    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCustomers();
        setCustomers(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch customer directory.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [activeCompany?.id, refreshTrigger]);

  // Load single customer details with invoices
  const handleSelectCustomer = async (customer: Customer) => {
    setIsDetailLoading(true);
    setSelectedSellerFilter('ALL');
    setDocTabFilter('ALL');
    setExpandedInvoiceId(null);
    setSearchFilter('');
    try {
      const data = await getCustomer(customer.id);
      setSelectedCustomer(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load customer profile details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Refresh active profile if open
  const handleRefreshProfile = async (id: string) => {
    try {
      const data = await getCustomer(id);
      setSelectedCustomer(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormGstin('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormState('');
    setFormStateCode('');
    setFormError('');
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormGstin(customer.gstin || '');
    setFormEmail(customer.email || '');
    setFormPhone(customer.phone || '');
    setFormAddress(customer.address || '');
    setFormState(customer.state || '');
    setFormStateCode(customer.stateCode || '');
    setFormError('');
    setShowModal(true);
  };

  // Submit Form (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) return setFormError('Customer name is required');

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

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        if (selectedCustomer?.id === editingCustomer.id) {
          handleRefreshProfile(editingCustomer.id);
        }
      } else {
        await createCustomer(payload);
      }

      setShowModal(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Operation failed. Check details.');
    }
  };

  // Delete Action
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this customer? This will orphan their archived invoices.')) {
      return;
    }
    try {
      await deleteCustomer(id);
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete customer.');
    }
  };

  // Helper formats
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Helper to detect if an invoice is a Return (Credit Note / Sale Return)
  const isInvoiceReturn = (inv: Invoice): boolean => {
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
      if (log?.docType === 'sale_return' || log?.docType === 'credit_note') {
        return true;
      }
    } catch { /* silent */ }
    const no = String(inv.invoiceNo || '');
    return no.includes('-CR/') || no.startsWith('CR/');
  };

  // Helper to get return info from logistics
  const getInvoiceReturnInfo = (inv: Invoice) => {
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
      return {
        docType: log?.docType || (isInvoiceReturn(inv) ? 'sale_return' : 'sales'),
        originalInvoiceNo: log?.originalInvoiceNo,
        originalInvoiceDate: log?.originalInvoiceDate,
        reasonForReturn: log?.reasonForReturn || 'Customer Goods Return / Defective stock',
        returnStatus: log?.returnStatus || 'CONFIRMED',
      };
    } catch {
      return {
        docType: isInvoiceReturn(inv) ? 'sale_return' : 'sales',
        originalInvoiceNo: '',
        originalInvoiceDate: '',
        reasonForReturn: 'Customer Goods Return',
        returnStatus: 'CONFIRMED',
      };
    }
  };

  // Helper to resolve seller / issuing firm name from an invoice
  const getInvoiceSellerName = (inv: Invoice): string => {
    try {
      const log = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : inv.logisticsData;
      if (log?.sellerName && log.sellerName.trim()) return log.sellerName.trim();
    } catch { /* silent */ }
    return activeCompany?.name || 'Primary Store';
  };

  // Extract all individual line items from invoices for itemized view
  const allExtractedItems: ExtractedItem[] = useMemo(() => {
    if (!selectedCustomer?.invoices) return [];
    const list: ExtractedItem[] = [];
    selectedCustomer.invoices.forEach(inv => {
      const seller = getInvoiceSellerName(inv);
      const isRet = isInvoiceReturn(inv);
      const retInfo = getInvoiceReturnInfo(inv);

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
                sellerName: seller,
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
  }, [selectedCustomer?.invoices, activeCompany]);

  // Distinct sellers list with counts and amounts
  const sellerSummaryMap = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; itemsCount: number; returnsCount: number; returnAmount: number }>();
    if (!selectedCustomer?.invoices) return map;

    selectedCustomer.invoices.forEach(inv => {
      const sName = getInvoiceSellerName(inv);
      const isRet = isInvoiceReturn(inv);
      const cur = map.get(sName) || { count: 0, totalAmount: 0, itemsCount: 0, returnsCount: 0, returnAmount: 0 };
      
      if (isRet) {
        cur.returnsCount += 1;
        cur.returnAmount += inv.totalAmount;
      } else {
        cur.count += 1;
        cur.totalAmount += inv.totalAmount;
      }
      map.set(sName, cur);
    });

    allExtractedItems.forEach(it => {
      const cur = map.get(it.sellerName);
      if (cur) cur.itemsCount += 1;
    });

    return map;
  }, [selectedCustomer?.invoices, allExtractedItems, activeCompany]);

  const uniqueSellerNames = useMemo(() => Array.from(sellerSummaryMap.keys()), [sellerSummaryMap]);

  // Filtered invoices by selected seller, document type filter, and search query
  const filteredInvoices = useMemo(() => {
    if (!selectedCustomer?.invoices) return [];
    return selectedCustomer.invoices.filter(inv => {
      const sName = getInvoiceSellerName(inv);
      const isRet = isInvoiceReturn(inv);

      if (selectedSellerFilter !== 'ALL' && sName !== selectedSellerFilter) return false;
      if (docTypeFilter === 'INVOICES' && isRet) return false;
      if (docTypeFilter === 'RETURNS' && !isRet) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesNo = inv.invoiceNo.toLowerCase().includes(q);
        const matchesSeller = sName.toLowerCase().includes(q);
        const retInfo = getInvoiceReturnInfo(inv);
        const matchesOrig = retInfo.originalInvoiceNo?.toLowerCase().includes(q) || false;
        const matchesReason = retInfo.reasonForReturn?.toLowerCase().includes(q) || false;
        return matchesNo || matchesSeller || matchesOrig || matchesReason;
      }
      return true;
    });
  }, [selectedCustomer?.invoices, selectedSellerFilter, docTypeFilter, searchFilter, activeCompany]);

  // Grouped items by seller (filtered)
  const groupedItemsBySeller = useMemo(() => {
    const groups: { [seller: string]: ExtractedItem[] } = {};
    allExtractedItems.forEach(item => {
      if (selectedSellerFilter !== 'ALL' && item.sellerName !== selectedSellerFilter) return;
      if (docTypeFilter === 'INVOICES' && item.isReturn) return;
      if (docTypeFilter === 'RETURNS' && !item.isReturn) return;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSeller = item.sellerName.toLowerCase().includes(q);
        const matchInv = item.invoiceNo.toLowerCase().includes(q);
        const matchOrig = item.originalInvoiceNo?.toLowerCase().includes(q) || false;
        if (!matchName && !matchSeller && !matchInv && !matchOrig) return;
      }
      if (!groups[item.sellerName]) groups[item.sellerName] = [];
      groups[item.sellerName].push(item);
    });
    return groups;
  }, [allExtractedItems, selectedSellerFilter, docTypeFilter, searchFilter]);

  // Calculate comprehensive stats for customer profile (Sales vs Returns)
  const getCustomerStats = (invoicesList: Invoice[] = []) => {
    let totalSales = 0;
    let totalReturns = 0;
    let invoiceCount = 0;
    let returnCount = 0;

    invoicesList.forEach(inv => {
      if (isInvoiceReturn(inv)) {
        totalReturns += inv.totalAmount;
        returnCount += 1;
      } else {
        totalSales += inv.totalAmount;
        invoiceCount += 1;
      }
    });

    const netSales = Math.max(0, totalSales - totalReturns);
    return { totalSales, totalReturns, netSales, invoiceCount, returnCount, totalDocs: invoicesList.length };
  };

  const currentStats = getCustomerStats(selectedCustomer?.invoices || []);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Dynamic Profile view or Directory List */}
      {selectedCustomer ? (
        
        // ------------------ CLIENT PROFILE / LEDGER SHEET VIEW ------------------
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setSelectedCustomer(null)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#004870] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Customer Sales &amp; Return Ledger
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Box: Customer details card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 h-fit">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedCustomer.name}</h3>
                {selectedCustomer.gstin ? (
                  <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 mt-1.5 w-fit uppercase tracking-wider">
                    GSTIN: {selectedCustomer.gstin}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 mt-1.5 w-fit uppercase tracking-wider">
                    Consumer / Unregistered
                  </div>
                )}
              </div>

              {/* Quick statistics with Sales & Returns breakdown */}
              <div className="grid grid-cols-2 gap-3 border-t border-b border-slate-100 py-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Gross Sales</span>
                  <div className="text-base font-black text-[#004870]">
                    {formatMoney(currentStats.totalSales)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{currentStats.invoiceCount} sale bills</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                    <Undo2 size={10} /> Sales Returns
                  </span>
                  <div className="text-base font-black text-purple-700">
                    - {formatMoney(currentStats.totalReturns)}
                  </div>
                  <span className="text-[10px] text-purple-600 font-semibold">{currentStats.returnCount} credit note(s)</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase">Net Effective Sales:</span>
                  <span className="text-lg font-black text-emerald-700">{formatMoney(currentStats.netSales)}</span>
                </div>
              </div>

              {/* Selling Firms Breakdown Summary */}
              {uniqueSellerNames.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Selling Firms / Branches / Farms
                  </span>
                  <div className="space-y-1.5">
                    {uniqueSellerNames.map(sName => {
                      const st = sellerSummaryMap.get(sName);
                      return (
                        <div 
                          key={sName} 
                          onClick={() => setSelectedSellerFilter(selectedSellerFilter === sName ? 'ALL' : sName)}
                          className={`p-2.5 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition-all ${
                            selectedSellerFilter === sName 
                              ? 'bg-blue-50 border-blue-300 shadow-2xs' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Building size={12} className="text-[#004870]" />
                            <span>{sName}</span>
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

              {/* Detailed specs */}
              <div className="space-y-3.5 text-xs border-t border-slate-100 pt-4">
                {selectedCustomer.phone && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Phone Number</span>
                    <span className="font-semibold text-slate-700">{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Email Address</span>
                    <span className="font-semibold text-slate-700">{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.state && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">State &amp; Code</span>
                    <span className="font-semibold text-slate-700">
                      {selectedCustomer.state} ({selectedCustomer.stateCode || '--'})
                    </span>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Billing Address</span>
                    <span className="font-medium text-slate-600 block mt-0.5 whitespace-pre-line leading-relaxed">
                      {selectedCustomer.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Sales & Returns Ledger Panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Header with View Toggle & Search */}
              <div className="p-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-[#004870]" />
                      Customer Invoices &amp; Returns Ledger
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Track standard tax invoices and inspect all sales return items (credit notes).
                    </p>
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('invoices')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeViewMode === 'invoices'
                          ? 'bg-white text-[#004870] shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText size={13} /> Documents Register
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('items_by_seller')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeViewMode === 'items_by_seller'
                          ? 'bg-white text-[#004870] shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Layers size={13} /> Itemized by Seller
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
                    All Documents ({selectedCustomer.invoices?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTabFilter('INVOICES')}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      docTypeFilter === 'INVOICES'
                        ? 'bg-[#004870] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    📄 Sales Invoices ({currentStats.invoiceCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTabFilter('RETURNS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      docTypeFilter === 'RETURNS'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <Undo2 size={12} />
                    🔄 Returns / Credit Notes ({currentStats.returnCount})
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Seller filter tabs */}
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSellerFilter('ALL')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        selectedSellerFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Sellers
                    </button>
                    {uniqueSellerNames.map(sName => {
                      const st = sellerSummaryMap.get(sName);
                      return (
                        <button
                          key={sName}
                          type="button"
                          onClick={() => setSelectedSellerFilter(sName)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            selectedSellerFilter === sName
                              ? 'bg-[#004870] text-white border-[#004870] shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Building size={11} /> {sName} ({st?.count || 0})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search invoice, return ref, item..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004870]"
                    />
                  </div>
                </div>
              </div>

              {isDetailLoading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#004870] border-t-transparent"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading records...</p>
                </div>
              ) : !selectedCustomer.invoices || selectedCustomer.invoices.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <FileText size={32} className="text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider">No Records Found</p>
                  <p className="text-[11px] text-slate-500 font-medium">Invoices &amp; return credit notes generated for this customer will be recorded here.</p>
                </div>
              ) : activeViewMode === 'invoices' ? (
                
                // VIEW 1: INVOICES & RETURN CREDIT NOTES LEDGER TABLE
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-10"></th>
                        <th className="py-3.5 px-4">Doc No. &amp; Type</th>
                        <th className="py-3.5 px-4">Seller / Firm</th>
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
                          const sellerName = getInvoiceSellerName(inv);
                          const isRet = isInvoiceReturn(inv);
                          const retInfo = getInvoiceReturnInfo(inv);
                          const isExpanded = expandedInvoiceId === inv.id;
                          let parsedItemsList: any[] = [];
                          try {
                            parsedItemsList = typeof inv.itemsData === 'string' ? JSON.parse(inv.itemsData) : inv.itemsData || [];
                          } catch { /* silent */ }

                          return (
                            <Fragment key={inv.id}>
                              <tr 
                                className={`transition-colors text-xs hover:bg-slate-50/70 ${isRet ? 'bg-purple-50/20' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                              >
                                <td className="py-3 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                    className="p-1 rounded text-slate-400 hover:text-[#004870] hover:bg-slate-100 transition-colors cursor-pointer"
                                    title={isExpanded ? 'Hide Items' : 'View Items'}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                    <span>{inv.invoiceNo}</span>
                                    {isRet && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
                                        <Undo2 size={9} /> Credit Note
                                      </span>
                                    )}
                                  </div>
                                  {isRet && retInfo.originalInvoiceNo && (
                                    <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                                      Ref: <span className="font-mono font-bold text-slate-700">{retInfo.originalInvoiceNo}</span>
                                    </div>
                                  )}
                                  {isRet && retInfo.reasonForReturn && (
                                    <div className="text-[9.5px] text-purple-700 font-semibold truncate max-w-xs">
                                      {retInfo.reasonForReturn}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[11px] font-bold">
                                    <Building size={11} className="text-[#004870]" />
                                    {sellerName}
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
                                <td className={`py-3 px-4 text-right font-black ${isRet ? 'text-purple-700 font-mono' : 'text-slate-900 font-mono'}`}>
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
                                          ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100' 
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                      title={isRet ? 'Inspect Returned Items' : 'Inspect Billed Items'}
                                    >
                                      <Eye size={11} className={isRet ? 'text-purple-600' : 'text-[#004870]'} />
                                      {isRet ? 'Returned' : 'Items'}
                                    </button>

                                    <button
                                      onClick={() => onLoadInvoice(inv)}
                                      className="flex items-center justify-center gap-1 bg-[#004870] hover:bg-[#003859] text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
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
                                          customerName: selectedCustomer?.name || 'Customer',
                                          customerPhone: selectedCustomer?.phone || undefined,
                                          items: Array.isArray(parsedItemsList) ? parsedItemsList.map((i: any) => ({ name: i.name, quantity: Number(i.quantity) || 1, unit: i.unit, rate: Number(i.rate) || 0 })) : [],
                                          totalAmount: inv.totalAmount,
                                          paidAmount: inv.paidAmount || 0,
                                          upiId: log?.upiId || upiId,
                                          bankName: log?.bankName,
                                          bankAccountNo: log?.bankAccountNo,
                                          bankIfsc: log?.bankIfsc,
                                          docType: isRet ? 'sale_return' : 'sales',
                                        });
                                        const invoiceData = {
                                          invoiceNo: inv.invoiceNo,
                                          invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                          docType: isRet ? 'sale_return' : 'sales',
                                          originalInvoiceNo: log?.originalInvoiceNo,
                                          originalInvoiceDate: log?.originalInvoiceDate,
                                          reasonForReturn: log?.reasonForReturn,
                                          sellerName: log?.sellerName || activeCompany?.name || 'SmartVyapar Merchant',
                                          sellerAddress: log?.sellerAddress || activeCompany?.address || '',
                                          sellerGSTIN: log?.sellerGSTIN || activeCompany?.gstin || '',
                                          sellerPhone: log?.sellerPhone || activeCompany?.phone || '',
                                          sellerEmail: log?.sellerEmail || activeCompany?.email || '',
                                          sellerState: log?.sellerState || '',
                                          sellerStateCode: log?.sellerStateCode || '',
                                          sellerPAN: log?.sellerPAN || '',
                                          sellerFssai: log?.sellerFssai || '',
                                          buyerName: selectedCustomer?.name || 'Customer',
                                          buyerAddress: selectedCustomer?.address || log?.buyerAddress || '',
                                          buyerGSTIN: selectedCustomer?.gstin || log?.buyerGSTIN || '',
                                          buyerPhone: selectedCustomer?.phone || log?.buyerPhone || '',
                                          buyerState: selectedCustomer?.state || log?.buyerState || '',
                                          buyerStateCode: selectedCustomer?.stateCode || log?.buyerStateCode || '',
                                          items: Array.isArray(parsedItemsList) ? parsedItemsList : [],
                                          subtotal: inv.subtotal,
                                          totalGst: inv.totalGst,
                                          totalAmount: inv.totalAmount,
                                          paidAmount: inv.paidAmount || 0,
                                          isInterstate: inv.isInterstate || false,
                                        };
                                        setWhatsAppModalPayload({
                                          phone: selectedCustomer?.phone || '',
                                          name: selectedCustomer?.name || 'Customer',
                                          message: msg,
                                          title: `Share ${isRet ? 'Credit Note' : 'Invoice'} ${inv.invoiceNo} on WhatsApp`,
                                          invoiceNo: inv.invoiceNo,
                                          invoiceData,
                                        });
                                        setShowWhatsAppModal(true);
                                      }}
                                      className="flex items-center justify-center gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                      title="Share PDF on WhatsApp"
                                    >
                                      <MessageCircle size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Inline Items Drawer */}
                              {isExpanded && (
                                <tr className={`${isRet ? 'bg-purple-50/40 border-b border-purple-200' : 'bg-blue-50/30 border-b border-slate-200'}`}>
                                  <td colSpan={8} className="p-4 pl-12">
                                    <div className={`bg-white rounded-xl border p-4 space-y-3 shadow-sm ${isRet ? 'border-purple-200' : 'border-blue-200'}`}>
                                      {/* Drawer Header */}
                                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
                                        <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isRet ? 'text-purple-900' : 'text-blue-950'}`}>
                                          {isRet ? <Undo2 size={13} className="text-purple-600" /> : <Package size={13} className="text-[#004870]" />}
                                          {isRet ? 'Goods Returned from Customer to:' : 'Items Issued by:'} <strong className={isRet ? 'text-purple-700' : 'text-[#004870]'}>{sellerName}</strong> ({isRet ? 'Credit Note' : 'Invoice'} #{inv.invoiceNo})
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                          {parsedItemsList.length} line item(s)
                                        </span>
                                      </div>

                                      {/* Return Audit Context Alert if Return */}
                                      {isRet && (
                                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                                          <div className="flex items-center gap-2 text-purple-900 font-bold">
                                            <AlertCircle size={14} className="text-purple-600 shrink-0" />
                                            <span>
                                              Original Invoice Ref: <strong className="font-mono text-slate-900">{retInfo.originalInvoiceNo || 'N/A'}</strong>
                                              {retInfo.originalInvoiceDate && ` (${new Date(retInfo.originalInvoiceDate).toLocaleDateString('en-IN')})`}
                                            </span>
                                          </div>
                                          <div className="text-purple-800 text-[11px] font-semibold">
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
                                                    <span className="ml-2 inline-block text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                                                      [RETURNED]
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{it.hsn || '--'}</td>
                                                <td className={`py-1.5 px-2 text-right font-bold ${isRet ? 'text-purple-700 font-mono' : 'text-slate-700'}`}>
                                                  {qty} {it.unit || 'PCS'}
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-semibold text-slate-600">{formatMoney(rate)}</td>
                                                <td className="py-1.5 px-2 text-right text-slate-500 font-mono">{gst}%</td>
                                                <td className={`py-1.5 px-3 text-right font-black ${isRet ? 'text-purple-700' : 'text-slate-900'}`}>
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

                // VIEW 2: ITEMIZED ITEMS GROUPED SEPARATELY BY SELLER / FARM
                <div className="p-5 space-y-6">
                  {Object.keys(groupedItemsBySeller).length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                      No items found for the selected seller or search filter.
                    </div>
                  ) : (
                    Object.entries(groupedItemsBySeller).map(([sellerName, itemsList]) => {
                      const sellerTotalAmt = itemsList.reduce((sum, it) => sum + it.finalAmount, 0);
                      const sellerTotalTaxable = itemsList.reduce((sum, it) => sum + it.taxableAmount, 0);
                      const sellerTotalGst = itemsList.reduce((sum, it) => sum + it.totalGst, 0);

                      return (
                        <div key={sellerName} className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                          {/* Seller Firm Header Banner */}
                          <div className="bg-gradient-to-r from-[#004870] to-blue-900 text-white px-5 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Building size={16} className="text-amber-400" />
                              <div>
                                <h4 className="text-sm font-black tracking-tight">{sellerName}</h4>
                                <p className="text-[10px] text-blue-200 font-semibold">
                                  {itemsList.length} item line entries sold or returned on this firm name
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-blue-200 block">Net Sourced Amount</span>
                              <span className="text-base font-black text-amber-300">{formatMoney(sellerTotalAmt)}</span>
                            </div>
                          </div>

                          {/* Items Table for this specific Seller */}
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
                                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.isReturn ? 'bg-purple-50/20' : ''}`}>
                                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                    <td className="py-2.5 px-4">
                                      <div className="font-extrabold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{item.name}</span>
                                        {item.packing && (
                                          <span className="text-[10px] text-slate-400 font-medium">[{item.packing}]</span>
                                        )}
                                        {item.isReturn && (
                                          <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200">
                                            🔄 [RETURNED]
                                          </span>
                                        )}
                                      </div>
                                      {item.isReturn && item.reasonForReturn && (
                                        <div className="text-[9px] text-purple-600 italic">
                                          Reason: {item.reasonForReturn}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{item.hsn}</td>
                                    <td className={`py-2.5 px-3 text-right font-bold ${item.isReturn ? 'text-purple-700' : 'text-slate-700'}`}>
                                      {item.isReturn ? '-' : ''}{item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">{formatMoney(item.rate)}</td>
                                    <td className={`py-2.5 px-3 text-right font-medium ${item.isReturn ? 'text-purple-700' : 'text-slate-600'}`}>
                                      {item.isReturn ? `- ${formatMoney(Math.abs(item.taxableAmount))}` : formatMoney(item.taxableAmount)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">
                                      <span className="text-[10px] font-mono">{item.gstRate}%</span>
                                    </td>
                                    <td className={`py-2.5 px-4 text-right font-black ${item.isReturn ? 'text-purple-700' : 'text-slate-900'}`}>
                                      {item.isReturn ? `- ${formatMoney(Math.abs(item.finalAmount))}` : formatMoney(item.finalAmount)}
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${item.isReturn ? 'text-purple-800 bg-purple-50 border-purple-200' : 'text-[#004870] bg-blue-50 border-blue-200'}`}>
                                        {item.invoiceNo}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700 text-xs">
                                  <td colSpan={5} className="py-2.5 px-4 text-right uppercase text-[10px] text-slate-500 font-extrabold">
                                    Net Subtotal for {sellerName}:
                                  </td>
                                  <td className="py-2.5 px-3 text-right">{formatMoney(sellerTotalTaxable)}</td>
                                  <td className="py-2.5 px-3 text-right">{formatMoney(sellerTotalGst)}</td>
                                  <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatMoney(sellerTotalAmt)}</td>
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
        // CUSTOMER DIRECTORY VIEW
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Users className="text-[#004870]" />
                Customer Ledger Directory
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">
                  Sales &amp; Credit Ledger
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Manage your customer database, inspect sales invoices, track returned items, and verify credit note ledgers.
              </p>
            </div>
            <button 
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 bg-[#004870] hover:bg-[#003c5e] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer"
            >
              <Plus size={15} />
              Add New Customer
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
              Error: {error}
            </div>
          )}

          {/* Directory Box */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#004870] border-t-transparent"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Syncing customer profiles...</p>
              </div>
            ) : customers.length === 0 ? (
              <div className="p-16 text-center max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
                  <Users size={28} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Your Directory is Empty</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Add standard customer details to enable instant buyer pre-fill in invoices and auto-archive transaction records.
                  </p>
                </div>
                <button
                  onClick={handleOpenCreate}
                  className="bg-[#004870] hover:bg-[#003c5e] text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                >
                  Create Your First Customer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Customer Name</th>
                      <th className="py-4 px-4 text-center w-24">State Code</th>
                      <th className="py-4 px-5">GSTIN</th>
                      <th className="py-4 px-5">Phone</th>
                      <th className="py-4 px-5">Email</th>
                      <th className="py-4 px-6 text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {customers.map((c) => (
                      <tr 
                        key={c.id} 
                        onClick={() => handleSelectCustomer(c)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-900 text-sm">{c.name}</div>
                          {c.address ? (
                            <div className="text-[11px] text-slate-500 max-w-xs truncate">{c.address}</div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">No address registered</div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {c.stateCode ? (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs">
                              {c.stateCode}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">--</span>
                          )}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-600 text-xs font-semibold">
                          {c.gstin || <span className="text-slate-400 italic font-sans">Consumer</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-600 text-xs font-semibold">
                          {c.phone || <span className="text-slate-300">--</span>}
                        </td>
                        <td className="py-4 px-5 text-slate-600 text-xs font-semibold">
                          {c.email || <span className="text-slate-300">--</span>}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={(e) => handleOpenEdit(c, e)}
                              className="p-1.5 text-slate-400 hover:text-[#004870] rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                              title="Edit Customer"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(c.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                              title="Delete Customer"
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

      {/* DETAILED DOCUMENT & RETURNED ITEMS MODAL */}
      {viewingReturnDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between shrink-0 ${viewingReturnDetails.isReturn ? 'bg-purple-50/80 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${viewingReturnDetails.isReturn ? 'bg-purple-600 text-white shadow-sm' : 'bg-[#004870] text-white shadow-sm'}`}>
                  {viewingReturnDetails.isReturn ? <Undo2 size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      {viewingReturnDetails.isReturn ? '🔄 Customer Sales Return (Credit Note)' : '📄 Sales Invoice'}
                    </h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${viewingReturnDetails.isReturn ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                      {viewingReturnDetails.inv.invoiceNo}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Customer: <strong className="text-slate-800">{selectedCustomer?.name}</strong> • Date: {new Date(viewingReturnDetails.inv.invoiceDate).toLocaleDateString('en-IN')}
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
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs uppercase tracking-wide">
                    <AlertCircle size={15} className="text-purple-700" />
                    Sales Return Details &amp; Reason
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 pt-1">
                    <div className="bg-white/90 p-2.5 rounded-lg border border-purple-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Original Invoice Ref:</span>
                      <strong className="font-mono text-slate-900 text-xs">
                        {viewingReturnDetails.returnInfo?.originalInvoiceNo || 'N/A'}
                      </strong>
                      {viewingReturnDetails.returnInfo?.originalInvoiceDate && (
                        <span className="text-slate-500 text-[11px] block mt-0.5">
                          Dated: {new Date(viewingReturnDetails.returnInfo.originalInvoiceDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-purple-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Reason for Return:</span>
                      <strong className="text-purple-950 text-xs block">
                        {viewingReturnDetails.returnInfo?.reasonForReturn || 'Customer stock return'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-[#004870]" />
                    {viewingReturnDetails.isReturn ? 'Items Returned by Customer' : 'Billed Line Items'} ({viewingReturnDetails.itemsList.length})
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
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-900">
                                {qty} {it.unit || 'PCS'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                                ₹{rate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {gstRate}%
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono font-black ${viewingReturnDetails.isReturn ? 'text-purple-700' : 'text-slate-900'}`}>
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
                          {viewingReturnDetails.isReturn ? 'Total Returned Credit Amount:' : 'Grand Total Amount:'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono text-sm ${viewingReturnDetails.isReturn ? 'text-purple-700' : 'text-[#004870]'}`}>
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
                className="bg-[#004870] hover:bg-[#003859] text-white text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
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

      {/* CREATE & EDIT DIALOG MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm flex items-center gap-2">
                <User size={16} className="text-amber-400" />
                {editingCustomer ? 'Edit Customer Info' : 'New Customer Profile'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer / Company Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Dinesh Stores, ABC Corp"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GSTIN (Optional)</label>
                <input 
                  type="text" 
                  placeholder="15-digit GST Registration"
                  value={formGstin}
                  onChange={(e) => setFormGstin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">State</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Bihar, Assam"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">State Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 10, 18"
                    value={formStateCode}
                    onChange={(e) => setFormStateCode(e.target.value)}
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
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. buyer@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Billing Address (Optional)</label>
                <textarea 
                  placeholder="Street, City, pincode details..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
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
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#004870] hover:bg-[#003859] text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow transition-colors cursor-pointer"
                >
                  <Save size={14} />
                  Save Profile
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
