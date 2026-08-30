import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getDailyStock, adjustStock, createItemAndStock } from './api';
import type { DailyStockResponse, DailyStockItem } from './api';
import {
  Calendar,
  Printer,
  RefreshCw,
  Info,
  AlertCircle,
  Package,
  Layers,
  Activity,
  Edit2,
  Plus,
  Search,
  ArrowUpAZ,
  ArrowDownAZ,
  Building,
  X
} from 'lucide-react';

export default function StockPage() {
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
  const [selectedSubpartId, setSelectedSubpartId] = useState<string>('ALL');
  const [data, setData] = useState<DailyStockResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Money Formatter Helper
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Stock adjustment modal states
  const [selectedItem, setSelectedItem] = useState<DailyStockItem | null>(null);
  const [physicalQty, setPhysicalQty] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<boolean>(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  // Add Item & Stock modal states
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [itemName, setItemName] = useState<string>('');
  const [itemUnit, setItemUnit] = useState<string>('PCS');
  const [itemHsn, setItemHsn] = useState<string>('21069099');
  const [itemDesc, setItemDesc] = useState<string>('');
  const [initialStock, setInitialStock] = useState<string>('0');
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const fetchStockData = async (showRefreshIndicator = false) => {
    if (!activeCompany) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const result = await getDailyStock(selectedDate, selectedSubpartId);
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch daily stock data:', err);
      setError(err.response?.data?.message || 'Failed to retrieve daily stock records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [activeCompany?.id, selectedDate, selectedSubpartId]);



  // Helper to format date for human consumption
  const formatHumanDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenAdjustmentModal = (item: DailyStockItem) => {
    setSelectedItem(item);
    setPhysicalQty(item.closingStock.toString());
    setNote('');
    setAdjustmentError(null);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !activeCompany) return;

    const baseCalculated = selectedItem.openingStock + selectedItem.inward - selectedItem.outward;
    const targetPhysical = parseFloat(physicalQty);

    if (isNaN(targetPhysical)) {
      setAdjustmentError('Please enter a valid physical stock quantity.');
      return;
    }

    const delta = targetPhysical - baseCalculated;

    setIsSavingAdjustment(true);
    setAdjustmentError(null);

    try {
      await adjustStock({
        itemId: selectedItem.id,
        date: selectedDate,
        quantity: delta,
        note: note.trim() || undefined,
        subpartId: selectedSubpartId !== 'ALL' ? selectedSubpartId : undefined,
      });
      
      setSelectedItem(null);
      await fetchStockData(true);
    } catch (err: any) {
      console.error('Failed to save stock adjustment:', err);
      setAdjustmentError(err.response?.data?.message || 'Failed to register stock adjustment.');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleResetAdjustment = async () => {
    if (!selectedItem || !activeCompany) return;

    setIsSavingAdjustment(true);
    setAdjustmentError(null);

    try {
      await adjustStock({
        itemId: selectedItem.id,
        date: selectedDate,
        quantity: 0,
        subpartId: selectedSubpartId !== 'ALL' ? selectedSubpartId : undefined,
      });
      
      setSelectedItem(null);
      await fetchStockData(true);
    } catch (err: any) {
      console.error('Failed to reset stock adjustment:', err);
      setAdjustmentError(err.response?.data?.message || 'Failed to reset stock adjustment.');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleCreateItemAndStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    if (!itemName.trim()) {
      setItemError('Item name is required.');
      return;
    }

    const parsedStock = parseFloat(initialStock);

    if (isNaN(parsedStock) || parsedStock < 0) {
      setItemError('Initial stock quantity cannot be negative.');
      return;
    }

    setIsSavingItem(true);
    setItemError(null);

    try {
      await createItemAndStock({
        name: itemName.trim(),
        unit: itemUnit.trim() || 'PCS',
        rate: 0,
        cost: 0,
        hsn: itemHsn.trim() || '21069099',
        description: itemDesc.trim() || undefined,
        date: selectedDate,
        initialStock: parsedStock
      });

      // Clear states & close modal
      setShowAddItemModal(false);
      setItemName('');
      setItemUnit('PCS');
      setItemHsn('21069099');
      setItemDesc('');
      setInitialStock('0');

      // Refresh stock table
      await fetchStockData(true);
    } catch (err: any) {
      console.error('Failed to create item and stock:', err);
      setItemError(err.response?.data?.message || err.message || 'Failed to register new item.');
    } finally {
      setIsSavingItem(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#004870] border-t-transparent mb-2"></div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Inventory Ledger...</p>
      </div>
    );
  }

  const rawItems = data?.items || [];
  const items = rawItems
    .filter(item => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const summary = data?.summary || {
    totalItems: 0,
    totalClosingQty: 0,
    totalValuation: 0,
  };

  const currentSubpart = data?.subparts?.find(s => s.id === selectedSubpartId);
  const locationLabel = currentSubpart ? `${currentSubpart.name}${currentSubpart.code ? ` (${currentSubpart.code})` : ''}` : 'All Store Subparts';

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Printable Header - Only visible when printing */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase text-center tracking-tight text-slate-900">
          {activeCompany?.name || 'SmartBiz ERP'}
        </h1>
        <p className="text-xs text-center text-slate-500 font-semibold uppercase tracking-widest mt-1">
          Daily Stock Ledger &amp; Inventory Valuation Report (Alphabetical Order)
        </p>
        <div className="flex justify-between items-center mt-6 text-xs text-slate-700 font-semibold">
          <div>
            <span className="text-slate-400">Inventory Location:</span> <strong className="text-slate-900">{locationLabel}</strong>
          </div>
          <div>
            <span className="text-slate-400">Inventory Date:</span> {formatHumanDate(selectedDate)}
          </div>
          <div>
            <span className="text-slate-400">Generated:</span> {new Date().toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Screen Control Panel - Hidden in print */}
      <div className="print:hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex flex-wrap items-center gap-2">
            Stock Inventory Register
            <span className="text-[10px] font-bold text-[#004870] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">
              Alphabetical (A-Z)
            </span>
            {selectedSubpartId !== 'ALL' && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide flex items-center gap-1">
                <Building size={10} /> {locationLabel}
              </span>
            )}
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Viewing inventory for: <strong className="text-slate-700">{activeCompany?.name}</strong> • Location: <strong className="text-blue-700">{locationLabel}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Store Subpart / Farm Filter */}
          <div className="relative flex items-center bg-blue-50/70 hover:bg-blue-50 rounded-xl border border-blue-200 px-3 py-2 transition-colors w-full sm:w-auto">
            <Building size={15} className="text-[#004870] mr-2 shrink-0" />
            <select
              value={selectedSubpartId}
              onChange={(e) => setSelectedSubpartId(e.target.value)}
              className="bg-transparent text-xs font-bold text-blue-950 outline-none cursor-pointer w-full sm:w-auto pr-1"
            >
              <option value="ALL">🏢 All Farm Stores / Business Branches</option>
              {data?.subparts?.map(sp => (
                <option key={sp.id} value={sp.id}>
                  📦 {sp.name} {sp.code ? `[${sp.code}]` : ''}
                </option>
              ))}
            </select>
          </div>

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
            onClick={() => fetchStockData(true)}
            disabled={isRefreshing}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Refresh inventory balances"
          >
            <RefreshCw size={15} className={`${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Add Item Button */}
          <button
            onClick={() => setShowAddItemModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Plus size={14} /> Add Item &amp; Stock
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="bg-[#004870] hover:bg-[#003858] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Inventory Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Catalog Items Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-100 flex items-center gap-1.5">
              <Package size={14} /> Catalog Items Count
            </span>
            <h3 className="text-2xl font-black mt-2">{summary.totalItems} Items</h3>
            <p className="text-[10px] text-blue-100 font-semibold mt-3 pt-2 border-t border-white/10">
              Active products arranged alphabetically
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <Package size={100} />
          </div>
        </div>

        {/* Total Quantity Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
          <div className="z-10 relative">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-100 flex items-center gap-1.5">
              <Layers size={14} /> Total Closing Qty
            </span>
            <h3 className="text-2xl font-black mt-2">{summary.totalClosingQty.toFixed(2)} Units</h3>
            <p className="text-[10px] text-orange-100 font-semibold mt-3 pt-2 border-t border-white/10">
              Sum of all positive item balances
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <Layers size={100} />
          </div>
        </div>
      </div>

      {/* Stock movement register */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} className="text-[#004870]" /> Stock Movement Register
            </h3>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
              {items.length} {searchQuery ? `of ${rawItems.length}` : ''} items ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
            </span>
          </div>

          {/* Search & Sort Controls (Hidden in print) */}
          <div className="print:hidden flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-2.5 py-1.5 shadow-2xs w-full sm:w-60">
              <Search size={13} className="text-slate-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stock item..."
                className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              title={`Sort Alphabetically: currently ${sortOrder === 'asc' ? 'A to Z' : 'Z to A'}`}
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowUpAZ size={14} className="text-[#004870]" />
                  <span>A-Z</span>
                </>
              ) : (
                <>
                  <ArrowDownAZ size={14} className="text-[#004870]" />
                  <span>Z-A</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {items.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Package size={32} className="mx-auto mb-3 text-slate-350" />
              <p className="text-xs font-bold uppercase">{searchQuery ? 'No matching stock items found' : 'No Items in Catalog'}</p>
              <p className="text-[10px] mt-1 text-slate-400">{searchQuery ? 'Try clearing your search query.' : 'Add items to the Items Catalog to track daily stock balances.'}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100 text-center">
                  <th 
                    className="py-3 px-4 text-left cursor-pointer select-none hover:text-slate-700 transition-colors"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title="Click to toggle A-Z / Z-A sorting"
                  >
                    <div className="flex items-center gap-1">
                      <span>Item Name</span>
                      {sortOrder === 'asc' ? (
                        <ArrowUpAZ size={12} className="text-[#004870]" />
                      ) : (
                        <ArrowDownAZ size={12} className="text-[#004870]" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-2 w-16">Unit</th>
                  <th className="py-3 px-3 w-28 text-right">MRP</th>
                  <th className="py-3 px-2 w-24 text-right">Opening Stock</th>
                  <th className="py-3 px-2 w-20 text-right">Inward (+)</th>
                  <th className="py-3 px-2 w-20 text-right">Outward (-)</th>
                  <th className="py-3 px-2 w-24 text-right">Adjustment (+/-)</th>
                  <th className="py-3 px-2 w-24 text-right">Closing Stock</th>
                  <th className="py-3 px-4 w-24 text-center print:hidden">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-middle">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center">
                    <td className="py-3.5 px-4 font-bold text-slate-700 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span>{item.name}</span>
                        {item.closingStock <= 0 ? (
                          <span className="inline-block px-1.5 py-0.5 text-[8px] font-black text-red-700 bg-red-50 border border-red-200 rounded uppercase tracking-wider print:hidden">
                            Out of Stock
                          </span>
                        ) : item.closingStock < 10 ? (
                          <span className="inline-block px-1.5 py-0.5 text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded uppercase tracking-wider print:hidden">
                            Low Stock
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3.5 px-2 font-semibold text-slate-500 font-mono text-[10px]">
                      {item.unit}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-600 text-xs">
                      {formatMoney(item.mrp || 0)}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono font-semibold text-slate-600">
                      {item.openingStock.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono font-bold text-emerald-600">
                      {item.inward > 0 ? `+${item.inward.toFixed(2)}` : '0.00'}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono font-bold text-rose-600">
                      {item.outward > 0 ? `-${item.outward.toFixed(2)}` : '0.00'}
                    </td>
                    <td className={`py-3.5 px-2 text-right font-mono font-bold ${
                      item.adjustment === 0 ? 'text-slate-400' : item.adjustment > 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {item.adjustment !== 0 ? (item.adjustment > 0 ? `+${item.adjustment.toFixed(2)}` : item.adjustment.toFixed(2)) : '0.00'}
                    </td>
                    <td className={`py-3.5 px-2 text-right font-mono font-black ${item.closingStock <= 0 ? 'text-red-650' : 'text-slate-900'}`}>
                      {item.closingStock.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center print:hidden">
                      <button
                        onClick={() => handleOpenAdjustmentModal(item)}
                        className="bg-slate-100 hover:bg-[#004870]/10 text-slate-600 hover:text-[#004870] px-2 py-1 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer text-[10px] font-bold"
                        title="Adjust closing stock level"
                      >
                        <Edit2 size={10} /> Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Informational help note */}
      <div className="print:hidden bg-slate-100 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600 items-start">
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <p className="font-bold text-slate-700">How the Daily Stock Ledger &amp; Adjustments Work:</p>
          <p className="mt-1">
            Opening Stock is computed dynamically by summing all past purchases/adjustments and subtracting all past sales. Inward reflects stock items purchased via **Purchase Invoices** on this date. Outward reflects items sold via **Sales Invoices** on this date. Closing Stock represents the final inventory count at the end of the day.
          </p>
          <p className="mt-1.5 font-semibold text-[#004870]">
            Need to correct mismatching counts? Click "Adjust" on any row to log physical stock level updates for the selected date. This adjustment will seamlessly carry forward into future opening stocks.
          </p>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Adjust Stock Balance
                </h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Item: <span className="text-[#004870] font-bold">{selectedItem.name}</span>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-455 hover:text-slate-700 font-bold text-lg cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 text-xs font-semibold text-slate-650">
              {adjustmentError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{adjustmentError}</span>
                </div>
              )}

              {/* Readonly Summary stats */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-150 p-3 rounded-xl text-center">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 block uppercase">Calculated</span>
                  <span className="text-xs font-black text-slate-700 font-mono">
                    {(selectedItem.openingStock + selectedItem.inward - selectedItem.outward).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 block uppercase">Current Adj.</span>
                  <span className={`text-xs font-black font-mono ${selectedItem.adjustment === 0 ? 'text-slate-500' : 'text-blue-600'}`}>
                    {selectedItem.adjustment > 0 ? `+${selectedItem.adjustment}` : selectedItem.adjustment}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 block uppercase">Total Closing</span>
                  <span className="text-xs font-black text-slate-900 font-mono">
                    {selectedItem.closingStock.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Physical Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  New Physical Stock Level ({selectedItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Enter actual quantity in stock"
                  value={physicalQty}
                  onChange={(e) => setPhysicalQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  required
                  autoFocus
                />
              </div>

              {/* Calculated Delta Info */}
              {physicalQty !== '' && !isNaN(parseFloat(physicalQty)) && (
                <div className="bg-blue-50/50 border border-blue-150 rounded-xl p-3 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-blue-700">Computed Delta Adjustment:</span>
                  <span className={`font-mono font-black text-xs ${
                    parseFloat(physicalQty) - (selectedItem.openingStock + selectedItem.inward - selectedItem.outward) >= 0 
                      ? 'text-emerald-700' 
                      : 'text-rose-700'
                  }`}>
                    {parseFloat(physicalQty) - (selectedItem.openingStock + selectedItem.inward - selectedItem.outward) >= 0 ? '+' : ''}
                    {(parseFloat(physicalQty) - (selectedItem.openingStock + selectedItem.inward - selectedItem.outward)).toFixed(2)} {selectedItem.unit}
                  </span>
                </div>
              )}

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Physical inventory audit mismatch"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2">
                {selectedItem.adjustment !== 0 && (
                  <button
                    type="button"
                    onClick={handleResetAdjustment}
                    className="flex-1 border border-slate-250 text-slate-600 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 border border-slate-250 text-slate-500 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjustment}
                  className="flex-1 bg-[#004870] hover:bg-[#003858] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm hover:shadow cursor-pointer transition-all"
                >
                  {isSavingAdjustment ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item & Stock Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Add Item &amp; Initial Stock
                </h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Register a new item into the items catalog and establish its stock level
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-450 hover:text-slate-700 font-bold text-lg cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateItemAndStock} className="p-6 space-y-4 text-xs font-semibold text-slate-655">
              {itemError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{itemError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Premium Chocolate Pack"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                    required
                  />
                </div>

                {/* Unit Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit Type</label>
                  <input
                    type="text"
                    placeholder="e.g. PCS, CTN, BAG"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                    required
                  />
                </div>

                {/* HSN Code */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 21069099"
                    value={itemHsn}
                    onChange={(e) => setItemHsn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  />
                </div>

                {/* Initial Stock */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Initial Stock (Qty)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Initial stock balance"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Item Description (Optional)</label>
                <textarea
                  placeholder="Optional details..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-[10.5px] leading-relaxed text-slate-500 border border-slate-150">
                <p className="font-bold text-slate-650">Note on Initial Stock Date:</p>
                <p className="mt-0.5">
                  Initial stock quantity will be logged as a stock adjustment on the selected date: <strong className="text-[#004870]">{formatHumanDate(selectedDate)}</strong>.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="border border-slate-250 text-slate-500 font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="bg-[#004870] hover:bg-[#003858] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm hover:shadow cursor-pointer transition-all"
                >
                  {isSavingItem ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
