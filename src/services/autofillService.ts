import { Customer, DetectedField } from '../types';
import { normalizeCnic, formatCnic } from './sheetsService';

// Standard mapping aliases for fuzzy matching web form fields
export const FIELD_PATTERNS: Record<string, string[]> = {
  cnic: [
    'cnic', 'nic', 'c_nic', 'national_id', 'id_card', 'identity_no', 'identity_card',
    'id_number', 'citizen_id', 'nadra_id', 'idcard', 'nationalid'
  ],
  fullName: [
    'full_name', 'fullname', 'name', 'applicant_name', 'candidate_name', 'customer_name',
    'first_name', 'fname', 'client_name', 'person_name', 'txt_name', 'user_name'
  ],
  fatherName: [
    'father_name', 'fathername', 'father', 'guardian_name', 'guardian', 'parent_name',
    'parent', 'so', 'do', 'wo', 'husband_name'
  ],
  phone: [
    'phone', 'mobile', 'cell', 'cellphone', 'telephone', 'contact', 'contact_no',
    'phone_number', 'mobile_no', 'whatsapp', 'tel'
  ],
  email: [
    'email', 'e_mail', 'email_address', 'mail', 'user_email', 'contact_email'
  ],
  gender: [
    'gender', 'sex'
  ],
  dob: [
    'dob', 'date_of_birth', 'birth_date', 'birthdate', 'dateofbirth', 'birthday'
  ],
  address: [
    'address', 'street', 'residence', 'residential_address', 'permanent_address',
    'current_address', 'street_address', 'mailing_address', 'house', 'addr'
  ],
  city: [
    'city', 'district', 'town', 'tehsil', 'division', 'municipality', 'domicile_city'
  ],
  qualification: [
    'qualification', 'education', 'degree', 'highest_qualification', 'academic',
    'major', 'university', 'college', 'last_degree'
  ],
  profession: [
    'profession', 'designation', 'job', 'job_title', 'occupation', 'role',
    'current_job', 'position', 'employment'
  ],
  experienceYears: [
    'experience', 'experience_years', 'years_of_experience', 'exp_years',
    'total_experience', 'exp'
  ],
  skills: [
    'skills', 'competencies', 'technical_skills', 'expertise', 'key_skills'
  ],
  bio: [
    'bio', 'summary', 'about', 'description', 'objective', 'profile_summary',
    'cover_letter', 'remarks'
  ]
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
 * Derives a clean human-readable label from an element's attributes
 */
export function deriveFieldLabel(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  // 1. Check associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label && label.textContent) {
      return label.textContent.replace(/[*:]/g, '').trim();
    }
  }

  // 2. Check closest label
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    return parentLabel.textContent.replace(/[*:]/g, '').trim();
  }

  // 3. Check placeholder, aria-label, name, or id
  const placeholderText = 'placeholder' in element ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder : '';
  const raw =
    element.getAttribute('aria-label') ||
    placeholderText ||
    element.name ||
    element.id ||
    'Custom Field';

  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim();
}

/**
 * Determines which customer field a form input corresponds to
 */
export function matchInputToCustomerField(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  existingCustomFields: Record<string, string> = {}
): { fieldKey: string | null; isStandard: boolean; isCustom: boolean } {
  const name = cleanFieldName(element.name || '');
  const id = cleanFieldName(element.id || '');
  const placeholderText = 'placeholder' in element ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder : '';
  const placeholder = cleanFieldName(placeholderText || '');
  const ariaLabel = cleanFieldName(element.getAttribute('aria-label') || '');

  const tokens = [name, id, placeholder, ariaLabel].filter(Boolean);

  // 1. Check standard fields
  for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const token of tokens) {
      if (patterns.some((p) => token.includes(p) || p.includes(token))) {
        return { fieldKey: key, isStandard: true, isCustom: false };
      }
    }
  }

  // 2. Check existing custom fields
  const customKeys = Object.keys(existingCustomFields);
  for (const cKey of customKeys) {
    const cleanCKey = cleanFieldName(cKey);
    for (const token of tokens) {
      if (token.includes(cleanCKey) || cleanCKey.includes(token)) {
        return { fieldKey: cKey, isStandard: false, isCustom: true };
      }
    }
  }

  return { fieldKey: null, isStandard: false, isCustom: false };
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
    const { fieldKey, isStandard, isCustom } = matchInputToCustomerField(
      input,
      customer.customFields || {}
    );

    let targetValue: string | undefined;

    if (fieldKey && isStandard) {
      targetValue = (customer as any)[fieldKey];
    } else if (fieldKey && isCustom) {
      targetValue = customer.customFields?.[fieldKey];
    }

    if (targetValue !== undefined && targetValue !== '') {
      // Set value and trigger native events
      input.value = targetValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      // Add temporary highlight
      input.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/40');
      setTimeout(() => {
        input.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/40');
      }, 3000);

      filledCount++;
    } else {
      // Unmapped or new field: check if it has a value or can be collected
      const label = deriveFieldLabel(input);
      const cleanKey = label || input.name || input.id || 'Field';

      // Check if this field is already known in customer
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
 * Generates the Bookmarklet JavaScript code that runs on any website!
 */
export function generateBookmarkletCode(
  appUrl: string,
  customers: Customer[],
  sheetTitle: string
): string {
  // Minified standalone script
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
    alert('SyncSheet AutoFiller is already active on this page!');
    return;
  }
  window.__syncsheet_autofill_active = true;

  var DB = ${customersJson};
  var APP_URL = ${JSON.stringify(appUrl)};
  var SHEET_TITLE = ${JSON.stringify(sheetTitle)};

  var patterns = {
    cnic: ['cnic','nic','c_nic','national_id','id_card','identity_no','id_number'],
    fullName: ['full_name','fullname','name','applicant_name','candidate_name','first_name'],
    fatherName: ['father_name','fathername','father','guardian_name','guardian','parent'],
    phone: ['phone','mobile','cell','contact','contact_no','whatsapp','tel'],
    email: ['email','e_mail','mail'],
    gender: ['gender','sex'],
    dob: ['dob','date_of_birth','birth_date','birthday'],
    address: ['address','street','residence','residential_address','mailing_address'],
    city: ['city','district','town','tehsil'],
    qualification: ['qualification','education','degree','academic'],
    profession: ['profession','designation','job','job_title','occupation','position'],
    experienceYears: ['experience','experience_years','exp'],
    skills: ['skills','expertise','competencies'],
    bio: ['bio','summary','about','remarks']
  };

  function norm(str) {
    return (str || '').replace(/[^0-9]/g, '');
  }

  function cleanStr(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function findCustomer(val) {
    var digits = norm(val);
    if (digits.length < 5) return null;
    for (var i = 0; i < DB.length; i++) {
      if (norm(DB[i].cnic) === digits) return DB[i];
    }
    return null;
  }

  // Floating UI container
  var container = document.createElement('div');
  container.id = 'syncsheet-autofill-dock';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#fff;padding:14px;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.5);border:1px solid #334155;max-width:360px;font-size:12px;line-height:1.4;';

  container.innerHTML = 
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<div style="display:flex;align-items:center;gap:6px;font-weight:bold;color:#10b981;">' +
        '<span style="font-size:14px;">⚡</span> SyncSheet AutoFiller' +
      '</div>' +
      '<button id="ss-close" style="background:transparent;border:none;color:#94a3b8;font-size:16px;cursor:pointer;">&times;</button>' +
    '</div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Sheet: <b>' + (SHEET_TITLE || 'Synced') + '</b> (' + DB.length + ' records)</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
      '<input id="ss-cnic-input" placeholder="Type or Paste CNIC..." style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:11px;font-family:monospace;" />' +
      '<button id="ss-fill-btn" style="background:#10b981;border:none;color:#fff;padding:6px 10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">AutoFill</button>' +
    '</div>' +
    '<div id="ss-status" style="font-size:11px;color:#cbd5e1;padding:6px;background:#1e293b;border-radius:6px;margin-bottom:8px;">Enter CNIC above or into any form input on this page to trigger automatic fill.</div>' +
    '<div id="ss-new-fields-area" style="display:none;background:#334155;padding:8px;border-radius:8px;margin-top:8px;">' +
      '<div style="font-weight:bold;color:#facc15;margin-bottom:4px;font-size:11px;">✨ New Form Fields Detected:</div>' +
      '<div id="ss-fields-list" style="max-height:90px;overflow-y:auto;font-size:10px;color:#e2e8f0;margin-bottom:6px;"></div>' +
      '<button id="ss-save-fields-btn" style="width:100%;background:#3b82f6;border:none;color:#fff;padding:6px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">Save New Fields to Sheet</button>' +
    '</div>';

  document.body.appendChild(container);

  var statusDiv = document.getElementById('ss-status');
  var newFieldsArea = document.getElementById('ss-new-fields-area');
  var fieldsListDiv = document.getElementById('ss-fields-list');
  var cnicInput = document.getElementById('ss-cnic-input');

  document.getElementById('ss-close').onclick = function() {
    container.remove();
    window.__syncsheet_autofill_active = false;
  };

  var currentMatchedCustomer = null;
  var newlyDiscoveredFields = {};

  function fillForm(customer) {
    if (!customer) return;
    currentMatchedCustomer = customer;
    var allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    var filled = 0;
    var unmappedWithVal = {};

    allInputs.forEach(function(el) {
      var n = cleanStr(el.name);
      var i = cleanStr(el.id);
      var p = cleanStr(el.placeholder);
      var tokens = [n, i, p].filter(Boolean);

      var matchedKey = null;
      for (var k in patterns) {
        var arr = patterns[k];
        for (var t = 0; t < tokens.length; t++) {
          for (var a = 0; a < arr.length; a++) {
            if (tokens[t].indexOf(arr[a]) !== -1 || arr[a].indexOf(tokens[t]) !== -1) {
              matchedKey = k;
              break;
            }
          }
          if (matchedKey) break;
        }
        if (matchedKey) break;
      }

      // Check existing custom fields
      if (!matchedKey && customer.customFields) {
        for (var cf in customer.customFields) {
          var cleanCf = cleanStr(cf);
          for (var t2 = 0; t2 < tokens.length; t2++) {
            if (tokens[t2].indexOf(cleanCf) !== -1 || cleanCf.indexOf(tokens[t2]) !== -1) {
              matchedKey = cf;
              break;
            }
          }
          if (matchedKey) break;
        }
      }

      var targetVal = matchedKey ? (customer[matchedKey] || (customer.customFields && customer.customFields[matchedKey])) : null;

      if (targetVal) {
        el.value = targetVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        el.style.outline = '2px solid #10b981';
        filled++;
      } else if (el.value && el.value.trim().length > 0 && !matchedKey) {
        // Collect newly filled field
        var label = el.name || el.id || el.placeholder || 'Extra Field';
        unmappedWithVal[label] = el.value.trim();
      }
    });

    statusDiv.innerHTML = '<span style="color:#10b981;font-weight:bold;">✓ Auto-filled ' + filled + ' fields</span> for CNIC ' + customer.cnic + ' (' + customer.fullName + ')!';

    // Scan for new fields
    newlyDiscoveredFields = unmappedWithVal;
    var newKeys = Object.keys(unmappedWithVal);
    if (newKeys.length > 0) {
      newFieldsArea.style.display = 'block';
      fieldsListDiv.innerHTML = newKeys.map(function(k) {
        return '<div>• <b>' + k + ':</b> ' + unmappedWithVal[k] + '</div>';
      }).join('');
    } else {
      newFieldsArea.style.display = 'none';
    }
  }

  // Hook input events on page inputs
  document.addEventListener('input', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      var val = e.target.value;
      if (val && norm(val).length >= 13) {
        var found = findCustomer(val);
        if (found) {
          fillForm(found);
          cnicInput.value = found.cnic;
        }
      }
    }
  }, true);

  document.getElementById('ss-fill-btn').onclick = function() {
    var val = cnicInput.value;
    var found = findCustomer(val);
    if (found) {
      fillForm(found);
    } else {
      statusDiv.innerHTML = '<span style="color:#f87171;">No record found for CNIC ' + val + '. Check digits.</span>';
    }
  };

  document.getElementById('ss-save-fields-btn').onclick = function() {
    if (!currentMatchedCustomer) return;
    var payload = {
      cnic: currentMatchedCustomer.cnic,
      newFields: newlyDiscoveredFields
    };

    // Save to localStorage bridge for SyncSheet
    try {
      var queue = JSON.parse(localStorage.getItem('syncsheet_web_harvest_queue') || '[]');
      queue.push(payload);
      localStorage.setItem('syncsheet_web_harvest_queue', JSON.stringify(queue));
    } catch(e) {}

    // Send postMessage to any parent window or open SyncSheet tab
    if (window.opener) {
      window.opener.postMessage({ type: 'SYNCSHEET_NEW_FIELDS', payload: payload }, '*');
    }

    statusDiv.innerHTML = '<span style="color:#38bdf8;font-weight:bold;">✓ Captured ' + Object.keys(newlyDiscoveredFields).length + ' new fields!</span> Recorded under CNIC ' + currentMatchedCustomer.cnic + '. Return to SyncSheet to view synced columns.';
    newFieldsArea.style.display = 'none';
  };
})();
`;

  return `javascript:${encodeURIComponent(rawScript.replace(/\s+/g, ' '))}`;
}

/**
 * Generates extension manifest and files for download
 */
export function generateExtensionFiles(
  appUrl: string,
  customers: Customer[],
  sheetTitle: string
) {
  const manifest = {
    manifest_version: 3,
    name: 'SyncSheet Universal Form AutoFiller',
    version: '1.0.0',
    description: 'Auto-fills web forms on any website using your Google Sheet CNIC registry, and collects new form fields under this CNIC.',
    permissions: ['activeTab', 'storage'],
    action: {
      default_popup: 'popup.html',
      default_title: 'SyncSheet AutoFiller',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
  };

  const contentJs = `// SyncSheet AutoFiller Content Script
console.log('⚡ SyncSheet Universal Form AutoFiller Active on ' + window.location.hostname);

let activeCustomer = null;

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'AUTOFILL_CNIC') {
    autofillWithCustomer(msg.customer);
    sendResponse({ success: true });
  } else if (msg.action === 'GET_FORM_FIELDS') {
    const fields = scanAllFormFields();
    sendResponse({ fields });
  }
});

// Auto-detect CNIC typed anywhere on the webpage
document.addEventListener('input', (e) => {
  if (e.target && (e.target.tagName === 'INPUT')) {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length === 13) {
      chrome.storage.local.get(['syncsheet_customers'], (data) => {
        const list = data.syncsheet_customers || [];
        const match = list.find(c => c.cnic.replace(/[^0-9]/g, '') === val);
        if (match) {
          autofillWithCustomer(match);
        }
      });
    }
  }
}, true);

function autofillWithCustomer(customer) {
  activeCustomer = customer;
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  let filled = 0;

  const patterns = {
    cnic: ['cnic','nic','national_id','id_card','identity_no'],
    fullName: ['full_name','fullname','name','applicant_name','candidate_name','first_name'],
    fatherName: ['father_name','fathername','father','guardian_name','parent'],
    phone: ['phone','mobile','cell','contact','contact_no'],
    email: ['email','e_mail','mail'],
    gender: ['gender','sex'],
    dob: ['dob','date_of_birth','birth_date','birthday'],
    address: ['address','street','residence','residential_address'],
    city: ['city','district','town','tehsil'],
    qualification: ['qualification','education','degree','academic'],
    profession: ['profession','designation','job','job_title','occupation'],
    experienceYears: ['experience','experience_years','exp'],
    skills: ['skills','expertise','competencies'],
    bio: ['bio','summary','about','remarks']
  };

  inputs.forEach(el => {
    const n = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const ph = (el.placeholder || '').toLowerCase();
    const tokens = [n, id, ph];

    let matched = null;
    for (let k in patterns) {
      for (let t of tokens) {
        if (patterns[k].some(p => t.includes(p))) {
          matched = k;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched && customer.customFields) {
      for (let cf in customer.customFields) {
        const cleanCf = cf.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (let t of tokens) {
          if (t.includes(cleanCf)) {
            matched = cf;
            break;
          }
        }
        if (matched) break;
      }
    }

    const val = matched ? (customer[matched] || (customer.customFields && customer.customFields[matched])) : null;
    if (val) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      el.style.outline = '2px solid #10b981';
      filled++;
    }
  });

  console.log('⚡ Auto-filled ' + filled + ' fields for CNIC ' + customer.cnic);
}

function scanAllFormFields() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  const result = [];
  inputs.forEach(el => {
    result.push({
      name: el.name || el.id || el.placeholder || 'Unknown Field',
      value: el.value || '',
      type: el.tagName.toLowerCase()
    });
  });
  return result;
}
`;

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SyncSheet AutoFiller</title>
  <style>
    body { width: 320px; font-family: system-ui, sans-serif; background: #0f172a; color: #fff; margin: 0; padding: 14px; font-size: 12px; }
    h1 { font-size: 14px; margin: 0 0 4px 0; color: #10b981; display: flex; align-items: center; gap: 6px; }
    input, button { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 6px; margin-bottom: 8px; font-size: 12px; }
    input { background: #1e293b; border: 1px solid #334155; color: #fff; font-family: monospace; }
    button { background: #10b981; border: none; color: #fff; font-weight: bold; cursor: pointer; }
    button.secondary { background: #3b82f6; }
    .status { background: #1e293b; padding: 8px; border-radius: 6px; font-size: 11px; color: #cbd5e1; }
  </style>
</head>
<body>
  <h1><span>⚡</span> SyncSheet AutoFiller</h1>
  <p style="color:#94a3b8;margin:0 0 10px 0;font-size:11px;">Google Sheet: <b>${sheetTitle || 'Connected'}</b></p>
  <input id="cnic" placeholder="Enter CNIC (e.g. 35201-1234567-1)" />
  <button id="autofill">Auto-Fill This Website Form</button>
  <button id="collect" class="secondary">Collect New Form Fields</button>
  <div id="status" class="status">Type CNIC to autofill all matching fields across any web page.</div>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `document.getElementById('autofill').addEventListener('click', async () => {
  const cnicVal = document.getElementById('cnic').value.replace(/[^0-9]/g, '');
  const data = await chrome.storage.local.get(['syncsheet_customers']);
  const list = data.syncsheet_customers || [];
  const match = list.find(c => c.cnic.replace(/[^0-9]/g, '') === cnicVal);
  const status = document.getElementById('status');

  if (!match) {
    status.innerHTML = '<span style="color:#f87171;">No customer record found for this CNIC.</span>';
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_CNIC', customer: match }, (res) => {
    status.innerHTML = '<span style="color:#10b981;">✓ Successfully filled form for ' + match.fullName + '!</span>';
  });
});

document.getElementById('collect').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById('status');
  chrome.tabs.sendMessage(tab.id, { action: 'GET_FORM_FIELDS' }, (res) => {
    const fields = res?.fields || [];
    status.innerHTML = 'Scanned ' + fields.length + ' inputs on this page.';
  });
});`;

  return {
    manifest: JSON.stringify(manifest, null, 2),
    contentJs,
    popupHtml,
    popupJs,
  };
}
