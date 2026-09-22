const DB = 'batchlight-device-v1';

async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('cache')) request.result.createObjectStore('cache');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Device storage could not be opened.'));
  });
}

/** Resolve only when the transaction commits, including reads; aborts never look successful. */
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction('cache', mode);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    let result: T;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('Device storage transaction was interrupted.'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Device storage could not save this change.'));
    };
    try {
      const request = action(tx.objectStore('cache'));
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Device storage request failed.'));
      };
    } catch (error) {
      tx.abort();
      db.close();
      reject(error);
    }
  });
}

export function readCache<T>(key: string): Promise<T | undefined> {
  return transaction<T | undefined>('readonly', (store) => store.get(key));
}
export async function writeCache(key: string, value: unknown): Promise<void> {
  await transaction<IDBValidKey>('readwrite', (store) => store.put(value, key));
}
export async function clearCache(): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.clear());
}
