// js/db.js
// 這個檔案封裝了所有與 IndexedDB 互動的底層邏輯。

const DB_NAME = 'AiChatDB';
const DB_VERSION = 4; // 版本號 +1 以觸發資料庫結構更新
let db;

/**
 * @description 打開或建立 IndexedDB 資料庫
 * @returns {Promise<IDBDatabase>} 回傳一個 Promise，成功時解析為資料庫實例
 */
export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // 建立儲存各種資料的 "表" (Object Store)
            if (!db.objectStoreNames.contains('characters')) {
                db.createObjectStore('characters', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('chatHistories')) {
                db.createObjectStore('chatHistories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('longTermMemories')) {
                db.createObjectStore('longTermMemories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('chatMetadatas')) {
                db.createObjectStore('chatMetadatas', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('userPersonas')) {
                db.createObjectStore('userPersonas', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('keyValueStore')) {
                db.createObjectStore('keyValueStore', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('promptSets')) {
                db.createObjectStore('promptSets', { keyPath: 'id' });
            }
            // 為世界書建立新的儲存區
            if (!db.objectStoreNames.contains('lorebooks')) {
                db.createObjectStore('lorebooks', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB 錯誤:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * @description 從指定的儲存區中獲取所有資料
 * @param {string} storeName - 儲存區的名稱
 * @returns {Promise<Array>} - 回傳包含所有資料的陣列
 */
export function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * @description 從指定的儲存區中獲取單筆資料
 * @param {string} storeName - 儲存區的名稱
 * @param {*} key - 資料的鍵
 * @returns {Promise<Object>} - 回傳找到的資料物件
 */
export function get(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * @description 將資料放入（新增或更新）指定的儲存區
 * @param {string} storeName - 儲存區的名稱
 * @param {Object} value - 要儲存的資料物件
 * @returns {Promise}
 */
export function put(storeName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * @description 從指定的儲存區中刪除單筆資料
 * @param {string} storeName - 儲存區的名稱
 * @param {*} key - 要刪除的資料的鍵
 * @returns {Promise}
 */
export function deleteItem(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * @description 清空指定的儲存區
 * @param {string} storeName - 要清空的儲存區名稱
 * @returns {Promise}
 */
export function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
