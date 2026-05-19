const DB_NAME = "private-notes";
const DB_VERSION = 1;
const STORE = "handles";
const ROOT_KEY = "vault-root";

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

/** Remember the last opened vault folder for this origin. */
export async function persistVaultHandle(
  root: FileSystemDirectoryHandle,
): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(STORE).put(root, ROOT_KEY);
  });
  db.close();
}

export async function loadVaultHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!isIndexedDbAvailable()) return null;
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
      const req = tx.objectStore(STORE).get(ROOT_KEY);
      req.onsuccess = () =>
        resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    },
  );
  db.close();
  return handle ?? null;
}

export async function clearVaultHandle(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    tx.objectStore(STORE).delete(ROOT_KEY);
  });
  db.close();
}
