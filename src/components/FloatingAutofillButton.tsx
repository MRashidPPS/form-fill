import React, { useState, useEffect, useRef } from 'react';
import { Customer, SheetMetadata } from '../types';
import { normalizeCnic, formatCnic } from '../services/sheetsService';
import { autofillFormAndHarvest, generateBookmarkletCode, extractCustomerFromForm } from '../services/autofillService';
import {
  Zap,
  X,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Shield,
  ExternalLink,
  Sparkles,
  Smartphone,
  Eye,
  Minimize2,
  Maximize2,
  Search,
  LayoutGrid,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface FloatingAutofillButtonProps {
  customers: Customer[];
  sheetConfig: SheetMetadata | null;
  onSelectCustomerToEdit?: (customer: Customer) => void;
  onSaveNewFields?: (cnic: string, newFields: Record<string, string>) => Promise<void>;
  onCollectAndSaveCustomer?: (customer: Customer) => Promise<{ success: boolean; message: string }> | void;
  isOnline: boolean;
  userEmail?: string;
}

export const FloatingAutofillButton: React.FC<FloatingAutofillButtonProps> = ({
  customers,
  sheetConfig,
  onSelectCustomerToEdit,
  onSaveNewFields,
  onCollectAndSaveCustomer,
  isOnline,
  userEmail,
}) => {
  // Persistence for user preference: whether floating button is enabled/activated
  const [isActivated, setIsActivated] = useState<boolean>(() => {
    const saved = localStorage.getItem('syncsheet_floating_btn_active');
    return saved !== null ? saved === 'true' : true;
  });

  // Dock mode: 'bubble' (bottom-right floating bubble), 'taskbar' (minimized to bottom taskbar bar), or 'dialog' (expanded)
  const [isMinimizedToTaskbar, setIsMinimizedToTaskbar] = useState<boolean>(() => {
    const saved = localStorage.getItem('syncsheet_autofill_minimized_taskbar');
    return saved === 'true';
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedCnic, setSelectedCnic] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fillFeedback, setFillFeedback] = useState<string | null>(null);
  const [autoAdvanceIdx, setAutoAdvanceIdx] = useState<number>(0);

  // Collect form data before submitting states
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [isSavingCollected, setIsSavingCollected] = useState<boolean>(false);
  const [collectedPreview, setCollectedPreview] = useState<{
    customer: Customer;
    fieldsList: Array<{ key: string; label: string; value: string; isStandard: boolean }>;
  } | null>(null);
  const [cnicInputForCollection, setCnicInputForCollection] = useState<string>('');

  // In-page input detection state (shows button right next to any NIC input on the page)
  const [detectedInputPill, setDetectedInputPill] = useState<{
    top: number;
    left: number;
    targetEl: HTMLInputElement;
    customer: Customer;
  } | null>(null);

  // Auto-select first customer
  useEffect(() => {
    if (customers.length > 0 && !selectedCnic) {
      setSelectedCnic(customers[0].cnic);
    }
  }, [customers, selectedCnic]);

  // Listen for global activation event from Navbar or anywhere in the app
  useEffect(() => {
    const handleToggleEvent = () => {
      setIsActivated(true);
      if (isMinimizedToTaskbar) {
        setIsMinimizedToTaskbar(false);
        setIsOpen(true);
      } else {
        setIsOpen((prev) => !prev);
      }
      localStorage.setItem('syncsheet_floating_btn_active', 'true');
    };
    window.addEventListener('toggle_floating_autofill', handleToggleEvent);
    return () => window.removeEventListener('toggle_floating_autofill', handleToggleEvent);
  }, [isMinimizedToTaskbar]);

  // --- SMART IN-PAGE NIC / CNIC DETECTION ---
  // Detects when user types or focuses into any input on the page matching NIC / CNIC format (xxxxx-xxxxxxx-x)
  useEffect(() => {
    const handleGlobalInputOrFocus = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
      if (
        target.closest('#syncsheet-autofill-taskbar') ||
        target.closest('#syncsheet-autofill-container') ||
        target.closest('#syncsheet-inpage-nic-pill')
      ) {
        return;
      }

      const input = target as HTMLInputElement;
      const val = input.value || '';
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const tokenStr = `${name} ${id} ${placeholder} ${ariaLabel}`;

      const isNicNamedField =
        tokenStr.includes('cnic') ||
        tokenStr.includes('nic') ||
        tokenStr.includes('identity') ||
        tokenStr.includes('shanakht') ||
        tokenStr.includes('national_id') ||
        tokenStr.includes('id_card') ||
        tokenStr.includes('b_form');

      const digits = normalizeCnic(val);
      const isCnicPattern =
        /^\d{5}-?\d{0,7}-?\d{0,1}$/.test(val.trim()) && digits.length >= 4;
      const isFormattedCnic = /^\d{5}-\d{7}-\d{1}$/.test(val.trim());

      if (isNicNamedField || isCnicPattern || isFormattedCnic || digits.length >= 5) {
        // Find matching customer
        let matched = customers.find((c) => {
          const cDigits = normalizeCnic(c.cnic);
          return (
            cDigits === digits ||
            (digits.length >= 5 && cDigits.startsWith(digits)) ||
            c.cnic === val.trim()
          );
        });

        if (!matched && customers.length > 0) {
          // If no customer matches the exact prefix, default to currently selected or first customer
          matched =
            customers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(selectedCnic)) ||
            customers[0];
        }

        if (matched) {
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const topPos =
              rect.bottom + 6 + 48 > window.innerHeight
                ? Math.max(10, rect.top - 50)
                : rect.bottom + 6;
            const leftPos = Math.max(10, Math.min(rect.left, window.innerWidth - 340));
            setDetectedInputPill({
              top: topPos,
              left: leftPos,
              targetEl: input,
              customer: matched,
            });
            return;
          }
        }
      }

      // If typed value is empty and not focused on NIC field, hide pill
      if (!val && !isNicNamedField) {
        setDetectedInputPill(null);
      }
    };

    document.addEventListener('input', handleGlobalInputOrFocus, true);
    document.addEventListener('focusin', handleGlobalInputOrFocus, true);

    return () => {
      document.removeEventListener('input', handleGlobalInputOrFocus, true);
      document.removeEventListener('focusin', handleGlobalInputOrFocus, true);
    };
  }, [customers, selectedCnic]);

  const activeCustomer =
    customers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(selectedCnic)) ||
    customers[0];

  const handleToggleActivated = () => {
    const nextState = !isActivated;
    setIsActivated(nextState);
    localStorage.setItem('syncsheet_floating_btn_active', String(nextState));
    if (!nextState) {
      setIsOpen(false);
      setIsMinimizedToTaskbar(false);
      localStorage.setItem('syncsheet_autofill_minimized_taskbar', 'false');
    }
  };

  const handleMinimizeToTaskbar = () => {
    setIsMinimizedToTaskbar(true);
    setIsOpen(false);
    localStorage.setItem('syncsheet_autofill_minimized_taskbar', 'true');
    setFillFeedback('✓ Minimized to bottom Taskbar');
    setTimeout(() => setFillFeedback(null), 3000);
  };

  const handleRestoreFromTaskbar = () => {
    setIsMinimizedToTaskbar(false);
    setIsOpen(true);
    localStorage.setItem('syncsheet_autofill_minimized_taskbar', 'false');
  };

  const handleSwitchToBubble = () => {
    setIsMinimizedToTaskbar(false);
    setIsOpen(false);
    localStorage.setItem('syncsheet_autofill_minimized_taskbar', 'false');
  };

  const handleCopy = (label: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(`${label} (${text})`);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  // Build sequential list for mobile native app 1-tap pasting (Police Sahulat Markaz, CFC, etc.)
  const getSequentialList = () => {
    if (!activeCustomer) return [];
    const list = [
      { label: 'CNIC (Dashes)', value: activeCustomer.cnic },
      { label: 'CNIC (Clean 13 Digits)', value: normalizeCnic(activeCustomer.cnic) },
      { label: 'Full Name', value: activeCustomer.fullName },
      { label: 'Father Name', value: activeCustomer.fatherName || '' },
      { label: 'Phone / Mobile', value: activeCustomer.phone || '' },
      { label: 'Date of Birth', value: activeCustomer.dob || '' },
      { label: 'Address', value: activeCustomer.address || '' },
      { label: 'City / District', value: activeCustomer.city || '' },
      { label: 'Gender', value: activeCustomer.gender || '' },
    ];
    if (activeCustomer.customFields) {
      Object.entries(activeCustomer.customFields).forEach(([k, v]) => {
        if (v) list.push({ label: k, value: v });
      });
    }
    return list.filter((i) => Boolean(i.value));
  };

  const handleAutoAdvanceCopy = () => {
    const seq = getSequentialList();
    if (seq.length === 0) return;
    const current = seq[autoAdvanceIdx % seq.length];
    navigator.clipboard.writeText(current.value);
    const next = seq[(autoAdvanceIdx + 1) % seq.length];
    setCopiedKey(`${current.label} (${current.value}) → Next: ${next.label}`);
    setAutoAdvanceIdx((prev) => (prev + 1) % seq.length);
    setTimeout(() => setCopiedKey(null), 3500);
  };

  // 1-Tap Autofill on Current Page
  const handleAutofillCurrentPage = (overrideCustomer?: Customer) => {
    const cust = overrideCustomer || activeCustomer;
    if (!cust) return;
    const body = document.body;
    const res = autofillFormAndHarvest(body, cust);
    if (res.filledCount > 0) {
      setFillFeedback(`✓ Filled ${res.filledCount} field(s) for ${cust.fullName}!`);
    } else {
      setFillFeedback(`No matching inputs found on this screen. Switch to Entry Form or external portal.`);
    }
    setTimeout(() => setFillFeedback(null), 4000);
  };

  // 1-Tap Collect and Save Form Data from Current Page to Google Sheet before submission
  const handleCollectAndSaveCurrentPageForm = async () => {
    setIsCollecting(true);
    try {
      const res = extractCustomerFromForm(document.body);
      if (!res.customer || res.extractedFields.length === 0) {
        setFillFeedback('⚠️ No filled form fields detected on this screen. Enter applicant details in form first!');
        setTimeout(() => setFillFeedback(null), 4000);
        return;
      }

      setCollectedPreview({
        customer: res.customer,
        fieldsList: res.extractedFields,
      });
      setCnicInputForCollection(res.customer.cnic || '');
    } catch (err: any) {
      setFillFeedback(`Error collecting form: ${err.message}`);
      setTimeout(() => setFillFeedback(null), 4000);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleConfirmSaveCollectedCustomer = async () => {
    if (!collectedPreview) return;
    const rawCnic = cnicInputForCollection.trim() || collectedPreview.customer.cnic;
    const norm = normalizeCnic(rawCnic);

    if (norm.length < 5) {
      setFillFeedback('⚠️ Please enter a valid CNIC (xxxxx-xxxxxxx-x) to save under.');
      setTimeout(() => setFillFeedback(null), 4000);
      return;
    }

    const formattedCnic = formatCnic(rawCnic);
    setIsSavingCollected(true);

    try {
      const finalizedCustomer: Customer = {
        ...collectedPreview.customer,
        id: norm,
        cnic: formattedCnic,
        fullName: collectedPreview.customer.fullName || 'New Customer',
        updatedAt: new Date().toISOString(),
      };

      if (onCollectAndSaveCustomer) {
        await onCollectAndSaveCustomer(finalizedCustomer);
      }

      setSelectedCnic(finalizedCustomer.cnic);
      setCollectedPreview(null);
      setFillFeedback(
        `✓ Collected ${collectedPreview.fieldsList.length} fields! Saved to Google Sheet under CNIC ${formattedCnic} before submission.`
      );
      setTimeout(() => setFillFeedback(null), 5000);
    } catch (err: any) {
      setFillFeedback(`Failed to save: ${err.message}`);
      setTimeout(() => setFillFeedback(null), 4000);
    } finally {
      setIsSavingCollected(false);
    }
  };

  // Filter customers for quick search with crisp black text
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.cnic.toLowerCase().includes(q) ||
      normalizeCnic(c.cnic).includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  if (!isActivated) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={handleToggleActivated}
          title="Activate Floating AutoFill Button across your devices"
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full text-[11px] font-bold shadow-lg border border-slate-700 backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Activate AutoFill Button</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 1. SMART IN-PAGE NIC DETECTION PILL: Appears right when user types or focuses on NIC field */}
      {detectedInputPill && (
        <div
          id="syncsheet-inpage-nic-pill"
          style={{
            top: `${detectedInputPill.top}px`,
            left: `${detectedInputPill.left}px`,
          }}
          className="fixed z-50 bg-slate-900 text-white border-2 border-emerald-400 rounded-xl px-3 py-2 shadow-2xl flex items-center space-x-2.5 animate-in fade-in slide-in-from-top-1 text-xs"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <div className="font-bold text-emerald-400 flex items-center space-x-1">
              <span>⚡ AutoFill: {detectedInputPill.customer.fullName}</span>
            </div>
            <div className="text-[10px] text-slate-300 font-mono">
              CNIC: {detectedInputPill.customer.cnic}
            </div>
          </div>

          <button
            onClick={() => {
              handleAutofillCurrentPage(detectedInputPill.customer);
              setDetectedInputPill(null);
            }}
            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
            title="1-Click Fill all matching form fields"
          >
            <span>⚡ Fill Form</span>
          </button>

          <button
            onClick={() => {
              handleCollectAndSaveCurrentPageForm();
              setDetectedInputPill(null);
            }}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
            title="Collect all filled data from this form into Google Sheet before submitting"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save to Sheet</span>
          </button>

          <button
            onClick={() => setDetectedInputPill(null)}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MINIMIZED TO TASKBAR MODE: Sleek bottom bar docked at the bottom of the screen */}
      {isMinimizedToTaskbar && (
        <div
          id="syncsheet-autofill-taskbar"
          className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 shadow-2xl px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 animate-in slide-in-from-bottom duration-200 text-xs"
        >
          {/* Left Brand & Active Customer */}
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-xs">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 font-bold text-white text-xs">
                <span>⚡ AutoFill Taskbar</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase">
                  Docked
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                Active: <b className="text-emerald-300">{activeCustomer?.fullName || 'None'}</b> (
                <span className="font-mono">{activeCustomer?.cnic || ''}</span>)
              </div>
            </div>
          </div>

          {/* Center: Search & Customer Selector */}
          <div className="flex items-center gap-2 flex-1 max-w-xl justify-center">
            {/* Search Input with Guaranteed BLACK WRITING */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CNIC or Name..."
                className="w-full pl-8 pr-2.5 py-1 bg-white text-slate-900 placeholder:text-slate-500 font-semibold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Quick Customer Select */}
            <select
              value={selectedCnic}
              onChange={(e) => setSelectedCnic(e.target.value)}
              className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[190px] truncate"
            >
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <option key={c.cnic} value={c.cnic}>
                    {c.cnic} - {c.fullName}
                  </option>
                ))
              ) : (
                <option value="">No matching customer</option>
              )}
            </select>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-1.5">
            {/* 1-Tap Autofill */}
            <button
              onClick={() => handleAutofillCurrentPage()}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
              title="1-Click AutoFill on Current Web Page"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Fill Form</span>
            </button>

            {/* Collect & Save Form Data to Google Sheet */}
            <button
              onClick={handleCollectAndSaveCurrentPageForm}
              disabled={isCollecting}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
              title="Collect all filled data from this form and save to Google Sheet before submitting"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isCollecting ? 'Scanning...' : 'Save Form to Sheet'}</span>
            </button>

            {/* Auto-Advance Copy */}
            <button
              onClick={handleAutoAdvanceCopy}
              className="hidden sm:flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Sequential copy for mobile apps (Police Sahulat Markaz)"
            >
              <Smartphone className="w-3 h-3 text-blue-400" />
              <span>
                Copy Next (
                {getSequentialList()[autoAdvanceIdx % (getSequentialList().length || 1)]?.label || 'Next'}
                )
              </span>
            </button>

            {/* Restore to Full Window */}
            <button
              onClick={handleRestoreFromTaskbar}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Expand to Full AutoFill Window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Switch to Floating Bubble */}
            <button
              onClick={handleSwitchToBubble}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Switch to Floating Bubble"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>

            {/* Close Taskbar */}
            <button
              onClick={handleToggleActivated}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Hide AutoFill Taskbar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. FLOATING TRIGGER BUTTON & DOCK (Bottom-Right) - When not minimized to taskbar */}
      {!isMinimizedToTaskbar && (
        <div
          id="syncsheet-autofill-container"
          className="fixed bottom-5 right-5 z-50 flex flex-col items-end"
        >
          {/* Expanded Floating Dock Modal */}
          {isOpen && (
            <div className="mb-3 w-[92vw] sm:w-[400px] max-h-[85vh] bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header */}
              <div className="p-3.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-sm">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1">
                      <span>Floating AutoFiller</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase">
                        Live
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                      {userEmail ? `${userEmail} • ` : ''}{customers.length} records ready
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {/* Minimize to Taskbar Button */}
                  <button
                    onClick={handleMinimizeToTaskbar}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center space-x-1 text-[11px] font-semibold cursor-pointer"
                    title="Minimize to bottom Taskbar"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[10px]">Taskbar</span>
                  </button>

                  {/* Close Dialog to Bubble */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Minimize to Bubble"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Deactivate Floating Button */}
                  <button
                    onClick={handleToggleActivated}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Deactivate floating button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification / Feedback Banner */}
              {fillFeedback && (
                <div className="px-3 py-2 bg-emerald-600 text-white text-[11px] font-semibold flex items-center space-x-1.5 animate-in fade-in">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{fillFeedback}</span>
                </div>
              )}
              {copiedKey && (
                <div className="px-3 py-2 bg-teal-600 text-white text-[11px] font-semibold flex items-center space-x-1.5 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Copied: {copiedKey}</span>
                </div>
              )}

              {/* Body Content */}
              <div className="p-3.5 space-y-3 overflow-y-auto max-h-[60vh] text-xs">
                {/* Save Form Data to Google Sheet (Before Submitting) Banner */}
                <div className="p-3 bg-gradient-to-r from-blue-950/80 to-slate-900 rounded-xl border border-blue-500/30 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Save Form to Google Sheet</span>
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-semibold border border-blue-500/30 uppercase">
                          Before Submit
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300">
                        Collect new data from this web page to your Sheet in 1 click!
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCollectAndSaveCurrentPageForm}
                    disabled={isCollecting}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1.5 shrink-0 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isCollecting ? 'Scanning...' : 'Save to Sheet'}</span>
                  </button>
                </div>

                {/* 1. Dedicated Search Customer Input with Crisp BLACK WRITING */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Search Customer:</span>
                    <span className="text-slate-500 font-mono">
                      {filteredCustomers.length} of {customers.length} records
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        // If single exact match, select it immediately
                        const q = e.target.value.toLowerCase().trim();
                        const exact = customers.find(
                          (c) =>
                            c.cnic.toLowerCase() === q ||
                            normalizeCnic(c.cnic) === normalizeCnic(q)
                        );
                        if (exact) setSelectedCnic(exact.cnic);
                      }}
                      placeholder="Type Name, CNIC (xxxxx-xxxxxxx-x), or City..."
                      className="w-full pl-8 pr-3 py-2 bg-white text-slate-900 placeholder:text-slate-500 font-semibold text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                {/* 2. Customer Selector Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Select Customer:
                  </label>
                  <select
                    value={selectedCnic}
                    onChange={(e) => setSelectedCnic(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((c) => (
                        <option key={c.cnic} value={c.cnic}>
                          {c.cnic} - {c.fullName}
                        </option>
                      ))
                    ) : (
                      <option value="">No customer matching "{searchQuery}"</option>
                    )}
                  </select>
                </div>

                {activeCustomer && (
                  <>
                    {/* Selected Customer Card */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-emerald-400 font-bold text-xs">
                          {activeCustomer.cnic}
                        </span>
                        <span className="font-semibold text-white truncate max-w-[160px]">
                          {activeCustomer.fullName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex flex-wrap gap-2">
                        <span>
                          Father: <b className="text-slate-300">{activeCustomer.fatherName || 'N/A'}</b>
                        </span>
                        <span>
                          Phone: <b className="text-slate-300">{activeCustomer.phone || 'N/A'}</b>
                        </span>
                        <span>
                          City: <b className="text-slate-300">{activeCustomer.city || 'N/A'}</b>
                        </span>
                      </div>

                      {/* Action 1: Fill on Current Page */}
                      <button
                        onClick={() => handleAutofillCurrentPage()}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Auto-Fill Current Form</span>
                      </button>

                      {/* Action 1.5: Save Form Data to Google Sheet (Before Submitting) */}
                      <button
                        onClick={handleCollectAndSaveCurrentPageForm}
                        disabled={isCollecting}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                        title="Collect all filled data from this website form and save to Google Sheet before submitting"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isCollecting ? 'Scanning Form...' : '📥 Save Form Data to Google Sheet'}</span>
                      </button>

                      {/* Action 2: Mobile 1-Tap Auto-Advance Copier */}
                      <button
                        onClick={handleAutoAdvanceCopy}
                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                        title="For native mobile apps (Police Sahulat Markaz, CFC app). 1-tap copies next field!"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>
                          ⚡ Auto-Advance Copy (
                          {getSequentialList()[autoAdvanceIdx % (getSequentialList().length || 1)]?.label || 'Next'}
                          )
                        </span>
                      </button>

                      {/* Action 3: Open CFC Portal & Copy Bookmarklet */}
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-1.5">
                        <a
                          href="https://cfc.kp.gov.pk/Citizen/Citizen/Register"
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-semibold flex items-center justify-center space-x-1 border border-slate-700 truncate"
                          title="Open KPK Citizen Portal (cfc.kp.gov.pk)"
                        >
                          <span>🏛️ cfc.kp.gov.pk</span>
                          <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                        </a>
                        <button
                          onClick={() => {
                            const code = generateBookmarkletCode(
                              window.location.origin,
                              customers,
                              sheetConfig?.title || 'Connected Sheet'
                            );
                            navigator.clipboard.writeText(code);
                            setFillFeedback('✓ Bookmarklet copied! Use on cfc.kp.gov.pk');
                            setTimeout(() => setFillFeedback(null), 3500);
                          }}
                          className="py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded-lg text-[10px] font-bold border border-emerald-700 flex items-center space-x-1 shrink-0 cursor-pointer"
                          title="Copy AutoFill code to run directly on cfc.kp.gov.pk"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Copy Bookmarklet</span>
                        </button>
                      </div>
                    </div>

                    {/* 1-Tap Quick Copy Chips */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>1-Tap Copy Fields:</span>
                        <span className="text-[10px] text-slate-500">Tap to copy to clipboard</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <button
                          onClick={() => handleCopy('CNIC', activeCustomer.cnic)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">CNIC:</span>
                          <span className="font-mono text-emerald-300 font-bold ml-1 truncate">
                            {activeCustomer.cnic}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopy('Clean CNIC', normalizeCnic(activeCustomer.cnic))}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">Digits:</span>
                          <span className="font-mono text-emerald-300 font-bold ml-1 truncate">
                            {normalizeCnic(activeCustomer.cnic)}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopy('Full Name', activeCustomer.fullName)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">Name:</span>
                          <span className="font-semibold text-slate-200 ml-1 truncate">
                            {activeCustomer.fullName}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopy('Father Name', activeCustomer.fatherName || '')}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">Father:</span>
                          <span className="font-semibold text-slate-200 ml-1 truncate">
                            {activeCustomer.fatherName || 'N/A'}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopy('Mobile', activeCustomer.phone || '')}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">Phone:</span>
                          <span className="font-mono text-slate-200 ml-1 truncate">
                            {activeCustomer.phone || 'N/A'}
                          </span>
                        </button>

                        <button
                          onClick={() => handleCopy('Address', activeCustomer.address || '')}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-left truncate flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-slate-400">Address:</span>
                          <span className="font-semibold text-slate-200 ml-1 truncate">
                            {activeCustomer.address || 'N/A'}
                          </span>
                        </button>

                        {/* Custom mapped fields */}
                        {activeCustomer.customFields &&
                          Object.entries(activeCustomer.customFields).map(([k, v]) => (
                            <button
                              key={k}
                              onClick={() => handleCopy(k, v)}
                              className="p-1.5 bg-amber-950/40 hover:bg-amber-900/50 rounded-lg border border-amber-700/50 text-left truncate flex items-center justify-between col-span-2 cursor-pointer"
                            >
                              <span className="text-amber-400 font-bold truncate">{k}:</span>
                              <span className="text-slate-200 font-semibold ml-2 truncate">{v}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  onClick={handleMinimizeToTaskbar}
                  className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Minimize to Taskbar</span>
                </button>
                <button
                  onClick={handleToggleActivated}
                  className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                >
                  Hide AutoFiller
                </button>
              </div>
            </div>
          )}

          {/* Floating Bubble Trigger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center space-x-2 px-4 py-3 rounded-full text-xs font-bold shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${
              isOpen
                ? 'bg-slate-900 text-white border border-slate-700 ring-4 ring-emerald-500/20'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-emerald-500/25 ring-2 ring-white/20'
            }`}
            title="Floating AutoFill Button: Click whenever required to fill form"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 animate-pulse" />
            </div>
            <span>{isOpen ? 'Close AutoFiller' : '⚡ AutoFill Form'}</span>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* 4. COLLECT FORM DATA PREVIEW & CONFIRMATION MODAL (Before Submitting to Website) */}
      {collectedPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Save Form Data to Google Sheet</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold border border-blue-500/30">
                      Before Submitting
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scanned {collectedPreview.fieldsList.length} field(s) from current form. Review and save!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCollectedPreview(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto text-xs">
              {/* Target CNIC verification input */}
              <div className="space-y-1.5 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Target CNIC / Identity Number *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Format: xxxxx-xxxxxxx-x</span>
                </label>
                <input
                  type="text"
                  value={cnicInputForCollection}
                  onChange={(e) => setCnicInputForCollection(e.target.value)}
                  placeholder="35201-1234567-1"
                  className="w-full px-3 py-2 bg-white text-slate-900 font-mono font-bold text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Scanned Fields Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Detected Form Fields ({collectedPreview.fieldsList.length}):</span>
                  <span className="text-emerald-400">Ready to sync</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {collectedPreview.fieldsList.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/80 flex flex-col justify-between"
                    >
                      <span className="text-[10px] font-bold text-slate-400 truncate">{f.label}:</span>
                      <span className="text-xs font-semibold text-slate-100 truncate mt-0.5">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Sheet Info */}
              <div className="p-2.5 bg-blue-950/40 rounded-xl border border-blue-500/20 text-[11px] text-blue-200 flex items-center justify-between">
                <span>Google Sheet: <b>{sheetConfig?.title || 'Connected Sheet'}</b></span>
                <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded font-semibold text-blue-300">
                  {isOnline ? 'Online Sync' : 'Offline Stored'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-end space-x-2">
              <button
                onClick={() => setCollectedPreview(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveCollectedCustomer}
                disabled={isSavingCollected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingCollected ? 'Saving to Google Sheet...' : '✓ Save to Google Sheet Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

