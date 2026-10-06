import React, { useState } from 'react';
import { SheetMetadata } from '../types';
import {
  FileSpreadsheet,
  PlusCircle,
  Link2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  X,
  AlertCircle,
  DownloadCloud,
  UploadCloud,
} from 'lucide-react';

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetConfig: SheetMetadata | null;
  isOnline: boolean;
  isSignedIn: boolean;
  onCreateNewSheet: (title: string) => Promise<void>;
  onConnectExistingSheet: (idOrUrl: string) => Promise<void>;
  onPullFromSheet: () => Promise<void>;
  onPushToSheet: () => Promise<void>;
  pendingQueueCount: number;
}

export const SheetSettingsModal: React.FC<SheetSettingsModalProps> = ({
  isOpen,
  onClose,
  sheetConfig,
  isOnline,
  isSignedIn,
  onCreateNewSheet,
  onConnectExistingSheet,
  onPullFromSheet,
  onPushToSheet,
  pendingQueueCount,
}) => {
  const [newTitle, setNewTitle] = useState('Customer Database & CNIC Registry');
  const [existingInput, setExistingInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  if (!isOpen) return null;

  const handleCreateNew = async () => {
    if (!isSignedIn) {
      setFeedback({
        type: 'error',
        message: 'Please sign in with Google first to create a Google Sheet in your Drive.',
      });
      return;
    }
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onCreateNewSheet(newTitle.trim() || 'Customer Database & CNIC Registry');
      setFeedback({ type: 'success', message: 'New Google Sheet created and linked successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create sheet' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectExisting = async () => {
    if (!isSignedIn) {
      setFeedback({
        type: 'error',
        message: 'Please sign in with Google first to access your Google Sheets.',
      });
      return;
    }
    if (!existingInput.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter a Google Sheet ID or URL',
      });
      return;
    }
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onConnectExistingSheet(existingInput.trim());
      setFeedback({ type: 'success', message: 'Google Sheet linked successfully!' });
      setExistingInput('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to connect sheet' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePull = async () => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onPullFromSheet();
      setFeedback({ type: 'success', message: 'Successfully imported customer rows from Google Sheet!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to pull from sheet' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePush = async () => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onPushToSheet();
      setFeedback({ type: 'success', message: 'All local records successfully synced to Google Sheet!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to sync to sheet' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">Google Sheets Integration</h3>
              <p className="text-xs text-slate-300">
                Configure real-time sync target and deduplication rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-xs sm:text-sm">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Current linked sheet info */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Currently Linked Sheet</span>
              {sheetConfig ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  Not Connected
                </span>
              )}
            </div>

            {sheetConfig ? (
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sheet Title:</span>
                  <span className="font-bold text-slate-900">{sheetConfig.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tab Name:</span>
                  <span className="font-mono text-slate-800">{sheetConfig.sheetName}</span>
                </div>
                {sheetConfig.lastSyncedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Last Synced:</span>
                    <span className="text-slate-700">
                      {new Date(sheetConfig.lastSyncedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <a
                    href={sheetConfig.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 text-emerald-700 font-semibold hover:text-emerald-900 hover:underline"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No Google Sheet linked yet. Create a fresh one below or connect an existing spreadsheet ID.
              </p>
            )}
          </div>

          {/* Sync actions if sheet connected */}
          {sheetConfig && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePull}
                disabled={isProcessing || !isSignedIn || !isOnline}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 text-slate-900 font-bold mb-1">
                  <DownloadCloud className="w-4 h-4 text-blue-600" />
                  <span>Pull Sheet Data</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Import rows from Google Sheet into local storage.
                </p>
              </button>

              <button
                onClick={handlePush}
                disabled={isProcessing || !isSignedIn || !isOnline}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 text-slate-900 font-bold mb-1">
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span>Sync All Local</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Flush all pending changes to the connected sheet.
                </p>
              </button>
            </div>
          )}

          {/* Section: Create New Spreadsheet */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs uppercase tracking-wide">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Create New Google Sheet</span>
            </h4>
            <p className="text-xs text-slate-500">
              Creates a formatted spreadsheet in your Google Drive with CNIC, contact fields, and automatic column expansion.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Spreadsheet Title"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={isProcessing || !isSignedIn || !isOnline}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Creating...' : 'Create & Link'}
              </button>
            </div>
          </div>

          {/* Section: Connect Existing Spreadsheet */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs uppercase tracking-wide">
              <Link2 className="w-4 h-4 text-blue-600" />
              <span>Connect Existing Spreadsheet</span>
            </h4>
            <p className="text-xs text-slate-500">
              Paste the full Google Sheet URL or ID (e.g. <code>1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms</code>)
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={existingInput}
                onChange={(e) => setExistingInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or ID"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleConnectExisting}
                disabled={isProcessing || !isSignedIn || !isOnline}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
