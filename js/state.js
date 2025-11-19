// js/state.js
// 這個檔案負責管理整個應用程式的狀態，並與 IndexedDB 互動。

import { DEFAULT_PROMPT_SET, DEFAULT_LOREBOOK, DEFAULT_SUMMARY_PROMPT } from './constants.js';
import * as db from './db.js';

// 應用程式的核心狀態物件
export let state = {
    currentUser: null,
    isPremiumUser: false, 
    isInitialLoad: false,
    characters: [],
    chatHistories: {}, 
    longTermMemories: {},
    chatMetadatas: {}, 
    userPersonas: [],
    apiPresets: [], 
    
    promptSets: [],
    activePromptSetId: null,

    lorebooks: [],

    activeUserPersonaId: null,
    activeCharacterId: null,
    activeChatId: null,
    globalSettings: {},
};

// 暫存的編輯狀態
export let tempState = {
    editingCharacterId: null,
    editingUserPersonaId: null,
    renamingChatId: null,
    apiCallController: null,
    isScreenshotMode: false,
    selectedMessageIndices: [],
    editingPromptIdentifier: null, 
    editingLorebookId: null, // 用於條目編輯視窗
    editingLorebookEntryId: null,
    deletingMessageInfo: null,
    // [新增] 用於暫存角色卡匯入時的額外資料
    importedData: null,
    importedLorebook: null,
    importedRegex: null,
    importedImageBase64: null,
};

/**
 * @description 從 IndexedDB 載入應用程式狀態
 */
export async function loadStateFromDB() {
    const settingsData = await db.get('keyValueStore', 'settings');
    if (settingsData) {
        state.globalSettings = settingsData.globalSettings || {};
        state.activeUserPersonaId = settingsData.activeUserPersonaId || null;
        state.activeCharacterId = settingsData.activeCharacterId || null;
        state.activeChatId = settingsData.activeChatId || null;
        state.apiPresets = settingsData.apiPresets || [];
        state.activePromptSetId = settingsData.activePromptSetId || null;
    }

    // 初始化記憶生成提示
    if (state.globalSettings.summarizationPrompt === undefined) {
        state.globalSettings.summarizationPrompt = DEFAULT_SUMMARY_PROMPT;
    }

    // 初始化正規表達式規則
    if (!state.globalSettings.regexRules) {
        state.globalSettings.regexRules = [
            {
                id: `regex_default_cot`,
                name: '消除思考(COT)',
                find: '<think>[\\s\\S]*?<\\/think>',
                replace: '',
                enabled: true
            },
            {
                id: `regex_default_tags`,
                name: '移除標籤',
                find: '(.*?<\\/thinking>\\n)(.*?<content[\\s\\S]*?>\\n)(.*?)(<\\/content>|<\\(\\)content_>)',
                replace: '$3',
                enabled: true
            }
        ];
    }



    state.characters = await db.getAll('characters');
    state.userPersonas = await db.getAll('userPersonas');
    state.promptSets = await db.getAll('promptSets');
    state.lorebooks = await db.getAll('lorebooks'); 

    if (state.characters.length === 0) {
        try {
            const response = await fetch('js/default_characters.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const defaultCharacters = await response.json();
            
            for (const char of defaultCharacters) {
                if (typeof char.firstMessage === 'string') {
                    char.firstMessage = [char.firstMessage];
                }
                char.loved = char.loved || false;
                char.order = char.order || state.characters.length;
                char.scenario = char.scenario || ''; // 確保新角色有 scenario 欄位
                await db.put('characters', char);
            }
            state.characters = await db.getAll('characters');
            console.log('成功從 JSON 檔案載入預設角色。');
        } catch (error) {
            console.error("無法載入預設角色檔案 'js/default_characters.json':", error);
            alert("錯誤：無法載入預設角色資料，請檢查主控台。");
        }
    } else {
        let charMigrationNeeded = false;
        const updatePromises = state.characters.map((char, index) => {
            let updated = false;
            if (char.loved === undefined) {
                char.loved = false;
                updated = true;
            }
            if (char.order === undefined) {
                char.order = index;
                updated = true;
            }
            if (typeof char.firstMessage === 'string') {
                char.firstMessage = [char.firstMessage];
                updated = true;
            }
            if (char.scenario === undefined) { // 為舊角色新增 scenario 欄位
                char.scenario = '';
                updated = true;
            }
            if (updated) {
                charMigrationNeeded = true;
                return db.put('characters', char);
            }
            return Promise.resolve();
        });
        await Promise.all(updatePromises);
        if (charMigrationNeeded) {
            console.log("資料遷移完成: 角色資料已更新。");
        }
    }

    if (state.userPersonas.length === 0) {
        const defaultPersona = { id: `user_${Date.now()}`, name: 'User', description: '', avatarUrl: 'https://placehold.co/100x100/EFEFEF/AAAAAA?text=頭像' };
        await db.put('userPersonas', defaultPersona);
        state.userPersonas.push(defaultPersona);
        state.activeUserPersonaId = defaultPersona.id;
    }

    if (state.promptSets.length === 0) {
        await db.put('promptSets', DEFAULT_PROMPT_SET);
        state.promptSets.push(DEFAULT_PROMPT_SET);
    }
    
    // [修改] 為舊的世界書資料加上 enabled 屬性
    if (state.lorebooks.length === 0) {
        const defaultBookCopy = JSON.parse(JSON.stringify(DEFAULT_LOREBOOK));
        defaultBookCopy.enabled = true; // 預設啟用
        await db.put('lorebooks', defaultBookCopy);
        state.lorebooks.push(defaultBookCopy);
    } else {
        let lorebookMigrationNeeded = false;
        const updatePromises = state.lorebooks.map(book => {
            if (book.enabled === undefined) {
                // 如果是從舊的 activeLorebookId 系統遷移，則只啟用那一個
                book.enabled = (settingsData && settingsData.activeLorebookId) ? book.id === settingsData.activeLorebookId : false;
                lorebookMigrationNeeded = true;
                return db.put('lorebooks', book);
            }
            return Promise.resolve();
        });
        await Promise.all(updatePromises);
        if (lorebookMigrationNeeded) {
            console.log("資料遷移完成: 世界書已更新為多重啟用模式。");
        }
    }
    
    if (!state.activePromptSetId || !state.promptSets.find(ps => ps.id === state.activePromptSetId)) {
        state.activePromptSetId = state.promptSets[0]?.id || null;
    }

    // [移除] 不再需要單一啟用ID
    // if (!state.activeLorebookId || !state.lorebooks.find(lb => lb.id === state.activeLorebookId)) {
    //     state.activeLorebookId = state.lorebooks[0]?.id || null;
    // }

    await saveSettings();

    if (state.activeCharacterId) {
        await loadChatDataForCharacter(state.activeCharacterId);
    }
}

/**
 * @description 載入指定角色的所有對話相關資料
 */
export async function loadChatDataForCharacter(charId) {
    const histories = await db.get('chatHistories', charId);
    const memories = await db.get('longTermMemories', charId);
    const metadatas = await db.get('chatMetadatas', charId);

    state.chatHistories[charId] = histories ? histories.data : {};
    state.longTermMemories[charId] = memories ? memories.data : {};
    state.chatMetadatas[charId] = metadatas ? metadatas.data : {};

    if (state.chatMetadatas[charId]) {
        let metaMigrationNeeded = false;
        Object.values(state.chatMetadatas[charId]).forEach((meta, index) => {
            if (meta.order === undefined) {
                meta.order = index;
                metaMigrationNeeded = true;
            }
        });
        if (metaMigrationNeeded) {
            await saveAllChatMetadatasForChar(charId);
            console.log(`資料遷移完成: 角色 ${charId} 的聊天室已新增 'order' 屬性。`);
        }
    }
}

// ===================================================================================
// 資料儲存函式
// ===================================================================================

export function saveSettings() {
    const settingsData = {
        key: 'settings',
        globalSettings: state.globalSettings,
        activeUserPersonaId: state.activeUserPersonaId,
        activeCharacterId: state.activeCharacterId,
        activeChatId: state.activeChatId,
        apiPresets: state.apiPresets,
        activePromptSetId: state.activePromptSetId, 
    };
    return db.put('keyValueStore', settingsData);
}

export function saveCharacter(character) {
    return db.put('characters', character);
}

export function deleteCharacter(charId) {
    return db.deleteItem('characters', charId);
}

export function saveUserPersona(persona) {
    return db.put('userPersonas', persona);
}

export function deleteUserPersona(personaId) {
    return db.deleteItem('userPersonas', personaId);
}

export function saveAllChatHistoriesForChar(charId) {
    return db.put('chatHistories', { id: charId, data: state.chatHistories[charId] });
}

export function saveAllLongTermMemoriesForChar(charId) {
    return db.put('longTermMemories', { id: charId, data: state.longTermMemories[charId] });
}

export function saveAllChatMetadatasForChar(charId) {
    return db.put('chatMetadatas', { id: charId, data: state.chatMetadatas[charId] });
}

export async function deleteAllChatDataForChar(charId) {
    await db.deleteItem('chatHistories', charId);
    await db.deleteItem('longTermMemories', charId);
    await db.deleteItem('chatMetadatas', charId);
}

export function savePromptSet(promptSet) {
    return db.put('promptSets', promptSet);
}

export function deletePromptSet(promptSetId) {
    return db.deleteItem('promptSets', promptSetId);
}

// 新增 Lorebook 相關儲存函式
export function saveLorebook(lorebook) {
    return db.put('lorebooks', lorebook);
}

export function deleteLorebook(lorebookId) {
    return db.deleteItem('lorebooks', lorebookId);
}

