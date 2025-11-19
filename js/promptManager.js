// js/promptManager.js
// 這個檔案封裝了所有與提示詞庫系統相關的核心邏輯。

import { state } from './state.js';
import { DEFAULT_PROMPT_SET } from './constants.js';

/**
 * @description 解析使用者上傳的 SillyTavern V2 提示詞庫 JSON 檔案
 * @param {string} fileContent - 讀取的檔案內容字串
 * @param {string} fileName - 檔案名稱
 * @returns {Object} - 解析後符合我們應用程式結構的提示詞庫物件
 */
export function parsePromptSetFile(fileContent, fileName) {
    try {
        const data = JSON.parse(fileContent);

        if (!data.prompts || !Array.isArray(data.prompts) || !data.prompt_order || !Array.isArray(data.prompt_order)) {
            throw new Error('檔案格式不符，缺少 "prompts" 或 "prompt_order" 陣列。');
        }

        const orderGroup = data.prompt_order.find(group => group.character_id === 100001) || data.prompt_order[0];
        if (!orderGroup || !orderGroup.order) {
            throw new Error("在檔案中找不到有效的 'prompt_order' 順序列表。");
        }
        const orderArray = orderGroup.order;

        const moduleMap = new Map(data.prompts.map(p => [p.identifier, p]));

        const newPrompts = orderArray.map((orderItem, index) => {
            const moduleData = moduleMap.get(orderItem.identifier);
            if (!moduleData) return null;

            const positionData = moduleData.position || {};
            const positionType = (positionData.depth !== undefined) ? 'chat' : 'relative';

            return {
                identifier: moduleData.identifier,
                name: moduleData.name || `未命名模組 ${index + 1}`,
                enabled: orderItem.enabled,
                role: moduleData.role || 'system',
                content: moduleData.content || '',
                position: {
                    type: positionType,
                    depth: positionData.depth ?? 4
                },
                order: index,
            };
        }).filter(Boolean);

        const newPromptSet = {
            id: `prompt_set_${Date.now()}`,
            name: fileName.replace(/\.json$/i, ''),
            prompts: newPrompts,
        };

        return newPromptSet;

    } catch (error) {
        console.error("解析提示詞庫檔案失敗:", error);
        throw new Error(`檔案解析失敗: ${error.message}`);
    }
}


/**
 * @description 獲取當前作用中的提示詞設定檔
 * @returns {Object} - 當前啟用的提示詞庫物件，若找不到則回傳預設值
 */
export function getActivePromptSet() {
    if (!state.activePromptSetId) {
        return DEFAULT_PROMPT_SET;
    }
    const activeSet = state.promptSets.find(ps => ps.id === state.activePromptSetId);
    return activeSet || DEFAULT_PROMPT_SET;
}

/**
 * @description 根據啟用提示詞的深度(injection_depth)和順序(order)，建構最終要發送給 API 的訊息陣列
 * @param {Array<Object>} chatHistory - 當前的對話歷史紀錄
 * @returns {Array<Object>} - 包含 {role, content} 物件，且已插入提示詞的最終陣列
 */
export function buildFinalMessages(chatHistory) {
    const activePromptSet = getActivePromptSet();
    if (!activePromptSet || !activePromptSet.prompts) return chatHistory;

    const enabledPrompts = activePromptSet.prompts
        .filter(p => p.enabled && p.identifier !== 'chatHistory')
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    let finalMessages = [...chatHistory];

    enabledPrompts.forEach(prompt => {
        const finalContent = replacePlaceholders(prompt.content);
        const message = {
            role: prompt.role || 'system',
            content: finalContent
        };
        
        const position = prompt.position || { type: 'relative' };

        if (position.type === 'chat') {
            const insertionIndex = Math.max(0, finalMessages.length - (position.depth || 0));
            finalMessages.splice(insertionIndex, 0, message);
        } else { // 'relative'
             finalMessages.unshift(message);
        }
    });
    
    return finalMessages;
}


/**
 * @description 替換提示詞內容中的預留位置 (placeholders)。
 * @param {string} text - 含有預留位置的原始字串
 * @returns {string} - 替換後的字串
 */
export function replacePlaceholders(text) {
    if (typeof text !== 'string') return '';
    if (!state.activeCharacterId || !state.activeChatId) return text;

    const char = state.characters.find(c => c.id === state.activeCharacterId);
    if (!char) return text;

    const metadata = state.chatMetadatas[state.activeCharacterId]?.[state.activeChatId] || {};
    const currentPersonaId = metadata.userPersonaId || state.activeUserPersonaId;
    const user = state.userPersonas.find(p => p.id === currentPersonaId) || state.userPersonas[0] || {};
    const memory = state.longTermMemories[state.activeCharacterId]?.[state.activeChatId] || '無';

    let result = text;
    result = result.replace(/{{char}}/g, char.name || 'char');
    result = result.replace(/{{user}}/g, user.name || 'user');
    
    result = result.replace(/{{personality}}/g, `${char.description || ''}`);
    result = result.replace(/{{scenario}}/g, `${char.scenario || ''}`);
    result = result.replace(/{{exampleDialogue}}/g, `${char.exampleDialogue || ''}`);
    result = result.replace(/{{memory}}/g, `${memory}`);

    return result;
}

/**
 * @description 獲取特定用途的提示詞內容
 * @param {string} identifier - 提示詞的唯一識別碼
 * @returns {string|null} - 找到的提示詞內容，或 null
 */
export function getPromptContentByIdentifier(identifier) {
    const activePromptSet = getActivePromptSet();
    const prompt = activePromptSet.prompts.find(p => p.identifier === identifier && p.enabled);
    if (!prompt) {
        const defaultPrompt = DEFAULT_PROMPT_SET.prompts.find(p => p.identifier === identifier);
        return defaultPrompt ? defaultPrompt.content : null;
    }
    return prompt.content;
}
