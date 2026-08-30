import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getItems, createItem, updateItem, deleteItem } from '../dashboard/api';
import type { Item } from '../dashboard/types';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  Tag, 
  X, 
  Save
} from 'lucide-react';

export default function ItemsPage() {
  const { activeCompany } = useAuth();
  
  // Data State
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals Visibility
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form Inputs
  const [formName, setFormName] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formHsn, setFormHsn] = useState('21069099');
  const [formUnit, setFormUnit] = useState('PCS');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Items list
  useEffect(() => {
    if (!activeCompany) return;

    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getItems();
        const sorted = (data || []).slice().sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
        );
        setItems(sorted);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch items database.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [activeCompany?.id, refreshTrigger]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormName('');
    setFormRate('');
    setFormCost('');
    setFormMrp('');
    setFormHsn('21069099');
    setFormUnit('PCS');
    setFormDesc('');
    setFormError('');
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormRate(item.rate.toString());
    setFormCost(item.cost ? item.cost.toString() : '0');
    setFormMrp(item.mrp ? item.mrp.toString() : '0');
    setFormHsn(item.hsn || '21069099');
    setFormUnit(item.unit || 'PCS');
    setFormDesc(item.description || '');
    setFormError('');
    setShowModal(true);
  };

  // Submit Form (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) return setFormError('Item name is required');
    if (!formRate || parseFloat(formRate) < 0) return setFormError('Selling price (rate) must be positive');
    if (formCost && parseFloat(formCost) < 0) return setFormError('Unit cost must be a positive number');
    if (formMrp && parseFloat(formMrp) < 0) return setFormError('MRP must be a positive number');

    try {
      const payload = {
        name: formName.trim(),
        rate: parseFloat(formRate),
        cost: formCost ? parseFloat(formCost) : 0,
        mrp: formMrp ? parseFloat(formMrp) : 0,
        hsn: formHsn.trim() || '21069099',
        unit: formUnit.trim() || 'PCS',
        description: formDesc.trim() || undefined,
      };

      if (editingItem) {
        await updateItem(editingItem.id, payload);
      } else {
        await createItem(payload);
      }

      setShowModal(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Operation failed. Check details.');
    }
  };

  // Delete Action
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item from the catalog?')) {
      return;
    }
    try {
      await deleteItem(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete catalog item.');
    }
  };

  // Money Formatter Helper
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Package className="text-[#004870]" />
            Products & Services Catalog
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wide">
              Active Database
            </span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Maintain your store's item logs, including standard HSN codes, unit measures, purchase costs, and sales rates.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-[#004870] hover:bg-[#003859] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer"
        >
          <Plus size={15} />
          Create Catalog Item
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
          Error: {error}
        </div>
      )}

      {/* Main Grid: Catalog List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#004870] border-t-transparent"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Syncing catalog list...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <Package size={28} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Your Catalog is Empty</h3>
              <p className="text-xs text-slate-500 mt-1">
                Add standard items (e.g. Consulting Hours, Delivery Fees, Retail Goods) to prefill unit costs, HSN, and rates dynamically on bills.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="bg-[#004870] hover:bg-[#003c5e] text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Name / Description</th>
                  <th className="py-4 px-3 text-center w-28">HSN</th>
                  <th className="py-4 px-3 text-center w-28">Unit</th>
                  <th className="py-4 px-4 text-right w-36">MRP</th>
                  <th className="py-4 px-6 text-right w-44">Selling Price (Rate)</th>
                  <th className="py-4 px-6 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{item.description}</div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic mt-0.5">No description added</div>
                      )}
                    </td>
                    <td className="py-4 px-3 text-center font-mono font-bold text-slate-600 text-xs">
                      {item.hsn}
                    </td>
                    <td className="py-4 px-3 text-center uppercase font-bold text-slate-500 text-xs">
                      {item.unit}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-600 text-xs">
                      {formatMoney(item.mrp || 0)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="font-black text-[#004870] text-sm">
                        {formatMoney(item.rate)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 size={15} />
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

      {/* CREATE & EDIT DIALOG MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Tag size={16} className="text-amber-400" />
                {editingItem ? 'Edit Catalog Item' : 'New Catalog Item'}
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Item Name / Service Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Consulting Hours, Sugar, Cargo charges"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Selling Price / Rate (₹)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="e.g. 100"
                    min="0"
                    step="0.01"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">MRP (₹)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 120"
                    min="0"
                    step="0.01"
                    value={formMrp}
                    onChange={(e) => setFormMrp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">HSN Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 21069099"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unit Measure</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CTN, BAG, PCS"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description (Optional)</label>
                <textarea 
                  placeholder="Additional specs or details..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
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
                  Save Item
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
