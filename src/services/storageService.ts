import { Customer, SyncQueueItem, SheetMetadata } from '../types';
import { normalizeCnic, syncCustomerWithSheet } from './sheetsService';

const CUSTOMERS_KEY = 'syncsheet_customers_v1';
const QUEUE_KEY = 'syncsheet_sync_queue_v1';
const SHEET_CONFIG_KEY = 'syncsheet_sheet_config_v1';

// Seed sample customer for instant testability
const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: '3520112345671',
    cnic: '35201-1234567-1',
    fullName: 'Muhammad Ahmad Khan',
    fatherName: 'Tariq Mehmood Khan',
    phone: '+92 300 1234567',
    email: 'ahmad.khan@example.com',
    gender: 'Male',
    dob: '1994-08-14',
    address: 'House # 42, Street 8, Sector F-10/2',
    city: 'Islamabad',
    qualification: 'BS in Computer Science - NUST',
    profession: 'Senior Full Stack Software Engineer',
    experienceYears: '6',
    skills: 'React, TypeScript, Node.js, Cloud Architectures, Google Workspace APIs, PostgreSQL',
    bio: 'Dedicated software engineer specializing in responsive scalable web systems, offline synchronization engines, and business process automation.',
    customFields: {
      'Emergency Contact': '+92 321 7654321',
      'Blood Group': 'O Positive',
      'Preferred Shift': 'Morning',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedToSheet: false,
  },
  {
    id: '6110198765432',
    cnic: '61101-9876543-2',
    fullName: 'Fatima Zahra Noor',
    fatherName: 'Noor Muhammad',
    phone: '+92 333 9876543',
    email: 'fatima.noor@example.com',
    gender: 'Female',
    dob: '1997-03-25',
    address: 'Flat 304, Gulberg Heights, Main Boulevard',
    city: 'Lahore',
    qualification: 'MBA in Finance & Marketing - LUMS',
    profession: 'Operations & Business Analyst',
    experienceYears: '4',
    skills: 'Financial Modeling, Customer Analytics, Excel/Sheets Automation, Project Coordination',
    bio: 'Detail-oriented operations specialist with proven track record in streamlining client onboarding, record deduplication, and KPI reporting.',
    customFields: {
      'Department': 'Business Intelligence',
      'Status': 'Active Verified',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedToSheet: false,
  },
];

export function getStoredCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(SAMPLE_CUSTOMERS));
      return SAMPLE_CUSTOMERS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading customers from localStorage', err);
    return SAMPLE_CUSTOMERS;
  }
}

export function saveStoredCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  } catch (err) {
    console.error('Error saving customers to localStorage', err);
  }
}

export function findCustomerByCnic(cnicQuery: string): Customer | undefined {
  const norm = normalizeCnic(cnicQuery);
  if (!norm) return undefined;
  const customers = getStoredCustomers();
  return customers.find((c) => normalizeCnic(c.cnic) === norm);
}

export function upsertCustomerLocally(customer: Customer, queueForSync = true): Customer {
  const customers = getStoredCustomers();
  const norm = normalizeCnic(customer.cnic);
  const now = new Date().toISOString();

  const prepared: Customer = {
    ...customer,
    id: norm,
    updatedAt: now,
  };

  const existingIndex = customers.findIndex((c) => normalizeCnic(c.cnic) === norm);
  let updatedList: Customer[];

  if (existingIndex >= 0) {
    // Merge custom fields gracefully
    const existing = customers[existingIndex];
    prepared.createdAt = existing.createdAt || now;
    prepared.customFields = {
      ...existing.customFields,
      ...prepared.customFields,
    };
    prepared.sheetRowIndex = existing.sheetRowIndex;
    updatedList = [...customers];
    updatedList[existingIndex] = prepared;
  } else {
    prepared.createdAt = now;
    updatedList = [prepared, ...customers];
  }

  saveStoredCustomers(updatedList);

  if (queueForSync) {
    addToSyncQueue({
      id: `${norm}_${Date.now()}`,
      type: existingIndex >= 0 ? 'UPDATE' : 'CREATE',
      customer: prepared,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  return prepared;
}

export function deleteCustomerLocally(cnic: string): void {
  const norm = normalizeCnic(cnic);
  const customers = getStoredCustomers();
  const filtered = customers.filter((c) => normalizeCnic(c.cnic) !== norm);
  saveStoredCustomers(filtered);
}

// Sync Queue Operations
export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function addToSyncQueue(item: SyncQueueItem): void {
  const queue = getSyncQueue();
  // Deduplicate in queue: replace any existing pending update for the same CNIC
  const norm = normalizeCnic(item.customer.cnic);
  const filtered = queue.filter((q) => normalizeCnic(q.customer.cnic) !== norm);
  filtered.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue();
  const updated = queue.filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export function clearSyncQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// Sheet Config
export function getStoredSheetConfig(): SheetMetadata | null {
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function saveStoredSheetConfig(config: SheetMetadata | null): void {
  if (!config) {
    localStorage.removeItem(SHEET_CONFIG_KEY);
  } else {
    localStorage.setItem(SHEET_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Flush sync queue to Google Sheets
 */
export async function flushSyncQueue(
  token: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ successCount: number; errors: string[] }> {
  const config = getStoredSheetConfig();
  if (!config?.id) {
    return { successCount: 0, errors: ['No Google Sheet connected. Connect a sheet first.'] };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { successCount: 0, errors: [] };
  }

  let successCount = 0;
  const errors: string[] = [];
  const currentCustomers = getStoredCustomers();

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (onProgress) onProgress(i + 1, queue.length);

    try {
      const res = await syncCustomerWithSheet(
        token,
        config.id,
        config.sheetName || 'Customers',
        item.customer
      );

      // Mark locally as synced and record row index
      const custIndex = currentCustomers.findIndex(
        (c) => normalizeCnic(c.cnic) === normalizeCnic(item.customer.cnic)
      );
      if (custIndex >= 0) {
        currentCustomers[custIndex].syncedToSheet = true;
        currentCustomers[custIndex].sheetRowIndex = res.rowIndex;
      }

      removeFromSyncQueue(item.id);
      successCount++;
    } catch (err: any) {
      console.error(`Sync error for CNIC ${item.customer.cnic}:`, err);
      errors.push(`${item.customer.cnic}: ${err.message || 'Unknown error'}`);
    }
  }

  saveStoredCustomers(currentCustomers);
  if (config) {
    config.lastSyncedAt = new Date().toISOString();
    saveStoredSheetConfig(config);
  }

  return { successCount, errors };
}
