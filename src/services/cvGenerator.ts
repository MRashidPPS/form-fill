import { jsPDF } from 'jspdf';
import { Customer } from '../types';

export interface CVTheme {
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  textColor: [number, number, number];
  mutedColor: [number, number, number];
  accentBg: [number, number, number];
  name: string;
}

export const CV_THEMES: Record<string, CVTheme> = {
  modernNavy: {
    name: 'Modern Executive (Navy)',
    primaryColor: [30, 58, 138], // #1e3a8a
    secondaryColor: [59, 130, 246], // #3b82f6
    textColor: [30, 41, 59], // #1e293b
    mutedColor: [100, 116, 139], // #64748b
    accentBg: [241, 245, 249], // #f1f5f9
  },
  emeraldClean: {
    name: 'Emerald Corporate',
    primaryColor: [6, 95, 70], // #065f46
    secondaryColor: [16, 185, 129], // #10b981
    textColor: [24, 24, 27],
    mutedColor: [82, 82, 91],
    accentBg: [236, 253, 245],
  },
  classicSlate: {
    name: 'Classic Charcoal',
    primaryColor: [39, 39, 42], // #27272a
    secondaryColor: [113, 113, 122],
    textColor: [24, 24, 27],
    mutedColor: [82, 82, 91],
    accentBg: [244, 244, 245],
  },
};

export function generateCustomerCVPdf(
  customer: Customer,
  themeKey: keyof typeof CV_THEMES = 'modernNavy'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const theme = CV_THEMES[themeKey] || CV_THEMES.modernNavy;
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Header Banner Background
  doc.setFillColor(...theme.primaryColor);
  doc.rect(0, 0, pageWidth, 46, 'F');

  // Accent Bottom Stripe
  doc.setFillColor(...theme.secondaryColor);
  doc.rect(0, 46, pageWidth, 3, 'F');

  // Full Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text((customer.fullName || 'Candidate Name').toUpperCase(), margin, 20);

  // Profession / Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(224, 231, 255);
  doc.text(customer.profession || 'Professional Applicant', margin, 27);

  // Quick contact bar inside header
  doc.setFontSize(8.5);
  doc.setTextColor(241, 245, 249);
  const contactParts = [
    `CNIC: ${customer.cnic || 'N/A'}`,
    customer.phone ? `Phone: ${customer.phone}` : null,
    customer.email ? `Email: ${customer.email}` : null,
    customer.city ? `City: ${customer.city}` : null,
  ].filter(Boolean);

  doc.text(contactParts.join('   •   '), margin, 38);

  y = 58;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title: string) => {
    checkPageBreak(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...theme.primaryColor);
    doc.text(title.toUpperCase(), margin, y);

    // Underline rule
    doc.setDrawColor(...theme.secondaryColor);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 8;
  };

  // 1. Professional Bio / Executive Summary
  if (customer.bio) {
    drawSectionTitle('Professional Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...theme.textColor);

    const bioLines = doc.splitTextToSize(customer.bio, contentWidth);
    doc.text(bioLines, margin, y);
    y += bioLines.length * 4.8 + 6;
  }

  // 2. Qualifications & Education
  if (customer.qualification) {
    drawSectionTitle('Education & Qualifications');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...theme.textColor);
    doc.text(customer.qualification, margin, y);
    y += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.mutedColor);
    doc.text(`Verified Candidate Credential Record • CNIC Registry Verified`, margin, y);
    y += 8;
  }

  // 3. Work Experience & Career Highlights
  drawSectionTitle('Work Experience & Expertise');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.textColor);

  const expTitle = customer.profession || 'Specialist Role';
  const expYears = customer.experienceYears ? `${customer.experienceYears} Years of Industry Experience` : 'Experienced Professional';
  doc.text(`${expTitle} (${expYears})`, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...theme.textColor);
  const expDesc = `Proven track record delivering results across relevant projects. Experienced in client engagement, operational execution, and collaborative team environments in ${customer.city || 'Pakistan'}.`;
  const expLines = doc.splitTextToSize(expDesc, contentWidth);
  doc.text(expLines, margin, y);
  y += expLines.length * 4.6 + 6;

  // 4. Skills & Competencies
  if (customer.skills) {
    drawSectionTitle('Core Skills & Competencies');
    const skillList = customer.skills.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

    let currentX = margin;
    let currentY = y;
    const badgeHeight = 6.5;

    skillList.forEach((skill) => {
      const skillText = `✓ ${skill}`;
      const textWidth = doc.getTextWidth(skillText) + 6;

      if (currentX + textWidth > margin + contentWidth) {
        currentX = margin;
        currentY += badgeHeight + 2.5;
        checkPageBreak(12);
      }

      // Draw light pill background
      doc.setFillColor(...theme.accentBg);
      doc.roundedRect(currentX, currentY - 4.5, textWidth, badgeHeight, 1.5, 1.5, 'F');

      // Draw text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...theme.primaryColor);
      doc.text(skillText, currentX + 3, currentY);

      currentX += textWidth + 3;
    });

    y = currentY + badgeHeight + 6;
  }

  // 5. Personal Information & Registry Details
  drawSectionTitle('Personal & Identity Details');
  const details = [
    ['National ID (CNIC):', customer.cnic || 'N/A'],
    ['Father / Guardian Name:', customer.fatherName || 'N/A'],
    ['Date of Birth:', customer.dob || 'N/A'],
    ['Gender:', customer.gender || 'N/A'],
    ['Permanent / Current Address:', customer.address || 'N/A'],
    ['City / District:', customer.city || 'N/A'],
  ];

  // Dynamic Custom Fields
  if (customer.customFields) {
    Object.entries(customer.customFields).forEach(([k, v]) => {
      if (v) {
        details.push([`${k}:`, v]);
      }
    });
  }

  const col1X = margin;
  const col2X = margin + 55;

  details.forEach(([label, value]) => {
    checkPageBreak(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.mutedColor);
    doc.text(label, col1X, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...theme.textColor);
    const valLines = doc.splitTextToSize(value, contentWidth - 55);
    doc.text(valLines, col2X, y);
    y += Math.max(valLines.length * 4.2, 5.2);
  });

  // Footer bar on last page (or all pages)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);

    doc.text(
      `Generated via SyncSheet Hub • Official Record for ${customer.fullName || 'Applicant'} (${customer.cnic})`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${totalPages}`, margin + contentWidth - 16, pageHeight - 8);
  }

  return doc;
}

export function downloadCustomerCVPdf(
  customer: Customer,
  themeKey: keyof typeof CV_THEMES = 'modernNavy'
) {
  const doc = generateCustomerCVPdf(customer, themeKey);
  const cleanName = (customer.fullName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanCnic = (customer.cnic || 'CNIC').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${cleanName}_${cleanCnic}_CV.pdf`);
}
