// js/lorebookManager.js
// 這個檔案封裝了所有與世界書 (Lorebook) 系統相關的核心邏輯。

import { state } from './state.js';

/**
 * @description 解析使用者上傳的 SillyTavern V2 世界書 JSON 檔案
 * @param {string} fileContent - 讀取的檔案內容字串
 * @param {string} fileName - 檔案名稱
 * @returns {Object} - 解析後符合我們應用程式結構的世界書物件
 */
export function parseLorebookFile(fileContent, fileName) {
    try {
        const data = JSON.parse(fileContent);
        if (!data.entries || typeof data.entries !== 'object') {
            throw new Error('檔案格式不符，缺少 "entries" 物件。');
        }

        const newEntries = Object.values(data.entries).map(entry => {
            const matchSources = [];
            if (entry.matchCharacterDescription) matchSources.push('char_desc');
            if (entry.matchScenario) matchSources.push('scenario');
            if (entry.matchCreatorNotes) matchSources.push('creator_notes');
            if (entry.matchPersonaDescription) matchSources.push('persona_desc');

            return {
                id: `entry_${entry.uid}_${Date.now()}`,
                name: entry.comment || '未命名條目',
                keywords: entry.key || [],
                secondaryKeywords: entry.keysecondary || [],
                content: entry.content || '',
                enabled: !entry.disable,
                constant: !!entry.constant,
                order: entry.order || 100,
                position: entry.position || 'before_char',
                scanDepth: entry.depth || 4,
                logic: entry.selectiveLogic || 0,
                matchSources: matchSources,
            };
        });

        const newLorebook = {
            id: `lorebook_${Date.now()}`,
            name: fileName.replace(/\.json$/i, ''),
            entries: newEntries,
            enabled: false, // 預設不啟用
        };

        return newLorebook;

    } catch (error) {
        console.error("解析世界書檔案失敗:", error);
        throw new Error(`檔案解析失敗: ${error.message}`);
    }
}


/**
 * @description 獲取所有當前啟用的世界書
 * @returns {Array<Object>} - 所有 enabled=true 的世界書物件陣列
 */
export function getActiveLorebooks() {
    return state.lorebooks.filter(lb => lb.enabled);
}

/**
 * @description 根據啟用世界書的規則，建構要注入到 Prompt 的內容
 * @param {Array<Object>} chatHistory - 當前的對話歷史紀錄
 * @returns {Array<Object>} - 包含 { content, position, order } 的待注入內容陣列
 */
export function buildInjections(chatHistory) {
    const activeLorebooks = getActiveLorebooks();
    if (activeLorebooks.length === 0) return [];

    const char = state.characters.find(c => c.id === state.activeCharacterId);
    if (!char) return [];
    
    const metadata = state.chatMetadatas[state.activeCharacterId]?.[state.activeChatId] || {};
    const currentPersonaId = metadata.userPersonaId || state.activeUserPersonaId;
    const user = state.userPersonas.find(p => p.id === currentPersonaId) || {};

    let allInjections = [];

    for (const book of activeLorebooks) {
        if (!book.entries || book.entries.length === 0) continue;

        const enabledEntries = book.entries.filter(e => e.enabled);
        
        for (const entry of enabledEntries) {
            // 藍燈/恆定觸發：無條件加入
            if (entry.constant) {
                allInjections.push({
                    content: replacePlaceholders(entry.content, char, user),
                    position: entry.position,
                    order: entry.order,
                });
                continue; // 處理完直接跳到下一個條目
            }
            
            // 綠燈/關鍵字觸發
            const textToScan = buildScanText(entry, chatHistory, char, user);
            const keywords = (entry.keywords || []).map(k => k.trim().toLowerCase()).filter(k => k);
            if (keywords.length === 0) continue;

            const secondaryKeywords = (entry.secondaryKeywords || []).map(k => k.trim().toLowerCase()).filter(k => k);
            const logic = entry.logic || 0; // 0:OR, 1:AND, 2:NOT AND, 3:NOT OR
            let triggered = false;

            switch (logic) {
                case 0: // OR
                    triggered = keywords.some(keyword => textToScan.toLowerCase().includes(keyword));
                    break;
                case 1: // AND
                    triggered = keywords.every(keyword => textToScan.toLowerCase().includes(keyword));
                    break;
                case 2: // NOT AND
                    triggered = !keywords.every(keyword => textToScan.toLowerCase().includes(keyword));
                    if (triggered && secondaryKeywords.length > 0) {
                        triggered = secondaryKeywords.some(sk => textToScan.toLowerCase().includes(sk));
                    }
                    break;
                case 3: // NOT OR
                    triggered = !keywords.some(keyword => textToScan.toLowerCase().includes(keyword));
                     if (triggered && secondaryKeywords.length > 0) {
                        triggered = secondaryKeywords.some(sk => textToScan.toLowerCase().includes(sk));
                    }
                    break;
            }

            if (triggered) {
                allInjections.push({
                    content: replacePlaceholders(entry.content, char, user),
                    position: entry.position,
                    order: entry.order,
                });
            }
        }
    }

    return allInjections;
}

/**
 * @description 根據條目的設定，建構所有需要被掃描的文字
 * @param {object} entry - 世界書條目
 * @param {Array<Object>} chatHistory - 對話歷史
 * @param {object} char - 當前角色
 * @param {object} user - 當前使用者角色
 * @returns {string} - 合併後的掃描文字
 */
function buildScanText(entry, chatHistory, char, user) {
    let sources = [];
    const matchSources = entry.matchSources || [];
    
    // 1. 對話歷史
    const scanDepth = entry.scanDepth || 4;
    const historyToScan = chatHistory.slice(-scanDepth);
    sources.push(historyToScan.map(msg => (Array.isArray(msg.content) ? msg.content[msg.activeContentIndex] : msg.content)).join('\n'));

    // 2. 額外匹配來源
    if (matchSources.includes('char_desc')) sources.push(char.description || '');
    if (matchSources.includes('scenario')) sources.push(char.scenario || '');
    if (matchSources.includes('creator_notes')) sources.push(char.creatorNotes || '');
    if (matchSources.includes('persona_desc')) sources.push(user.description || '');
    
    return sources.join('\n');
}


/**
 * @description 替換世界書內容中的預留位置 (placeholders)
 * @param {string} text - 含有預留位置的原始字串
 * @param {object} char - 當前角色
 * @param {object} user - 當前使用者角色
 * @returns {string} - 替換後的字串
 */
function replacePlaceholders(text, char, user) {
    if (typeof text !== 'string') return '';
    let result = text;
    if(char) result = result.replace(/{{char}}/g, char.name || 'char');
    if(user) result = result.replace(/{{user}}/g, user.name || 'user');
    return result;
}

