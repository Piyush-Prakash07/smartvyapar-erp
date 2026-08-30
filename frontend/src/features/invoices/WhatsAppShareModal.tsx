import { useState } from 'react';
import { 
  MessageCircle, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Phone, 
  AlertCircle, 
  FileDown, 
  Send,
  Share2,
  CheckCircle2,
  Loader2,
  FileCheck
} from 'lucide-react';
import { openWhatsApp, sanitizeIndianPhone, getWhatsAppWebUrl, getWhatsAppUniversalUrl } from '../../lib/whatsapp';
import { 
  generateDirectInvoicePdfBlob,
  downloadDirectInvoicePdf, 
  sharePdfViaNativeShare,
  isNativeFileShareSupported 
} from '../../lib/pdfGenerator';
import type { InvoiceTemplateData } from './InvoicePrintTemplate';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultRecipientName?: string;
  messageText: string;
  title?: string;
  invoiceNo?: string;
  printableElementId?: string;
  invoiceData?: InvoiceTemplateData;
}

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  defaultPhone = '',
  defaultRecipientName = 'Customer',
  messageText,
  title = 'Send Invoice on WhatsApp',
  invoiceNo,
  invoiceData,
}: WhatsAppShareModalProps) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [copiedText, setCopiedText] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [pdfSharedViaApp, setPdfSharedViaApp] = useState(false);
  const [desktopPdfGuidance, setDesktopPdfGuidance] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanPhone = sanitizeIndianPhone(phone);
  const isValidPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91');
  const safeInvoiceName = (invoiceNo || invoiceData?.invoiceNo || 'Tax_Invoice').replace(/[/\\?%*:|"<>]/g, '_');
  const pdfFileName = `Invoice_${safeInvoiceName}.pdf`;

  // Resolved invoice data for pure vector PDF generation
  const resolvedData: InvoiceTemplateData = invoiceData || {
    invoiceNo: invoiceNo || 'INV-001',
    invoiceDate: new Date().toISOString(),
    buyerName: defaultRecipientName,
    buyerPhone: phone,
    sellerName: 'Tax Invoice',
    items: [],
  };

  // Copy text summary
  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // 1. Featured Primary: Direct PDF WhatsApp Sender
  const handleSendPdfOnWhatsApp = async () => {
    setIsProcessingPdf(true);
    setErrorMessage(null);
    setDesktopPdfGuidance(false);

    try {
      // 1. Generate crisp vector PDF
      const blob = await generateDirectInvoicePdfBlob(resolvedData);

      // 2. Check if native device share (mobile / OS share) supports PDF attachment
      const hasNativeShare = isNativeFileShareSupported();

      if (hasNativeShare) {
        const shared = await sharePdfViaNativeShare(blob, pdfFileName, messageText);
        if (shared) {
          setPdfSharedViaApp(true);
          setTimeout(() => setPdfSharedViaApp(false), 4000);
          setIsProcessingPdf(false);
          return;
        }
      }

      // 3. Desktop WhatsApp Web Flow:
      // Download the PDF file directly to user's computer
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // Launch WhatsApp Web directly to customer's chat
      openWhatsApp(phone, messageText, true);

      setPdfDownloaded(true);
      setDesktopPdfGuidance(true);
    } catch (err: any) {
      console.error('PDF Send failed:', err);
      setErrorMessage('Could not process PDF. Please try downloading manually.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 2. Direct PDF Download Only
  const handleDownloadPdfOnly = async () => {
    setIsProcessingPdf(true);
    setErrorMessage(null);
    try {
      const success = await downloadDirectInvoicePdf(resolvedData, pdfFileName);
      if (success) {
        setPdfDownloaded(true);
        setTimeout(() => setPdfDownloaded(false), 3500);
      } else {
        setErrorMessage('Download failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Could not generate PDF download.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const webUrl = getWhatsAppWebUrl(phone, messageText);
  const universalUrl = getWhatsAppUniversalUrl(phone, messageText);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#25D366] px-6 py-4 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-xl">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">{title}</h3>
              <p className="text-[11px] text-white/90 font-medium">Billed To: <strong className="text-white font-bold">{defaultRecipientName}</strong></p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          
          {/* Phone Number Input */}
          <div>
            <label className="text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
              Recipient WhatsApp Mobile Number
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-2.5 flex items-center gap-1 text-xs font-bold text-slate-500 pointer-events-none">
                <Phone size={13} className="text-emerald-600" />
                <span>+91</span>
              </div>
              <input
                type="text"
                placeholder="Enter 10-digit mobile (e.g. 9876543210)"
                value={phone.replace(/^(\+91|91)/, '')}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-14 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366] transition-all"
              />
            </div>
            {!isValidPhone && phone.trim() !== '' && (
              <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> Enter a valid 10-digit Indian mobile number.
              </p>
            )}
          </div>

          {/* Primary Featured Action: Send PDF on WhatsApp */}
          <button
            type="button"
            disabled={isProcessingPdf}
            onClick={handleSendPdfOnWhatsApp}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white p-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-between group disabled:opacity-75"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                {isProcessingPdf ? (
                  <Loader2 size={20} className="animate-spin text-white" />
                ) : (
                  <Share2 size={20} className="text-white group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div>
                <span className="text-sm font-black tracking-tight block">
                  {isProcessingPdf ? 'Preparing Invoice PDF...' : 'Send Invoice PDF on WhatsApp'}
                </span>
                <span className="text-[10.5px] text-emerald-100 font-medium">
                  {isNativeFileShareSupported() 
                    ? '1-Click Direct attachment to WhatsApp' 
                    : 'Downloads PDF & opens customer chat on WhatsApp Web'}
                </span>
              </div>
            </div>
            <Send size={16} className="text-white/80 group-hover:translate-x-1 transition-transform mr-1" />
          </button>

          {/* Download PDF Action Button */}
          <button
            type="button"
            disabled={isProcessingPdf}
            onClick={handleDownloadPdfOnly}
            className="w-full bg-blue-50/80 hover:bg-blue-100 border border-blue-200 p-3 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 text-blue-700">
                {pdfDownloaded ? <FileCheck size={16} className="text-emerald-600" /> : <FileDown size={16} />}
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 block">
                  {pdfDownloaded ? '✅ PDF Invoice Downloaded!' : 'Download Official A4 PDF File'}
                </span>
                <span className="text-[10px] text-blue-700 font-medium">
                  Save vector PDF with GST breakdown, bank details &amp; items
                </span>
              </div>
            </div>
            <FileDown size={15} className="text-blue-600 group-hover:translate-y-0.5 transition-transform mr-2" />
          </button>

          {/* Desktop PDF Guidance Card */}
          {desktopPdfGuidance && (
            <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-2xl text-xs text-emerald-950 space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Invoice PDF downloaded &amp; WhatsApp Web opened!</span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed pl-6">
                👉 Simply drag &amp; drop <strong>{pdfFileName}</strong> from your Downloads into the WhatsApp chat or click <strong>📎 (Attach Document)</strong> to send!
              </p>
            </div>
          )}

          {/* Shared via App Notice */}
          {pdfSharedViaApp && (
            <div className="bg-emerald-100 border border-emerald-300 p-3 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>PDF invoice shared directly to WhatsApp!</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-[11px] text-rose-700 font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={14} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Message Text Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wider">
                WhatsApp Text Message Preview
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors cursor-pointer"
              >
                {copiedText ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <div className="bg-slate-900 text-slate-100 p-3 rounded-2xl text-[10.5px] font-mono whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed border border-slate-800 selection:bg-[#25D366] selection:text-slate-900">
              {messageText}
            </div>
          </div>

          {/* Footer Direct Links */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {/* WhatsApp App Link (wa.me) */}
              <a
                href={universalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-bold text-[#004870] bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink size={12} />
                WhatsApp App
              </a>

              {/* Direct WhatsApp Web Link */}
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={13} />
                WhatsApp Web
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
