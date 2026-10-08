import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Customer, SheetMetadata, DetectedField, AIFieldMatch } from '../types';
import {
  autofillFormAndHarvest,
  generateBookmarkletCode,
  generateExtensionFiles,
  extractCustomerFromForm,
} from '../services/autofillService';
import { normalizeCnic, formatCnic } from '../services/sheetsService';
import { matchFormFieldsWithAI } from '../services/aiService';
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
  RefreshCw,
  Smartphone,
  Shield,
  Laptop,
  Cloud,
  Cpu,
  Eye,
  FileText,
  Search,
} from 'lucide-react';

interface AutofillHubProps {
  customers: Customer[];
  sheetConfig: SheetMetadata | null;
  onSaveNewFieldsToCustomer: (
    cnic: string,
    newFields: Record<string, string>
  ) => Promise<void>;
  onCollectAndSaveCustomer?: (customer: Customer) => Promise<{ success: boolean; message: string }> | void;
  onRefreshSheet?: () => Promise<void>;
  userEmail?: string;
  isOnline: boolean;
  isSignedIn: boolean;
  initialSubTab?: 'simulator' | 'bookmarklet' | 'extension' | 'mobile-police';
  onOpenCVUpload?: () => void;
  onSearchJobs?: (customer?: Customer | null) => void;
}

type SimulatorTemplate = 'cfc' | 'job' | 'passport' | 'admission' | 'banking';

export const AutofillHub: React.FC<AutofillHubProps> = ({
  customers,
  sheetConfig,
  onSaveNewFieldsToCustomer,
  onCollectAndSaveCustomer,
  onRefreshSheet,
  userEmail,
  isOnline,
  isSignedIn,
  initialSubTab,
  onOpenCVUpload,
  onSearchJobs,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<SimulatorTemplate>('cfc');
  const [simulatorCnic, setSimulatorCnic] = useState('');
  const [simulatorSearch, setSimulatorSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [detectedNewFields, setDetectedNewFields] = useState<Record<string, string>>({});
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [isRefreshingSheet, setIsRefreshingSheet] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [isCollectingSimulator, setIsCollectingSimulator] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'ai-scanner' | 'bookmarklet' | 'extension' | 'mobile-police'>(
    initialSubTab || 'simulator'
  );

  // AI Field Matching State
  const [isAIMatching, setIsAIMatching] = useState(false);
  const [aiFieldMatches, setAiFieldMatches] = useState<Record<string, AIFieldMatch>>({});
  const [aiMatchMessage, setAiMatchMessage] = useState<string | null>(null);

  // Custom AI Portal Inspector State
  const [customFormHtml, setCustomFormHtml] = useState<string>('');
  const [customInspectorResults, setCustomInspectorResults] = useState<AIFieldMatch[]>([]);
  const [isInspectingCustom, setIsInspectingCustom] = useState(false);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // Mobile / Police Sahulat Markaz Mode state
  const [selectedMobileCnic, setSelectedMobileCnic] = useState<string>(customers[0]?.cnic || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [autoAdvanceIndex, setAutoAdvanceIndex] = useState<number>(0);
  const [customFieldKey, setCustomFieldKey] = useState<string>('');
  const [customFieldValue, setCustomFieldValue] = useState<string>('');
  const [isMappingField, setIsMappingField] = useState<boolean>(false);

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

  // Filter customers for simulator search with black text
  const filteredSimulatorCustomers = customers.filter((c) => {
    const q = simulatorSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.cnic.toLowerCase().includes(q) ||
      normalizeCnic(c.cnic).includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  });

  const matchedSimulatorCustomer = customers.find((c) => {
    const norm = normalizeCnic(simulatorCnic);
    const cDigits = normalizeCnic(c.cnic);
    return (
      cDigits === norm ||
      (norm.length >= 5 && cDigits.startsWith(norm)) ||
      c.cnic.toLowerCase() === simulatorCnic.trim().toLowerCase()
    );
  }) || (simulatorCnic.trim().length > 0 && customers.length > 0 ? customers[0] : null);

  // Handle CNIC input inside the form simulator
  const handleSimulatorCnicChange = (val: string) => {
    setSimulatorCnic(val);
    setHubError(null);
    const norm = normalizeCnic(val);
    if (norm.length >= 5 || /^\d{5}-\d{7}-\d{1}$/.test(val.trim())) {
      const match = customers.find((c) => {
        const cDigits = normalizeCnic(c.cnic);
        return (
          cDigits === norm ||
          (norm.length >= 5 && cDigits.startsWith(norm)) ||
          c.cnic.toLowerCase() === val.trim().toLowerCase()
        );
      });
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

  // Collect new data entered into the simulator form and save to Google Sheet before submission
  const handleCollectSimulatorFormToSheet = async () => {
    if (!formContainerRef.current) return;
    setIsCollectingSimulator(true);
    setHubError(null);
    try {
      const res = extractCustomerFromForm(formContainerRef.current);
      if (!res.customer || res.extractedFields.length === 0) {
        setHubError('⚠️ No filled fields found in the simulator form. Please enter candidate details in the form first!');
        return;
      }

      let cnic = res.customer.cnic || simulatorCnic;
      if (!cnic || normalizeCnic(cnic).length < 5) {
        const promptCnic = prompt(
          `📥 Scanned ${res.extractedFields.length} filled form fields!\nPlease enter CNIC (xxxxx-xxxxxxx-x) to save under in your Google Sheet:`,
          '35201-1234567-1'
        );
        if (!promptCnic) return;
        cnic = formatCnic(promptCnic);
      }

      const fullCustomer: Customer = {
        ...res.customer,
        id: normalizeCnic(cnic),
        cnic: formatCnic(cnic),
        fullName: res.customer.fullName || 'New Candidate',
        updatedAt: new Date().toISOString(),
      };

      if (onCollectAndSaveCustomer) {
        await onCollectAndSaveCustomer(fullCustomer);
      }

      setSimulatorCnic(fullCustomer.cnic);
      setSaveSuccessMessage(
        `✓ Collected ${res.extractedFields.length} field(s)! Successfully saved to your Google Sheet under CNIC ${fullCustomer.cnic} before submission.`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      setHubError(`Failed to save collected form: ${err.message}`);
    } finally {
      setIsCollectingSimulator(false);
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
    setAiFieldMatches({});
    setAiMatchMessage(null);
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

  // Run AI Form Field Classification on current simulated form
  const handleRunAIMatcher = async () => {
    if (!formContainerRef.current) return;
    setIsAIMatching(true);
    setAiMatchMessage(null);

    try {
      const inputs = formContainerRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea'
      );

      const fieldsMetadata: any[] = [];
      inputs.forEach((el) => {
        const id = el.id || '';
        const name = el.name || '';
        const placeholder = ('placeholder' in el ? el.placeholder : '') || '';
        const type = el.type || 'text';
        const labelEl = el.closest('div')?.querySelector('label');
        const label = labelEl?.textContent?.replace(/\*|\(.*?\)/g, '').trim() || '';

        if (id || name) {
          fieldsMetadata.push({
            id: id || name,
            name: name || id,
            label: label || id || name,
            placeholder,
            type,
            tag: el.tagName.toLowerCase(),
          });
        }
      });

      const activeCust =
        customers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(simulatorCnic)) ||
        customers[0] ||
        null;

      const portalTitle =
        selectedTemplate === 'cfc'
          ? 'Citizen Facilitation Center (CFC) KP Citizen Registration'
          : selectedTemplate === 'job'
          ? 'National Job Portal Application'
          : selectedTemplate === 'passport'
          ? 'Directorate General Immigration & Passports'
          : 'Government e-Portal';

      const mappings = await matchFormFieldsWithAI(
        fieldsMetadata,
        {
          url:
            selectedTemplate === 'cfc'
              ? 'https://cfc.kp.gov.pk/Citizen/Citizen/Register'
              : 'https://jobs.gov.pk',
          title: portalTitle,
          portalType: selectedTemplate,
        },
        activeCust || undefined
      );

      const mapObj: Record<string, AIFieldMatch> = {};
      mappings.forEach((m) => {
        mapObj[m.fieldIdOrName] = m;
      });

      setAiFieldMatches(mapObj);
      setAiMatchMessage(
        `🤖 Gemini AI analyzed and matched ${mappings.length} form fields with semantic confidence!`
      );
    } catch (err: any) {
      console.error('Error running AI matcher:', err);
      setHubError(err.message || 'AI field matching failed');
      setTimeout(() => setHubError(null), 5000);
    } finally {
      setIsAIMatching(false);
    }
  };

  // Inspect Custom HTML Form with Gemini AI
  const handleInspectCustomFormHtml = async (sampleHtml?: string) => {
    const rawHtml = sampleHtml || customFormHtml;
    if (!rawHtml.trim()) return;

    setIsInspectingCustom(true);
    setHubError(null);

    try {
      // Parse HTML to extract input fields
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      const inputs = doc.querySelectorAll('input, select, textarea');

      const extractedFields: any[] = [];
      inputs.forEach((el, index) => {
        const id = el.id || `field_${index}`;
        const name = (el as HTMLInputElement).name || id;
        const placeholder = (el as HTMLInputElement).placeholder || '';
        const type = (el as HTMLInputElement).type || 'text';
        const label =
          el.getAttribute('aria-label') ||
          el.closest('label')?.textContent?.trim() ||
          doc.querySelector(`label[for="${id}"]`)?.textContent?.trim() ||
          name;

        extractedFields.push({
          id,
          name,
          label: label.replace(/\*|\(.*?\)/g, '').trim(),
          placeholder,
          type,
          tag: el.tagName.toLowerCase(),
        });
      });

      if (extractedFields.length === 0) {
        throw new Error('No input or form fields detected in the provided HTML.');
      }

      const activeCust =
        customers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(simulatorCnic)) ||
        customers[0] ||
        null;

      const mappings = await matchFormFieldsWithAI(
        extractedFields,
        {
          title: 'Custom User Provided Portal Form',
          portalType: 'custom',
        },
        activeCust || undefined
      );

      setCustomInspectorResults(mappings);
    } catch (err: any) {
      console.error('Custom inspection error:', err);
      setHubError(err.message || 'Failed to analyze custom form HTML');
    } finally {
      setIsInspectingCustom(false);
    }
  };

  // Helper to render AI confidence badge on form labels
  const renderAiBadge = (fieldId: string) => {
    const match = aiFieldMatches[fieldId];
    if (!match) return null;
    return (
      <span
        className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-md font-semibold inline-flex items-center gap-1 shrink-0 ml-1.5 animate-in fade-in"
        title={`${match.reasoning} • Matched to ${match.matchedCustomerKey}`}
      >
        <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
        <span>{match.confidence}% AI Match</span>
        {match.suggestedUrduLabel && (
          <span className="text-slate-400 font-normal">({match.suggestedUrduLabel})</span>
        )}
      </span>
    );
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

  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Download extension files as a single real .ZIP bundle
  const handleDownloadExtensionZip = async () => {
    setIsZipping(true);
    setDownloadSuccess(null);
    try {
      const zip = new JSZip();
      zip.file('manifest.json', extensionFiles.manifest);
      zip.file('data.js', extensionFiles.dataJs);
      zip.file('background.js', extensionFiles.backgroundJs);
      zip.file('content.js', extensionFiles.contentJs);
      zip.file('popup.html', extensionFiles.popupHtml);
      zip.file('popup.js', extensionFiles.popupJs);
      zip.file('README.md', extensionFiles.readmeMd);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'syncsheet-autofiller-v2.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess('Extension package (syncsheet-autofiller-v2.zip) downloaded! Extract it and load into Chrome/Edge.');
      setTimeout(() => setDownloadSuccess(null), 6000);
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      // Fallback: download individual files
      handleDownloadSingleFile('manifest.json', extensionFiles.manifest);
      handleDownloadSingleFile('data.js', extensionFiles.dataJs);
      handleDownloadSingleFile('background.js', extensionFiles.backgroundJs);
      handleDownloadSingleFile('content.js', extensionFiles.contentJs);
      handleDownloadSingleFile('popup.html', extensionFiles.popupHtml);
      handleDownloadSingleFile('popup.js', extensionFiles.popupJs);
      handleDownloadSingleFile('README.md', extensionFiles.readmeMd);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadSingleFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('mobile-police')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'mobile-police'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>📱 Mobile &amp; Police Sahulat Markaz Mode</span>
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'simulator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            1. Form Simulator &amp; Field Harvester
          </button>
          <button
            onClick={() => setActiveSubTab('bookmarklet')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'bookmarklet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            2. Universal 1-Click Bookmarklet
          </button>
          <button
            onClick={() => setActiveSubTab('extension')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSubTab === 'extension'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            3. Browser Extension (Chrome/Edge v2.1)
          </button>
          <button
            onClick={() => setActiveSubTab('ai-scanner')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'ai-scanner'
                ? 'bg-linear-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-xs'
                : 'text-indigo-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>4. 🤖 AI Field Matcher & Portal Inspector</span>
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
                  setSelectedTemplate('cfc');
                  handleResetSimulator();
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center space-x-1 ${
                  selectedTemplate === 'cfc'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <span>🏛️</span>
                <span>KP Citizen Portal (cfc.kp.gov.pk)</span>
              </button>
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
                  {selectedTemplate === 'cfc'
                    ? 'cfc.kp.gov.pk/Citizen/Citizen/Register'
                    : selectedTemplate === 'job'
                    ? 'jobs.gov.pk/apply/software-engineer'
                    : selectedTemplate === 'passport'
                    ? 'dgip.gov.pk/online-passport-application'
                    : selectedTemplate === 'admission'
                    ? 'admissions.university.edu.pk/fall-2026'
                    : 'online-banking.portal.com/kyc-verification'}
                </span>
                <div className="flex items-center space-x-2">
                  {selectedTemplate === 'cfc' && (
                    <a
                      href="https://cfc.kp.gov.pk/Citizen/Citizen/Register"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-sans font-bold flex items-center space-x-1 underline"
                      title="Open real official CFC portal in new browser tab"
                    >
                      <span>Open Real Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-sans font-bold">
                    ⚡ AutoFiller Armed
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Form Body */}
            <div className="p-6 space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {selectedTemplate === 'cfc'
                    ? 'Citizen Facilitation Center (CFC) KP - Citizen Registration (cfc.kp.gov.pk)'
                    : selectedTemplate === 'job'
                    ? 'National Job Portal - Candidate Online Application'
                    : selectedTemplate === 'passport'
                    ? 'Directorate General of Immigration & Passports - Application'
                    : selectedTemplate === 'admission'
                    ? 'University Graduate Admission Portal'
                    : 'Customer Due Diligence & KYC Verification Form'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedTemplate === 'cfc'
                    ? 'Simulating the official KPK Citizen Facilitation Center registration form. Type CNIC or click AutoFill to fill all citizen fields from your Google Sheet, and harvest new fields (Tehsil, Domicile, Police Station) into sheet columns!'
                    : 'Type your CNIC in the field below to automatically fill the application form from your Google Sheet.'}
                </p>
              </div>

              {/* Simulated Floating AutoFill Button & Dock directly on this page */}
              <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-slate-700">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center space-x-2">
                      <span>⚡ AutoFill Button on this Page</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-semibold">
                        Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Matches your connected Google Sheet ({customers.length} records ready). Click to populate:
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Customer Input with Guaranteed BLACK WRITING */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={simulatorSearch}
                      onChange={(e) => setSimulatorSearch(e.target.value)}
                      placeholder="Search (Name, CNIC)..."
                      className="pl-8 pr-2.5 py-1.5 bg-white text-slate-900 placeholder:text-slate-500 font-semibold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56"
                    />
                  </div>

                  <select
                    value={simulatorCnic}
                    onChange={(e) => {
                      setSimulatorCnic(e.target.value);
                      handleSimulatorCnicChange(e.target.value);
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs font-semibold text-white focus:ring-1 focus:ring-emerald-500 max-w-[200px]"
                  >
                    <option value="">-- Choose Customer from Sheet --</option>
                    {filteredSimulatorCustomers.map((c) => (
                      <option key={c.cnic} value={c.cnic}>
                        {c.cnic} - {c.fullName}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const target = customers.find(c => normalizeCnic(c.cnic) === normalizeCnic(simulatorCnic)) || customers[0];
                      if (target) {
                        setSimulatorCnic(target.cnic);
                        handleSimulatorCnicChange(target.cnic);
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Auto-Fill</span>
                  </button>

                  {/* Collect and Save Form to Google Sheet Before Submitting */}
                  <button
                    type="button"
                    onClick={handleCollectSimulatorFormToSheet}
                    disabled={isCollectingSimulator}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                    title="Collect all entered data from this form and save directly to your Google Sheet before submitting"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isCollectingSimulator ? 'Scanning...' : '📥 Save Form to Sheet'}</span>
                  </button>

                  {/* AI Field Matcher Button */}
                  <button
                    type="button"
                    onClick={handleRunAIMatcher}
                    disabled={isAIMatching}
                    className="px-3 py-1.5 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-lg text-xs transition-all flex items-center space-x-1.5 shrink-0 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isAIMatching ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Cpu className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{isAIMatching ? 'Analyzing...' : '🤖 AI Match Fields'}</span>
                  </button>

                  {/* Upload CV Quick Button */}
                  {onOpenCVUpload && (
                    <button
                      type="button"
                      onClick={onOpenCVUpload}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
                      title="Upload CV to collect data and populate this form"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline">Upload CV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* AI Semantic Match Alert Banner */}
              {aiMatchMessage && (
                <div className="p-3.5 bg-linear-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold">{aiMatchMessage}</span>
                  </div>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                    Gemini 3.8 Flash Active
                  </span>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* CNIC (The trigger input) */}
                <div className="sm:col-span-2 lg:col-span-3 p-3 rounded-xl bg-slate-50 border border-slate-300">
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center">
                      National ID / CNIC (Trigger Field) *
                      {renderAiBadge('applicant_cnic')}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">
                      Type CNIC (xxxxx-xxxxxxx-x) to auto-fill
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
                  {/* Dynamic in-form AutoFill button when typing NIC */}
                  {(simulatorCnic.trim().length > 0 || normalizeCnic(simulatorCnic).length >= 3) && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between animate-in fade-in">
                      <div className="flex items-center space-x-2 text-xs">
                        <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600 animate-pulse shrink-0" />
                        <span className="font-bold text-emerald-950">
                          {matchedSimulatorCustomer
                            ? `⚡ AutoFill Available: ${matchedSimulatorCustomer.fullName} (${matchedSimulatorCustomer.cnic})`
                            : `⚡ AutoFill Form from Google Sheet (${customers.length} records ready)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const cust = matchedSimulatorCustomer || customers[0];
                          if (cust && formContainerRef.current) {
                            setSimulatorCnic(cust.cnic);
                            autofillFormAndHarvest(formContainerRef.current, cust);
                            harvestCurrentFormNewFields(cust);
                          }
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>⚡ 1-Click AutoFill Form</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Candidate Name */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Candidate Full Name *
                    {renderAiBadge('applicant_name')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Father / Guardian Name *
                    {renderAiBadge('father_name')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Mobile Phone *
                    {renderAiBadge('contact_number')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Email Address
                    {renderAiBadge('applicant_email')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Gender
                    {renderAiBadge('gender')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Date of Birth
                    {renderAiBadge('birth_date')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    District / City
                    {renderAiBadge('city_domicile')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Permanent Address
                    {renderAiBadge('residential_address')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Highest Education / Degree
                    {renderAiBadge('highest_qualification')}
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
                  <label className="block text-slate-700 font-medium mb-1 flex items-center">
                    Current Designation / Profession
                    {renderAiBadge('current_designation')}
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
                    {selectedTemplate === 'cfc' && (
                      <>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1 flex items-center">
                            Tehsil / تحصیل (New Field) *
                            {renderAiBadge('applicant_tehsil')}
                          </label>
                          <input
                            type="text"
                            name="applicant_tehsil"
                            id="applicant_tehsil"
                            placeholder="e.g. Peshawar City / Hayatabad"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1 flex items-center">
                            Domicile District / ڈومیسائل (New Field) *
                            {renderAiBadge('applicant_domicile')}
                          </label>
                          <input
                            type="text"
                            name="applicant_domicile"
                            id="applicant_domicile"
                            placeholder="e.g. Peshawar / Mardan / Swat"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-950 font-bold mb-1 flex items-center">
                            Police Station / متعلقہ تھانہ (New Field) *
                            {renderAiBadge('police_station')}
                          </label>
                          <input
                            type="text"
                            name="police_station"
                            id="police_station"
                            placeholder="e.g. PS Hayatabad / PS Cantt"
                            onChange={() => harvestCurrentFormNewFields()}
                            className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500 text-xs"
                          />
                        </div>
                      </>
                    )}

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

                {/* Form Action Buttons: Collect & Save to Sheet Before Submitting */}
                <div className="sm:col-span-2 lg:col-span-3 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl mt-4">
                  <div className="flex items-center space-x-2.5 text-xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Entering new applicant data into this form?
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Save all entered data directly into your Google Sheet before submitting to this website!
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCollectSimulatorFormToSheet}
                      disabled={isCollectingSimulator}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isCollectingSimulator ? 'Scanning Form...' : '📥 Save Form Data to Google Sheet'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = customers.find(c => normalizeCnic(c.cnic) === normalizeCnic(simulatorCnic)) || customers[0];
                        if (target && formContainerRef.current) {
                          setSimulatorCnic(target.cnic);
                          autofillFormAndHarvest(formContainerRef.current, target);
                          harvestCurrentFormNewFields(target);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Auto-Fill Form</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab: AI Form Field Matcher & Portal Inspector */}
      {activeSubTab === 'ai-scanner' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Cpu className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  AI Form Field Matcher &amp; Portal Inspector
                </h3>
                <span className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Test how Gemini AI detects and semantically maps input fields on Pakistani portals (CFC KP, Police Khidmat Markaz, FPSC, KPPSC, NADRA) and international websites, resolving cryptic names like <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">txtWalidName</code> or <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">ctl00_ddl_domicile</code> into your Google Sheet customer fields.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveSubTab('simulator');
                  setTimeout(() => handleRunAIMatcher(), 200);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Test in Live Simulator</span>
              </button>
            </div>
          </div>

          {/* Preset Pakistani Portal Form Schemas */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Load Official Portal Form Schema to Inspect:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  const sample = `<form id="cfc_citizen_reg" action="https://cfc.kp.gov.pk/Citizen/Register">
  <input name="txt_cnic" id="txt_cnic" placeholder="17301-XXXXXXX-X" label="National Identity Card" />
  <input name="txt_applicant_name" id="txt_applicant_name" placeholder="Full Name" />
  <input name="txt_walid_name" id="txt_walid_name" placeholder="Father Name / Walid ka Naam" />
  <input name="txt_mobile_no" id="txt_mobile_no" placeholder="03XX-XXXXXXX" />
  <input name="txt_email_address" id="txt_email_address" placeholder="Citizen Email" />
  <select name="ddl_domicile_district" id="ddl_domicile_district"><option>Peshawar</option><option>Swat</option></select>
  <input name="txt_tehsil_area" id="txt_tehsil_area" placeholder="Tehsil / Sub-district" />
  <input name="txt_police_thana" id="txt_police_thana" placeholder="Concerned Police Station" />
  <input name="txt_permanent_address" id="txt_permanent_address" placeholder="Postal Address" />
</form>`;
                  setCustomFormHtml(sample);
                  handleInspectCustomFormHtml(sample);
                }}
                className="p-3 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all"
              >
                <span className="font-bold text-slate-900 block">🏛️ CFC KP Citizen Portal</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">cfc.kp.gov.pk (CNIC, Tehsil, Domicile, Thana)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const sample = `<form id="pkm_sahulat" action="https://kppolice.gov.pk/sahulat">
  <input name="citizen_id_card" id="citizen_id_card" placeholder="CNIC Number" />
  <input name="person_full_name" id="person_full_name" placeholder="Citizen Name" />
  <input name="guardian_father" id="guardian_father" placeholder="Father or Guardian" />
  <input name="contact_cell_no" id="contact_cell_no" placeholder="Mobile Phone" />
  <input name="concerned_thana" id="concerned_thana" placeholder="Police Station" />
  <input name="driving_license" id="driving_license" placeholder="Driving License Number" />
  <input name="blood_group_type" id="blood_group_type" placeholder="Blood Group (e.g. B+)" />
  <input name="waris_contact" id="waris_contact" placeholder="Emergency / Waris Phone" />
</form>`;
                  setCustomFormHtml(sample);
                  handleInspectCustomFormHtml(sample);
                }}
                className="p-3 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all"
              >
                <span className="font-bold text-slate-900 block">🚓 Police Khidmat Markaz</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">PKM Sahulat (Thana, License, Blood Group)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const sample = `<form id="kppsc_apply" action="https://kppsc.gov.pk/apply">
  <input name="candidate_cnic" id="candidate_cnic" placeholder="CNIC / B-Form" />
  <input name="candidate_name" id="candidate_name" placeholder="Candidate Full Name" />
  <input name="father_guardian" id="father_guardian" placeholder="Father's Name" />
  <input name="qualification_degree" id="qualification_degree" placeholder="Highest Degree (e.g. BS CS)" />
  <input name="total_experience_years" id="total_experience_years" placeholder="Years of Experience" />
  <input name="district_domicile" id="district_domicile" placeholder="Domicile District" />
  <input name="candidate_email" id="candidate_email" placeholder="Email" />
</form>`;
                  setCustomFormHtml(sample);
                  handleInspectCustomFormHtml(sample);
                }}
                className="p-3 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all"
              >
                <span className="font-bold text-slate-900 block">📋 KPPSC Job Portal</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">kppsc.gov.pk (Degree, Domicile, Exp)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const sample = `<form id="fpsc_online" action="https://fpsc.gov.pk">
  <input name="nic_number" id="nic_number" placeholder="CNIC Number" />
  <input name="applicant_name" id="applicant_name" placeholder="Applicant Name" />
  <input name="father_name" id="father_name" placeholder="Father Name" />
  <input name="academic_qualification" id="academic_qualification" placeholder="Degree / Institution" />
  <input name="current_occupation" id="current_occupation" placeholder="Current Job / Profession" />
  <input name="mailing_address" id="mailing_address" placeholder="Postal Address" />
</form>`;
                  setCustomFormHtml(sample);
                  handleInspectCustomFormHtml(sample);
                }}
                className="p-3 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all"
              >
                <span className="font-bold text-slate-900 block">🏛️ Federal FPSC Portal</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">fpsc.gov.pk (National Civil Service)</span>
              </button>
            </div>
          </div>

          {/* Custom HTML Textarea Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Paste Any Website Form HTML or Inputs to Classify:
              </label>
              <span className="text-[11px] text-slate-400">
                Paste &lt;input&gt; or &lt;form&gt; HTML from any website
              </span>
            </div>
            <textarea
              rows={5}
              value={customFormHtml}
              onChange={(e) => setCustomFormHtml(e.target.value)}
              placeholder="Paste HTML containing input fields from any portal (e.g. <input name='ctl00$txtCnic' id='txtCnic' placeholder='CNIC' />)..."
              className="w-full text-xs font-mono p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleInspectCustomFormHtml()}
                disabled={isInspectingCustom || !customFormHtml.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isInspectingCustom ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5 text-amber-300" />
                    <span>🤖 Analyze &amp; Match Fields with Gemini AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Inspection Results Table */}
          {customInspectorResults.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>AI Field Detection Matrix ({customInspectorResults.length} Fields Analyzed)</span>
                </h4>
                <span className="text-xs text-slate-500">
                  Model: <strong>gemini-3.8-flash</strong>
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-700">
                    <tr>
                      <th className="px-3.5 py-2.5 text-left">Form Input Field</th>
                      <th className="px-3.5 py-2.5 text-left">Matched Customer Key</th>
                      <th className="px-3.5 py-2.5 text-left">Urdu Label</th>
                      <th className="px-3.5 py-2.5 text-left">Confidence</th>
                      <th className="px-3.5 py-2.5 text-left">AI Reasoning</th>
                      <th className="px-3.5 py-2.5 text-left">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {customInspectorResults.map((match, idx) => {
                      const sampleCust = customers[0];
                      let sampleVal = '—';
                      if (sampleCust) {
                        sampleVal = (sampleCust as any)[match.matchedCustomerKey] ||
                          sampleCust.customFields?.[match.matchedCustomerKey] ||
                          sampleCust.customFields?.[match.customFieldLabel || ''] ||
                          '—';
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-2 font-mono text-[11px] text-slate-800 font-semibold">
                            {match.fieldIdOrName}
                          </td>
                          <td className="px-3.5 py-2">
                            <span className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                              {match.matchedCustomerKey}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-slate-700 font-medium">
                            {match.suggestedUrduLabel || '—'}
                          </td>
                          <td className="px-3.5 py-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-emerald-700">
                                {match.confidence}%
                              </span>
                              <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-1.5 rounded-full"
                                  style={{ width: `${match.confidence}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2 text-slate-500 text-[11px] max-w-xs">
                            {match.reasoning}
                          </td>
                          <td className="px-3.5 py-2 font-medium text-slate-800 truncate max-w-[140px]">
                            {sampleVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

          {/* CFC Specific Quick Action & Direct Instructions */}
          <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-600/50 rounded-2xl text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/60 pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl">🏛️</span>
                <div>
                  <h4 className="font-bold text-sm text-emerald-300">
                    How to AutoFill on the live CFC KP Website (cfc.kp.gov.pk):
                  </h4>
                  <p className="text-xs text-slate-300">
                    URL: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono">https://cfc.kp.gov.pk/Citizen/Citizen/Register</code>
                  </p>
                </div>
              </div>
              <a
                href="https://cfc.kp.gov.pk/Citizen/Citizen/Register"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 shadow-sm"
              >
                <span>Open Live cfc.kp.gov.pk</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
              <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                <span className="font-bold text-white block mb-1">Step 1: Save Bookmarklet</span>
                Drag the green <b className="text-emerald-400">"⚡ SyncSheet AutoFiller"</b> button onto your browser's Bookmarks bar (or click "Copy Code" on mobile).
              </div>
              <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                <span className="font-bold text-white block mb-1">Step 2: Click on cfc.kp.gov.pk</span>
                While on the Citizen Registration page, click your bookmark! The floating AutoFill Dock and ⚡ button appear instantly in the bottom corner.
              </div>
              <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                <span className="font-bold text-white block mb-1">Step 3: AutoFill &amp; Map Fields</span>
                Choose your customer or type CNIC: all fields fill automatically! Extra fields (Tehsil, Domicile, Police Station) are detected and can be mapped into your Google Sheet with 1 click.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Full Browser Extension Package (Chrome/Edge/Brave) */}
      {activeSubTab === 'extension' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          {/* Header & Primary Download Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <Code2 className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  SyncSheet Universal Form AutoFiller Extension (v2.2 - Ultra-Light, No-Lag)
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Ultra-lightweight Chrome &amp; Microsoft Edge extension with <strong>Smart CNIC Auto-Detection</strong>. When you enter a CNIC in any website form (including <strong>CFC, NADRA, job portals</strong>), it instantly detects the customer from your Google Sheet and shows a <strong>1-click button to fill all remaining fields</strong>!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {onRefreshSheet && (
                <button
                  onClick={async () => {
                    setIsRefreshingSheet(true);
                    try {
                      await onRefreshSheet();
                      setDownloadSuccess(`Successfully pulled rows from Google Sheet! Database now has ${customers.length} customer records.`);
                    } catch (e: any) {
                      setHubError(e.message || 'Failed to refresh sheet data');
                    } finally {
                      setIsRefreshingSheet(false);
                    }
                  }}
                  disabled={isRefreshingSheet}
                  className="flex items-center justify-center space-x-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors disabled:opacity-50"
                  title="Pull latest rows from your connected Google Sheet"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSheet ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>{isRefreshingSheet ? 'Pulling...' : 'Sync Latest Sheet Rows'}</span>
                </button>
              )}

              <button
                onClick={handleDownloadExtensionZip}
                disabled={isZipping}
                className="flex items-center justify-center space-x-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isZipping ? 'Generating .ZIP...' : `Download Extension ZIP (${customers.length} records)`}
                </span>
              </button>
            </div>
          </div>

          {/* Download Success Alert */}
          {downloadSuccess && (
            <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-md flex items-center space-x-3 text-xs sm:text-sm font-semibold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Diagnostic & Fix Notification Card */}
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2 text-xs text-emerald-950">
            <div className="flex items-center space-x-2 font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>What is fixed in v2.2 (Chrome Hang Fixed + Smart CNIC Detection):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                <div className="font-bold text-slate-900 mb-1">1. Anti-Recursion (No Page Freezing)</div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Fixed the recursive event loop that previously caused Chrome to hang. Now operates as a lightweight, zero-lag background script.
                </p>
              </div>
              <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                <div className="font-bold text-slate-900 mb-1">2. Smart CNIC 1-Click Detection</div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  As requested: when you type or paste any CNIC in any form, it automatically detects the record in your Google Sheet and displays a <strong>⚡ 1-Click Fill</strong> button right by the field!
                </p>
              </div>
              <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                <div className="font-bold text-slate-900 mb-1">3. Light Top-Window Only</div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Disabled execution inside hidden background iframes and removed continuous intervals, keeping CPU usage near 0%.
                </p>
              </div>
            </div>
          </div>

          {/* Live Extension Diagnostics */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Extension Database Status
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Sheet: <span className="text-emerald-400 font-bold">{sheetConfig?.title || 'Default Registry'}</span> • Records: <span className="text-emerald-400 font-bold">{customers.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Available CNICs for Testing:</span>
              <div className="flex flex-wrap gap-1.5">
                {customers.map((c) => (
                  <button
                    key={c.cnic}
                    onClick={() => {
                      navigator.clipboard.writeText(c.cnic);
                      setDownloadSuccess(`Copied CNIC ${c.cnic} to clipboard! Paste it into any web form.`);
                      setTimeout(() => setDownloadSuccess(null), 3000);
                    }}
                    title="Click to copy CNIC"
                    className="font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2 py-0.5 rounded border border-slate-700 flex items-center space-x-1 transition-colors"
                  >
                    <span>{c.cnic}</span>
                    <span className="text-[10px] text-slate-400">({c.fullName.split(' ')[0]})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 text-xs text-slate-700">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>How to Install or Update in Google Chrome / Microsoft Edge (1 Minute):</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                  1
                </div>
                <div className="font-bold text-slate-900 mb-1">Download &amp; Unzip</div>
                <p className="text-[11px] text-slate-600">
                  Click the green button above to download <code>syncsheet-autofiller-v2.zip</code>. Right-click and choose <strong>"Extract All"</strong>.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                  2
                </div>
                <div className="font-bold text-slate-900 mb-1">Open Extensions</div>
                <p className="text-[11px] text-slate-600">
                  Open Chrome or Edge and go to <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono">chrome://extensions</code> in the address bar.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                  3
                </div>
                <div className="font-bold text-slate-900 mb-1">Load Unpacked</div>
                <p className="text-[11px] text-slate-600">
                  Turn ON <strong>"Developer mode"</strong> (top-right). Click <strong>"Load unpacked"</strong> and select your extracted folder.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                  4
                </div>
                <div className="font-bold text-slate-900 mb-1">Fill Any Form!</div>
                <p className="text-[11px] text-slate-600">
                  Visit any job portal or government site. Type any CNIC: it auto-fills all fields and collects new fields!
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
              <strong>💡 Pro Tip:</strong> If you previously loaded the older extension, simply click the <strong>↻ Reload</strong> button on the "SyncSheet Universal Form AutoFiller" card in <code className="font-mono font-bold">chrome://extensions</code> to apply the new files!
            </div>
          </div>

          {/* Individual Files Tray */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-3 font-semibold text-slate-700 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
              <span className="font-mono text-xs">Extension Files Included in .ZIP:</span>
              <div className="flex flex-wrap gap-1 text-[11px]">
                <button
                  onClick={() => handleDownloadSingleFile('manifest.json', extensionFiles.manifest)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono"
                >
                  manifest.json
                </button>
                <button
                  onClick={() => handleDownloadSingleFile('data.js', extensionFiles.dataJs)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono text-emerald-700 font-bold"
                >
                  data.js ({customers.length} records)
                </button>
                <button
                  onClick={() => handleDownloadSingleFile('background.js', extensionFiles.backgroundJs)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono"
                >
                  background.js
                </button>
                <button
                  onClick={() => handleDownloadSingleFile('content.js', extensionFiles.contentJs)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono"
                >
                  content.js
                </button>
                <button
                  onClick={() => handleDownloadSingleFile('popup.html', extensionFiles.popupHtml)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono"
                >
                  popup.html
                </button>
                <button
                  onClick={() => handleDownloadSingleFile('popup.js', extensionFiles.popupJs)}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-50 font-mono"
                >
                  popup.js
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-900 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed max-h-56">
              {extensionFiles.manifest}
            </pre>
          </div>
        </div>
      )}

      {/* SubTab 4: Mobile & Police Sahulat Markaz Mode (Cloud Sync Across All Devices) */}
      {activeSubTab === 'mobile-police' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Gmail Cross-Device Cloud Sync Card */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-emerald-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Cloud className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-bold">
                    Connected Gmail Account • Real-Time Cloud Sync
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Every customer record and dynamic field mapped under a CNIC is automatically synchronized in real time via <strong>Cloud Firestore &amp; Google Sheets</strong>. When you sign in with your Gmail on your mobile phone, laptop, or desktop, all your data is instantly available everywhere!
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="bg-emerald-900/60 border border-emerald-600 px-2.5 py-1 rounded-md text-emerald-200 font-mono font-semibold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gmail: {userEmail || 'rashidshewa9@gmail.com'}</span>
                  </span>
                  <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-slate-300 flex items-center space-x-1">
                    <Laptop className="w-3.5 h-3.5 text-blue-400" />
                    <span>Laptop</span>
                  </span>
                  <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-slate-300 flex items-center space-x-1">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Android / iPhone</span>
                  </span>
                  <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-slate-300 flex items-center space-x-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                    <span>Sheet: {sheetConfig?.title || 'Connected Sheet'}</span>
                  </span>
                </div>
              </div>

              {onRefreshSheet && (
                <button
                  onClick={async () => {
                    setIsRefreshingSheet(true);
                    try {
                      await onRefreshSheet();
                      setDownloadSuccess(`Synced! Database updated with ${customers.length} customer records.`);
                    } catch (e: any) {
                      setHubError(e.message || 'Sync failed');
                    } finally {
                      setIsRefreshingSheet(false);
                    }
                  }}
                  disabled={isRefreshingSheet}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingSheet ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingSheet ? 'Syncing...' : 'Sync Cloud & Sheet Now'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Copy Notification */}
          {copiedKey && (
            <div className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-md flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>Copied "{copiedKey}" to clipboard! Paste it into your mobile application or portal form.</span>
            </div>
          )}

          {/* Customer Selection & Mobile 1-Tap Form Companion */}
          {(() => {
            const filteredMobileCustomers = customers.filter((c) => {
              const q = mobileSearch.toLowerCase().trim();
              if (!q) return true;
              return (
                c.cnic.toLowerCase().includes(q) ||
                normalizeCnic(c.cnic).includes(q) ||
                c.fullName.toLowerCase().includes(q) ||
                (c.city && c.city.toLowerCase().includes(q))
              );
            });

            const currentMobileCustomer =
              filteredMobileCustomers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(selectedMobileCnic)) ||
              customers.find((c) => normalizeCnic(c.cnic) === normalizeCnic(selectedMobileCnic)) ||
              filteredMobileCustomers[0] ||
              customers[0];

            const handleCopyField = (label: string, value: string) => {
              if (!value) return;
              navigator.clipboard.writeText(value);
              setCopiedKey(`${label} (${value})`);
              setTimeout(() => setCopiedKey(null), 3000);
            };

            const getSequentialList = () => {
              if (!currentMobileCustomer) return [];
              const list = [
                { label: 'CNIC', value: currentMobileCustomer.cnic },
                { label: 'CNIC (Clean 13 Digits)', value: normalizeCnic(currentMobileCustomer.cnic) },
                { label: 'Applicant Name', value: currentMobileCustomer.fullName },
                { label: 'Father Name', value: currentMobileCustomer.fatherName || '' },
                { label: 'Mobile Number', value: currentMobileCustomer.phone || '' },
                { label: 'Date of Birth', value: currentMobileCustomer.dob || '' },
                { label: 'Address', value: currentMobileCustomer.address || '' },
                { label: 'City / District', value: currentMobileCustomer.city || '' },
                { label: 'Gender', value: currentMobileCustomer.gender || '' },
              ];
              if (currentMobileCustomer.customFields) {
                Object.entries(currentMobileCustomer.customFields).forEach(([k, v]) => {
                  if (v) list.push({ label: k, value: v });
                });
              }
              return list.filter((item) => Boolean(item.value));
            };

            const handleCopyNextInSequence = () => {
              const list = getSequentialList();
              if (list.length === 0) return;
              const current = list[autoAdvanceIndex % list.length];
              navigator.clipboard.writeText(current.value);
              const next = list[(autoAdvanceIndex + 1) % list.length];
              setCopiedKey(`${current.label} (${current.value}) → Next: ${next.label}`);
              setAutoAdvanceIndex((prev) => (prev + 1) % list.length);
              setTimeout(() => setCopiedKey(null), 3500);
            };

            const handleQuickApplyPolicePreset = async () => {
              if (!currentMobileCustomer) return;
              setIsMappingField(true);
              setHubError(null);
              try {
                const policePreset = {
                  'Police Station (تھانہ)': currentMobileCustomer.customFields?.['Police Station (تھانہ)'] || 'Civil Lines / Markaz',
                  'Mother Name (والدہ کا نام)': currentMobileCustomer.customFields?.['Mother Name (والدہ کا نام)'] || '',
                  'Blood Group': currentMobileCustomer.customFields?.['Blood Group'] || 'B+',
                  'Driving License No': currentMobileCustomer.customFields?.['Driving License No'] || '',
                  'Emergency Contact (وارث رابطہ)': currentMobileCustomer.customFields?.['Emergency Contact (وارث رابطہ)'] || currentMobileCustomer.phone || '',
                  'District (ضلع)': currentMobileCustomer.customFields?.['District (ضلع)'] || currentMobileCustomer.city || 'District',
                  'Tehsil (تحصیل)': currentMobileCustomer.customFields?.['Tehsil (تحصیل)'] || currentMobileCustomer.city || 'Tehsil',
                  'Marital Status': currentMobileCustomer.customFields?.['Marital Status'] || 'Married'
                };
                await onSaveNewFieldsToCustomer(currentMobileCustomer.cnic, policePreset);
                setSaveSuccessMessage(
                  `Police Sahulat Markaz preset mapped for CNIC ${currentMobileCustomer.cnic}! Synced to Cloud Firestore & Google Sheet across all devices.`
                );
                setTimeout(() => setSaveSuccessMessage(null), 5000);
              } catch (e: any) {
                setHubError(e.message || 'Failed to apply preset');
              } finally {
                setIsMappingField(false);
              }
            };

            const handleCopyAllSummary = () => {
              if (!currentMobileCustomer) return;
              const lines = [
                `CNIC: ${currentMobileCustomer.cnic}`,
                `Full Name: ${currentMobileCustomer.fullName}`,
                `Father Name: ${currentMobileCustomer.fatherName || 'N/A'}`,
                `Mobile: ${currentMobileCustomer.phone || 'N/A'}`,
                `Email: ${currentMobileCustomer.email || 'N/A'}`,
                `Gender: ${currentMobileCustomer.gender || 'N/A'}`,
                `DOB: ${currentMobileCustomer.dob || 'N/A'}`,
                `City / District: ${currentMobileCustomer.city || 'N/A'}`,
                `Address: ${currentMobileCustomer.address || 'N/A'}`,
                `Qualification: ${currentMobileCustomer.qualification || 'N/A'}`,
                `Profession: ${currentMobileCustomer.profession || 'N/A'}`,
              ];
              if (currentMobileCustomer.customFields) {
                Object.entries(currentMobileCustomer.customFields).forEach(([k, v]) => {
                  lines.push(`${k}: ${v}`);
                });
              }
              navigator.clipboard.writeText(lines.join('\n'));
              setCopiedKey('All Customer Details Summary');
              setTimeout(() => setCopiedKey(null), 3000);
            };

            const handleSaveNewFieldMapping = async () => {
              if (!currentMobileCustomer || !customFieldKey.trim() || !customFieldValue.trim()) {
                setHubError('Please provide both Field Name and Value to map under this CNIC.');
                return;
              }
              setIsMappingField(true);
              setHubError(null);
              try {
                await onSaveNewFieldsToCustomer(currentMobileCustomer.cnic, {
                  [customFieldKey.trim()]: customFieldValue.trim(),
                });
                setSaveSuccessMessage(
                  `Successfully mapped "${customFieldKey.trim()}" under CNIC ${currentMobileCustomer.cnic}! Saved to Cloud Firestore & Google Sheet.`
                );
                setCustomFieldKey('');
                setCustomFieldValue('');
                setTimeout(() => setSaveSuccessMessage(null), 5000);
              } catch (e: any) {
                setHubError(e.message || 'Failed to map new field');
              } finally {
                setIsMappingField(false);
              }
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Mobile 1-Tap Field Copier for Police Sahulat Markaz & CFC */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                          <Shield className="w-5 h-5 text-blue-600" />
                          <span>Police Sahulat Markaz, CFC &amp; Mobile Quick-Copier</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Select a customer: tap any button to copy that exact field into your clipboard. Switch to your mobile app and paste!
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Search input with Guaranteed BLACK WRITING */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={mobileSearch}
                            onChange={(e) => setMobileSearch(e.target.value)}
                            placeholder="Search (Name, CNIC)..."
                            className="pl-8 pr-2.5 py-1.5 bg-white text-slate-900 placeholder:text-slate-500 font-semibold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 sm:w-48"
                          />
                        </div>
                        <select
                          value={currentMobileCustomer?.cnic || ''}
                          onChange={(e) => setSelectedMobileCnic(e.target.value)}
                          className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 max-w-[200px]"
                        >
                          {filteredMobileCustomers.map((c) => (
                            <option key={c.cnic} value={c.cnic}>
                              {c.cnic} - {c.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {currentMobileCustomer ? (
                      <div className="space-y-4">
                        {/* Selected Customer Header Banner */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {currentMobileCustomer.cnic}
                            </span>
                            <span className="font-bold text-slate-900 text-sm ml-2">
                              {currentMobileCustomer.fullName}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({currentMobileCustomer.city || 'Pakistan'})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={handleCopyNextInSequence}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
                              title="1-Tap copies next field in sequence so you can quickly paste into mobile apps!"
                            >
                              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                              <span>⚡ Auto-Advance Copy ({getSequentialList()[autoAdvanceIndex % (getSequentialList().length || 1)]?.label || 'Next'})</span>
                            </button>

                            <button
                              onClick={handleQuickApplyPolicePreset}
                              disabled={isMappingField}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
                              title="Maps Police Station, Mother Name, Blood Group, License No under this CNIC in 1 click"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>+ Map Police Sahulat Preset</span>
                            </button>

                            <button
                              onClick={handleCopyAllSummary}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Summary</span>
                            </button>
                          </div>
                        </div>

                        {/* 1-Tap Copy Buttons Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* CNIC Formatted */}
                          <div
                            onClick={() => handleCopyField('CNIC with Dashes', currentMobileCustomer.cnic)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">CNIC (With Dashes)</div>
                              <div className="font-mono font-bold text-slate-900 mt-0.5">{currentMobileCustomer.cnic}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* CNIC Raw */}
                          <div
                            onClick={() => handleCopyField('CNIC Digits Only', normalizeCnic(currentMobileCustomer.cnic))}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">CNIC (Clean 13 Digits)</div>
                              <div className="font-mono font-bold text-slate-900 mt-0.5">{normalizeCnic(currentMobileCustomer.cnic)}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Full Name */}
                          <div
                            onClick={() => handleCopyField('Full Name', currentMobileCustomer.fullName)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Applicant Full Name</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.fullName}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Father Name */}
                          <div
                            onClick={() => handleCopyField('Father Name', currentMobileCustomer.fatherName)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Father's / Guardian Name</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.fatherName || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Mobile */}
                          <div
                            onClick={() => handleCopyField('Mobile Number', currentMobileCustomer.phone)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Mobile / Cell Number</div>
                              <div className="font-mono font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.phone || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Date of Birth */}
                          <div
                            onClick={() => handleCopyField('Date of Birth', currentMobileCustomer.dob)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Date of Birth (DOB)</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.dob || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Present Address */}
                          <div
                            onClick={() => handleCopyField('Address', currentMobileCustomer.address)}
                            className="sm:col-span-2 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Address (Thana / District / Mohalla)</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.address || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors shrink-0 ml-2">
                              Copy
                            </span>
                          </div>

                          {/* City & District */}
                          <div
                            onClick={() => handleCopyField('City / District', currentMobileCustomer.city)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">City / District / Domicile</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.city || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>

                          {/* Gender */}
                          <div
                            onClick={() => handleCopyField('Gender', currentMobileCustomer.gender)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Gender</div>
                              <div className="font-semibold text-slate-900 mt-0.5">{currentMobileCustomer.gender || 'Not Set'}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white rounded text-[11px] font-semibold text-slate-700 transition-colors">
                              Copy
                            </span>
                          </div>
                        </div>

                        {/* Custom Fields Mapped under CNIC */}
                        {currentMobileCustomer.customFields && Object.keys(currentMobileCustomer.customFields).length > 0 && (
                          <div className="pt-3 border-t border-slate-200">
                            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>Custom Fields Mapped Under CNIC {currentMobileCustomer.cnic}:</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {Object.entries(currentMobileCustomer.customFields).map(([k, v]) => (
                                <div
                                  key={k}
                                  onClick={() => handleCopyField(k, v)}
                                  className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 hover:bg-amber-100/60 cursor-pointer transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <span className="text-[10px] font-bold text-amber-900 uppercase block">{k}</span>
                                    <span className="font-semibold text-slate-900">{v}</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 bg-white rounded border border-amber-300 text-[10px] font-bold text-amber-900">
                                    Copy
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No customers registered yet. Add a customer in Entry Form first!</p>
                    )}
                  </div>

                  {/* Interactive Map Any New Field Under CNIC Card */}
                  {currentMobileCustomer && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                      <div className="flex items-center space-x-2">
                        <PlusCircle className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-900">
                          Map Any New Field Under CNIC {currentMobileCustomer.cnic}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Collect any extra data (e.g. Police Station / Thana, Challan Number, FIR Number, Token ID, Emergency Contact) and save it directly under this CNIC. It immediately syncs to Cloud Firestore and Google Sheet across all your devices!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Field Name / Label</label>
                          <input
                            type="text"
                            placeholder="e.g. Police Station (Thana), Challan No"
                            value={customFieldKey}
                            onChange={(e) => setCustomFieldKey(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Field Value</label>
                          <input
                            type="text"
                            placeholder="e.g. Civil Lines Lahore, CH-987654"
                            value={customFieldValue}
                            onChange={(e) => setCustomFieldValue(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveNewFieldMapping}
                        disabled={isMappingField || !customFieldKey.trim() || !customFieldValue.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{isMappingField ? 'Mapping & Syncing...' : 'Map & Save Under This CNIC'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right 1 Col: Official Portals Direct Launchers & Mobile Bookmarklet */}
                <div className="space-y-6">
                  {/* Police Sahulat Markaz & Official Portals */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>Official Online Portals</span>
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Launch any portal on your phone or laptop. Use 1-Tap Copy on the left or the 1-Tap Mobile Bookmarklet to autofill!
                    </p>

                    <div className="space-y-2 pt-1 text-xs">
                      <a
                        href="https://khidmatek.punjab.gov.pk"
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between group block"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700">Punjab Police Khidmat / Sahulat Markaz</div>
                          <div className="text-[11px] text-slate-500">Character Certificate, Tenant Registration, Verification</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
                      </a>

                      <a
                        href="https://islamabadpolice.gov.pk"
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between group block"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700">Islamabad Police Facilitation Center</div>
                          <div className="text-[11px] text-slate-500">Police Character &amp; Verification Services</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
                      </a>

                      <a
                        href="https://cfc.punjab.gov.pk"
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between group block"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700">Citizen Facilitation Centers (CFC)</div>
                          <div className="text-[11px] text-slate-500">e-Khidmat Domicile, Arms, Municipal forms</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
                      </a>

                      <a
                        href="https://id.nadra.gov.pk"
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between group block"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700">NADRA Pak-Identity Portal</div>
                          <div className="text-[11px] text-slate-500">CNIC, CRC / Form-B, FRC, NICOP</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-2" />
                      </a>
                    </div>
                  </div>

                  {/* Mobile Bookmarklet Quick Setup */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-700">
                    <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>How to 1-Tap Autofill on Mobile Chrome / Safari:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                      <li>
                        Switch to <strong>"2. Universal Bookmarklet"</strong> above and click <strong>Copy Code</strong>.
                      </li>
                      <li>
                        In Mobile Chrome or Safari, bookmark any page and edit its URL: paste the copied code as the bookmark URL.
                      </li>
                      <li>
                        When filling Police Sahulat Markaz or CFC on mobile, type the bookmark name in the address bar to tap it: the floating SyncSheet filler opens right on your phone!
                      </li>
                    </ol>
                  </div>

                  {/* Android Kiwi Browser Extension */}
                  <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-5 space-y-3 text-xs text-indigo-950">
                    <div className="font-bold text-indigo-900 uppercase tracking-wide text-[11px] flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      <span>Full Extension on Android Phones (Kiwi Browser):</span>
                    </div>
                    <p className="text-[11px] text-indigo-900 leading-relaxed">
                      Want automatic in-page autofill directly on your Android phone without copy-pasting?
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700">
                      <li>Install <strong>Kiwi Browser</strong> or <strong>Lemur Browser</strong> from Google Play Store.</li>
                      <li>Download <code>syncsheet-autofiller-v2.zip</code> from the "Extension" tab above.</li>
                      <li>Open <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">chrome://extensions</code> in Kiwi, turn ON <strong>Developer mode</strong>, and load the zip.</li>
                      <li>It will auto-fill Police Sahulat Markaz and CFC forms right inside your Android mobile browser!</li>
                    </ol>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
