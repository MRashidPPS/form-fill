import React, { useState, useEffect } from 'react';
import { Customer, JobListing } from '../types';
import { searchJobsWithAI } from '../services/aiService';
import {
  Briefcase,
  Search,
  Building2,
  MapPin,
  Calendar,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Zap,
  Filter,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  User,
  Globe,
  Share2,
} from 'lucide-react';

interface JobsSearchHubProps {
  customers: Customer[];
  selectedCustomer?: Customer | null;
  onSelectCustomer: (cust: Customer) => void;
  onOpenAutofillForJob: (job: JobListing, cust?: Customer | null) => void;
  onOpenCVUpload: () => void;
}

export const JobsSearchHub: React.FC<JobsSearchHubProps> = ({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onOpenAutofillForJob,
  onOpenCVUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<'all' | 'govt' | 'private'>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('All Pakistan');
  const [activeCandidate, setActiveCandidate] = useState<Customer | null>(selectedCustomer || null);

  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [groundingSummary, setGroundingSummary] = useState<string>('');
  const [citations, setCitations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync selectedCustomer prop if updated
  useEffect(() => {
    if (selectedCustomer) {
      setActiveCandidate(selectedCustomer);
    }
  }, [selectedCustomer]);

  // Initial search on mount
  useEffect(() => {
    executeSearch();
  }, []);

  const executeSearch = async (overrideCandidate?: Customer | null) => {
    setIsLoading(true);
    setError(null);

    const cand = overrideCandidate !== undefined ? overrideCandidate : activeCandidate;

    try {
      const candidateProfile = cand
        ? {
            qualification: cand.qualification,
            profession: cand.profession,
            skills: cand.skills,
            city: cand.city,
            domicile: cand.customFields?.['Domicile District'] || cand.city,
            experienceYears: cand.experienceYears,
          }
        : undefined;

      const result = await searchJobsWithAI({
        query: searchQuery || (cand ? `${cand.profession} ${cand.qualification}` : 'Data entry IT Officer'),
        sector: sectorFilter,
        provinceOrCity: provinceFilter === 'All Pakistan' ? undefined : provinceFilter,
        candidateProfile,
      });

      setJobs(result.jobs);
      setGroundingSummary(result.groundingSummary || '');
      setCitations(result.citations || []);
    } catch (err: any) {
      console.error('Error in executeSearch:', err);
      setError(err.message || 'Failed to search live jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCandidate = (cand: Customer | null) => {
    setActiveCandidate(cand);
    if (cand) {
      onSelectCustomer(cand);
      executeSearch(cand);
    } else {
      executeSearch(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
                <Globe className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Pakistan Jobs Finder (Govt & Private)
              </h1>
              <span className="text-[11px] bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Live Google Search Grounding
              </span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              Search real-time government (KPPSC, FPSC, PPSC, Police Khidmat Markaz, CFC) and private sector jobs matching candidate qualifications, then 1-click AutoFill the application forms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenCVUpload}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>📄 Upload CV to Match Jobs</span>
            </button>
          </div>
        </div>

        {/* Candidate Matching Selector */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200">Match Jobs for Candidate:</span>
            <select
              value={activeCandidate ? activeCandidate.id : ''}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value) || null;
                handleSelectCandidate(found);
              }}
              className="bg-slate-800/80 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 max-w-xs"
            >
              <option value="">-- General Search (No Candidate) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.qualification || 'No Degree'} • {c.profession || 'Applicant'})
                </option>
              ))}
            </select>
          </div>

          {activeCandidate && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-lg">
              <span>Target: {activeCandidate.profession || activeCandidate.qualification}</span>
              <span>•</span>
              <span>City: {activeCandidate.city || 'Pakistan'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Query Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
              placeholder="Search job title, skill (e.g. Computer Operator, Data Entry, IT Officer, React)..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Sector Filter */}
          <div className="md:col-span-3">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as any)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-700 bg-white"
            >
              <option value="all">🏢 All Sectors (Govt & Private)</option>
              <option value="govt">🏛️ Government Jobs Only (FPSC, KPPSC, PKM)</option>
              <option value="private">💼 Private Sector Jobs Only (Tech, Banks)</option>
            </select>
          </div>

          {/* Province / Location Filter */}
          <div className="md:col-span-2">
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-700 bg-white"
            >
              <option value="All Pakistan">📍 All Pakistan</option>
              <option value="Khyber Pakhtunkhwa">KPK (Peshawar)</option>
              <option value="Islamabad">Islamabad Capital</option>
              <option value="Punjab">Punjab (Lahore/Rwp)</option>
              <option value="Sindh">Sindh (Karachi)</option>
              <option value="Balochistan">Balochistan (Quetta)</option>
            </select>
          </div>

          {/* Search Action */}
          <div className="md:col-span-2">
            <button
              onClick={() => executeSearch()}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Find Jobs</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Tag Suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1">Trending Searches:</span>
          {[
            'KPPSC Computer Operator',
            'CFC Citizen Desk Officer',
            'Police Khidmat Markaz PKM',
            'FPSC Assistant Director',
            'Full Stack Web Developer',
            'NADRA Data Entry Officer',
            'Bank of Khyber IT Officer',
          ].map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setSearchQuery(tag);
                setTimeout(() => executeSearch(), 50);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[11px] text-slate-600 font-medium transition-colors border border-slate-200"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Results List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-800">
              {isLoading ? 'Scanning live Pakistan portals...' : `Available Vacancies (${jobs.length} Found)`}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Grounding: Gemini 3.5 Flash + Google Search
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Querying Google Search for open jobs in Pakistan...
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Scanning KPPSC, FPSC, PPSC, Police Khidmat Markaz, and corporate job feeds in real-time.
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No matching jobs found</p>
            <p className="text-xs text-slate-500">
              Try adjusting your search keywords, sector filter, or selecting a candidate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                          job.sector === 'Government'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {job.sector === 'Government' ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            Govt Portal
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3 h-3 text-blue-700" />
                            Private Sector
                          </>
                        )}
                      </span>
                    </div>

                    {job.matchScore && (
                      <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-lg border border-amber-200">
                        {job.matchScore}% Match
                      </span>
                    )}
                  </div>

                  {/* Title and Org */}
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {job.organization}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.location || 'Pakistan'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.qualificationRequired || 'See Portal'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Last Date: {job.deadline || 'Closing Soon'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Exp: {job.experienceRequired || 'Fresh/Any'}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  {job.summary && (
                    <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                      {job.summary}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>

                  <button
                    onClick={() => onOpenAutofillForJob(job, activeCandidate)}
                    className="px-3.5 py-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>⚡ 1-Click AutoFill Application</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
