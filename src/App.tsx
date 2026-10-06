/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
  formatAuthError,
} from './lib/firebase';
import { Customer, SheetMetadata, ActiveTab } from './types';
import {
  getStoredCustomers,
  saveStoredCustomers,
  upsertCustomerLocally,
  deleteCustomerLocally,
  getSyncQueue,
  getStoredSheetConfig,
  saveStoredSheetConfig,
  flushSyncQueue,
} from './services/storageService';
import {
  createSpreadsheet,
  getSpreadsheetDetails,
  fetchSheetData,
  syncCustomerWithSheet,
  normalizeCnic,
} from './services/sheetsService';
import { Navbar } from './components/Navbar';
import { CustomerForm } from './components/CustomerForm';
import { CustomerTable } from './components/CustomerTable';
import { CustomerPreviewModal } from './components/CustomerPreviewModal';
import { CVPreviewModal } from './components/CVPreviewModal';
import { SheetSettingsModal } from './components/SheetSettingsModal';
import { StatsCards } from './components/StatsCards';
import { AutofillHub } from './components/AutofillHub';
import {
  PlusCircle,
  Users,
  FileText,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Info,
  Layers,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { downloadCustomerCVPdf } from './services/cvGenerator';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Network state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Application state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [sheetConfig, setSheetConfig] = useState<SheetMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Form editing selection
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // Modals state
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const [isPreviewUpdate, setIsPreviewUpdate] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const [cvCustomer, setCvCustomer] = useState<Customer | null>(null);
  const [isCVModalOpen, setIsCVModalOpen] = useState<boolean>(false);

  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [authErrorModal, setAuthErrorModal] = useState<{ title: string; message: string; isPopupBlocked?: boolean } | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(
    null
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  // Initialize network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Network restored. You are back online.', 'info');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Working offline. All customer entries and CVs are saved locally.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Initialize local data
  useEffect(() => {
    const loadedCustomers = getStoredCustomers();
    setCustomers(loadedCustomers);
    setPendingQueueCount(getSyncQueue().length);
    setSheetConfig(getStoredSheetConfig());
  }, []);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (u) => {
        // User profile recognized from Firebase session
        setUser(u);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthErrorModal(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setNeedsAuth(false);
        showToast(`Connected as ${res.user.displayName || res.user.email}`);

        // If sheet config already exists, prompt sync
        const config = getStoredSheetConfig();
        if (config) {
          triggerSync(res.accessToken);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const friendlyMsg = formatAuthError(err);
      const isBlocked = err?.code === 'auth/popup-blocked';

      if (isBlocked) {
        setAuthErrorModal({
          title: 'Google Sign-In Popup Blocked',
          message: 'Your browser or iframe preview blocked the Google Sign-In popup window. To complete sign-in, please allow popups in your browser or open this app directly in a full browser tab.',
          isPopupBlocked: true,
        });
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        showToast(friendlyMsg, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      showToast('Signed out from Google account', 'info');
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger sync of pending queue or full sheet check
  const triggerSync = async (overrideToken?: string) => {
    const token = overrideToken || accessToken || (await getAccessToken());
    if (!token) {
      showToast('Please sign in with Google to sync with Google Sheet', 'info');
      handleGoogleLogin();
      return;
    }

    const config = sheetConfig || getStoredSheetConfig();
    if (!config) {
      setIsSheetModalOpen(true);
      showToast('Please select or create a Google Sheet first', 'info');
      return;
    }

    setIsSyncing(true);
    try {
      const { successCount, errors } = await flushSyncQueue(token);
      setCustomers(getStoredCustomers());
      setPendingQueueCount(getSyncQueue().length);
      setSheetConfig(getStoredSheetConfig());

      if (errors.length > 0) {
        showToast(`Synced ${successCount} record(s). Errors: ${errors.join(', ')}`, 'error');
      } else if (successCount > 0) {
        showToast(`Successfully synchronized ${successCount} record(s) with Google Sheet!`, 'success');
      } else {
        showToast('All customer records are up to date with Google Sheet.', 'info');
      }
    } catch (err: any) {
      console.error('Sync failure:', err);
      showToast(err.message || 'Sync failed', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create New Spreadsheet via Google Sheets API
  const handleCreateNewSheet = async (title: string) => {
    const token = accessToken || (await getAccessToken());
    if (!token) throw new Error('Authentication required');

    const created = await createSpreadsheet(token, title);
    const meta: SheetMetadata = {
      ...created,
      lastSyncedAt: new Date().toISOString(),
    };
    saveStoredSheetConfig(meta);
    setSheetConfig(meta);

    // Sync all existing local customers to this newly created sheet!
    const allLocal = getStoredCustomers();
    for (const c of allLocal) {
      try {
        await syncCustomerWithSheet(token, created.id, created.sheetName, c);
        c.syncedToSheet = true;
      } catch (e) {
        console.warn('Initial push error:', e);
      }
    }
    saveStoredCustomers(allLocal);
    setCustomers([...allLocal]);
    setPendingQueueCount(0);
    showToast(`Created & populated Google Sheet "${title}"!`, 'success');
  };

  // Connect Existing Spreadsheet
  const handleConnectExistingSheet = async (idOrUrl: string) => {
    const token = accessToken || (await getAccessToken());
    if (!token) throw new Error('Authentication required');

    const details = await getSpreadsheetDetails(token, idOrUrl);
    const meta: SheetMetadata = {
      ...details,
      lastSyncedAt: new Date().toISOString(),
    };
    saveStoredSheetConfig(meta);
    setSheetConfig(meta);

    // Pull rows from the connected sheet
    await handlePullFromSheet(meta);
    showToast(`Connected to Google Sheet "${details.title}"!`, 'success');
  };

  // Pull Sheet Data into local store
  const handlePullFromSheet = async (overrideMeta?: SheetMetadata) => {
    const token = accessToken || (await getAccessToken());
    if (!token) throw new Error('Authentication required');

    const config = overrideMeta || sheetConfig || getStoredSheetConfig();
    if (!config) throw new Error('No sheet connected');

    const { customers: sheetCustomers } = await fetchSheetData(
      token,
      config.id,
      config.sheetName
    );

    // Merge with local: if sheet has row, update or insert locally
    const currentLocal = getStoredCustomers();
    const mergedMap = new Map<string, Customer>();

    // Start with current local
    currentLocal.forEach((c) => mergedMap.set(normalizeCnic(c.cnic), c));

    // Overlay sheet customers (sheet is source of truth for synced rows)
    sheetCustomers.forEach((sc) => {
      const norm = normalizeCnic(sc.cnic);
      const existing = mergedMap.get(norm);
      if (existing) {
        mergedMap.set(norm, {
          ...existing,
          ...sc,
          customFields: {
            ...existing.customFields,
            ...sc.customFields,
          },
          syncedToSheet: true,
        });
      } else {
        mergedMap.set(norm, sc);
      }
    });

    const mergedList = Array.from(mergedMap.values());
    saveStoredCustomers(mergedList);
    setCustomers(mergedList);

    config.lastSyncedAt = new Date().toISOString();
    saveStoredSheetConfig(config);
    setSheetConfig({ ...config });
    showToast(`Imported ${sheetCustomers.length} customer records from Google Sheet`, 'success');
  };

  // Push All Local Records to Sheet
  const handlePushAllToSheet = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) throw new Error('Authentication required');

    const config = sheetConfig || getStoredSheetConfig();
    if (!config) throw new Error('No sheet connected');

    const currentLocal = getStoredCustomers();
    let count = 0;
    for (const c of currentLocal) {
      const res = await syncCustomerWithSheet(token, config.id, config.sheetName, c);
      c.syncedToSheet = true;
      c.sheetRowIndex = res.rowIndex;
      count++;
    }

    saveStoredCustomers(currentLocal);
    setCustomers([...currentLocal]);
    setPendingQueueCount(0);
    showToast(`Successfully pushed ${count} customer records to Google Sheet`, 'success');
  };

  // User submits form -> Opens Preview & Confirmation Modal first
  const handleFormPreviewSubmit = (customer: Customer, isUpdate: boolean) => {
    setPreviewCustomer(customer);
    setIsPreviewUpdate(isUpdate);
    setIsPreviewModalOpen(true);
  };

  // User confirms in Preview Modal -> Finalize and save/sync
  const handleConfirmFinalize = async (customer: Customer) => {
    setIsPreviewModalOpen(false);

    // 1. Immediately save locally (offline support!)
    const saved = upsertCustomerLocally(customer, true);
    const updatedList = getStoredCustomers();
    setCustomers(updatedList);
    setPendingQueueCount(getSyncQueue().length);
    setCustomerToEdit(null);

    showToast(`Saved customer ${saved.fullName} (${saved.cnic}) locally`, 'success');

    // 2. If online and Google Auth is active + sheetConfig exists, sync immediately
    if (isOnline && (accessToken || user) && sheetConfig) {
      const token = accessToken || (await getAccessToken());
      if (token) {
        setIsSyncing(true);
        try {
          const res = await syncCustomerWithSheet(
            token,
            sheetConfig.id,
            sheetConfig.sheetName,
            saved
          );

          // Mark as synced locally
          const cIndex = updatedList.findIndex(
            (c) => normalizeCnic(c.cnic) === normalizeCnic(saved.cnic)
          );
          if (cIndex >= 0) {
            updatedList[cIndex].syncedToSheet = true;
            updatedList[cIndex].sheetRowIndex = res.rowIndex;
            saveStoredCustomers(updatedList);
            setCustomers([...updatedList]);
          }

          showToast(
            `Google Sheet updated row #${res.rowIndex} for CNIC ${saved.cnic} (${res.action})!`,
            'success'
          );
        } catch (err: any) {
          console.warn('Real-time sync to sheet encountered an error, queued offline:', err);
          showToast(`Saved locally. Sheet sync will retry: ${err.message}`, 'info');
        } finally {
          setIsSyncing(false);
        }
      }
    } else if (!sheetConfig) {
      showToast(
        'Saved locally! Connect a Google Sheet to synchronize rows automatically.',
        'info'
      );
    }
  };

  // Save new dynamically detected fields from web forms into Google Sheet under CNIC
  const handleSaveNewFieldsToCustomer = async (
    cnic: string,
    newFields: Record<string, string>
  ) => {
    const norm = normalizeCnic(cnic);
    const existing = customers.find((c) => normalizeCnic(c.cnic) === norm);
    if (!existing) {
      throw new Error(`Customer with CNIC ${cnic} not found in database.`);
    }

    const updatedCustomer: Customer = {
      ...existing,
      customFields: {
        ...(existing.customFields || {}),
        ...newFields,
      },
      updatedAt: new Date().toISOString(),
      syncedToSheet: false,
    };

    upsertCustomerLocally(updatedCustomer, true);
    const updatedList = getStoredCustomers();
    setCustomers(updatedList);
    setPendingQueueCount(getSyncQueue().length);

    // If online & Google Sheets connected, push immediately!
    const token = accessToken || (await getAccessToken());
    if (isOnline && token && sheetConfig) {
      try {
        const res = await syncCustomerWithSheet(
          token,
          sheetConfig.id,
          sheetConfig.sheetName,
          updatedCustomer
        );
        const idx = updatedList.findIndex(
          (c) => normalizeCnic(c.cnic) === norm
        );
        if (idx >= 0) {
          updatedList[idx].syncedToSheet = true;
          updatedList[idx].sheetRowIndex = res.rowIndex;
          saveStoredCustomers(updatedList);
          setCustomers([...updatedList]);
        }
        showToast(
          `Google Sheet updated! ${Object.keys(newFields).length} new field column(s) appended under CNIC ${cnic}.`,
          'success'
        );
      } catch (err: any) {
        showToast(`Saved locally. Sheet sync will retry: ${err.message}`, 'info');
      }
    } else {
      showToast(
        `Saved ${Object.keys(newFields).length} new field(s) locally under CNIC ${cnic}!`,
        'success'
      );
    }
  };

  // Check for any new fields harvested from external website bookmarklets via localStorage or window message
  useEffect(() => {
    const processHarvestQueue = async () => {
      try {
        const raw = localStorage.getItem('syncsheet_web_harvest_queue');
        if (!raw) return;
        const queue: Array<{ cnic: string; newFields: Record<string, string> }> = JSON.parse(raw);
        if (queue.length === 0) return;

        for (const item of queue) {
          if (item.cnic && item.newFields && Object.keys(item.newFields).length > 0) {
            await handleSaveNewFieldsToCustomer(item.cnic, item.newFields);
          }
        }
        localStorage.removeItem('syncsheet_web_harvest_queue');
      } catch (e) {
        console.warn('Harvest queue error:', e);
      }
    };

    processHarvestQueue();

    const handleWindowFocus = () => {
      processHarvestQueue();
    };

    const handlePostMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNCSHEET_NEW_FIELDS' && e.data.payload) {
        const { cnic, newFields } = e.data.payload;
        if (cnic && newFields) {
          handleSaveNewFieldsToCustomer(cnic, newFields);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('message', handlePostMessage);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('message', handlePostMessage);
    };
  }, [customers, accessToken, sheetConfig, isOnline]);

  // Delete customer locally
  const handleDeleteCustomer = (cnic: string) => {
    deleteCustomerLocally(cnic);
    const updated = getStoredCustomers();
    setCustomers(updated);
    showToast(`Customer record deleted locally for CNIC ${cnic}`, 'info');
  };

  // Select customer to edit
  const handleSelectCustomerToEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setActiveTab('form');
  };

  // Open CV Modal
  const handleOpenCVModal = (customer: Customer) => {
    setCvCustomer(customer);
    setIsCVModalOpen(true);
  };

  // Export full dataset as CSV
  const handleExportCsv = () => {
    if (customers.length === 0) {
      showToast('No customer records to export yet.', 'info');
      return;
    }

    // Dynamic headers: collect all custom field keys
    const allCustomKeys = Array.from(
      new Set(
        customers.flatMap((c) => (c.customFields ? Object.keys(c.customFields) : []))
      )
    );

    const baseHeaders = [
      'CNIC',
      'Full Name',
      'Father Name',
      'Phone',
      'Email',
      'Gender',
      'Date of Birth',
      'Address',
      'City',
      'Qualification',
      'Profession',
      'Experience (Years)',
      'Skills',
      'Bio',
      'Last Updated',
      ...allCustomKeys,
    ];

    const csvRows: string[] = [baseHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

    customers.forEach((c) => {
      const row = [
        c.cnic,
        c.fullName,
        c.fatherName,
        c.phone,
        c.email,
        c.gender,
        c.dob,
        c.address,
        c.city,
        c.qualification,
        c.profession,
        c.experienceYears,
        c.skills,
        c.bio,
        c.updatedAt,
        ...allCustomKeys.map((k) => c.customFields?.[k] || ''),
      ];
      csvRows.push(row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SyncSheet_Customers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={user}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingQueueCount={pendingQueueCount}
        sheetConfig={sheetConfig}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        onSyncNow={() => triggerSync()}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
      />

      {/* Floating Status Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center space-x-2.5 max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700 shadow-emerald-900/30'
                : toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700 shadow-rose-900/30'
                : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/30'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Google Sign In status helper if not logged in */}
      {!user && (
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white px-4 py-3 shadow-xs border-b border-emerald-700/50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                </svg>
              </div>
              <div>
                <span className="font-bold">Google Account Sign-In: </span>
                <span className="text-emerald-100">
                  Connect your Google account to enable real-time automatic sync with your Google Sheet. Customer entries and offline auto-lookup work immediately.
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="px-3.5 py-1.5 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-100 text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <span>{isLoggingIn ? 'Signing In...' : 'Sign in with Google'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet Connection Banner (If not yet configured) */}
      {!sheetConfig && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white px-4 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center space-x-2 text-center sm:text-left">
              <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>
                <strong>Connect Google Sheet:</strong> Create or link a Google Sheet to synchronize customer data, auto-lookup CNICs, and avoid duplicate rows.
              </span>
            </div>
            <button
              onClick={() => setIsSheetModalOpen(true)}
              className="px-3 py-1 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-100 text-xs shrink-0 shadow-xs"
            >
              Set Up Sheet
            </button>
          </div>
        </div>
      )}

      {/* Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dynamic Tab Switcher on mobile/tablet */}
        <div className="flex md:hidden bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-center ${
              activeTab === 'form' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Entry Form
          </button>
          <button
            onClick={() => setActiveTab('autofill')}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-center ${
              activeTab === 'autofill' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            AutoFiller ⚡
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-center ${
              activeTab === 'customers' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Directory ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('cv-maker')}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-center ${
              activeTab === 'cv-maker' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            CV Builder
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-center ${
              activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Reports
          </button>
        </div>

        {/* Tab 1: CNIC Entry & Auto-Lookup Form */}
        {activeTab === 'form' && (
          <div className="space-y-6">
            <CustomerForm
              initialCustomer={customerToEdit}
              allCustomers={customers}
              onPreviewAndSubmit={handleFormPreviewSubmit}
              onQuickCV={(cust) => handleOpenCVModal(cust)}
              isOnline={isOnline}
              hasGoogleSheet={Boolean(sheetConfig)}
            />

            {/* Quick Preview Directory underneath the form */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Recent Customer Entries</span>
                </h3>
                <button
                  onClick={() => setActiveTab('customers')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  View All {customers.length} Records →
                </button>
              </div>
              <CustomerTable
                customers={customers.slice(0, 5)}
                onSelectCustomerToEdit={handleSelectCustomerToEdit}
                onOpenCVModal={handleOpenCVModal}
                onDeleteCustomer={handleDeleteCustomer}
                onPreviewCustomer={(c) => {
                  setPreviewCustomer(c);
                  setIsPreviewUpdate(true);
                  setIsPreviewModalOpen(true);
                }}
                sheetUrl={sheetConfig?.url}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Full Customer Directory */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Customer Directory & Google Sheets Database
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Search by CNIC, view sync row status, download verified CVs, and manage customer records.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleExportCsv}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => {
                    setCustomerToEdit(null);
                    setActiveTab('form');
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Customer</span>
                </button>
              </div>
            </div>

            <CustomerTable
              customers={customers}
              onSelectCustomerToEdit={handleSelectCustomerToEdit}
              onOpenCVModal={handleOpenCVModal}
              onDeleteCustomer={handleDeleteCustomer}
              onPreviewCustomer={(c) => {
                setPreviewCustomer(c);
                setIsPreviewUpdate(true);
                setIsPreviewModalOpen(true);
              }}
              sheetUrl={sheetConfig?.url}
            />
          </div>
        )}

        {/* Tab 3: Dedicated CV Builder View */}
        {activeTab === 'cv-maker' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                    <FileText className="w-6 h-6 text-emerald-600" />
                    <span>Curriculum Vitae (CV) Hub & PDF Generator</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Generate, preview, and download professional A4 CV PDFs for any registered customer with verified CNIC.
                  </p>
                </div>
              </div>

              {/* Customer Selector for CV */}
              <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((c) => (
                  <div
                    key={c.cnic}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded">
                          {c.cnic}
                        </span>
                        <span className="text-[11px] text-slate-500">{c.city || 'Pakistan'}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{c.fullName}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {c.profession || 'Specialist'} {c.experienceYears ? `(${c.experienceYears}y exp)` : ''}
                      </p>
                      {c.qualification && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {c.qualification}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenCVModal(c)}
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Live Preview</span>
                      </button>
                      <button
                        onClick={() => downloadCustomerCVPdf(c, 'modernNavy')}
                        className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-700"
                        title="Direct Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Reports & Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  <span>Automated Reporting & Metrics</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Real-time analytics on customer acquisition, regional presence, and sheet sync status.
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export Dataset (.csv)</span>
              </button>
            </div>

            <StatsCards
              customers={customers}
              sheetConfig={sheetConfig}
              pendingCount={pendingQueueCount}
              onExportCsv={handleExportCsv}
            />
          </div>
        )}

        {/* Tab 5: Universal Form AutoFiller & Web Field Collector */}
        {activeTab === 'autofill' && (
          <AutofillHub
            customers={customers}
            sheetConfig={sheetConfig}
            onSaveNewFieldsToCustomer={handleSaveNewFieldsToCustomer}
            isOnline={isOnline}
            isSignedIn={Boolean(user)}
          />
        )}
      </main>

      {/* Review Information Before Finalizing Modal */}
      <CustomerPreviewModal
        isOpen={isPreviewModalOpen}
        customer={previewCustomer}
        isUpdate={isPreviewUpdate}
        sheetConfig={sheetConfig}
        isOnline={isOnline}
        onClose={() => setIsPreviewModalOpen(false)}
        onConfirm={handleConfirmFinalize}
        onOpenCV={(c) => {
          setIsPreviewModalOpen(false);
          handleOpenCVModal(c);
        }}
      />

      {/* CV Live Preview & PDF Download Modal */}
      <CVPreviewModal
        isOpen={isCVModalOpen}
        customer={cvCustomer}
        onClose={() => setIsCVModalOpen(false)}
      />

      {/* Google Sheets Settings & Connection Modal */}
      <SheetSettingsModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        sheetConfig={sheetConfig}
        isOnline={isOnline}
        isSignedIn={Boolean(user)}
        onCreateNewSheet={handleCreateNewSheet}
        onConnectExistingSheet={handleConnectExistingSheet}
        onPullFromSheet={handlePullFromSheet}
        onPushToSheet={handlePushAllToSheet}
        pendingQueueCount={pendingQueueCount}
      />

      {/* Auth Error / Popup Blocked Help Modal */}
      {authErrorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {authErrorModal.title}
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {authErrorModal.message}
              </p>

              {authErrorModal.isPopupBlocked && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  <p className="font-semibold text-slate-800">
                    Why did this happen?
                  </p>
                  <p className="text-slate-600">
                    Embedded preview windows in browsers sometimes restrict Google OAuth popups. Opening in a direct browser tab resolves this immediately.
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 font-bold text-blue-600 hover:text-blue-800 hover:underline pt-1"
                  >
                    <span>Open App in Full Browser Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setAuthErrorModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setAuthErrorModal(null);
                    handleGoogleLogin();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Retry Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
