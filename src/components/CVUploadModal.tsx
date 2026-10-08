import React, { useState, useRef } from 'react';
import { Customer, ParsedCVData } from '../types';
import { parseCVWithAI, SAMPLE_PAKISTANI_CVS } from '../services/aiService';
import { formatCnic, normalizeCnic } from '../services/sheetsService';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  RefreshCw,
  Search,
  Briefcase,
  UserCheck,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Zap,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  ClipboardPaste,
} from 'lucide-react';

interface CVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCustomers: Customer[];
  onSaveCustomer: (customer: Customer, isUpdate: boolean) => void;
  onSelectForAutofill?: (customer: Customer) => void;
  onSearchJobsForCandidate?: (customer: Customer) => void;
}

export const CVUploadModal: React.FC<CVUploadModalProps> = ({
  isOpen,
  onClose,
  allCustomers,
  onSaveCustomer,
  onSelectForAutofill,
  onSearchJobsForCandidate,
}) => {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'paste' | 'sample'>('upload');
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('local');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  // Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCVData | null>(null);
  const [editableCustomer, setEditableCustomer] = useState<Customer | null>(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setParseError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setParseError(null);
    }
  };

  const handleStartParsing = async (forcedMode?: 'local' | 'cloud') => {
    const currentMode = forcedMode || engineMode;
    setParseError(null);
    setIsParsing(true);
    setParsingStep(
      currentMode === 'local'
        ? 'Extracting candidate details with Local Smart Engine (Zero API Key)...'
        : 'Connecting to Gemini Cloud AI model...'
    );

    try {
      let inputPayload: any = { mode: currentMode };
      if (activeInputTab === 'upload') {
        if (!selectedFile) {
          throw new Error('Please select a CV file (PDF, TXT, DOCX, or Image).');
        }
        setParsingStep(`Reading & processing ${selectedFile.name}...`);
        inputPayload = { ...inputPayload, file: selectedFile };
      } else if (activeInputTab === 'paste') {
        if (!pastedText.trim()) {
          throw new Error('Please paste your CV text into the box.');
        }
        setParsingStep('Analyzing CV text structure...');
        inputPayload = { ...inputPayload, text: pastedText.trim() };
      } else {
        const sample = SAMPLE_PAKISTANI_CVS[selectedSampleIndex];
        setParsingStep(`Analyzing sample CV: ${sample.label}...`);
        inputPayload = { ...inputPayload, text: sample.text, fileName: `${sample.name}.txt` };
      }

      setParsingStep('Extracting CNIC, Father Name, Education & Skills...');
      const data = await parseCVWithAI(inputPayload);
      setParsedData(data);

      // Check if candidate already exists by CNIC
      const normCnic = normalizeCnic(data.cnic);
      const existing = allCustomers.find((c) => normalizeCnic(c.cnic) === normCnic);

      const customerObj: Customer = {
        id: normCnic || `cv-${Date.now()}`,
        cnic: formatCnic(data.cnic),
        fullName: data.fullName,
        fatherName: data.fatherName,
        phone: data.phone,
        email: data.email,
        gender: data.gender || 'Male',
        dob: data.dob,
        address: data.address,
        city: data.city || data.domicile || '',
        qualification: data.qualification,
        profession: data.profession,
        experienceYears: data.experienceYears,
        skills: data.skills,
        bio: data.bio,
        customFields: data.customFields || {},
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedToSheet: false,
      };

      setEditableCustomer(customerObj);
      setIsUpdateMode(Boolean(existing));
      setParsingStep('');
    } catch (err: any) {
      console.error('Error in handleStartParsing:', err);
      setParseError(err.message || 'Failed to extract CV information.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveAndProceed = (action: 'save' | 'autofill' | 'jobs') => {
    if (!editableCustomer) return;

    onSaveCustomer(editableCustomer, isUpdateMode);

    if (action === 'autofill' && onSelectForAutofill) {
      onSelectForAutofill(editableCustomer);
    } else if (action === 'jobs' && onSearchJobsForCandidate) {
      onSearchJobsForCandidate(editableCustomer);
    }

    onClose();
  };

  const handleReset = () => {
    setParsedData(null);
    setEditableCustomer(null);
    setSelectedFile(null);
    setPastedText('');
    setParseError(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-linear-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-300">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">CV Data Collector & Parser</h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                  engineMode === 'local'
                    ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                    : 'bg-indigo-500/30 border-indigo-400/50 text-indigo-200'
                }`}>
                  {engineMode === 'local' ? '⚡ Zero API Key Mode' : '☁️ Gemini Cloud AI'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Automatically extract CNIC, Father Name, Education, Skills, Address & sync to Google Sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Engine Selector Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg ${
                  engineMode === 'local' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {engineMode === 'local' ? '⚡ Local Smart Engine (Zero API Key)' : '☁️ Cloud Gemini AI'}
                  </span>
                  {engineMode === 'local' && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      100% Free • No Key Needed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {engineMode === 'local'
                    ? 'Extracts Pakistani CNIC, Walid Name, Phone, Domicile & Education without any external API key'
                    : 'Requires active Gemini API Key with generative language quota'}
                </p>
              </div>
            </div>

            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 shadow-xs text-xs font-medium">
              <button
                type="button"
                onClick={() => setEngineMode('local')}
                className={`px-3 py-1 rounded-md transition-all ${
                  engineMode === 'local'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ Free (No API Key)
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('cloud')}
                className={`px-3 py-1 rounded-md transition-all ${
                  engineMode === 'cloud'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ☁️ Gemini Cloud
              </button>
            </div>
          </div>

          {parseError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Extraction Issue Encountered</p>
                  <p className="text-xs text-rose-700 mt-0.5">{parseError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEngineMode('local');
                  handleStartParsing('local');
                }}
                className="shrink-0 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Extract with Zero-API-Key Engine
              </button>
            </div>
          )}

          {!parsedData ? (
            /* Input / Upload Mode */
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex border-b border-slate-200 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInputTab('upload')}
                  className={`pb-2.5 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-all ${
                    activeInputTab === 'upload'
                      ? 'border-emerald-600 text-emerald-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Document (PDF / Image / DOCX)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab('paste')}
                  className={`pb-2.5 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-all ${
                    activeInputTab === 'paste'
                      ? 'border-emerald-600 text-emerald-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Paste CV Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab('sample')}
                  className={`pb-2.5 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-all ${
                    activeInputTab === 'sample'
                      ? 'border-emerald-600 text-emerald-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Try Pakistani Demo CVs
                </button>
              </div>

              {/* Tab 1: File Dropzone */}
              {activeInputTab === 'upload' && (
                <div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                        : selectedFile
                        ? 'border-emerald-400 bg-emerald-50/30'
                        : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl mb-3">
                          <FileCheck className="w-10 h-10" />
                        </div>
                        <p className="font-bold text-slate-800 text-base">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for AI extraction
                        </p>
                        <span className="mt-3 text-xs text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full font-medium">
                          Click to select different file
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl mb-3">
                          <UploadCloud className="w-10 h-10" />
                        </div>
                        <p className="font-semibold text-slate-800 text-base">
                          Drag and drop candidate CV here, or browse
                        </p>
                        <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                          Supports <strong>PDF</strong>, Word <strong>DOCX</strong>, Plain <strong>TXT</strong>, or scanned CV <strong>Images (JPG/PNG)</strong>
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                          <span>Pakistani CNIC auto-detection</span>
                          <span>•</span>
                          <span>Father Name recognition</span>
                          <span>•</span>
                          <span>KPK/Punjab/Sindh Domicile</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Paste Text */}
              {activeInputTab === 'paste' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Paste Candidate Resume / Bio-Data Text
                  </label>
                  <textarea
                    rows={9}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste the CV or Resume content here (including CNIC, Father Name, Education, Experience, Skills, Address)..."
                    className="w-full text-xs font-mono p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 text-slate-800"
                  />
                  <p className="text-[11px] text-slate-500">
                    The AI parser handles raw unformatted text, email copies, or WhatsApp bio-data messages.
                  </p>
                </div>
              )}

              {/* Tab 3: Sample CVs */}
              {activeInputTab === 'sample' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 font-medium">
                    Test the AI extraction engine instantly with pre-loaded realistic Pakistani candidate CVs:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SAMPLE_PAKISTANI_CVS.map((sample, idx) => (
                      <div
                        key={sample.name}
                        onClick={() => setSelectedSampleIndex(idx)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          selectedSampleIndex === idx
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800">{sample.label}</span>
                          {selectedSampleIndex === idx && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <pre className="mt-2 text-[10px] text-slate-500 font-mono line-clamp-3 bg-white p-2 rounded border border-slate-100">
                          {sample.text}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Trigger Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isParsing}
                  onClick={() => handleStartParsing()}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm hover:from-emerald-700 hover:to-teal-800 shadow-md flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{parsingStep || 'Extracting CV information...'}</span>
                    </>
                  ) : engineMode === 'local' ? (
                    <>
                      <Zap className="w-4 h-4 text-emerald-200" />
                      <span>⚡ Instant Extract (Zero API Key Needed)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>✨ Extract with Gemini Cloud AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Extracted Data Review & Verification */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Candidate Quick Banner */}
              <div className="p-4 bg-linear-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                    {editableCustomer?.fullName ? editableCustomer.fullName.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">{editableCustomer?.fullName}</h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                        {parsedData.confidence}% Confidence
                      </span>
                      {parsedData.fallbackUsed && (
                        <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full border border-sky-200">
                          Intelligent Document Engine
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-0.5">
                      <span className="font-mono font-medium text-emerald-800">
                        CNIC: {editableCustomer?.cnic || 'Not detected'}
                      </span>
                      <span>•</span>
                      <span>Walid: {editableCustomer?.fatherName || 'Not detected'}</span>
                      <span>•</span>
                      <span>{editableCustomer?.profession}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUpdateMode ? (
                    <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium border border-amber-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                      Existing CNIC found in database (Will Update)
                    </span>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-medium border border-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      New Candidate Profile
                    </span>
                  )}
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 underline px-2 py-1"
                  >
                    Upload Another
                  </button>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Full Name (امیدوار کا نام)</label>
                  <input
                    type="text"
                    value={editableCustomer?.fullName || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, fullName: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800 bg-white"
                  />
                </div>

                {/* Father's Name */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Father's Name (والد کا نام)</label>
                  <input
                    type="text"
                    value={editableCustomer?.fatherName || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, fatherName: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800 bg-white"
                  />
                </div>

                {/* CNIC */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">CNIC / National ID (شناختی کارڈ)</label>
                  <input
                    type="text"
                    value={editableCustomer?.cnic || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) =>
                        prev ? { ...prev, cnic: formatCnic(e.target.value), id: normalizeCnic(e.target.value) } : null
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-900 bg-emerald-50/20"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phone / Mobile (فون نمبر)</label>
                  <input
                    type="text"
                    value={editableCustomer?.phone || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, phone: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 text-slate-800 bg-white"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editableCustomer?.email || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, email: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 text-slate-800 bg-white"
                  />
                </div>

                {/* Gender & DOB */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Gender</label>
                    <select
                      value={editableCustomer?.gender || 'Male'}
                      onChange={(e) =>
                        setEditableCustomer((prev) =>
                          prev ? { ...prev, gender: e.target.value as any } : null
                        )
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">DOB (تاریخ پیدائش)</label>
                    <input
                      type="text"
                      value={editableCustomer?.dob || ''}
                      onChange={(e) =>
                        setEditableCustomer((prev) => (prev ? { ...prev, dob: e.target.value } : null))
                      }
                      placeholder="YYYY-MM-DD or DD-MM-YYYY"
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* City & Domicile */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">City / District (شہر)</label>
                    <input
                      type="text"
                      value={editableCustomer?.city || ''}
                      onChange={(e) =>
                        setEditableCustomer((prev) => (prev ? { ...prev, city: e.target.value } : null))
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Domicile (ڈومیسائل)</label>
                    <input
                      type="text"
                      value={editableCustomer?.customFields?.['Domicile District'] || parsedData.domicile || ''}
                      onChange={(e) =>
                        setEditableCustomer((prev) =>
                          prev
                            ? {
                                ...prev,
                                customFields: { ...prev.customFields, 'Domicile District': e.target.value },
                              }
                            : null
                        )
                      }
                      placeholder="e.g. Peshawar, Swat, Rawalpindi"
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Full Address (پتہ)</label>
                  <input
                    type="text"
                    value={editableCustomer?.address || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, address: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                  />
                </div>

                {/* Qualification */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Highest Qualification (تعلیم)</label>
                  <input
                    type="text"
                    value={editableCustomer?.qualification || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, qualification: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                  />
                </div>

                {/* Profession & Experience */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Profession / Role</label>
                    <input
                      type="text"
                      value={editableCustomer?.profession || ''}
                      onChange={(e) =>
                        setEditableCustomer((prev) => (prev ? { ...prev, profession: e.target.value } : null))
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Experience (Years)</label>
                    <input
                      type="text"
                      value={editableCustomer?.experienceYears || ''}
                      onChange={(e) =>
                        setEditableCustomer((prev) => (prev ? { ...prev, experienceYears: e.target.value } : null))
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Skills */}
                <div className="md:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Key Skills & Competencies</label>
                  <input
                    type="text"
                    value={editableCustomer?.skills || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, skills: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                  />
                </div>

                {/* Bio / Summary */}
                <div className="md:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Career Summary / Bio</label>
                  <textarea
                    rows={2}
                    value={editableCustomer?.bio || ''}
                    onChange={(e) =>
                      setEditableCustomer((prev) => (prev ? { ...prev, bio: e.target.value } : null))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Additional Custom Fields Extracted */}
              {editableCustomer?.customFields && Object.keys(editableCustomer.customFields).length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Additional Metadata & Pakistani Form Fields Detected in CV:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {Object.entries(editableCustomer.customFields).map(([k, v]) => (
                      <div key={k} className="bg-white p-2 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">{k}</span>
                        <span className="font-medium text-slate-800 truncate block">{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {parsedData && editableCustomer && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              Back / Upload Another
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Option 1: Search Pakistan Jobs for this candidate */}
              {onSearchJobsForCandidate && (
                <button
                  type="button"
                  onClick={() => handleSaveAndProceed('jobs')}
                  className="px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-blue-600" />
                  <span>Find Pakistan Jobs (Govt & Private)</span>
                </button>
              )}

              {/* Option 2: Autofill web forms */}
              {onSelectForAutofill && (
                <button
                  type="button"
                  onClick={() => handleSaveAndProceed('autofill')}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>⚡ AutoFill Web Forms with this CV</span>
                </button>
              )}

              {/* Option 3: Primary Save to Sheet & DB */}
              <button
                type="button"
                onClick={() => handleSaveAndProceed('save')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Candidate & Sync to Sheet</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
