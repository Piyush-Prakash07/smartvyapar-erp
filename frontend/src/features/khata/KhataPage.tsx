import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { 
  getCustomers, 
  getMahajans, 
  getStoreSubparts,
  updateInvoicePayment, 
  updatePurchaseInvoicePayment,
  updateInvoiceLogistics,
  updatePurchaseInvoiceLogistics
} from '../dashboard/api';
import type { Customer, Mahajan, Payment, PaymentMethod, PaymentStatus, StoreSubpart } from '../dashboard/types';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_CONFIG,
  maskMobile,
  maskDigits
} from './paymentMethodConfig';
import { 
  BookOpen, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  Search, 
  Eye, 
  CheckCircle2, 
  ArrowLeft, 
  Printer, 
  RefreshCw,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Receipt,
  Building,
  Filter,
  Save,
  MessageCircle,
  Edit3,
  Package,
  AlertCircle,
  X,
  Undo2,
  Clock
} from 'lucide-react';
import { generateKhataReminderMessage, generateInvoiceWhatsAppMessage } from '../../lib/whatsapp';
import WhatsAppShareModal from '../invoices/WhatsAppShareModal';

export default function KhataPage() {
  const { activeCompany } = useAuth();

  // Mode state: 'customers' (receivables) or 'mahajans' (payables to suppliers)
  const [ledgerType, setLedgerType] = useState<'customers' | 'mahajans'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Farm / Business Firm Filter State
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('ALL');

  // Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mahajans, setMahajans] = useState<Mahajan[]>([]);
  const [storeSubparts, setStoreSubparts] = useState<StoreSubpart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selected party for detail ledger view
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

  // WhatsApp Share Modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalPayload, setWhatsAppModalPayload] = useState<{
    phone: string;
    name: string;
    message: string;
    title: string;
    invoiceNo?: string;
    invoiceData?: any;
  }>({ phone: '', name: '', message: '', title: '' });
  
  // Payment records modal state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<any | null>(null);
  const [paymentList, setPaymentList] = useState<Partial<Payment>[]>([]);
  
  // Payment Entry Form State
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | ''>('');
  const [newPaymentDate, setNewPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [bankName, setBankName] = useState('');
  const [transferType, setTransferType] = useState('IMPS');
  const [maskedAccountReference, setMaskedAccountReference] = useState('');
  const [paymentSubType, setPaymentSubType] = useState('QR Scan');
  const [senderMobile, setSenderMobile] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [cardType, setCardType] = useState('Visa');
  const [cardLastFour, setCardLastFour] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Return items & document details modal state
  const [docTabFilter, setDocTabFilter] = useState<'ALL' | 'INVOICES' | 'RETURNS'>('ALL');
  const [viewingDocItems, setViewingDocItems] = useState<{
    inv: any;
    logData: any;
    itemsList: any[];
    isReturn: boolean;
    docTypeTitle: string;
    partyName: string;
  } | null>(null);

  // Fetch all ledgers and store subparts
  useEffect(() => {
    if (!activeCompany) return;

    const fetchLedgers = async () => {
      setIsLoading(true);
      try {
        const [customerList, mahajanList, subpartsList] = await Promise.all([
          getCustomers(),
          getMahajans(),
          getStoreSubparts()
        ]);
        setCustomers(customerList);
        setMahajans(mahajanList);
        setStoreSubparts(subpartsList);
      } catch (err) {
        console.error('Failed to sync ledgers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLedgers();
  }, [activeCompany?.id, refreshTrigger]);

  // Helpers
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Helper to extract Farm / Branch / Subpart firm name from an invoice or return document
  const getInvoiceFarmName = (inv: any): string => {
    if (inv?.buyerSubpart?.name) return inv.buyerSubpart.name;
    try {
      const log = typeof inv?.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : inv?.logisticsData;
      if (log?.sellerSubpartId) {
        const found = storeSubparts.find(sp => sp.id === log.sellerSubpartId);
        if (found?.name) return found.name;
      }
      if (log?.buyerSubpartId) {
        const found = storeSubparts.find(sp => sp.id === log.buyerSubpartId);
        if (found?.name) return found.name;
      }
      // For customer invoices / sale returns: seller is our issuing/receiving farm or store
      if (inv?.customerId && log?.sellerName && log.sellerName.trim()) {
        return log.sellerName.trim();
      }
      // For supplier purchase invoices / purchase returns: buyer is our receiving/returning farm or store
      if (inv?.mahajanId && log?.buyerName && log.buyerName.trim()) {
        return log.buyerName.trim();
      }
      if (log?.sellerName && log.sellerName.trim()) return log.sellerName.trim();
      if (log?.buyerName && log.buyerName.trim()) return log.buyerName.trim();
    } catch { /* silent */ }
    return activeCompany?.name || 'Primary Store';
  };

  // Compute unique farm names list
  const uniqueFarmNames = useMemo(() => {
    const set = new Set<string>();
    storeSubparts.forEach(sp => set.add(sp.name));
    customers.forEach(c => {
      c.invoices?.forEach(inv => set.add(getInvoiceFarmName(inv)));
    });
    mahajans.forEach(m => {
      m.purchaseInvoices?.forEach(inv => set.add(getInvoiceFarmName(inv)));
    });
    if (set.size === 0 && activeCompany?.name) set.add(activeCompany.name);
    return Array.from(set).sort();
  }, [storeSubparts, customers, mahajans, activeCompany]);

  // Helper to detect if an invoice record is a Return (Credit Note / Debit Note)
  const isInvoiceReturn = (inv: any): boolean => {
    try {
      const log = typeof inv?.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv?.logisticsData || {});
      if (log?.docType === 'sale_return' || log?.docType === 'credit_note' || log?.docType === 'purchase_return' || log?.docType === 'debit_note') {
        return true;
      }
    } catch { /* silent */ }
    const no = String(inv?.invoiceNo || '');
    return no.includes('-CR/') || no.startsWith('CR/') || no.includes('-DR/') || no.startsWith('DR/');
  };

  // Helper to check return status ('PENDING' or 'CONFIRMED')
  const getReturnStatus = (inv: any): 'PENDING' | 'CONFIRMED' => {
    try {
      const log = typeof inv?.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv?.logisticsData || {});
      if (log?.returnStatus === 'CONFIRMED') return 'CONFIRMED';
      if (log?.returnStatus === 'PENDING') return 'PENDING';
    } catch { /* silent */ }
    return 'PENDING'; // Returns start in pending verification by default
  };

  // Compute Farm-scoped KPI aggregates
  const computeOverallKPIs = () => {
    let totalReceivable = 0;
    let customerReturns = 0; // Confirmed returns
    let customerPendingReturns = 0;
    let customerPaid = 0;
    
    customers.forEach(c => {
      c.invoices?.forEach(inv => {
        const farm = getInvoiceFarmName(inv);
        if (selectedFarmFilter === 'ALL' || farm === selectedFarmFilter) {
          if (isInvoiceReturn(inv)) {
            const status = getReturnStatus(inv);
            if (status === 'CONFIRMED') {
              customerReturns += inv.totalAmount;
            } else {
              customerPendingReturns += inv.totalAmount;
            }
          } else {
            totalReceivable += inv.totalAmount;
            customerPaid += (inv.paidAmount || 0);
          }
        }
      });
    });

    let totalPayable = 0;
    let supplierReturns = 0; // Confirmed returns
    let supplierPendingReturns = 0;
    let supplierPaid = 0;

    mahajans.forEach(m => {
      m.purchaseInvoices?.forEach(inv => {
        const farm = getInvoiceFarmName(inv);
        if (selectedFarmFilter === 'ALL' || farm === selectedFarmFilter) {
          if (isInvoiceReturn(inv)) {
            const status = getReturnStatus(inv);
            if (status === 'CONFIRMED') {
              supplierReturns += inv.totalAmount;
            } else {
              supplierPendingReturns += inv.totalAmount;
            }
          } else {
            totalPayable += inv.totalAmount;
            supplierPaid += (inv.paidAmount || 0);
          }
        }
      });
    });

    const netReceivables = Math.max(0, totalReceivable - customerReturns - customerPaid);
    const netPayables = Math.max(0, totalPayable - supplierReturns - supplierPaid);
    const ledgerIndex = netReceivables - netPayables;

    return {
      netReceivables,
      netPayables,
      ledgerIndex,
      totalReceivable,
      customerReturns,
      customerPendingReturns,
      customerPaid,
      totalPayable,
      supplierReturns,
      supplierPendingReturns,
      supplierPaid
    };
  };

  const kpis = computeOverallKPIs();

  // Find active selected customer or supplier
  const getSelectedParty = () => {
    if (ledgerType === 'customers') {
      return customers.find(c => c.id === selectedPartyId);
    } else {
      return mahajans.find(m => m.id === selectedPartyId);
    }
  };

  const activeParty = getSelectedParty();

  // Calculate stats for a specific customer (Farm-scoped with confirmed return deduction)
  const getCustomerStats = (c: Customer) => {
    let total = 0;
    let returns = 0; // Confirmed returns
    let pendingReturns = 0;
    let paid = 0;
    c.invoices?.forEach(inv => {
      const farm = getInvoiceFarmName(inv);
      if (selectedFarmFilter === 'ALL' || farm === selectedFarmFilter) {
        if (isInvoiceReturn(inv)) {
          const status = getReturnStatus(inv);
          if (status === 'CONFIRMED') {
            returns += inv.totalAmount;
          } else {
            pendingReturns += inv.totalAmount;
          }
        } else {
          total += inv.totalAmount;
          paid += (inv.paidAmount || 0);
        }
      }
    });
    const debt = total - returns - paid;
    return { total, returns, pendingReturns, paid, debt };
  };

  // Calculate stats for a specific supplier (Farm-scoped with confirmed return deduction)
  const getSupplierStats = (m: Mahajan) => {
    let total = 0;
    let returns = 0; // Confirmed returns
    let pendingReturns = 0;
    let paid = 0;
    m.purchaseInvoices?.forEach(inv => {
      const farm = getInvoiceFarmName(inv);
      if (selectedFarmFilter === 'ALL' || farm === selectedFarmFilter) {
        if (isInvoiceReturn(inv)) {
          const status = getReturnStatus(inv);
          if (status === 'CONFIRMED') {
            returns += inv.totalAmount;
          } else {
            pendingReturns += inv.totalAmount;
          }
        } else {
          total += inv.totalAmount;
          paid += (inv.paidAmount || 0);
        }
      }
    });
    const debt = total - returns - paid;
    return { total, returns, pendingReturns, paid, debt };
  };

  // Toggle or confirm return status ('PENDING' <-> 'CONFIRMED')
  const handleToggleReturnStatus = async (inv: any, isCustomer: boolean) => {
    setIsUpdating(true);
    try {
      let logData: any = {};
      try {
        logData = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
      } catch { /* silent */ }
      
      const currentStatus = logData?.returnStatus || 'PENDING';
      const newStatus = currentStatus === 'CONFIRMED' ? 'PENDING' : 'CONFIRMED';
      const updatedLogistics = JSON.stringify({
        ...logData,
        returnStatus: newStatus,
        verifiedAt: newStatus === 'CONFIRMED' ? new Date().toISOString() : null,
      });

      if (isCustomer) {
        await updateInvoiceLogistics(inv.id, updatedLogistics);
      } else {
        await updatePurchaseInvoiceLogistics(inv.id, updatedLogistics);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert('Failed to update return verification status');
    } finally {
      setIsUpdating(false);
    }
  };

  // WhatsApp Khata Balance Reminder Handler
  const handleSendWhatsAppReminder = () => {
    if (!activeParty) return;
    const isCust = ledgerType === 'customers';
    const stats = isCust ? getCustomerStats(activeParty as Customer) : getSupplierStats(activeParty as Mahajan);
    const upiId = localStorage.getItem('smartvyapar_upi_id') || '';

    const pendingInvoices = isCust
      ? (activeParty as Customer).invoices?.filter(i => (i.totalAmount - (i.paidAmount || 0)) > 0.01) || []
      : (activeParty as Mahajan).purchaseInvoices?.filter(i => (i.totalAmount - (i.paidAmount || 0)) > 0.01) || [];

    const msg = generateKhataReminderMessage({
      companyName: activeCompany?.name || 'SmartVyapar Merchant',
      customerName: activeParty.name,
      customerPhone: activeParty.phone || undefined,
      totalBilled: stats.total,
      totalPaid: stats.paid,
      balanceDue: stats.debt,
      pendingInvoicesCount: pendingInvoices.length,
      upiId,
    });

    setWhatsAppModalPayload({
      phone: activeParty.phone || '',
      name: activeParty.name,
      message: msg,
      title: isCust ? 'Send Khata Payment Reminder' : 'Send Supplier Balance Update'
    });
    setShowWhatsAppModal(true);
  };

  // Method selector change handler
  const handleMethodChange = (method: PaymentMethod | '') => {
    setSelectedMethod(method);
    if (!method) return;
    if (method === 'UPI_QR') {
      setProvider('PhonePe');
      setPaymentSubType('QR Scan');
    } else if (method === 'BANK_TRANSFER') {
      setTransferType('IMPS');
    } else if (method === 'MOBILE_TRANSFER') {
      setProvider('PhonePe');
    } else if (method === 'DEBIT_CARD' || method === 'CREDIT_CARD') {
      setCardType('Visa');
    } else if (method === 'WALLET') {
      setProvider('Paytm Wallet');
    }
  };

  // Handle open payment modal
  const handleOpenPaymentModal = (invoice: any) => {
    setPaymentModalInvoice(invoice);
    let parsedPayments: Partial<Payment>[] = [];
    
    if (invoice.payments && Array.isArray(invoice.payments)) {
      parsedPayments = invoice.payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        date: new Date(p.date).toISOString().split('T')[0],
        paymentMethod: p.paymentMethod || 'CASH',
        paymentStatus: p.paymentStatus || 'COMPLETED',
        referenceNumber: p.referenceNumber || null,
        provider: p.provider || null,
        bankName: p.bankName || null,
        transferType: p.transferType || null,
        maskedAccountReference: p.maskedAccountReference || null,
        paymentSubType: p.paymentSubType || null,
        senderMobileMasked: p.senderMobileMasked || null,
        receiverMobileMasked: p.receiverMobileMasked || null,
        cardLastFour: p.cardLastFour || null,
        cardType: p.cardType || null,
        chequeNumber: p.chequeNumber || null,
        chequeDate: p.chequeDate ? new Date(p.chequeDate).toISOString().split('T')[0] : null,
        receiptNumber: p.receiptNumber || null,
        receivedBy: p.receivedBy || null,
        notes: p.notes || null,
      }));
    }
    
    // Fallback: if no stored payment records but invoice has a paidAmount,
    // convert it into an initial payment entry so the user does not lose it.
    if (parsedPayments.length === 0 && invoice.paidAmount > 0) {
      parsedPayments = [{
        id: 'legacy-payment',
        amount: Number(invoice.paidAmount),
        date: new Date(invoice.invoiceDate).toISOString().split('T')[0],
        paymentMethod: 'CASH',
        paymentStatus: 'COMPLETED',
        notes: 'Initial recorded payment',
      }];
    }
    setPaymentList(parsedPayments);
    setNewPaymentAmount('');
    setNewPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedMethod('');
    setReferenceNumber('');
    setProvider('');
    setBankName('');
    setTransferType('IMPS');
    setMaskedAccountReference('');
    setPaymentSubType('QR Scan');
    setSenderMobile('');
    setReceiverMobile('');
    setCardType('Visa');
    setCardLastFour('');
    setChequeNumber('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setReceiptNumber('');
    setReceivedBy('');
    setNotes('');
  };

  // Add a new payment record into the pending list
  const handleAddPaymentEntry = () => {
    if (newPaymentAmount === '' || Number(newPaymentAmount) <= 0) {
      alert('Please enter a valid payment amount greater than 0');
      return;
    }

    if (!selectedMethod) {
      alert('Please select a Payment Method');
      return;
    }

    if (selectedMethod === 'CHEQUE' && !chequeNumber.trim()) {
      alert('Please enter the Cheque Number');
      return;
    }

    const currentTotalConfirmed = paymentList
      .filter(p => !p.paymentStatus || p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'CLEARED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const amountNum = Number(newPaymentAmount);
    if (currentTotalConfirmed + amountNum > paymentModalInvoice.totalAmount) {
      if (!window.confirm(`Warning: Adding ₹${amountNum} will exceed the invoice total of ₹${paymentModalInvoice.totalAmount}. Do you want to proceed?`)) {
        return;
      }
    }

    const newRecord: Partial<Payment> = {
      id: 'pay_' + Math.random().toString(36).substring(2, 9),
      amount: amountNum,
      date: newPaymentDate || new Date().toISOString().split('T')[0],
      paymentMethod: selectedMethod,
      paymentStatus: selectedMethod === 'CHEQUE' ? 'PENDING' : 'COMPLETED',
      referenceNumber: referenceNumber.trim() || null,
      provider: provider.trim() || null,
      bankName: bankName.trim() || null,
      transferType: transferType || null,
      maskedAccountReference: maskedAccountReference.trim() ? maskDigits(maskedAccountReference) : null,
      paymentSubType: paymentSubType || null,
      senderMobileMasked: senderMobile.trim() ? maskMobile(senderMobile) : null,
      receiverMobileMasked: receiverMobile.trim() ? maskMobile(receiverMobile) : null,
      cardLastFour: cardLastFour.trim() ? cardLastFour.trim().slice(-4) : null,
      chequeNumber: chequeNumber.trim() || null,
      chequeDate: selectedMethod === 'CHEQUE' ? chequeDate : null,
      receiptNumber: receiptNumber.trim() || null,
      receivedBy: receivedBy.trim() || null,
      notes: notes.trim() || null,
    };

    setPaymentList(prev => [...prev, newRecord]);

    // Reset form fields
    setNewPaymentAmount('');
    setSelectedMethod('');
    setReferenceNumber('');
    setProvider('');
    setBankName('');
    setMaskedAccountReference('');
    setSenderMobile('');
    setReceiverMobile('');
    setCardLastFour('');
    setChequeNumber('');
    setReceiptNumber('');
    setReceivedBy('');
    setNotes('');
  };

  // Start editing an existing payment entry
  const handleStartEditPayment = (p: Partial<Payment>) => {
    if (!p.id) return;
    setEditingPaymentId(p.id);
    setNewPaymentAmount(p.amount ?? '');
    setNewPaymentDate(
      p.date
        ? typeof p.date === 'string'
          ? p.date.split('T')[0]
          : new Date(p.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setSelectedMethod((p.paymentMethod as PaymentMethod) || 'CASH');
    setReferenceNumber(p.referenceNumber || '');
    setProvider(p.provider || '');
    setBankName(p.bankName || '');
    setTransferType(p.transferType || 'IMPS');
    setMaskedAccountReference(p.maskedAccountReference || '');
    setPaymentSubType(p.paymentSubType || 'QR Scan');
    setSenderMobile(p.senderMobileMasked || '');
    setReceiverMobile(p.receiverMobileMasked || '');
    setCardType((p.cardType as any) || 'Visa');
    setCardLastFour(p.cardLastFour || '');
    setChequeNumber(p.chequeNumber || '');
    setChequeDate(
      p.chequeDate
        ? typeof p.chequeDate === 'string'
          ? p.chequeDate.split('T')[0]
          : new Date(p.chequeDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setReceiptNumber(p.receiptNumber || '');
    setReceivedBy(p.receivedBy || '');
    setNotes(p.notes || '');
  };

  // Cancel payment edit mode
  const handleCancelEditPayment = () => {
    setEditingPaymentId(null);
    setNewPaymentAmount('');
    setNewPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedMethod('');
    setReferenceNumber('');
    setProvider('');
    setBankName('');
    setTransferType('IMPS');
    setMaskedAccountReference('');
    setPaymentSubType('QR Scan');
    setSenderMobile('');
    setReceiverMobile('');
    setCardType('Visa');
    setCardLastFour('');
    setChequeNumber('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setReceiptNumber('');
    setReceivedBy('');
    setNotes('');
  };

  // Save the edited payment entry back into paymentList
  const handleSaveEditPayment = () => {
    if (!editingPaymentId) return;
    if (newPaymentAmount === '' || Number(newPaymentAmount) <= 0) {
      alert('Please enter a valid payment amount greater than 0');
      return;
    }

    if (!selectedMethod) {
      alert('Please select a Payment Method');
      return;
    }

    if (selectedMethod === 'CHEQUE' && !chequeNumber.trim()) {
      alert('Please enter the Cheque Number');
      return;
    }

    const amountNum = Number(newPaymentAmount);
    setPaymentList(prev =>
      prev.map(item => {
        if (item.id === editingPaymentId) {
          return {
            ...item,
            amount: amountNum,
            date: newPaymentDate || new Date().toISOString().split('T')[0],
            paymentMethod: selectedMethod,
            referenceNumber: referenceNumber.trim() || null,
            provider: provider.trim() || null,
            bankName: bankName.trim() || null,
            transferType: transferType || null,
            maskedAccountReference: maskedAccountReference.trim() ? maskDigits(maskedAccountReference) : null,
            paymentSubType: paymentSubType || null,
            senderMobileMasked: senderMobile.trim() ? maskMobile(senderMobile) : null,
            receiverMobileMasked: receiverMobile.trim() ? maskMobile(receiverMobile) : null,
            cardLastFour: cardLastFour.trim() ? cardLastFour.trim().slice(-4) : null,
            chequeNumber: chequeNumber.trim() || null,
            chequeDate: selectedMethod === 'CHEQUE' ? chequeDate : null,
            receiptNumber: receiptNumber.trim() || null,
            receivedBy: receivedBy.trim() || null,
            notes: notes.trim() || null,
          };
        }
        return item;
      })
    );

    handleCancelEditPayment();
  };

  // Toggle or update status of a recorded payment
  const handleTogglePaymentStatus = (id?: string, newStatus?: PaymentStatus) => {
    if (!id || !newStatus) return;
    setPaymentList(prev =>
      prev.map(p => (p.id === id ? { ...p, paymentStatus: newStatus } : p))
    );
  };

  // Handle save payment records to database
  const handleSavePayments = async () => {
    if (!paymentModalInvoice) return;
    setIsUpdating(true);
    try {
      const confirmedPaid = paymentList
        .filter(p => !p.paymentStatus || p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'CLEARED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const paymentsPayload = paymentList.map(p => ({
        ...p,
        amount: Number(p.amount),
        date: new Date(p.date || new Date()).toISOString(),
        chequeDate: p.chequeDate ? new Date(p.chequeDate).toISOString() : null,
      }));

      if (ledgerType === 'customers') {
        await updateInvoicePayment(paymentModalInvoice.id, confirmedPaid, paymentsPayload);
      } else {
        await updatePurchaseInvoicePayment(paymentModalInvoice.id, confirmedPaid, paymentsPayload);
      }
      setPaymentModalInvoice(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update payment records');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle quick settle all invoices for selected party
  const handleSettleAll = async () => {
    if (!activeParty) return;
    const confirmMessage = `Settle all pending bills to fully paid for ${activeParty.name}?`;
    if (!window.confirm(confirmMessage)) return;

    setIsUpdating(true);
    try {
      if (ledgerType === 'customers') {
        const customer = activeParty as Customer;
        const promises = (customer.invoices || [])
          .filter(inv => {
            const farm = getInvoiceFarmName(inv);
            if (selectedFarmFilter !== 'ALL' && farm !== selectedFarmFilter) return false;
            return inv.paidAmount < inv.totalAmount;
          })
          .map(inv => {
            const remaining = inv.totalAmount - inv.paidAmount;
            let currentPayments: any[] = [];
            if (inv.payments && Array.isArray(inv.payments)) {
              currentPayments = inv.payments.map((p: any) => ({
                ...p,
                amount: p.amount,
                date: new Date(p.date).toISOString(),
                paymentMethod: p.paymentMethod || 'CASH',
                paymentStatus: p.paymentStatus || 'COMPLETED',
              }));
            }
            if (currentPayments.length === 0 && inv.paidAmount > 0) {
              currentPayments = [{
                amount: inv.paidAmount,
                date: new Date(inv.invoiceDate).toISOString(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                notes: 'Initial recorded payment',
              }];
            }
            if (remaining > 0) {
              currentPayments.push({
                amount: remaining,
                date: new Date().toISOString(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                notes: 'Settle all balance cleared',
              });
            }
            return updateInvoicePayment(inv.id, inv.totalAmount, currentPayments);
          });
        await Promise.all(promises);
      } else {
        const supplier = activeParty as Mahajan;
        const promises = (supplier.purchaseInvoices || [])
          .filter(inv => {
            const farm = getInvoiceFarmName(inv);
            if (selectedFarmFilter !== 'ALL' && farm !== selectedFarmFilter) return false;
            return inv.paidAmount < inv.totalAmount;
          })
          .map(inv => {
            const remaining = inv.totalAmount - inv.paidAmount;
            let currentPayments: any[] = [];
            if (inv.payments && Array.isArray(inv.payments)) {
              currentPayments = inv.payments.map((p: any) => ({
                ...p,
                amount: p.amount,
                date: new Date(p.date).toISOString(),
                paymentMethod: p.paymentMethod || 'CASH',
                paymentStatus: p.paymentStatus || 'COMPLETED',
              }));
            }
            if (currentPayments.length === 0 && inv.paidAmount > 0) {
              currentPayments = [{
                amount: inv.paidAmount,
                date: new Date(inv.invoiceDate).toISOString(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                notes: 'Initial recorded payment',
              }];
            }
            if (remaining > 0) {
              currentPayments.push({
                amount: remaining,
                date: new Date().toISOString(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                notes: 'Bill settled',
              });
            }
            return updatePurchaseInvoicePayment(inv.id, inv.totalAmount, currentPayments);
          });
        await Promise.all(promises);
      }
      setRefreshTrigger(prev => prev + 1);
      alert('All accounts updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Error updating some transactions');
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter lists based on search
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    if (!matchesSearch) return false;
    if (selectedFarmFilter !== 'ALL') {
      const stats = getCustomerStats(c);
      return stats.total > 0;
    }
    return true;
  });

  const filteredSuppliers = mahajans.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone && m.phone.includes(searchQuery));
    if (!matchesSearch) return false;
    if (selectedFarmFilter !== 'ALL') {
      const stats = getSupplierStats(m);
      return stats.total > 0;
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* 1. Header and Quick Refresh */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="text-red-500" />
            Khata Book Ledgers
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wide">
              Credit Accounts
            </span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Real-time balance logs, net receivables, supplier payables monitoring, and fast invoice payment adjustments.
          </p>
        </div>

        <button
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Sync Ledgers
        </button>
      </div>

      {/* 2. Farm / Business Firm Filter Bar */}
      {uniqueFarmNames.length > 0 && (
        <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building size={12} className="text-[#004870]" /> Select Farm / Business Firm Ledger Context:
            </span>
            {selectedFarmFilter !== 'ALL' && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                Active Farm: {selectedFarmFilter}
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
              All Farms / Combined Khata
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

      {/* 3. Top Dashboard KPI Cards (Farm-Scoped) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Receivables from Customers */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-md border border-emerald-400/20">
          <div className="absolute right-4 top-4 opacity-15">
            <ArrowUpRight size={72} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-100 block">
            Total Receivables (Customers) {selectedFarmFilter !== 'ALL' ? `• ${selectedFarmFilter}` : ''}
          </span>
          <h3 className="text-3xl font-black mt-2 tracking-tight">
            {formatMoney(kpis.netReceivables)}
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-1 text-[10.5px] font-bold text-emerald-100">
            <TrendingDown size={13} className="text-emerald-200" />
            <span>Sales: {formatMoney(kpis.totalReceivable)}</span>
            {kpis.customerReturns > 0 && <span className="text-purple-100">| Returns: -{formatMoney(kpis.customerReturns)}</span>}
            <span>| Paid: {formatMoney(kpis.customerPaid)}</span>
          </div>
        </div>

        {/* Payables to Suppliers */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 text-white p-6 rounded-2xl shadow-md border border-orange-400/20">
          <div className="absolute right-4 top-4 opacity-15">
            <ArrowDownRight size={72} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-orange-100 block">
            Total Payables (Suppliers) {selectedFarmFilter !== 'ALL' ? `• ${selectedFarmFilter}` : ''}
          </span>
          <h3 className="text-3xl font-black mt-2 tracking-tight">
            {formatMoney(kpis.netPayables)}
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-1 text-[10.5px] font-bold text-orange-100">
            <TrendingUp size={13} className="text-orange-200" />
            <span>Purchases: {formatMoney(kpis.totalPayable)}</span>
            {kpis.supplierReturns > 0 && <span className="text-rose-100">| Returns: -{formatMoney(kpis.supplierReturns)}</span>}
            <span>| Paid: {formatMoney(kpis.supplierPaid)}</span>
          </div>
        </div>

        {/* Ledger Balance Index */}
        <div className="relative overflow-hidden bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
          <div className="absolute right-4 top-4 opacity-10">
            <Scale size={72} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block">
            Net Khata Margin (Receivable - Payable)
          </span>
          <h3 className={`text-3xl font-black mt-2 tracking-tight ${kpis.ledgerIndex >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {kpis.ledgerIndex >= 0 ? '+' : ''}{formatMoney(kpis.ledgerIndex)}
          </h3>
          <div className="mt-4 text-[11px] font-bold text-slate-400">
            {kpis.ledgerIndex >= 0 
              ? 'Store/Farm is in net surplus credit balance.' 
              : 'Store/Farm has net outstanding supplier payables.'}
          </div>
        </div>
      </div>

      {/* 4. Detail View Slide-out / Drawer */}
      {activeParty && (
        <div className="bg-white rounded-2xl border border-slate-350 shadow-md p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <button 
              onClick={() => {
                setSelectedPartyId(null);
              }}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-850 text-xs font-bold transition-all cursor-pointer print:hidden"
            >
              <ArrowLeft size={16} /> Close Ledger View
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                {ledgerType === 'customers' ? 'Customer Profile:' : 'Supplier Profile:'}
              </span>
              <h3 className="text-lg font-black text-slate-900">{activeParty.name}</h3>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={handleSendWhatsAppReminder}
                className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow cursor-pointer"
                title="Send ledger balance & payment reminder via WhatsApp"
              >
                <MessageCircle size={14} />
                WhatsApp Reminder
              </button>
              <button
                onClick={handleSettleAll}
                disabled={isUpdating}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow cursor-pointer"
              >
                <CheckCircle2 size={13} />
                Settle All Bills
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow cursor-pointer"
              >
                <Printer size={13} />
                Print Statement
              </button>
            </div>
          </div>

          {/* Party Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs font-semibold text-slate-700">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Phone</span>
              <span>{activeParty.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">GSTIN</span>
              <span className="font-mono">{activeParty.gstin || 'Consumer'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">State Context</span>
              <span>{activeParty.state ? `${activeParty.state} (${activeParty.stateCode || '--'})` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Address</span>
              <span className="truncate block max-w-xs">{activeParty.address || 'N/A'}</span>
            </div>
          </div>

          {/* Party Balance Breakdown Banner */}
          {(() => {
            const pStats = ledgerType === 'customers' ? getCustomerStats(activeParty as Customer) : getSupplierStats(activeParty as Mahajan);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                    {ledgerType === 'customers' ? 'Total Sales' : 'Total Purchases'}
                  </span>
                  <span className="text-sm font-black text-slate-800 mt-0.5 block">{formatMoney(pStats.total)}</span>
                </div>
                <div className="bg-purple-50/60 p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-extrabold uppercase text-purple-700 block">
                    {ledgerType === 'customers' ? '🔄 Confirmed Sale Returns' : '↩️ Confirmed Purchase Returns'}
                  </span>
                  <span className="text-sm font-black text-purple-800 mt-0.5 block">-{formatMoney(pStats.returns)}</span>
                  {pStats.pendingReturns > 0 && (
                    <span className="text-[9.5px] font-bold text-amber-700 block mt-0.5">
                      ⏳ {formatMoney(pStats.pendingReturns)} pending confirmation
                    </span>
                  )}
                </div>
                <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Confirmed Paid</span>
                  <span className="text-sm font-black text-emerald-800 mt-0.5 block">{formatMoney(pStats.paid)}</span>
                </div>
                <div className={`p-2.5 rounded-lg border ${pStats.debt > 0 ? 'bg-rose-50/70 border-rose-200 text-rose-700' : 'bg-emerald-50/70 border-emerald-200 text-emerald-700'}`}>
                  <span className="text-[10px] font-extrabold uppercase block">
                    {ledgerType === 'customers' ? 'Net Balance Due' : 'Net Balance Payable'}
                  </span>
                  <span className="text-sm font-black mt-0.5 block">{formatMoney(Math.max(0, pStats.debt))}</span>
                </div>
              </div>
            );
          })()}

          {/* Document Type Filter Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-2">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setDocTabFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  docTabFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Documents
              </button>
              <button
                type="button"
                onClick={() => setDocTabFilter('INVOICES')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  docTabFilter === 'INVOICES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ledgerType === 'customers' ? 'Sale Invoices' : 'Purchase Invoices'}
              </button>
              <button
                type="button"
                onClick={() => setDocTabFilter('RETURNS')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  docTabFilter === 'RETURNS'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100/60'
                }`}
              >
                <Undo2 size={12} />
                {ledgerType === 'customers' ? '🔄 Sale Returns (Credit Notes)' : '↩️ Purchase Returns (Debit Notes)'}
              </button>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              Returns stay pending until verified and confirmed into Khata
            </span>
          </div>

          {/* Ledger Invoice Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Farm / Store Context</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Invoice Amt</th>
                  <th className="py-3 px-4 text-right">Paid Amt</th>
                  <th className="py-3 px-4 text-right">Balance Debt</th>
                  <th className="py-3 px-4 text-center w-56 print:hidden">Update Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {ledgerType === 'customers' ? (
                  // Customers invoices
                  (activeParty as Customer).invoices?.filter(inv => {
                    const farm = getInvoiceFarmName(inv);
                    const matchesFarm = selectedFarmFilter === 'ALL' || farm === selectedFarmFilter;
                    if (!matchesFarm) return false;
                    const isRet = isInvoiceReturn(inv);
                    if (docTabFilter === 'INVOICES') return !isRet;
                    if (docTabFilter === 'RETURNS') return isRet;
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No {docTabFilter === 'RETURNS' ? 'sale returns' : docTabFilter === 'INVOICES' ? 'invoices' : 'records'} found for this client under the selected filter.
                      </td>
                    </tr>
                  ) : (
                    (activeParty as Customer).invoices
                      ?.filter(inv => {
                        const farm = getInvoiceFarmName(inv);
                        const matchesFarm = selectedFarmFilter === 'ALL' || farm === selectedFarmFilter;
                        if (!matchesFarm) return false;
                        const isRet = isInvoiceReturn(inv);
                        if (docTabFilter === 'INVOICES') return !isRet;
                        if (docTabFilter === 'RETURNS') return isRet;
                        return true;
                      })
                      .map((inv) => {
                        const debt = inv.totalAmount - inv.paidAmount;
                        const farmName = getInvoiceFarmName(inv);
                        let logData: any = {};
                        try {
                          logData = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
                        } catch { /* silent */ }
                        const isSaleReturn = logData?.docType === 'sale_return' || logData?.docType === 'credit_note' || inv.invoiceNo?.includes('-CR/') || inv.invoiceNo?.startsWith('CR/');
                        const returnStatus = getReturnStatus(inv);
                        const isPendingReturn = isSaleReturn && returnStatus === 'PENDING';
                        let itemsList: any[] = [];
                        try {
                          itemsList = typeof inv.itemsData === 'string' ? JSON.parse(inv.itemsData) : (inv.itemsData || []);
                        } catch { /* silent */ }

                        return (
                          <tr key={inv.id} className={`hover:bg-slate-50/30 transition-all font-medium ${isSaleReturn ? (isPendingReturn ? 'bg-amber-50/20' : 'bg-purple-50/20') : ''}`}>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{inv.invoiceNo}</span>
                                {isSaleReturn && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                    🔄 Credit Note
                                  </span>
                                )}
                                {isSaleReturn && isPendingReturn && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock size={8} /> Pending Verification
                                  </span>
                                )}
                                {isSaleReturn && !isPendingReturn && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 size={8} /> Adjusted in Khata
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[10px] font-bold">
                                <Building size={10} className="text-[#004870]" />
                                {farmName}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-bold">
                              {isSaleReturn ? (
                                <div>
                                  <span className="text-purple-700 font-black">- {formatMoney(inv.totalAmount)}</span>
                                  {isPendingReturn ? (
                                    <span className="text-[9px] font-bold text-amber-600 block">Not Adjusted</span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-600 block">Adjusted</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-900">{formatMoney(inv.totalAmount)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold">
                              {isSaleReturn ? (
                                <span className="text-slate-400 text-[10px]">--</span>
                              ) : (
                                <span className="text-emerald-700">{formatMoney(inv.paidAmount)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-black">
                              {isSaleReturn ? (
                                isPendingReturn ? (
                                  <span className="text-amber-700 text-[10px] font-bold">Pending Confirmation</span>
                                ) : (
                                  <span className="text-purple-700 text-[11px]">Credit -{formatMoney(inv.totalAmount)}</span>
                                )
                              ) : (
                                <span className={debt > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                  {debt > 0 ? formatMoney(debt) : 'Settled'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 print:hidden">
                              <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                {isSaleReturn ? (
                                  isPendingReturn ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleReturnStatus(inv, true)}
                                      disabled={isUpdating}
                                      className="flex items-center gap-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded shadow-xs cursor-pointer"
                                      title="Verify and adjust this credit note into customer's Khata"
                                    >
                                      <CheckCircle2 size={11} /> Confirm &amp; Adjust
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleReturnStatus(inv, true)}
                                      disabled={isUpdating}
                                      className="text-[9.5px] font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 bg-white px-2 py-0.5 rounded cursor-pointer"
                                      title="Mark return back to pending status"
                                    >
                                      Revert to Pending
                                    </button>
                                  )
                                ) : null}

                                <button
                                  onClick={() => {
                                    const log = logData;
                                    const upiId = localStorage.getItem('smartvyapar_upi_id') || '';
                                    const msg = generateInvoiceWhatsAppMessage({
                                      companyName: activeCompany?.name || 'SmartVyapar Merchant',
                                      invoiceNo: inv.invoiceNo,
                                      invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                      customerName: (activeParty as Customer).name,
                                      customerPhone: (activeParty as Customer).phone || undefined,
                                      items: Array.isArray(itemsList) ? itemsList.map((i: any) => ({ name: i.name, quantity: Number(i.quantity) || 1, unit: i.unit, rate: Number(i.rate) || 0 })) : [],
                                      totalAmount: inv.totalAmount,
                                      paidAmount: inv.paidAmount || 0,
                                      upiId: log?.upiId || upiId,
                                      bankName: log?.bankName,
                                      bankAccountNo: log?.bankAccountNo,
                                      bankIfsc: log?.bankIfsc,
                                      docType: log?.docType || (isSaleReturn ? 'sale_return' : 'sales'),
                                    });
                                    const invoiceData = {
                                      invoiceNo: inv.invoiceNo,
                                      invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                      docType: log?.docType || (isSaleReturn ? 'sale_return' : 'sales'),
                                      originalInvoiceNo: log?.originalInvoiceNo,
                                      originalInvoiceDate: log?.originalInvoiceDate,
                                      reasonForReturn: log?.reasonForReturn,
                                      sellerName: log?.sellerName || activeCompany?.name || 'SmartVyapar Merchant',
                                      sellerAddress: log?.sellerAddress || activeCompany?.address || '',
                                      sellerGSTIN: log?.sellerGSTIN || activeCompany?.gstin || '',
                                      sellerPhone: log?.sellerPhone || activeCompany?.phone || '',
                                      sellerEmail: log?.sellerEmail || activeCompany?.email || '',
                                      sellerState: log?.sellerState || 'Assam',
                                      sellerStateCode: log?.sellerStateCode || '18',
                                      sellerPAN: log?.sellerPAN || '',
                                      sellerFssai: log?.sellerFssai || '',
                                      buyerName: (activeParty as Customer).name,
                                      buyerAddress: (activeParty as Customer).address || log?.buyerAddress || '',
                                      buyerGSTIN: (activeParty as Customer).gstin || log?.buyerGSTIN || '',
                                      buyerPhone: (activeParty as Customer).phone || log?.buyerPhone || '',
                                      buyerState: (activeParty as Customer).state || log?.buyerState || '',
                                      buyerStateCode: (activeParty as Customer).stateCode || log?.buyerStateCode || '',
                                      items: Array.isArray(itemsList) ? itemsList : [],
                                      subtotal: inv.subtotal,
                                      totalGst: inv.totalGst,
                                      totalAmount: inv.totalAmount,
                                      paidAmount: inv.paidAmount || 0,
                                      isInterstate: inv.isInterstate || false,
                                      upiId: log?.upiId || upiId,
                                      bankName: log?.bankName,
                                      bankAccountNo: log?.bankAccountNo,
                                      bankIfsc: log?.bankIfsc,
                                      transport: log?.transport,
                                      vehicleNo: log?.vehicleNo,
                                      station: log?.station,
                                      grRrNo: log?.grRrNo,
                                      reverseCharge: log?.reverseCharge,
                                      freightAmt: log?.freightAmt,
                                      ewayBillNo: log?.ewayBillNo,
                                      orderNo: log?.orderNo,
                                      orderDate: log?.orderDate,
                                      irn: log?.irn,
                                      ackNo: log?.ackNo,
                                      ackDate: log?.ackDate,
                                    };
                                    setWhatsAppModalPayload({
                                      phone: (activeParty as Customer).phone || '',
                                      name: (activeParty as Customer).name,
                                      message: msg,
                                      title: `Share ${isSaleReturn ? 'Credit Note' : 'Invoice'} ${inv.invoiceNo} on WhatsApp`,
                                      invoiceNo: inv.invoiceNo,
                                      invoiceData,
                                    });
                                    setShowWhatsAppModal(true);
                                  }}
                                  title="Share this invoice on WhatsApp"
                                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 border border-emerald-300 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 cursor-pointer"
                                >
                                  <MessageCircle size={11} /> Share
                                </button>
                                {!isSaleReturn && (
                                  <>
                                    <button
                                      onClick={() => handleOpenPaymentModal(inv)}
                                      className="flex items-center gap-1 text-[10px] font-bold text-[#004870] border border-[#004870]/20 bg-slate-50 px-2 py-1 rounded hover:bg-[#004870]/5 cursor-pointer"
                                    >
                                      Edit Paid
                                    </button>
                                    <button
                                      onClick={async () => {
                                        setIsUpdating(true);
                                        try {
                                          const remaining = inv.totalAmount - inv.paidAmount;
                                          let currentPayments: any[] = [];
                                          if (inv.payments && Array.isArray(inv.payments)) {
                                            currentPayments = inv.payments.map((p: any) => ({
                                              ...p,
                                              amount: p.amount,
                                              date: new Date(p.date).toISOString(),
                                              paymentMethod: p.paymentMethod || 'CASH',
                                              paymentStatus: p.paymentStatus || 'COMPLETED',
                                            }));
                                          }
                                          if (currentPayments.length === 0 && inv.paidAmount > 0) {
                                            currentPayments = [{
                                              amount: inv.paidAmount,
                                              date: new Date(inv.invoiceDate).toISOString(),
                                              paymentMethod: 'CASH',
                                              paymentStatus: 'COMPLETED',
                                              notes: 'Initial recorded payment',
                                            }];
                                          }
                                          if (remaining > 0) {
                                            currentPayments.push({
                                              amount: remaining,
                                              date: new Date().toISOString(),
                                              paymentMethod: 'CASH',
                                              paymentStatus: 'COMPLETED',
                                              notes: 'Bill settled',
                                            });
                                          }
                                          await updateInvoicePayment(inv.id, inv.totalAmount, currentPayments);
                                          setRefreshTrigger(prev => prev + 1);
                                        } catch (err) {
                                          alert('Failed to settle invoice');
                                        } finally {
                                          setIsUpdating(false);
                                        }
                                      }}
                                      disabled={inv.paidAmount >= inv.totalAmount || isUpdating}
                                      className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-250 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                                    >
                                      Settle
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )
                ) : (
                  // Supplier purchase invoices
                  (activeParty as Mahajan).purchaseInvoices?.filter(inv => {
                    const farm = getInvoiceFarmName(inv);
                    const matchesFarm = selectedFarmFilter === 'ALL' || farm === selectedFarmFilter;
                    if (!matchesFarm) return false;
                    const isRet = isInvoiceReturn(inv);
                    if (docTabFilter === 'INVOICES') return !isRet;
                    if (docTabFilter === 'RETURNS') return isRet;
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No {docTabFilter === 'RETURNS' ? 'purchase returns' : docTabFilter === 'INVOICES' ? 'purchase invoices' : 'records'} archived for this supplier under the selected filter.
                      </td>
                    </tr>
                  ) : (
                    (activeParty as Mahajan).purchaseInvoices
                      ?.filter(inv => {
                        const farm = getInvoiceFarmName(inv);
                        const matchesFarm = selectedFarmFilter === 'ALL' || farm === selectedFarmFilter;
                        if (!matchesFarm) return false;
                        const isRet = isInvoiceReturn(inv);
                        if (docTabFilter === 'INVOICES') return !isRet;
                        if (docTabFilter === 'RETURNS') return isRet;
                        return true;
                      })
                      .map((inv) => {
                        const debt = inv.totalAmount - inv.paidAmount;
                        const farmName = getInvoiceFarmName(inv);
                        let logData: any = {};
                        try {
                          logData = typeof inv.logisticsData === 'string' ? JSON.parse(inv.logisticsData) : (inv.logisticsData || {});
                        } catch { /* silent */ }
                        const isPurchaseReturn = logData?.docType === 'purchase_return' || logData?.docType === 'debit_note' || inv.invoiceNo?.includes('-DR/') || inv.invoiceNo?.startsWith('DR/');
                        const returnStatus = getReturnStatus(inv);
                        const isPendingReturn = isPurchaseReturn && returnStatus === 'PENDING';
                        let itemsList: any[] = [];
                        try {
                          itemsList = typeof inv.itemsData === 'string' ? JSON.parse(inv.itemsData) : (inv.itemsData || []);
                        } catch { /* silent */ }

                        return (
                          <tr key={inv.id} className={`hover:bg-slate-50/30 transition-all font-medium ${isPurchaseReturn ? (isPendingReturn ? 'bg-amber-50/20' : 'bg-rose-50/20') : ''}`}>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{inv.invoiceNo}</span>
                                {isPurchaseReturn && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                    ↩️ Debit Note
                                  </span>
                                )}
                                {isPurchaseReturn && isPendingReturn && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock size={8} /> Pending Verification
                                  </span>
                                )}
                                {isPurchaseReturn && !isPendingReturn && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 size={8} /> Adjusted in Khata
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-950 border border-orange-200 rounded-md text-[10px] font-bold">
                                <Building size={10} className="text-orange-600" />
                                {farmName}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-bold">
                              {isPurchaseReturn ? (
                                <div>
                                  <span className="text-rose-700 font-black">- {formatMoney(inv.totalAmount)}</span>
                                  {isPendingReturn ? (
                                    <span className="text-[9px] font-bold text-amber-600 block">Not Adjusted</span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-600 block">Adjusted</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-900">{formatMoney(inv.totalAmount)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold">
                              {isPurchaseReturn ? (
                                <span className="text-slate-400 text-[10px]">--</span>
                              ) : (
                                <span className="text-emerald-700">{formatMoney(inv.paidAmount)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-black">
                              {isPurchaseReturn ? (
                                isPendingReturn ? (
                                  <span className="text-amber-700 text-[10px] font-bold">Pending Confirmation</span>
                                ) : (
                                  <span className="text-rose-700 text-[11px]">Debit -{formatMoney(inv.totalAmount)}</span>
                                )
                              ) : (
                                <span className={debt > 0 ? 'text-orange-600' : 'text-emerald-600'}>
                                  {debt > 0 ? formatMoney(debt) : 'Settled'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 print:hidden">
                              <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                {isPurchaseReturn ? (
                                  isPendingReturn ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleReturnStatus(inv, false)}
                                      disabled={isUpdating}
                                      className="flex items-center gap-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded shadow-xs cursor-pointer"
                                      title="Verify and adjust this debit note into supplier's Khata"
                                    >
                                      <CheckCircle2 size={11} /> Confirm &amp; Adjust
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleReturnStatus(inv, false)}
                                      disabled={isUpdating}
                                      className="text-[9.5px] font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 bg-white px-2 py-0.5 rounded cursor-pointer"
                                      title="Mark return back to pending status"
                                    >
                                      Revert to Pending
                                    </button>
                                  )
                                ) : null}

                                <button
                                  onClick={() => {
                                    const log = logData;
                                    const upiId = localStorage.getItem('smartvyapar_upi_id') || '';
                                    const msg = generateInvoiceWhatsAppMessage({
                                      companyName: activeCompany?.name || 'SmartVyapar Merchant',
                                      invoiceNo: inv.invoiceNo,
                                      invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                      customerName: (activeParty as Mahajan).name,
                                      customerPhone: (activeParty as Mahajan).phone || undefined,
                                      items: Array.isArray(itemsList) ? itemsList.map((i: any) => ({ name: i.name, quantity: Number(i.quantity) || 1, unit: i.unit, rate: Number(i.rate) || 0 })) : [],
                                      totalAmount: inv.totalAmount,
                                      paidAmount: inv.paidAmount || 0,
                                      upiId: log?.upiId || upiId,
                                      bankName: log?.bankName,
                                      bankAccountNo: log?.bankAccountNo,
                                      bankIfsc: log?.bankIfsc,
                                      docType: log?.docType || (isPurchaseReturn ? 'purchase_return' : 'purchase'),
                                    });
                                    const invoiceData = {
                                      invoiceNo: inv.invoiceNo,
                                      invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
                                      docType: log?.docType || (isPurchaseReturn ? 'purchase_return' : 'purchase'),
                                      originalInvoiceNo: log?.originalInvoiceNo,
                                      originalInvoiceDate: log?.originalInvoiceDate,
                                      reasonForReturn: log?.reasonForReturn,
                                      sellerName: (activeParty as Mahajan).name,
                                      sellerAddress: (activeParty as Mahajan).address || log?.sellerAddress || '',
                                      sellerGSTIN: (activeParty as Mahajan).gstin || log?.sellerGSTIN || '',
                                      sellerPhone: (activeParty as Mahajan).phone || log?.sellerPhone || '',
                                      sellerEmail: log?.sellerEmail || '',
                                      sellerState: (activeParty as Mahajan).state || log?.sellerState || 'Assam',
                                      sellerStateCode: (activeParty as Mahajan).stateCode || log?.sellerStateCode || '18',
                                      sellerPAN: (activeParty as any).pan || log?.sellerPAN || '',
                                      sellerFssai: (activeParty as any).fssai || log?.sellerFssai || '',
                                      buyerName: log?.buyerName || activeCompany?.name || 'SmartVyapar Merchant',
                                      buyerAddress: log?.buyerAddress || activeCompany?.address || '',
                                      buyerGSTIN: log?.buyerGSTIN || activeCompany?.gstin || '',
                                      buyerPhone: log?.buyerPhone || activeCompany?.phone || '',
                                      buyerState: log?.buyerState || 'Assam',
                                      buyerStateCode: log?.buyerStateCode || '18',
                                      items: Array.isArray(itemsList) ? itemsList : [],
                                      subtotal: inv.subtotal,
                                      totalGst: inv.totalGst,
                                      totalAmount: inv.totalAmount,
                                      paidAmount: inv.paidAmount || 0,
                                      isInterstate: inv.isInterstate || false,
                                      upiId: log?.upiId || upiId,
                                      bankName: log?.bankName,
                                      bankAccountNo: log?.bankAccountNo,
                                      bankIfsc: log?.bankIfsc,
                                    };
                                    setWhatsAppModalPayload({
                                      phone: (activeParty as Mahajan).phone || '',
                                      name: (activeParty as Mahajan).name,
                                      message: msg,
                                      title: `Share ${isPurchaseReturn ? 'Debit Note' : 'Purchase Invoice'} ${inv.invoiceNo} on WhatsApp`,
                                      invoiceNo: inv.invoiceNo,
                                      invoiceData,
                                    });
                                    setShowWhatsAppModal(true);
                                  }}
                                  title="Share on WhatsApp"
                                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 border border-emerald-300 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 cursor-pointer"
                                >
                                  <MessageCircle size={11} /> Share
                                </button>
                                {!isPurchaseReturn && (
                                  <>
                                    <button
                                      onClick={() => handleOpenPaymentModal(inv)}
                                      className="flex items-center gap-1 text-[10px] font-bold text-[#004870] border border-[#004870]/20 bg-slate-50 px-2 py-1 rounded hover:bg-[#004870]/5 cursor-pointer"
                                    >
                                      Edit Paid
                                    </button>
                                    <button
                                      onClick={async () => {
                                        setIsUpdating(true);
                                        try {
                                          const remaining = inv.totalAmount - inv.paidAmount;
                                          let currentPayments: any[] = [];
                                          if (inv.payments && Array.isArray(inv.payments)) {
                                            currentPayments = inv.payments.map((p: any) => ({
                                              ...p,
                                              amount: p.amount,
                                              date: new Date(p.date).toISOString(),
                                              paymentMethod: p.paymentMethod || 'CASH',
                                              paymentStatus: p.paymentStatus || 'COMPLETED',
                                            }));
                                          }
                                          if (currentPayments.length === 0 && inv.paidAmount > 0) {
                                            currentPayments = [{
                                              amount: inv.paidAmount,
                                              date: new Date(inv.invoiceDate).toISOString(),
                                              paymentMethod: 'CASH',
                                              paymentStatus: 'COMPLETED',
                                              notes: 'Initial recorded payment',
                                            }];
                                          }
                                          if (remaining > 0) {
                                            currentPayments.push({
                                              amount: remaining,
                                              date: new Date().toISOString(),
                                              paymentMethod: 'CASH',
                                              paymentStatus: 'COMPLETED',
                                              notes: 'Bill settled',
                                            });
                                          }
                                          await updatePurchaseInvoicePayment(inv.id, inv.totalAmount, currentPayments);
                                          setRefreshTrigger(prev => prev + 1);
                                        } catch (err) {
                                          alert('Failed to settle invoice');
                                        } finally {
                                          setIsUpdating(false);
                                        }
                                      }}
                                      disabled={inv.paidAmount >= inv.totalAmount || isUpdating}
                                      className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-250 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                                    >
                                      Settle
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Filter Controls and Tab Toggles */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setLedgerType('customers');
              setSelectedPartyId(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
              ledgerType === 'customers'
                ? 'bg-[#004870] text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={14} />
            Customer Khata (Receivables)
          </button>
          <button
            onClick={() => {
              setLedgerType('mahajans');
              setSelectedPartyId(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
              ledgerType === 'mahajans'
                ? 'bg-orange-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={14} />
            Supplier Khata (Payables / Jama)
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={ledgerType === 'customers' ? "Search customers..." : "Search suppliers..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-350"
          />
        </div>
      </div>

      {/* 6. Directory Accounts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        {isLoading ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-700 border-t-transparent"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Compiling credit directory...</p>
          </div>
        ) : (ledgerType === 'customers' ? filteredCustomers.length : filteredSuppliers.length) === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-250 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <BookOpen size={28} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">No Outstanding Accounts Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your entries matched no active search or there are no accounts registered under this farm filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Name / Company</th>
                  <th className="py-4 px-4">Contact info</th>
                  <th className="py-4 px-4 text-right">Total Invoiced</th>
                  <th className="py-4 px-4 text-right">Total Paid</th>
                  <th className="py-4 px-4 text-right">Balance Due</th>
                  <th className="py-4 px-6 text-center w-40 print:hidden">Ledger Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {ledgerType === 'customers' ? (
                  // Customers Table Rows
                  filteredCustomers.map(c => {
                    const stats = getCustomerStats(c);
                    const isSelected = selectedPartyId === c.id;
                    return (
                      <tr 
                        key={c.id}
                        onClick={() => setSelectedPartyId(c.id)}
                        className={`hover:bg-slate-50/50 transition-all cursor-pointer ${
                          isSelected ? 'bg-slate-50' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-900 text-sm">{c.name}</div>
                          {c.gstin && (
                            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">GSTIN: {c.gstin}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-500 text-xs">
                          <div>{c.phone || '--'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.email}</div>
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-slate-700 text-xs">
                          {formatMoney(stats.total)}
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-emerald-600 text-xs">
                          {formatMoney(stats.paid)}
                        </td>
                        <td className="py-4 px-4 text-right text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-black text-[11px] ${
                            stats.debt > 0 
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {stats.debt > 0 ? formatMoney(stats.debt) : 'Settled'}
                          </span>
                        </td>
                        <td className="py-4 px-6 print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartyId(c.id);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-[#004870] hover:bg-[#003859] text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye size={12} />
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // Supplier Table Rows
                  filteredSuppliers.map(m => {
                    const stats = getSupplierStats(m);
                    const isSelected = selectedPartyId === m.id;
                    return (
                      <tr 
                        key={m.id}
                        onClick={() => setSelectedPartyId(m.id)}
                        className={`hover:bg-slate-50/50 transition-all cursor-pointer ${
                          isSelected ? 'bg-slate-50' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-900 text-sm">{m.name}</div>
                          {m.gstin && (
                            <div className="text-[9px] font-bold text-orange-600 uppercase tracking-wide">GSTIN: {m.gstin}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-500 text-xs">
                          <div>{m.phone || '--'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{m.email}</div>
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-slate-700 text-xs">
                          {formatMoney(stats.total)}
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-emerald-600 text-xs">
                          {formatMoney(stats.paid)}
                        </td>
                        <td className="py-4 px-4 text-right text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-black text-[11px] ${
                            stats.debt > 0 
                              ? 'bg-orange-50 text-orange-600 border border-orange-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {stats.debt > 0 ? formatMoney(stats.debt) : 'Settled'}
                          </span>
                        </td>
                        <td className="py-4 px-6 print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartyId(m.id);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye size={12} />
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History & Entry Modal */}
      {paymentModalInvoice && (() => {
        const totalConfirmed = paymentList
          .filter(p => !p.paymentStatus || p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'CLEARED')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const totalPending = paymentList
          .filter(p => p.paymentStatus === 'PENDING')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const balanceDue = Math.max(0, paymentModalInvoice.totalAmount - totalConfirmed);
        const isSettled = balanceDue <= 0;
        const invoiceFarm = getInvoiceFarmName(paymentModalInvoice);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-emerald-400" />
                    <h3 className="font-extrabold text-base">Payment History &amp; Records</h3>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Building size={10} /> {invoiceFarm}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-semibold tracking-wide mt-0.5">
                    Invoice #{paymentModalInvoice.invoiceNo} &bull; Total: {formatMoney(paymentModalInvoice.totalAmount)}
                  </p>
                </div>
                <button
                  onClick={() => setPaymentModalInvoice(null)}
                  className="text-slate-400 hover:text-white transition-all text-2xl font-bold cursor-pointer leading-none p-1"
                >
                  &times;
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1">
                {/* Financial Summary */}
                <div className={`grid ${totalPending > 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'} gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-center font-semibold text-slate-700`}>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Total Invoice</span>
                    <span className="font-extrabold text-slate-900 text-sm">{formatMoney(paymentModalInvoice.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Total Paid</span>
                    <span className="font-extrabold text-emerald-600 text-sm">{formatMoney(totalConfirmed)}</span>
                  </div>
                  {totalPending > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-amber-600 block uppercase tracking-wider">Pending</span>
                      <span className="font-extrabold text-amber-600 text-sm">{formatMoney(totalPending)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Balance Due</span>
                    <span className={`font-extrabold text-sm ${balanceDue > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {balanceDue > 0 ? formatMoney(balanceDue) : 'Settled'}
                    </span>
                  </div>
                </div>

                {/* Recorded Payments List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Recorded Payments ({paymentList.length})
                    </h4>
                    {isSettled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={12} /> Confirmed Settled
                      </span>
                    )}
                  </div>

                  {paymentList.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-semibold">
                      No payment records added for this invoice yet.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                      {paymentList.map((p, idx) => {
                        const methodKey = (p.paymentMethod as PaymentMethod) || 'CASH';
                        const methodDef = PAYMENT_METHODS[methodKey] || PAYMENT_METHODS.CASH;
                        const statusKey = (p.paymentStatus as PaymentStatus) || 'COMPLETED';
                        const statusDef = PAYMENT_STATUS_CONFIG[statusKey] || PAYMENT_STATUS_CONFIG.COMPLETED;
                        const isEditingThis = editingPaymentId === p.id;

                        return (
                          <div
                            key={p.id || idx}
                            className={`p-3 rounded-xl text-xs transition-all space-y-1.5 border ${
                              isEditingThis
                                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-300'
                                : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {/* Left details */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-slate-500 font-semibold text-[11px]">
                                    {new Date(p.date || new Date()).toLocaleDateString('en-IN')}
                                  </span>
                                  
                                  {/* Payment Method Badge */}
                                  <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-800 text-[11px] shadow-2xs">
                                    <span>{methodDef.emoji}</span>
                                    <span>{methodDef.label}</span>
                                  </span>

                                  {/* Payment Status Badge */}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-extrabold text-[10px] border ${statusDef.bg} ${statusDef.text} ${statusDef.border}`}>
                                    {statusDef.label}
                                  </span>

                                  {isEditingThis && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-extrabold text-[10px] bg-blue-600 text-white animate-pulse">
                                      Editing Now...
                                    </span>
                                  )}
                                </div>

                                {/* Dynamic subtitle / meta */}
                                <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap font-medium pl-0.5">
                                  {p.provider && (
                                    <span className="bg-slate-200/50 px-1.5 py-0.2 rounded text-slate-700">
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
                                      {p.cardType || 'Card'} ending ••••{p.cardLastFour}
                                    </span>
                                  )}
                                  {p.senderMobileMasked && (
                                    <span className="text-slate-500">
                                      From: {p.senderMobileMasked}
                                    </span>
                                  )}
                                  {p.receivedBy && (
                                    <span className="text-slate-600">
                                      Recv by: {p.receivedBy}
                                    </span>
                                  )}
                                  {p.referenceNumber && (
                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                      Ref: {p.referenceNumber}
                                    </span>
                                  )}
                                  {p.notes && (
                                    <span className="text-slate-400 italic">
                                      "{p.notes}"
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Amount & Actions */}
                              <div className="text-right space-y-1 shrink-0">
                                <div className="font-black text-slate-900 text-sm">
                                  {formatMoney(Number(p.amount || 0))}
                                </div>
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditPayment(p)}
                                    className={`font-extrabold px-2 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1 text-[9.5px] ${
                                      isEditingThis
                                        ? 'bg-blue-600 text-white'
                                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                    }`}
                                    title="Edit payment amount or details"
                                  >
                                    <Edit3 size={10} /> {isEditingThis ? 'Editing' : 'Edit'}
                                  </button>

                                  {/* Cheque Status Toggles */}
                                  {methodKey === 'CHEQUE' && (
                                    statusKey === 'PENDING' ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePaymentStatus(p.id, 'CLEARED')}
                                          className="text-[9px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                        >
                                          Mark Cleared
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePaymentStatus(p.id, 'BOUNCED')}
                                          className="text-[9px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                        >
                                          Bounced
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePaymentStatus(p.id, 'PENDING')}
                                        className="text-[9px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                      >
                                        Set Pending
                                      </button>
                                    )
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingPaymentId === p.id) {
                                        handleCancelEditPayment();
                                      }
                                      setPaymentList(paymentList.filter(item => item.id !== p.id));
                                    }}
                                    className="text-rose-600 hover:text-rose-800 font-extrabold hover:bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                    title="Delete payment record"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add / Edit Payment Form */}
                <div className={`p-4 rounded-xl space-y-3.5 font-semibold text-slate-700 border transition-all ${
                  editingPaymentId ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {editingPaymentId ? (
                        <span className="text-blue-700 flex items-center gap-1">
                          <Edit3 size={13} /> Editing Payment Record
                        </span>
                      ) : (
                        <span>Add New Payment</span>
                      )}
                    </span>
                    {editingPaymentId ? (
                      <button
                        type="button"
                        onClick={handleCancelEditPayment}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        ✕ Cancel Edit
                      </button>
                    ) : (
                      balanceDue > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewPaymentAmount(balanceDue)}
                          className="text-[10px] font-bold text-[#004870] hover:underline cursor-pointer"
                        >
                          Fill Full Balance ({formatMoney(balanceDue)})
                        </button>
                      )
                    )}
                  </h4>

                  {/* Top Row: Amount & Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                        Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                        Payment Date *
                      </label>
                      <input
                        type="date"
                        value={newPaymentDate}
                        onChange={(e) => setNewPaymentDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector Grid */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                      Select Payment Mode *
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {PAYMENT_METHOD_OPTIONS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => handleMethodChange(m.key)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedMethod === m.key
                              ? 'bg-[#004870] text-white border-[#004870] shadow-sm font-black'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50 font-bold'
                          }`}
                        >
                          <span className="text-base leading-none mb-1">{m.emoji}</span>
                          <span className="text-[10px] leading-tight line-clamp-1">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Fields Based on Method */}
                  {selectedMethod === 'UPI_QR' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">UPI App / Provider</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="PhonePe">PhonePe</option>
                          <option value="Google Pay">Google Pay (GPay)</option>
                          <option value="Paytm">Paytm</option>
                          <option value="BHIM UPI">BHIM UPI</option>
                          <option value="Cred">Cred</option>
                          <option value="Amazon Pay">Amazon Pay</option>
                          <option value="Other UPI">Other UPI</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">Mode Type</label>
                        <select
                          value={paymentSubType}
                          onChange={(e) => setPaymentSubType(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="QR Scan">QR Code Scan</option>
                          <option value="VPA / UPI ID">Direct VPA / UPI ID</option>
                          <option value="Payment Link">Payment Link</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">UPI Ref / UTR / Txn ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 329182391023"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'BANK_TRANSFER' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">Transfer Type</label>
                        <select
                          value={transferType}
                          onChange={(e) => setTransferType(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="IMPS">IMPS (Instant)</option>
                          <option value="NEFT">NEFT</option>
                          <option value="RTGS">RTGS</option>
                          <option value="Intra-Bank">Intra-Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. SBI, HDFC, ICICI"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-blue-900 block mb-1 uppercase">UTR / Reference No.</label>
                        <input
                          type="text"
                          placeholder="Bank UTR Number"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'MOBILE_TRANSFER' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-purple-50/50 rounded-xl border border-purple-100 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[9px] font-bold text-purple-900 block mb-1 uppercase">Platform / App</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-white border border-purple-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="PhonePe Mobile">PhonePe Number</option>
                          <option value="GPay Mobile">GPay Number</option>
                          <option value="Paytm Mobile">Paytm Wallet / Number</option>
                          <option value="WhatsApp Pay">WhatsApp Pay</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-purple-900 block mb-1 uppercase">Sender Mobile</label>
                        <input
                          type="text"
                          placeholder="10-digit Mobile"
                          value={senderMobile}
                          onChange={(e) => setSenderMobile(e.target.value)}
                          className="w-full bg-white border border-purple-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-purple-900 block mb-1 uppercase">Txn / Ref ID</label>
                        <input
                          type="text"
                          placeholder="Ref ID"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-white border border-purple-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedMethod === 'DEBIT_CARD' || selectedMethod === 'CREDIT_CARD') && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[9px] font-bold text-indigo-900 block mb-1 uppercase">Card Network</label>
                        <select
                          value={cardType}
                          onChange={(e) => setCardType(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="Visa">Visa</option>
                          <option value="MasterCard">MasterCard</option>
                          <option value="RuPay">RuPay</option>
                          <option value="Amex">American Express</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-indigo-900 block mb-1 uppercase">Card Last 4 Digits</label>
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="e.g. 4821"
                          value={cardLastFour}
                          onChange={(e) => setCardLastFour(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-indigo-900 block mb-1 uppercase">POS / Auth Code</label>
                        <input
                          type="text"
                          placeholder="Auth / Batch No."
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'CHEQUE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-amber-50/50 rounded-xl border border-amber-200 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Cheque Number *</label>
                        <input
                          type="text"
                          placeholder="6-digit Cheque No."
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-xs font-bold text-amber-950"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Cheque Date</label>
                        <input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-amber-900 block mb-1 uppercase">Issuing Bank</label>
                        <input
                          type="text"
                          placeholder="Bank Name & Branch"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                      Notes / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid in cash at counter, Part-payment received"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004870]"
                    />
                  </div>

                  {editingPaymentId ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEditPayment}
                        className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditPayment}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Save size={14} /> Update Payment Record
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddPaymentEntry}
                      className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 rounded-xl shadow transition-all cursor-pointer"
                    >
                      + Add Payment Record to List
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePayments}
                  disabled={isUpdating}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {isUpdating ? 'Saving Records...' : 'Save & Update Ledger'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detailed Document / Return Items Inspection Modal */}
      {viewingDocItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between shrink-0 ${viewingDocItems.isReturn ? 'bg-purple-50/70 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${viewingDocItems.isReturn ? 'bg-purple-600 text-white shadow-sm' : 'bg-[#004870] text-white shadow-sm'}`}>
                  {viewingDocItems.isReturn ? <Undo2 size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      {viewingDocItems.docTypeTitle}
                    </h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${viewingDocItems.isReturn ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                      {viewingDocItems.inv.invoiceNo}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Party: <strong className="text-slate-800">{viewingDocItems.partyName}</strong> • Date: {new Date(viewingDocItems.inv.invoiceDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocItems(null)}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center border border-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Return Reference & Reason Alert (if return) */}
              {viewingDocItems.isReturn && (
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs uppercase tracking-wide">
                    <AlertCircle size={15} className="text-purple-700" />
                    Sale / Purchase Return Audit Context
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 pt-1">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-purple-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Original Invoice Ref:</span>
                      <strong className="font-mono text-slate-900 text-xs">
                        {viewingDocItems.logData?.originalInvoiceNo || 'N/A'}
                      </strong>
                      {viewingDocItems.logData?.originalInvoiceDate && (
                        <span className="text-slate-500 text-[11px] block mt-0.5">
                          Dated: {new Date(viewingDocItems.logData.originalInvoiceDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-purple-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Reason for Return:</span>
                      <strong className="text-purple-950 text-xs block">
                        {viewingDocItems.logData?.reasonForReturn || 'Customer / Supplier stock return'}
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
                    {viewingDocItems.isReturn ? 'Returned Items & Goods List' : 'Billed Line Items'} ({viewingDocItems.itemsList.length})
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
                        <th className="py-2.5 px-3 text-center">Packing / Loose</th>
                        <th className="py-2.5 px-3 text-center">Returned Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">GST %</th>
                        <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {viewingDocItems.itemsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold">
                            No individual line items parsed for this record.
                          </td>
                        </tr>
                      ) : (
                        viewingDocItems.itemsList.map((it: any, idx: number) => {
                          const qty = Number(it.quantity) || 1;
                          const rate = Number(it.rate) || 0;
                          const gstRate = Number(it.gstRate) || 0;
                          const base = qty * rate;
                          const lineGst = (base * gstRate) / 100;
                          const lineTotal = base + lineGst;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                <div>{it.name || 'Custom Product'}</div>
                                {it.hsn && <span className="text-[9.5px] font-mono text-slate-400 font-normal">HSN: {it.hsn}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                                {it.packing || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900">
                                {qty} {it.unit || 'CTN'}
                                {Number(it.looseQty) > 0 && <span className="text-amber-700 block text-[10px]">+{it.looseQty} loose</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                                ₹{rate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {gstRate}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                                ₹{lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                        <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider">
                          {viewingDocItems.isReturn ? 'Total Returned Value (Credit/Debit):' : 'Grand Total Amount:'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono text-sm ${viewingDocItems.isReturn ? 'text-purple-700' : 'text-[#004870]'}`}>
                          {viewingDocItems.isReturn ? '-' : ''}{formatMoney(viewingDocItems.inv.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-bold text-slate-500">
                {viewingDocItems.isReturn ? '✓ This amount directly reduces outstanding balance in Khatabook' : '✓ Active invoice in ledger'}
              </span>
              <button
                type="button"
                onClick={() => setViewingDocItems(null)}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold py-2 px-5 rounded-xl transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
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
