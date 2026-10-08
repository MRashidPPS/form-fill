import React, { useState } from 'react';
import { Customer } from '../types';
import {
  Search,
  Filter,
  FileText,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  ChevronDown,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface CustomerTableProps {
  customers: Customer[];
  onSelectCustomerToEdit: (customer: Customer) => void;
  onOpenCVModal: (customer: Customer) => void;
  onDeleteCustomer: (cnic: string) => void;
  onPreviewCustomer: (customer: Customer) => void;
  onOpenCVUpload?: () => void;
  sheetUrl?: string;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onSelectCustomerToEdit,
  onOpenCVModal,
  onDeleteCustomer,
  onPreviewCustomer,
  onOpenCVUpload,
  sheetUrl,
  onTriggerSync,
  isSyncing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSync, setFilterSync] = useState<'all' | 'synced' | 'pending'>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Unique cities for filter dropdown
  const uniqueCities = Array.from(
    new Set(customers.map((c) => c.city).filter(Boolean))
  );

  const filtered = customers.filter((cust) => {
    // Search query match
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      cust.cnic.toLowerCase().includes(q) ||
      cust.fullName.toLowerCase().includes(q) ||
      cust.phone.toLowerCase().includes(q) ||
      cust.email.toLowerCase().includes(q) ||
      cust.city.toLowerCase().includes(q) ||
      cust.profession.toLowerCase().includes(q);

    // Sync filter
    const matchesSync =
      filterSync === 'all'
        ? true
        : filterSync === 'synced'
        ? cust.syncedToSheet
        : !cust.syncedToSheet;

    // City filter
    const matchesCity =
      selectedCity === 'all' ? true : cust.city.toLowerCase() === selectedCity.toLowerCase();

    return matchesQuery && matchesSync && matchesCity;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Control bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Customer Records Directory</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
              {filtered.length} {filtered.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Indexed by unique CNIC with automated Google Sheet row synchronization
          </p>
        </div>

        {/* Search & Filter tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CNIC, Name, City..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Sync status filter */}
          <select
            value={filterSync}
            onChange={(e) => setFilterSync(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            <option value="all">All Sync States</option>
            <option value="synced">Synced to Sheet</option>
            <option value="pending">Pending Offline</option>
          </select>

          {/* City filter */}
          {uniqueCities.length > 0 && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="all">All Cities</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          {onOpenCVUpload && (
            <button
              onClick={onOpenCVUpload}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Upload candidate CV and collect data with Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Import from CV (AI)</span>
            </button>
          )}

          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Sheet</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content: Table on large screen, Card grid on small mobile */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No matching customer records found</p>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search query or add a new customer via the CNIC form.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-3 px-4">CNIC / ID</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">City / Address</th>
                  <th className="py-3 px-4">Profession & Experience</th>
                  <th className="py-3 px-4 text-center">Sheet Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((cust) => (
                  <tr
                    key={cust.cnic}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onPreviewCustomer(cust)}
                  >
                    {/* CNIC */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="p-1 rounded bg-slate-100 text-slate-800 text-[11px]">
                          {cust.cnic}
                        </span>
                      </div>
                    </td>

                    {/* Customer Name & Father */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">
                        {cust.fullName || 'Unnamed'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {cust.fatherName ? `S/O: ${cust.fatherName}` : 'No guardian specified'}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      {cust.phone ? (
                        <div className="text-slate-800 font-medium">{cust.phone}</div>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}
                      {cust.email && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {cust.email}
                        </div>
                      )}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {cust.city || 'Not specified'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {cust.address || '—'}
                      </div>
                    </td>

                    {/* Profession & Experience */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {cust.profession || 'Specialist'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {cust.experienceYears ? `${cust.experienceYears} Years Exp` : '—'}
                      </div>
                    </td>

                    {/* Sync Status */}
                    <td className="py-3.5 px-4 text-center">
                      {cust.syncedToSheet ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>
                            {cust.sheetRowIndex ? `Row #${cust.sheetRowIndex}` : 'Synced'}
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTriggerSync) onTriggerSync();
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 transition-all cursor-pointer shadow-2xs"
                          title="Auto-sync in progress. Click to sync now."
                        >
                          <RefreshCw className={`w-3 h-3 text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Auto-Syncing...' : 'Pending (Sync Now)'}</span>
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => onOpenCVModal(cust)}
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Generate CV / Download PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCustomerToEdit(cust)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Auto-fill into Form to Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete customer ${cust.fullName} (${cust.cnic}) locally?`)) {
                              onDeleteCustomer(cust.cnic);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-200">
            {filtered.map((cust) => (
              <div
                key={cust.cnic}
                className="p-4 hover:bg-slate-50 transition-colors"
                onClick={() => onPreviewCustomer(cust)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {cust.cnic}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{cust.fullName}</h3>
                  </div>

                  {cust.syncedToSheet ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{cust.sheetRowIndex ? `Row #${cust.sheetRowIndex}` : 'Synced'}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTriggerSync) onTriggerSync();
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 shrink-0 transition-colors cursor-pointer"
                      title="Auto-sync in progress. Tap to sync now."
                    >
                      <RefreshCw className={`w-3 h-3 text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Auto-Syncing...' : 'Pending (Tap to Sync)'}</span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-3">
                  {cust.profession && (
                    <p className="font-medium text-slate-800">
                      {cust.profession} {cust.experienceYears ? `(${cust.experienceYears}y)` : ''}
                    </p>
                  )}
                  {cust.phone && (
                    <p className="flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{cust.phone}</span>
                    </p>
                  )}
                  {cust.city && (
                    <p className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{cust.city}</span>
                    </p>
                  )}
                </div>

                {/* Card footer buttons */}
                <div
                  className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onOpenCVModal(cust)}
                    className="flex items-center space-x-1 text-emerald-700 font-semibold px-2 py-1 rounded bg-emerald-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>CV PDF</span>
                  </button>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectCustomerToEdit(cust)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit in form"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete customer ${cust.fullName} (${cust.cnic}) locally?`)) {
                          onDeleteCustomer(cust.cnic);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                      title="Delete customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
