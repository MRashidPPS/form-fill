import { Customer, DetectedField } from '../types';
import { normalizeCnic, formatCnic } from './sheetsService';

// Priority-ordered standard mapping aliases for Pakistani (CFC, NADRA, Gov) & International web forms
// NOTE: Specific patterns (like fatherName, husband, guardian) MUST be defined and checked BEFORE generic fullName!
export const FIELD_PATTERNS: Record<string, string[]> = {
  // 1. CNIC / National ID (CFC, NADRA, Citizen Facilitation Centers)
  cnic: [
    'cnic', 'nic', 'c_nic', 'cnic_no', 'cnic_number', 'national_id', 'id_card', 'identity_no',
    'identity_card', 'id_number', 'citizen_id', 'nadra_id', 'idcard', 'nationalid', 'b_form',
    'bform', 'shanakhti', 'shanakht', 'shanakhti_card', 'cnic_hash', 'identification_number',
    'applicant_cnic', 'citizen_cnic', 'customer_cnic', 'consumer_cnic', 'txtcnic', 'cnicno',
    'txt_cnic', 'crc_number', 'identity', 'cnicpart', 'cnic_part', 'cnic1', 'cnic2', 'cnic3'
  ],

  // 2. Father / Guardian / Husband Name (Checked BEFORE fullName so txtFatherName doesn't match 'name')
  fatherName: [
    'father_name', 'fathername', 'father', 'guardian_name', 'guardian', 'parent_name',
    'parent', 'so', 'do', 'wo', 'husband_name', 'husband', 'walid', 'walid_ka_naam',
    'walid_name', 's_o', 'd_o', 'w_o', 'txtfathername', 'txtfather', 'txtguardian',
    'txtwalid', 'txt_father', 'txt_guardian', 'father_guardian', 'parent_guardian'
  ],

  // 3. Full Name / Applicant Name (Skips if token contains father, guardian, mother, spouse)
  fullName: [
    'full_name', 'fullname', 'applicant_name', 'candidate_name', 'customer_name', 'citizen_name',
    'first_name', 'fname', 'client_name', 'person_name', 'txtapplicantname', 'txtname',
    'txt_name', 'user_name', 'naam', 'student_name', 'employee_name', 'member_name',
    'txt_applicant_name', 'consumer_name', 'applicantname', 'citizenname', 'customername'
  ],

  // 4. Phone / Mobile Number
  phone: [
    'phone', 'mobile', 'cell', 'cellphone', 'telephone', 'contact', 'contact_no',
    'phone_number', 'mobile_no', 'whatsapp', 'tel', 'cell_no', 'phone_no', 'rabta_number',
    'whatsapp_no', 'txtmobileno', 'txtmobile', 'txtcontact', 'txtphone', 'txtcell',
    'txt_mobile', 'mobileno', 'cellno', 'contactno'
  ],

  // 5. Email
  email: [
    'email', 'e_mail', 'email_address', 'mail', 'user_email', 'contact_email',
    'applicant_email', 'txtemail', 'txt_email', 'emailid', 'email_id'
  ],

  // 6. Gender
  gender: [
    'gender', 'sex', 'jins', 'ddlgender', 'ddl_gender', 'rbgender', 'rdo_gender',
    'txtgender', 'applicant_gender'
  ],

  // 7. Date of Birth
  dob: [
    'dob', 'date_of_birth', 'birth_date', 'birthdate', 'dateofbirth', 'birthday', 'birth',
    'tareekh_e_paidaish', 'txtdob', 'txt_dob', 'txtdateofbirth', 'txt_date_of_birth',
    'ddldob', 'birth_day'
  ],

  // 8. Address / Residence
  address: [
    'address', 'street', 'residence', 'residential_address', 'permanent_address',
    'current_address', 'street_address', 'mailing_address', 'house', 'addr', 'pata',
    'postal_address', 'home_address', 'txtaddress', 'txt_address', 'txtpresentaddress',
    'txtpermanentaddress', 'present_address', 'presentaddress', 'permanentaddress'
  ],

  // 9. City / District / Domicile / Tehsil
  city: [
    'city', 'district', 'town', 'tehsil', 'division', 'municipality', 'domicile_city',
    'shehr', 'zila', 'ddlcity', 'ddldistrict', 'ddl_city', 'ddl_district', 'txtcity',
    'txtdistrict', 'domicile', 'district_domicile'
  ],

  // 10. Qualification / Education
  qualification: [
    'qualification', 'education', 'degree', 'highest_qualification', 'academic',
    'major', 'university', 'college', 'last_degree', 'taleem', 'education_level',
    'ddleducation', 'ddlqualification', 'txtqualification', 'highest_degree'
  ],

  // 11. Profession / Job Title
  profession: [
    'profession', 'designation', 'job', 'job_title', 'occupation', 'role',
    'current_job', 'position', 'employment', 'pesha', 'field_of_work',
    'txtoccupation', 'txtprofession', 'ddloccupation'
  ],

  // 12. Experience (Years)
  experienceYears: [
    'experience', 'experience_years', 'years_of_experience', 'exp_years',
    'total_experience', 'exp', 'tajruba', 'txtexperience'
  ],

  // 13. Skills
  skills: [
    'skills', 'competencies', 'technical_skills', 'expertise', 'key_skills',
    'maharaat', 'txtskills'
  ],

  // 14. Bio / Summary / Remarks
  bio: [
    'bio', 'summary', 'about', 'description', 'objective', 'profile_summary',
    'cover_letter', 'remarks', 'txtremarks', 'txtbio'
  ],

  // 15. Police Station / Thana (Police Sahulat Markaz / Khidmat Markaz PKM)
  policeStation: [
    'police_station', 'policestation', 'thana', 'thana_name', 'police_station_name',
    'police_choki', 'markaz', 'pkm_station', 'sahulat_markaz', 'police_circle',
    'txtpolicestation', 'txtthana', 'ddlthana', 'ddlpolicestation', 'ddl_police_station',
    'police_district_station', 'concerned_police_station'
  ],

  // 16. Mother Name / Walida Ka Naam
  motherName: [
    'mother_name', 'mothername', 'walida', 'walida_ka_naam', 'walida_name', 'mother',
    'txtmothername', 'txtmother', 'txtwalida', 'txt_mother', 'txt_walida'
  ],

  // 17. Blood Group
  bloodGroup: [
    'blood_group', 'bloodgroup', 'blood', 'blood_grp', 'ddlbloodgroup', 'ddl_blood_group',
    'txtbloodgroup', 'txtblood'
  ],

  // 18. Driving License Number
  drivingLicenseNo: [
    'driving_license', 'driving_licence', 'license_no', 'licence_no', 'dl_no', 'dl_number',
    'license_number', 'licence_number', 'drivinglicense', 'txtlicenseno', 'txtdrivinglicense'
  ],

  // 19. Vehicle Registration Number / Engine / Chassis
  vehicleRegNo: [
    'vehicle_reg', 'vehicle_reg_no', 'vehicle_no', 'registration_no', 'engine_no',
    'chassis_no', 'car_number', 'bike_number', 'vehicle_registration', 'txtvehicleno'
  ],

  // 20. FIR Number / Complaint / Report / Loss Item
  firNumber: [
    'fir_no', 'fir_number', 'complaint_no', 'report_no', 'loss_report_no', 'case_no',
    'diary_no', 'txtfirno', 'txtcomplaintno'
  ],

  // 21. Emergency Contact / Waris Phone
  emergencyContact: [
    'emergency_contact', 'emergency_phone', 'emergency_no', 'waris_phone', 'waris_contact',
    'next_of_kin', 'guardian_phone', 'txtemergencycontact', 'txtemergencyphone'
  ],

  // 22. Marital Status
  maritalStatus: [
    'marital_status', 'maritalstatus', 'marriage_status', 'shadi_shuda', 'ddlmaritalstatus',
    'ddl_marital_status'
  ],

  // 23. Religion
  religion: [
    'religion', 'mazhab', 'ddlreligion', 'txtreligion'
  ],

  // 24. Nationality
  nationality: [
    'nationality', 'qaumiat', 'country_citizen', 'ddlnationality', 'txtnationality'
  ],

  // 25. Domicile / Domicile District (KPK CFC Portal)
  domicile: [
    'domicile', 'domicile_district', 'applicant_domicile', 'ddldomicile', 'txtdomicile',
    'domicile_certificate', 'ddl_domicile', 'txt_domicile'
  ],

  // 26. Tehsil (KPK CFC Portal & Land Record)
  tehsil: [
    'tehsil', 'applicant_tehsil', 'sub_district', 'ddltehsil', 'txttehsil', 'ddl_tehsil',
    'txt_tehsil', 'tahsil'
  ]
};

// Aliases mapping common custom field titles to input tokens
export const CUSTOM_FIELD_ALIASES: Record<string, string[]> = {
  'Police Station': ['police_station', 'thana', 'policestation', 'police_circle', 'thana_name', 'police_station_name', 'pkm_station', 'sahulat_markaz', 'txtthana', 'ddlthana', 'txtpolicestation'],
  'Police Station (تھانہ)': ['police_station', 'thana', 'policestation', 'police_circle', 'thana_name', 'txtthana', 'ddlthana', 'txtpolicestation'],
  'District': ['district', 'zila', 'zillah', 'applicant_district', 'domicile_district', 'ddldistrict', 'txtdistrict'],
  'District (ضلع)': ['district', 'zila', 'zillah', 'applicant_district', 'domicile_district', 'ddldistrict', 'txtdistrict'],
  'Tehsil': ['tehsil', 'sub_district', 'applicant_tehsil', 'ddltehsil', 'txttehsil', 'ddl_tehsil'],
  'Tehsil (تحصیل)': ['tehsil', 'sub_district', 'applicant_tehsil', 'ddltehsil', 'txttehsil', 'ddl_tehsil'],
  'Domicile': ['domicile', 'domicile_district', 'applicant_domicile', 'ddldomicile', 'txtdomicile', 'domicile_certificate'],
  'Domicile (ڈومیسائل)': ['domicile', 'domicile_district', 'applicant_domicile', 'ddldomicile', 'txtdomicile', 'domicile_certificate'],
  'Mother Name': ['mother_name', 'mothername', 'walida', 'walida_ka_naam', 'walida_name', 'mother', 'txtmothername', 'txtwalida'],
  'Mother Name (والدہ کا نام)': ['mother_name', 'mothername', 'walida', 'walida_ka_naam', 'walida_name', 'mother', 'txtmothername', 'txtwalida'],
  'Blood Group': ['blood_group', 'bloodgroup', 'blood', 'blood_grp', 'ddlbloodgroup', 'txtbloodgroup'],
  'Driving License No': ['driving_license', 'driving_licence', 'license_no', 'licence_no', 'dl_no', 'dl_number', 'license_number', 'txtlicenseno'],
  'Vehicle Reg No': ['vehicle_reg', 'vehicle_reg_no', 'vehicle_no', 'registration_no', 'engine_no', 'chassis_no', 'txtvehicleno'],
  'Emergency Contact': ['emergency_contact', 'emergency_phone', 'emergency_no', 'waris_phone', 'waris_contact', 'guardian_phone', 'txtemergencycontact'],
  'Emergency Contact (وارث رابطہ)': ['emergency_contact', 'emergency_phone', 'emergency_no', 'waris_phone', 'waris_contact', 'guardian_phone', 'txtemergencycontact'],
  'FIR Number': ['fir_no', 'fir_number', 'complaint_no', 'report_no', 'loss_report_no', 'case_no', 'txtfirno'],
  'Marital Status': ['marital_status', 'maritalstatus', 'marriage_status', 'shadi_shuda', 'ddlmaritalstatus'],
  'Religion': ['religion', 'mazhab', 'ddlreligion', 'txtreligion'],
  'Nationality': ['nationality', 'qaumiat', 'ddlnationality', 'txtnationality'],
  'Postal Code': ['postal_code', 'zip_code', 'postcode', 'zip', 'postalcode', 'txtpostalcode']
};

/**
 * Normalizes an attribute string for pattern matching
 */
export function cleanFieldName(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

/**
 * Derives a clean human-readable label from an element's attributes and surrounding DOM
 */
export function deriveFieldLabel(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  // 1. Check HTML5 labels property
  if ('labels' in element && element.labels && element.labels.length > 0 && element.labels[0].textContent) {
    const text = element.labels[0].textContent.replace(/[*:]/g, '').trim();
    if (text) return text;
  }

  // 2. Check associated label by for="id"
  if (element.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label && label.textContent) {
        const text = label.textContent.replace(/[*:]/g, '').trim();
        if (text) return text;
      }
    } catch (e) {}
  }

  // 3. Check closest parent label
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    const text = parentLabel.textContent.replace(element.value || '', '').replace(/[*:]/g, '').trim();
    if (text) return text;
  }

  // 4. Check previous sibling if it's a label, span, or paragraph
  const prev = element.previousElementSibling;
  if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
    const text = prev.textContent?.replace(/[*:]/g, '').trim();
    if (text && text.length < 60) return text;
  }

  // 5. Check placeholder, aria-label, title, name, or id
  const placeholderText = 'placeholder' in element ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder : '';
  const raw =
    element.getAttribute('aria-label') ||
    placeholderText ||
    element.getAttribute('title') ||
    element.name ||
    element.id ||
    'Custom Field';

  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim();
}

/**
 * Determines which customer field a form input corresponds to.
 * Respects strict hierarchy (Father Name takes priority over Full Name).
 */
export function matchInputToCustomerField(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  existingCustomFields: Record<string, string> = {}
): { fieldKey: string | null; isStandard: boolean; isCustom: boolean; partIndex?: number } {
  const name = cleanFieldName(element.name || '');
  const id = cleanFieldName(element.id || '');
  const placeholderText = 'placeholder' in element ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder : '';
  const placeholder = cleanFieldName(placeholderText || '');
  const ariaLabel = cleanFieldName(element.getAttribute('aria-label') || '');
  const derivedLabel = cleanFieldName(deriveFieldLabel(element) || '');

  const tokens = [name, id, placeholder, ariaLabel, derivedLabel].filter(Boolean);

  // Check 3-part CNIC box detection (CFC / NADRA portals)
  // e.g. cnic1 / cnic_part1 / maxlength 5
  const isCnicToken = tokens.some(t => t.includes('cnic') || t.includes('nic') || t.includes('shanakht') || t.includes('identity'));
  if (isCnicToken) {
    const maxLen = element.getAttribute('maxlength');
    if (tokens.some(t => t.includes('1') || t.includes('part1') || t.includes('first')) || maxLen === '5') {
      return { fieldKey: 'cnic', isStandard: true, isCustom: false, partIndex: 1 };
    }
    if (tokens.some(t => t.includes('2') || t.includes('part2') || t.includes('mid') || t.includes('middle')) || maxLen === '7') {
      return { fieldKey: 'cnic', isStandard: true, isCustom: false, partIndex: 2 };
    }
    if (tokens.some(t => t.includes('3') || t.includes('part3') || t.includes('last')) || maxLen === '1') {
      return { fieldKey: 'cnic', isStandard: true, isCustom: false, partIndex: 3 };
    }
  }

  // 1. Check standard fields in priority order
  for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
    // Safety guard: do NOT match fullName if token indicates Father / Guardian / Mother / Husband
    if (key === 'fullName') {
      const isFatherOrGuardian = tokens.some(t =>
        t.includes('father') || t.includes('walid') || t.includes('guardian') ||
        t.includes('husband') || t.includes('mother') || t.includes('parent') ||
        t.includes('s_o') || t.includes('d_o') || t.includes('w_o')
      );
      if (isFatherOrGuardian) continue;
    }

    for (const token of tokens) {
      if (patterns.some((p) => token === p || token.includes(p) || (p.length > 3 && p.includes(token)))) {
        return { fieldKey: key, isStandard: true, isCustom: false };
      }
    }
  }

  // 2. Check existing custom fields (both exact key, normalized key, and known aliases)
  const customKeys = Object.keys(existingCustomFields);
  for (const cKey of customKeys) {
    const cleanCKey = cleanFieldName(cKey);
    // Direct token match
    for (const token of tokens) {
      if (token.includes(cleanCKey) || cleanCKey.includes(token)) {
        return { fieldKey: cKey, isStandard: false, isCustom: true };
      }
    }

    // Check alias list (e.g. Police Station -> thana, police_station)
    const aliases = CUSTOM_FIELD_ALIASES[cKey] || [];
    for (const alias of aliases) {
      for (const token of tokens) {
        if (token === alias || token.includes(alias) || alias.includes(token)) {
          return { fieldKey: cKey, isStandard: false, isCustom: true };
        }
      }
    }
  }

  return { fieldKey: null, isStandard: false, isCustom: false };
}

/**
 * Sets input/select/textarea value cross-framework (React, Angular, Vue, Native, jQuery)
 */
export function setNativeFieldValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
): void {
  if (!element || value === undefined || value === null) return;

  if (element.tagName === 'SELECT') {
    const select = element as HTMLSelectElement;
    const lowerVal = String(value).trim().toLowerCase();
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      const optVal = opt.value.trim().toLowerCase();
      const optText = opt.text.trim().toLowerCase();
      if (
        optVal === lowerVal ||
        optText === lowerVal ||
        (lowerVal.length > 2 && optText.includes(lowerVal)) ||
        (lowerVal.length > 2 && optVal.includes(lowerVal))
      ) {
        select.selectedIndex = i;
        opt.selected = true;
        select.value = opt.value;
        found = true;
        break;
      }
    }

    // Specialized gender matching for portals (Male -> M / 1 / Male)
    if (!found && (lowerVal === 'male' || lowerVal === 'm')) {
      for (let i = 0; i < select.options.length; i++) {
        const o = select.options[i];
        if (o.value === '1' || o.value.toLowerCase() === 'm' || o.text.toLowerCase().startsWith('m')) {
          select.selectedIndex = i;
          o.selected = true;
          select.value = o.value;
          found = true;
          break;
        }
      }
    }
    if (!found && (lowerVal === 'female' || lowerVal === 'f')) {
      for (let i = 0; i < select.options.length; i++) {
        const o = select.options[i];
        if (o.value === '2' || o.value.toLowerCase() === 'f' || o.text.toLowerCase().startsWith('f')) {
          select.selectedIndex = i;
          o.selected = true;
          select.value = o.value;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      select.value = value;
    }
  } else if (element.type === 'checkbox' || element.type === 'radio') {
    const input = element as HTMLInputElement;
    const lowerVal = String(value).trim().toLowerCase();
    if (
      input.value.toLowerCase() === lowerVal ||
      lowerVal === 'true' ||
      lowerVal === 'yes' ||
      lowerVal === '1'
    ) {
      input.checked = true;
    }
  } else {
    // Text, email, tel, date, textarea, etc.
    let formattedVal = value;

    // Handle HTML5 date inputs format conversion (YYYY-MM-DD required)
    if (element.type === 'date' && value) {
      if (value.includes('/') || value.includes('-')) {
        const parts = value.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            formattedVal = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            // DD/MM/YYYY or MM/DD/YYYY
            formattedVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }
    }

    const proto =
      element instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, formattedVal);
    } else {
      element.value = formattedVal;
    }
  }

  // Dispatch full event sequence to notify React, Vue, Angular, ASP.NET WebForms & native scripts
  try { element.dispatchEvent(new Event('focus', { bubbles: true })); } catch (e) {}
  try { element.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  try { element.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  try { element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); } catch (e) {}
  try { element.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
}

/**
 * Auto-fills a form container using a customer record,
 * and detects any newly populated or unmapped fields.
 */
export function autofillFormAndHarvest(
  container: HTMLElement,
  customer: Customer
): { filledCount: number; detectedFields: DetectedField[] } {
  const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
  );

  let filledCount = 0;
  const detectedFields: DetectedField[] = [];

  inputs.forEach((input) => {
    const { fieldKey, isStandard, isCustom, partIndex } = matchInputToCustomerField(
      input,
      customer.customFields || {}
    );

    let targetValue: string | undefined;

    if (fieldKey === 'cnic' && partIndex) {
      const digits = normalizeCnic(customer.cnic);
      if (partIndex === 1) targetValue = digits.slice(0, 5);
      else if (partIndex === 2) targetValue = digits.slice(5, 12);
      else if (partIndex === 3) targetValue = digits.slice(12, 13);
    } else if (fieldKey && isStandard) {
      targetValue = (customer as any)[fieldKey];
    } else if (fieldKey && isCustom) {
      targetValue = customer.customFields?.[fieldKey];
    }

    if (targetValue !== undefined && targetValue !== '') {
      setNativeFieldValue(input, targetValue);

      // Add temporary highlight
      input.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/40');
      setTimeout(() => {
        input.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/40');
      }, 3000);

      filledCount++;
    } else {
      const label = deriveFieldLabel(input);
      const cleanKey = label || input.name || input.id || 'Field';

      const isAlreadyInCustomer =
        (customer as any)[cleanKey] !== undefined ||
        (customer.customFields && customer.customFields[cleanKey] !== undefined);

      detectedFields.push({
        key: cleanKey,
        label,
        value: input.value || '',
        type: input.tagName.toLowerCase(),
        isNew: !isAlreadyInCustomer,
      });
    }
  });

  return { filledCount, detectedFields };
}

/**
 * Scrapes and extracts all filled form data from a container (form or document)
 * into a structured Customer object ready to save directly to Google Sheet before submitting.
 */
export function extractCustomerFromForm(
  container: HTMLElement = document.body
): {
  customer: Customer | null;
  extractedFields: Array<{ key: string; label: string; value: string; isStandard: boolean }>;
  cnicFound: boolean;
} {
  const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
  );

  const collectedData: Record<string, string> = {};
  const customFields: Record<string, string> = {};
  const extractedFields: Array<{ key: string; label: string; value: string; isStandard: boolean }> = [];
  const cnicParts: Record<number, string> = {};

  inputs.forEach((input) => {
    // Skip inputs that belong to the floating assistant, taskbar, or pills
    if (
      input.closest('#syncsheet-autofill-container') ||
      input.closest('#syncsheet-autofill-taskbar') ||
      input.closest('#syncsheet-inpage-nic-pill') ||
      input.closest('#syncsheet-dock-taskbar') ||
      input.closest('#syncsheet-floating-dock') ||
      input.closest('#syncsheet-detect-pill') ||
      input.closest('#syncsheet-bm-pill')
    ) {
      return;
    }

    const val = input.value ? input.value.trim() : '';
    if (!val) return;

    const { fieldKey, isStandard, partIndex } = matchInputToCustomerField(input);
    const label = deriveFieldLabel(input);

    if (fieldKey === 'cnic' && partIndex) {
      cnicParts[partIndex] = normalizeCnic(val);
      extractedFields.push({ key: `cnic_part_${partIndex}`, label: `${label} (Part ${partIndex})`, value: val, isStandard: true });
    } else if (fieldKey && isStandard) {
      if (!collectedData[fieldKey]) {
        collectedData[fieldKey] = val;
        extractedFields.push({ key: fieldKey, label, value: val, isStandard: true });
      }
    } else {
      // Unmapped / Custom field entered on website
      const cleanKey = label || input.name || input.id || `Field_${extractedFields.length + 1}`;
      customFields[cleanKey] = val;
      extractedFields.push({ key: cleanKey, label: cleanKey, value: val, isStandard: false });
    }
  });

  // Assemble CNIC if parts were found
  if (cnicParts[1] && cnicParts[2]) {
    const rawCnic = `${cnicParts[1]}${cnicParts[2]}${cnicParts[3] || ''}`;
    collectedData.cnic = formatCnic(rawCnic);
  } else if (collectedData.cnic) {
    collectedData.cnic = formatCnic(collectedData.cnic);
  }

  if (extractedFields.length === 0) {
    return { customer: null, extractedFields: [], cnicFound: false };
  }

  const cnic = collectedData.cnic || '';
  const now = new Date().toISOString();

  const customer: Customer = {
    id: cnic ? normalizeCnic(cnic) : `temp_${Date.now()}`,
    cnic: cnic ? formatCnic(cnic) : '',
    fullName: collectedData.fullName || '',
    fatherName: collectedData.fatherName || '',
    phone: collectedData.phone || '',
    email: collectedData.email || '',
    gender: (collectedData.gender as any) || '',
    dob: collectedData.dob || '',
    address: collectedData.address || '',
    city: collectedData.city || '',
    qualification: collectedData.qualification || '',
    profession: collectedData.profession || '',
    experienceYears: collectedData.experienceYears || '',
    skills: collectedData.skills || '',
    bio: collectedData.bio || '',
    customFields,
    createdAt: now,
    updatedAt: now,
    syncedToSheet: false,
  };

  return {
    customer,
    extractedFields,
    cnicFound: Boolean(cnic),
  };
}

/**
 * Generates the Bookmarklet JavaScript code that runs on any website (including CFC portals)
 */
export function generateBookmarkletCode(
  appUrl: string,
  customers: Customer[],
  sheetTitle: string
): string {
  const customersJson = JSON.stringify(
    customers.map((c) => ({
      cnic: c.cnic,
      fullName: c.fullName,
      fatherName: c.fatherName,
      phone: c.phone,
      email: c.email,
      gender: c.gender,
      dob: c.dob,
      address: c.address,
      city: c.city,
      qualification: c.qualification,
      profession: c.profession,
      experienceYears: c.experienceYears,
      skills: c.skills,
      bio: c.bio,
      customFields: c.customFields || {},
    }))
  );

  const rawScript = `
(function() {
  if (window.__syncsheet_autofill_active) {
    alert('SyncSheet AutoFiller is already active on this page! Look for the floating widget at bottom-right.');
    return;
  }
  window.__syncsheet_autofill_active = true;

  var DB = ${customersJson};
  var SHEET_TITLE = ${JSON.stringify(sheetTitle || 'Connected Sheet')};

  function norm(str) {
    return (str || '').replace(/[^0-9]/g, '');
  }

  function cleanStr(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function findCustomer(val) {
    if (!val || DB.length === 0) return null;
    var digits = norm(val);
    if (digits.length >= 5) {
      for (var i = 0; i < DB.length; i++) {
        var dbDigits = norm(DB[i].cnic);
        if (dbDigits === digits || (digits.length >= 13 && dbDigits.indexOf(digits) !== -1)) {
          return DB[i];
        }
      }
    }
    var raw = val.trim().toLowerCase();
    for (var j = 0; j < DB.length; j++) {
      if ((DB[j].cnic || '').toLowerCase() === raw) return DB[j];
    }
    return null;
  }

  // Floating container for Assistant and Minimized Bubble
  var container = document.createElement('div');
  container.id = 'syncsheet-autofill-container';
  container.style.cssText = 'position:fixed !important;bottom:20px !important;right:20px !important;z-index:2147483647 !important;font-family:system-ui,-apple-system,sans-serif !important;font-size:12px !important;';

  // Minimized Trigger Bubble
  var bubble = document.createElement('button');
  bubble.id = 'syncsheet-bubble';
  bubble.style.cssText = 'background:linear-gradient(135deg, #059669, #0284c7) !important;color:#fff !important;border:2px solid #ffffff !important;border-radius:30px !important;box-shadow:0 10px 30px rgba(0,0,0,0.6) !important;padding:8px 16px !important;display:flex !important;align-items:center !important;gap:8px !important;cursor:pointer !important;font-weight:bold !important;font-size:12px !important;outline:none !important;';
  bubble.innerHTML = '<span style="background:rgba(255,255,255,0.3);border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">⚡</span><span>AutoFill Form</span><span style="background:#0f172a;color:#38bdf8;padding:2px 6px;border-radius:10px;font-size:10px;font-family:monospace;">' + DB.length + ' in Sheet</span>';

  // Floating dock
  var dock = document.createElement('div');
  dock.id = 'syncsheet-autofill-dock';
  dock.style.cssText = 'display:block;background:#0f172a !important;color:#fff !important;padding:14px !important;border-radius:14px !important;box-shadow:0 20px 50px rgba(0,0,0,0.8) !important;border:2px solid #38bdf8 !important;width:340px !important;box-sizing:border-box !important;font-size:12px !important;margin-bottom:8px !important;';
  dock.innerHTML = 
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #1e293b;padding-bottom:6px;">' +
      '<div style="font-weight:bold;color:#10b981;font-size:13px;display:flex;align-items:center;gap:6px;">⚡ SyncSheet AutoFiller</div>' +
      '<div style="display:flex;gap:4px;align-items:center;">' +
        '<button id="ss-min-tb" style="background:#0284c7;border:none;color:#fff;font-size:10px;padding:3px 6px;border-radius:4px;cursor:pointer;font-weight:bold;" title="Minimize to Taskbar">━ Taskbar</button>' +
        '<button id="ss-min" style="background:#334155;border:none;color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;cursor:pointer;" title="Minimize to Bubble">_</button>' +
        '<button id="ss-close" style="background:#dc2626;border:none;color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;cursor:pointer;">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Sheet: <b>' + (SHEET_TITLE || 'Synced') + '</b> (' + DB.length + ' records ready)</div>' +
    '<select id="ss-customer-pick" style="width:100%;padding:7px;border-radius:8px;background:#1e293b;color:#fff;border:1px solid #475569;margin-bottom:8px;font-size:11px;outline:none;">' +
      '<option value="">-- Choose Customer from Google Sheet --</option>' +
      DB.map(function(c){ return '<option value="' + c.cnic + '">' + c.cnic + ' - ' + c.fullName + '</option>'; }).join('') +
    '</select>' +
    '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
      '<input id="ss-cnic-input" placeholder="Search or Type CNIC (xxxxx-xxxxxxx-x)..." style="flex:1;padding:7px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff !important;color:#000000 !important;font-weight:600 !important;font-size:11px;font-family:monospace;outline:none;" />' +
      '<button id="ss-fill-btn" style="background:#10b981;border:none;color:#0f172a;padding:7px 12px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:11px;">Fill Form</button>' +
    '</div>' +
    '<button id="ss-collect-btn" style="width:100%;background:#0284c7;border:none;color:#fff;padding:7px 12px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:11px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;" title="Collect & Save new form data entered on this website to Google Sheet before submitting">📥 Save Form Data to Google Sheet</button>' +
    '<div id="ss-status" style="font-size:11px;color:#cbd5e1;padding:6px;background:#1e293b;border-radius:6px;margin-bottom:6px;">Select customer or type CNIC to fill, or click Save Form Data to Google Sheet!</div>' +
    '<div id="ss-new-fields-area" style="display:none;margin-top:8px;padding-top:8px;border-t:1px solid #334155;">' +
      '<div style="color:#facc15;font-weight:bold;font-size:11px;margin-bottom:4px;">✨ New Form Fields to Map under this CNIC:</div>' +
      '<div id="ss-new-fields-list" style="font-size:10px;color:#cbd5e1;margin-bottom:6px;max-height:80px;overflow-y:auto;"></div>' +
      '<button id="ss-save-fields-btn" style="width:100%;background:#0284c7;color:#fff;border:none;padding:7px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:11px;">Save New Fields to Google Sheet under this CNIC</button>' +
    '</div>';

  // Docked Taskbar element across bottom edge
  var taskbar = document.createElement('div');
  taskbar.id = 'syncsheet-taskbar';
  taskbar.style.cssText = 'display:none;position:fixed !important;bottom:0 !important;left:0 !important;right:0 !important;background:#0f172a !important;border-top:2px solid #10b981 !important;color:#fff !important;padding:8px 16px !important;z-index:2147483647 !important;box-shadow:0 -5px 25px rgba(0,0,0,0.8) !important;font-family:system-ui,sans-serif !important;font-size:12px !important;align-items:center !important;justify-content:space-between !important;gap:10px !important;box-sizing:border-box !important;';
  taskbar.innerHTML = 
    '<div style="display:flex;align-items:center;gap:8px;">' +
      '<span style="background:#10b981;color:#0f172a;width:20px;height:20px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;">⚡</span>' +
      '<span style="font-weight:bold;color:#fff;">AutoFill Taskbar</span>' +
      '<span style="color:#94a3b8;font-size:11px;">(' + DB.length + ' in Sheet)</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:6px;flex:1;max-width:440px;">' +
      '<input id="ss-tb-cnic-input" placeholder="Search or Type CNIC (xxxxx-xxxxxxx-x)..." style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff !important;color:#000000 !important;font-weight:600 !important;font-size:11px;outline:none;" />' +
      '<select id="ss-tb-customer-pick" style="padding:6px;border-radius:6px;background:#1e293b;color:#fff;border:1px solid #475569;font-size:11px;outline:none;max-width:180px;">' +
        '<option value="">-- Choose Customer --</option>' +
        DB.map(function(c){ return '<option value="' + c.cnic + '">' + c.cnic + ' - ' + c.fullName + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button id="ss-tb-fill-btn" style="background:#10b981;border:none;color:#0f172a;padding:6px 12px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">⚡ Fill Form</button>' +
      '<button id="ss-tb-collect-btn" style="background:#0284c7;border:none;color:#fff;padding:6px 10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;" title="Collect & Save new form data entered on this website to Google Sheet before submitting">📥 Save Form to Sheet</button>' +
      '<button id="ss-tb-expand-btn" style="background:#334155;border:none;color:#fff;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;" title="Expand to Window">⤢</button>' +
      '<button id="ss-tb-close-btn" style="background:#dc2626;border:none;color:#fff;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;">&times;</button>' +
    '</div>';

  container.appendChild(dock);
  container.appendChild(bubble);
  document.body.appendChild(container);
  document.body.appendChild(taskbar);

  bubble.onclick = function() {
    dock.style.display = dock.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('ss-min').onclick = function() {
    dock.style.display = 'none';
  };

  document.getElementById('ss-min-tb').onclick = function() {
    dock.style.display = 'none';
    bubble.style.display = 'none';
    taskbar.style.display = 'flex';
  };

  document.getElementById('ss-tb-expand-btn').onclick = function() {
    taskbar.style.display = 'none';
    bubble.style.display = 'flex';
    dock.style.display = 'block';
  };

  document.getElementById('ss-tb-close-btn').onclick = function() {
    taskbar.style.display = 'none';
    bubble.style.display = 'flex';
  };

  document.getElementById('ss-close').onclick = function() {
    container.remove();
    taskbar.remove();
    window.__syncsheet_autofill_active = false;
  };

  var lastCustomer = null;
  var lastUnmapped = {};

  function fillDocument(cust) {
    if (!cust) return;
    lastCustomer = cust;
    var allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
    var count = 0;

    allInputs.forEach(function(el) {
      if (el.closest('#syncsheet-autofill-container')) return;
      var name = cleanStr(el.name);
      var id = cleanStr(el.id);
      var ph = cleanStr(el.placeholder);
      var str = [name, id, ph].join(' ');

      var val = null;
      if (str.indexOf('cnic') !== -1 || str.indexOf('nic') !== -1 || str.indexOf('identity') !== -1 || str.indexOf('shanakht') !== -1) {
        val = cust.cnic;
      } else if (str.indexOf('father') !== -1 || str.indexOf('walid') !== -1 || str.indexOf('guardian') !== -1) {
        val = cust.fatherName;
      } else if (str.indexOf('mother') !== -1 || str.indexOf('walida') !== -1) {
        val = cust.motherName || (cust.customFields && (cust.customFields['Mother Name'] || cust.customFields['Mother Name (والدہ کا نام)']));
      } else if (str.indexOf('police') !== -1 || str.indexOf('thana') !== -1 || str.indexOf('markaz') !== -1) {
        val = cust.policeStation || (cust.customFields && (cust.customFields['Police Station'] || cust.customFields['Police Station (تھانہ)']));
      } else if (str.indexOf('domicile') !== -1) {
        val = cust.domicile || (cust.customFields && (cust.customFields['Domicile'] || cust.customFields['Domicile (ڈومیسائل)']));
      } else if (str.indexOf('blood') !== -1) {
        val = cust.bloodGroup || (cust.customFields && cust.customFields['Blood Group']);
      } else if (str.indexOf('license') !== -1 || str.indexOf('licence') !== -1 || str.indexOf('dl_') !== -1) {
        val = cust.drivingLicenseNo || (cust.customFields && cust.customFields['Driving License No']);
      } else if (str.indexOf('vehicle') !== -1 || str.indexOf('chassis') !== -1 || str.indexOf('engine_no') !== -1) {
        val = cust.vehicleRegNo || (cust.customFields && cust.customFields['Vehicle Reg No']);
      } else if (str.indexOf('emergency') !== -1 || str.indexOf('waris') !== -1) {
        val = cust.emergencyContact || (cust.customFields && (cust.customFields['Emergency Contact'] || cust.customFields['Emergency Contact (وارث رابطہ)']));
      } else if (str.indexOf('name') !== -1 && str.indexOf('user') === -1) {
        val = cust.fullName;
      } else if (str.indexOf('mobile') !== -1 || str.indexOf('phone') !== -1 || str.indexOf('cell') !== -1) {
        val = cust.phone;
      } else if (str.indexOf('email') !== -1) {
        val = cust.email;
      } else if (str.indexOf('gender') !== -1 || str.indexOf('sex') !== -1 || str.indexOf('jins') !== -1) {
        val = cust.gender;
      } else if (str.indexOf('dob') !== -1 || str.indexOf('birth') !== -1 || str.indexOf('paidaish') !== -1) {
        val = cust.dob;
      } else if (str.indexOf('address') !== -1 || str.indexOf('street') !== -1 || str.indexOf('pata') !== -1) {
        val = cust.address;
      } else if (str.indexOf('city') !== -1 || str.indexOf('district') !== -1 || str.indexOf('zila') !== -1) {
        val = cust.city;
      } else if (str.indexOf('tehsil') !== -1) {
        val = cust.tehsil || (cust.customFields && (cust.customFields['Tehsil'] || cust.customFields['Tehsil (تحصیل)']));
      } else if (str.indexOf('qualification') !== -1 || str.indexOf('degree') !== -1 || str.indexOf('education') !== -1 || str.indexOf('taleem') !== -1) {
        val = cust.qualification;
      } else if (str.indexOf('profession') !== -1 || str.indexOf('job') !== -1 || str.indexOf('occupation') !== -1 || str.indexOf('pesha') !== -1) {
        val = cust.profession;
      }

      // Check remaining dynamic custom fields
      if (!val && cust.customFields) {
        for (var cfKey in cust.customFields) {
          var cleanK = cleanStr(cfKey);
          if (str.indexOf(cleanK) !== -1 || cleanK.indexOf(name) !== -1 || cleanK.indexOf(id) !== -1) {
            val = cust.customFields[cfKey];
            break;
          }
        }
      }

      if (val) {
        if (el.tagName === 'SELECT') {
          for (var i = 0; i < el.options.length; i++) {
            if (el.options[i].text.toLowerCase().indexOf(val.toLowerCase()) !== -1 || el.options[i].value.toLowerCase() === val.toLowerCase()) {
              el.selectedIndex = i;
              break;
            }
          }
        } else {
          el.value = val;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.style.outline = '2px solid #10b981';
        count++;
      }
    });

    document.getElementById('ss-status').innerHTML = '<span style="color:#10b981;font-weight:bold;">✓ Filled ' + count + ' fields for ' + cust.fullName + '!</span>';

    // Scan for unmapped form fields entered on this website (e.g. Domicile, Tehsil, Police Station, Password)
    lastUnmapped = {};
    allInputs.forEach(function(el) {
      if (el.closest('#syncsheet-autofill-container')) return;
      var v = el.value ? el.value.trim() : '';
      if (v) {
        var n = cleanStr(el.name || el.id || el.placeholder || '');
        var isKnown = (n.indexOf('cnic')!==-1 || n.indexOf('name')!==-1 || n.indexOf('father')!==-1 || n.indexOf('mobile')!==-1 || n.indexOf('email')!==-1 || n.indexOf('gender')!==-1 || n.indexOf('dob')!==-1 || n.indexOf('address')!==-1 || n.indexOf('city')!==-1);
        if (!isKnown && (!cust.customFields || !cust.customFields[n])) {
          var label = (el.labels && el.labels[0] ? el.labels[0].innerText.trim() : '') || el.name || el.id || 'Field';
          label = label.replace(/[*:]/g, '').trim();
          lastUnmapped[label] = v;
        }
      }
    });

    var newKeys = Object.keys(lastUnmapped);
    var newFieldsArea = document.getElementById('ss-new-fields-area');
    var newFieldsList = document.getElementById('ss-new-fields-list');
    var saveBtn = document.getElementById('ss-save-fields-btn');

    if (newKeys.length > 0 && newFieldsArea && newFieldsList) {
      newFieldsList.innerHTML = newKeys.map(function(k) { return '• <b>' + k + '</b>: ' + lastUnmapped[k]; }).join('<br/>');
      newFieldsArea.style.display = 'block';
      if (saveBtn) {
        saveBtn.onclick = function() {
          saveBtn.innerText = 'Saving to Sheet...';
          var appDestination = ${JSON.stringify(appUrl || '')};
          if (appDestination) {
            window.open(appDestination + '?harvest_cnic=' + encodeURIComponent(cust.cnic) + '&harvest_fields=' + encodeURIComponent(JSON.stringify(lastUnmapped)), '_blank');
          }
          saveBtn.innerText = '✓ Sent to Google Sheet under CNIC ' + cust.cnic;
          saveBtn.style.background = '#10b981';
        };
      }
    } else if (newFieldsArea) {
      newFieldsArea.style.display = 'none';
    }
  }

  document.getElementById('ss-customer-pick').onchange = function() {
    var cnic = this.value;
    var found = findCustomer(cnic);
    if (found) fillDocument(found);
  };

  document.getElementById('ss-fill-btn').onclick = function() {
    var val = document.getElementById('ss-cnic-input').value || document.getElementById('ss-customer-pick').value;
    var found = findCustomer(val) || DB[0];
    if (found) fillDocument(found);
  };

  if (document.getElementById('ss-tb-customer-pick')) {
    document.getElementById('ss-tb-customer-pick').onchange = function() {
      var cnic = this.value;
      var found = findCustomer(cnic);
      if (found) fillDocument(found);
    };
  }

  if (document.getElementById('ss-tb-fill-btn')) {
    document.getElementById('ss-tb-fill-btn').onclick = function() {
      var val = document.getElementById('ss-tb-cnic-input').value || document.getElementById('ss-tb-customer-pick').value;
      var found = findCustomer(val) || DB[0];
      if (found) fillDocument(found);
    };
  }

  function collectFormAndSendToSheet() {
    var allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
    var collected = {};
    var count = 0;
    var foundCnic = '';
    var foundName = '';

    allInputs.forEach(function(el) {
      if (el.closest('#syncsheet-autofill-container') || el.closest('#syncsheet-taskbar') || el.closest('#syncsheet-bm-pill')) return;
      var v = el.value ? el.value.trim() : '';
      if (!v) return;
      var name = cleanStr(el.name);
      var id = cleanStr(el.id);
      var ph = cleanStr(el.placeholder);
      var str = [name, id, ph].join(' ');

      if (str.indexOf('cnic') !== -1 || str.indexOf('nic') !== -1 || str.indexOf('shanakht') !== -1 || str.indexOf('identity') !== -1) {
        foundCnic = v;
      } else if (str.indexOf('father') === -1 && str.indexOf('guardian') === -1 && (str.indexOf('name') !== -1 || str.indexOf('applicant') !== -1)) {
        foundName = v;
      }

      var label = (el.labels && el.labels[0] ? el.labels[0].innerText.trim() : '') || el.name || el.id || ('Field_' + (count + 1));
      label = label.replace(/[*:]/g, '').trim();
      collected[label] = v;
      count++;
    });

    if (count === 0) {
      alert('⚠️ No filled form fields found! Please fill in the applicant details on this form first, then click Save Form to Sheet.');
      return;
    }

    if (!foundCnic) {
      foundCnic = prompt('📥 Found ' + count + ' filled form fields!\nEnter CNIC (xxxxx-xxxxxxx-x) to save this person under in your Google Sheet:', '');
      if (!foundCnic) return;
    }

    var appDestination = ${JSON.stringify(appUrl || '')};
    var payload = {
      cnic: foundCnic,
      fullName: foundName || 'New Customer',
      customFields: collected
    };

    var statusEl = document.getElementById('ss-status');
    if (statusEl) {
      statusEl.innerHTML = '<span style="color:#38bdf8;font-weight:bold;">✓ Collected ' + count + ' fields for CNIC ' + foundCnic + '! Saving to Google Sheet...</span>';
    }

    if (appDestination) {
      window.open(appDestination + '?collect_customer=' + encodeURIComponent(JSON.stringify(payload)), '_blank');
    }
  }

  if (document.getElementById('ss-collect-btn')) {
    document.getElementById('ss-collect-btn').onclick = collectFormAndSendToSheet;
  }
  if (document.getElementById('ss-tb-collect-btn')) {
    document.getElementById('ss-tb-collect-btn').onclick = collectFormAndSendToSheet;
  }

  // Smart in-page pill button when typing NIC in any website / any form in format xxxxx-xxxxxxx-x
  var activePill = null;
  function showPill(inputEl, cust) {
    if (activePill) activePill.remove();
    var rect = inputEl.getBoundingClientRect();
    var p = document.createElement('div');
    p.id = 'syncsheet-bm-pill';
    p.style.cssText = 'position:fixed !important;z-index:2147483647 !important;background:#0f172a !important;color:#fff !important;border:2px solid #10b981 !important;border-radius:10px !important;padding:6px 10px !important;box-shadow:0 10px 30px rgba(0,0,0,0.8) !important;font-size:11px !important;display:flex !important;align-items:center !important;gap:8px !important;font-family:system-ui,sans-serif !important;';
    var topP = (rect.bottom + 6 + 40 > window.innerHeight) ? Math.max(10, rect.top - 45) : (rect.bottom + 6);
    var leftP = Math.max(10, Math.min(rect.left, window.innerWidth - 320));
    p.style.top = topP + 'px';
    p.style.left = leftP + 'px';
    p.innerHTML = '<span>⚡</span><span style="font-weight:bold;color:#10b981;">AutoFill: ' + (cust ? cust.fullName : 'Customer') + '</span><button id="ss-bm-pill-btn" style="background:#10b981;border:none;color:#0f172a;font-weight:bold;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Fill Form</button><button id="ss-bm-pill-collect" style="background:#0284c7;border:none;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">📥 Save to Sheet</button><button id="ss-bm-pill-cls" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px;">&times;</button>';
    document.body.appendChild(p);
    activePill = p;
    document.getElementById('ss-bm-pill-btn').onclick = function(e) {
      e.preventDefault();
      fillDocument(cust || DB[0]);
      p.remove();
      activePill = null;
    };
    document.getElementById('ss-bm-pill-collect').onclick = function(e) {
      e.preventDefault();
      collectFormAndSendToSheet();
      p.remove();
      activePill = null;
    };
    document.getElementById('ss-bm-pill-cls').onclick = function(e) {
      e.preventDefault();
      p.remove();
      activePill = null;
    };
    setTimeout(function() { if (p && p.parentNode) p.remove(); }, 12000);
  }

  function handleBmInput(e) {
    if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) return;
    if (e.target.closest('#syncsheet-autofill-container') || e.target.closest('#syncsheet-taskbar') || e.target.closest('#syncsheet-bm-pill')) return;
    var el = e.target;
    var v = el.value || '';
    var n = (el.name || '').toLowerCase();
    var id = (el.id || '').toLowerCase();
    var ph = (el.placeholder || '').toLowerCase();
    var isNic = n.indexOf('cnic')!==-1 || n.indexOf('nic')!==-1 || id.indexOf('cnic')!==-1 || id.indexOf('nic')!==-1 || ph.indexOf('cnic')!==-1 || ph.indexOf('nic')!==-1 || el.getAttribute('maxlength')==='15';
    var isCnicFmt = /^\d{5}-?\d{0,7}-?\d{0,1}$/.test(v.trim()) && norm(v).length >= 4;
    var isFullCnic = /^\d{5}-\d{7}-\d{1}$/.test(v.trim()) || norm(v).length === 13;
    if (isNic || isCnicFmt || isFullCnic || norm(v).length >= 5) {
      var found = findCustomer(v) || DB[0];
      if (found) {
        showPill(el, found);
      }
    } else if (!v && !isNic) {
      if (activePill) { activePill.remove(); activePill = null; }
    }
  }

  document.addEventListener('input', handleBmInput, true);
  document.addEventListener('focusin', handleBmInput, true);
  document.addEventListener('keyup', handleBmInput, true);
  document.addEventListener('paste', handleBmInput, true);
})();
`;

  return `javascript:${encodeURIComponent(rawScript.replace(/\s+/g, ' '))}`;
}

/**
 * Generates robust, complete extension files designed for CFC and ANY web portal
 */
export function generateExtensionFiles(
  appUrl: string,
  customers: Customer[],
  sheetTitle: string
) {
  const manifest = {
    manifest_version: 3,
    name: 'SyncSheet Universal Form AutoFiller (Light)',
    version: '2.2.0',
    description: 'Ultra-light, fast auto-fill for web forms on CFC, NADRA, and any website using your Google Sheet CNIC database.',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_popup: 'popup.html',
      default_title: 'SyncSheet AutoFiller',
    },
    background: {
      service_worker: 'background.js',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['data.js', 'content.js'],
        run_at: 'document_idle',
        all_frames: false, // Prevents duplicate executions in invisible tracking/ad frames!
      },
    ],
  };

  // Pre-bundled database file
  const dataJs = `// Pre-bundled customer registry from SyncSheet & Google Sheet
// Generated at: ${new Date().toISOString()}
const SYNCSHEET_INITIAL_DATA = {
  sheetTitle: ${JSON.stringify(sheetTitle || 'Google Sheet')},
  appUrl: ${JSON.stringify(appUrl || '')},
  customers: ${JSON.stringify(customers, null, 2)}
};
`;

  const backgroundJs = `// SyncSheet AutoFiller Background Service Worker
importScripts('data.js');

// Initialize database in chrome.storage on installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('⚡ SyncSheet Extension Installed/Updated:', details.reason);
  const existing = await chrome.storage.local.get(['syncsheet_customers']);
  
  if (!existing.syncsheet_customers || existing.syncsheet_customers.length === 0 || details.reason === 'install') {
    await chrome.storage.local.set({
      syncsheet_customers: SYNCSHEET_INITIAL_DATA.customers,
      syncsheet_meta: {
        sheetTitle: SYNCSHEET_INITIAL_DATA.sheetTitle,
        appUrl: SYNCSHEET_INITIAL_DATA.appUrl,
        lastUpdated: new Date().toISOString()
      }
    });
    console.log('⚡ Pre-seeded ' + SYNCSHEET_INITIAL_DATA.customers.length + ' customer records!');
  }
});

// Message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_CUSTOMERS') {
    chrome.storage.local.get(['syncsheet_customers', 'syncsheet_meta'], (data) => {
      sendResponse({
        customers: data.syncsheet_customers || SYNCSHEET_INITIAL_DATA.customers,
        meta: data.syncsheet_meta || SYNCSHEET_INITIAL_DATA
      });
    });
    return true;
  } else if (msg.action === 'SAVE_NEW_FIELDS') {
    chrome.storage.local.get(['syncsheet_customers', 'syncsheet_harvest_queue'], async (data) => {
      const customers = data.syncsheet_customers || SYNCSHEET_INITIAL_DATA.customers;
      const targetCnicDigits = (msg.cnic || '').replace(/[^0-9]/g, '');
      const idx = customers.findIndex(c => (c.cnic || '').replace(/[^0-9]/g, '') === targetCnicDigits);

      if (idx !== -1) {
        customers[idx].customFields = {
          ...(customers[idx].customFields || {}),
          ...msg.newFields
        };
      }

      const queue = data.syncsheet_harvest_queue || [];
      queue.push({
        cnic: msg.cnic,
        newFields: msg.newFields,
        url: sender.tab?.url || '',
        timestamp: new Date().toISOString()
      });

      await chrome.storage.local.set({
        syncsheet_customers: customers,
        syncsheet_harvest_queue: queue
      });

      sendResponse({ success: true, count: Object.keys(msg.newFields).length });
    });
    return true;
  } else if (msg.action === 'COLLECT_NEW_CUSTOMER') {
    chrome.storage.local.get(['syncsheet_customers', 'syncsheet_collect_queue', 'syncsheet_meta'], async (data) => {
      const customers = data.syncsheet_customers || SYNCSHEET_INITIAL_DATA.customers || [];
      const newCust = msg.customer || {};
      const targetDigits = (newCust.cnic || '').replace(/[^0-9]/g, '');
      const idx = customers.findIndex(c => (c.cnic || '').replace(/[^0-9]/g, '') === targetDigits);

      let savedRecord;
      if (idx !== -1) {
        customers[idx] = {
          ...customers[idx],
          ...newCust,
          customFields: {
            ...(customers[idx].customFields || {}),
            ...(newCust.customFields || {})
          },
          updatedAt: new Date().toISOString()
        };
        savedRecord = customers[idx];
      } else {
        savedRecord = {
          id: targetDigits || ('cust_' + Date.now()),
          cnic: newCust.cnic || '',
          fullName: newCust.fullName || 'New Customer',
          fatherName: newCust.fatherName || '',
          phone: newCust.phone || '',
          email: newCust.email || '',
          gender: newCust.gender || '',
          dob: newCust.dob || '',
          address: newCust.address || '',
          city: newCust.city || '',
          customFields: newCust.customFields || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncedToSheet: false
        };
        customers.unshift(savedRecord);
      }

      const queue = data.syncsheet_collect_queue || [];
      queue.push({
        customer: savedRecord,
        url: sender.tab?.url || '',
        timestamp: new Date().toISOString()
      });

      await chrome.storage.local.set({
        syncsheet_customers: customers,
        syncsheet_collect_queue: queue
      });

      // If appUrl is available, open or pass through
      const appUrl = (data.syncsheet_meta?.appUrl) || SYNCSHEET_INITIAL_DATA.appUrl;
      if (appUrl) {
        try {
          chrome.tabs.create({
            url: appUrl + '?collect_customer=' + encodeURIComponent(JSON.stringify(savedRecord)),
            active: false
          });
        } catch(e) {}
      }

      sendResponse({ success: true, customer: savedRecord });
    });
    return true;
  }
});
`;

  const contentJs = `// SyncSheet Universal Form AutoFiller - Content Script (v2.2.0 Ultra-Light)
(function() {
  const isTopWindow = (window === window.top);

  let cachedCustomers = (typeof SYNCSHEET_INITIAL_DATA !== 'undefined' && SYNCSHEET_INITIAL_DATA.customers) 
    ? SYNCSHEET_INITIAL_DATA.customers 
    : [];

  try {
    chrome.storage.local.get(['syncsheet_customers'], (res) => {
      if (res && res.syncsheet_customers && res.syncsheet_customers.length > 0) {
        cachedCustomers = res.syncsheet_customers;
      }
    });
  } catch(e) {}

  function norm(str) {
    return (str || '').replace(/[^0-9]/g, '');
  }

  function cleanStr(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function findCustomer(val) {
    if (!val || cachedCustomers.length === 0) return null;
    const digits = norm(val);
    if (digits.length >= 5) {
      for (let i = 0; i < cachedCustomers.length; i++) {
        const cDigits = norm(cachedCustomers[i].cnic);
        if (cDigits === digits || (digits.length >= 13 && cDigits.indexOf(digits) !== -1) || (digits.length >= 5 && digits.length < 13 && cDigits.indexOf(digits) === 0)) {
          return cachedCustomers[i];
        }
      }
    }
    const cleanRaw = val.trim().toLowerCase();
    for (let j = 0; j < cachedCustomers.length; j++) {
      if ((cachedCustomers[j].cnic || '').toLowerCase() === cleanRaw) {
        return cachedCustomers[j];
      }
    }
    return null;
  }

  function deriveLabel(el) {
    if (el.labels && el.labels.length > 0 && el.labels[0].textContent) {
      return el.labels[0].textContent.replace(/[*:]/g, '').trim();
    }
    if (el.id) {
      try {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl && lbl.textContent) return lbl.textContent.replace(/[*:]/g, '').trim();
      } catch(e) {}
    }
    const parent = el.closest('label');
    if (parent && parent.textContent) {
      return parent.textContent.replace(el.value || '', '').replace(/[*:]/g, '').trim();
    }
    const prev = el.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
      return prev.textContent.replace(/[*:]/g, '').trim();
    }
    return el.placeholder || el.getAttribute('aria-label') || el.name || el.id || 'Field';
  }

  // Priority pattern groups
  const patterns = {
    fatherName: ['father_name','fathername','father','guardian_name','guardian','parent','walid','walid_ka_naam','so','do','wo','s_o','d_o','husband_name','husband','txtfathername','txtfather','txtguardian','txtwalid'],
    fullName: ['full_name','fullname','applicant_name','candidate_name','customer_name','citizen_name','first_name','fname','client_name','person_name','txtapplicantname','txtname','user_name','naam','student_name','txt_name','consumer_name'],
    phone: ['phone','mobile','cell','contact','contact_no','whatsapp','tel','cell_no','mobile_no','phone_no','rabta','txtmobileno','txtmobile','txtcontact','txtphone','txtcell'],
    email: ['email','e_mail','mail','email_address','txtemail','emailid'],
    gender: ['gender','sex','jins','ddlgender','rbgender'],
    dob: ['dob','date_of_birth','birth_date','birthday','birth','tareekh_e_paidaish','txtdob','txtdateofbirth'],
    address: ['address','street','residence','residential_address','permanent_address','current_address','mailing_address','pata','house','txtaddress','txtpresentaddress','txtpermanentaddress','present_address','permanent_address'],
    city: ['city','district','town','shehr','zila','domicile_city','ddlcity','ddldistrict','txtcity','txtdistrict'],
    qualification: ['qualification','education','degree','academic','taleem','highest_qualification','ddleducation','ddlqualification','txtqualification'],
    profession: ['profession','designation','job','job_title','occupation','position','pesha','txtoccupation','txtprofession'],
    experienceYears: ['experience','experience_years','exp','years_of_experience','tajruba','txtexperience'],
    skills: ['skills','expertise','competencies','maharaat','txtskills'],
    bio: ['bio','summary','about','remarks','txtremarks'],
    policeStation: ['police_station','policestation','thana','thana_name','police_circle','markaz','pkm_station','sahulat_markaz','txtpolicestation','txtthana','ddlthana','ddlpolicestation','ddl_police_station'],
    motherName: ['mother_name','mothername','walida','walida_ka_naam','walida_name','mother','txtmothername','txtwalida'],
    bloodGroup: ['blood_group','bloodgroup','blood','blood_grp','ddlbloodgroup','txtbloodgroup'],
    drivingLicenseNo: ['driving_license','driving_licence','license_no','licence_no','dl_no','dl_number','license_number','txtlicenseno'],
    vehicleRegNo: ['vehicle_reg','vehicle_reg_no','vehicle_no','registration_no','engine_no','chassis_no','txtvehicleno'],
    emergencyContact: ['emergency_contact','emergency_phone','emergency_no','waris_phone','waris_contact','guardian_phone','txtemergencycontact'],
    firNumber: ['fir_no','fir_number','complaint_no','report_no','loss_report_no','case_no','txtfirno'],
    tehsil: ['tehsil','sub_district','ddltehsil','txttehsil','applicant_tehsil','ddl_tehsil'],
    domicile: ['domicile','domicile_district','applicant_domicile','ddldomicile','txtdomicile','domicile_certificate','ddl_domicile'],
    maritalStatus: ['marital_status','maritalstatus','marriage_status','shadi_shuda','ddlmaritalstatus']
  };

  // Safe setter with anti-recursion flag
  let isAutofilling = false;

  function setFieldValue(el, val) {
    if (!el || val === undefined || val === null) return;

    if (el.tagName === 'SELECT') {
      const lowerVal = String(val).trim().toLowerCase();
      let found = false;
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        const optVal = opt.value.trim().toLowerCase();
        const optText = opt.text.trim().toLowerCase();
        if (optVal === lowerVal || optText === lowerVal || (lowerVal.length > 2 && optText.includes(lowerVal))) {
          el.selectedIndex = i;
          opt.selected = true;
          el.value = opt.value;
          found = true;
          break;
        }
      }
      if (!found && (lowerVal === 'male' || lowerVal === 'm')) {
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].value === '1' || el.options[i].value.toLowerCase() === 'm' || el.options[i].text.toLowerCase().startsWith('m')) {
            el.selectedIndex = i;
            el.value = el.options[i].value;
            found = true;
            break;
          }
        }
      }
      if (!found && (lowerVal === 'female' || lowerVal === 'f')) {
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].value === '2' || el.options[i].value.toLowerCase() === 'f' || el.options[i].text.toLowerCase().startsWith('f')) {
            el.selectedIndex = i;
            el.value = el.options[i].value;
            found = true;
            break;
          }
        }
      }
    } else if (el.type === 'radio' || el.type === 'checkbox') {
      const lval = String(val).trim().toLowerCase();
      if (el.value.toLowerCase() === lval || lval === 'true' || lval === 'yes' || lval === '1') {
        el.checked = true;
      }
    } else {
      let finalVal = String(val);
      if (el.type === 'date' && finalVal) {
        const parts = finalVal.split(/[-/]/);
        if (parts.length === 3 && parts[2].length === 4) {
          finalVal = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
      }

      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, finalVal);
      } else {
        el.value = finalVal;
      }
    }

    // Dispatch events flagged with __syncsheet to prevent recursive input listener loops!
    try {
      const ev = new Event('input', { bubbles: true });
      ev.__syncsheet = true;
      el.dispatchEvent(ev);
    } catch(e) {}

    try {
      const chg = new Event('change', { bubbles: true });
      chg.__syncsheet = true;
      el.dispatchEvent(chg);
    } catch(e) {}

    el.style.outline = '2px solid #10b981';
    el.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
    setTimeout(() => {
      el.style.outline = '';
      el.style.backgroundColor = '';
    }, 2500);
  }

  let lastFilledCustomer = null;
  let lastUnmappedFields = {};

  function autofillFormWithCustomer(customer) {
    if (!customer || isAutofilling) return 0;
    isAutofilling = true;

    try {
      lastFilledCustomer = customer;
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
      let filled = 0;
      lastUnmappedFields = {};

      // 1. Check for 3-part CNIC fields (CFC / NADRA portals)
      const cnicDigits = norm(customer.cnic);
      const cnicPartInputs = [];
      inputs.forEach(el => {
        if (el.closest('#syncsheet-dock-container') || el.closest('#syncsheet-detect-pill')) return;
        const id = cleanStr(el.id);
        const n = cleanStr(el.name);
        if (id.includes('cnic') || n.includes('cnic') || id.includes('nic') || n.includes('nic')) {
          const maxLen = el.getAttribute('maxlength');
          if (maxLen === '5' || id.includes('1') || n.includes('1') || id.includes('part1')) {
            cnicPartInputs[0] = el;
          } else if (maxLen === '7' || id.includes('2') || n.includes('2') || id.includes('part2')) {
            cnicPartInputs[1] = el;
          } else if (maxLen === '1' || id.includes('3') || n.includes('3') || id.includes('part3')) {
            cnicPartInputs[2] = el;
          }
        }
      });

      if (cnicPartInputs[0] && cnicPartInputs[1] && cnicPartInputs[2] && cnicDigits.length >= 13) {
        setFieldValue(cnicPartInputs[0], cnicDigits.slice(0, 5));
        setFieldValue(cnicPartInputs[1], cnicDigits.slice(5, 12));
        setFieldValue(cnicPartInputs[2], cnicDigits.slice(12, 13));
        filled += 3;
      }

      inputs.forEach(el => {
        if (el.closest('#syncsheet-dock-container') || el.closest('#syncsheet-detect-pill')) return;
        if (cnicPartInputs.includes(el)) return;

        const n = cleanStr(el.name);
        const id = cleanStr(el.id);
        const ph = cleanStr(el.placeholder);
        const lbl = cleanStr(deriveLabel(el));
        const tokens = [n, id, ph, lbl].filter(Boolean);

        let matchedKey = null;

        const isCnic = tokens.some(t => t.includes('cnic') || t.includes('nic') || t.includes('national_id') || t.includes('identity_no') || t.includes('shanakht') || t.includes('txtcnic'));
        if (isCnic) {
          matchedKey = 'cnic';
        } else {
          for (let k in patterns) {
            if (k === 'fullName') {
              const isFather = tokens.some(t => t.includes('father') || t.includes('walid') || t.includes('guardian') || t.includes('husband') || t.includes('parent'));
              if (isFather) continue;
            }

            for (let t of tokens) {
              if (patterns[k].some(p => t === p || t.includes(p) || (p.length > 3 && p.includes(t)))) {
                matchedKey = k;
                break;
              }
            }
            if (matchedKey) break;
          }
        }

        // Check custom fields
        if (!matchedKey && customer.customFields) {
          for (let cf in customer.customFields) {
            const cleanCf = cleanStr(cf);
            for (let t2 of tokens) {
              if (t2.includes(cleanCf) || cleanCf.includes(t2)) {
                matchedKey = cf;
                break;
              }
            }
            if (matchedKey) break;
          }
        }

        let targetVal = null;
        if (matchedKey === 'cnic') {
          const maxLen = el.getAttribute('maxlength');
          targetVal = (maxLen && parseInt(maxLen) <= 13) ? norm(customer.cnic) : customer.cnic;
        } else if (matchedKey) {
          targetVal = customer[matchedKey] || (customer.customFields && customer.customFields[matchedKey]);
        }

        if (targetVal) {
          setFieldValue(el, targetVal);
          filled++;
        } else if (el.value && el.value.trim().length > 0 && !matchedKey) {
          const rawLbl = deriveLabel(el);
          const cleanK = cleanStr(rawLbl);
          const isStd = ['cnic','full_name','father_name','mobile','email','gender','dob','address','city'].some(k => cleanK.includes(k));
          if (!isStd && (!customer.customFields || !customer.customFields[rawLbl])) {
            lastUnmappedFields[rawLbl] = el.value.trim();
          }
        }
      });

      // Update feedback in dock if present
      updateDockState(customer, filled);

      return filled;
    } finally {
      isAutofilling = false;
    }
  }

  // --- SMART CNIC DETECTION PILL (Requested by user) ---
  let detectDebounceTimer = null;
  let activePillEl = null;

  function showCnicDetectPill(inputEl, customer, typedVal) {
    if (!inputEl) return;
    const targetCust = customer || cachedCustomers[0];
    if (!targetCust && cachedCustomers.length === 0) return;
    if (activePillEl) activePillEl.remove();

    const rect = inputEl.getBoundingClientRect();
    const pill = document.createElement('div');
    pill.id = 'syncsheet-detect-pill';
    pill.style.cssText = 'position:fixed !important;z-index:2147483647 !important;font-family:system-ui,-apple-system,sans-serif !important;background:#0f172a !important;color:#fff !important;border:2px solid #10b981 !important;border-radius:12px !important;padding:8px 12px !important;box-shadow:0 12px 35px rgba(0,0,0,0.8) !important;font-size:12px !important;display:flex !important;align-items:center !important;gap:8px !important;';

    const topPos = (rect.bottom + 6 + 45 > window.innerHeight) ? Math.max(10, rect.top - 50) : (rect.bottom + 6);
    const leftPos = Math.max(10, Math.min(rect.left, window.innerWidth - 340));
    pill.style.top = topPos + 'px';
    pill.style.left = leftPos + 'px';

    const labelText = targetCust ? ('Found: ' + targetCust.fullName) : 'AutoFill NIC Form';
    const cnicText = targetCust ? ('CNIC: ' + targetCust.cnic) : (typedVal || 'Sheet Ready');

    pill.innerHTML = 
      '<span style="font-size:14px;color:#10b981;font-weight:bold;">⚡</span>' +
      '<div>' +
        '<div style="font-weight:bold;color:#10b981;font-size:11px;">' + labelText + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;font-family:monospace;">' + cnicText + '</div>' +
      '</div>' +
      '<button id="ss-pill-fill-btn" style="background:#10b981 !important;border:none !important;color:#0f172a !important;font-weight:bold !important;padding:6px 12px !important;border-radius:6px !important;cursor:pointer !important;font-size:11px !important;margin-left:4px !important;">⚡ 1-Click Fill</button>' +
      '<button id="ss-pill-collect-btn" style="background:#0284c7 !important;border:none !important;color:#fff !important;font-weight:bold !important;padding:6px 10px !important;border-radius:6px !important;cursor:pointer !important;font-size:11px !important;margin-left:2px !important;">📥 Save to Sheet</button>' +
      '<button id="ss-pill-close-btn" style="background:transparent !important;border:none !important;color:#94a3b8 !important;font-size:16px !important;cursor:pointer !important;padding:0 4px !important;">&times;</button>';

    document.body.appendChild(pill);
    activePillEl = pill;

    document.getElementById('ss-pill-fill-btn').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      autofillFormWithCustomer(targetCust);
      pill.remove();
      activePillEl = null;
    };

    document.getElementById('ss-pill-collect-btn').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      collectFormAndSaveToSheet();
      pill.remove();
      activePillEl = null;
    };

    document.getElementById('ss-pill-close-btn').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      pill.remove();
      activePillEl = null;
    };

    setTimeout(() => {
      if (pill && pill.parentNode) pill.remove();
      if (activePillEl === pill) activePillEl = null;
    }, 15000);
  }

  function handleInputEvent(e) {
    if (isAutofilling) return; // Prevent loop!
    if (e.__syncsheet) return; // Ignore synthetic events!
    if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) return;
    if (e.target.closest('#syncsheet-dock-container') || e.target.closest('#syncsheet-dock-taskbar') || e.target.closest('#syncsheet-detect-pill')) return;

    clearTimeout(detectDebounceTimer);
    detectDebounceTimer = setTimeout(() => {
      const el = e.target;
      const val = el.value || '';
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const ph = (el.placeholder || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const tokens = [name, id, ph, aria].join(' ');

      const isNicField = tokens.includes('cnic') || tokens.includes('nic') || tokens.includes('identity') || tokens.includes('shanakht') || tokens.includes('national_id') || tokens.includes('id_card') || tokens.includes('b_form') || el.getAttribute('maxlength') === '15';
      const digits = norm(val);
      const isCnicPattern = /^\d{5}-?\d{0,7}-?\d{0,1}$/.test(val.trim()) && digits.length >= 4;
      const isFormattedCnic = /^\d{5}-\d{7}-\d{1}$/.test(val.trim());

      if (isNicField || isCnicPattern || isFormattedCnic || digits.length >= 4) {
        let match = findCustomer(val);
        if (!match && cachedCustomers.length > 0) {
          match = cachedCustomers[0];
        }
        if (match) {
          showCnicDetectPill(el, match, val);
        }
      } else if (!val && !isNicField) {
        if (activePillEl) { activePillEl.remove(); activePillEl = null; }
      }
    }, 150);
  }

  document.addEventListener('input', handleInputEvent, true);
  document.addEventListener('focusin', handleInputEvent, true);
  document.addEventListener('keyup', handleInputEvent, true);
  document.addEventListener('paste', handleInputEvent, true);
  document.addEventListener('change', handleInputEvent, true);

  // --- FLOATING TRIGGER & DOCK (TOP WINDOW ONLY) ---
  let dockMsgEl = null;
  let dockNewFieldsArea = null;
  let dockNewFieldsList = null;

  function updateDockState(customer, filledCount) {
    if (!dockMsgEl) return;
    dockMsgEl.innerHTML = '<span style="color:#10b981;font-weight:bold;">✓ Filled ' + filledCount + ' fields for ' + customer.fullName + '!</span>';

    const newKeys = Object.keys(lastUnmappedFields);
    if (dockNewFieldsArea && dockNewFieldsList) {
      if (newKeys.length > 0) {
        dockNewFieldsList.innerHTML = newKeys.map(k => '• <b>' + k + '</b>: ' + lastUnmappedFields[k]).join('<br/>');
        dockNewFieldsArea.style.display = 'block';
      } else {
        dockNewFieldsArea.style.display = 'none';
      }
    }
  }

  function injectFloatingAssistant() {
    if (!isTopWindow) return; // Only in top window!
    if (document.getElementById('syncsheet-dock-container')) return;

    const parent = document.body || document.documentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.id = 'syncsheet-dock-container';
    container.style.cssText = 'position:fixed !important;bottom:20px !important;right:20px !important;z-index:2147483647 !important;font-family:system-ui,-apple-system,sans-serif !important;font-size:12px !important;';

    const bubble = document.createElement('button');
    bubble.id = 'syncsheet-trigger-bubble';
    bubble.style.cssText = 'background:linear-gradient(135deg, #059669, #0284c7) !important;color:#fff !important;border:2px solid #ffffff !important;border-radius:30px !important;box-shadow:0 8px 30px rgba(0,0,0,0.6) !important;padding:8px 16px !important;display:flex !important;align-items:center !important;gap:8px !important;cursor:pointer !important;font-weight:bold !important;font-size:12px !important;outline:none !important;';
    bubble.innerHTML = '<span style="background:rgba(255,255,255,0.3);border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">⚡</span><span>AutoFill Form</span><span style="background:#0f172a;color:#38bdf8;padding:2px 6px;border-radius:10px;font-size:10px;font-family:monospace;">' + cachedCustomers.length + ' in Sheet</span>';

    const dock = document.createElement('div');
    dock.id = 'syncsheet-floating-dock';
    dock.style.cssText = 'display:none;background:#0f172a !important;color:#fff !important;border:2px solid #38bdf8 !important;border-radius:14px !important;box-shadow:0 20px 50px rgba(0,0,0,0.85) !important;padding:14px !important;width:340px !important;box-sizing:border-box !important;margin-bottom:8px !important;';

    dock.innerHTML = 
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #1e293b;padding-bottom:6px;">' +
        '<div style="font-weight:bold;color:#10b981;font-size:13px;display:flex;align-items:center;gap:6px;">⚡ SyncSheet AutoFiller</div>' +
        '<div style="display:flex;gap:4px;align-items:center;">' +
          '<button id="ss-dock-taskbar-btn" style="background:#0284c7;border:none;color:#fff;font-size:10px;padding:3px 7px;border-radius:4px;cursor:pointer;font-weight:bold;" title="Minimize to Taskbar">━ Taskbar</button>' +
          '<button id="ss-dock-close" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0 4px;">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Sheet records: <b>' + cachedCustomers.length + ' ready</b></div>' +
      '<select id="ss-dock-select" style="width:100%;padding:7px;border-radius:8px;background:#1e293b;color:#fff;border:1px solid #475569;margin-bottom:8px;font-size:11px;outline:none;">' +
        '<option value="">-- Choose Customer to AutoFill --</option>' +
        cachedCustomers.map(c => '<option value="' + c.cnic + '">' + c.cnic + ' - ' + c.fullName + '</option>').join('') +
      '</select>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
        '<input id="ss-dock-cnic" placeholder="Search or Type CNIC (xxxxx-xxxxxxx-x)..." style="flex:1;padding:7px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff !important;color:#000000 !important;font-weight:600 !important;font-size:11px;font-family:monospace;outline:none;" />' +
        '<button id="ss-dock-fill-btn" style="background:#10b981;border:none;color:#0f172a;font-weight:bold;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11px;">Fill Form</button>' +
      '</div>' +
      '<button id="ss-dock-collect-btn" style="width:100%;background:#0284c7;border:none;color:#fff;font-weight:bold;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;" title="Collect & Save new form data entered on this website to Google Sheet before submitting">📥 Save Form Data to Google Sheet</button>' +
      '<div id="ss-dock-msg" style="font-size:11px;color:#cbd5e1;padding:6px;background:#1e293b;border-radius:6px;margin-bottom:6px;">Type CNIC anywhere on page or click above to fill!</div>' +
      '<div id="ss-dock-new-fields" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #334155;">' +
        '<div style="color:#facc15;font-weight:bold;font-size:11px;margin-bottom:4px;">✨ New Form Fields to Map under this CNIC:</div>' +
        '<div id="ss-dock-new-fields-list" style="font-size:10px;color:#cbd5e1;margin-bottom:6px;max-height:80px;overflow-y:auto;"></div>' +
        '<button id="ss-dock-save-btn" style="width:100%;background:#0284c7;color:#fff;border:none;padding:7px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:11px;">Save New Fields to Google Sheet under this CNIC</button>' +
      '</div>';

    // Docked Taskbar element across bottom edge
    const taskbar = document.createElement('div');
    taskbar.id = 'syncsheet-dock-taskbar';
    taskbar.style.cssText = 'display:none;position:fixed !important;bottom:0 !important;left:0 !important;right:0 !important;background:#0f172a !important;border-top:2px solid #10b981 !important;color:#fff !important;padding:8px 16px !important;z-index:2147483647 !important;box-shadow:0 -5px 25px rgba(0,0,0,0.8) !important;font-family:system-ui,sans-serif !important;font-size:12px !important;align-items:center !important;justify-content:space-between !important;gap:10px !important;box-sizing:border-box !important;';
    taskbar.innerHTML = 
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="background:#10b981;color:#0f172a;width:20px;height:20px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;">⚡</span>' +
        '<span style="font-weight:bold;color:#fff;">AutoFill Taskbar</span>' +
        '<span style="color:#94a3b8;font-size:11px;">(' + cachedCustomers.length + ' in Sheet)</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex:1;max-width:440px;">' +
        '<input id="ss-tb-cnic" placeholder="Search or Type CNIC (xxxxx-xxxxxxx-x)..." style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff !important;color:#000000 !important;font-weight:600 !important;font-size:11px;outline:none;" />' +
        '<select id="ss-tb-select" style="padding:6px;border-radius:6px;background:#1e293b;color:#fff;border:1px solid #475569;font-size:11px;outline:none;max-width:180px;">' +
          '<option value="">-- Choose Customer --</option>' +
          cachedCustomers.map(c => '<option value="' + c.cnic + '">' + c.cnic + ' - ' + c.fullName + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button id="ss-tb-fill-btn" style="background:#10b981;border:none;color:#0f172a;padding:6px 12px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">⚡ Fill Form</button>' +
        '<button id="ss-tb-collect-btn" style="background:#0284c7;border:none;color:#fff;padding:6px 10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:4px;" title="Collect & Save new form data entered on this website to Google Sheet before submitting">📥 Save Form to Sheet</button>' +
        '<button id="ss-tb-expand-btn" style="background:#334155;border:none;color:#fff;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;" title="Expand to Window">⤢</button>' +
        '<button id="ss-tb-close-btn" style="background:#dc2626;border:none;color:#fff;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;">&times;</button>' +
      '</div>';

    container.appendChild(dock);
    container.appendChild(bubble);
    parent.appendChild(container);
    parent.appendChild(taskbar);

    dockMsgEl = document.getElementById('ss-dock-msg');
    dockNewFieldsArea = document.getElementById('ss-dock-new-fields');
    dockNewFieldsList = document.getElementById('ss-dock-new-fields-list');

    bubble.onclick = () => {
      dock.style.display = dock.style.display === 'none' ? 'block' : 'none';
    };

    document.getElementById('ss-dock-close').onclick = () => {
      dock.style.display = 'none';
    };

    document.getElementById('ss-dock-taskbar-btn').onclick = () => {
      dock.style.display = 'none';
      bubble.style.display = 'none';
      taskbar.style.display = 'flex';
    };

    document.getElementById('ss-tb-expand-btn').onclick = () => {
      taskbar.style.display = 'none';
      bubble.style.display = 'flex';
      dock.style.display = 'block';
    };

    document.getElementById('ss-tb-close-btn').onclick = () => {
      taskbar.style.display = 'none';
      bubble.style.display = 'flex';
    };

    document.getElementById('ss-tb-select').onchange = (e) => {
      const cnicVal = e.target.value;
      if (cnicVal) {
        document.getElementById('ss-tb-cnic').value = cnicVal;
        const cust = findCustomer(cnicVal);
        if (cust) autofillFormWithCustomer(cust);
      }
    };

    document.getElementById('ss-tb-fill-btn').onclick = () => {
      const val = document.getElementById('ss-tb-cnic').value || document.getElementById('ss-tb-select').value;
      const cust = findCustomer(val) || cachedCustomers[0];
      if (cust) {
        autofillFormWithCustomer(cust);
      }
    };

    function collectFormAndSaveToSheet() {
      const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
      const collected = {};
      let count = 0;
      let foundCnic = '';
      let foundName = '';

      allInputs.forEach(el => {
        if (el.closest('#syncsheet-dock-container') || el.closest('#syncsheet-dock-taskbar') || el.closest('#syncsheet-detect-pill')) return;
        const v = el.value ? el.value.trim() : '';
        if (!v) return;
        const name = cleanStr(el.name);
        const id = cleanStr(el.id);
        const ph = cleanStr(el.placeholder);
        const str = [name, id, ph].join(' ');

        if (str.includes('cnic') || str.includes('nic') || str.includes('shanakht') || str.includes('identity')) {
          foundCnic = v;
        } else if (!str.includes('father') && !str.includes('guardian') && (str.includes('name') || str.includes('applicant'))) {
          foundName = v;
        }

        const label = deriveLabel(el) || ('Field_' + (count + 1));
        collected[label] = v;
        count++;
      });

      if (count === 0) {
        alert('⚠️ No filled form fields found! Please fill in the applicant details on this form first, then click Save Form to Sheet.');
        return;
      }

      if (!foundCnic) {
        foundCnic = prompt('📥 Found ' + count + ' filled form fields!\nEnter CNIC (xxxxx-xxxxxxx-x) to save this person under in your Google Sheet:', '');
        if (!foundCnic) return;
      }

      const payload = {
        cnic: foundCnic,
        fullName: foundName || 'New Customer',
        customFields: collected
      };

      if (dockMsgEl) {
        dockMsgEl.innerHTML = '<span style="color:#38bdf8;font-weight:bold;">✓ Collected ' + count + ' fields for CNIC ' + foundCnic + '! Saving to Google Sheet...</span>';
      }

      try {
        chrome.runtime.sendMessage({ action: 'COLLECT_NEW_CUSTOMER', customer: payload }, (res) => {
          alert('✓ Successfully saved ' + count + ' fields for CNIC ' + foundCnic + ' to your Google Sheet!');
        });
      } catch (e) {
        const appUrl = (typeof SYNCSHEET_INITIAL_DATA !== 'undefined' && SYNCSHEET_INITIAL_DATA.appUrl) ? SYNCSHEET_INITIAL_DATA.appUrl : '';
        if (appUrl) {
          window.open(appUrl + '?collect_customer=' + encodeURIComponent(JSON.stringify(payload)), '_blank');
        }
      }
    }

    if (document.getElementById('ss-dock-collect-btn')) {
      document.getElementById('ss-dock-collect-btn').onclick = collectFormAndSaveToSheet;
    }
    if (document.getElementById('ss-tb-collect-btn')) {
      document.getElementById('ss-tb-collect-btn').onclick = collectFormAndSaveToSheet;
    }

    const saveBtn = document.getElementById('ss-dock-save-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        if (!lastFilledCustomer || Object.keys(lastUnmappedFields).length === 0) return;
        saveBtn.innerText = 'Saving to Sheet...';
        try {
          chrome.runtime.sendMessage({
            action: 'SAVE_NEW_FIELDS',
            cnic: lastFilledCustomer.cnic,
            newFields: lastUnmappedFields
          }, (res) => {
            saveBtn.innerText = '✓ Saved to Google Sheet under CNIC ' + lastFilledCustomer.cnic;
            saveBtn.style.background = '#10b981';
          });
        } catch(e) {
          const appUrl = (typeof SYNCSHEET_INITIAL_DATA !== 'undefined' && SYNCSHEET_INITIAL_DATA.appUrl) ? SYNCSHEET_INITIAL_DATA.appUrl : '';
          if (appUrl) {
            window.open(appUrl + '?harvest_cnic=' + encodeURIComponent(lastFilledCustomer.cnic) + '&harvest_fields=' + encodeURIComponent(JSON.stringify(lastUnmappedFields)), '_blank');
          }
          saveBtn.innerText = '✓ Sent to SyncSheet Google Sheet!';
          saveBtn.style.background = '#10b981';
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFloatingAssistant);
  } else {
    injectFloatingAssistant();
  }

  // Listen for messages from extension popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'AUTOFILL_CNIC') {
      const match = findCustomer(msg.cnic) || msg.customer || cachedCustomers[0];
      if (match) {
        const count = autofillFormWithCustomer(match);
        sendResponse({ success: true, count, customerName: match.fullName });
      } else {
        sendResponse({ success: false, error: 'Customer not found' });
      }
    } else if (msg.action === 'SET_CUSTOMERS') {
      if (msg.customers) cachedCustomers = msg.customers;
      sendResponse({ success: true, count: cachedCustomers.length });
    } else if (msg.action === 'COLLECT_FORM_DATA') {
      collectFormAndSaveToSheet();
      sendResponse({ success: true, count: 1 });
    }
  });
})();
`;

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SyncSheet AutoFiller</title>
  <style>
    * { box-sizing: border-box; }
    body { width: 330px; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #fff; margin: 0; padding: 14px; font-size: 12px; }
    h1 { font-size: 14px; margin: 0 0 2px 0; color: #10b981; display: flex; align-items: center; gap: 6px; }
    .sheet-badge { font-size: 11px; color: #94a3b8; margin-bottom: 12px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    label { display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px; }
    input, select, button { width: 100%; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 8px; }
    input { background: #ffffff !important; border: 1px solid #cbd5e1 !important; color: #000000 !important; font-family: monospace; font-weight: 600; }
    input::placeholder { color: #64748b !important; }
    select { background: #1e293b; border: 1px solid #475569; color: #fff; font-family: inherit; }
    button { background: #10b981; border: none; color: #fff; font-weight: bold; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #059669; }
    button.primary { background: #10b981; font-size: 13px; padding: 10px; }
    button.secondary { background: #0284c7; font-size: 11px; padding: 8px; }
    button.secondary:hover { background: #0369a1; }
    .status { background: #1e293b; padding: 8px; border-radius: 6px; font-size: 11px; color: #cbd5e1; border-left: 3px solid #10b981; }
    .records-list { max-height: 120px; overflow-y: auto; font-size: 11px; margin-top: 6px; }
    .record-item { padding: 4px 6px; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; border-bottom: 1px solid #334155; }
    .record-item:hover { background: #334155; }
  </style>
</head>
<body>
  <h1><span>⚡</span> SyncSheet AutoFiller</h1>
  <div class="sheet-badge">Sheet: <b id="sheet-title">${sheetTitle || 'Connected'}</b> (<span id="record-count">${customers.length}</span> records)</div>

  <div class="card">
    <label for="customer-select">Select Customer from Database:</label>
    <select id="customer-select">
      <option value="">-- Choose Customer --</option>
    </select>

    <label for="cnic-input">Or Type CNIC / NIC:</label>
    <input id="cnic-input" placeholder="e.g. 35201-1234567-1" />

    <button id="autofill-btn" class="primary">⚡ Auto-Fill This Page (All Frames)</button>
    <button id="collect-btn" class="secondary" title="Save new data entered in this form to Google Sheet before submitting">📥 Save Current Form to Google Sheet</button>
  </div>

  <div id="status" class="status">Works on CFC, NADRA &amp; any form portal. Click above or type CNIC!</div>

  <div class="card" style="margin-top:10px;">
    <div style="font-weight:600;font-size:11px;color:#94a3b8;margin-bottom:4px;">Quick Click Customers:</div>
    <div id="records-list" class="records-list"></div>
  </div>

  <script src="data.js"></script>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `// SyncSheet AutoFiller Popup Script (v2.1.0)
document.addEventListener('DOMContentLoaded', async () => {
  const selectEl = document.getElementById('customer-select');
  const cnicInput = document.getElementById('cnic-input');
  const autofillBtn = document.getElementById('autofill-btn');
  const statusEl = document.getElementById('status');
  const recordCountEl = document.getElementById('record-count');
  const recordsListEl = document.getElementById('records-list');

  let customers = (typeof SYNCSHEET_INITIAL_DATA !== 'undefined' && SYNCSHEET_INITIAL_DATA.customers) 
    ? SYNCSHEET_INITIAL_DATA.customers 
    : [];

  try {
    const stored = await chrome.storage.local.get(['syncsheet_customers']);
    if (stored && stored.syncsheet_customers && stored.syncsheet_customers.length > 0) {
      customers = stored.syncsheet_customers;
    }
  } catch(e) {}

  recordCountEl.innerText = customers.length;

  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.cnic;
    opt.innerText = c.cnic + ' - ' + c.fullName;
    selectEl.appendChild(opt);

    const item = document.createElement('div');
    item.className = 'record-item';
    item.innerHTML = '<span style="font-family:monospace;color:#38bdf8;">' + c.cnic + '</span><span>' + c.fullName.split(' ')[0] + '</span>';
    item.onclick = () => {
      cnicInput.value = c.cnic;
      selectEl.value = c.cnic;
      triggerAutofill(c);
    };
    recordsListEl.appendChild(item);
  });

  selectEl.addEventListener('change', () => {
    if (selectEl.value) {
      cnicInput.value = selectEl.value;
    }
  });

  async function triggerAutofill(targetCustomer) {
    statusEl.innerHTML = 'Connecting to web form...';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        statusEl.innerHTML = '<span style="color:#f87171;">Cannot access active tab.</span>';
        return;
      }

      // Send to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'AUTOFILL_CNIC',
        cnic: targetCustomer ? targetCustomer.cnic : cnicInput.value,
        customer: targetCustomer
      }, (res) => {
        if (chrome.runtime.lastError) {
          statusEl.innerHTML = '<span style="color:#f87171;">Tip: Please refresh the web page once and try again!</span>';
        } else if (res && res.success) {
          statusEl.innerHTML = '<span style="color:#10b981;font-weight:bold;">✓ Filled ' + res.count + ' fields for ' + (res.customerName || 'customer') + '!</span>';
        } else {
          statusEl.innerHTML = '<span style="color:#f87171;">' + (res?.error || 'Form filled!') + '</span>';
        }
      });
    } catch(err) {
      statusEl.innerHTML = '<span style="color:#f87171;">Error: ' + err.message + '</span>';
    }
  }

  autofillBtn.addEventListener('click', () => {
    const cnicVal = (cnicInput.value || selectEl.value || '').replace(/[^0-9]/g, '');
    let match = null;
    if (cnicVal) {
      match = customers.find(c => (c.cnic || '').replace(/[^0-9]/g, '') === cnicVal);
    }
    triggerAutofill(match || customers[0]);
  });

  const collectBtn = document.getElementById('collect-btn');
  if (collectBtn) {
    collectBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          statusEl.innerHTML = '<span style="color:#f87171;">Cannot access active tab.</span>';
          return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'COLLECT_FORM_DATA' }, (res) => {
          if (chrome.runtime.lastError) {
            statusEl.innerHTML = '<span style="color:#f87171;">Tip: Refresh the webpage once, then click Save Form.</span>';
          } else if (res && res.success) {
            statusEl.innerHTML = '<span style="color:#10b981;font-weight:bold;">✓ Collected and saved to Google Sheet!</span>';
          }
        });
      } catch (e) {
        statusEl.innerHTML = '<span style="color:#f87171;">Error: ' + e.message + '</span>';
      }
    });
  }
});
`;

  const readmeMd = `# SyncSheet Universal Form AutoFiller (Chrome / Edge Extension v2.1.0)

Built specifically for Pakistani Citizen Facilitation Centers (CFC), NADRA forms, job portals, and global web applications.

## How to Install (1 Minute):
1. Extract \`syncsheet-autofiller-v2.zip\`.
2. Open Chrome or Edge and go to:
   - Chrome: \`chrome://extensions\`
   - Edge: \`edge://extensions\`
3. Turn ON **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** in the top-left corner and select your extracted folder.
5. If you already had an older version loaded, click the **↻ Reload** button on the extension card.

## How to Use on CFC or Any Portal:
1. Visit any CFC portal or web form.
2. Type or paste your CNIC: all remaining fields (Full Name, Father Name, Phone, Email, Address, Education, etc.) are filled automatically!
3. Alternatively, click the floating **⚡ SyncSheet** button at the bottom-right of the page to fill in 1 click!
`;

  return {
    manifest: JSON.stringify(manifest, null, 2),
    dataJs,
    backgroundJs,
    contentJs,
    popupHtml,
    popupJs,
    readmeMd,
  };
}
