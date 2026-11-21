import type { ResearchConversation, SavedResearchAnalysis } from '../types/crypto';

const DB_NAME = 'lct-research-db';
const DB_VERSION = 1;
const CONV_STORE = 'conversations';
const SAVED_STORE = 'savedAnalyses';

function openResearchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONV_STORE)) {
        db.createObjectStore(CONV_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SAVED_STORE)) {
        db.createObjectStore(SAVED_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erro ao abrir IndexedDB'));
  });
}

export async function loadAllConversations(): Promise<ResearchConversation[]> {
  try {
    const db = await openResearchDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CONV_STORE, 'readonly');
      const req = tx.objectStore(CONV_STORE).getAll();
      req.onsuccess = () => {
        const items = (req.result as ResearchConversation[]) ?? [];
        resolve(items.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function putConversation(conv: ResearchConversation): Promise<void> {
  try {
    const db = await openResearchDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONV_STORE, 'readwrite');
      tx.objectStore(CONV_STORE).put(conv);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage errors
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    const db = await openResearchDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONV_STORE, 'readwrite');
      tx.objectStore(CONV_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage errors
  }
}

export async function loadSavedAnalyses(): Promise<SavedResearchAnalysis[]> {
  try {
    const db = await openResearchDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SAVED_STORE, 'readonly');
      const req = tx.objectStore(SAVED_STORE).getAll();
      req.onsuccess = () => {
        const items = (req.result as SavedResearchAnalysis[]) ?? [];
        resolve(items.sort((a, b) => b.savedAt - a.savedAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function putSavedAnalysis(item: SavedResearchAnalysis): Promise<void> {
  try {
    const db = await openResearchDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SAVED_STORE, 'readwrite');
      tx.objectStore(SAVED_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage errors
  }
}

export async function deleteSavedAnalysis(id: string): Promise<void> {
  try {
    const db = await openResearchDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SAVED_STORE, 'readwrite');
      tx.objectStore(SAVED_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage errors
  }
}
