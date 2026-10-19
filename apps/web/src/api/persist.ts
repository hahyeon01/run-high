/** 데모 모드 DB를 IndexedDB에 저장 (localStorage는 용량이 작아서 쓰지 않음) */
const DB_NAME = 'runhigh';
const STORE = 'kv';
const KEY = 'sqlite';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDbBytes(): Promise<Uint8Array | null> {
  try {
    const idb = await open();
    return await new Promise((resolve, reject) => {
      const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[runhigh] 저장된 데이터를 불러오지 못했어요', e);
    return null;
  }
}

export async function saveDbBytes(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[runhigh] 데이터를 저장하지 못했어요', e);
  }
}

export async function clearDbBytes(): Promise<void> {
  try {
    const idb = await open();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* 무시 */
  }
}
