import React, { useState } from 'react';
import { Customer } from '../types';
import { downloadCustomerCVPdf, CV_THEMES } from '../services/cvGenerator';
import {
  Download,
  Printer,
  X,
  Palette,
  CheckCircle,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface CVPreviewModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
}

export const CVPreviewModal: React.FC<CVPreviewModalProps> = ({
  isOpen,
  customer,
  onClose,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof CV_THEMES>('modernNavy');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen || !customer) return null;

  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      downloadCustomerCVPdf(customer, selectedTheme);
    } catch (err) {
      console.error('Error generating PDF CV:', err);
      setDownloadError('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const skillsList = (customer.skills || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const customFieldsList = Object.entries(customer.customFields || {}).filter(([_, v]) => Boolean(v));

  // Determine header and accent styles based on selected theme
  const getThemeStyles = () => {
    switch (selectedTheme) {
      case 'emeraldClean':
        return {
          headerBg: 'bg-emerald-800',
          accentBorder: 'border-emerald-500',
          headingText: 'text-emerald-800',
          tagBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          barColor: 'bg-emerald-600',
        };
      case 'classicSlate':
        return {
          headerBg: 'bg-zinc-800',
          accentBorder: 'border-zinc-500',
          headingText: 'text-zinc-800',
          tagBg: 'bg-zinc-100 text-zinc-800 border-zinc-300',
          barColor: 'bg-zinc-700',
        };
      case 'modernNavy':
      default:
        return {
          headerBg: 'bg-slate-900',
          accentBorder: 'border-blue-500',
          headingText: 'text-blue-900',
          tagBg: 'bg-blue-50 text-blue-900 border-blue-200',
          barColor: 'bg-blue-600',
        };
    }
  };

  const themeStyle = getThemeStyles();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Control Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Curriculum Vitae (CV) Live Preview
              </h3>
              <p className="text-xs text-slate-500">
                A4 PDF Ready • Verified CNIC Record: {customer.cnic}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <Palette className="w-3.5 h-3.5 text-slate-500 ml-1" />
              {(Object.keys(CV_THEMES) as Array<keyof typeof CV_THEMES>).map((tKey) => (
                <button
                  key={tKey}
                  onClick={() => setSelectedTheme(tKey)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    selectedTheme === tKey
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tKey === 'modernNavy' ? 'Navy' : tKey === 'emeraldClean' ? 'Emerald' : 'Charcoal'}
                </button>
              ))}
            </div>

            {/* Download PDF button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Area: Printable A4 Document Sheet */}
        <div className="p-4 sm:p-8 overflow-y-auto flex justify-center bg-slate-200/80">
          <div className="bg-white max-w-[760px] w-full min-h-[1050px] shadow-xl border border-slate-300 rounded-md overflow-hidden flex flex-col justify-between print:m-0 print:border-none print:shadow-none">
            {/* A4 Sheet Header */}
            <div>
              <div className={`${themeStyle.headerBg} text-white p-6 sm:p-8 relative`}>
                <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${themeStyle.barColor}`} />
                <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-wide">
                  {customer.fullName || 'Candidate Name'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 mt-1 font-medium tracking-wide">
                  {customer.profession || 'Professional Specialist'}
                </p>

                {/* Sub-bar for contact & identity */}
                <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap gap-y-2 gap-x-4 text-[11px] text-slate-200">
                  <span className="font-mono bg-white/10 px-2 py-0.5 rounded font-bold">
                    CNIC: {customer.cnic}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{customer.phone}</span>
                    </span>
                  )}
                  {customer.email && (
                    <span className="flex items-center space-x-1">
                      <Mail className="w-3 h-3 text-emerald-400" />
                      <span>{customer.email}</span>
                    </span>
                  )}
                  {customer.city && (
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <span>{customer.city}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Sheet Body Content */}
              <div className="p-6 sm:p-8 space-y-6 text-slate-800 text-xs sm:text-sm leading-relaxed">
                {/* 1. Professional Summary */}
                {customer.bio && (
                  <div>
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider ${themeStyle.headingText} border-b-2 ${themeStyle.accentBorder} pb-1 mb-2`}
                    >
                      Professional Summary
                    </h2>
                    <p className="text-slate-700 leading-relaxed text-justify">
                      {customer.bio}
                    </p>
                  </div>
                )}

                {/* 2. Education & Qualifications */}
                {customer.qualification && (
                  <div>
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider ${themeStyle.headingText} border-b-2 ${themeStyle.accentBorder} pb-1 mb-2`}
                    >
                      Education & Academic Background
                    </h2>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="font-bold text-slate-900 text-sm">
                        {customer.qualification}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Verified credential recorded in primary customer registry
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Work Experience */}
                <div>
                  <h2
                    className={`text-xs font-bold uppercase tracking-wider ${themeStyle.headingText} border-b-2 ${themeStyle.accentBorder} pb-1 mb-2`}
                  >
                    Professional Experience
                  </h2>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {customer.profession || 'Specialist Role'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {customer.experienceYears ? `${customer.experienceYears} Years Experience` : 'Experienced'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Accomplished responsibilities and execution of professional deliverables in {customer.city || 'relevant districts'}. Demonstrated expertise in project management, operational communication, and record management.
                    </p>
                  </div>
                </div>

                {/* 4. Skills & Competencies */}
                {skillsList.length > 0 && (
                  <div>
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider ${themeStyle.headingText} border-b-2 ${themeStyle.accentBorder} pb-1 mb-2`}
                    >
                      Key Competencies & Technical Skills
                    </h2>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${themeStyle.tagBg}`}
                        >
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Personal Details & Dynamic Custom Attributes */}
                <div>
                  <h2
                    className={`text-xs font-bold uppercase tracking-wider ${themeStyle.headingText} border-b-2 ${themeStyle.accentBorder} pb-1 mb-2`}
                  >
                    Identity & Additional Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium">National Identity (CNIC): </span>
                      <span className="font-bold text-slate-800">{customer.cnic}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Father / Guardian: </span>
                      <span className="font-semibold text-slate-800">{customer.fatherName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Date of Birth: </span>
                      <span className="font-medium text-slate-800">{customer.dob || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Gender: </span>
                      <span className="font-medium text-slate-800">{customer.gender || 'N/A'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 font-medium">Residential Address: </span>
                      <span className="font-medium text-slate-800">
                        {customer.address ? `${customer.address}, ` : ''}{customer.city || 'N/A'}
                      </span>
                    </div>

                    {/* Dynamic custom fields in CV */}
                    {customFieldsList.map(([key, val]) => (
                      <div key={key}>
                        <span className="text-slate-400 font-medium">{key}: </span>
                        <span className="font-semibold text-slate-800">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* A4 Sheet Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 bg-slate-50/50">
              <span>SyncSheet Verified Record • Official Curriculum Vitae</span>
              <span>Primary Key: {customer.cnic}</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 hidden sm:inline">
            Exported documents strictly conform to standard A4 printing and automated verification rules.
          </span>
          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
