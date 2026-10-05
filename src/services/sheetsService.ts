import { Customer } from '../types';

export const STANDARD_HEADERS = [
  'CNIC',
  'Full Name',
  'Father Name',
  'Phone',
  'Email',
  'Gender',
  'Date of Birth',
  'Address',
  'City',
  'Qualification',
  'Profession',
  'Experience (Years)',
  'Skills',
  'Bio',
  'Last Updated',
];

export const normalizeCnic = (cnic: string): string => {
  return (cnic || '').replace(/[^0-9]/g, '');
};

export const formatCnic = (cnic: string): string => {
  const digits = normalizeCnic(cnic);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
};

/**
 * Creates a new Google Spreadsheet with headers formatted properly
 */
export async function createSpreadsheet(
  token: string,
  title: string = 'Customer Database & CNIC Registry'
): Promise<{ id: string; title: string; sheetName: string; url: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'Customers',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to create spreadsheet: ${response.statusText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const sheetName = data.sheets?.[0]?.properties?.title || 'Customers';

  // Seed the standard headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:O1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [STANDARD_HEADERS],
      }),
    }
  );

  return {
    id: spreadsheetId,
    title,
    sheetName,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Validates and gets details of an existing spreadsheet
 */
export async function getSpreadsheetDetails(
  token: string,
  spreadsheetId: string
): Promise<{ id: string; title: string; sheetName: string; url: string }> {
  // Strip full URL if user pasted a link
  let cleanId = spreadsheetId.trim();
  const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    cleanId = match[1];
  }

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Spreadsheet not found or access denied`);
  }

  const data = await response.json();
  const title = data.properties?.title || 'Google Sheet';
  const sheetName = data.sheets?.[0]?.properties?.title || 'Sheet1';

  return {
    id: cleanId,
    title,
    sheetName,
    url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
  };
}

/**
 * Fetches all headers and rows from a spreadsheet
 */
export async function fetchSheetData(
  token: string,
  spreadsheetId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: string[][]; customers: Customer[] }> {
  const range = `${encodeURIComponent(sheetName)}!A1:ZZ`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch sheet data`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  if (values.length === 0) {
    return { headers: STANDARD_HEADERS, rows: [], customers: [] };
  }

  const headers = values[0].map((h) => String(h || '').trim());
  const rows = values.slice(1);

  // Map rows to customers
  const customers: Customer[] = rows
    .map((row, idx) => {
      const rowNum = idx + 2; // 1-based index (header is row 1)
      const rowObj: Record<string, string> = {};
      headers.forEach((hdr, colIdx) => {
        rowObj[hdr] = row[colIdx] ? String(row[colIdx]).trim() : '';
      });

      const cnic = rowObj['CNIC'] || '';
      if (!cnic) return null;

      // Extract custom fields (headers that are not part of STANDARD_HEADERS)
      const customFields: Record<string, string> = {};
      headers.forEach((hdr, colIdx) => {
        if (!STANDARD_HEADERS.includes(hdr) && hdr) {
          customFields[hdr] = row[colIdx] ? String(row[colIdx]).trim() : '';
        }
      });

      const customer: Customer = {
        id: normalizeCnic(cnic),
        cnic: formatCnic(cnic),
        fullName: rowObj['Full Name'] || '',
        fatherName: rowObj['Father Name'] || '',
        phone: rowObj['Phone'] || '',
        email: rowObj['Email'] || '',
        gender: (rowObj['Gender'] as any) || '',
        dob: rowObj['Date of Birth'] || '',
        address: rowObj['Address'] || '',
        city: rowObj['City'] || '',
        qualification: rowObj['Qualification'] || '',
        profession: rowObj['Profession'] || '',
        experienceYears: rowObj['Experience (Years)'] || '',
        skills: rowObj['Skills'] || '',
        bio: rowObj['Bio'] || '',
        customFields,
        createdAt: rowObj['Last Updated'] || new Date().toISOString(),
        updatedAt: rowObj['Last Updated'] || new Date().toISOString(),
        syncedToSheet: true,
        sheetRowIndex: rowNum,
      };

      return customer;
    })
    .filter((c): c is Customer => c !== null);

  return { headers, rows, customers };
}

/**
 * Calculates column letter for a 0-based column index (e.g. 0 -> A, 27 -> AB)
 */
function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Saves or updates a customer in Google Sheet:
 * - If CNIC exists: updates that existing row in place (never creates duplicate)
 * - If new field in form: appends new column header if not present, and populates under that CNIC
 * - If CNIC doesn't exist: appends new row
 */
export async function syncCustomerWithSheet(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  customer: Customer
): Promise<{ success: boolean; rowIndex: number; action: 'appended' | 'updated'; updatedHeaders: string[] }> {
  // 1. Fetch current headers and rows
  const { headers: existingHeaders, rows } = await fetchSheetData(token, spreadsheetId, sheetName);
  let headers = [...existingHeaders];

  // If no headers existed, initialize with standard headers
  if (headers.length === 0) {
    headers = [...STANDARD_HEADERS];
  }

  // 2. Check for any dynamic custom fields on the customer that aren't yet in headers
  const customerCustomKeys = Object.keys(customer.customFields || {}).filter(Boolean);
  let headersChanged = false;

  for (const key of customerCustomKeys) {
    if (!headers.includes(key)) {
      headers.push(key);
      headersChanged = true;
    }
  }

  // If new headers are added, update the header row first
  if (headersChanged || existingHeaders.length === 0) {
    const endCol = getColumnLetter(headers.length - 1);
    const range = `${encodeURIComponent(sheetName)}!A1:${endCol}1`;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headers],
        }),
      }
    );
  }

  // 3. Search for existing CNIC in rows
  const normTargetCnic = normalizeCnic(customer.cnic);
  const cnicColIndex = headers.indexOf('CNIC');
  const safeCnicCol = cnicColIndex >= 0 ? cnicColIndex : 0;

  let existingRowIndex = -1; // 1-based row index in sheet

  for (let i = 0; i < rows.length; i++) {
    const rowCnic = rows[i][safeCnicCol];
    if (rowCnic && normalizeCnic(rowCnic) === normTargetCnic) {
      existingRowIndex = i + 2; // row 1 is header
      break;
    }
  }

  // 4. Construct row data matching headers order
  const nowIso = new Date().toLocaleString();
  const rowData: string[] = headers.map((hdr) => {
    switch (hdr) {
      case 'CNIC':
        return formatCnic(customer.cnic);
      case 'Full Name':
        return customer.fullName || '';
      case 'Father Name':
        return customer.fatherName || '';
      case 'Phone':
        return customer.phone || '';
      case 'Email':
        return customer.email || '';
      case 'Gender':
        return customer.gender || '';
      case 'Date of Birth':
        return customer.dob || '';
      case 'Address':
        return customer.address || '';
      case 'City':
        return customer.city || '';
      case 'Qualification':
        return customer.qualification || '';
      case 'Profession':
        return customer.profession || '';
      case 'Experience (Years)':
        return customer.experienceYears || '';
      case 'Skills':
        return customer.skills || '';
      case 'Bio':
        return customer.bio || '';
      case 'Last Updated':
        return nowIso;
      default:
        // Dynamic custom field
        return customer.customFields?.[hdr] || '';
    }
  });

  const endCol = getColumnLetter(headers.length - 1);

  // 5. Update existing row OR append new row
  if (existingRowIndex > 0) {
    // UPDATE existing row
    const updateRange = `${encodeURIComponent(sheetName)}!A${existingRowIndex}:${endCol}${existingRowIndex}`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to update row ${existingRowIndex} in Google Sheet`);
    }

    return {
      success: true,
      rowIndex: existingRowIndex,
      action: 'updated',
      updatedHeaders: headers,
    };
  } else {
    // APPEND new row
    const appendRange = `${encodeURIComponent(sheetName)}!A1`;
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to append new row in Google Sheet`);
    }

    const appendData = await appendRes.json();
    const updatedRange = appendData?.updates?.updatedRange || '';
    const matchRow = updatedRange.match(/!A(\d+)/);
    const newRowIndex = matchRow ? parseInt(matchRow[1], 10) : rows.length + 2;

    return {
      success: true,
      rowIndex: newRowIndex,
      action: 'appended',
      updatedHeaders: headers,
    };
  }
}
