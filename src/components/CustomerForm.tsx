import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { normalizeCnic, formatCnic } from '../services/sheetsService';
import {
  Search,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  Save,
  RotateCcw,
  Sparkles,
  FileText,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface CustomerFormProps {
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  onPreviewAndSubmit: (customer: Customer, isUpdate: boolean) => void;
  onQuickCV: (customer: Customer) => void;
  onOpenCVUpload?: () => void;
  isOnline: boolean;
  hasGoogleSheet: boolean;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  initialCustomer,
  allCustomers,
  onPreviewAndSubmit,
  onQuickCV,
  onOpenCVUpload,
  isOnline,
  hasGoogleSheet,
}) => {
  const [cnic, setCnic] = useState(initialCustomer?.cnic || '');
  const [fullName, setFullName] = useState(initialCustomer?.fullName || '');
  const [fatherName, setFatherName] = useState(initialCustomer?.fatherName || '');
  const [phone, setPhone] = useState(initialCustomer?.phone || '');
  const [email, setEmail] = useState(initialCustomer?.email || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>(
    initialCustomer?.gender || ''
  );
  const [dob, setDob] = useState(initialCustomer?.dob || '');
  const [address, setAddress] = useState(initialCustomer?.address || '');
  const [city, setCity] = useState(initialCustomer?.city || '');
  const [qualification, setQualification] = useState(initialCustomer?.qualification || '');
  const [profession, setProfession] = useState(initialCustomer?.profession || '');
  const [experienceYears, setExperienceYears] = useState(
    initialCustomer?.experienceYears || ''
  );
  const [skills, setSkills] = useState(initialCustomer?.skills || '');
  const [bio, setBio] = useState(initialCustomer?.bio || '');

  // Dynamic Custom Fields: array of { key, value }
  const [customFieldEntries, setCustomFieldEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Status of CNIC lookup
  const [lookupMatch, setLookupMatch] = useState<Customer | null>(null);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [highlightPopulated, setHighlightPopulated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load initialCustomer if passed from parent
  useEffect(() => {
    if (initialCustomer) {
      populateFromCustomer(initialCustomer, false);
    }
  }, [initialCustomer]);

  const populateFromCustomer = (cust: Customer, triggerHighlight = true) => {
    setCnic(formatCnic(cust.cnic));
    setFullName(cust.fullName || '');
    setFatherName(cust.fatherName || '');
    setPhone(cust.phone || '');
    setEmail(cust.email || '');
    setGender(cust.gender || '');
    setDob(cust.dob || '');
    setAddress(cust.address || '');
    setCity(cust.city || '');
    setQualification(cust.qualification || '');
    setProfession(cust.profession || '');
    setExperienceYears(cust.experienceYears || '');
    setSkills(cust.skills || '');
    setBio(cust.bio || '');

    // Custom fields
    if (cust.customFields) {
      const entries = Object.entries(cust.customFields).map(([k, v]) => ({
        key: k,
        value: v,
      }));
      setCustomFieldEntries(entries);
    } else {
      setCustomFieldEntries([]);
    }

    setLookupMatch(cust);
    setHasAutoPopulated(true);

    if (triggerHighlight) {
      setHighlightPopulated(true);
      setTimeout(() => setHighlightPopulated(false), 2500);
    }
  };

  // CNIC Change Handler with automated search & auto-fill
  const handleCnicChange = (val: string) => {
    const formatted = formatCnic(val);
    setCnic(formatted);
    setFormError(null);

    const norm = normalizeCnic(formatted);
    if (norm.length >= 5) {
      // Look for match in existing database
      const match = allCustomers.find((c) => normalizeCnic(c.cnic) === norm);
      if (match) {
        // Automatically populate fields from the sheet/cache!
        populateFromCustomer(match, true);
        return;
      }
    }

    // If no match found or cleared
    if (lookupMatch && normalizeCnic(lookupMatch.cnic) !== norm) {
      setLookupMatch(null);
      setHasAutoPopulated(false);
    }
  };

  // Add custom dynamic field
  const handleAddCustomField = () => {
    const trimmedKey = newFieldKey.trim();
    if (!trimmedKey) return;

    // Check duplicate key
    if (customFieldEntries.some((e) => e.key.toLowerCase() === trimmedKey.toLowerCase())) {
      setFormError(`Field "${trimmedKey}" already exists.`);
      return;
    }

    setCustomFieldEntries([...customFieldEntries, { key: trimmedKey, value: newFieldValue.trim() }]);
    setNewFieldKey('');
    setNewFieldValue('');
    setShowAddCustom(false);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFieldEntries(customFieldEntries.filter((_, idx) => idx !== index));
  };

  const handleApplyPresetTemplate = (templateName: 'police' | 'cfc' | 'vehicle') => {
    let fieldsToAdd: string[] = [];
    if (templateName === 'police') {
      fieldsToAdd = [
        'Police Station (تھانہ)',
        'Mother Name (والدہ کا نام)',
        'Blood Group',
        'Driving License No',
        'Emergency Contact (وارث رابطہ)',
        'District (ضلع)',
        'Tehsil (تحصیل)',
        'Marital Status'
      ];
    } else if (templateName === 'cfc') {
      fieldsToAdd = [
        'Domicile District',
        'Religion',
        'Postal Code',
        'Mother CNIC',
        'Nationality'
      ];
    } else if (templateName === 'vehicle') {
      fieldsToAdd = [
        'Vehicle Reg No',
        'Engine No',
        'Chassis No',
        'Driving License No',
        'Token Tax Status'
      ];
    }

    const existingKeys = new Set(customFieldEntries.map((e) => e.key.toLowerCase()));
    const newEntries = [...customFieldEntries];

    fieldsToAdd.forEach((k) => {
      if (!existingKeys.has(k.toLowerCase())) {
        newEntries.push({ key: k, value: '' });
      }
    });

    setCustomFieldEntries(newEntries);
  };

  const handleCustomFieldValueChange = (index: number, val: string) => {
    const updated = [...customFieldEntries];
    updated[index].value = val;
    setCustomFieldEntries(updated);
  };

  const handleReset = () => {
    setCnic('');
    setFullName('');
    setFatherName('');
    setPhone('');
    setEmail('');
    setGender('');
    setDob('');
    setAddress('');
    setCity('');
    setQualification('');
    setProfession('');
    setExperienceYears('');
    setSkills('');
    setBio('');
    setCustomFieldEntries([]);
    setLookupMatch(null);
    setHasAutoPopulated(false);
    setFormError(null);
  };

  const buildCustomerObject = (): Customer => {
    const customFields: Record<string, string> = {};
    customFieldEntries.forEach(({ key, value }) => {
      if (key.trim()) {
        customFields[key.trim()] = value.trim();
      }
    });

    const norm = normalizeCnic(cnic);
    const existing = lookupMatch || allCustomers.find((c) => normalizeCnic(c.cnic) === norm);

    return {
      id: norm,
      cnic: formatCnic(cnic),
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gender,
      dob,
      address: address.trim(),
      city: city.trim(),
      qualification: qualification.trim(),
      profession: profession.trim(),
      experienceYears: experienceYears.trim(),
      skills: skills.trim(),
      bio: bio.trim(),
      customFields,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedToSheet: false,
      sheetRowIndex: existing?.sheetRowIndex,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnic.trim()) {
      setFormError('Please enter a valid CNIC / National ID');
      return;
    }
    if (!fullName.trim()) {
      setFormError('Please enter the customer full name');
      return;
    }

    setFormError(null);
    const customerObj = buildCustomerObject();
    const isUpdate = Boolean(lookupMatch);
    onPreviewAndSubmit(customerObj, isUpdate);
  };

  const handleTriggerQuickCV = () => {
    if (!fullName.trim() || !cnic.trim()) {
      setFormError('Please enter at least CNIC and Full Name to generate a CV preview.');
      return;
    }
    setFormError(null);
    const customerObj = buildCustomerObject();
    onQuickCV(customerObj);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Form Top Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Customer Registry & Auto-Fill Form
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live Google Sheets Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Type CNIC to automatically retrieve and populate existing data. New fields will be appended to Google Sheets without duplicates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenCVUpload && (
            <button
              type="button"
              onClick={onOpenCVUpload}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>📄 Upload CV (AI Collect)</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleTriggerQuickCV}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Preview CV</span>
          </button>
        </div>
      </div>

      {/* Auto-populate Banner */}
      {formError && (
        <div className="bg-rose-50 border-b border-rose-200 p-3 sm:px-6 flex items-center space-x-3 text-rose-900 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {lookupMatch ? (
        <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-start sm:items-center space-x-3 text-emerald-900 transition-all">
          <div className="p-1 rounded-full bg-emerald-200 text-emerald-800 shrink-0 mt-0.5 sm:mt-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs sm:text-sm">
            <span className="font-bold">Existing Customer Record Found ({lookupMatch.cnic})!</span>
            <span className="text-emerald-700 ml-1">
              Form automatically filled from sheet records. Updating will modify the existing row
              {lookupMatch.sheetRowIndex ? ` (Row #${lookupMatch.sheetRowIndex})` : ''} and append any new fields.
            </span>
          </div>
          <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Deduplication Active</span>
          </span>
        </div>
      ) : cnic && normalizeCnic(cnic).length >= 5 ? (
        <div className="bg-blue-50 border-b border-blue-200 p-3 sm:px-6 flex items-center space-x-3 text-blue-900 text-xs">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            New CNIC ({formatCnic(cnic)}). Submitting will create and append a new customer row in Google Sheet.
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
        {/* CNIC Primary Key Input Bar */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>National ID (CNIC) - Primary Lookup Key</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Auto-lookup matches standard 13 digits (e.g. 35201-1234567-1)
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={cnic}
              onChange={(e) => handleCnicChange(e.target.value)}
              placeholder="Enter CNIC / ID (e.g. 35201-1234567-1)"
              className="w-full pl-10 pr-24 py-2.5 bg-white border border-slate-300 rounded-lg text-sm sm:text-base font-semibold tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs transition-all"
            />
            {lookupMatch && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded">
                  Matched
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Personal Profile */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
            <span>1. Personal & Contact Information</span>
          </h3>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-500 ${highlightPopulated ? 'ring-2 ring-emerald-400/50 p-3 rounded-xl bg-emerald-50/30' : ''}`}>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Muhammad Ahmad Khan"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Father Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Father / Guardian Name
              </label>
              <input
                type="text"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Tariq Mehmood"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mobile / Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                City / District
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lahore / Islamabad / Karachi"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Permanent / Residential Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Street / Area"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Career, Education & CV Details */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
            <span>2. Professional Credentials & CV Data</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Qualification */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Education / Qualification
              </label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="BS Computer Science / MBA"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Profession / Role */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Profession / Designation
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Software Engineer / Operations Lead"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Experience Years */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Years of Experience
              </label>
              <input
                type="text"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Skills */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Key Skills (Comma separated for CV tags)
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, Project Management, Data Analysis, Client Communication"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Bio / Summary */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Professional Summary / Bio
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief summary of experience, strengths, and professional accomplishments for the CV and sheet records."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Dynamic Custom Fields (Appended Columns) */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <span>3. Dynamic Custom Fields</span>
                <span className="text-[10px] lowercase font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Automatically appends as new columns to Google Sheet under this CNIC
                </span>
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate('police')}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors border border-blue-200"
                title="Add Police Sahulat Markaz fields: Police Station (Thana), Mother Name, Blood Group, License No, Emergency Contact, etc."
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Police Sahulat Markaz Preset</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate('cfc')}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md transition-colors border border-amber-200"
                title="Add CFC Citizen Facilitation fields: Domicile, Religion, Postal Code, etc."
              >
                <span>+ CFC Preset</span>
              </button>
              {!showAddCustom && (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Field</span>
                </button>
              )}
            </div>
          </div>

          {/* Add custom field popover */}
          {showAddCustom && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                placeholder="Field Label (e.g. Emergency Contact, Blood Group, Passport #)"
                className="w-full sm:w-1/2 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
              />
              <input
                type="text"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                placeholder="Field Value"
                className="w-full sm:w-1/2 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
              />
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Existing dynamic fields list */}
          {customFieldEntries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customFieldEntries.map((field, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 truncate">{field.key}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(index)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                      title="Remove field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                    placeholder={`Enter ${field.key}`}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No extra dynamic fields yet. Click "Add Custom Field" to attach any custom attribute (e.g. Blood Group, Emergency Contact, License #).
            </p>
          )}
        </div>

        {/* Footer Actions & Dashboard Preview Trigger */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {lookupMatch ? (
              <span className="text-emerald-700 font-medium">
                ✓ Updating existing row for CNIC {lookupMatch.cnic}. No duplicate row will be added.
              </span>
            ) : (
              <span>
                Ready to record. Press <strong>"Preview & Finalize"</strong> to review data before sync.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="submit"
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition-all"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Preview & Finalize</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
