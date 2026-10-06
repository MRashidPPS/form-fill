export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface Customer {
  id: string; // usually normalized CNIC or UUID
  cnic: string; // e.g. 12345-1234567-1 or 1234512345671
  fullName: string;
  fatherName: string;
  phone: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  dob: string;
  address: string;
  city: string;
  qualification: string;
  profession: string;
  experienceYears: string;
  skills: string; // comma-separated or text
  bio: string;
  customFields: Record<string, string>; // dynamic key-value pairs (e.g. { "Emergency Contact": "...", "Blood Group": "B+" })
  createdAt: string;
  updatedAt: string;
  syncedToSheet: boolean;
  sheetRowIndex?: number; // 1-based index in sheet if known
}

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  customer: Customer;
  timestamp: number;
  retries: number;
}

export interface SheetMetadata {
  id: string;
  title: string;
  sheetName: string;
  url: string;
  lastSyncedAt?: string;
}

export interface DetectedField {
  key: string;
  label: string;
  value: string;
  type: string;
  isNew: boolean;
}

export type ActiveTab = 'form' | 'customers' | 'cv-maker' | 'analytics' | 'autofill' | 'sync-settings';
