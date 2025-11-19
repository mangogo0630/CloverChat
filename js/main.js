// js/main.js
// 這是應用程式的主要進入點

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

import { loadStateFromDB, state, saveSettings } from './state.js';
import { openDB } from './db.js';
import { applyTheme, setAppHeight } from './utils.js';
import { renderCharacterList, renderActiveChat, renderAccountTab } from './ui.js';
import { setupEventListeners } from './events.js';
import { PREMIUM_ACCOUNTS } from './constants.js';

export let auth;

/**
 * @description 註冊 Service Worker 並處理更新邏輯
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker 註冊成功:', registration);

                // 檢查是否有等待中的新版本 Service Worker
                if (registration.waiting) {
                    showUpdateNotification(registration);
                }

                // 監聽是否有新版本準備好
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                             showUpdateNotification(registration);
                        }
                    });
                });
            })
            .catch(error => {
                console.log('Service Worker 註冊失敗:', error);
            });
        
        // 當新的 Service Worker 啟用時，重新載入頁面
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
}

/**
 * @description 顯示更新提示
 * @param {ServiceWorkerRegistration} registration - Service Worker 註冊物件
 */
function showUpdateNotification(registration) {
    const notification = document.getElementById('update-notification');
    const reloadButton = document.getElementById('reload-page-btn');

    if (notification && reloadButton) {
        notification.classList.remove('hidden');
        reloadButton.onclick = () => {
            // 向等待中的 Service Worker 發送訊息，使其立即啟用
            registration.waiting.postMessage({ action: 'skipWaiting' });
        };
    }
}


/**
 * @description 設定 Markdown 渲染器的選項
 */
function setupMarkdownRenderer() {
    const renderer = new marked.Renderer();
    
    renderer.link = (href, title, text) => {
        return text;
    };

    renderer.heading = (text, level, raw) => {
        return `<p>${raw}</p>`;
    };
    
    marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
    });
}

/**
 * @description 初始化應用程式
 */
async function initialize() {
    applyTheme();
    setupMarkdownRenderer();
    
    const firebaseConfig = {
      apiKey: "AIzaSyBKfM5fvlEr72B1aXGNwW9dmpuTMHvInaI",
      authDomain: "icechat-1f28c.firebaseapp.com",
      projectId: "icechat-1f28c",
      storageBucket: "icechat-1f28c.firebasestorage.app",
      messagingSenderId: "146757831481",
      appId: "1:146757831481:web:7c7a786134eb4e4cccf6e8",
      measurementId: "G-M93QNY87PM"
    };

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    try {
        await openDB();
        console.log("資料庫已成功連接。");

        // 註冊 Service Worker
        registerServiceWorker();

        onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
    
        if (user && PREMIUM_ACCOUNTS.some(acc => acc.firebaseEmail === user.email)) {
        state.isPremiumUser = true;
        } else {
        state.isPremiumUser = false;
    }
    
    await loadStateFromDB();

    // 只在首次載入且非授權使用者時自動切換
    if (!state.isPremiumUser && 
        state.globalSettings.apiProvider === 'official_gemini' && 
        !state.isInitialLoad) {
        console.log("非授權使用者，API 供應商已自動從測試模型切換至 OpenAI。");
        state.globalSettings.apiProvider = 'openai'; 
        await saveSettings();
    }
    
    // 標記已完成初始載入
    state.isInitialLoad = true;

            if (state.globalSettings.theme) {
                applyTheme(state.globalSettings.theme);
            }

            renderCharacterList();
            renderActiveChat();
            renderAccountTab(); 
        });

        setupEventListeners();
        setAppHeight();
        
    } catch (error) {
        console.error("應用程式初始化失敗:", error);
        document.body.innerHTML = "應用程式載入失敗，請檢查主控台。";
    }
}

document.addEventListener('DOMContentLoaded', initialize);

