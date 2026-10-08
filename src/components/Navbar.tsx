import React from 'react';
import { User } from 'firebase/auth';
import { SheetMetadata } from '../types';
import {
  FileSpreadsheet,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  ExternalLink,
  PlusCircle,
  Users,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  CheckCircle2,
  Zap,
  Shield,
  Briefcase,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingQueueCount: number;
  sheetConfig: SheetMetadata | null;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogin: () => void;
  onLogout: () => void;
  onSyncNow: () => void;
  onOpenSheetModal: () => void;
  onOpenCVUpload?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  needsAuth,
  isLoggingIn,
  isOnline,
  isSyncing,
  pendingQueueCount,
  sheetConfig,
  activeTab,
  setActiveTab,
  onLogin,
  onLogout,
  onSyncNow,
  onOpenSheetModal,
  onOpenCVUpload,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'form', label: 'CNIC Entry & Form', icon: PlusCircle },
    { id: 'jobs', label: 'Pakistan Jobs (Govt/Pvt)', icon: Briefcase },
    { id: 'mobile-police', label: 'Police Sahulat & Mobile Sync', icon: Shield },
    { id: 'autofill', label: 'Universal AutoFiller', icon: Zap },
    { id: 'customers', label: 'Customer Directory', icon: Users },
    { id: 'cv-maker', label: 'CV Builder & PDF', icon: FileText },
    { id: 'analytics', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  SyncSheet
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-emerald-100 text-emerald-800 rounded">
                  CNIC Hub
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Real-time Sheets Sync & Offline Auto-Fill
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Status & Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Online / Offline status */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
              title={isOnline ? 'Internet connection active' : 'Working offline - changes queued'}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <CloudOff className="w-3.5 h-3.5" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Quick Upload CV Trigger Button */}
            {onOpenCVUpload && (
              <button
                onClick={onOpenCVUpload}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs transition-all cursor-pointer"
                title="Upload CV & Collect Data with Gemini AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden sm:inline">Upload CV (AI)</span>
              </button>
            )}

            {/* Quick Floating AutoFill Trigger Button */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle_floating_autofill'));
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
              title="Activate / Open Floating AutoFill Button across your devices"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">Floating AutoFill</span>
            </button>

            {/* Sync Queue / Sync Now button */}
            {pendingQueueCount > 0 ? (
              <button
                onClick={onSyncNow}
                disabled={isSyncing || !isOnline || !user}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-50"
                title="Sync offline records to Google Sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing ? 'Syncing...' : `Sync (${pendingQueueCount})`}
                </span>
              </button>
            ) : sheetConfig ? (
              <button
                onClick={onSyncNow}
                disabled={isSyncing || !isOnline || !user}
                className="hidden lg:flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Synchronize sheet data"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate max-w-[100px]">{sheetConfig.title}</span>
              </button>
            ) : null}

            {/* Sheet Settings button */}
            <button
              onClick={onOpenSheetModal}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              title="Google Sheet Configuration"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>

            {/* Google Authentication */}
            {user ? (
              <div className="flex items-center space-x-2 pl-1 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full ring-2 ring-emerald-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                    {user.displayName || 'Google Account'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Google Sign In Button conforming to official design requirements */
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="gsi-material-button flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs text-xs font-medium text-slate-700 transition-all cursor-pointer"
              >
                <div className="w-4 h-4 shrink-0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span className="hidden sm:inline">
                  {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
