import React from 'react';
import { Customer, SheetMetadata } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface CustomerPreviewModalProps {
  isOpen: boolean;
  customer: Customer | null;
  isUpdate: boolean;
  sheetConfig: SheetMetadata | null;
  isOnline: boolean;
  onClose: () => void;
  onConfirm: (customer: Customer) => void;
  onOpenCV: (customer: Customer) => void;
}

export const CustomerPreviewModal: React.FC<CustomerPreviewModalProps> = ({
  isOpen,
  customer,
  isUpdate,
  sheetConfig,
  isOnline,
  onClose,
  onConfirm,
  onOpenCV,
}) => {
  if (!isOpen || !customer) return null;

  const customFieldEntries = Object.entries(customer.customFields || {});

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">Review Information Before Finalizing</h3>
              <p className="text-xs text-slate-300">
                Verify customer profile and Google Sheets synchronization details
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Status Alert Banner */}
          {isUpdate ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3 text-amber-900 text-xs sm:text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Existing Customer Row Will Be Updated: </span>
                CNIC <code className="px-1.5 py-0.5 bg-amber-100 rounded font-bold font-mono">{customer.cnic}</code> already exists in the registry. Confirming will overwrite the existing row without creating duplicate entries. Any new dynamic fields will be appended as new columns.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-900 text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">New Customer Entry: </span>
                A fresh row will be recorded in Google Sheet for CNIC <code className="px-1.5 py-0.5 bg-emerald-100 rounded font-bold font-mono">{customer.cnic}</code>.
              </div>
            </div>
          )}

          {/* Connected Google Sheet status info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-700">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>
                Target Sheet:{' '}
                <strong>{sheetConfig?.title || 'Default Local / Pending Connection'}</strong>
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? 'Online (Instant Sync)' : 'Offline (Queued for Sync)'}
            </span>
          </div>

          {/* Personal Summary Card */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900">{customer.fullName}</h4>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                CNIC: {customer.cnic}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div>
                <span className="text-slate-400">Father/Guardian: </span>
                <span className="font-medium text-slate-800">{customer.fatherName || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-800">{customer.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-800 truncate">{customer.email || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-800">
                  {customer.city ? `${customer.city}, ` : ''}
                  {customer.address || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Gender & DOB: </span>
                <span className="font-medium text-slate-800">
                  {customer.gender || 'N/A'} {customer.dob ? `(${customer.dob})` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Professional Credentials Card */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>Professional & CV Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400">Profession: </span>
                <span className="font-semibold text-slate-800">{customer.profession || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400">Experience: </span>
                <span className="font-semibold text-slate-800">
                  {customer.experienceYears ? `${customer.experienceYears} Years` : 'N/A'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400">Education: </span>
                <span className="font-semibold text-slate-800">{customer.qualification || 'N/A'}</span>
              </div>
            </div>

            {customer.skills && (
              <div className="pt-1">
                <span className="text-slate-400 block mb-1">Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {customer.skills.split(',').map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {customer.bio && (
              <div className="pt-1">
                <span className="text-slate-400 block mb-0.5">Bio:</span>
                <p className="text-slate-700 italic bg-slate-50 p-2 rounded text-[11px]">
                  "{customer.bio}"
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Custom Fields */}
          {customFieldEntries.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 text-xs">
              <div className="flex items-center space-x-2 text-slate-900 font-bold mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Custom Dynamic Fields (Appended Columns)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {customFieldEntries.map(([k, v]) => (
                  <div key={k} className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 font-semibold block">{k}</span>
                    <span className="text-slate-900 font-medium">{v || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenCV(customer)}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Open CV Preview</span>
          </button>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={() => onConfirm(customer)}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Save to Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
