import React, { useState, useRef, useEffect } from 'react';
import { Customer, SheetMetadata, DetectedField } from '../types';
import {
  autofillFormAndHarvest,
  generateBookmarkletCode,
  generateExtensionFiles,
} from '../services/autofillService';
import { normalizeCnic, formatCnic } from '../services/sheetsService';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Download,
  Play,
  RotateCcw,
  Zap,
  Globe,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Code2,
} from 'lucide-react';

interface AutofillHubProps {
  customers: Customer[];
  sheetConfig: SheetMetadata | null;
  onSaveNewFieldsToCustomer: (
    cnic: string,
    newFields: Record<string, string>
  ) => Promise<void>;
  isOnline: boolean;
  isSignedIn: boolean;
}

type SimulatorTemplate = 'job' | 'passport' | 'admission' | 'banking';

export const AutofillHub: React.FC<AutofillHubProps> = ({
  customers,
  sheetConfig,
  onSaveNewFieldsToCustomer,
  isOnline,
  isSignedIn,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<SimulatorTemplate>('job');
  const [simulatorCnic, setSimulatorCnic] = useState('');
  const [detectedNewFields, setDetectedNewFields] = useState<Record<string, string>>({});
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'bookmarklet' | 'extension'>('simulator');

  const formContainerRef = useRef<HTMLDivElement>(null);

  // Generate bookmarklet code with current app URL & synced records
  const currentUrl = window.location.origin;
  const bookmarkletCode = generateBookmarkletCode(
    currentUrl,
    customers,
    sheetConfig?.title || 'Connected Sheet'
  );

  const extensionFiles = generateExtensionFiles(
    currentUrl,
    customers,
    sheetConfig?.title || 'Connected Sheet'
  );

  // Handle CNIC input inside the form simulator
  const handleSimulatorCnicChange = (val: string) => {
    setSimulatorCnic(val);
    setHubError(null);
    const norm = normalizeCnic(val);
    if (norm.length >= 5) {
      const match = customers.find((c) => normalizeCnic(c.cnic) === norm);
      if (match && formContainerRef.current) {
        // Trigger autofill across the simulated web form
        const result = autofillFormAndHarvest(formContainerRef.current, match);

        // Check for any new unmapped fields that currently have values in the form
        harvestCurrentFormNewFields(match);
      }
    }
  };

  // Inspect form for any new unmapped fields that have values entered
  const harvestCurrentFormNewFields = (customer?: Customer) => {
    if (!formContainerRef.current) return;
    const norm = normalizeCnic(simulatorCnic);
    const activeCustomer =
      customer || customers.find((c) => normalizeCnic(c.cnic) === norm);

    if (!activeCustomer) return;

    const { detectedFields } = autofillFormAndHarvest(
      formContainerRef.current,
      activeCustomer
    );

    const newFieldMap: Record<string, string> = {};
    detectedFields.forEach((df) => {
      if (df.isNew && df.value.trim().length > 0) {
        newFieldMap[df.label || df.key] = df.value.trim();
      }
    });

    setDetectedNewFields(newFieldMap);
  };

  // Save detected new fields to Google Sheet under this CNIC
  const handleSaveDetectedFields = async () => {
    const norm = normalizeCnic(simulatorCnic);
    const activeCustomer = customers.find((c) => normalizeCnic(c.cnic) === norm);
    if (!activeCustomer) {
      setHubError('Please enter a valid CNIC to associate new fields with a customer.');
      return;
    }

    if (Object.keys(detectedNewFields).length === 0) {
      setHubError('No new fields with values detected. Fill in the extra fields first.');
      return;
    }

    setIsSavingFields(true);
    setHubError(null);
    try {
      await onSaveNewFieldsToCustomer(activeCustomer.cnic, detectedNewFields);
      setSaveSuccessMessage(
        `Successfully saved ${Object.keys(detectedNewFields).length} new fields to Google Sheet under CNIC ${activeCustomer.cnic}! The sheet headers were expanded with new columns.`
      );
      setDetectedNewFields({});
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      setHubError(`Error saving fields: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    setTimeout(() => setCopiedBookmarklet(false), 3000);
  };

  const handleResetSimulator = () => {
    setSimulatorCnic('');
    setDetectedNewFields({});
    if (formContainerRef.current) {
      const inputs = formContainerRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea'
      );
      inputs.forEach((input) => {
        if (input.type === 'checkbox' || input.type === 'radio') {
          (input as HTMLInputElement).checked = false;
        } else {
          input.value = '';
        }
      });
    }
  };

  const handleLaunchFloatingTester = () => {
    try {
      const scriptCode = bookmarkletCode.replace(/^javascript:/, '');
      const decoded = decodeURIComponent(scriptCode);
      const fn = new Function(decoded);
      fn();
    } catch (e) {
      console.error('Launch test failed:', e);
    }
  };

  // Download extension files
  const handleDownloadExtensionZip = () => {
    const files = [
      { name: 'manifest.json', content: extensionFiles.manifest },
      { name: 'content.js', content: extensionFiles.contentJs },
      { name: 'popup.html', content: extensionFiles.popupHtml },
      { name: 'popup.js', content: extensionFiles.popupJs },
    ];

    files.forEach((f) => {
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Zap className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">
                Universal Web Form AutoFiller & Field Collector
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Fill forms on <strong>any third-party website</strong>: as soon as you type or paste a CNIC, it auto-fills remaining data from your Google Sheet. If any new form fields are found on the website, it collects and appends them to your Google Sheet under that CNIC!
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleLaunchFloatingTester}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Test Floating Widget</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'simulator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            1. Web Form Simulator & New Field Collector
          </button>
          <button
            onClick={() => setActiveSubTab('bookmarklet')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'bookmarklet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            2. Universal 1-Click Bookmarklet (Any Site)
          </button>
          <button
            onClick={() => setActiveSubTab('extension')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'extension'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            3. Browser Extension (Chrome/Edge)
          </button>
        </div>
      </div>

      {/* SubTab 1: Interactive Form Simulator & New Field Collector */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          {/* Controls & Quick Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Simulate Filling Forms on Third-Party Websites</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick a simulated website portal, type any CNIC, watch it auto-fill, and test collecting brand new fields!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Select Portal:</span>
              <button
                onClick={() => {
                  setSelectedTemplate('job');
                  handleResetSimulator();
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedTemplate === 'job'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Job Portal
              </button>
              <button
                onClick={() => {
                  setSelectedTemplate('passport');
                  handleResetSimulator();
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedTemplate === 'passport'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Gov / Passport
              </button>
              <button
                onClick={() => {
                  setSelectedTemplate('admission');
                  handleResetSimulator();
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedTemplate === 'admission'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                University Admission
              </button>
              <button
                onClick={() => {
                  setSelectedTemplate('banking');
                  handleResetSimulator();
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedTemplate === 'banking'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Banking / KYC
              </button>
            </div>
          </div>

          {/* Quick Helper for Available CNICs */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center space-x-2">
              <span className="font-bold">Available CNICs in Database:</span>
              <div className="flex flex-wrap gap-1">
                {customers.map((c) => (
                  <button
                    key={c.cnic}
                    onClick={() => {
                      setSimulatorCnic(c.cnic);
                      handleSimulatorCnicChange(c.cnic);
                    }}
                    className="font-mono bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    {c.cnic} ({c.fullName.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleResetSimulator}
              className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 bg-white px-2 py-1 rounded border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Form</span>
            </button>
          </div>

          {/* Notification when new fields are saved */}
          {saveSuccessMessage && (
            <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-md flex items-center space-x-3 text-xs sm:text-sm font-semibold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Error notification */}
          {hubError && (
            <div className="p-4 bg-rose-600 text-white rounded-xl shadow-md flex items-center space-x-3 text-xs sm:text-sm font-semibold animate-in fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{hubError}</span>
            </div>
          )}

          {/* New Fields Alert & Collector Action Bar */}
          {Object.keys(detectedNewFields).length > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-md border border-amber-400 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in slide-in-from-top">
              <div>
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>
                    New Form Fields Detected on Website ({Object.keys(detectedNewFields).length})!
                  </span>
                </div>
                <div className="text-xs mt-1 text-amber-950 flex flex-wrap gap-1.5">
                  {Object.entries(detectedNewFields).map(([k, v]) => (
                    <span
                      key={k}
                      className="bg-white/80 px-2 py-0.5 rounded font-mono font-bold text-[11px]"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-amber-950 mt-1">
                  These fields do not exist in the customer's sheet row. Click below to append them as new columns in Google Sheet under CNIC <strong>{simulatorCnic}</strong>!
                </p>
              </div>

              <button
                onClick={handleSaveDetectedFields}
                disabled={isSavingFields}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md shrink-0 transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>
                  {isSavingFields ? 'Syncing...' : 'Save New Fields to Sheet'}
                </span>
              </button>
            </div>
          )}

          {/* Simulated Third-Party Web Form Container */}
          <div
            ref={formContainerRef}
            className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm overflow-hidden"
          >
            {/* Fake Browser Top URL Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center space-x-3 text-xs text-slate-500">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white border border-slate-200 px-3 py-1 rounded-md text-slate-700 font-mono text-[11px] flex items-center justify-between">
                <span>
                  https://
                  {selectedTemplate === 'job'
                    ? 'jobs.gov.pk/apply/software-engineer'
                    : selectedTemplate === 'passport'
                    ? 'dgip.gov.pk/online-passport-application'
                    : selectedTemplate === 'admission'
                    ? 'admissions.university.edu.pk/fall-2026'
                    : 'online-banking.portal.com/kyc-verification'}
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-sans font-bold">
                  ⚡ AutoFiller Armed
                </span>
              </div>
            </div>

            {/* Simulated Form Body */}
            <div className="p-6 space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {selectedTemplate === 'job'
                    ? 'National Job Portal - Candidate Online Application'
                    : selectedTemplate === 'passport'
                    ? 'Directorate General of Immigration & Passports - Application'
                    : selectedTemplate === 'admission'
                    ? 'University Graduate Admission Portal'
                    : 'Customer Due Diligence & KYC Verification Form'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Type your CNIC in the field below to automatically fill the application form from your Google Sheet.
                </p>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* CNIC (The trigger input) */}
                <div className="sm:col-span-2 lg:col-span-3 p-3 rounded-xl bg-slate-50 border border-slate-300">
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>National ID / CNIC (Trigger Field) *</span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">
                      Type CNIC here to auto-fill
                    </span>
                  </label>
                  <input
                    type="text"
                    name="applicant_cnic"
                    id="applicant_cnic"
                    value={simulatorCnic}
                    onChange={(e) => handleSimulatorCnicChange(e.target.value)}
                    placeholder="Enter CNIC (e.g. 35201-1234567-1)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Candidate Name */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    name="applicant_name"
                    id="applicant_name"
                    placeholder="Full Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Father Name */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Father / Guardian Name *
                  </label>
                  <input
                    type="text"
                    name="father_name"
                    id="father_name"
                    placeholder="Father Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="text"
                    name="contact_number"
                    id="contact_number"
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="applicant_email"
                    id="applicant_email"
                    placeholder="Email address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    id="gender"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="birth_date"
                    id="birth_date"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    District / City
                  </label>
                  <input
                    type="text"
                    name="city_domicile"
                    id="city_domicile"
                    placeholder="City"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Permanent Address
                  </label>
                  <input
                    type="text"
                    name="residential_address"
                    id="residential_address"
                    placeholder="Address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Education */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Highest Education / Degree
                  </label>
                  <input
                    type="text"
                    name="highest_qualification"
                    id="highest_qualification"
                    placeholder="Degree"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Profession / Role */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Current Designation / Profession
                  </label>
                  <input
                    type="text"
                    name="current_designation"
                    id="current_designation"
                    placeholder="Designation"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Total Experience (Years)
                  </label>
                  <input
                    type="text"
                    name="total_experience"
                    id="total_experience"
                    placeholder="Years"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* --- TEMPLATE SPECIFIC NEW FIELDS (To test new field detection & harvesting!) --- */}
                <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-dashed border-amber-300 mt-2 bg-amber-50/50 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>
                        Simulated Website-Specific Fields (Try filling these to test new field collection!):
                      </span>
                    </span>
                    <span className="text-[11px] text-amber-800 italic">
                      Any values typed here will be harvested and added as new columns in Google Sheet
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedTemplate === 'job' && (
                      <>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Domicile Province (New Field)
                          </label>
                          <input
                            type="text"
                            name="domicile_province"
                            id="domicile_province"
                            placeholder="e.g. Punjab / Sindh / KPK"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Postal Code (New Field)
                          </label>
                          <input
                            type="text"
                            name="postal_code"
                            id="postal_code"
                            placeholder="e.g. 44000"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Expected Salary PKR (New Field)
                          </label>
                          <input
                            type="text"
                            name="expected_salary"
                            id="expected_salary"
                            placeholder="e.g. 180,000"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </>
                    )}

                    {selectedTemplate === 'passport' && (
                      <>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Mother Name (New Field)
                          </label>
                          <input
                            type="text"
                            name="mother_name"
                            id="mother_name"
                            placeholder="Mother Full Name"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Blood Group (New Field)
                          </label>
                          <input
                            type="text"
                            name="blood_group"
                            id="blood_group"
                            placeholder="e.g. O+ / B+"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Emergency Contact (New Field)
                          </label>
                          <input
                            type="text"
                            name="emergency_contact"
                            id="emergency_contact"
                            placeholder="+92 300 0000000"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                      </>
                    )}

                    {selectedTemplate === 'admission' && (
                      <>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Intermediate Marks (New Field)
                          </label>
                          <input
                            type="text"
                            name="intermediate_marks"
                            id="intermediate_marks"
                            placeholder="e.g. 950 / 1100"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Preferred Shift (New Field)
                          </label>
                          <input
                            type="text"
                            name="preferred_shift"
                            id="preferred_shift"
                            placeholder="Morning / Evening"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Hostel Required (New Field)
                          </label>
                          <input
                            type="text"
                            name="hostel_facility"
                            id="hostel_facility"
                            placeholder="Yes / No"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                      </>
                    )}

                    {selectedTemplate === 'banking' && (
                      <>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Monthly Income PKR (New Field)
                          </label>
                          <input
                            type="text"
                            name="monthly_income"
                            id="monthly_income"
                            placeholder="e.g. 250,000"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Bank Account IBAN (New Field)
                          </label>
                          <input
                            type="text"
                            name="account_iban"
                            id="account_iban"
                            placeholder="PK36... (IBAN)"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1">
                            Tax NTN Number (New Field)
                          </label>
                          <input
                            type="text"
                            name="tax_ntn_number"
                            id="tax_ntn_number"
                            placeholder="e.g. 1234567-8"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Universal Bookmarklet (Works on ANY website) */}
      {activeSubTab === 'bookmarklet' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="max-w-3xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <span>1-Click Universal Browser Bookmarklet</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Use this on <strong>any website in the world</strong> (Google Chrome, Microsoft Edge, Safari, Firefox, Brave, Opera, or Android Chrome). Just drag this button to your Bookmarks Bar once.
            </p>
          </div>

          {/* Draggable Button Box */}
          <div className="p-6 bg-slate-50 border-2 border-dashed border-emerald-400 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Draggable Bookmarklet Button
              </span>
              <p className="text-xs text-slate-700">
                Click &amp; drag this button directly to your browser's Bookmarks bar (Ctrl+Shift+B):
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={bookmarkletCode}
                onClick={(e) => {
                  e.preventDefault();
                  handleCopyBookmarklet();
                }}
                className="cursor-grab active:cursor-grabbing px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm shadow-md flex items-center space-x-2 select-none"
                title="Drag to Bookmarks bar (or click to copy)"
              >
                <Zap className="w-4 h-4 fill-current text-yellow-300" />
                <span>⚡ SyncSheet AutoFiller</span>
              </a>

              <button
                onClick={handleCopyBookmarklet}
                className="px-4 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                {copiedBookmarklet ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Copied Code!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center mb-2">
                1
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Add to Bookmarks</h4>
              <p className="text-slate-600 leading-relaxed">
                Press <code className="px-1 py-0.5 bg-slate-200 rounded font-bold">Ctrl + Shift + B</code> to display your Bookmarks bar, then drag the green button onto it.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center mb-2">
                2
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Open Any Web Form</h4>
              <p className="text-slate-600 leading-relaxed">
                Go to any job portal, government site, or university page. Click the <strong>⚡ SyncSheet AutoFiller</strong> bookmark. A floating bar appears!
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center mb-2">
                3
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Type CNIC &amp; Collect Fields</h4>
              <p className="text-slate-600 leading-relaxed">
                Type the CNIC: it auto-fills all fields. If new fields appear on the form, click <strong>Save New Fields</strong> to append columns to Google Sheet!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Full Browser Extension Package (Chrome/Edge/Brave) */}
      {activeSubTab === 'extension' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-blue-600" />
                <span>Downloadable Browser Extension (Manifest V3)</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Install as a native Chrome or Edge extension to automatically run on <em>every</em> website without needing to click a bookmark!
              </p>
            </div>

            <button
              onClick={handleDownloadExtensionZip}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download Extension Files</span>
            </button>
          </div>

          {/* Setup steps */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3 text-xs text-slate-700">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">
              How to Install in Google Chrome or Microsoft Edge (2 minutes):
            </h4>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>
                Click <strong>"Download Extension Files"</strong> above to save the files (<code>manifest.json</code>, <code>content.js</code>, <code>popup.html</code>, <code>popup.js</code>) into a folder named <code>syncsheet-extension</code>.
              </li>
              <li>
                Open your browser and navigate to{' '}
                <code className="px-1.5 py-0.5 bg-slate-200 rounded font-mono font-bold">chrome://extensions</code> (or <code className="px-1.5 py-0.5 bg-slate-200 rounded font-mono font-bold">edge://extensions</code>).
              </li>
              <li>
                Toggle ON the <strong>"Developer mode"</strong> switch in the top-right corner.
              </li>
              <li>
                Click the <strong>"Load unpacked"</strong> button in the top-left and select your <code>syncsheet-extension</code> folder.
              </li>
              <li>
                That's it! Now whenever you visit any website and type a CNIC in any form, it auto-fills the remaining data and captures new fields under that CNIC.
              </li>
            </ol>
          </div>

          {/* Extension file previews */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2.5 font-mono font-bold text-slate-700 border-b border-slate-200">
              manifest.json (Chrome Extension V3)
            </div>
            <pre className="p-4 bg-slate-900 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
              {extensionFiles.manifest}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
