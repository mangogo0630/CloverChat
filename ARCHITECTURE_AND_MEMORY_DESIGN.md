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
| `js/sceneMapManager.js` | **場景地圖管理**。管理場景樹狀結構、關鍵字映射與場景資訊的動態注入。 |
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

## 4. 場景地圖設計 (Scene Map Design)

場景地圖系統是一個智慧化的情境追蹤機制，讓 AI 能夠「感知」當前場景中的物件與狀態，提升角色扮演的真實感與沉浸度。

### 4.1 資料結構 (Data Structure)
場景地圖採用**樹狀結構**，並與長期記憶相同，每個「角色」的每個「聊天室」都有獨立的場景狀態。

*   **儲存位置**: `state.sceneStates`
*   **資料結構**: 巢狀物件 + 樹狀節點
    ```javascript
    state.sceneStates = {
        "character_id_A": {
            "chat_session_id_1": {
                name: "預設場景",
                rootNodes: ["node_home"],  // 根節點 ID 列表
                nodes: {
                    "node_home": {
                        id: "node_home",
                        name: "家",
                        type: "location",      // 類型: location/container/item
                        description: "一個溫馨的小公寓",
                        keywords: ["家", "房子"],
                        children: ["node_kitchen", "node_bedroom"],
                        parent: null
                    },
                    "node_kitchen": {
                        id: "node_kitchen",
                        name: "廚房",
                        type: "location",
                        description: "開放式廚房，有流理台和瓦斯爐",
                        keywords: ["廚房", "煮飯"],
                        children: ["node_fridge"],
                        parent: "node_home"
                    },
                    // ... 更多節點
                },
                lastUpdated: "2025-11-28T12:00:00.000Z"
            }
        }
    }
    ```
*   **節點類型**:
    *   `location`: 地點/場所（如：家、廚房、公園）
    *   `container`: 容器/收納空間（如：冰箱、抽屜）
    *   `item`: 物品/道具（如：手機、鑰匙）

### 4.2 關鍵字映射系統 (Keyword Mapping)
為了自動判斷對話與哪些場景相關，系統維護了一個全域的關鍵字映射表。

*   **儲存位置**: `state.sceneKeywordMap`
*   **資料結構**:
    ```javascript
    state.sceneKeywordMap = {
        "吃": ["fridge", "kitchen", "stove"],
        "睡": ["bedroom", "bed"],
        "手機": ["phone"],
        "冰箱": ["fridge"],
        // ... 更多映射
    }
    ```
*   **作用**: 當使用者訊息包含「吃」、「飯」、「煮」等關鍵字時，系統會自動找出相關的場景節點（如廚房、冰箱），並將這些節點的詳細資訊注入到提示詞中。

### 4.3 運作流程 (Workflow)

#### A. 場景的注入 (Injection)
當使用者發送訊息時，系統會動態分析並注入相關場景資訊：

1.  **關鍵字匹配**: `js/sceneMapManager.js` 的 `buildRelevantScenePrompt` 函式分析最近 5 則訊息。
2.  **節點查找**: 根據關鍵字映射表，找出所有可能相關的場景節點。
3.  **路徑構建**: 為每個相關節點建構完整路徑（如：`家 > 廚房 > 冰箱`）。
4.  **提示詞生成**: 生成結構化的場景資訊段落。
    ```text
    ===【相關場景】===
    
    【家 > 廚房】
    - 描述：開放式廚房，有流理台和瓦斯爐
    - 關鍵字：廚房, 煮飯
    
    【家 > 廚房 > 冰箱】
    - 描述：雙門冰箱，裡面有新鮮蔬菜和飲料
    - 關鍵字：冰箱, 食物
    ```
5.  **注入位置**: 由 `js/promptManager.js` 的 `buildFinalMessages` 函式，將場景提示詞插入在第一個 system 訊息之後。

#### B. 場景的編輯 (Manual Editing)
使用者擁有完全的場景控制權，可透過場景編輯器進行管理。

*   **介面**: 點擊聊天介面的「場景地圖」按鈕開啟編輯器。
*   **功能**:
    *   **視圖模式**:
        *   **欄位視圖 (Columns View)**: 採用類似檔案總管的欄位式導航，左側顯示根節點列表，右側顯示選定節點的子節點，適合深度編輯與移動節點。
    *   **新增節點**: 可新增子節點（位置、容器或物品）。
    *   **編輯節點**: 修改名稱、描述、關鍵字。
    *   **拖曳排序**: 
        *   支援跨層級拖曳，根節點可透過左/右視覺提示進行精確排序。
        *   設有專用的「拖曳至此建立新根節點」放置區。
    *   **刪除節點**: 刪除節點及其所有子節點。
*   **持久化**: 所有修改立即寫入 `state.sceneStates`，並呼叫 `saveAllSceneStatesForChar` 儲存到 IndexedDB。

#### C. AI 輔助場景更新 (Optional)
系統提供可選的 AI 輔助功能，讓場景狀態根據對話自動更新。

*   **觸發時機**: 當使用者開啟 `enableAiSceneAnalysis` 設定（預設開啟）。
*   **處理邏輯** (`js/api.js` -> `analyzeAndUpdateScene`):
    1.  **對話分析**: 將最近的對話與當前場景地圖發送給 AI。
    2.  **變更偵測**: AI 判斷是否有場景狀態改變（如：「打開冰箱」、「離開房間」）。
    3.  **建議更新**: AI 回傳建議的場景描述更新。
    4.  **使用者確認**: 系統彈出確認視窗，讓使用者決定是否套用更新。
    5.  **套用變更**: 若確認，則更新對應節點的描述並儲存。

### 4.4 場景與其他系統的關係

*   **與長期記憶的差異**:
    *   **長期記憶**: 摘要「發生過的事件」與「角色狀態」（如：兩人的關係進展）。
    *   **場景地圖**: 記錄「環境的結構」與「物件的狀態」（如：冰箱裡有什麼）。
    
*   **與世界書的差異**:
    *   **世界書 (Lorebook)**: 儲存「靜態的世界觀知識」（如：角色背景設定、世界規則）。
    *   **場景地圖**: 儲存「動態的場景狀態」（隨對話變化，如：手機從桌上被拿起來）。

*   **資料隔離**: 場景地圖與聊天歷史、長期記憶完全分離儲存，互不干擾。每個聊天室的場景是獨立的。

### 4.5 匯入匯出支援
場景地圖與其他資料一樣，支援完整的備份與恢復。

*   **全域匯出**: 包含所有角色的所有聊天室的場景地圖。
*   **單個聊天室匯出 (JSONL)**: 在 metadata 區塊包含 `scene_map` 欄位。
*   **場景專屬匯出 (JSON)**: 
    *   可在場景編輯器中直接點擊「匯出」按鈕，單獨匯出當前聊天室的場景地圖與關鍵字映射。
    *   匯出的 JSON 檔案包含完整的場景結構 (`sceneMap`) 與全域關鍵字映射 (`keywordMapping`)。
    *   適合分享場景設定或建立場景模板。
*   **匯入**: 
    *   支援全域還原（從完整備份恢復所有場景）。
    *   支援單一聊天室還原（從 JSONL 檔案恢復特定聊天的場景）。
    *   支援場景專屬 JSON 檔案的匯入：
        *   場景地圖會覆蓋當前聊天室的場景。
        *   關鍵字映射可選擇合併到全域設定（保留現有，新增不存在的關鍵字）。
        *   提供確認對話框以防誤操作。

---

## 5. 總結
幸運草 AI 聊天的架構展示了一個典型的 **Local-First (本地優先)** 應用程式設計。
*   **架構面**: 透過 IndexedDB 實現了資料的完全本地化，保護使用者隱私，同時利用 PWA 技術提供接近原生 App 的體驗。
*   **記憶面**: 採用「摘要注入法」，巧妙地結合了 System Prompt 與 LLM 的摘要能力，解決了長對話中遺忘設定的問題，並給予使用者完全的控制權 (可讀、可寫、可更新)。
*   **場景面**: 創新性地引入「樹狀場景地圖」與「智慧關鍵字映射」系統，讓 AI 能夠感知對話中的環境與物件狀態，大幅提升角色扮演的沉浸感。同時透過可選的 AI 輔助更新，在自動化與使用者控制之間取得平衡。

此三層設計（架構 + 記憶 + 場景）構成了一個完整的情境感知系統，讓 AI 不僅能「記住過去」，還能「理解環境」，從而提供更真實、更連貫的對話體驗。

