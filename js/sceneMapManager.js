// js/sceneMapManager.js
// 場景地圖管理模組 - 每個聊天室獨立的場景狀態

import { state, saveAllSceneStatesForChar, saveSettings } from './state.js';

/**
 * 獲取當前聊天室的場景狀態
 */
export function getActiveSceneMap() {
    if (!state.activeCharacterId || !state.activeChatId) return null;

    const sceneState = state.sceneStates[state.activeCharacterId]?.[state.activeChatId];
    return sceneState || null;
}

/**
 * 設定當前聊天室的場景狀態
 */
export function setActiveSceneMap(sceneMapData) {
    if (!state.activeCharacterId || !state.activeChatId) return false;

    if (!state.sceneStates[state.activeCharacterId]) {
        state.sceneStates[state.activeCharacterId] = {};
    }

    state.sceneStates[state.activeCharacterId][state.activeChatId] = sceneMapData;
    return true;
}

/**
 * 初始化當前聊天室的場景地圖（如果不存在）
 */
export function initSceneMapForCurrentChat() {
    if (!state.activeCharacterId || !state.activeChatId) return false;

    const existing = getActiveSceneMap();
    if (existing) return existing;

    // 建立預設場景地圖
    const defaultMap = createDefaultSceneMap();
    setActiveSceneMap(defaultMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return defaultMap;
}

/**
 * 根據路徑獲取節點（支援路徑如 "家/廚房/冰箱"）
 */
export function getNodeByPath(pathString) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return null;

    const pathParts = pathString.split('/').filter(p => p);
    let currentNode = null;

    // 從根節點開始找
    for (const rootId of sceneMap.rootNodes) {
        const node = sceneMap.nodes[rootId];
        if (node.name === pathParts[0]) {
            currentNode = node;
            break;
        }
    }

    // 遍歷子節點
    for (let i = 1; i < pathParts.length; i++) {
        if (!currentNode) return null;
        const childId = currentNode.children.find(childId => {
            return sceneMap.nodes[childId]?.name === pathParts[i];
        });
        currentNode = sceneMap.nodes[childId];
    }

    return currentNode;
}

/**
 * 獲取節點的完整路徑字串
 */
export function getNodePath(nodeId) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap || !sceneMap.nodes[nodeId]) return '';

    const path = [];
    let current = sceneMap.nodes[nodeId];

    while (current) {
        path.unshift(current.name);
        current = current.parent ? sceneMap.nodes[current.parent] : null;
    }

    return path.join(' → ');
}

/**
 * 獲取某個位置下的所有物品（遞迴）
 */
export function getItemsInLocation(locationId, recursive = true) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return [];

    const items = [];
    const location = sceneMap.nodes[locationId];
    if (!location) return items;

    for (const childId of location.children) {
        const child = sceneMap.nodes[childId];
        if (child.type === 'item') {
            items.push(child);
        }
        if (recursive && child.children.length > 0) {
            items.push(...getItemsInLocation(childId, true));
        }
    }

    return items;
}

/**
 * 移動物品到新位置
 */
/**
 * 移動物品到新位置
 * @param {string} itemId - 被移動的節點 ID
 * @param {string|null} newParentId - 新父節點 ID (null 表示移動到根層級)
 * @param {number|null} newIndex - 新的索引位置 (null 表示加到最後)
 */
export function moveItem(itemId, newParentId, newIndex = null) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return false;

    const item = sceneMap.nodes[itemId];

    // [MODIFIED] 如果 newParentId 為 null，表示移動到根節點
    let newParent = null;
    if (newParentId) {
        newParent = sceneMap.nodes[newParentId];
        if (!newParent) return false;
    }

    if (!item) return false;

    // 防止移動到自己的子節點（避免循環引用）
    // isDescendant(itemId, newParentId) 檢查：newParentId 是否在 itemId 的子樹中
    if (newParentId && isDescendant(itemId, newParentId)) {
        return false;
    }

    // 從舊父節點移除
    if (item.parent) {
        const oldParent = sceneMap.nodes[item.parent];
        if (oldParent) {
            oldParent.children = oldParent.children.filter(id => id !== itemId);
        }
    } else {
        // 從根節點移除
        sceneMap.rootNodes = sceneMap.rootNodes.filter(id => id !== itemId);
    }

    // 加入新父節點
    if (newParent) {
        if (newIndex !== null && newIndex >= 0 && newIndex <= newParent.children.length) {
            newParent.children.splice(newIndex, 0, itemId);
        } else {
            newParent.children.push(itemId);
        }
        item.parent = newParentId;
    } else {
        // 加入根節點列表
        if (newIndex !== null && newIndex >= 0 && newIndex <= sceneMap.rootNodes.length) {
            sceneMap.rootNodes.splice(newIndex, 0, itemId);
        } else {
            sceneMap.rootNodes.push(itemId);
        }
        item.parent = null;
    }

    sceneMap.lastUpdated = new Date().toISOString();

    // 儲存變更
    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return true;
}

/**
 * 檢查 nodeId 是否是 ancestorId 的子孫節點
 */
export function isDescendant(nodeId, ancestorId) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return false;

    const node = sceneMap.nodes[nodeId];
    if (!node) return false;

    if (nodeId === ancestorId) return true;

    // 遞迴檢查所有子節點
    for (const childId of node.children) {
        if (isDescendant(childId, ancestorId)) {
            return true;
        }
    }

    return false;
}

/**
 * 獲取可用的父節點列表（排除節點自己和它的子孫節點）
 */
export function getAvailableParentNodes(excludeNodeId = null) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return [];

    const availableNodes = [];

    for (const [nodeId, node] of Object.entries(sceneMap.nodes)) {
        // 排除節點自己
        if (nodeId === excludeNodeId) continue;

        // 排除節點的子孫節點（避免循環引用）
        // isDescendant(excludeNodeId, nodeId) 檢查：nodeId 是否在 excludeNodeId 的子樹中
        if (excludeNodeId && isDescendant(excludeNodeId, nodeId)) continue;

        // 只有 location 和 container 可以作為父節點
        if (node.type === 'location' || node.type === 'container') {
            const path = getNodePath(nodeId);
            availableNodes.push({
                id: nodeId,
                name: node.name,
                path: path,
                type: node.type
            });
        }
    }

    // 按路徑排序
    availableNodes.sort((a, b) => a.path.localeCompare(b.path));

    return availableNodes;
}

/**
 * 更新節點狀態
 */
export function updateNodeState(nodeId, newState) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return false;

    const node = sceneMap.nodes[nodeId];
    if (!node) return false;

    node.state = { ...node.state, ...newState };
    sceneMap.lastUpdated = new Date().toISOString();

    // 儲存變更
    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return true;
}

/**
 * 根據對話內容，篩選相關的場景節點
 */
export function getRelevantSceneNodes(recentMessages) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return [];

    // 將最近的對話合併成文字
    const conversationText = recentMessages
        .map(msg => {
            if (Array.isArray(msg.content)) {
                return msg.content[msg.activeContentIndex || 0];
            }
            return msg.content;
        })
        .join(' ')
        .toLowerCase();

    const relevantNodes = [];

    // ==========================================
    // 第一層：節點自帶關鍵字匹配（優先）
    // ==========================================
    for (const nodeId in sceneMap.nodes) {
        const node = sceneMap.nodes[nodeId];

        // 檢查節點的自訂關鍵字
        if (node.keywords && Array.isArray(node.keywords)) {
            for (const keyword of node.keywords) {
                const keywordLower = keyword.toLowerCase();
                if (keywordLower && conversationText.includes(keywordLower)) {
                    if (!relevantNodes.includes(nodeId)) {
                        relevantNodes.push(nodeId);
                    }
                    break; // 找到一個關鍵字就夠了
                }
            }
        }
    }

    // ==========================================
    // 第二層：全域關鍵字映射匹配（向後相容）
    // ==========================================
    const keywordMap = state.sceneKeywordMap || {};

    for (const [keyword, nodeNames] of Object.entries(keywordMap)) {
        if (conversationText.includes(keyword)) {
            for (const nodeName of nodeNames) {
                // 在場景地圖中找到對應名稱的節點
                for (const nodeId in sceneMap.nodes) {
                    const node = sceneMap.nodes[nodeId];
                    if (node.name.toLowerCase().includes(nodeName) ||
                        nodeName.includes(node.name.toLowerCase())) {
                        if (!relevantNodes.includes(nodeId)) {
                            relevantNodes.push(nodeId);
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // 第三層：節點名稱直接匹配（兜底）
    // ==========================================
    // 即使沒有設定關鍵字，如果對話直接提到節點名稱，也會匹配
    for (const nodeId in sceneMap.nodes) {
        if (relevantNodes.includes(nodeId)) continue; // 已經匹配過了，跳過

        const node = sceneMap.nodes[nodeId];
        const nodeName = node.name.toLowerCase();

        // 如果對話中包含節點名稱（至少2個字元，避免過度匹配）
        if (nodeName.length >= 2 && conversationText.includes(nodeName)) {
            relevantNodes.push(nodeId);
        }
    }

    return relevantNodes;
}

/**
 * 建構「關鍵記憶」段落（只包含相關的場景）
 */
export function buildRelevantScenePrompt(recentMessages) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return '';

    // [NEW] 如果場景注入被停用，直接回傳空字串
    if (sceneMap.isEnabled === false) return '';

    const relevantNodeIds = getRelevantSceneNodes(recentMessages);
    if (relevantNodeIds.length === 0) return '';

    let text = `[場景地圖 - 背景參考資訊]\n`;
    text += `注意：以下是場景的基礎設定，請以最新對話內容為準。\n\n`;

    for (const nodeId of relevantNodeIds) {
        const node = sceneMap.nodes[nodeId];
        const path = getNodePath(nodeId);

        text += `${path}`;

        // 如果有描述，加上描述
        if (node.description) {
            text += `：${node.description}`;
        }

        text += `\n`;
    }

    return text;
}

/**
 * 建構用於 Prompt 的完整場景描述文字（顯示當前位置）
 */
export function buildScenePromptText(focusNodeId = null) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return '';

    // [NEW] 如果場景注入被停用，直接回傳空字串
    if (sceneMap.isEnabled === false) return '';

    const currentNode = focusNodeId
        ? sceneMap.nodes[focusNodeId]
        : sceneMap.nodes[sceneMap.currentLocation];

    if (!currentNode) return '';

    let text = `[場景背景設定]\n`;
    text += `注意：此為場景的基礎狀態。若對話中有更新的資訊，請以對話為準。\n\n`;
    text += `位置：${getNodePath(currentNode.id)}\n`;

    if (currentNode.description) {
        text += `描述：${currentNode.description}\n`;
    }

    // 列出當前位置的子節點
    if (currentNode.children.length > 0) {
        text += `\n可見物件：\n`;
        for (const childId of currentNode.children) {
            const child = sceneMap.nodes[childId];
            text += `- ${child.name}`;

            // 顯示描述
            if (child.description) {
                text += `：${child.description}`;
            }

            text += `\n`;
        }
    }

    // 顯示父層級資訊（讓 AI 知道可以「往上走」）
    if (currentNode.parent) {
        const parent = sceneMap.nodes[currentNode.parent];
        text += `\n所在區域：${parent.name}\n`;
    }

    return text;
}

/**
 * 新增節點
 */
export function addNode(parentId, nodeData) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return null;

    // [FIX] 使用 Date.now() + 隨機數避免 ID 衝突 (解決同步迴圈產生相同 ID 的問題)
    const newNode = {
        id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: nodeData.name || '未命名',
        type: nodeData.type || 'location',
        description: nodeData.description || '',
        keywords: nodeData.keywords || [],
        children: [],
        parent: parentId
    };

    sceneMap.nodes[newNode.id] = newNode;

    let addedToParent = false;
    if (parentId) {
        let parent = sceneMap.nodes[parentId];

        // [FIX] 如果找不到 ID，嘗試用名稱搜尋 (解決 AI 可能回傳名稱而非 ID 的問題)
        if (!parent) {
            const parentEntry = Object.entries(sceneMap.nodes).find(([_, node]) => node.name === parentId);
            if (parentEntry) {
                parent = parentEntry[1];
                newNode.parent = parent.id; // 更新為正確的 ID
            }
        }

        if (parent) {
            parent.children.push(newNode.id);
            addedToParent = true;
        }
    }

    // [FIX] 如果沒有父節點，或父節點無效，則加入根節點 (解決孤兒節點問題)
    if (!addedToParent) {
        sceneMap.rootNodes.push(newNode.id);
        newNode.parent = null; // 確保 parent 為 null
    }

    sceneMap.lastUpdated = new Date().toISOString();

    // 儲存變更
    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return newNode;
}

/**
 * 更新節點資料
 */
export function updateNode(nodeId, nodeData) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap || !sceneMap.nodes[nodeId]) return false;

    const node = sceneMap.nodes[nodeId];

    if (nodeData.name !== undefined) node.name = nodeData.name;
    if (nodeData.type !== undefined) node.type = nodeData.type;
    if (nodeData.description !== undefined) node.description = nodeData.description;
    if (nodeData.keywords !== undefined) node.keywords = nodeData.keywords;

    sceneMap.lastUpdated = new Date().toISOString();

    // 儲存變更
    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return true;
}

/**
 * 刪除節點（遞迴刪除所有子節點）
 */
export function deleteNode(nodeId) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return false;

    const node = sceneMap.nodes[nodeId];
    if (!node) return false;

    // 遞迴刪除所有子節點
    for (const childId of node.children) {
        deleteNode(childId);
    }

    // 從父節點移除
    if (node.parent) {
        const parent = sceneMap.nodes[node.parent];
        parent.children = parent.children.filter(id => id !== nodeId);
    } else {
        // 從根節點列表移除
        sceneMap.rootNodes = sceneMap.rootNodes.filter(id => id !== nodeId);
    }

    // 刪除節點
    delete sceneMap.nodes[nodeId];

    sceneMap.lastUpdated = new Date().toISOString();

    // 儲存變更
    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);

    return true;
}

/**
 * 建立預設場景地圖模板
 */
export function createDefaultSceneMap(name = '預設場景') {
    const newSceneMap = {
        name: name,
        isEnabled: true, // [NEW] 預設啟用
        description: '預設場景地圖',
        rootNodes: ['node_home'],
        nodes: {
            'node_home': {
                id: 'node_home',
                name: '家',
                type: 'location',
                description: '溫馨的住所',
                keywords: ['家', '回家', '住所'],
                children: ['node_kitchen', 'node_bedroom'],
                parent: null
            },
            'node_kitchen': {
                id: 'node_kitchen',
                name: '廚房',
                type: 'location',
                description: '開放式廚房，整潔乾淨',
                keywords: ['廚房', '做飯', '煮', '煮飯', '烹飪'],
                children: ['node_fridge'],
                parent: 'node_home'
            },
            'node_fridge': {
                id: 'node_fridge',
                name: '冰箱',
                type: 'container',
                description: '雙門冰箱，目前是空的，裡面很冷',
                keywords: ['冰箱', '食物', '吃', '飲料', '冰'],
                children: [],
                parent: 'node_kitchen'
            },
            'node_bedroom': {
                id: 'node_bedroom',
                name: '臥室',
                type: 'location',
                description: '舒適的臥室',
                keywords: ['臥室', '睡覺', '休息', '房間'],
                children: ['node_bed'],
                parent: 'node_home'
            },
            'node_bed': {
                id: 'node_bed',
                name: '床',
                type: 'container',
                description: '雙人床，還沒整理',
                keywords: ['床', '睡', '躺', '睡覺'],
                children: [],
                parent: 'node_bedroom'
            }
        },
        currentLocation: 'node_home',
        lastUpdated: new Date().toISOString()
    };

    return newSceneMap;
}

// ===================================================================================
// 動態關鍵字映射管理
// ===================================================================================

/**
 * 添加或更新關鍵字映射
 */
export function addKeywordMapping(keyword, nodeNames) {
    if (!keyword || !Array.isArray(nodeNames)) return false;

    state.sceneKeywordMap[keyword] = nodeNames;
    saveSettings();
    return true;
}

/**
 * 刪除關鍵字映射
 */
export function deleteKeywordMapping(keyword) {
    if (!state.sceneKeywordMap[keyword]) return false;

    delete state.sceneKeywordMap[keyword];
    saveSettings();
    return true;
}

/**
 * 獲取所有關鍵字映射
 */
export function getAllKeywordMappings() {
    return state.sceneKeywordMap || {};
}

/**
 * 重置為預設關鍵字映射
 */
export function resetKeywordMappingsToDefault() {
    state.sceneKeywordMap = {
        '吃': ['fridge', 'kitchen', 'stove'],
        '飯': ['fridge', 'kitchen', 'stove'],
        '煮': ['kitchen', 'stove', 'fridge'],
        '食物': ['fridge', 'kitchen'],
        '冰箱': ['fridge'],
        '睡': ['bedroom', 'bed'],
        '手機': ['phone'],
        '洗澡': ['bathroom'],
        '浴室': ['bathroom'],
        '家': ['home', 'bedroom', 'kitchen'],
        '廚房': ['kitchen', 'fridge', 'stove'],
        '臥室': ['bedroom', 'bed'],
        '床': ['bed'],
    };
    saveSettings();
    return true;
}

/**
 * [NEW] 設定場景地圖是否啟用注入
 */
export function setSceneMapInjection(enabled) {
    const sceneMap = getActiveSceneMap();
    if (!sceneMap) return false;

    sceneMap.isEnabled = !!enabled;
    sceneMap.lastUpdated = new Date().toISOString();

    setActiveSceneMap(sceneMap);
    saveAllSceneStatesForChar(state.activeCharacterId);
    return true;
}

/**
 * 匯出場景地圖資料
 */
export function exportSceneData(charId, chatId) {
    if (!state.sceneStates[charId] || !state.sceneStates[charId][chatId]) {
        alert('目前沒有場景資料可匯出');
        return;
    }

    const sceneMap = state.sceneStates[charId][chatId];
    const exportData = {
        version: 1,
        timestamp: new Date().toISOString(),
        charId: charId,
        chatId: chatId,
        sceneMap: sceneMap,
        // 包含全域關鍵字映射，因為這對場景分析很重要
        keywordMapping: state.sceneKeywordMap
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene_map_${charId}_${chatId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 匯入場景地圖資料
 */
export function importSceneData(file, charId, chatId) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // 基本驗證
                if (!data.sceneMap || !data.sceneMap.nodes || !data.sceneMap.rootNodes) {
                    throw new Error('無效的場景地圖檔案格式');
                }

                if (confirm('匯入將會覆蓋當前的場景地圖。是否繼續？')) {
                    // 初始化狀態結構
                    if (!state.sceneStates[charId]) {
                        state.sceneStates[charId] = {};
                    }

                    // 更新場景地圖
                    state.sceneStates[charId][chatId] = data.sceneMap;

                    // 詢問是否合併關鍵字映射
                    if (data.keywordMapping && confirm('檔案中包含關鍵字映射設定。是否要合併到您的全域設定中？')) {
                        // 合併邏輯：保留現有，新增不存在的
                        for (const [keyword, nodes] of Object.entries(data.keywordMapping)) {
                            if (!state.sceneKeywordMap[keyword]) {
                                state.sceneKeywordMap[keyword] = nodes;
                            } else {
                                // 如果關鍵字已存在，合併節點列表 (去重)
                                const existingNodes = new Set(state.sceneKeywordMap[keyword]);
                                nodes.forEach(node => existingNodes.add(node));
                                state.sceneKeywordMap[keyword] = Array.from(existingNodes);
                            }
                        }
                    }

                    await saveAllSceneStatesForChar(charId);
                    await saveSettings(); // 儲存關鍵字映射

                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('讀取檔案失敗'));
        reader.readAsText(file);
    });
}
