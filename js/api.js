// js/api.js
// 這個檔案處理所有與外部 API 互動的邏輯。

import { auth } from './main.js';
import { getIdToken } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

import { state, tempState } from './state.js';
import * as PromptManager from './promptManager.js';
import * as LorebookManager from './lorebookManager.js'; // 引入 Lorebook Manager
import * as SceneMapManager from './sceneMapManager.js';

// ... (cleanMessagesForClaude, estimateTokens functions remain the same) ...
function cleanMessagesForClaude(messages) {
    const cleaned = [];
    let lastRole = null;

    for (const msg of messages) {
        if (!msg.content) continue;

        const currentRole = msg.role === 'assistant' ? 'assistant' : 'user';

        if (currentRole === lastRole && cleaned.length > 0) {
            cleaned[cleaned.length - 1].content += `\n\n${msg.content}`;
        } else {
            cleaned.push({ role: currentRole, content: msg.content });
            lastRole = currentRole;
        }
    }

    if (cleaned.length > 0 && cleaned[0].role !== 'user') {
        cleaned.unshift({ role: 'user', content: '(對話開始)' });
    }

    return cleaned;
}
function estimateTokens(text = '') {
    return (text || '').length;
}

export function buildApiMessages() {
    if (!state.activeCharacterId || !state.activeChatId) return [];
    return buildApiMessagesFromHistory(state.chatHistories[state.activeCharacterId][state.activeChatId] || []);
}

export function buildApiMessagesFromHistory(customHistory) {
    const maxTokenContext = parseInt(state.globalSettings.contextSize) || 30000;

    // 1. 計算提示詞庫和世界書的 Token 預算
    const promptSet = PromptManager.getActivePromptSet();
    const activeLorebooks = LorebookManager.getActiveLorebooks(); // [修改]

    const promptTokenCount = (promptSet.prompts || [])
        .filter(p => p.enabled)
        .reduce((sum, p) => sum + estimateTokens(PromptManager.replacePlaceholders(p.content)), 0);

    // [修改] 計算所有啟用世界書的 Token
    const lorebookTokenCount = activeLorebooks.reduce((total, book) => {
        return total + (book.entries || [])
            .filter(e => e.enabled)
            .reduce((sum, e) => sum + estimateTokens(e.content), 0);
    }, 0);


    const fixedTokenBudget = promptTokenCount + lorebookTokenCount;

    // 2. 根據剩餘預算截斷歷史紀錄
    let historyTokenCount = 0;
    const recentHistory = [];
    for (let i = customHistory.length - 1; i >= 0; i--) {
        const msg = customHistory[i];
        const content = (msg.role === 'assistant' && Array.isArray(msg.content))
            ? msg.content[msg.activeContentIndex]
            : msg.content;

        const messageTokens = estimateTokens(content);

        if (fixedTokenBudget + historyTokenCount + messageTokens <= maxTokenContext) {
            recentHistory.unshift(msg);
            historyTokenCount += messageTokens;
        } else {
            break;
        }
    }

    // 3. 建構基礎提示詞
    let finalMessages = PromptManager.buildFinalMessages(recentHistory);

    // 4. 觸發並注入世界書內容
    const injections = LorebookManager.buildInjections(recentHistory);
    if (injections.length > 0) {
        const charDescriptionPrompt = PromptManager.getPromptContentByIdentifier('char_description');
        let charDescIndex = -1;
        if (charDescriptionPrompt) {
            charDescIndex = finalMessages.findIndex(m => m.content.includes(charDescriptionPrompt));
        }
        if (charDescIndex === -1) {
            charDescIndex = finalMessages.findIndex(m => m.role === 'system');
            if (charDescIndex === -1) charDescIndex = 0;
        }

        const injectionsBefore = injections
            .filter(inj => inj.position === 0)
            .sort((a, b) => a.order - b.order)
            .map(inj => ({ role: 'system', content: inj.content }));

        const injectionsAfter = injections
            .filter(inj => inj.position !== 0)
            .sort((a, b) => a.order - b.order)
            .map(inj => ({ role: 'system', content: inj.content }));

        finalMessages.splice(charDescIndex, 0, ...injectionsBefore);
        finalMessages.splice(charDescIndex + injectionsBefore.length + 1, 0, ...injectionsAfter);
    }

    // 5. 格式化為最終 API Payload
    return formatApiPayload(finalMessages);
}

function formatApiPayload(finalMessages) {
    const provider = state.globalSettings.apiProvider || 'official_gemini';

    const mappedMessages = finalMessages.filter(msg => !msg.error).map(msg => {
        let finalContent = msg.content;
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            finalContent = msg.content[msg.activeContentIndex];
        }
        return { role: msg.role, content: finalContent };
    });

    if (provider === 'google' || provider === 'anthropic') {
        const systemPrompts = mappedMessages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const chatMessages = mappedMessages.filter(m => m.role !== 'system');

        if (provider === 'google') {
            const contents = chatMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
            return {
                contents,
                systemInstruction: { parts: [{ text: systemPrompts }] }
            };
        }

        if (provider === 'anthropic') {
            const cleanedMessages = cleanMessagesForClaude(chatMessages);
            return { system: systemPrompts, messages: cleanedMessages };
        }
    }

    let systemContent = '';
    const otherMessages = [];
    let systemBlockEnded = false;

    for (const msg of mappedMessages) {
        if (msg.role === 'system' && !systemBlockEnded) {
            systemContent += (systemContent ? '\n\n' : '') + msg.content;
        } else {
            if (msg.role !== 'system') {
                systemBlockEnded = true;
            }
            otherMessages.push(msg);
        }
    }

    const payload = [];
    if (systemContent) {
        payload.push({ role: 'system', content: systemContent });
    }
    payload.push(...otherMessages);
    return payload;
}


export async function callApi(messagePayload, isForSummarization = false) {
    tempState.apiCallController = new AbortController();
    const signal = tempState.apiCallController.signal;

    const settings = state.globalSettings;
    const provider = settings.apiProvider || 'official_gemini';

    if (provider === 'official_gemini') {
        if (!state.isPremiumUser) {
            throw new Error('您沒有使用此模型的權限。');
        }
        const simplifiedPayload = messagePayload.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content
        }));
        return callOfficialApi(simplifiedPayload, isForSummarization, signal);
    } else {
        return callProxyApi(provider, settings.apiKey, messagePayload, isForSummarization, signal);
    }
}

async function callOfficialApi(messagePayload, isForSummarization, signal) {
    const YOUR_WORKER_URL = 'https://key.d778105.workers.dev/';

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("使用者未登入，無法呼叫官方模型。");
    }
    const idToken = await getIdToken(currentUser);

    const url = YOUR_WORKER_URL + 'chat';
    const settings = state.globalSettings;

    const body = {
        model: settings.apiModel,
        messages: messagePayload,
        temperature: isForSummarization ? 0.5 : parseFloat(settings.temperature),
        top_p: isForSummarization ? 1 : parseFloat(settings.topP),
        max_tokens: isForSummarization ? (settings.summarizationMaxTokens || 1000) : parseInt(settings.maxTokens),
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 錯誤 (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return parseResponse('openai', data);
}

async function callProxyApi(provider, apiKey, messagePayload, isForSummarization, signal) {
    if (!apiKey) throw new Error('尚未設定 API 金鑰。');

    const YOUR_WORKER_URL = 'https://key.d778105.workers.dev/';
    const settings = state.globalSettings;
    let url = "", headers = {}, body = {};
    const baseParams = {
        model: settings.apiModel,
        temperature: isForSummarization ? 0.5 : parseFloat(settings.temperature),
        top_p: isForSummarization ? 1 : parseFloat(settings.topP),
    };
    const maxTokensValue = isForSummarization ? (settings.summarizationMaxTokens || 1000) : parseInt(settings.maxTokens);

    switch (provider) {
        case "openai":
        case "mistral":
        case "xai":
        case "openrouter":
            let baseUrl;
            if (provider === 'openai') baseUrl = 'https://api.openai.com/v1/chat/completions';
            else if (provider === 'mistral') baseUrl = 'https://api.mistral.ai/v1/chat/completions';
            else if (provider === 'xai') baseUrl = 'https://api.x.ai/v1/chat/completions';
            else baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

            url = YOUR_WORKER_URL + baseUrl;
            headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };

            body = { ...baseParams, messages: messagePayload };

            if (provider === 'mistral' || provider === 'xai' || (provider === 'openai' && (settings.apiModel.includes('gpt-5') || settings.apiModel.includes('gpt-4.1') || settings.apiModel.includes('o1') || settings.apiModel.includes('gpt-4o')))) {
                body.max_completion_tokens = maxTokensValue;
            } else {
                body.max_tokens = maxTokensValue;
            }

            if (provider === 'openai' || provider === 'mistral' || provider === 'xai') {
                body.frequency_penalty = parseFloat(settings.repetitionPenalty);
            }
            if (provider === 'openrouter') {
                body.repetition_penalty = parseFloat(settings.repetitionPenalty);
            }
            break;
        case "anthropic":
            url = YOUR_WORKER_URL + "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            };
            body = { ...baseParams, system: messagePayload.system, messages: messagePayload.messages, max_tokens: maxTokensValue };
            break;
        case "google":
            url = YOUR_WORKER_URL + `https://generativelanguage.googleapis.com/v1beta/models/${settings.apiModel}:generateContent?key=${apiKey}`;
            headers = { "Content-Type": "application/json" };

            body = {
                contents: messagePayload.contents,
                systemInstruction: messagePayload.systemInstruction,
                generationConfig: {
                    temperature: baseParams.temperature,
                    topP: baseParams.top_p,
                    maxOutputTokens: maxTokensValue
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };
            break;
        default: throw new Error("不支援的 API 供應商: " + provider);
    }

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 錯誤 (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return parseResponse(provider, data);
}

function parseResponse(provider, data) {
    try {
        switch (provider) {
            case "openai":
            case "mistral":
            case "xai":
            case "openrouter":
            case "official_gemini":
                return data.choices[0].message.content;
            case "anthropic":
                return data.content[0].text;
            case "google":
                // [關鍵修改] 處理 MAX_TOKENS 或其他安全原因導致的回應截斷
                const candidate = data.candidates?.[0];
                if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts[0].text;
                }
                if (candidate && candidate.finishReason === 'MAX_TOKENS') {
                    return "⚠️ AI 回應因達到長度上限而被截斷。請嘗試增加「最大回應」的 Token 數量，或點擊「繼續生成」。";
                }

                // 詳細錯誤診斷
                let errorDetails = "";
                if (data.promptFeedback) {
                    if (data.promptFeedback.blockReason) {
                        errorDetails += `BlockReason: ${data.promptFeedback.blockReason}. `;
                    }
                }
                if (candidate && candidate.finishReason) {
                    errorDetails += `FinishReason: ${candidate.finishReason}. `;
                }
                if (candidate && candidate.safetyRatings) {
                    const blockedRating = candidate.safetyRatings.find(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');
                    if (blockedRating) {
                        errorDetails += `Safety: ${blockedRating.category} (${blockedRating.probability}).`;
                    }
                }

                return `⚠️ API 沒有回傳有效的內容。${errorDetails ? `(診斷: ${errorDetails})` : ''}`;
            default:
                return "⚠️ 無法解析回應";
        }
    } catch (e) {
        console.error("解析 API 回應失敗:", data, e);
        return "⚠️ 回應格式錯誤";
    }
}

export async function testApiConnection(provider, apiKey, model) {
    const YOUR_CLOUDFLARE_WORKER_URL = 'https://key.d778105.workers.dev/';
    let url = "", headers = {}, body = {};

    const testPayload = [{ role: 'user', content: 'Hello' }];

    switch (provider) {
        case "openai":
        case "mistral":
        case "xai":
        case "openrouter":
            let baseUrl;
            if (provider === 'openai') baseUrl = 'https://api.openai.com/v1/chat/completions';
            else if (provider === 'mistral') baseUrl = 'https://api.mistral.ai/v1/chat/completions';
            else if (provider === 'xai') baseUrl = 'https://api.x.ai/v1/chat/completions';
            else baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
            url = YOUR_CLOUDFLARE_WORKER_URL + baseUrl;
            headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };

            body = { model, messages: testPayload };
            if (provider === 'mistral' || provider === 'xai' || (provider === 'openai' && (model.includes('gpt-5') || model.includes('gpt-4.1')))) {
                body.max_completion_tokens = 5;
            } else {
                body.max_tokens = 5;
            }
            break;
        case "anthropic":
            url = YOUR_CLOUDFLARE_WORKER_URL + "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            };
            body = { model, messages: testPayload, max_tokens: 5 };
            break;
        case "google":
            url = YOUR_CLOUDFLARE_WORKER_URL + `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            headers = { "Content-Type": "application/json" };
            body = { contents: [{ parts: [{ text: "Hello" }] }], generationConfig: { maxOutputTokens: 5 } };
            break;
        default:
            throw new Error("不支援的 API 供應商");
    }

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`(${response.status}) ${errorText}`);
    }

    return true;
}

/**
 * AI 輔助場景分析 - 根據對話內容建議場景變更
 * 使用與長期記憶生成相同的 API 調用方式，確保一致性
 * @param {Array} chatHistory - 最近的對話訊息 (這裡實際上會接收完整的 chatHistory)
 * @returns {Promise<Object>} - 返回建議的場景變更
 */
export async function analyzeSceneChanges(chatHistory) {
    if (!state.activeCharacterId || !state.activeChatId) {
        throw new Error("請先選擇角色和聊天室");
    }

    const sceneMap = SceneMapManager.getActiveSceneMap();
    if (!sceneMap) {
        throw new Error("當前聊天室沒有場景地圖");
    }

    // 建構場景摘要
    let sceneSummary = "當前場景節點 (格式: ID | 路徑 | 類型 | 描述)：\n";
    for (const [nodeId, node] of Object.entries(sceneMap.nodes)) {
        const path = SceneMapManager.getNodePath(nodeId);
        let desc = node.description || "無描述";
        sceneSummary += `- ${nodeId} | ${path} | ${node.type} | ${desc}\n`;
    }

    // 處理對話紀錄 (參考 handleUpdateMemory 的邏輯)
    const MAX_ANALYSIS_HISTORY_TOKENS = 20000; // 給場景分析較大的視窗
    let tokens = 0;
    const truncatedHistory = [];

    // 從最新的訊息開始往回抓
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];
        const content = (msg.role === 'assistant' && Array.isArray(msg.content))
            ? msg.content[msg.activeContentIndex || 0]
            : msg.content;

        const messageTokens = (content || '').length;

        if (tokens + messageTokens > MAX_ANALYSIS_HISTORY_TOKENS) {
            break;
        }

        tokens += messageTokens;
        truncatedHistory.unshift(msg);
    }

    // 將對話合併成文字
    const conversationSummary = truncatedHistory.map(m => {
        const role = m.role === 'user' ? 'User' : 'AI';
        const content = (m.role === 'assistant' && Array.isArray(m.content))
            ? m.content[m.activeContentIndex || 0]
            : m.content;
        return `${role}: ${content}`;
    }).join('\n');

    // 建構分析提示詞
    const analysisPrompt = `你是一個場景狀態分析助手。請根據以下對話內容，分析是否有任何場景節點的描述需要更新，或者是否需要新增新的場景節點。

${sceneSummary}

最近的對話：
${conversationSummary}

請以 JSON 格式回應，格式如下：
{
    "hasChanges": true/false,
    "changes": [
        {
            "type": "update",
            "nodeId": "請填入上述場景摘要中的準確 ID",
            "nodeName": "節點名稱",
            "currentDescription": "目前的描述",
            "newDescription": "建議的新描述",
            "reason": "更新原因"
        },
        {
            "type": "add",
            "parentId": "父節點ID (若為頂層則為 null)",
            "name": "新節點名稱",
            "nodeType": "location/container/item",
            "description": "新節點描述",
            "keywords": ["關鍵字1", "關鍵字2"],
            "reason": "新增原因"
        }
    ]
}

注意事項：
1. **更新節點**：
   - 如果對話中提到的物品或地點狀態發生了變化（例如：門被打開了、杯子空了、位置移動了），請務必建議更新 (type: "update")。
   - **重要**：必須使用場景摘要中提供的準確 \`nodeId\`。
   - 不要害怕更新描述，只要對話中有提到狀態改變，就應該反映在場景中。
2. **新增節點**：
   - 如果對話中出現了場景地圖中不存在的重要物品或地點，請建議新增 (type: "add")。
   - 父節點 ID (parentId) 必須是場景地圖中已存在的節點 ID。
3. **刪除/消失**：
   - 除非物品被明確銷毀或帶離場景，否則不要建議刪除。
4. 如果沒有需要更新或新增的內容，hasChanges 設為 false，changes 設為空陣列。
5. 只回應 JSON，不要加上任何解釋文字`;

    try {
        // 檢查 API Key（與長期記憶生成相同的檢查邏輯）
        const provider = state.globalSettings.apiProvider || 'openai';
        if (provider !== 'official_gemini' && !state.globalSettings.apiKey) {
            throw new Error("請先設定 API Key");
        }

        // 根據供應商格式化 payload（與長期記憶生成相同的邏輯）
        let analysisMessages;
        if (provider === 'google') {
            const contents = [{ role: 'user', parts: [{ text: analysisPrompt }] }];
            analysisMessages = {
                contents: contents,
                systemInstruction: { parts: [{ text: 'You are a scene analysis expert.' }] }
            };
        } else if (provider === 'anthropic') {
            analysisMessages = {
                system: 'You are a scene analysis expert.',
                messages: [{ role: 'user', content: analysisPrompt }]
            };
        } else {
            // 包括 'official_gemini', 'openai', 'openrouter', 'xai', 'mistral'
            analysisMessages = [
                { role: 'system', content: 'You are a scene analysis expert.' },
                { role: 'user', content: analysisPrompt }
            ];
        }

        // 使用 callApi 函數（與長期記憶生成相同的方式）
        // 第二個參數設為 true 表示這是用於摘要/分析，會使用較低的 temperature
        const result = await callApi(analysisMessages, true);

        // 檢查是否為錯誤訊息
        if (typeof result === 'string' && result.startsWith('⚠️')) {
            throw new Error(result);
        }

        // 解析 JSON 結果
        // 先嘗試提取 JSON 內容（移除可能的 markdown 代碼塊）
        let jsonText = result.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        }

        try {
            const analysis = JSON.parse(jsonText);
            return analysis;
        } catch (e) {
            console.error("JSON 解析失敗，原始回應:", result);
            throw new Error("AI 回傳了無效的格式，請稍後再試。");
        }

    } catch (error) {
        console.error("場景分析失敗:", error);
        throw error;
    }
}

// 輔助函數：獲取 API 端點
function getApiEndpoint(provider) {
    const endpoints = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "xai": "https://api.x.ai/v1/chat/completions",
        "mistral": "https://api.mistral.ai/v1/chat/completions"
    };
    return endpoints[provider] || endpoints["openai"];
}

