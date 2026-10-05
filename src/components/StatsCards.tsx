import React from 'react';
import { Customer, SheetMetadata } from '../types';
import {
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  Briefcase,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface StatsCardsProps {
  customers: Customer[];
  sheetConfig: SheetMetadata | null;
  pendingCount: number;
  onExportCsv: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  customers,
  sheetConfig,
  pendingCount,
  onExportCsv,
}) => {
  const total = customers.length;
  const synced = customers.filter((c) => c.syncedToSheet).length;

  // City breakdown
  const cityCounts: Record<string, number> = {};
  customers.forEach((c) => {
    const city = c.city?.trim() || 'Unspecified';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const sortedCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Profession breakdown
  const professionCounts: Record<string, number> = {};
  customers.forEach((c) => {
    const prof = c.profession?.trim() || 'General';
    professionCounts[prof] = (professionCounts[prof] || 0) + 1;
  });

  const sortedProfessions = Object.entries(professionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Customers
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{total}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Unique CNIC Verified
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Synced to Sheet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sheet Synced
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{synced}</h3>
            <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[130px]">
              {sheetConfig?.title || 'Connect Sheet'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Offline Sync */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Queue
            </p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</h3>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {pendingCount > 0 ? 'Queued for sync' : 'All synced up'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Cities Covered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Regional Coverage
            </p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">
              {Object.keys(cityCounts).length}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Districts & Cities</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Automated Reporting & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* City Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Customer Geographic Distribution</span>
            </h4>
            <span className="text-xs text-slate-400">Top 5 Regions</span>
          </div>

          <div className="space-y-3">
            {sortedCities.map(([city, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={city}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>{city}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profession & Qualification Breakdown */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>Profession & Skills Spectrum</span>
            </h4>
            <button
              onClick={onExportCsv}
              className="flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="space-y-3">
            {sortedProfessions.map(([prof, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={prof}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span className="truncate max-w-[200px]">{prof}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
