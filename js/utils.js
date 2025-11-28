// js/utils.js
// 這個檔案存放一些通用的輔助函式 (utility/helper functions)。

import * as DOM from './dom.js';
import { tempState, state } from './state.js';
import { DEFAULT_AVATAR } from './constants.js';
import { renderFirstMessageInputs, showAdvancedImportModal } from './ui.js';

/**
 * @description HTML 轉義函數，防範 XSS 攻擊
 * @param {string} unsafe - 需要轉義的字串
 * @returns {string} - 轉義後的安全字串
 */
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * @description 安全地渲染 Markdown 內容，防範 XSS 攻擊
 * @param {string} content - Markdown 內容
 * @returns {string} - 經過清理的安全 HTML
 */
export function safeRenderMarkdown(content) {
    if (typeof content !== 'string') return '';
    
    let html;
    // [最終修復] 採用混合模式解決 HTML 與換行問題：
    // 1. 判斷內容是否以 HTML 標籤開頭。
    if (content.trim().startsWith('<')) {
        // 2. 如果是，我們假定它是 HTML，手動將換行符 `\n` 轉換為 `<br>`。
        //    這樣可以避免 marked.js 破壞原有的 HTML 結構。
        html = content.replace(/\n/g, '<br>');
    } else {
        // 3. 如果不是，我們將其視為標準 Markdown，讓 marked.js 處理所有格式，
        //    包括 `breaks: true` 選項來自動處理換行。
        html = marked.parse(content, { gfm: true, breaks: true });
    }

    // 4. 無論通過哪條路徑，最終都使用 DOMPurify 進行安全過濾。
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'hr',
            'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 
            'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 
            'tbody', 'tr', 'th', 'td', 'font'
        ],
        ALLOWED_ATTR: ['class', 'style', 'color', 'size'],
        ALLOWED_CSS_PROPERTIES: [
            'color', 'background-color', 'border', 'border-radius', 
            'padding', 'margin', 'font-weight', 'font-style', 'text-decoration',
            'text-align', 'display', 'width', 'height'
        ],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_DOM_IMPORT: false
    });
}


/**
 * @description 安全地設置元素的 HTML 內容
 * @param {HTMLElement} element - 目標元素
 * @param {string} content - 要設置的內容
 * @param {boolean} isMarkdown - 是否為 Markdown 內容
 */
export function setSafeInnerHTML(element, content, isMarkdown = false) {
    if (!element || typeof content !== 'string') return;
    
    if (isMarkdown) {
        element.innerHTML = safeRenderMarkdown(content);
    } else {
        element.innerHTML = escapeHtml(content);
    }
}

/**
 * @description 安全地創建 HTML 模板字串
 * @param {string} template - HTML 模板
 * @param {Object} data - 要插入的資料
 * @returns {string} - 安全的 HTML 字串
 */
export function createSafeTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(placeholder, escapeHtml(String(value)));
    }
    return result;
}

/**
 * @description 設定 --app-height CSS 變數，以解決行動裝置瀏覽器高度問題
 */
export function setAppHeight() {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
}

/**
 * @description 應用目前儲存的主題
 * @param {string} [theme] - 'light', 'dark', 'a', 或 'b'。如果未提供，則從 localStorage 讀取。
 */
export function applyTheme(theme) {
    // 如果沒有傳入主題，則嘗試從 localStorage 讀取，若無則使用預設 'light'
    const themeToApply = theme || localStorage.getItem('theme') || 'light';
    
    // 獲取 <html> 元素
    const root = document.documentElement;
    
    // 先移除所有可能的主題 class
    root.classList.remove('dark-mode', 'theme-a', 'theme-b');

    // 根據要應用的主題，加上對應的 class
    if (themeToApply === 'dark') {
        root.classList.add('dark-mode');
    } else if (themeToApply === 'a') {
        root.classList.add('theme-a');
    } else if (themeToApply === 'b') {
        root.classList.add('theme-b');
    }
    // 'light' 主題不需要額外的 class，因為它是預設

    // 將選擇的主題儲存到 localStorage
    localStorage.setItem('theme', themeToApply);
}


/**
 * @description 同步滑桿 (range input) 和數字輸入框 (number input) 的值
 * @param {HTMLInputElement} slider - 滑桿元素
 * @param {HTMLInputElement} numberInput - 數字輸入框元素
 */
export function setupSliderSync(slider, numberInput) {
    slider.addEventListener('input', () => numberInput.value = slider.value);
    numberInput.addEventListener('input', () => slider.value = numberInput.value);
}

/**
 * @description 處理圖片上傳、壓縮並預覽
 * @param {Event} event - input change 事件
 * @param {HTMLImageElement} previewElement - 預覽圖片的 img 元素
 */
export function handleImageUpload(event, previewElement) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let { width, height } = img;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            previewElement.src = canvas.toDataURL('image/jpeg', 0.7);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * @description 匯出角色資料為 JSON 檔案
 */
export function exportCharacter() {
    if (!tempState.editingCharacterId) { alert('請先儲存角色後再匯出。'); return; }
    const char = state.characters.find(c => c.id === tempState.editingCharacterId);
    
    const characterData = {
        spec: 'chara_card_v2',
        data: {
            name: char.name,
            description: char.description,
            scenario: char.scenario, // 新增：匯出場景
            first_mes: char.firstMessage[0] || '',
            mes_example: char.exampleDialogue,
            alternate_greetings: char.firstMessage.slice(1),
            // 為了更好的相容性，同時保留 firstMessage
            firstMessage: char.firstMessage, 
            character_avatar: char.avatarUrl,
            // 新增：匯出元數據
            creator: char.creator,
            character_version: char.characterVersion,
            creator_notes: char.creatorNotes,
        }
    };

    const blob = new Blob([JSON.stringify(characterData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${char.name || 'character'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * @description 觸發檔案選擇器並處理角色卡的匯入流程。
 */
export function importCharacter() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.png';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                try { 
                    const jsonData = JSON.parse(e.target.result);
                    populateEditorWithCharData(jsonData); 
                } catch (error) { 
                    alert('匯入失敗，JSON 檔案格式錯誤。'); 
                    console.error('JSON Import error:', error); 
                } 
            };
            reader.readAsText(file, 'UTF-8'); 
        
        } else if (file.type === 'image/png') {
            // [修復] 為了避免競爭條件 (race condition)，我們首先將檔案讀取為 Data URL。
            // 這樣可以確保在解析 PNG 區塊之前，圖片的 Base64 字串已經準備好。
            const dataUrlReader = new FileReader();
            
            dataUrlReader.onload = (e_url) => {
                const fileAsDataURL = e_url.target.result;

                // 在 Data URL 讀取成功後，再將同一個檔案讀取為 ArrayBuffer 來進行解析。
                const arrayBufferReader = new FileReader();
                arrayBufferReader.onload = (e_buffer) => {
                    try {
                        const arrayBuffer = e_buffer.target.result;
                        const dataView = new DataView(arrayBuffer);
                        
                        if (dataView.getUint32(0) !== 0x89504E47 || dataView.getUint32(4) !== 0x0D0A1A0A) {
                            throw new Error('不是有效的 PNG 檔案。');
                        }
                        
                        let offset = 8;
                        let characterDataFound = false;
                        
                        while (offset < arrayBuffer.byteLength) {
                            const length = dataView.getUint32(offset);
                            const type = new TextDecoder("ascii").decode(new Uint8Array(arrayBuffer, offset + 4, 4));
                            
                            // 檢查 chunk 是否有效
                            if (length > arrayBuffer.byteLength - (offset + 8)) {
                                console.warn('偵測到無效的 PNG chunk 長度，停止解析。');
                                break;
                            }
                            const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);
                            
                            if (type === 'tEXt' || type === 'iTXt') {
                                const nullSeparatorIndex = chunkData.indexOf(0);
                                if (nullSeparatorIndex === -1) {
                                    offset += 12 + length;
                                    continue;
                                }
                                const keyword = new TextDecoder("ascii").decode(chunkData.slice(0, nullSeparatorIndex));

                                if (keyword === 'chara') {
                                    let textPayloadOffset = nullSeparatorIndex + 1;
                                    
                                    if (type === 'iTXt') {
                                        if (chunkData[textPayloadOffset] === 0 || chunkData[textPayloadOffset] === 1) { 
                                             textPayloadOffset++; 
                                             textPayloadOffset++; 
                                             while(chunkData[textPayloadOffset] !== 0 && textPayloadOffset < chunkData.length) textPayloadOffset++; 
                                             textPayloadOffset++;
                                             while(chunkData[textPayloadOffset] !== 0 && textPayloadOffset < chunkData.length) textPayloadOffset++; 
                                             textPayloadOffset++;
                                        }
                                    }

                                    const base64Data = new TextDecoder("ascii").decode(chunkData.slice(textPayloadOffset));
                                    
                                    const decodedJsonString = new TextDecoder().decode(
                                        Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
                                    );
                                    
                                    const jsonData = JSON.parse(decodedJsonString);
                                    // 此時 fileAsDataURL 必定有值
                                    populateEditorWithCharData(jsonData, fileAsDataURL);
                                    characterDataFound = true;
                                    break;
                                }
                            } else if (type === 'zTXt') {
                                const nullSeparatorIndex = chunkData.indexOf(0);
                                if (nullSeparatorIndex !== -1) {
                                    const keyword = new TextDecoder("ascii").decode(chunkData.slice(0, nullSeparatorIndex));
                                    if (keyword === 'chara') {
                                          alert('偵測到壓縮格式(zTXt)的角色卡，目前版本尚不支援解壓縮。');
                                          characterDataFound = true; 
                                          break;
                                    }
                                }
                            }
                            
                            offset += 12 + length;
                        }

                        if (!characterDataFound) { 
                            alert('在這張 PNG 圖片中找不到可識別的角色卡資料。'); 
                        }
                    } catch (error) { 
                        alert('匯入 PNG 失敗，檔案可能已損壞、格式不符或不包含角色資料。'); 
                        console.error('PNG Import error:', error); 
                    }
                };
                
                arrayBufferReader.onerror = () => {
                    alert('讀取 PNG 檔案內容失敗。');
                };
                arrayBufferReader.readAsArrayBuffer(file);
            };
            
            dataUrlReader.onerror = () => {
                alert('讀取 PNG 檔案失敗。');
            };

            dataUrlReader.readAsDataURL(file);

        } else { 
            alert('不支援的檔案格式。請選擇 .json 或 .png 檔案。'); 
        }
    };
    input.click();
}

/**
 * @description 將從角色卡解析出的資料填入角色編輯器中。
 * @param {object} importedData - 解析後的 JSON 物件。
 * @param {string|null} imageBase64 - 如果是從 PNG 匯入，則傳入圖片的 Base64 字串。
 */
function populateEditorWithCharData(importedData, imageBase64 = null) {
    if (!importedData) {
        alert("匯入失敗：檔案內容為空或無法讀取。");
        return;
    }
    
    const data = importedData.data || importedData;
    
    // --- V1/V2/V3 相容性處理 ---
    let description = data.description || data.personality || '';
    let lorebookSource = data.lorebook || data.character_book; // 檢查 V2 的 lorebook 和 V3 的 character_book
    let regexDataSource = data.post_history_instructions;

    // 如果找不到 V2/V3 的 lorebook 欄位，就嘗試從 V1 的 description 中解析
    if (!lorebookSource) {
        const lorebookRegex = /\[Lorebook\]\s*(\{.*\})/is;
        const lorebookMatch = description.match(lorebookRegex);
        if (lorebookMatch && lorebookMatch[1]) {
            try {
                const lorebookJsonString = lorebookMatch[1];
                const parsedLorebook = JSON.parse(lorebookJsonString);
                // V1 格式的 entries 是一個物件，需要轉換
                lorebookSource = { entries: Object.values(parsedLorebook) };
                description = description.replace(lorebookRegex, '').trim();
            } catch (e) {
                console.error("從描述中解析世界書 JSON 失敗:", e);
            }
        }
    }
    // --- 相容性處理結束 ---

    const hasValidLorebook = lorebookSource && 
                             ((Array.isArray(lorebookSource.entries) && lorebookSource.entries.length > 0) ||
                              (typeof lorebookSource.entries === 'object' && lorebookSource.entries !== null && Object.keys(lorebookSource.entries).length > 0));

    const hasValidRegex = regexDataSource && typeof regexDataSource === 'string' && regexDataSource.trim() !== '';
    
    // 建立一份新的資料物件，其中包含清理過的 description
    const cleanedImportedData = {
        ...importedData,
        data: {
            ...data,
            description: description 
        }
    };

    if (hasValidLorebook || hasValidRegex) {
        showAdvancedImportModal(cleanedImportedData, hasValidLorebook ? lorebookSource : null, hasValidRegex ? regexDataSource : null, imageBase64);
    } else {
        populateEditorFields(cleanedImportedData, imageBase64);
    }
}


/**
 * @description [NEW] 實際將角色卡資料填入編輯器欄位的函式
 * @param {object} importedData - 解析後的 JSON 物件。
 * @param {string|null} imageBase64 - 如果是從 PNG 匯入，則傳入圖片的 Base64 字串。
 */
export function populateEditorFields(importedData, imageBase64 = null) {
    const data = importedData.data || importedData;
    
    DOM.charNameInput.value = data.name || '';
    // [修正] 確保使用清理過的 description
    DOM.charDescriptionInput.value = data.description || data.personality || '';
    DOM.charScenarioInput.value = data.scenario || '';

    DOM.charCreatorInput.value = data.creator || '';
    DOM.charVersionInput.value = data.character_version || data.characterVersion || '';
    DOM.charCreatorNotesInput.value = data.creator_notes || data.creatorNotes || '';
    
    let allGreetings = [];

    if (data.first_mes && typeof data.first_mes === 'string' && data.first_mes.trim() !== '') {
        allGreetings.push(data.first_mes.trim());
    }

    if (data.alternate_greetings && Array.isArray(data.alternate_greetings)) {
        const validAlternateGreetings = data.alternate_greetings
            .filter(g => typeof g === 'string' && g.trim() !== '')
            .map(g => g.trim());
        allGreetings = allGreetings.concat(validAlternateGreetings);
    }

    // 為了相容性，也檢查 V1 格式的 firstMessage
    if (allGreetings.length === 0 && data.firstMessage && Array.isArray(data.firstMessage)) {
         const validFirstMessages = data.firstMessage
            .filter(g => typeof g === 'string' && g.trim() !== '')
            .map(g => g.trim());
        allGreetings = allGreetings.concat(validFirstMessages);
    }

    if (allGreetings.length === 0) {
        allGreetings.push('');
    }
    
    renderFirstMessageInputs(allGreetings);

    DOM.charExampleDialogueInput.value = data.mes_example || data.exampleDialogue || '';
    DOM.charAvatarPreview.src = imageBase64 || data.character_avatar || DEFAULT_AVATAR;
    
    alert('角色卡資料已填入編輯器！請記得儲存。');
}


/**
 * @description [核心修改] 匯出對話為 JSONL 格式。
 * @returns {Promise<void>}
 */
export function exportChatAsJsonl() {
    return new Promise((resolve, reject) => {
        try {
            if (!state.activeCharacterId || !state.activeChatId) {
                throw new Error('沒有活躍的聊天室。');
            }
            const history = state.chatHistories[state.activeCharacterId][state.activeChatId] || [];
            if (history.length === 0) {
                alert('沒有對話可以匯出。');
                return resolve();
            }

            const activeChar = state.characters.find(c => c.id === state.activeCharacterId);
            const activeUser = state.userPersonas.find(p => p.id === state.activeUserPersonaId) || state.userPersonas[0];
            const metadata = state.chatMetadatas[state.activeCharacterId]?.[state.activeChatId] || {};
            const memory = state.longTermMemories[state.activeCharacterId]?.[state.activeChatId] || '';
            
            const now = new Date();
            const createDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}@${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}m${String(now.getSeconds()).padStart(2, '0')}s`;

            // 建立元數據物件
            const metaObject = {
                user_name: activeUser.name,
                character_name: activeChar.name,
                create_date: createDate,
                chat_metadata: metadata,
                long_term_memory: memory
            };
            
            let content = JSON.stringify(metaObject) + '\n';
            
            // 建立訊息物件
            history.forEach(message => {
                const isUser = message.role === 'user';
                const messageObject = {
                    name: isUser ? activeUser.name : activeChar.name,
                    is_user: isUser,
                    is_system: false,
                    send_date: new Date(message.timestamp).toISOString(), // 標準 ISO 8601 格式
                    mes: isUser ? message.content : message.content[message.activeContentIndex],
                    swipe_id: isUser ? null : message.activeContentIndex,
                    swipes: isUser ? null : message.content,
                };
                content += JSON.stringify(messageObject) + '\n';
            });
            
            const filename = `${activeChar.name} - ${createDate}.jsonl`;
            const blob = new Blob([content], { type: 'application/jsonl' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            resolve();
        } catch (error) {
            console.error("匯出 JSONL 失敗:", error);
            reject(error);
        }
    });
}

/**
 * @description [NEW] 解析 .jsonl 或包含多個 JSON 物件的檔案。
 * @param {string} text - 檔案內容。
 * @returns {Array<Object>} - 解析後的 JSON 物件陣列。
 */
export function parseChatLogFile(text) {
    const lines = text.split('\n');
    const jsonObjects = [];
    let currentObjectStr = '';

    for (const line of lines) {
        currentObjectStr += line;
        try {
            const parsed = JSON.parse(currentObjectStr);
            jsonObjects.push(parsed);
            currentObjectStr = ''; // Reset for the next object
        } catch (e) {
            // If it's not a complete JSON object yet, continue to the next line
            if (e instanceof SyntaxError) {
                continue;
            } else {
                // Rethrow other errors
                throw e;
            }
        }
    }

    // Handle the case where the last object might not have a trailing newline
    if (currentObjectStr.trim() !== '') {
        try {
            jsonObjects.push(JSON.parse(currentObjectStr));
        } catch (e) {
            console.error("解析最後一個 JSON 物件時失敗:", currentObjectStr, e);
        }
    }

    return jsonObjects;
}

/**
 * @description [NEW] 更可靠地解析自訂日期字串，例如 "May 1, 2025 1:08pm"。
 * @param {string} dateString - 日期字串。
 * @returns {Date} - 解析後的 Date 物件。如果失敗，則回傳一個無效日期。
 */
export function parseCustomDate(dateString) {
    if (!dateString) return new Date(NaN); // Return invalid date for empty/null input

    // Regex to capture "Month Day, Year HH:MM am/pm"
    // It's flexible with spacing and case-insensitive
    const parts = dateString.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);

    if (!parts) {
        // If custom parsing fails, fallback to the native parser
        // This allows it to still handle ISO 8601 strings or other native formats
        const fallbackDate = new Date(dateString);
        if (isNaN(fallbackDate.getTime())) {
            console.error("Custom and native parsers failed to parse date string:", dateString);
        } else {
            console.warn("Used native Date parser for:", dateString);
        }
        return fallbackDate;
    }

    const [, monthStr, day, year, hourStr, minute, ampm] = parts;
    const months = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    
    // Get the first three letters of the month and convert to lowercase for matching
    const monthKey = monthStr.substring(0, 3).toLowerCase();
    const month = months[monthKey];

    if (month === undefined) {
         console.error("Unrecognized month in date string:", dateString);
         return new Date(NaN); // Return invalid date
    }

    let hour = parseInt(hourStr, 10);

    // Adjust hour for AM/PM
    if (ampm.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
    }
    if (ampm.toLowerCase() === 'am' && hour === 12) { // Handle midnight (12 AM)
        hour = 0;
    }

    // Create a new Date object. Month is 0-indexed.
    // Note: This will be in the user's local timezone.
    return new Date(year, month, day, hour, minute);
}

