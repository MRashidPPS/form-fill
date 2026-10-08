import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, SheetMetadata } from '../types';
import { normalizeCnic } from './sheetsService';

/**
 * Real-time listener for all customers of the logged-in user across all devices
 */
export function subscribeUserCustomers(
  userId: string,
  onUpdate: (customers: Customer[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) return () => {};

  const userCustomersCol = collection(db, 'users', userId, 'customers');
  const q = query(userCustomersCol);

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Customer;
        if (data && data.cnic) {
          list.push({
            ...data,
            id: normalizeCnic(data.cnic),
          });
        }
      });
      onUpdate(list);
    },
    (error) => {
      console.warn('Firestore real-time subscription error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Persists a customer record to Firestore under the user's account for multi-device sync
 */
export async function saveCustomerToCloud(
  userId: string,
  userEmail: string,
  customer: Customer
): Promise<void> {
  if (!userId) return;

  const docId = normalizeCnic(customer.cnic);
  const docRef = doc(db, 'users', userId, 'customers', docId);

  const payload: Customer = {
    ...customer,
    id: docId,
    userId,
    userEmail: userEmail || customer.userEmail || '',
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Removes a customer from the user's Firestore cloud collection
 */
export async function deleteCustomerFromCloud(
  userId: string,
  cnic: string
): Promise<void> {
  if (!userId || !cnic) return;

  const docId = normalizeCnic(cnic);
  const docRef = doc(db, 'users', userId, 'customers', docId);
  await deleteDoc(docRef);
}

/**
 * Syncs the user's Google Sheet configuration to Cloud Firestore
 */
export async function saveSheetConfigToCloud(
  userId: string,
  config: SheetMetadata
): Promise<void> {
  if (!userId || !config) return;

  const docRef = doc(db, 'users', userId, 'config', 'sheet');
  await setDoc(docRef, { ...config }, { merge: true });
}

/**
 * Loads the user's Google Sheet configuration from Cloud Firestore
 */
export async function loadSheetConfigFromCloud(
  userId: string
): Promise<SheetMetadata | null> {
  if (!userId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'config', 'sheet');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SheetMetadata;
    }
  } catch (e) {
    console.warn('Failed to load sheet config from cloud:', e);
  }
  return null;
}

/**
 * Batches local cached customer records to Cloud Firestore when first signing in
 */
export async function uploadLocalCustomersToCloud(
  userId: string,
  userEmail: string,
  localCustomers: Customer[]
): Promise<number> {
  if (!userId || localCustomers.length === 0) return 0;

  let count = 0;
  for (const c of localCustomers) {
    try {
      await saveCustomerToCloud(userId, userEmail, c);
      count++;
    } catch (e) {
      console.warn('Batch cloud sync item error:', e);
    }
  }
  return count;
}
