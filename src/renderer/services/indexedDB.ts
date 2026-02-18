/**
 * IndexedDB - 本地数据库封装
 */

export interface DBConfig {
  name: string;
  version: number;
  stores: {
    name: string;
    keyPath?: string;
    autoIncrement?: boolean;
    indexes?: { name: string; keyPath: string; unique?: boolean }[];
  }[];
}

class IndexedDBWrapper {
  private db: IDBDatabase | null = null;
  private config: DBConfig;
  private ready: Promise<void>;

  constructor(config: DBConfig) {
    this.config = config;
    this.ready = this.open();
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const store of this.config.stores) {
          if (!db.objectStoreNames.contains(store.name)) {
            const objectStore = db.createObjectStore(store.name, {
              keyPath: store.keyPath,
              autoIncrement: store.autoIncrement,
            });
            store.indexes?.forEach((idx) =>
              objectStore.createIndex(idx.name, idx.keyPath, { unique: idx.unique }),
            );
          }
        }
      };
    });
  }

  async ensureReady(): Promise<void> {
    await this.ready;
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put<T>(storeName: string, value: T, key?: IDBValidKey): Promise<IDBValidKey> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = key ? store.put(value, key) : store.put(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async add<T>(storeName: string, value: T, key?: IDBValidKey): Promise<IDBValidKey> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = key ? store.add(value, key) : store.add(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async query<T>(
    storeName: string,
    indexName: string,
    query: IDBKeyRange | IDBValidKey,
  ): Promise<T[]> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(query);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async count(storeName: string): Promise<number> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async transaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    fn: (stores: Record<string, IDBObjectStore>) => Promise<T>,
  ): Promise<T> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeNames, mode);
      const stores: Record<string, IDBObjectStore> = {};
      storeNames.forEach((name) => (stores[name] = tx.objectStore(name)));
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve(result);
      let result: T;
      fn(stores)
        .then((r) => (result = r))
        .catch(reject);
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============ MindCode 数据库实例 ============
export const mindcodeDB = new IndexedDBWrapper({
  name: "mindcode",
  version: 1,
  stores: [
    {
      name: "files",
      keyPath: "path",
      indexes: [
        { name: "modified", keyPath: "modifiedAt" },
        { name: "workspace", keyPath: "workspace" },
      ],
    },
    { name: "sessions", keyPath: "id", indexes: [{ name: "timestamp", keyPath: "timestamp" }] },
    { name: "settings", keyPath: "key" },
    {
      name: "snippets",
      keyPath: "id",
      indexes: [
        { name: "language", keyPath: "language" },
        { name: "prefix", keyPath: "prefix" },
      ],
    },
    {
      name: "history",
      keyPath: "id",
      indexes: [
        { name: "type", keyPath: "type" },
        { name: "timestamp", keyPath: "timestamp" },
      ],
    },
    { name: "cache", keyPath: "key", indexes: [{ name: "expires", keyPath: "expiresAt" }] },
  ],
});

// ============ 便捷 API ============
export const db = {
  files: {
    get: (path: string) =>
      mindcodeDB.get<{ path: string; content: string; modifiedAt: number }>("files", path),
    save: (path: string, content: string, workspace?: string) =>
      mindcodeDB.put("files", { path, content, modifiedAt: Date.now(), workspace }),
    delete: (path: string) => mindcodeDB.delete("files", path),
    list: () => mindcodeDB.getAll<{ path: string; modifiedAt: number }>("files"),
  },
  settings: {
    get: <T>(key: string) =>
      mindcodeDB.get<{ key: string; value: T }>("settings", key).then((r) => r?.value),
    set: <T>(key: string, value: T) => mindcodeDB.put("settings", { key, value }),
    delete: (key: string) => mindcodeDB.delete("settings", key),
  },
  history: {
    add: (type: string, data: any) =>
      mindcodeDB.add("history", {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        data,
        timestamp: Date.now(),
      }),
    getByType: (type: string) =>
      mindcodeDB.query<{ id: string; type: string; data: any; timestamp: number }>(
        "history",
        "type",
        type,
      ),
    clear: () => mindcodeDB.clear("history"),
  },
  cache: {
    get: <T>(key: string) =>
      mindcodeDB
        .get<{ key: string; value: T; expiresAt: number }>("cache", key)
        .then((r) => (r && r.expiresAt > Date.now() ? r.value : undefined)),
    set: <T>(key: string, value: T, ttl = 3600000) =>
      mindcodeDB.put("cache", { key, value, expiresAt: Date.now() + ttl }),
    delete: (key: string) => mindcodeDB.delete("cache", key),
  },
};

// ============ Recovery 后端注入 ============
import { recoveryManager } from "@core/recovery";
import type { RecoveryState } from "@core/recovery";

const IDB_RECOVERY_STORE = "settings";
const IDB_RECOVERY_KEY = "recovery_state";

recoveryManager.setAsyncBackend({
  async get(_key: string): Promise<RecoveryState | null> {
    const record = await mindcodeDB.get<{ key: string; value: RecoveryState }>(
      IDB_RECOVERY_STORE,
      IDB_RECOVERY_KEY,
    );
    return record?.value ?? null;
  },
  async set(_key: string, value: RecoveryState): Promise<void> {
    await mindcodeDB.put(IDB_RECOVERY_STORE, { key: IDB_RECOVERY_KEY, value });
  },
  async delete(_key: string): Promise<void> {
    await mindcodeDB.delete(IDB_RECOVERY_STORE, IDB_RECOVERY_KEY);
  },
});

export default { IndexedDBWrapper, mindcodeDB, db };
