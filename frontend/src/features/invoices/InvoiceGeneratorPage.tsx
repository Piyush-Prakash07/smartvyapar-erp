import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getItems, getCustomers, createInvoice, getMahajans, createMahajan, createPurchaseInvoice, getInvoices, getPurchaseInvoices, getStoreSubparts, createStoreSubpart } from '../dashboard/api';
import type { Item, Customer, Invoice, Mahajan, PurchaseInvoice, StoreSubpart } from '../dashboard/types';
import { QRCodeSVG } from 'qrcode.react';
import { generateInvoiceWhatsAppMessage } from '../../lib/whatsapp';
import WhatsAppShareModal from './WhatsAppShareModal';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  User, 
  Building, 
  CheckCircle,
  AlertTriangle,
  Truck,
  FileCheck,
  MoreVertical,
  QrCode,
  MessageCircle,
  X,
  RotateCcw,
  CornerDownLeft
} from 'lucide-react';

import { calculateLineItem } from './invoiceCalculations';
import type { InvoiceItem } from './invoiceCalculations';

// Indian Numbering System: Number to words converter
function convertNumberToWords(num: number): string {
  const rounded = Math.round(num);
  if (rounded === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function translate(n: number): string {
    let word = '';
    if (n < 20) {
      word = a[n];
    } else if (n < 100) {
      word = b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    } else {
      word = a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + translate(n % 100) : '');
    }
    return word.trim();
  }

  let k = rounded;
  let word = '';
  
  if (Math.floor(k / 10000000) > 0) {
    word += translate(Math.floor(k / 10000000)) + ' Crore ';
    k %= 10000000;
  }
  if (Math.floor(k / 100000) > 0) {
    word += translate(Math.floor(k / 100000)) + ' Lakh ';
    k %= 100000;
  }
  if (Math.floor(k / 1000) > 0) {
    word += translate(Math.floor(k / 1000)) + ' Thousand ';
    k %= 1000;
  }
  if (k > 0) {
    word += translate(k);
  }

  return word.trim() + ' Rupees Only';
}

interface InvoiceGeneratorPageProps {
  loadedInvoice?: Invoice | null;
  loadedPurchaseInvoice?: PurchaseInvoice | null;
  onClearLoadedInvoice?: () => void;
  onClearLoadedPurchaseInvoice?: () => void;
}

export default function InvoiceGeneratorPage({ loadedInvoice, loadedPurchaseInvoice, onClearLoadedInvoice, onClearLoadedPurchaseInvoice }: InvoiceGeneratorPageProps = {}) {
  const { activeCompany } = useAuth();

  // Invoice mode: sales (issue to customer), purchase (from supplier), sale_return (credit note), purchase_return (debit note)
  const [invoiceMode, setInvoiceMode] = useState<'sales' | 'purchase' | 'sale_return' | 'purchase_return'>('sales');
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState('');
  const [reasonForReturn, setReasonForReturn] = useState('Damaged / Defective Goods');

  // Settings and Catalog Items for Prefill
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [catalogCustomers, setCatalogCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [catalogMahajans, setCatalogMahajans] = useState<Mahajan[]>([]);
  const [selectedMahajanId, setSelectedMahajanId] = useState<string | null>(null);

  // Store Subparts (Multiple Buyers / Godowns / Branches)
  const [catalogStoreSubparts, setCatalogStoreSubparts] = useState<StoreSubpart[]>([]);
  const [selectedBuyerSubpartId, setSelectedBuyerSubpartId] = useState<string | null>(null);
  const [selectedSellerSubpartId, setSelectedSellerSubpartId] = useState<string | null>(null);
  const [showAddSubpartModal, setShowAddSubpartModal] = useState(false);
  const [subpartForm, setSubpartForm] = useState({
    name: '',
    code: '',
    gstin: '',
    phone: '',
    address: '',
    state: '',
    stateCode: '',
  });
  const [isSavingSubpart, setIsSavingSubpart] = useState(false);
  const [subpartError, setSubpartError] = useState<string | null>(null);

  // WhatsApp Share Modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalPayload, setWhatsAppModalPayload] = useState<{
    phone: string;
    name: string;
    message: string;
    invoiceData?: any;
  }>({ phone: '', name: '', message: '' });

  // Historical Invoices list for sequential numbering
  const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);

  // Archiving status states
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Helper for current financial year
  const getFinancialYear = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed, 3 = April
    
    let startYear = currentYear;
    if (currentMonth < 3) {
      startYear = currentYear - 1;
    }
    
    const yy = startYear.toString().slice(-2);
    const nextYy = (startYear + 1).toString().slice(-2);
    return `${yy}-${nextYy}`;
  };

  // Helper for computing standard company/seller invoice prefix (e.g. Tarun Enterprise -> TE, Assam Trading Company -> ATC)
  const getCompanyPrefix = (name?: string, code?: string) => {
    if (code && code.trim().length > 0) {
      return code.trim().toUpperCase();
    }
    if (!name || !name.trim()) return 'INV';

    const cleanName = name.trim();
    // If it's already an acronym/shortcode like "ATC", "TE", "TT", etc.
    if (/^[A-Za-z]{2,4}$/.test(cleanName)) {
      return cleanName.toUpperCase();
    }

    // Split words and ignore common connecting words
    const words = cleanName
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0 && !['AND', '&', 'OF', 'THE', 'PVT', 'LTD', 'CO'].includes(w.toUpperCase()));

    if (words.length >= 2) {
      // e.g. "Tarun Enterprise" -> "TE", "Assam Trading Company" -> "ATC"
      return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    } else if (words.length === 1) {
      return words[0].slice(0, 3).toUpperCase();
    }
    return 'INV';
  };

  // 1. Invoice Metadata States
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [reverseCharge, setReverseCharge] = useState('N');
  const [grRrNo, setGrRrNo] = useState('');
  const [transport, setTransport] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [station, setStation] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [freightAmt, setFreightAmt] = useState('');
  const [ackNo, setAckNo] = useState('');
  const [ackDate, setAckDate] = useState('');
  const [irn, setIrn] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState('');

  // 2. Seller Details States (Prefilled from Company context)
  const [sellerName, setSellerName] = useState(activeCompany?.name || '');
  const [sellerGSTIN, setSellerGSTIN] = useState(activeCompany?.gstin || '');
  const [sellerPAN, setSellerPAN] = useState('');
  const [sellerFssai, setSellerFssai] = useState('');
  const [sellerAddress, setSellerAddress] = useState(activeCompany?.address || '');
  const [sellerPhone, setSellerPhone] = useState(activeCompany?.phone || '');
  const [sellerEmail, setSellerEmail] = useState(activeCompany?.email || '');
  const [sellerState, setSellerState] = useState('');
  const [sellerStateCode, setSellerStateCode] = useState('');

  // 3. Buyer (Billed To) Details States
  const [buyerName, setBuyerName] = useState('');
  const [buyerGSTIN, setBuyerGSTIN] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerState, setBuyerState] = useState('');
  const [buyerStateCode, setBuyerStateCode] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');

  // 4. Shipped To Details States
  const [useDifferentShipping, setUseDifferentShipping] = useState(false);
  const [shipName, setShipName] = useState('');
  const [shipGSTIN, setShipGSTIN] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipStateCode, setShipStateCode] = useState('');

  // 5. Bank & UPI Settlement details
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState(() => localStorage.getItem('smartvyapar_upi_id') || '');
  const [showUpiQr, setShowUpiQr] = useState(true);
  const [showBankingDetails, setShowBankingDetails] = useState(true);

  // Payment Status & Khata
  const [showPaymentKhata, setShowPaymentKhata] = useState(true);
  const [isFullyPaid, setIsFullyPaid] = useState(true);
  const [paidAmount, setPaidAmount] = useState(0);

  // Line items (initialize with 1 ready row for quick entry)
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      hsn: '21069099',
      rate: 0,
      quantity: 1,
      unit: 'CTN',
      gstRate: 5,
      mrp: 0,
      unit1: 'CTN',
      unit2: 'PCS',
      conversionFactor: 1,
      looseQty: 0,
      discount1: 0,
      discount2: 0,
      volDisc1: 0,
      volDisc2: 0,
    }
  ]);

  // Column settings visibility
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState({
    packing: true,
    pcsPerUnit: false, // Optional, toggled on-demand
    mrp: false,
    hsn: false,
    unit1: true, // Default primary quantity column
    unit2: false,
    discount1: false,
    discount2: false,
    volDisc1: false,
    volDisc2: false,
    gst: false,
  });

  // Click outside to dismiss column visibility menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnMenu]);

  // Fetch Catalog Items, Customers and Mahajans
  useEffect(() => {
    const fetchCatalogData = async () => {
      try {
        const itemList = await getItems();
        setCatalogItems(itemList);
      } catch (err) {
        console.error('Failed to load catalog items', err);
      }
    };

    const fetchCustomersData = async () => {
      try {
        const customerList = await getCustomers();
        setCatalogCustomers(customerList);
      } catch (err) {
        console.error('Failed to load catalog customers', err);
      }
    };

    const fetchMahajansData = async () => {
      try {
        const mahajanList = await getMahajans();
        setCatalogMahajans(mahajanList);
      } catch (err) {
        console.error('Failed to load mahajans list', err);
      }
    };

    const fetchInvoicesData = async () => {
      try {
        const invList = await getInvoices();
        setSalesInvoices(invList);
      } catch (err) {
        console.error('Failed to load sales invoices list', err);
      }
    };

    const fetchPurchaseInvoicesData = async () => {
      try {
        const purchList = await getPurchaseInvoices();
        setPurchaseInvoices(purchList);
      } catch (err) {
        console.error('Failed to load purchase invoices list', err);
      }
    };

    const fetchStoreSubpartsData = async () => {
      try {
        const subpartsList = await getStoreSubparts();
        setCatalogStoreSubparts(subpartsList);
      } catch (err) {
        console.error('Failed to load store subparts list', err);
      }
    };

    if (activeCompany) {
      fetchCatalogData();
      fetchCustomersData();
      fetchMahajansData();
      fetchStoreSubpartsData();
      fetchInvoicesData();
      fetchPurchaseInvoicesData();
    }
  }, [activeCompany]);

  // Auto-fill sequential invoice / credit note / debit note number
  useEffect(() => {
    if (loadedInvoice || loadedPurchaseInvoice) return; // Keep existing values in view mode
    
    const fy = getFinancialYear();
    
    // In sales / sale_return / purchase_return modes: determine seller firm initials
    let currentSellerName = activeCompany?.name;
    let currentSellerCode: string | undefined = undefined;

    if (invoiceMode === 'sales' || invoiceMode === 'sale_return' || invoiceMode === 'purchase_return') {
      if (selectedSellerSubpartId) {
        const sp = catalogStoreSubparts.find(x => x.id === selectedSellerSubpartId);
        if (sp) {
          currentSellerName = sp.name;
          currentSellerCode = sp.code || undefined;
        }
      } else if (sellerName) {
        currentSellerName = sellerName;
      }
    }

    const companyInitials = getCompanyPrefix(currentSellerName, currentSellerCode);
    
    let prefix = `${companyInitials}/${fy}/`;
    if (invoiceMode === 'sale_return') {
      prefix = `${companyInitials === 'INV' ? 'CR' : `${companyInitials}-CR`}/${fy}/`;
    } else if (invoiceMode === 'purchase_return') {
      prefix = `${companyInitials === 'INV' ? 'DR' : `${companyInitials}-DR`}/${fy}/`;
    } else if (invoiceMode === 'purchase') {
      prefix = `PUR/${fy}/`;
    }
    
    if (invoiceMode === 'sales' || invoiceMode === 'sale_return') {
      const matchingInvoices = salesInvoices.filter(inv => inv.invoiceNo.startsWith(prefix));
      const maxSeq = matchingInvoices.reduce((max, inv) => {
        const seq = parseInt(inv.invoiceNo.replace(prefix, ''), 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }, matchingInvoices.length);
      setInvoiceNo(`${prefix}${maxSeq + 1}`);
    } else {
      const matchingInvoices = purchaseInvoices.filter(inv => inv.invoiceNo.startsWith(prefix));
      const maxSeq = matchingInvoices.reduce((max, inv) => {
        const seq = parseInt(inv.invoiceNo.replace(prefix, ''), 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }, matchingInvoices.length);
      setInvoiceNo(`${prefix}${maxSeq + 1}`);
    }
  }, [
    invoiceMode, 
    salesInvoices, 
    purchaseInvoices, 
    loadedInvoice, 
    loadedPurchaseInvoice, 
    activeCompany, 
    selectedSellerSubpartId, 
    sellerName, 
    catalogStoreSubparts
  ]);

  // Synchronize seller details with active company changes (in sales / sale_return mode)
  useEffect(() => {
    if (invoiceMode === 'sales' || invoiceMode === 'sale_return') {
      setSellerName(activeCompany?.name || '');
      setSellerGSTIN(activeCompany?.gstin || '');
      setSellerAddress(activeCompany?.address || '');
      setSellerPhone(activeCompany?.phone || '');
      setSellerEmail(activeCompany?.email || '');
      setSellerState('Assam'); // Default standard state
      setSellerStateCode('18');
    }
  }, [activeCompany, invoiceMode]);

  // Load past sales invoice details if loadedInvoice is passed in props
  useEffect(() => {
    if (loadedInvoice) {
      try {
        setInvoiceMode('sales');
        const logistics = JSON.parse(loadedInvoice.logisticsData);
        const itemsList = JSON.parse(loadedInvoice.itemsData);

        setInvoiceNo(loadedInvoice.invoiceNo);
        setInvoiceDate(loadedInvoice.invoiceDate.split('T')[0]);
        setSelectedCustomerId(loadedInvoice.customerId ?? null);
        setTransport(logistics.transport || '');
        setVehicleNo(logistics.vehicleNo || '');
        setStation(logistics.station || '');
        setGrRrNo(logistics.grRrNo || '');
        setFreightAmt(logistics.freightAmt || '');
        setReverseCharge(logistics.reverseCharge || 'N');
        setEwayBillNo(logistics.ewayBillNo || '');
        setOrderNo(logistics.orderNo || '');
        setOrderDate(logistics.orderDate || '');
        setIrn(logistics.irn || '');
        setAckNo(logistics.ackNo || '');
        setAckDate(logistics.ackDate || '');
        setSellerName(logistics.sellerName || '');
        setSellerAddress(logistics.sellerAddress || '');
        setSellerGSTIN(logistics.sellerGSTIN || '');
        setSellerPAN(logistics.sellerPAN || '');
        setSellerFssai(logistics.sellerFssai || '');
        setSellerPhone(logistics.sellerPhone || '');
        setSellerEmail(logistics.sellerEmail || '');
        setSellerState(logistics.sellerState || '');
        setSellerStateCode(logistics.sellerStateCode || '');
        setBuyerName(logistics.buyerName || '');
        setBuyerAddress(logistics.buyerAddress || '');
        setBuyerGSTIN(logistics.buyerGSTIN || '');
        setBuyerPhone(logistics.buyerPhone || '');
        setBuyerState(logistics.buyerState || '');
        setBuyerStateCode(logistics.buyerStateCode || '');
        setBankName(logistics.bankName || '');
        setBankAccountNo(logistics.bankAccountNo || '');
        setBankIfsc(logistics.bankIfsc || '');
        setUpiId(logistics.upiId ?? (localStorage.getItem('smartvyapar_upi_id') || ''));
        if (logistics.showUpiQr !== undefined) setShowUpiQr(logistics.showUpiQr);
        setItems(itemsList);
        
        const loadedPaid = loadedInvoice.paidAmount ?? 0;
        setPaidAmount(loadedPaid);
        setIsFullyPaid(loadedPaid >= loadedInvoice.totalAmount);

        if (onClearLoadedInvoice) onClearLoadedInvoice();
      } catch (e) {
        console.error('Failed to parse loaded sales invoice data', e);
      }
    }
  }, [loadedInvoice, onClearLoadedInvoice]);

  // Load past purchase invoice details if loadedPurchaseInvoice is passed in props
  useEffect(() => {
    if (loadedPurchaseInvoice) {
      try {
        setInvoiceMode('purchase');
        const logistics = JSON.parse(loadedPurchaseInvoice.logisticsData);
        const itemsList = JSON.parse(loadedPurchaseInvoice.itemsData);

        setInvoiceNo(loadedPurchaseInvoice.invoiceNo);
        setInvoiceDate(loadedPurchaseInvoice.invoiceDate.split('T')[0]);
        setSelectedMahajanId(loadedPurchaseInvoice.mahajanId ?? null);
        setTransport(logistics.transport || '');
        setVehicleNo(logistics.vehicleNo || '');
        setStation(logistics.station || '');
        setGrRrNo(logistics.grRrNo || '');
        setFreightAmt(logistics.freightAmt || '');
        setReverseCharge(logistics.reverseCharge || 'N');
        setEwayBillNo(logistics.ewayBillNo || '');
        setOrderNo(logistics.orderNo || '');
        setOrderDate(logistics.orderDate || '');
        setIrn(logistics.irn || '');
        setAckNo(logistics.ackNo || '');
        setAckDate(logistics.ackDate || '');
        setSellerName(logistics.sellerName || '');
        setSellerAddress(logistics.sellerAddress || '');
        setSellerGSTIN(logistics.sellerGSTIN || '');
        setSellerPAN(logistics.sellerPAN || '');
        setSellerFssai(logistics.sellerFssai || '');
        setSellerPhone(logistics.sellerPhone || '');
        setSellerEmail(logistics.sellerEmail || '');
        setSellerState(logistics.sellerState || '');
        setSellerStateCode(logistics.sellerStateCode || '');
        setBuyerName(logistics.buyerName || '');
        setBuyerAddress(logistics.buyerAddress || '');
        setBuyerGSTIN(logistics.buyerGSTIN || '');
        setBuyerPhone(logistics.buyerPhone || '');
        setBuyerState(logistics.buyerState || '');
        setBuyerStateCode(logistics.buyerStateCode || '');
        setBankName(logistics.bankName || '');
        setBankAccountNo(logistics.bankAccountNo || '');
        setBankIfsc(logistics.bankIfsc || '');
        setUpiId(logistics.upiId ?? (localStorage.getItem('smartvyapar_upi_id') || ''));
        if (logistics.showUpiQr !== undefined) setShowUpiQr(logistics.showUpiQr);
        setItems(itemsList);

        const loadedPaid = loadedPurchaseInvoice.paidAmount ?? 0;
        setPaidAmount(loadedPaid);
        setIsFullyPaid(loadedPaid >= loadedPurchaseInvoice.totalAmount);

        if (onClearLoadedPurchaseInvoice) onClearLoadedPurchaseInvoice();
      } catch (e) {
        console.error('Failed to parse loaded purchase invoice data', e);
      }
    }
  }, [loadedPurchaseInvoice, onClearLoadedPurchaseInvoice]);

  // Auto-extract pack size number from name if available (e.g. 20X500G -> 20)
  const parsePackFromName = (name: string): number => {
    const match = name.match(/\b(\d+)\s*[xX]\s*\d+/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0) return num;
    }
    return 1;
  };

  // Handle adding/removing items
  const handleAddItem = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setItems(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        hsn: '21069099',
        rate: 0,
        quantity: 1,
        unit: 'CTN',
        gstRate: 5,
        mrp: 0,
        unit1: 'CTN',
        unit2: 'PCS',
        conversionFactor: 1,
        looseQty: 0,
        discount1: 0,
        discount2: 0,
        volDisc1: 0,
        volDisc2: 0,
      }
    ]);

    // Auto-focus the newly added row product cell
    setTimeout(() => {
      const el = document.getElementById(`cell-${items.length}-name`);
      if (el) {
        el.focus();
      }
    }, 50);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // If name changes, auto-detect packing conversion if currently 1
          if (field === 'name' && typeof value === 'string') {
            const detected = parsePackFromName(value);
            if (detected > 1 && (!updated.conversionFactor || Number(updated.conversionFactor) <= 1)) {
              updated.conversionFactor = detected;
            }
          }
          // If packing changes, try to extract conversionFactor
          if (field === 'packing' && typeof value === 'string') {
            const detected = parsePackFromName(value);
            if (detected > 1) {
              updated.conversionFactor = detected;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSelectCatalogItem = (rowId: string, catalogItem: Item) => {
    const factor = (catalogItem as any).conversionFactor || parsePackFromName(catalogItem.name) || parsePackFromName(catalogItem.unit) || 1;
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === rowId) {
          return {
            ...item,
            name: catalogItem.name,
            rate: catalogItem.rate,
            hsn: catalogItem.hsn || '21069099',
            packing: catalogItem.unit || '',
            unit: catalogItem.unit || item.unit || 'CTN',
            mrp: catalogItem.mrp || 0,
            unit1: item.unit1 || 'CTN',
            unit2: item.unit2 || 'PCS',
            conversionFactor: factor,
            volDisc1: 0,
            volDisc2: 0,
          };
        }
        return item;
      })
    );
  };

  // Keyboard Enter navigation between table cells
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    colName: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const colsOrder = [
        'name',
        visibleColumns.packing ? 'packing' : null,
        visibleColumns.pcsPerUnit ? 'conversionFactor' : null,
        visibleColumns.hsn ? 'hsn' : null,
        visibleColumns.mrp ? 'mrp' : null,
        visibleColumns.unit1 ? 'unit1' : null,
        visibleColumns.unit2 ? 'unit2' : null,
        'rate',
        visibleColumns.discount1 ? 'discount1' : null,
        visibleColumns.discount2 ? 'discount2' : null,
        visibleColumns.volDisc1 ? 'volDisc1' : null,
        visibleColumns.gst ? 'gstRate' : null,
      ].filter(Boolean) as string[];

      const currentColIdx = colsOrder.indexOf(colName);
      if (currentColIdx >= 0 && currentColIdx < colsOrder.length - 1) {
        const nextCol = colsOrder[currentColIdx + 1];
        const nextElem = document.getElementById(`cell-${rowIndex}-${nextCol}`);
        if (nextElem) {
          nextElem.focus();
          if ('select' in nextElem && typeof (nextElem as any).select === 'function') {
            (nextElem as any).select();
          }
        }
      } else {
        // Last column of row - go to next row or add row
        if (rowIndex === items.length - 1) {
          const newId = Math.random().toString(36).substr(2, 9);
          setItems(prev => [
            ...prev,
            {
              id: newId,
              name: '',
              hsn: '21069099',
              rate: 0,
              quantity: 1,
              packing: '',
              unit: 'CTN',
              gstRate: 5,
              mrp: 0,
              unit1: 'CTN',
              unit2: 'PCS',
              conversionFactor: 1,
              looseQty: 0,
              discount1: 0,
              discount2: 0,
              volDisc1: 0,
              volDisc2: 0,
            }
          ]);
          setTimeout(() => {
            const nextRowFirstElem = document.getElementById(`cell-${rowIndex + 1}-name`);
            if (nextRowFirstElem) {
              nextRowFirstElem.focus();
            }
          }, 60);
        } else {
          const nextRowFirstElem = document.getElementById(`cell-${rowIndex + 1}-name`);
          if (nextRowFirstElem) {
            nextRowFirstElem.focus();
            if ('select' in nextRowFirstElem && typeof (nextRowFirstElem as any).select === 'function') {
              (nextRowFirstElem as any).select();
            }
          }
        }
      }
    }
  };

  // Tax check logic
  const isInterstate = sellerStateCode.trim() !== buyerStateCode.trim();

  // ── Calculations — all delegated to the centralised engine ───────────────────
  const calculateTotalQty = () =>
    items.reduce((sum, item) => sum + calculateLineItem(item).packageQty, 0);

  const calculateSubtotal = () =>
    items.reduce((sum, item) => sum + calculateLineItem(item).taxableAmount, 0);

  const calculateTotalGST = () =>
    items.reduce((sum, item) => sum + calculateLineItem(item).gstAmount, 0);

  const calculateGstBreakdown = () => {
    const breakdown: { [key: number]: { base: number; gst: number } } = {};
    items.forEach(item => {
      const calc = calculateLineItem(item);
      const rateKey = Number(item.gstRate) || 0;
      if (!breakdown[rateKey]) breakdown[rateKey] = { base: 0, gst: 0 };
      breakdown[rateKey].base += calc.taxableAmount;
      breakdown[rateKey].gst += calc.gstAmount;
    });
    return breakdown;
  };

  const totalQty = calculateTotalQty();
  const subtotal = calculateSubtotal();
  const totalGst = calculateTotalGST();
  const grandTotal = subtotal + totalGst;
  const roundoff = Math.round(grandTotal) - grandTotal;
  const finalTotal = Math.round(grandTotal);

  // Payable amount for dynamic UPI QR generation (reflects balance due if partial payment)
  const payableAmount = !isFullyPaid && paidAmount > 0 ? Math.max(0, finalTotal - paidAmount) : finalTotal;
  const payeeName = (invoiceMode === 'sales' ? sellerName : buyerName) || activeCompany?.name || 'SmartVyapar Merchant';
  
  // Standard NPCI UPI URI string: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
  const upiUri = upiId.trim()
    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payeeName.trim())}&am=${payableAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNo || 'Bill'}`)}`
    : '';

  // Subpart / Store Buyer Creation Handler
  const handleSaveSubpart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subpartForm.name.trim()) {
      setSubpartError('Buyer / Business Firm name is required');
      return;
    }
    setIsSavingSubpart(true);
    setSubpartError(null);
    try {
      const created = await createStoreSubpart({
        name: subpartForm.name.trim(),
        code: subpartForm.code.trim() || undefined,
        gstin: subpartForm.gstin.trim() || undefined,
        phone: subpartForm.phone.trim() || undefined,
        address: subpartForm.address.trim() || undefined,
        state: subpartForm.state.trim() || undefined,
        stateCode: subpartForm.stateCode.trim() || undefined,
      });
      setCatalogStoreSubparts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedBuyerSubpartId(created.id);
      setBuyerName(created.name);
      setBuyerGSTIN(created.gstin || activeCompany?.gstin || '');
      setBuyerAddress(created.address || activeCompany?.address || '');
      setBuyerPhone(created.phone || activeCompany?.phone || '');
      setBuyerState(created.state || 'Assam');
      setBuyerStateCode(created.stateCode || '18');
      setShowAddSubpartModal(false);
    } catch (err: any) {
      setSubpartError(err.response?.data?.message || 'Failed to create store subpart');
    } finally {
      setIsSavingSubpart(false);
    }
  };

  // Save & Archive Invoice (Sales → Customer profile | Purchase → Mahajan profile)
  const handleSaveInvoice = async () => {
    setIsArchiving(true);
    setArchiveError(null);
    setArchiveSuccess(null);

    const logisticsPayload = {
      docType: invoiceMode,
      returnStatus: (invoiceMode === 'sale_return' || invoiceMode === 'purchase_return') ? 'PENDING' : 'CONFIRMED',
      originalInvoiceNo,
      originalInvoiceDate,
      reasonForReturn,
      transport, vehicleNo, station, grRrNo, freightAmt, reverseCharge,
      ewayBillNo, orderNo, orderDate, irn, ackNo, ackDate,
      bankName, bankAccountNo, bankIfsc,
      upiId, showUpiQr,
      showBankingDetails, showPaymentKhata,
      sellerName, sellerAddress, sellerGSTIN, sellerPAN, sellerFssai,
      sellerPhone, sellerEmail, sellerState, sellerStateCode,
      buyerName, buyerAddress, buyerGSTIN, buyerPhone, buyerEmail,
      buyerState, buyerStateCode,
      buyerSubpartId: selectedBuyerSubpartId || null,
      sellerSubpartId: selectedSellerSubpartId || null,
    };

    try {
      if (invoiceMode === 'purchase' || invoiceMode === 'purchase_return') {
        // --- PURCHASE / PURCHASE RETURN MODE: save to Mahajan profile ---
        let mahajanId = selectedMahajanId || undefined;

        // Auto-create mahajan profile from SELLER fields (seller = the supplier)
        if (!mahajanId && sellerName.trim()) {
          try {
            const newMahajan = await createMahajan({
              name: sellerName.trim(),
              gstin: sellerGSTIN.trim() || undefined,
              phone: sellerPhone.trim() || undefined,
              address: sellerAddress.trim() || undefined,
              state: sellerState.trim() || undefined,
              stateCode: sellerStateCode.trim() || undefined,
            });
            mahajanId = newMahajan.id;
          } catch {
            // Profile creation failed — still save invoice without linking
          }
        }

        await createPurchaseInvoice({
          mahajanId,
          buyerSubpartId: selectedBuyerSubpartId || undefined,
          invoiceNo: invoiceNo.trim(),
          invoiceDate: new Date(invoiceDate).toISOString(),
          totalAmount: finalTotal,
          paidAmount: isFullyPaid ? finalTotal : Number(paidAmount) || 0,
          subtotal,
          totalGst,
          isInterstate,
          logisticsData: JSON.stringify(logisticsPayload),
          itemsData: JSON.stringify(items),
        });

        const successText = invoiceMode === 'purchase_return'
          ? `Debit Note (Purchase Return) ${invoiceNo} saved to Supplier ledger!`
          : `Purchase Invoice ${invoiceNo} saved to Supplier purchase ledger!`;
        setArchiveSuccess(successText);

        // Refresh mahajans list and purchase invoices (to update sequential numbering)
        try {
          const [mahajanList, purchList, subpartsList] = await Promise.all([
            getMahajans(),
            getPurchaseInvoices(),
            getStoreSubparts()
          ]);
          setCatalogMahajans(mahajanList);
          setPurchaseInvoices(purchList);
          setCatalogStoreSubparts(subpartsList);
          if (mahajanId) setSelectedMahajanId(mahajanId);
        } catch { /* silent */ }

      } else {
        // --- SALES / SALE RETURN MODE: save to Customer profile ---
        const savedInvoice = await createInvoice({
          customerId: selectedCustomerId || undefined,
          invoiceNo: invoiceNo.trim(),
          invoiceDate: new Date(invoiceDate).toISOString(),
          totalAmount: finalTotal,
          paidAmount: isFullyPaid ? finalTotal : Number(paidAmount) || 0,
          subtotal,
          totalGst,
          isInterstate,
          logisticsData: JSON.stringify(logisticsPayload),
          itemsData: JSON.stringify(items),
        });

        const successText = invoiceMode === 'sale_return'
          ? `Credit Note (Sale Return) ${invoiceNo} successfully archived to Customer Profile!`
          : `Invoice ${invoiceNo} successfully archived to Customer Profile!`;
        setArchiveSuccess(successText);

        // Refresh customers list and sales invoices (to update sequential numbering)
        try {
          const [customerList, invList] = await Promise.all([
            getCustomers(),
            getInvoices()
          ]);
          setCatalogCustomers(customerList);
          setSalesInvoices(invList);
          if (savedInvoice.customerId) setSelectedCustomerId(savedInvoice.customerId);
        } catch { /* silent */ }
      }
    } catch (err: any) {
      setArchiveError(err.response?.data?.message || 'Failed to archive invoice.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Format money helper
  const formatINR = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amt);
  };

  // WhatsApp 1-Click Invoice Sharing Handler
  const handleShareWhatsApp = () => {
    const isPurch = invoiceMode === 'purchase' || invoiceMode === 'purchase_return';
    const targetPhone = isPurch ? sellerPhone : buyerPhone;
    const targetName = (isPurch ? sellerName : buyerName) || 'Party';
    const compName = (isPurch ? buyerName : sellerName) || activeCompany?.name || 'SmartVyapar';

    const msg = generateInvoiceWhatsAppMessage({
      companyName: compName,
      invoiceNo: invoiceNo || 'Draft',
      invoiceDate,
      customerName: targetName,
      customerPhone: targetPhone || undefined,
      items: items.map(i => ({ name: i.name, quantity: Number(i.quantity) || 1, unit: i.unit, rate: Number(i.rate) || 0 })),
      totalAmount: finalTotal,
      paidAmount: isFullyPaid ? finalTotal : Number(paidAmount) || 0,
      upiId,
      bankName,
      bankAccountNo,
      bankIfsc,
      docType: invoiceMode,
    });

    const invoiceData = {
      invoiceNo: invoiceNo || 'Draft',
      invoiceDate,
      docType: invoiceMode,
      originalInvoiceNo,
      originalInvoiceDate,
      reasonForReturn,
      sellerName,
      sellerAddress,
      sellerGSTIN,
      sellerPhone,
      sellerEmail,
      sellerState,
      sellerStateCode,
      sellerPAN,
      sellerFssai,
      buyerName,
      buyerAddress,
      buyerGSTIN,
      buyerPhone,
      buyerState,
      buyerStateCode,
      items,
      subtotal,
      totalGst,
      totalAmount: finalTotal,
      paidAmount: isFullyPaid ? finalTotal : Number(paidAmount) || 0,
      isInterstate,
      upiId,
      bankName,
      bankAccountNo,
      bankIfsc,
      transport,
      vehicleNo,
      station,
      grRrNo,
      reverseCharge,
      freightAmt,
      ewayBillNo,
      orderNo,
      orderDate,
      irn,
      ackNo,
      ackDate,
      visibleColumns,
      showBankingDetails,
      showPaymentKhata,
    };

    setWhatsAppModalPayload({
      phone: targetPhone || '',
      name: targetName,
      message: msg,
      invoiceData,
    });
    setShowWhatsAppModal(true);
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto p-4 md:p-6 space-y-6">
      
      {/* Tab Header Controls - Hidden in print */}
      <div className="print:hidden flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <FileText className="text-[#004870]" />
              Tax Invoice &amp; Billing Generator
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Generate A4 Tax Invoices with GST/IGST splits. Toggle between Sales (Customer) and Purchase (Supplier) modes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              type="button"
              disabled={isArchiving || items.length === 0}
              onClick={handleSaveInvoice}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50 ${
                invoiceMode === 'sale_return' 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : invoiceMode === 'purchase_return'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : invoiceMode === 'purchase' 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save size={15} />
              {isArchiving 
                ? 'Saving...' 
                : invoiceMode === 'sale_return' 
                ? 'Save Credit Note (Sale Return)' 
                : invoiceMode === 'purchase_return' 
                ? 'Save Debit Note (Purchase Return)' 
                : invoiceMode === 'purchase' 
                ? 'Save to Supplier Ledger' 
                : 'Save & Archive Invoice'}
            </button>
            
            <button 
              type="button"
              disabled={items.length === 0}
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50"
            >
              <MessageCircle size={15} />
              Share on WhatsApp
            </button>

            <button 
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer"
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* 4-Way Document Type Mode Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Document Type:</span>
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            {/* 1. Sales Invoice */}
            <button
              type="button"
              onClick={() => {
                setInvoiceMode('sales');
                setSelectedMahajanId(null);
                setSellerName(activeCompany?.name || '');
                setSellerGSTIN(activeCompany?.gstin || '');
                setSellerAddress(activeCompany?.address || '');
                setSellerPhone(activeCompany?.phone || '');
                setSellerState('Assam');
                setSellerStateCode('18');
                setBuyerName('');
                setBuyerGSTIN('');
                setBuyerAddress('');
                setBuyerPhone('');
                setBuyerEmail('');
                setBuyerState('');
                setBuyerStateCode('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceMode === 'sales'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText size={13} /> Sales Invoice
            </button>

            {/* 2. Sale Return (Credit Note) */}
            <button
              type="button"
              onClick={() => {
                setInvoiceMode('sale_return');
                setSelectedMahajanId(null);
                setSellerName(activeCompany?.name || '');
                setSellerGSTIN(activeCompany?.gstin || '');
                setSellerAddress(activeCompany?.address || '');
                setSellerPhone(activeCompany?.phone || '');
                setSellerState('Assam');
                setSellerStateCode('18');
                setBuyerName('');
                setBuyerGSTIN('');
                setBuyerAddress('');
                setBuyerPhone('');
                setBuyerEmail('');
                setBuyerState('');
                setBuyerStateCode('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceMode === 'sale_return'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-600 hover:text-purple-900 hover:bg-purple-50'
              }`}
            >
              <RotateCcw size={13} /> Sale Return (Credit Note)
            </button>

            {/* 3. Purchase Invoice */}
            <button
              type="button"
              onClick={() => {
                setInvoiceMode('purchase');
                setSelectedCustomerId(null);
                setSellerName('');
                setSellerGSTIN('');
                setSellerAddress('');
                setSellerPhone('');
                setSellerEmail('');
                setSellerState('');
                setSellerStateCode('');
                setSelectedMahajanId(null);
                if (!selectedBuyerSubpartId && !buyerName) {
                  setBuyerName(activeCompany?.name || '');
                  setBuyerGSTIN(activeCompany?.gstin || '');
                  setBuyerAddress(activeCompany?.address || '');
                  setBuyerPhone(activeCompany?.phone || '');
                  setBuyerState('Assam');
                  setBuyerStateCode('18');
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceMode === 'purchase'
                  ? 'bg-orange-500 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileCheck size={13} /> Purchase Invoice
            </button>

            {/* 4. Purchase Return (Debit Note) */}
            <button
              type="button"
              onClick={() => {
                setInvoiceMode('purchase_return');
                setSelectedCustomerId(null);
                setSellerName('');
                setSellerGSTIN('');
                setSellerAddress('');
                setSellerPhone('');
                setSellerEmail('');
                setSellerState('');
                setSellerStateCode('');
                setSelectedMahajanId(null);
                if (!selectedBuyerSubpartId && !buyerName) {
                  setBuyerName(activeCompany?.name || '');
                  setBuyerGSTIN(activeCompany?.gstin || '');
                  setBuyerAddress(activeCompany?.address || '');
                  setBuyerPhone(activeCompany?.phone || '');
                  setBuyerState('Assam');
                  setBuyerStateCode('18');
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceMode === 'purchase_return'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 hover:text-rose-900 hover:bg-rose-50'
              }`}
            >
              <CornerDownLeft size={13} /> Purchase Return (Debit Note)
            </button>
          </div>

          {invoiceMode === 'sale_return' && (
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg animate-fade-in">
              🔄 Creating GST Credit Note (Reduces Customer Debt)
            </span>
          )}
          {invoiceMode === 'purchase_return' && (
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg animate-fade-in">
              ↩️ Creating GST Debit Note (Reduces Supplier Payable)
            </span>
          )}
          {invoiceMode === 'purchase' && (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg animate-fade-in">
              Saving to Supplier Purchase Ledger
            </span>
          )}
          {invoiceMode === 'sales' && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg animate-fade-in">
              Saving to Customer Profiles
            </span>
          )}
        </div>
      </div>

      {archiveSuccess && (
        <div className="print:hidden bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <CheckCircle size={15} />
          {archiveSuccess}
        </div>
      )}

      {archiveError && (
        <div className="print:hidden bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle size={15} />
          {archiveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Datalist for Product Autocomplete suggestions */}
        {catalogItems.length > 0 && (
          <datalist id="catalog-suggestions">
            {catalogItems.map(c => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        )}
        
        {/* LEFT PANEL: INPUT BUILDER PANEL - Hidden in print */}
        <div className="print:hidden lg:col-span-4 space-y-6">
          
          {/* Section 1: E-Invoice Logistics Meta Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Truck size={14} className="text-[#004870]" /> 1. Shipping & Logistics Meta
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Invoice Number</label>
                <input 
                  type="text" 
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Invoice Date</label>
                <input 
                  type="date" 
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transport Company</label>
                <input 
                  type="text" 
                  placeholder="e.g. HARLALKA ROADLINES"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. HR38U9476"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Station / Destination</label>
                <input 
                  type="text" 
                  placeholder="e.g. KAMTAUL"
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GR / RR Number</label>
                <input 
                  type="text" 
                  placeholder="GR Number"
                  value={grRrNo}
                  onChange={(e) => setGrRrNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight Status / Charge</label>
                <input 
                  type="text" 
                  placeholder="Freight Amt / To Pay"
                  value={freightAmt}
                  onChange={(e) => setFreightAmt(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reverse Charge (Y/N)</label>
                <select 
                  value={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="N">No (N)</option>
                  <option value="Y">Yes (Y)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">E-Way Bill No.</label>
                <input 
                  type="text" 
                  placeholder="12-digit E-Way Bill"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Order Number</label>
                <input 
                  type="text" 
                  placeholder="Order #"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Order Date</label>
                <input 
                  type="date" 
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Return / Credit Note / Debit Note Specific Details */}
            {(invoiceMode === 'sale_return' || invoiceMode === 'purchase_return') && (
              <div className="border-t border-slate-100 pt-3 space-y-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200/60 animate-in fade-in duration-150">
                <h4 className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw size={12} /> Original Invoice Reference (GST Section 34)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Original Invoice No.</label>
                    <input 
                      type="text" 
                      placeholder="e.g. TE/26-27/45"
                      value={originalInvoiceNo}
                      onChange={(e) => setOriginalInvoiceNo(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Original Invoice Date</label>
                    <input 
                      type="date" 
                      value={originalInvoiceDate}
                      onChange={(e) => setOriginalInvoiceDate(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Reason for Return</label>
                    <select
                      value={reasonForReturn}
                      onChange={(e) => setReasonForReturn(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Damaged / Defective Goods">Damaged / Defective Goods</option>
                      <option value="Expired Batch">Expired Batch / Shelf Life</option>
                      <option value="Quality Mismatch">Quality Mismatch / Wrong Item Received</option>
                      <option value="Rate Difference / Price Correction">Rate Difference / Price Correction</option>
                      <option value="Excess Supply Returned">Excess Supply Returned</option>
                      <option value="Order Cancelled by Customer">Order Cancelled by Customer</option>
                      <option value="Other Commercial Return">Other Commercial Return</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Mock e-Invoice Parameters</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">IRN (Invoice Reference Number)</label>
                  <input 
                    type="text" 
                    placeholder="64-character IRN Hash"
                    value={irn}
                    onChange={(e) => setIrn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[9px] font-mono text-slate-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Ack Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1122334455"
                      value={ackNo}
                      onChange={(e) => setAckNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[9px] font-semibold text-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Ack Date</label>
                    <input 
                      type="date" 
                      value={ackDate}
                      onChange={(e) => setAckDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[9px] font-semibold text-slate-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Seller & Buyer Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2">2. Billing Identities</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Seller details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-extrabold text-[#004870] flex items-center gap-1 uppercase tracking-wider">
                  <Building size={12} /> {
                    invoiceMode === 'purchase' ? 'Seller / Supplier (Vendor)' :
                    invoiceMode === 'purchase_return' ? 'Supplier / Vendor (Returning To)' :
                    invoiceMode === 'sale_return' ? 'Seller / Receiving Farm or Branch' :
                    'Seller (Store / Farm Info)'
                  }
                </h4>

                {/* In Sales & Sale Return modes: Store Subpart / Multiple Sellers / Farm selector */}
                {(invoiceMode === 'sales' || invoiceMode === 'sale_return') && (
                  <div className="space-y-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                        <Building size={11} className="text-[#004870]" /> Seller Profile / Farm / Branch
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSubpartForm({
                            name: '',
                            code: '',
                            gstin: activeCompany?.gstin || '',
                            phone: activeCompany?.phone || '',
                            address: activeCompany?.address || '',
                            state: 'Assam',
                            stateCode: '18',
                          });
                          setSubpartError(null);
                          setShowAddSubpartModal(true);
                        }}
                        className="text-[10px] font-bold text-[#004870] hover:text-[#003858] bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus size={10} /> + Add Farm / Firm
                      </button>
                    </div>

                    <select
                      value={selectedSellerSubpartId || ''}
                      onChange={(e) => {
                        const subId = e.target.value;
                        if (!subId) {
                          setSelectedSellerSubpartId(null);
                          setSellerName('');
                          setSellerGSTIN('');
                          setSellerAddress('');
                          setSellerPhone('');
                          setSellerEmail('');
                          setSellerState('');
                          setSellerStateCode('');
                        } else if (subId === '__MAIN_STORE__') {
                          setSelectedSellerSubpartId(null);
                          setSellerName(activeCompany?.name || '');
                          setSellerGSTIN(activeCompany?.gstin || '');
                          setSellerAddress(activeCompany?.address || '');
                          setSellerPhone(activeCompany?.phone || '');
                          setSellerEmail(activeCompany?.email || '');
                          setSellerState('Assam');
                          setSellerStateCode('18');
                        } else {
                          const sp = catalogStoreSubparts.find(x => x.id === subId);
                          if (sp) {
                            setSelectedSellerSubpartId(sp.id);
                            setSellerName(sp.name);
                            setSellerGSTIN(sp.gstin || activeCompany?.gstin || '');
                            setSellerAddress(sp.address || activeCompany?.address || '');
                            setSellerPhone(sp.phone || activeCompany?.phone || '');
                            setSellerState(sp.state || 'Assam');
                            setSellerStateCode(sp.stateCode || '18');
                          }
                        }
                      }}
                      className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-[#004870] cursor-pointer"
                    >
                      <option value="">-- Custom / Typed Seller Firm --</option>
                      <option value="__MAIN_STORE__">🏢 Primary Store ({activeCompany?.name || 'Main Store'})</option>
                      {catalogStoreSubparts.map(sp => (
                        <option key={sp.id} value={sp.id}>
                          📦 {sp.name} {sp.code ? `[${sp.code}]` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="text-[10px] font-medium text-blue-700/80">
                      💡 {invoiceMode === 'sale_return' ? 'Credit Note & items will be credited under this farm/firm.' : 'Sales & items will be recorded under this seller/firm in the Customer Ledger.'}
                    </div>
                  </div>
                )}

                {/* In Purchase & Purchase Return modes: show Supplier dropdown in SELLER section */}
                {(invoiceMode === 'purchase' || invoiceMode === 'purchase_return') && catalogMahajans.length > 0 && (
                  <div>
                    <select
                      onChange={(e) => {
                        const mId = e.target.value;
                        if (!mId) {
                          setSelectedMahajanId(null);
                          return;
                        }
                        const m = catalogMahajans.find(x => x.id === mId);
                        if (m) {
                          setSelectedMahajanId(m.id);
                          setSellerName(m.name);
                          setSellerGSTIN(m.gstin || '');
                          setSellerPhone(m.phone || '');
                          setSellerEmail(m.email || '');
                          setSellerAddress(m.address || '');
                          setSellerState(m.state || '');
                          setSellerStateCode(m.stateCode || '');
                        }
                      }}
                      value={selectedMahajanId || ''}
                      className="w-full bg-orange-50/60 border border-orange-200 rounded-lg p-2 text-xs font-bold text-orange-800 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Existing Supplier --</option>
                      {catalogMahajans.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <input 
                    type="text" 
                    placeholder={(invoiceMode === 'purchase' || invoiceMode === 'purchase_return') ? 'Supplier / Vendor Name' : 'Seller Name'}
                    value={sellerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSellerName(val);
                      // In purchase / purchase return mode, auto-link to Supplier if name matches
                      if (invoiceMode === 'purchase' || invoiceMode === 'purchase_return') {
                        const match = catalogMahajans.find(m => m.name.toLowerCase() === val.trim().toLowerCase());
                        if (match) {
                          setSelectedMahajanId(match.id);
                        } else {
                          setSelectedMahajanId(null);
                        }
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="FSSAI Lic#"
                    value={sellerFssai}
                    onChange={(e) => setSellerFssai(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="PAN Number"
                    value={sellerPAN}
                    onChange={(e) => setSellerPAN(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Seller Phone"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Seller Email"
                    value={sellerEmail}
                    onChange={(e) => setSellerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="Seller GSTIN"
                    value={sellerGSTIN}
                    onChange={(e) => setSellerGSTIN(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <input 
                    type="text" 
                    placeholder="State"
                    value={sellerState}
                    onChange={(e) => setSellerState(e.target.value)}
                    className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Code"
                    value={sellerStateCode}
                    onChange={(e) => setSellerStateCode(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <textarea 
                    placeholder="Seller Address"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Buyer details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-extrabold text-amber-600 flex items-center gap-1 uppercase tracking-wider">
                  <User size={12} /> {
                    invoiceMode === 'purchase' ? 'Buyer / Receiving Farm or Branch (Billed To)' :
                    invoiceMode === 'purchase_return' ? 'Buyer / Returning Farm or Branch (Debit From)' :
                    invoiceMode === 'sale_return' ? 'Customer / Returning Buyer (Credit To)' :
                    'Buyer / Customer (Billed To)'
                  }
                </h4>

                {/* In purchase & purchase return mode: Store Subpart / Multiple Buyers / Farm selector */}
                {(invoiceMode === 'purchase' || invoiceMode === 'purchase_return') && (
                  <div className="space-y-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                        <Building size={11} className="text-[#004870]" /> Buyer Profile / Farm / Branch
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSubpartForm({
                            name: '',
                            code: '',
                            gstin: activeCompany?.gstin || '',
                            phone: activeCompany?.phone || '',
                            address: activeCompany?.address || '',
                            state: 'Assam',
                            stateCode: '18',
                          });
                          setSubpartError(null);
                          setShowAddSubpartModal(true);
                        }}
                        className="text-[10px] font-bold text-[#004870] hover:text-[#003858] bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus size={10} /> + Add Farm / Firm
                      </button>
                    </div>

                    <select
                      value={selectedBuyerSubpartId || ''}
                      onChange={(e) => {
                        const subId = e.target.value;
                        if (!subId) {
                          setSelectedBuyerSubpartId(null);
                          setBuyerName('');
                          setBuyerGSTIN('');
                          setBuyerAddress('');
                          setBuyerPhone('');
                          setBuyerState('');
                          setBuyerStateCode('');
                        } else if (subId === '__MAIN_STORE__') {
                          setSelectedBuyerSubpartId(null);
                          setBuyerName(activeCompany?.name || '');
                          setBuyerGSTIN(activeCompany?.gstin || '');
                          setBuyerAddress(activeCompany?.address || '');
                          setBuyerPhone(activeCompany?.phone || '');
                          setBuyerEmail(activeCompany?.email || '');
                          setBuyerState('Assam');
                          setBuyerStateCode('18');
                        } else {
                          const sp = catalogStoreSubparts.find(x => x.id === subId);
                          if (sp) {
                            setSelectedBuyerSubpartId(sp.id);
                            setBuyerName(sp.name);
                            setBuyerGSTIN(sp.gstin || activeCompany?.gstin || '');
                            setBuyerAddress(sp.address || activeCompany?.address || '');
                            setBuyerPhone(sp.phone || activeCompany?.phone || '');
                            setBuyerState(sp.state || 'Assam');
                            setBuyerStateCode(sp.stateCode || '18');
                          }
                        }
                      }}
                      className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-[#004870] cursor-pointer"
                    >
                      <option value="">-- Custom / Typed Buyer Firm --</option>
                      <option value="__MAIN_STORE__">🏢 Primary Store ({activeCompany?.name || 'Main Store'})</option>
                      {catalogStoreSubparts.map(sp => (
                        <option key={sp.id} value={sp.id}>
                          📦 {sp.name} {sp.code ? `[${sp.code}]` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="text-[10px] font-medium text-blue-700/80">
                      💡 {invoiceMode === 'purchase_return' ? 'Debit Note & items will be recorded from this farm/branch in the Supplier Ledger.' : 'Purchases & items will be recorded under this buyer/farm in the Supplier Ledger.'}
                    </div>
                  </div>
                )}

                {/* Show Customer selector in Sales and Sale Return modes */}
                {(invoiceMode === 'sales' || invoiceMode === 'sale_return') && catalogCustomers.length > 0 && (
                  <div>
                    <select
                      onChange={(e) => {
                        const custId = e.target.value;
                        if (!custId) {
                          setSelectedCustomerId(null);
                          return;
                        }
                        const cust = catalogCustomers.find(c => c.id === custId);
                        if (cust) {
                          setSelectedCustomerId(cust.id);
                          setBuyerName(cust.name);
                          setBuyerGSTIN(cust.gstin || '');
                          setBuyerPhone(cust.phone || '');
                          setBuyerEmail(cust.email || '');
                          setBuyerAddress(cust.address || '');
                          setBuyerState(cust.state || '');
                          setBuyerStateCode(cust.stateCode || '');
                        }
                      }}
                      value={selectedCustomerId || ''}
                      className="w-full bg-amber-50/60 border border-amber-200 rounded-lg p-2 text-xs font-bold text-amber-800 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Existing Customer --</option>
                      {catalogCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <input 
                    type="text" 
                    placeholder="Buyer Name"
                    value={buyerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuyerName(val);
                      if (invoiceMode === 'purchase' || invoiceMode === 'purchase_return') {
                        const match = catalogStoreSubparts.find(sp => sp.name.toLowerCase() === val.trim().toLowerCase());
                        if (match) {
                          setSelectedBuyerSubpartId(match.id);
                        } else {
                          setSelectedBuyerSubpartId(null);
                        }
                      } else {
                        const match = catalogCustomers.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
                        if (match) {
                          setSelectedCustomerId(match.id);
                        } else {
                          setSelectedCustomerId(null);
                        }
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="Buyer GSTIN"
                    value={buyerGSTIN}
                    onChange={(e) => setBuyerGSTIN(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="Buyer Phone"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <input 
                    type="text" 
                    placeholder="State"
                    value={buyerState}
                    onChange={(e) => setBuyerState(e.target.value)}
                    className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Code"
                    value={buyerStateCode}
                    onChange={(e) => setBuyerStateCode(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <textarea 
                    placeholder="Buyer Address"
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Consignee (Shipped To) details */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">
                  Consignee / Shipped To
                </h4>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-500">
                  <input 
                    type="checkbox" 
                    checked={useDifferentShipping}
                    onChange={(e) => setUseDifferentShipping(e.target.checked)}
                  />
                  Ship to different location
                </label>
              </div>

              {useDifferentShipping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Shipping Recipient Name"
                      value={shipName}
                      onChange={(e) => setShipName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Shipping GSTIN"
                      value={shipGSTIN}
                      onChange={(e) => setShipGSTIN(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      <input 
                        type="text" 
                        placeholder="State"
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                        className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Code"
                        value={shipStateCode}
                        onChange={(e) => setShipStateCode(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <textarea 
                      placeholder="Shipping Address & Details"
                      value={shipAddress}
                      onChange={(e) => setShipAddress(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none h-full min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Bank & UPI Settlement Details */}
          <div className={`bg-white p-6 rounded-2xl border transition-all ${showBankingDetails ? 'border-slate-200 shadow-sm' : 'border-slate-200/60 bg-slate-50/50'} space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <FileCheck size={15} className="text-[#004870]" /> 3. Banking &amp; UPI Settlement
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">(Optional)</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg border border-slate-250 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={showBankingDetails}
                  onChange={(e) => setShowBankingDetails(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#004870] rounded cursor-pointer"
                />
                Include on Bill
              </label>
            </div>

            {showBankingDetails ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex justify-end">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 select-none">
                    <input
                      type="checkbox"
                      checked={showUpiQr}
                      onChange={(e) => setShowUpiQr(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                    />
                    Print Dynamic UPI QR
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* UPI ID / VPA field */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      UPI ID / VPA (for Instant QR Payment on Bill)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="e.g. 8340288563@okbizaxis or merchant@upi"
                        value={upiId}
                        onChange={(e) => {
                          setUpiId(e.target.value);
                          localStorage.setItem('smartvyapar_upi_id', e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                      />
                      <QrCode size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[9.5px]">
                      <span className="text-slate-400">
                        NPCI dynamic QR with exact payable amount (₹{payableAmount.toFixed(2)})
                      </span>
                      {upiId.trim() && (
                        <span className="text-emerald-600 font-bold">✓ UPI Linked</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Bank Name</label>
                    <input 
                      type="text" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">A/C Number</label>
                    <input 
                      type="text" 
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">IFSC Code</label>
                    <input 
                      type="text" 
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-medium text-slate-500 italic py-1">
                Banking &amp; UPI details are excluded from this invoice bill print/PDF.
              </div>
            )}
          </div>

          {/* Section 4: Payment Status & Khata */}
          <div className={`bg-white p-6 rounded-2xl border transition-all ${showPaymentKhata ? 'border-slate-200 shadow-sm' : 'border-slate-200/60 bg-slate-50/50'} space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1">
                  <FileText size={15} className="text-[#004870]" /> 4. Payment Status &amp; Khata
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">(Optional)</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg border border-slate-250 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={showPaymentKhata}
                  onChange={(e) => setShowPaymentKhata(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#004870] rounded cursor-pointer"
                />
                Include on Bill
              </label>
            </div>

            {showPaymentKhata ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                  <input 
                    type="checkbox" 
                    checked={isFullyPaid}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsFullyPaid(checked);
                      if (checked) {
                        setPaidAmount(finalTotal);
                      } else {
                        setPaidAmount(0);
                      }
                    }}
                    className="w-4 h-4 text-[#004870] focus:ring-[#004870] rounded border-slate-350 cursor-pointer"
                  />
                  Mark as Fully Paid (₹{finalTotal.toFixed(2)})
                </label>

                {!isFullyPaid && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Amount Paid (₹)</label>
                      <input 
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 1000"
                        value={paidAmount || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPaidAmount(val);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Balance Debt Due (₹)</label>
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 text-xs font-extrabold text-rose-600">
                        ₹{(finalTotal - paidAmount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] font-medium text-slate-500 italic py-1">
                Payment status &amp; Khata debt breakdown are excluded from this invoice bill print/PDF.
              </div>
            )}
          </div>

        </div>

        {/* RIGHT PANEL: PRINT SHEET PREVIEW (Fidelity Tax Invoice Output) */}
        <div className="lg:col-span-8 sticky top-6 bg-white rounded-2xl border border-slate-350 shadow-xl p-6 md:p-8 print:p-0 print:border-none print:shadow-none print:w-full">
          
          <div id="printable-tax-invoice" className="border-[1.5px] border-slate-900 text-slate-900 font-sans text-[10px] leading-tight select-text bg-white">
            
            {/* 1. IRN / Acknowledgment Header Grid */}
            {irn || ackNo ? (
              <div className="grid grid-cols-12 border-b border-slate-900">
                <div className="col-span-8 p-2 border-r border-slate-900 space-y-1 text-left">
                  <div className={`text-sm font-black tracking-wider uppercase ${invoiceMode === 'sale_return' ? 'text-purple-950' : invoiceMode === 'purchase_return' ? 'text-rose-950' : 'text-slate-900'}`}>
                    {invoiceMode === 'sale_return' ? 'CREDIT NOTE' : invoiceMode === 'purchase_return' ? 'DEBIT NOTE' : invoiceMode === 'purchase' ? 'PURCHASE INVOICE' : 'SALE INVOICE'}
                  </div>
                  <div className="text-[8px] font-bold text-slate-500">
                    {invoiceMode === 'sale_return' ? 'ORIGINAL FOR RECIPIENT / (SALE RETURN - SEC 34)' : invoiceMode === 'purchase_return' ? 'ORIGINAL FOR SUPPLIER / (PURCHASE RETURN - SEC 34)' : 'ORIGINAL FOR RECIPIENT'}
                  </div>
                  {irn && (
                    <div className="text-[8px] leading-tight break-all font-mono">
                      <span className="font-bold text-slate-900">IRN: </span>
                      {irn}
                    </div>
                  )}
                </div>
                
                {/* Mock e-Invoice QR Code placeholder */}
                <div className="col-span-4 p-2 flex items-center justify-between gap-2">
                  <div className="text-[8px] leading-normal text-right font-medium">
                    {ackNo && <div><span className="font-bold">Ack No:</span> {ackNo}</div>}
                    {ackDate && <div><span className="font-bold">Ack Date:</span> {new Date(ackDate).toLocaleDateString('en-IN')}</div>}
                  </div>
                  
                  {/* SVG mock QR Code */}
                  <div className="w-12 h-12 border border-slate-900 p-0.5 flex-shrink-0 bg-slate-50">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                      <rect width="100" height="100" fill="white" />
                      {/* Anchor square top-left */}
                      <rect x="5" y="5" width="25" height="25" fill="currentColor" />
                      <rect x="10" y="10" width="15" height="15" fill="white" />
                      <rect x="13" y="13" width="9" height="9" fill="currentColor" />
                      {/* Anchor square top-right */}
                      <rect x="70" y="5" width="25" height="25" fill="currentColor" />
                      <rect x="75" y="10" width="15" height="15" fill="white" />
                      <rect x="78" y="13" width="9" height="9" fill="currentColor" />
                      {/* Anchor square bottom-left */}
                      <rect x="5" y="70" width="25" height="25" fill="currentColor" />
                      <rect x="10" y="75" width="15" height="15" fill="white" />
                      <rect x="13" y="78" width="9" height="9" fill="currentColor" />
                      {/* Random QR code pixels */}
                      <rect x="35" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="50" y="5" width="10" height="15" fill="currentColor" />
                      <rect x="40" y="25" width="15" height="10" fill="currentColor" />
                      <rect x="70" y="35" width="15" height="15" fill="currentColor" />
                      <rect x="35" y="75" width="15" height="15" fill="currentColor" />
                      <rect x="55" y="65" width="25" height="10" fill="currentColor" />
                      <rect x="85" y="85" width="10" height="10" fill="currentColor" />
                      <rect x="65" y="80" width="10" height="15" fill="currentColor" />
                      <rect x="50" y="45" width="10" height="10" fill="currentColor" />
                      <rect x="15" y="45" width="15" height="10" fill="currentColor" />
                      <rect x="5" y="58" width="10" height="8" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-3 text-center border-b border-slate-900 space-y-0.5 ${invoiceMode === 'sale_return' ? 'bg-purple-50/50' : invoiceMode === 'purchase_return' ? 'bg-rose-50/50' : ''}`}>
                <div className={`text-sm font-black tracking-widest uppercase ${invoiceMode === 'sale_return' ? 'text-purple-950' : invoiceMode === 'purchase_return' ? 'text-rose-950' : 'text-slate-900'}`}>
                  {invoiceMode === 'sale_return' ? 'CREDIT NOTE' : invoiceMode === 'purchase_return' ? 'DEBIT NOTE' : invoiceMode === 'purchase' ? 'PURCHASE INVOICE' : 'SALE INVOICE'}
                </div>
                <div className="text-[8.5px] font-bold text-slate-500 tracking-wider uppercase">
                  {invoiceMode === 'sale_return' ? 'ORIGINAL FOR RECIPIENT / (ISSUED UNDER SECTION 34 OF CGST ACT - SALE RETURN)' : invoiceMode === 'purchase_return' ? 'ORIGINAL FOR SUPPLIER / (ISSUED UNDER SECTION 34 OF CGST ACT - PURCHASE RETURN)' : 'ORIGINAL FOR RECIPIENT'}
                </div>
              </div>
            )}

            {/* 2. Seller Identity block */}
            <div className="grid grid-cols-12 border-b border-slate-900 bg-slate-50/30 p-2 text-left">
              <div className="col-span-7 space-y-1">
                <div className="text-[12px] font-black tracking-wide text-slate-900 uppercase break-words leading-tight">
                  {sellerName}
                </div>
                <div className="text-[8.5px] leading-normal text-slate-600 font-medium">
                  {sellerAddress}
                </div>
                <div className="text-[9px] text-slate-800">
                  {sellerPhone && <span><span className="font-bold">Tel: </span>{sellerPhone}</span>}
                  {sellerEmail && <span>{sellerPhone ? ' | ' : ''}<span className="font-bold">Email: </span>{sellerEmail}</span>}
                </div>
              </div>
              <div className="col-span-5 border-l border-slate-900/10 pl-3 space-y-0.5 text-right flex flex-col justify-center">
                {sellerFssai && <div><span className="font-bold">FSSAI Lic No:</span> <span className="font-mono">{sellerFssai}</span></div>}
                {sellerPAN && <div><span className="font-bold">PAN:</span> <span className="font-mono">{sellerPAN}</span></div>}
                {sellerGSTIN && <div><span className="font-bold">GSTIN:</span> <span className="font-mono font-bold">{sellerGSTIN}</span></div>}
                {(sellerState || sellerStateCode) && <div><span className="font-bold">State:</span> {sellerState} {sellerStateCode ? `(${sellerStateCode})` : ''}</div>}
              </div>
            </div>

            {/* 3. Shipping / Logistics Details Grid */}
            <div className="grid grid-cols-12 border-b border-slate-900 text-left">
              
              <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-1">
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">{invoiceMode === 'sale_return' ? 'Credit Note No' : invoiceMode === 'purchase_return' ? 'Debit Note No' : 'Invoice No'}</span><span className="font-bold text-[11px] font-mono">{invoiceNo}</span></div>
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Date of Supply</span><span className="font-medium">{new Date(invoiceDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</span></div>
              </div>
              
              <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-1">
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Transport / Carrier</span><span className="font-medium text-slate-800">{transport || 'N/A'}</span></div>
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Vehicle No.</span><span className="font-mono font-bold text-slate-900">{vehicleNo || 'N/A'}</span></div>
              </div>

              <div className="col-span-3 p-1.5 border-r border-slate-900 space-y-1">
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">GR/RR Number</span><span className="font-medium font-mono">{grRrNo || 'N/A'}</span></div>
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Station / Destination</span><span className="font-medium">{station || 'N/A'}</span></div>
              </div>

              <div className="col-span-3 p-1.5 space-y-1">
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Reverse Charge (Y/N)</span><span className="font-bold">{reverseCharge}</span></div>
                <div><span className="font-bold block text-[8px] text-slate-500 uppercase">Freight Status</span><span className="font-medium">{freightAmt || 'FREIGHT TO PAY'}</span></div>
              </div>
            </div>

            {/* Return details row */}
            {(originalInvoiceNo || reasonForReturn) && (
              <div className="grid grid-cols-12 border-b border-slate-900 text-left bg-amber-50/70 p-1.5 text-[8.5px]">
                <div className="col-span-6 space-x-1">
                  <span className="font-black text-amber-900 uppercase text-[8px]">Original Invoice Ref:</span>
                  <span className="font-mono font-bold text-slate-900">{originalInvoiceNo || 'N/A'}</span>
                  {originalInvoiceDate && <span className="text-slate-600 font-semibold">({new Date(originalInvoiceDate).toLocaleDateString('en-IN')})</span>}
                </div>
                <div className="col-span-6 text-right">
                  {reasonForReturn && (
                    <span>
                      <span className="font-black text-amber-900 uppercase text-[8px]">Reason for Return: </span>
                      <span className="font-bold text-slate-800">{reasonForReturn}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Order detail secondary row */}
            {(orderNo || orderDate || ewayBillNo) && (
              <div className="grid grid-cols-12 border-b border-slate-900 text-left bg-slate-50/20">
                <div className="col-span-4 p-1 border-r border-slate-900">
                  <span className="font-bold text-[8px] text-slate-500 mr-1.5 uppercase">E-Way Bill No:</span>
                  <span className="font-bold font-mono">{ewayBillNo || 'N/A'}</span>
                </div>
                <div className="col-span-4 p-1 border-r border-slate-900">
                  <span className="font-bold text-[8px] text-slate-500 mr-1.5 uppercase">Order Number:</span>
                  <span className="font-medium">{orderNo || 'N/A'}</span>
                </div>
                <div className="col-span-4 p-1">
                  <span className="font-bold text-[8px] text-slate-500 mr-1.5 uppercase">Order Date:</span>
                  <span className="font-medium">{orderDate ? new Date(orderDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                </div>
              </div>
            )}

            {/* 4. Parties Grid (Billed To vs Shipped To) */}
            <div className="grid grid-cols-12 border-b border-slate-900 text-left">
              
              {/* Billed To */}
              <div className={`${useDifferentShipping ? 'col-span-6 border-r border-slate-900' : 'col-span-12'} p-2 space-y-0.5`}>
                <span className="font-black text-[9px] text-[#004870] uppercase tracking-wider block">Billed to / Customer Details :</span>
                <div className="text-[11px] font-black text-slate-900">{buyerName}</div>
                <div className="text-[9px] text-slate-600 leading-tight whitespace-pre-wrap font-medium">{buyerAddress}</div>
                <div className="text-[9px] pt-1">
                  <span className="font-bold text-slate-800">GSTIN / UIN: </span>
                  <span className="font-mono font-bold">{buyerGSTIN || 'N/A'}</span>
                </div>
                <div className="text-[9px]">
                  <span className="font-bold text-slate-800">State / Code: </span>
                  {buyerState} ({buyerStateCode})
                </div>
                {buyerPhone && <div className="text-[9px] text-slate-500"><span className="font-bold">Phone: </span>{buyerPhone}</div>}
              </div>

              {/* Shipped To */}
              {useDifferentShipping && (
                <div className="col-span-6 p-2 space-y-0.5">
                  <span className="font-black text-[9px] text-amber-700 uppercase tracking-wider block">Shipped to / Consignee Details :</span>
                  <div className="text-[11px] font-black text-slate-900">{shipName}</div>
                  <div className="text-[9px] text-slate-600 leading-tight whitespace-pre-wrap font-medium">{shipAddress}</div>
                  <div className="text-[9px] pt-1">
                    <span className="font-bold text-slate-800">GSTIN / UIN: </span>
                    <span className="font-mono font-bold">{shipGSTIN || 'N/A'}</span>
                  </div>
                  <div className="text-[9px]">
                    <span className="font-bold text-slate-800">State / Code: </span>
                    {shipState} ({shipStateCode})
                  </div>
                </div>
              )}
            </div>

            {/* 5. Main Items Table (Interactive In-Place Grid) */}
            <div className="w-full relative">
              <table className="w-full border-collapse border-none text-[9.5px]">
                <thead>
                  <tr className="bg-[#8faeab] border-b border-slate-800 text-slate-900 font-bold uppercase text-center select-none text-[10px]">
                    <th className="py-2 border-r border-slate-800 w-7 text-center">#</th>
                    <th className="py-2 border-r border-slate-800 text-left px-2 min-w-[180px]">Product</th>
                    {visibleColumns.packing && <th className="py-2 border-r border-slate-800 w-16 text-center">Packing</th>}
                    {visibleColumns.pcsPerUnit && (
                      <th className="py-2 border-r border-slate-800 w-14 text-center" title="Pieces per Unit / Carton">
                        Pcs/Unit
                      </th>
                    )}
                    {visibleColumns.hsn && <th className="py-2 border-r border-slate-800 w-14 text-center">HSN</th>}
                    {visibleColumns.mrp && <th className="py-2 border-r border-slate-800 w-16 text-right pr-1">M.R.P</th>}
                    {visibleColumns.unit1 && <th className="py-2 border-r border-slate-800 w-14 text-center">Unit-1</th>}
                    {visibleColumns.unit2 && <th className="py-2 border-r border-slate-800 w-14 text-center">Unit-2</th>}
                    <th className="py-2 border-r border-slate-800 w-22 text-right pr-1">Sale Rate</th>
                    {visibleColumns.discount1 && <th className="py-2 border-r border-slate-800 w-14 text-right pr-1">Disc 1.%</th>}
                    {visibleColumns.discount2 && <th className="py-2 border-r border-slate-800 w-14 text-right pr-1">Disc 2.%</th>}
                    {visibleColumns.volDisc1 && <th className="py-2 border-r border-slate-800 w-16 text-right pr-1">Vol. Disc</th>}
                    {visibleColumns.gst && <th className="py-2 border-r border-slate-800 w-12 text-center">GST%</th>}
                    <th className="py-2 border-r border-slate-800 w-24 text-right pr-2">₹ Amount</th>
                    <th className="py-1 border-slate-800 w-9 text-center print:hidden relative">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setShowColumnMenu(!showColumnMenu)}
                          className="p-1 rounded text-slate-800 hover:text-black hover:bg-black/10 transition-colors cursor-pointer"
                          title="Toggle columns visibility"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>

                      {/* Three-dot dropdown menu for column visibility with outside click dismissal */}
                      {showColumnMenu && (
                        <div
                          ref={columnMenuRef}
                          className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-300 rounded-xl shadow-2xl p-3 z-50 text-left space-y-2 text-xs font-semibold text-slate-700 normal-case"
                        >
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                            Column Settings
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.packing}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, packing: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Packing</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.pcsPerUnit}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, pcsPerUnit: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Pcs / Unit (Pack Size)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.unit1}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, unit1: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Unit-1 (Carton Qty)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.unit2}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, unit2: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Unit-2 (Loose PCS)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.mrp}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, mrp: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>M.R.P</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.hsn}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, hsn: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>HSN Code</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.discount1}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, discount1: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Disc 1 %</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.discount2}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, discount2: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Disc 2 %</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.volDisc1}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, volDisc1: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>Vol. Discount</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={visibleColumns.gst}
                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, gst: e.target.checked }))}
                                className="rounded text-[#004870]"
                              />
                              <span>GST Rate %</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 border-b border-slate-900">
                  {items.map((item, idx) => {
                    const calc = calculateLineItem(item);

                    return (
                      <tr key={item.id} className="align-middle hover:bg-slate-50/50">
                        {/* S.N. */}
                        <td className="py-1 border-r border-slate-900 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Product Name */}
                        <td className="p-0 border-r border-slate-900">
                          <input
                            id={`cell-${idx}-name`}
                            type="text"
                            placeholder="Enter or search item name..."
                            value={item.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateItem(item.id, 'name', val);
                              const matched = catalogItems.find(c => c.name.toLowerCase() === val.toLowerCase());
                              if (matched) handleSelectCatalogItem(item.id, matched);
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'name')}
                            list="catalog-suggestions"
                            className="w-full bg-transparent px-2 py-1.5 text-[10px] font-bold text-slate-900 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none truncate"
                          />
                        </td>

                        {/* Packing */}
                        {visibleColumns.packing && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-packing`}
                              type="text"
                              placeholder="e.g. 500GM"
                              value={item.packing ?? item.unit ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateItem(item.id, 'packing', val);
                                const parsed = parsePackFromName(val);
                                if (parsed > 1) {
                                  handleUpdateItem(item.id, 'conversionFactor', parsed);
                                }
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'packing')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-medium text-slate-700 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Pcs/Unit (Conversion Factor) */}
                        {visibleColumns.pcsPerUnit && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-conversionFactor`}
                              type="text"
                              inputMode="numeric"
                              placeholder="1"
                              value={item.conversionFactor ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'conversionFactor', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'conversionFactor')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-bold text-slate-800 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                              title={`Pieces inside 1 ${item.unit || item.unit1 || 'Unit'}`}
                            />
                          </td>
                        )}

                        {/* HSN */}
                        {visibleColumns.hsn && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-hsn`}
                              type="text"
                              placeholder="HSN"
                              value={item.hsn}
                              onChange={(e) => handleUpdateItem(item.id, 'hsn', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'hsn')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-mono text-slate-700 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* M.R.P */}
                        {visibleColumns.mrp && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-mrp`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.mrp ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'mrp', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'mrp')}
                              className="w-full bg-transparent px-1.5 py-1.5 text-[10px] text-right font-mono font-medium text-slate-800 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Unit-1 (Carton Qty) */}
                        {visibleColumns.unit1 && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-unit1`}
                              type="text"
                              inputMode="decimal"
                              placeholder="1"
                              value={item.quantity ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'unit1')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-bold text-[#004870] focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Unit-2 (Loose Pieces) */}
                        {visibleColumns.unit2 && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-unit2`}
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={item.looseQty ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'looseQty', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'unit2')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-bold text-amber-900 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Sale Rate */}
                        <td className="p-0 border-r border-slate-900">
                          <input
                            id={`cell-${idx}-rate`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={item.rate ?? ''}
                            onChange={(e) => handleUpdateItem(item.id, 'rate', e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'rate')}
                            className="w-full bg-transparent px-1.5 py-1.5 text-[10px] text-right font-mono font-bold text-slate-900 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                          />
                        </td>

                        {/* Disc 1 % */}
                        {visibleColumns.discount1 && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-discount1`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0%"
                              value={item.discount1 ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'discount1', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'discount1')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-right font-mono text-slate-700 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Disc 2 % */}
                        {visibleColumns.discount2 && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-discount2`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0%"
                              value={item.discount2 ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'discount2', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'discount2')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-right font-mono text-slate-700 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* Vol Disc */}
                        {visibleColumns.volDisc1 && (
                          <td className="p-0 border-r border-slate-900">
                            <input
                              id={`cell-${idx}-volDisc1`}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.volDisc1 ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'volDisc1', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'volDisc1')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-right font-mono text-slate-700 focus:bg-amber-100 focus:outline-none ring-inset focus:ring-1 focus:ring-amber-400 border-none"
                            />
                          </td>
                        )}

                        {/* GST % */}
                        {visibleColumns.gst && (
                          <td className="p-0 border-r border-slate-900">
                            <select
                              id={`cell-${idx}-gstRate`}
                              value={item.gstRate ?? 5}
                              onChange={(e) => handleUpdateItem(item.id, 'gstRate', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'gstRate')}
                              className="w-full bg-transparent px-1 py-1.5 text-[10px] text-center font-medium text-slate-700 focus:bg-amber-100 focus:outline-none border-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                        )}

                        {/* Amount */}
                        <td className="py-1.5 px-2 border-r border-slate-900 text-right font-black text-slate-950 font-mono text-[10px]">
                          {calc.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Action: Delete */}
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length === 1}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded disabled:opacity-20 cursor-pointer"
                            title="Delete line"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Empty Spacer Rows for physical invoice appearance */}
                  {items.length < 4 && Array.from({ length: 4 - items.length }).map((_, spacerIdx) => (
                    <tr key={`spacer-${spacerIdx}`} className="h-6 opacity-0 select-none pointer-events-none">
                      <td className="border-r border-slate-900"></td>
                      <td className="border-r border-slate-900"></td>
                      {visibleColumns.packing && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.pcsPerUnit && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.hsn && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.mrp && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.unit1 && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.unit2 && <td className="border-r border-slate-900"></td>}
                      <td className="border-r border-slate-900"></td>
                      {visibleColumns.discount1 && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.discount2 && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.volDisc1 && <td className="border-r border-slate-900"></td>}
                      {visibleColumns.gst && <td className="border-r border-slate-900"></td>}
                      <td className="border-r border-slate-900"></td>
                      <td className="print:hidden"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Total Row */}
                  <tr className="bg-slate-100 font-black uppercase text-center align-middle border-b border-slate-900 text-[10px]">
                    <td colSpan={2} className="py-2 border-r border-slate-900 text-right px-3 font-bold">
                      Grand Total
                    </td>
                    {visibleColumns.packing && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.pcsPerUnit && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.hsn && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.mrp && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.unit1 && (
                      <td className="border-r border-slate-900 text-center text-[#004870] font-bold">
                        {totalQty.toFixed(0)}
                      </td>
                    )}
                    {visibleColumns.unit2 && (
                      <td className="border-r border-slate-900 text-center text-amber-900 font-bold">
                        {items.reduce((sum, it) => sum + (Number(it.looseQty) || 0), 0).toFixed(0)}
                      </td>
                    )}
                    <td className="border-r border-slate-900"></td>
                    {visibleColumns.discount1 && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.discount2 && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.volDisc1 && <td className="border-r border-slate-900"></td>}
                    {visibleColumns.gst && <td className="border-r border-slate-900"></td>}
                    <td className="text-right pr-2 text-slate-950 font-mono text-[11px] font-black border-r border-slate-900">
                      {formatINR(finalTotal)}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>

                  {showPaymentKhata && !isFullyPaid && (
                    <>
                      <tr className="bg-slate-50/40 font-bold uppercase text-center align-middle border-b border-slate-900 text-[9px] text-slate-700">
                        <td colSpan={2} className="py-1.5 border-r border-slate-900 text-right px-3">Amount Paid</td>
                        {visibleColumns.packing && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.pcsPerUnit && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.hsn && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.mrp && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.unit1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.unit2 && <td className="border-r border-slate-900"></td>}
                        <td className="border-r border-slate-900"></td>
                        {visibleColumns.discount1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.discount2 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.volDisc1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.gst && <td className="border-r border-slate-900"></td>}
                        <td className="text-right pr-2 text-emerald-700 font-mono font-semibold border-r border-slate-900">{formatINR(paidAmount)}</td>
                        <td className="print:hidden"></td>
                      </tr>
                      <tr className="bg-rose-50/50 font-black uppercase text-center align-middle border-b border-slate-900 text-[9px] text-rose-700">
                        <td colSpan={2} className="py-1.5 border-r border-slate-900 text-right px-3">Balance Debt Due</td>
                        {visibleColumns.packing && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.pcsPerUnit && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.hsn && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.mrp && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.unit1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.unit2 && <td className="border-r border-slate-900"></td>}
                        <td className="border-r border-slate-900"></td>
                        {visibleColumns.discount1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.discount2 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.volDisc1 && <td className="border-r border-slate-900"></td>}
                        {visibleColumns.gst && <td className="border-r border-slate-900"></td>}
                        <td className="text-right pr-2 text-rose-600 font-mono font-black border-r border-slate-900">{formatINR(finalTotal - paidAmount)}</td>
                        <td className="print:hidden"></td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>

              {/* Add item row button below table in invoice view */}
              <div className="print:hidden p-2 bg-slate-50 border-b border-slate-900 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-[#004870] hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add Line Item
                </button>
                <span className="text-[9px] font-semibold text-slate-500">
                  Tip: Press <kbd className="bg-white px-1.5 py-0.5 border rounded text-slate-700 font-mono">Enter</kbd> to jump between cells. Press <kbd className="bg-white px-1.5 py-0.5 border rounded text-slate-700 font-mono">Enter</kbd> on the last cell to add a new row automatically.
                </span>
              </div>
            </div>

            {/* 6. Footer section (Bank, Words, Declaration, QR, Signatures) */}
            <div className="p-3 grid grid-cols-12 gap-5 align-top text-left text-slate-800">
              
              {/* Left Column: Bank Details, Terms, Words */}
              <div className="col-span-8 space-y-4">
                
                {/* Total in words */}
                <div>
                  <div className="text-[7.5px] font-bold uppercase text-slate-400 block tracking-wider">Amount in Words:</div>
                  <div className="text-[10px] font-black text-slate-900 capitalize italic leading-tight">
                    {convertNumberToWords(finalTotal)}
                  </div>
                </div>

                {/* Bank Details & Dynamic UPI QR Block */}
                {showBankingDetails && ((bankName || bankAccountNo || bankIfsc) || (showUpiQr && upiId.trim())) && (
                  <div className="border border-slate-900/20 p-2 rounded bg-slate-50/40 grid grid-cols-12 gap-2 text-[8px] leading-tight">
                    <div className="col-span-12 text-[9px] font-black text-[#004870] uppercase tracking-wide border-b border-slate-900/10 pb-0.5 flex justify-between items-center">
                      <span>Payment &amp; Bank Settlement</span>
                      {showUpiQr && upiId.trim() && (
                        <span className="text-[7.5px] font-bold text-emerald-700 uppercase tracking-normal">UPI Instant Settlement</span>
                      )}
                    </div>

                    {/* Bank Info Column */}
                    <div className={showUpiQr && upiId.trim() ? "col-span-7 grid grid-cols-2 gap-1.5" : "col-span-12 grid grid-cols-2 gap-2"}>
                      {bankName && (
                        <div>
                          <span className="font-bold text-slate-500 block uppercase text-[7px]">Beneficiary Bank</span>
                          <span className="font-bold text-slate-800 text-[9px]">{bankName}</span>
                        </div>
                      )}
                      {bankAccountNo && (
                        <div>
                          <span className="font-bold text-slate-500 block uppercase text-[7px]">Account Number</span>
                          <span className="font-mono font-bold text-slate-800 text-[9px]">{bankAccountNo}</span>
                        </div>
                      )}
                      {bankIfsc && (
                        <div className={bankName ? 'col-span-1' : 'col-span-2'}>
                          <span className="font-bold text-slate-500 block uppercase text-[7px]">IFSC Code</span>
                          <span className="font-mono font-bold text-[#004870] text-[9px]">{bankIfsc}</span>
                        </div>
                      )}
                      {upiId.trim() && (
                        <div className="col-span-2 pt-0.5">
                          <span className="font-bold text-slate-500 block uppercase text-[7px]">UPI VPA</span>
                          <span className="font-mono font-bold text-slate-900 text-[8.5px]">{upiId}</span>
                        </div>
                      )}
                    </div>

                    {/* Dynamic UPI QR Code Column */}
                    {showUpiQr && upiId.trim() && payableAmount > 0 && (
                      <div className="col-span-5 border-l border-slate-900/15 pl-2 flex items-center gap-2">
                        <div className="bg-white p-1 border border-slate-300 rounded shrink-0 shadow-2xs">
                          <QRCodeSVG
                            value={upiUri}
                            size={56}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <div className="space-y-0.5 text-left text-[7px] leading-tight">
                          <div className="font-black text-[#004870] uppercase text-[8px]">Scan &amp; Pay</div>
                          <div className="font-bold text-emerald-700 text-[8.5px]">₹{payableAmount.toFixed(2)}</div>
                          <div className="text-[6.5px] text-slate-500 font-medium leading-none">GPay / PhonePe / Paytm / BHIM</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Terms and declaration */}
                <div className="space-y-1 text-[7.5px] text-slate-500 leading-normal border-t border-slate-900/10 pt-2">
                  <div className="font-bold text-slate-700 uppercase tracking-wide text-[8px]">Declaration & Terms:</div>
                  <div className="whitespace-pre-line font-medium leading-tight">
                    E.&O.E. 
                    1. Goods once sold will not be taken back or exchanged.
                    2. Subject to local jurisdiction only.
                  </div>
                </div>

              </div>

              {/* Right Column: Tax Slabs, QR Code place, Stamps */}
              <div className="col-span-4 flex flex-col justify-between items-end space-y-4">
                
                {/* Tax Slab Summary table */}
                <div className="w-full text-[7.5px] border border-slate-900">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-900 font-bold uppercase text-[7px]">
                        <th className="py-0.5 border-r border-slate-900">Tax Slab</th>
                        <th className="py-0.5 border-r border-slate-900">Taxable Val</th>
                        <th className="py-0.5">{isInterstate ? 'IGST' : 'CGST+SGST'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {Object.entries(calculateGstBreakdown()).map(([rate, vals]) => {
                        const r = parseInt(rate);
                        return (
                          <tr key={rate} className="font-medium">
                            <td className="py-0.5 border-r border-slate-900 font-bold">{r}%</td>
                            <td className="py-0.5 border-r border-slate-900 font-mono">{vals.base.toFixed(2)}</td>
                            <td className="py-0.5 font-mono">{vals.gst.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      
                      {/* Sub-tax summary total row */}
                      <tr className="bg-slate-100 border-t border-slate-900 font-bold">
                        <td className="py-0.5 border-r border-slate-900">Total</td>
                        <td className="py-0.5 border-r border-slate-900 font-mono">{subtotal.toFixed(2)}</td>
                        <td className="py-0.5 font-mono">{totalGst.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {Math.abs(roundoff) > 0.01 && (
                  <div className="text-[9px] font-bold text-slate-500 italic pr-1">
                    Add : Rounded Off (+) : <span className="font-mono">{roundoff.toFixed(2)}</span>
                  </div>
                )}

                {/* Receiver / Signatory Stamps */}
                <div className="w-full pt-4 grid grid-cols-2 gap-4 text-center text-[7.5px] text-slate-700">
                  <div className="space-y-7 border-t border-slate-300 pt-1">
                    <div className="font-medium italic text-slate-400">Receiver's Signature</div>
                    <div className="font-bold uppercase text-slate-500">Receiver</div>
                  </div>
                  
                  <div className="space-y-7 border-t border-slate-300 pt-1">
                    <div className="font-bold text-slate-900 text-[8px] uppercase tracking-wide break-words leading-tight" title={sellerName}>
                      For {sellerName}
                    </div>
                    <div className="font-black uppercase text-slate-900 text-[8px] border-t border-slate-900/10 pt-0.5">
                      Authorized Signatory
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Modal: Add New Store Subpart / Branch / Godown */}
      {showAddSubpartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#004870] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building size={18} />
                <h3 className="font-bold text-sm">Add Buyer / Receiving Firm Profile</h3>
              </div>
              <button 
                onClick={() => setShowAddSubpartModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubpart} className="p-5 space-y-4">
              {subpartError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{subpartError}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Buyer / Firm / Branch Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinesh Kirana Store, Piyush Enterprises, Market Branch"
                  value={subpartForm.name}
                  onChange={(e) => setSubpartForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Firm Code / Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DKS, PE-01"
                    value={subpartForm.code}
                    onChange={(e) => setSubpartForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="Firm GSTIN (optional)"
                    value={subpartForm.gstin}
                    onChange={(e) => setSubpartForm(prev => ({ ...prev, gstin: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={subpartForm.phone}
                    onChange={(e) => setSubpartForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    State & Code
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="text"
                      placeholder="State"
                      value={subpartForm.state}
                      onChange={(e) => setSubpartForm(prev => ({ ...prev, state: e.target.value }))}
                      className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                    />
                    <input
                      type="text"
                      placeholder="Code"
                      value={subpartForm.stateCode}
                      onChange={(e) => setSubpartForm(prev => ({ ...prev, stateCode: e.target.value }))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Physical Address / Location
                </label>
                <textarea
                  rows={2}
                  placeholder="Address or store location"
                  value={subpartForm.address}
                  onChange={(e) => setSubpartForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSubpartModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubpart}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#004870] hover:bg-[#003858] disabled:opacity-50 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingSubpart ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save size={13} /> Save Buyer / Firm Profile
                    </>
                  )}
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
        title="Share Tax Invoice on WhatsApp"
        invoiceNo={invoiceNo}
        printableElementId="printable-tax-invoice"
        invoiceData={whatsAppModalPayload.invoiceData}
      />

    </div>
  );
}
