// service-worker.js

// 版本號:每次您更新網站的任何核心檔案時,請務必將此版本號 +1
// 例如:'ice-chat-cache-v2', 'ice-chat-cache-v3' ...
const CACHE_NAME = 'ice-chat-cache-v5.2.2';

// 需要被快取的核心檔案列表
const urlsToCache = [
  './', // 快取根目錄,通常是 index.html
  './index.html',
  './manifest.json',
  './style.css',
  './js/main.js',
  './js/api.js',
  './js/constants.js',
  './js/db.js',
  './js/dom.js',
  './js/events.js',
  './js/handlers.js',
  './js/lorebookManager.js',
  './js/promptManager.js',
  './js/state.js',
  './js/ui.js',
  './js/utils.js',
  './js/default_characters.json',
  // 第三方函式庫
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js',
  // Firebase SDK
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js',
  // 核心圖片資源
  './pic/milkteashop.png',
  './pic/33.jpg',
  './pic/yan.jpg',
  'https://placehold.co/100x100/EFEFEF/AAAAAA?text=頭像'
];

// 1. 安裝 Service Worker (新增錯誤處理)
self.addEventListener('install', event => {
  // 等待快取操作完成
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        // 新增:如果 cache.addAll 失敗,在控制台清楚地顯示錯誤
        // 這有助於快速定位是哪個檔案路徑錯誤或無法存取
        console.error('Service Worker 安裝失敗:無法快取所有資源。', error);
      })
  );
});

// 2. 攔截網路請求,從快取提供資源 (改良版)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 忽略非 GET 請求 (例如 POST) 和 Go Live 的 WebSocket 請求
  if (event.request.method !== 'GET' || url.protocol === 'ws:') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果快取中有對應的回應,就直接回傳,否則從網路請求
        // 這個 fetch 在離線時會失敗,這是預期行為,錯誤訊息代表該資源未被成功快取。
        return response || fetch(event.request);
      })
  );
});

// 3. 啟用 Service Worker 並清除舊快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 如果快取名稱不在白名單中,就刪除它
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 4. 監聽來自客戶端的訊息,以觸發 skipWaiting
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
