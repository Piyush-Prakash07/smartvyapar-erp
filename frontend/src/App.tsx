import { useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ThemeProvider } from './features/theme/ThemeContext';
import { ThemeToggle } from './features/theme/ThemeToggle';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import InvoiceGeneratorPage from './features/invoices/InvoiceGeneratorPage';
import ItemsPage from './features/items/ItemsPage';
import CustomersPage from './features/customers/CustomersPage';
import MahajansPage from './features/mahajans/MahajansPage';
import KhataPage from './features/khata/KhataPage';
import DaybookPage from './features/daybook/DaybookPage';
import DailyPaymentsPage from './features/payments/DailyPaymentsPage';
import StockPage from './features/stock/StockPage';
import { 
  Landmark, 
  LogOut, 
  Building, 
  User as UserIcon,
  LayoutDashboard,
  ReceiptText,
  Package,
  Users,
  Truck,
  BookOpen,
  Calendar,
  CreditCard,
  Boxes
} from 'lucide-react';
import type { PurchaseInvoice } from './features/dashboard/types';

function AppContent() {
  const { isAuthenticated, isLoading, user, activeCompany, companies, switchCompany, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoice' | 'items' | 'customers' | 'mahajans' | 'khata' | 'daybook' | 'payments' | 'stock'>('dashboard');
  const [loadedInvoiceToPrint, setLoadedInvoiceToPrint] = useState<any | null>(null);
  const [loadedPurchaseInvoiceToPrint, setLoadedPurchaseInvoiceToPrint] = useState<PurchaseInvoice | null>(null);

  const handleLoadInvoice = (invoice: any) => {
    setLoadedInvoiceToPrint(invoice);
    setLoadedPurchaseInvoiceToPrint(null);
    setActiveTab('invoice');
  };

  const handleLoadPurchaseInvoice = (invoice: PurchaseInvoice) => {
    setLoadedPurchaseInvoiceToPrint(invoice);
    setLoadedInvoiceToPrint(null);
    setActiveTab('invoice');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#002f4a] to-slate-950 text-white">
        <div className="relative mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-amber-200 rounded-2xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-400/20 font-bold animate-pulse">
            <Landmark size={28} />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/40 animate-ping"></div>
        </div>
        <h2 className="text-base font-black tracking-tight font-display">SmartVyapar ERP</h2>
        <p className="text-xs font-semibold text-blue-300 tracking-wider uppercase mt-1">Starting secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginPage
        onNavigateToRegister={() => {
          setAuthView('register');
        }}
      />
    ) : (
      <RegisterPage
        onNavigateToLogin={() => {
          setAuthView('login');
        }}
      />
    );
  }

  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoice', label: 'Tax Billing', icon: ReceiptText },
    { id: 'items', label: 'Items Catalog', icon: Package },
    { id: 'customers', label: 'Customer Ledger', icon: Users },
    { id: 'mahajans', label: 'Supplier Ledger', icon: Truck },
    { id: 'khata', label: 'Khata Book', icon: BookOpen },
    { id: 'daybook', label: 'Daybook', icon: Calendar },
    { id: 'payments', label: 'Daily Payments', icon: CreditCard },
    { id: 'stock', label: 'Inventory', icon: Boxes },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Modern Gradient Header - Hidden in print */}
      <header className="print:hidden theme-header text-white px-4 sm:px-8 py-3 flex flex-wrap justify-between items-center shadow-lg border-b border-black/20 relative z-20 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-400 to-amber-200 rounded-xl flex items-center justify-center text-slate-900 shadow-md shadow-amber-400/20 font-black shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight font-display text-white">
                SmartVyapar <span className="text-amber-300">ERP</span>
              </h1>
              <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 uppercase tracking-widest">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-blue-200/80 font-medium">Smart Wholesale &amp; GST Khata Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4 mt-3 sm:mt-0">
          {/* Company Selector */}
          {companies.length > 0 && (
            <div className="flex items-center gap-2 bg-black/25 hover:bg-black/40 px-3 py-1.5 rounded-xl border border-white/15 transition-all shadow-inner backdrop-blur-md">
              <Building size={14} className="text-amber-400 shrink-0" />
              <label className="text-[11px] font-bold text-blue-200/90 hidden md:inline">Firm:</label>
              <select
                value={activeCompany?.id || ''}
                onChange={(e) => switchCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900 font-medium">
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Theme Switcher Toggle */}
          <ThemeToggle />

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-extrabold text-white flex items-center justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <UserIcon size={12} className="text-blue-300" /> {user?.fullName}
              </p>
              <p className="text-[9.5px] text-amber-300/90 font-bold uppercase tracking-wider">
                {activeCompany?.role || 'Admin'}
              </p>
            </div>
            
            <button
              onClick={logout}
              className="bg-rose-500/20 hover:bg-rose-600 border border-rose-400/30 text-rose-200 hover:text-white p-2 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-rose-500/20"
              title="Logout session"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Modern Graphic Tabs Navigation Bar - Hidden in print */}
      <div 
        className="print:hidden theme-nav backdrop-blur-md border-b px-4 sm:px-8 flex gap-1.5 shadow-xs overflow-x-auto sticky top-0 z-10 py-1.5 transition-colors duration-200"
      >
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'shadow-md'
                  : 'hover:bg-white/10 opacity-80 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
                color: isActive ? 'var(--nav-active-text)' : 'var(--nav-inactive-text)',
              }}
            >
              <Icon size={14} className={isActive ? 'text-amber-300' : 'opacity-70'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Body */}
      <main className="flex-1 w-full" style={{ backgroundColor: 'var(--bg-app)' }}>
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'invoice' && (
          <InvoiceGeneratorPage 
            loadedInvoice={loadedInvoiceToPrint} 
            loadedPurchaseInvoice={loadedPurchaseInvoiceToPrint}
            onClearLoadedInvoice={() => setLoadedInvoiceToPrint(null)}
            onClearLoadedPurchaseInvoice={() => setLoadedPurchaseInvoiceToPrint(null)}
          />
        )}
        {activeTab === 'items' && <ItemsPage />}
        {activeTab === 'customers' && (
          <CustomersPage onLoadInvoice={handleLoadInvoice} />
        )}
        {activeTab === 'mahajans' && (
          <MahajansPage onLoadInvoice={handleLoadPurchaseInvoice} />
        )}
        {activeTab === 'khata' && <KhataPage />}
        {activeTab === 'daybook' && (
          <DaybookPage 
            onLoadInvoice={handleLoadInvoice} 
            onLoadPurchaseInvoice={handleLoadPurchaseInvoice} 
          />
        )}
        {activeTab === 'payments' && <DailyPaymentsPage />}
        {activeTab === 'stock' && <StockPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

