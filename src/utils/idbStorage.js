const DB_NAME = "receipt-tracker";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // Don't cache a rejected promise — a transient open failure (blocked
      // upgrade, private-mode quirk) would otherwise break persistence for the
      // whole session. Clearing it lets the next call retry opening.
      dbPromise = null;
      reject(req.error);
    };
  });
  // Belt-and-braces: if the promise rejects for any other reason, allow a retry.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** True for QuotaExceededError across browsers (name or legacy numeric code). */
export function isQuotaError(e) {
  return (
    e &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  );
}

export async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("idb abort"));
  });
}

export async function idbKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
