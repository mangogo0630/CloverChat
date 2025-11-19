# 幸運草 AI 聊天 - 系統架構與記憶設計分析文件

## 1. 專案概述
「幸運草 AI 聊天」是一個基於瀏覽器的漸進式網頁應用程式 (PWA)，專注於提供高度客製化的 AI 角色扮演體驗。專案採用 **Vanilla JavaScript (ES Modules)** 開發，不依賴大型前端框架 (如 React/Vue)，以確保輕量化與高效能。

---

## 2. 系統架構 (System Architecture)

### 2.1 技術堆疊 (Tech Stack)
*   **核心語言**: HTML5, CSS3, JavaScript (ES6+)
*   **模組化**: Native ES Modules (`import`/`export`)
*   **資料儲存**: IndexedDB (本地大量資料), localStorage (輕量設定)
*   **身分驗證**: Firebase Authentication (Google 登入)
*   **應用程式型態**: PWA (Service Worker, Manifest)
*   **外部依賴**:
    *   `marked.js`: Markdown 渲染
    *   `dompurify`: HTML 淨化 (安全性)
    *   `html2canvas`: 截圖功能
    *   `fontawesome`: 圖示庫

### 2.2 檔案結構與模組職責
專案採用功能導向的模組化結構，主要邏輯位於 `js/` 目錄下：

| 檔案 | 主要職責 |
| :--- | :--- |
| `index.html` | 應用程式入口，定義 DOM 結構與引入外部資源。 |
| `js/main.js` | **程式進入點**。負責初始化 Firebase、註冊 Service Worker、啟動應用程式。 |
| `js/state.js` | **狀態管理中心**。管理全域變數 (`state` 物件)、資料的載入與儲存 (與 DB 溝通)。 |
| `js/db.js` | **資料庫層**。封裝 IndexedDB 操作 (Open, Get, Put, Delete)，處理非同步資料存取。 |
| `js/ui.js` | **視圖層 (View)**。負責 DOM 渲染 (角色列表、聊天訊息、設定介面)。 |
| `js/events.js` | **事件監聽層**。綁定所有按鈕點擊、輸入框變更等 DOM 事件。 |
| `js/handlers.js` | **控制器層 (Controller)**。處理具體的業務邏輯 (如：發送訊息、切換角色、更新記憶)。 |
| `js/promptManager.js` | **提示詞引擎**。負責組裝發送給 AI 的訊息 (Context)，處理變數替換 (`{{char}}`, `{{memory}}`)。 |
| `js/lorebookManager.js` | **世界書管理**。處理關鍵字觸發與世界觀資料的注入。 |
| `js/api.js` | **API 服務層**。封裝與不同 AI 供應商 (OpenAI, Anthropic, Google 等) 的 API 請求。 |

### 2.3 資料流向 (Data Flow)
1.  **初始化**: `main.js` 啟動 -> `state.js` 從 IndexedDB 讀取資料 -> `ui.js` 渲染畫面。
2.  **使用者互動**: `events.js` 捕捉事件 -> 呼叫 `handlers.js` 處理邏輯。
3.  **狀態更新**: `handlers.js` 修改 `state` 物件 -> 呼叫 `state.js` 寫入 IndexedDB -> 呼叫 `ui.js` 更新畫面。

---

## 3. 角色記憶設計 (Character Memory Design)

本專案的記憶系統設計目標是讓 AI 能夠「記住」對話中的長期重點，而不僅僅是依賴有限的上下文視窗 (Context Window)。

### 3.1 資料結構 (Data Structure)
記憶並非儲存在對話歷史 (Chat History) 中，而是獨立儲存。

*   **儲存位置**: `state.longTermMemories`
*   **資料結構**: 巢狀物件 (Nested Object)
    ```javascript
    state.longTermMemories = {
        "character_id_A": {
            "chat_session_id_1": "這是與角色A在聊天室1的長期記憶摘要...",
            "chat_session_id_2": "這是與角色A在聊天室2的長期記憶摘要..."
        },
        "character_id_B": { ... }
    }
    ```
*   **特點**: 每個「角色」的每個「聊天室」都有獨立的記憶欄位，互不干擾。

### 3.2 運作流程 (Workflow)

#### A. 記憶的注入 (Injection)
當使用者發送訊息時，系統會動態組裝提示詞 (Prompt)：

1.  **讀取設定**: 系統讀取目前的 `main_system_prompt` (主要系統提示)。
2.  **佔位符替換**: `js/promptManager.js` 中的 `replacePlaceholders` 函式執行替換。
    *   它會尋找 `{{memory}}` 標籤。
    *   從 `state.longTermMemories` 取得當前聊天室的記憶字串。
    *   若無記憶，則替換為空或預設文字。
3.  **發送請求**: 最終發送給 AI 的 System Prompt 會包含：
    ```text
    [Memory: 這是與角色A在聊天室1的長期記憶摘要...]
    ```
    這讓 AI 在生成回應前，先「閱讀」到了過去的重點。

#### B. 記憶的更新 (Update Mechanism)
記憶不會自動更新 (為了節省 Token 與控制品質)，而是由使用者手動觸發「更新記憶」功能。

*   **觸發點**: UI 上的「更新記憶」按鈕。
*   **處理邏輯** (`js/handlers.js` -> `handleUpdateMemory`):
    1.  **獲取歷史**: 從 `state.chatHistories` 獲取最近的對話紀錄 (例如最近 20-30 則訊息)。
    2.  **截斷保護**: 計算 Token 數，確保不超過 API 限制。
    3.  **載入摘要提示詞**: 讀取 `summarizationPrompt` (預設為：「請將以下對話的關鍵事實...總結成幾個要點...」)。
    4.  **API 請求**: 將「摘要提示詞」+「最近對話」發送給 AI 模型。
    5.  **寫入結果**: 將 AI 回傳的摘要文字，覆蓋或追加到 `state.longTermMemories` 中對應的欄位。
    6.  **持久化**: 呼叫 `saveAllLongTermMemoriesForChar` 寫入 IndexedDB。

#### C. 記憶的編輯 (Manual Editing)
使用者擁有最高權限，可以隨時修正 AI 的記憶。

*   **介面**: 點擊「查看/編輯記憶」開啟 Modal。
*   **功能**: 直接讀取 `state.longTermMemories` 的純文字內容顯示於 `textarea`，修改後直接存回。這對於修正 AI 的錯誤認知或強制加入特定設定非常有用。

### 3.3 記憶與 Context Window 的關係
*   **短期記憶 (Short-term)**: 依賴 API 的 `messages` 陣列 (Context Window)，直接包含最近的 N 則對話。這是最精確的。
*   **長期記憶 (Long-term)**: 依賴 System Prompt 中的 `{{memory}}` 欄位。這是經過壓縮、摘要的資訊，用於讓 AI 保持長期的一致性 (如：記得使用者的名字、兩人的關係狀態、過去發生的重大事件)。

---

## 4. 總結
幸運草 AI 聊天的架構展示了一個典型的 **Local-First (本地優先)** 應用程式設計。
*   **架構面**: 透過 IndexedDB 實現了資料的完全本地化，保護使用者隱私，同時利用 PWA 技術提供接近原生 App 的體驗。
*   **記憶面**: 採用「摘要注入法」，巧妙地結合了 System Prompt 與 LLM 的摘要能力，解決了長對話中遺忘設定的問題，並給予使用者完全的控制權 (可讀、可寫、可更新)。

