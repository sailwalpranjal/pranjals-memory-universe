/**
 * Offline-First Media Queue using browser IndexedDB.
 * Stores captures and uploads immediately in local browser storage,
 * allowing instant optimistic UI rendering and background sync when network is active.
 */

const DB_NAME = "pranjal_universe_offline";
const DB_VERSION = 1;
const STORE_NAME = "media_queue";

export interface OfflineQueueItem {
  id: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  timestamp: number;
  latitude?: number;
  longitude?: number;
  syncStatus: "pending" | "syncing" | "failed";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a media capture into local IndexedDB
 */
export async function enqueueOfflineMedia(
  blob: Blob,
  filename: string,
  coords?: { lat: number; lng: number }
): Promise<OfflineQueueItem> {
  const db = await openDB();
  const item: OfflineQueueItem = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    blob,
    filename,
    mimeType: blob.type,
    timestamp: Date.now(),
    latitude: coords?.lat,
    longitude: coords?.lng,
    syncStatus: "pending",
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all pending items in the offline queue
 */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove an item from the offline queue after successful backend sync
 */
export async function removeOfflineItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

/**
 * Process and synchronize all pending offline items to the server
 */
export async function syncOfflineQueueToServer(
  onItemSynced?: (item: OfflineQueueItem) => void
): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return 0;
  }

  const items = await getOfflineQueue();
  let syncedCount = 0;

  for (const item of items) {
    try {
      const formData = new FormData();
      formData.append("file", item.blob, item.filename);
      if (item.latitude && item.longitude) {
        formData.append("latitude", item.latitude.toString());
        formData.append("longitude", item.longitude.toString());
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await removeOfflineItem(item.id);
        syncedCount += 1;
        if (onItemSynced) onItemSynced(item);
      }
    } catch (err) {
      console.warn(`[offlineQueue] Failed to sync item ${item.id}:`, err);
    }
  }

  return syncedCount;
}

// Auto-register network sync listener in browser environment
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncOfflineQueueToServer();
  });
}
