// js/handlers.js
// 這個檔案存放所有的事件處理函式 (event handlers)。

import { auth } from './main.js';
import { 
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";


import * as DOM from './dom.js';
import { 
    state, tempState, saveSettings, saveCharacter, deleteCharacter, saveUserPersona, deleteUserPersona,
    saveAllChatHistoriesForChar, saveAllLongTermMemoriesForChar, saveAllChatMetadatasForChar,
    deleteAllChatDataForChar, loadChatDataForCharacter, savePromptSet, deletePromptSet,
    saveLorebook, deleteLorebook
} from './state.js';
import { escapeHtml, parseChatLogFile, parseCustomDate, safeRenderMarkdown } from './utils.js';
import * as db from './db.js';
import { callApi, buildApiMessages, buildApiMessagesFromHistory, testApiConnection } from './api.js';
import { 
    renderCharacterList, renderChatSessionList, renderActiveChat, renderChatMessages, 
    displayMessage, toggleModal, setGeneratingState, showCharacterListView, loadGlobalSettingsToUI,
    renderApiPresetsDropdown, loadApiPresetToUI, updateModelDropdown,
    renderFirstMessageInputs, renderPromptSetSelector, renderPromptList, renderRegexRulesList,
    renderLorebookList, renderLorebookEntryList, updateSendButtonState
} from './ui.js';
import { DEFAULT_AVATAR, PREMIUM_ACCOUNTS, MODELS } from './constants.js';
import { handleImageUpload, exportChatAsJsonl, applyTheme, importCharacter, exportCharacter, populateEditorFields } from './utils.js';
import * as PromptManager from './promptManager.js';
import * as LorebookManager from './lorebookManager.js';

// ===================================================================================
// 使用者認證 (Authentication)
// ===================================================================================

export function handleLogin() {
    toggleModal('auth-modal', true);
}

export function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(() => toggleModal('auth-modal', false))
      .catch(error => {
        console.error("Google 登入失敗:", error);
        alert(`登入失敗: ${error.message}`);
    });
}

export function handleEmailRegister(event) {
    event.preventDefault();
    const name = DOM.registerNameInput.value.trim();
    const email = event.target.email.value;
    const password = event.target.password.value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            return updateProfile(userCredential.user, {
                displayName: name
            }).then(() => {
                alert('註冊成功！');
                toggleModal('auth-modal', false);
            });
        })
        .catch(error => {
            console.error("註冊失敗:", error);
            alert(`註冊失敗: ${error.message}`);
        });
}

export function handleEmailLogin(event) {
    event.preventDefault();
    let emailInput = event.target.email.value;
    const password = event.target.password.value;

    let emailToAuth;
    const premiumAccount = PREMIUM_ACCOUNTS.find(acc => acc.username.toLowerCase() === emailInput.toLowerCase());

    if (premiumAccount) {
        emailToAuth = premiumAccount.firebaseEmail;
    } else {
        emailToAuth = emailInput;
    }

    signInWithEmailAndPassword(auth, emailToAuth, password)
        .then(() => {
            alert('登入成功！');
            toggleModal('auth-modal', false);
        })
        .catch(error => {
            console.error("登入失敗:", error);
            alert(`登入失敗: ${error.message}`);
        });
}

export function handleLogout() {
    if (confirm('確定要登出嗎？')) {
        signOut(auth).catch(error => {
            console.error("登出失敗:", error);
            alert(`登入失敗: ${error.message}`);
        });
    }
}


// ===================================================================================
// API 連線與設定檔
// ===================================================================================

export async function handleTestApiConnection() {
    const provider = DOM.apiProviderSelect.value;
    const model = DOM.apiModelSelect.value;
    const apiKey = DOM.apiKeyInput.value.trim();

    if (provider !== 'official_gemini' && !apiKey) {
        DOM.apiStatusIndicator.className = 'error';
        DOM.apiStatusIndicator.textContent = '請先輸入 API 金鑰！';
        DOM.apiStatusIndicator.style.display = 'block';
        return;
    }

    DOM.apiStatusIndicator.className = 'testing';
    DOM.apiStatusIndicator.textContent = '測試中...';
    DOM.apiStatusIndicator.style.display = 'block';
    DOM.testApiBtn.disabled = true;

    try {
        await testApiConnection(provider, apiKey, model);
        DOM.apiStatusIndicator.className = 'success';
        DOM.apiStatusIndicator.textContent = `連線成功！已連接至模型：${model}`;
    } catch (error) {
        console.error("API 連線測試失敗:", error);
        DOM.apiStatusIndicator.className = 'error';
        DOM.apiStatusIndicator.textContent = `連線失敗: ${error.message}`;
    } finally {
        DOM.testApiBtn.disabled = false;
    }
}

export async function handleSaveApiPreset() {
    const presetName = prompt('請為這個 API 設定檔命名：');
    if (!presetName || presetName.trim() === '') {
        alert('名稱不能為空！');
        return;
    }

    const newPreset = {
        id: `preset_${Date.now()}`,
        name: presetName.trim(),
        provider: DOM.apiProviderSelect.value,
        model: DOM.apiModelSelect.value,
        apiKey: DOM.apiKeyInput.value.trim(),
    };

    state.apiPresets.push(newPreset);
    await saveSettings();
    renderApiPresetsDropdown();
    DOM.apiPresetSelect.value = newPreset.id;
    alert(`設定檔 "${presetName}" 已儲存！`);
}

export function handleLoadApiPreset() {
    const presetId = DOM.apiPresetSelect.value;
    if (!presetId) return;
    loadApiPresetToUI(presetId);
}

export async function handleDeleteApiPreset() {
    const presetId = DOM.apiPresetSelect.value;
    if (!presetId) {
        alert('請先從下拉選單中選擇一個要刪除的設定檔。');
        return;
    }

    const presetToDelete = state.apiPresets.find(p => p.id === presetId);
    if (confirm(`確定要刪除設定檔 "${presetToDelete.name}" 嗎？`)) {
        state.apiPresets = state.apiPresets.filter(p => p.id !== presetId);
        await saveSettings();
        renderApiPresetsDropdown();
        DOM.apiProviderSelect.value = 'official_gemini';
        DOM.apiKeyInput.value = '';
        updateModelDropdown();
        alert(`設定檔 "${presetToDelete.name}" 已刪除。`);
    }
}

// ===================================================================================
// 聊天核心邏輯 (Core Chat Logic)
// ===================================================================================

export function handleSendBtnClick() {
    const currentState = DOM.sendBtn.dataset.state;
    switch (currentState) {
        case 'send':
            sendMessage(DOM.messageInput.value.trim());
            break;
        case 'continue':
            handleContinueGeneration();
            break;
        case 'regenerate':
            const history = state.chatHistories[state.activeCharacterId]?.[state.activeChatId] || [];
            if (history.length > 0) {
                regenerateResponse(history.length - 1, true); // 傳入 isSmartButton=true
            }
            break;
        case 'stop':
            handleStopGeneration();
            break;
    }
}

async function sendMessage(messageText) {
    if (messageText === '') return;
    if (state.globalSettings.apiProvider !== 'official_gemini' && !state.globalSettings.apiKey) {
        alert('請先在全域設定中設定您的 API 金鑰。');
        return;
    }
    if (!state.activeCharacterId || !state.activeChatId) return;

    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    
    // 暫存上一則訊息，稍後用來修剪
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;

    const timestamp = new Date().toISOString();
    history.push({ role: 'user', content: messageText, timestamp: timestamp });
    const currentUserMessageIndex = history.length - 1;
    
    // 先儲存使用者訊息並更新 UI
    await saveAllChatHistoriesForChar(state.activeCharacterId);
    renderChatMessages(); 
    DOM.chatWindow.scrollTop = DOM.chatWindow.scrollHeight;

    DOM.messageInput.value = '';
    DOM.messageInput.style.height = 'auto';
    DOM.messageInput.focus();
    updateSendButtonState();

    try {
        setGeneratingState(true);
        const thinkingBubble = displayMessage('...', 'assistant', new Date().toISOString(), history.length, true);
        
        const messagesForApi = buildApiMessages();
        let aiResponse = await callApi(messagesForApi);
        
        // 【安全的分支鎖定機制】在成功收到 AI 回應後，才修剪分支
        if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content) && lastMessage.content.length > 1) {
            const selectedContent = lastMessage.content[lastMessage.activeContentIndex];
            lastMessage.content = [selectedContent];
            lastMessage.activeContentIndex = 0;
            console.log('對話分支已成功鎖定並修剪。');
        }

        history.push({ role: 'assistant', content: [aiResponse], activeContentIndex: 0, timestamp: new Date().toISOString() });
        
        thinkingBubble.remove();
        
        await saveAllChatHistoriesForChar(state.activeCharacterId);
        renderChatMessages();

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("API 錯誤:", error);
            const errorMessage = `發生錯誤: ${error.message}`;
            alert(errorMessage); // 根據使用者回報，保留提示框

            // 找到剛才新增的使用者訊息，並標記為錯誤，而不是刪除它
            const userMessage = history[currentUserMessageIndex];
            if (userMessage) {
                userMessage.error = `傳送失敗`; // UI 會根據此屬性顯示重試按鈕
            }
            
            await saveAllChatHistoriesForChar(state.activeCharacterId);
            renderChatMessages(); // 重新渲染聊天室，顯示帶有錯誤訊息和重試按鈕的使用者對話
        }
    } finally {
        setGeneratingState(false);
    }
}

async function handleContinueGeneration() {
    if (!state.activeCharacterId || !state.activeChatId) return;

    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    const lastMessage = history[history.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') {
        return;
    }
    
    try {
        setGeneratingState(true);
        const continuePrompt = PromptManager.getPromptContentByIdentifier('continue_prompt') || "Continue.";
        const tempHistory = [...history, { role: 'user', content: continuePrompt }];
        const messagesForApi = buildApiMessagesFromHistory(tempHistory);

        let aiResponse = await callApi(messagesForApi);
        
        const lastMessageContent = lastMessage.content[lastMessage.activeContentIndex];
        lastMessage.content[lastMessage.activeContentIndex] = lastMessageContent + aiResponse;

        await saveAllChatHistoriesForChar(state.activeCharacterId);
        renderChatMessages();

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("繼續生成 API 錯誤:", error);
            alert(`繼續生成失敗: ${error.message}`);
        }
    } finally {
        setGeneratingState(false);
    }
}


export async function retryMessage(messageIndex) {
    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    const messageToRetry = history[messageIndex];

    if (messageToRetry && messageToRetry.role === 'user' && messageToRetry.error) {
        delete messageToRetry.error;
        const contextHistory = history.slice(0, messageIndex + 1);

        try {
            setGeneratingState(true);
            const thinkingBubble = displayMessage('...', 'assistant', new Date().toISOString(), history.length, true);

            const messagesForApi = buildApiMessagesFromHistory(contextHistory);
            let aiResponse = await callApi(messagesForApi);
            
            history.push({ role: 'assistant', content: [aiResponse], activeContentIndex: 0, timestamp: new Date().toISOString() });
            
            thinkingBubble.remove();
            await saveAllChatHistoriesForChar(state.activeCharacterId);
            renderChatMessages();
        } catch (error) {
            if (error.name !== 'AbortError') {
                messageToRetry.error = `重試失敗: ${error.message}`;
                await saveAllChatHistoriesForChar(state.activeCharacterId);
                renderChatMessages();
            }
        } finally {
            setGeneratingState(false);
        }
    }
}


export async function regenerateResponse(messageIndex, isSmartButton = false) {
    if (state.globalSettings.apiProvider !== 'official_gemini' && !state.globalSettings.apiKey) {
        alert('請先在全域設定中設定您的 API 金鑰。');
        return;
    }
    if (!state.activeCharacterId || !state.activeChatId) return;

    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    // 如果是智慧按鈕觸發的，我們重新生成的是最後一則訊息之前的內容
    const contextEndIndex = isSmartButton ? messageIndex : messageIndex;
    const contextHistory = history.slice(0, contextEndIndex);

    // 如果不是智慧按鈕，我們操作的是指定的訊息
    const targetMessage = isSmartButton ? null : history[messageIndex];

    if (!isSmartButton && (!targetMessage || targetMessage.role !== 'assistant')) return;

    if (!isSmartButton) {
        const targetRow = DOM.chatWindow.querySelectorAll('.message-row')[messageIndex];
        if (targetRow) {
            const regenerateBtn = targetRow.querySelector('.regenerate-btn-sm');
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
                regenerateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>生成中...';
            }
        }
    }
    setGeneratingState(true, isSmartButton);

    try {
        const messagesForApi = buildApiMessagesFromHistory(contextHistory);
        let aiResponse = await callApi(messagesForApi);

        if (isSmartButton) {
            // 新增一則全新的訊息
            history.push({ role: 'assistant', content: [aiResponse], activeContentIndex: 0, timestamp: new Date().toISOString() });
        } else {
            // 在現有訊息上新增一個版本
            targetMessage.content.push(aiResponse);
            targetMessage.activeContentIndex = targetMessage.content.length - 1;
        }

        await saveAllChatHistoriesForChar(state.activeCharacterId);
        renderChatMessages();
    } catch (error) {
         if (error.name !== 'AbortError') {
            alert(`重新生成失敗: ${error.message}`);
            console.error("重新生成 API 錯誤:", error);
        }
    } finally {
        setGeneratingState(false, isSmartButton);
        if (!isSmartButton) {
            renderChatMessages(); // 確保按鈕狀態被刷新
        }
    }
}

export function handleStopGeneration() {
    if (tempState.apiCallController) {
        tempState.apiCallController.abort();
    }
    setGeneratingState(false);
}


export async function switchVersion(messageIndex, direction) {
    if (!state.activeCharacterId || !state.activeChatId) return;
    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    const msg = history[messageIndex];
    if (!msg || !Array.isArray(msg.content)) return;
    
    const newIndex = msg.activeContentIndex + direction;

    if (newIndex >= 0 && newIndex < msg.content.length) {
        msg.activeContentIndex = newIndex;
        await saveAllChatHistoriesForChar(state.activeCharacterId);
        renderChatMessages();
    }
}

// ===================================================================================
// 聊天與角色管理 (Chat & Character Management)
// ===================================================================================

export async function switchChat(chatId) {
    if (state.activeChatId === chatId) return;

    state.activeChatId = chatId;
    await saveSettings();
    renderChatSessionList();
    renderActiveChat();
}

export async function handleAddNewChat() {
    if (!state.activeCharacterId) return;
    const char = state.characters.find(c => c.id === state.activeCharacterId);
    if (!char) return;

    const newChatId = `chat_${Date.now()}`;
    if (!state.chatHistories[state.activeCharacterId]) {
        state.chatHistories[state.activeCharacterId] = {};
        state.chatMetadatas[state.activeCharacterId] = {};
    }
    state.chatHistories[state.activeCharacterId][newChatId] = [];
    state.chatMetadatas[state.activeCharacterId][newChatId] = { name: '', pinned: false, notes: '', userPersonaId: state.activeUserPersonaId, order: Object.keys(state.chatMetadatas[state.activeCharacterId]).length };

    if (char.firstMessage && Array.isArray(char.firstMessage) && char.firstMessage.length > 0) {
        const nonEmptyMessages = char.firstMessage.filter(m => m.trim() !== '');
        if (nonEmptyMessages.length > 0) {
            const user = state.userPersonas.find(p => p.id === state.activeUserPersonaId) || {};
            const userName = user.name || 'User';
            
            const formattedGreetings = nonEmptyMessages.map(greeting => 
                greeting.replace(/{{char}}/g, char.name).replace(/{{user}}/g, userName)
            );
            
            state.chatHistories[state.activeCharacterId][newChatId].push({
                role: 'assistant',
                content: formattedGreetings,
                activeContentIndex: 0,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    state.activeChatId = newChatId;
    await saveAllChatHistoriesForChar(state.activeCharacterId);
    await saveAllChatMetadatasForChar(state.activeCharacterId);
    await saveSettings();
    
    renderChatSessionList();
    renderActiveChat();
}

/**
 * @description [MODIFIED] 處理刪除目前開啟的聊天室 (現在是 handleDeleteChat 的一個包裝函式)
 */
export async function handleDeleteCurrentChat() {
    if (!state.activeCharacterId || !state.activeChatId) return;
    await handleDeleteChat(state.activeChatId);
}

/**
 * @description [NEW] 處理刪除指定 ID 的聊天室
 * @param {string} chatIdToDelete - 要刪除的聊天室 ID
 */
export async function handleDeleteChat(chatIdToDelete) {
    if (!state.activeCharacterId || !chatIdToDelete) return;

    const chatName = state.chatMetadatas[state.activeCharacterId]?.[chatIdToDelete]?.name || `這個對話`;

    if (confirm(`確定要永久刪除「${chatName}」嗎？此操作無法復原。`)) {
        // 從所有相關的 state 物件中刪除
        if (state.chatHistories[state.activeCharacterId]) {
            delete state.chatHistories[state.activeCharacterId][chatIdToDelete];
        }
        if (state.chatMetadatas[state.activeCharacterId]) {
            delete state.chatMetadatas[state.activeCharacterId][chatIdToDelete];
        }
        if (state.longTermMemories[state.activeCharacterId]) {
            delete state.longTermMemories[state.activeCharacterId][chatIdToDelete];
        }

        // 將更新後的資料存回資料庫
        await saveAllChatHistoriesForChar(state.activeCharacterId);
        await saveAllChatMetadatasForChar(state.activeCharacterId);
        await saveAllLongTermMemoriesForChar(state.activeCharacterId);

        // 如果被刪除的是目前開啟的聊天室，則更新 UI
        if (state.activeChatId === chatIdToDelete) {
            state.activeChatId = null;
            await saveSettings();
            renderActiveChat(); // 這會顯示歡迎畫面
        }
        
        // 重新渲染聊天室列表
        renderChatSessionList();
    }
}


export async function handleSaveNote() {
    if (!state.activeCharacterId || !state.activeChatId) return;
    const metadata = state.chatMetadatas[state.activeCharacterId]?.[state.activeChatId];
    if (metadata) {
        metadata.notes = DOM.chatNotesInput.value.trim();
        await saveAllChatMetadatasForChar(state.activeCharacterId);
    }
}

export function openRenameModal(chatId) {
    tempState.renamingChatId = chatId;
    const metadata = state.chatMetadatas[state.activeCharacterId]?.[chatId] || {};
    DOM.renameChatInput.value = metadata.name || '';
    toggleModal('rename-chat-modal', true);
    DOM.renameChatInput.focus();
}

export async function handleSaveChatName() {
    if (!tempState.renamingChatId || !state.activeCharacterId) return;
    
    const metadata = state.chatMetadatas[state.activeCharacterId][tempState.renamingChatId];
    if(metadata) {
        metadata.name = DOM.renameChatInput.value.trim();
        await saveAllChatMetadatasForChar(state.activeCharacterId);
        renderChatSessionList();
    }
    toggleModal('rename-chat-modal', false);
    tempState.renamingChatId = null;
}

export async function handleTogglePinChat(chatId) {
    if (!state.activeCharacterId) return;
    
    const metadata = state.chatMetadatas[state.activeCharacterId][chatId];
    if(metadata) {
        metadata.pinned = !metadata.pinned;
        await saveAllChatMetadatasForChar(state.activeCharacterId);
        renderChatSessionList();
    }
}

// ===================================================================================
// 角色編輯器 (Character Editor)
// ===================================================================================

export function openCharacterEditor(charId = null) {
    tempState.editingCharacterId = charId;
    if (charId) {
        const char = state.characters.find(c => c.id === charId);
        if (!char) {
            console.error(`無法找到 ID 為 "${charId}" 的角色來進行編輯。`);
            alert('找不到要編輯的角色資料！');
            return;
        }
        DOM.charEditorTitle.textContent = '編輯角色';
        DOM.charAvatarPreview.src = char.avatarUrl || DEFAULT_AVATAR;
        DOM.charNameInput.value = char.name;
        DOM.charDescriptionInput.value = char.description || '';
        DOM.charScenarioInput.value = char.scenario || ''; // 新增：讀取場景
        renderFirstMessageInputs(char.firstMessage || ['']);
        DOM.charExampleDialogueInput.value = char.exampleDialogue || '';
        DOM.charCreatorInput.value = char.creator || '';
        DOM.charVersionInput.value = char.characterVersion || '';
        DOM.charCreatorNotesInput.value = char.creatorNotes || '';

    } else {
        DOM.charEditorTitle.textContent = '新增角色';
        DOM.charAvatarPreview.src = DEFAULT_AVATAR;
        DOM.charNameInput.value = '';
        DOM.charDescriptionInput.value = '';
        DOM.charScenarioInput.value = ''; // 新增：清空場景
        renderFirstMessageInputs(['']);
        DOM.charExampleDialogueInput.value = '';
        DOM.charCreatorInput.value = '';
        DOM.charVersionInput.value = '';
        DOM.charCreatorNotesInput.value = '';
    }
    toggleModal('character-editor-modal', true);
}

export async function handleSaveCharacter() {
    if (tempState.editingCharacterId && !confirm('儲存後會覆蓋原先內容，是否繼續儲存?')) {
        return;
    }

    const firstMessageInputs = DOM.firstMessageList.querySelectorAll('.char-first-message');
    const firstMessages = Array.from(firstMessageInputs)
                               .map(input => input.value.trim())
                               .filter(msg => msg !== ''); 

    const charData = {
        name: DOM.charNameInput.value.trim(),
        avatarUrl: DOM.charAvatarPreview.src,
        description: DOM.charDescriptionInput.value.trim(),
        scenario: DOM.charScenarioInput.value.trim(), // 新增：儲存場景
        firstMessage: firstMessages.length > 0 ? firstMessages : [''],
        exampleDialogue: DOM.charExampleDialogueInput.value.trim(),
        creator: DOM.charCreatorInput.value.trim(),
        characterVersion: DOM.charVersionInput.value.trim(),
        creatorNotes: DOM.charCreatorNotesInput.value.trim(),
    };
    if (!charData.name) { alert('角色名稱不能為空！'); return; }

    if (tempState.editingCharacterId) {
        const charIndex = state.characters.findIndex(c => c.id === tempState.editingCharacterId);
        const updatedChar = { ...state.characters[charIndex], ...charData };
        state.characters[charIndex] = updatedChar;
        await saveCharacter(updatedChar);
    } else {
        const newChar = { id: `char_${Date.now()}`, loved: false, order: state.characters.length, ...charData };
        state.characters.push(newChar);
        await saveCharacter(newChar);
        state.activeCharacterId = newChar.id;
        await handleAddNewChat(); // 修正：加上 await
    }
    
    renderCharacterList();
    if (DOM.leftPanel.classList.contains('show-chats')) {
        const character = state.characters.find(c => c.id === state.activeCharacterId);
        DOM.chatListHeaderName.textContent = character.name;
    }
    toggleModal('character-editor-modal', false);
}

export async function handleDeleteActiveCharacter() {
    const charIdToDelete = state.activeCharacterId;
    if (!charIdToDelete) return;

    const charToDelete = state.characters.find(c => c.id === charIdToDelete);
    if (!charToDelete) return;

    if (confirm(`確定要刪除角色「${charToDelete.name}」嗎？該角色的所有對話紀錄將一併刪除。`)) {
        state.characters = state.characters.filter(c => c.id !== charIdToDelete);
        delete state.chatHistories[charIdToDelete];
        delete state.longTermMemories[charIdToDelete];
        delete state.chatMetadatas[charIdToDelete];
        
        await deleteCharacter(charIdToDelete);
        await deleteAllChatDataForChar(charIdToDelete);
        
        state.activeCharacterId = null;
        state.activeChatId = null;
        await saveSettings();
        
        showCharacterListView(); 
        renderActiveChat();
        renderCharacterList();
    }
}

export async function handleToggleCharacterLove(charId) {
    if (!charId) return;
    const char = state.characters.find(c => c.id === charId);
    if (char) {
        char.loved = !char.loved;
        await saveCharacter(char);
        
        renderCharacterList();

        if (state.activeCharacterId === charId) {
            const heartIcon = DOM.headerLoveChatBtn.querySelector('i');
            DOM.headerLoveChatBtn.classList.toggle('loved', char.loved);
            heartIcon.className = `fa-${char.loved ? 'solid' : 'regular'} fa-heart`;
        }
    }
}

export async function handleCharacterDropSort(draggedId, targetId) {
    const draggedItem = state.characters.find(c => c.id === draggedId);
    if (!draggedItem) return;

    const sortedChars = [...state.characters].sort((a, b) => {
        if (a.loved !== b.loved) return a.loved ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
    });

    const originalIndex = sortedChars.findIndex(c => c.id === draggedId);
    sortedChars.splice(originalIndex, 1);

    const targetIndex = targetId ? sortedChars.findIndex(c => c.id === targetId) : sortedChars.length;
    sortedChars.splice(targetIndex, 0, draggedItem);

    for (let i = 0; i < sortedChars.length; i++) {
        const charToUpdate = state.characters.find(c => c.id === sortedChars[i].id);
        if(charToUpdate) {
            charToUpdate.order = i;
            await saveCharacter(charToUpdate);
        }
    }
    renderCharacterList();
}

export async function handleChatSessionDropSort(draggedId, targetId) {
    const metadatas = state.chatMetadatas[state.activeCharacterId];
    if (!metadatas) return;

    const draggedItem = metadatas[draggedId];
    if (!draggedItem) return;

    // Create an array of sessions from the metadata object for sorting
    let sessionsArray = Object.keys(metadatas).map(id => ({ id, ...metadatas[id] }));

    // Sort the array based on pinned status and order
    sessionsArray.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
    });

    // Find the original index of the dragged item and remove it
    const originalIndex = sessionsArray.findIndex(s => s.id === draggedId);
    if (originalIndex > -1) {
        sessionsArray.splice(originalIndex, 1);
    }
    
    // Find the target index to insert the dragged item
    const targetIndex = targetId 
        ? sessionsArray.findIndex(s => s.id === targetId) 
        : sessionsArray.length;
    sessionsArray.splice(targetIndex, 0, { id: draggedId, ...draggedItem });

    // Re-assign the order property to all sessions based on their new position
    for (let i = 0; i < sessionsArray.length; i++) {
        const sessionId = sessionsArray[i].id;
        if (metadatas[sessionId]) {
            metadatas[sessionId].order = i;
        }
    }
    
    // Save the updated metadata and re-render the list
    await saveAllChatMetadatasForChar(state.activeCharacterId);
    renderChatSessionList();
}


// ===================================================================================
// 訊息編輯與操作 (Message Editing & Actions)
// ===================================================================================

export function makeMessageEditable(row, index) {
    const currentlyEditing = document.querySelector('.is-editing');
    if (currentlyEditing) { 
        renderChatMessages();
    }

    const bubble = row.querySelector('.chat-bubble');
    const bubbleContainer = row.querySelector('.bubble-container');
    const msg = state.chatHistories[state.activeCharacterId][state.activeChatId][index];
    const originalText = (msg.role === 'assistant') ? msg.content[msg.activeContentIndex] : msg.content;
    
    row.classList.add('is-editing');
    bubble.style.display = 'none';
    row.querySelector('.message-timestamp').style.display = 'none';
    if (row.querySelector('.message-actions')) {
        row.querySelector('.message-actions').style.display = 'none';
    }

    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.innerHTML = `
        <textarea class="edit-textarea"></textarea>
        <div class="edit-actions">
            <button class="icon-btn delete-btn" title="刪除訊息"><i class="fa-solid fa-trash"></i></button>
            <button class="action-btn secondary edit-cancel-btn">取消</button>
            <button class="action-btn primary edit-save-btn">儲存</button>
        </div>
    `;
    
    const textarea = editContainer.querySelector('.edit-textarea');
    textarea.value = originalText;
    
    bubbleContainer.appendChild(editContainer);
    
    const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; };
    textarea.addEventListener('input', autoResize);
    autoResize();
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

    bubbleContainer.querySelector('.edit-save-btn').addEventListener('click', (e) => { e.stopPropagation(); saveMessageEdit(index, textarea.value); });
    bubbleContainer.querySelector('.edit-cancel-btn').addEventListener('click', (e) => { e.stopPropagation(); renderChatMessages(); });
    bubbleContainer.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); handleDeleteMessage(index); });
}

async function saveMessageEdit(index, newText) {
    const msg = state.chatHistories[state.activeCharacterId][state.activeChatId][index];
    if (msg.role === 'assistant') {
        msg.content[msg.activeContentIndex] = newText.trim();
    } else {
        msg.content = newText.trim();
    }
    await saveAllChatHistoriesForChar(state.activeCharacterId);
    renderChatMessages();
}

// 修改：處理訊息刪除的主函式
export function handleDeleteMessage(index) {
    const msg = state.chatHistories[state.activeCharacterId][state.activeChatId][index];
    if (!msg) return;

    if (msg.role === 'assistant' && Array.isArray(msg.content) && msg.content.length > 1) {
        openDeleteOptionsModal(index, msg);
    } else {
        if (confirm('您確定要永久刪除這則訊息嗎？')) {
            performDeleteMessage(index, 'all');
        }
    }
}

function openDeleteOptionsModal(index, msg) {
    tempState.deletingMessageInfo = { index, msg };
    const currentVersion = msg.activeContentIndex + 1;
    const totalVersions = msg.content.length;

    const deleteSingleBtn = document.getElementById('delete-single-version-btn');
    const deleteAllBtn = document.getElementById('delete-all-versions-btn');
    const deleteSingleDesc = document.getElementById('delete-single-version-desc');

    if (deleteSingleBtn && deleteAllBtn && deleteSingleDesc) {
        deleteSingleBtn.textContent = `刪除滑動 (${currentVersion}/${totalVersions})`;
        deleteSingleDesc.textContent = `保留其他 ${totalVersions - 1} 個由「再生成」建立的版本。`;
        deleteAllBtn.textContent = `刪除訊息`;
        toggleModal('delete-options-modal', true);
    } else {
        console.error("無法找到刪除選項 modal 的元素！");
        if (confirm(`這則回覆有多個版本。要刪除全部版本嗎？\n(按「取消」只會刪除目前顯示的版本)`)) {
            performDeleteMessage(index, 'all');
        } else {
            performDeleteMessage(index, 'single');
        }
    }
}

// 新增：處理刪除單一版本
export async function handleDeleteSingleVersion() {
    if (!tempState.deletingMessageInfo) return;
    const { index } = tempState.deletingMessageInfo;
    await performDeleteMessage(index, 'single');
    toggleModal('delete-options-modal', false);
    tempState.deletingMessageInfo = null;
}

// 新增：處理刪除所有版本
export async function handleDeleteAllVersions() {
    if (!tempState.deletingMessageInfo) return;
    const { index } = tempState.deletingMessageInfo;
    await performDeleteMessage(index, 'all');
    toggleModal('delete-options-modal', false);
    tempState.deletingMessageInfo = null;
}

// 新增：實際執行刪除操作的函式
async function performDeleteMessage(index, mode) {
    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    const msg = history[index];

    if (mode === 'all') {
        history.splice(index, 1);
    } else if (mode === 'single') {
        if (msg.content.length > 1) {
            msg.content.splice(msg.activeContentIndex, 1);
            if (msg.activeContentIndex >= msg.content.length) {
                msg.activeContentIndex = msg.content.length - 1;
            }
        } else {
            // 如果只剩最後一個版本，刪除單一版本就等於刪除整個訊息
            history.splice(index, 1);
        }
    }

    await saveAllChatHistoriesForChar(state.activeCharacterId);
    renderChatMessages();
}


// ===================================================================================
// 全域與提示詞設定 (Global & Prompt Settings)
// ===================================================================================

export async function handleSaveGlobalSettings() {
    console.log('儲存設定前的狀態:', {
        activeCharacterId: state.activeCharacterId,
        activeChatId: state.activeChatId
    });

    let contextSize = parseInt(DOM.contextSizeInput.value, 10) || 30000;
    const maxContextSize = 100000;

    if (contextSize > maxContextSize) {
        console.warn(`上下文大小已超過上限 (100,000)，將自動設為 ${maxContextSize}。`);
        contextSize = maxContextSize;
        DOM.contextSizeInput.value = maxContextSize;
    }

    // 只更新 globalSettings，不影響其他狀態
    state.globalSettings = {
        ...state.globalSettings,  // 保留現有設定（包括 regexRules）
        apiProvider: DOM.apiProviderSelect.value,
        apiModel: DOM.apiModelSelect.value,
        apiKey: DOM.apiKeyInput.value.trim(),
        temperature: DOM.temperatureValue.value,
        topP: DOM.topPValue.value,
        repetitionPenalty: DOM.repetitionPenaltyValue.value,
        contextSize: contextSize,
        maxTokens: DOM.maxTokensValue.value,
        summarizationMaxTokens: parseInt(DOM.summarizationMaxTokensValue.value, 10) || 1000,
        theme: DOM.themeSelect.value,
        summarizationPrompt: DOM.summarizationPromptInput.value.trim()
    };
    
    applyTheme(state.globalSettings.theme);
    
    // 儲存設定但不重新載入狀態
    await saveSettings();
    
    console.log('儲存設定後的狀態:', {
        activeCharacterId: state.activeCharacterId,
        activeChatId: state.activeChatId
    });
    
    // 關閉設定視窗
    toggleModal('global-settings-modal', false);

    // 只更新 UI 上的模型顯示名稱
    if (state.activeCharacterId && state.activeChatId) {
        const provider = state.globalSettings.apiProvider || 'official_gemini';
        const modelId = state.globalSettings.apiModel;
        let modelDisplayName = modelId || '未設定';

        if (modelId && MODELS[provider]) {
            const modelObject = MODELS[provider].find(m => m.value === modelId);
            if (modelObject) {
                modelDisplayName = modelObject.name;
            }
        }
        
        DOM.chatHeaderModelName.textContent = modelDisplayName;
        DOM.chatHeaderModelName.title = modelDisplayName;
    }
}


// ===================================================================================
// 提示詞庫處理函式
// ===================================================================================

export function handleImportPromptSet() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const newPromptSet = PromptManager.parsePromptSetFile(e.target.result, file.name);
                state.promptSets.push(newPromptSet);
                await savePromptSet(newPromptSet);
                
                state.activePromptSetId = newPromptSet.id;
                await saveSettings();

                renderPromptSetSelector();
                renderPromptList();
                alert(`提示詞庫 "${newPromptSet.name}" 匯入成功！`);
            } catch (error) {
                alert(`匯入失敗: ${error.message}`);
                console.error("匯入處理失敗:", error);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

export function handleExportPromptSet() {
    const activeSet = PromptManager.getActivePromptSet();
    if (!activeSet || !activeSet.id || activeSet.id === 'prompt_set_default') {
        alert('請先選擇一個要匯出的自訂提示詞庫。');
        return;
    }

    // 1. 重建符合 SillyTavern 格式的 'prompts' 陣列
    const exportPrompts = activeSet.prompts.map(p => ({
        identifier: p.identifier,
        name: p.name,
        role: p.role,
        content: p.content,
        position: {
            depth: p.position.depth
        }
    }));

    // 2. 重建 'prompt_order' 陣列
    const exportOrder = activeSet.prompts.map(p => ({
        identifier: p.identifier,
        enabled: p.enabled
    }));
    
    const exportData = {
        prompts: exportPrompts,
        prompt_order: [
            {
                character_id: 100001, // SillyTavern 的標準 ID
                order: exportOrder
            }
        ]
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSet.name || 'prompt_set'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function handleAddPromptSet() {
    const setName = prompt('請輸入新提示詞庫的名稱：');
    if (!setName || setName.trim() === '') {
        alert('名稱不能為空！');
        return;
    }

    const newPromptSet = {
        id: `prompt_set_${Date.now()}`,
        name: setName.trim(),
        prompts: [], // 從一個空的提示詞列表開始
    };

    state.promptSets.push(newPromptSet);
    await savePromptSet(newPromptSet);
    
    state.activePromptSetId = newPromptSet.id;
    await saveSettings();

    renderPromptSetSelector();
    renderPromptList();
    alert(`提示詞庫 "${newPromptSet.name}" 已建立！`);
}

export async function handleDeletePromptSet() {
    const setId = DOM.promptSetSelect.value;
    if (!setId) {
        alert('請選擇一個要刪除的設定檔。');
        return;
    }
    if (state.promptSets.length <= 1) {
        alert('無法刪除最後一個提示詞設定檔。');
        return;
    }

    const setToDelete = state.promptSets.find(ps => ps.id === setId);
    if (confirm(`確定要刪除提示詞庫 "${setToDelete.name}" 嗎？`)) {
        state.promptSets = state.promptSets.filter(ps => ps.id !== setId);
        await deletePromptSet(setId);

        if (state.activePromptSetId === setId) {
            state.activePromptSetId = state.promptSets[0].id;
            await saveSettings();
        }

        renderPromptSetSelector();
        renderPromptList();
    }
}

export async function handleSwitchPromptSet(event) {
    const newSetId = event.target.value;
    state.activePromptSetId = newSetId;
    await saveSettings();
    renderPromptList();
}

export async function handleTogglePromptEnabled(identifier) {
    const activeSet = PromptManager.getActivePromptSet();
    if (!activeSet) return;

    const prompt = activeSet.prompts.find(p => p.identifier === identifier);
    if (prompt) {
        prompt.enabled = !prompt.enabled;
        await savePromptSet(activeSet);
        renderPromptList();
    }
}

export function openPromptEditor(identifier) {
    const activeSet = PromptManager.getActivePromptSet();
    const prompt = activeSet.prompts.find(p => p.identifier === identifier);
    if (!prompt) {
        alert('找不到要編輯的提示詞。');
        return;
    }

    tempState.editingPromptIdentifier = identifier;
    DOM.promptEditorTitle.textContent = '編輯提示詞';
    DOM.promptEditorNameInput.value = prompt.name;
    DOM.promptEditorRoleSelect.value = prompt.role || 'system';
    DOM.promptEditorContentInput.value = prompt.content;
    
    const position = prompt.position || { type: 'relative', depth: 4 };
    DOM.promptEditorPositionSelect.value = position.type;
    DOM.promptEditorDepthInput.value = position.depth ?? 4;
    DOM.promptEditorOrderInput.value = prompt.order ?? 0;
    
    handlePromptPositionChange();
    
    toggleModal('prompt-editor-modal', true);
}

export async function handleSavePrompt() {
    const identifier = tempState.editingPromptIdentifier;
    if (!identifier) return;

    const activeSet = PromptManager.getActivePromptSet();
    const prompt = activeSet.prompts.find(p => p.identifier === identifier);
    if (prompt) {
        prompt.name = DOM.promptEditorNameInput.value.trim();
        prompt.role = DOM.promptEditorRoleSelect.value;
        prompt.content = DOM.promptEditorContentInput.value;
        
        prompt.position = {
            type: DOM.promptEditorPositionSelect.value,
            depth: parseInt(DOM.promptEditorDepthInput.value, 10) || 4
        };
        prompt.order = parseInt(DOM.promptEditorOrderInput.value, 10) || 0;

        activeSet.prompts.sort((a, b) => (a.order || 0) - (b.order || 0));

        await savePromptSet(activeSet);
        renderPromptList();
    }

    toggleModal('prompt-editor-modal', false);
    tempState.editingPromptIdentifier = null;
}

export async function handleDeletePromptItem() {
    const identifier = tempState.editingPromptIdentifier;
    if (!identifier) return;

    const activeSet = PromptManager.getActivePromptSet();
    const promptToDelete = activeSet.prompts.find(p => p.identifier === identifier);

    if (confirm(`確定要刪除提示詞「${promptToDelete.name}」嗎？此操作無法復原。`)) {
        activeSet.prompts = activeSet.prompts.filter(p => p.identifier !== identifier);
        await savePromptSet(activeSet);
        renderPromptList();
        toggleModal('prompt-editor-modal', false);
        tempState.editingPromptIdentifier = null;
    }
}

export function handlePromptPositionChange() {
    const isChatType = DOM.promptEditorPositionSelect.value === 'chat';
    DOM.promptDepthOrderContainer.classList.toggle('hidden', !isChatType);
}

export async function handleAddPromptItem() {
    const activeSet = PromptManager.getActivePromptSet();
    if (!activeSet) {
        alert('請先選擇或建立一個提示詞庫。');
        return;
    }

    const newPrompt = {
        identifier: `prompt_${Date.now()}`,
        name: '新提示詞',
        enabled: true,
        role: 'system',
        content: '',
        position: {
            type: 'relative',
            depth: 4
        },
        order: activeSet.prompts.length, // 加到列表末端
    };

    activeSet.prompts.push(newPrompt);
    await savePromptSet(activeSet);
    renderPromptList();
    
    // 為新提示詞打開編輯器
    openPromptEditor(newPrompt.identifier);
}


export async function handlePromptDropSort(draggedIdentifier, targetIdentifier) {
    const activeSet = PromptManager.getActivePromptSet();
    if (!activeSet || !activeSet.prompts) return;

    // Directly find the set in the main state to ensure modifications are persistent
    const activeSetId = state.activePromptSetId;
    const setIndex = state.promptSets.findIndex(ps => ps.id === activeSetId);
    if (setIndex === -1) {
        console.error("Could not find active prompt set in state for sorting.");
        return;
    }
    const setToUpdate = state.promptSets[setIndex];

    const draggedItem = setToUpdate.prompts.find(p => p.identifier === draggedIdentifier);
    if (!draggedItem) return;

    const originalIndex = setToUpdate.prompts.findIndex(p => p.identifier === draggedIdentifier);
    setToUpdate.prompts.splice(originalIndex, 1);

    const targetIndex = targetIdentifier 
        ? setToUpdate.prompts.findIndex(p => p.identifier === targetIdentifier)
        : setToUpdate.prompts.length;

    setToUpdate.prompts.splice(targetIndex, 0, draggedItem);
    
    // Re-index the order property for all items to ensure it's sequential and clean
    setToUpdate.prompts.forEach((p, index) => {
        p.order = index;
    });

    await savePromptSet(setToUpdate);
    renderPromptList();
}


// ===================================================================================
// 世界書 (Lorebook) 處理函式
// ===================================================================================

export async function handleAddNewLorebook() {
    const bookName = prompt('請輸入新世界書的名稱：');
    if (!bookName || bookName.trim() === '') {
        alert('名稱不能為空！');
        return;
    }
    const newLorebook = {
        id: `lorebook_${Date.now()}`,
        name: bookName.trim(),
        entries: [],
        enabled: true, // 新增的預設啟用
    };
    state.lorebooks.push(newLorebook);
    await saveLorebook(newLorebook);
    
    renderLorebookList();
}

export function handleImportLorebook() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const newLorebook = LorebookManager.parseLorebookFile(e.target.result, file.name);
                
                state.lorebooks.push(newLorebook);
                await saveLorebook(newLorebook);
                
                renderLorebookList();
                alert(`世界書 "${newLorebook.name}" 匯入成功！您可以手動啟用它。`);
            } catch (error) {
                alert(`匯入失敗: ${error.message}`);
                console.error("世界書匯入處理失敗:", error);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

export async function handleToggleLorebookEnabled(bookId) {
    const book = state.lorebooks.find(b => b.id === bookId);
    if (book) {
        book.enabled = !book.enabled;
        await saveLorebook(book);
        renderLorebookList();
    }
}

export function openLorebookEntryManager(bookId) {
    tempState.editingLorebookId = bookId;
    renderLorebookEntryList();
    toggleModal('lorebook-entry-editor-modal', true);
}


export async function handleDeleteLorebook(bookId) {
    if (state.lorebooks.length <= 1) {
        alert('無法刪除最後一個世界書。');
        return;
    }

    const bookToDelete = state.lorebooks.find(lb => lb.id === bookId);
    if (confirm(`確定要刪除世界書 "${bookToDelete.name}" 嗎？`)) {
        state.lorebooks = state.lorebooks.filter(lb => lb.id !== bookId);
        await deleteLorebook(bookId);
        renderLorebookList();
    }
}

export async function handleToggleLorebookEntryEnabled(entryId) {
    const book = state.lorebooks.find(b => b.id === tempState.editingLorebookId);
    if (!book) return;

    const entry = book.entries.find(e => e.id === entryId);
    if (entry) {
        entry.enabled = !entry.enabled;
        await saveLorebook(book);
        renderLorebookEntryList();
    }
}

export async function handleToggleLorebookEntryConstant(entryId) {
    const book = state.lorebooks.find(b => b.id === tempState.editingLorebookId);
    if (!book) return;

    const entry = book.entries.find(e => e.id === entryId);
    if (entry) {
        entry.constant = !entry.constant;
        await saveLorebook(book);
        renderLorebookEntryList(); // 重新渲染列表以更新圖示
    }
}

export function openLorebookEditor(entryId = null) {
    tempState.editingLorebookEntryId = entryId;
    const book = state.lorebooks.find(b => b.id === tempState.editingLorebookId);
    if (!book) { alert('發生錯誤，找不到正在編輯的世界書。'); return; }

    if (entryId) {
        const entry = book.entries.find(e => e.id === entryId);
        if (!entry) { alert('找不到要編輯的條目。'); return; }

        DOM.lorebookEditorTitle.textContent = '編輯條目';
        DOM.lorebookEntryNameInput.value = entry.name;
        DOM.lorebookEntryKeywordsInput.value = (entry.keywords || []).join(', ');
        DOM.lorebookEntrySecondaryKeywordsInput.value = (entry.secondaryKeywords || []).join(', ');
        DOM.lorebookEntryContentInput.value = entry.content;
        
        // 進階設定
        DOM.lorebookEntryTriggerSelect.value = entry.constant ? 'constant' : 'keyword';
        DOM.lorebookEntryLogicSelect.value = entry.logic || 0;
        DOM.lorebookEntryPositionSelect.value = entry.position || 'before_char';
        DOM.lorebookEntryOrderInput.value = entry.order ?? 100;
        DOM.lorebookEntryDepthInput.value = entry.scanDepth ?? 4;

        DOM.matchCharDescCheckbox.checked = entry.matchSources?.includes('char_desc') || false;
        DOM.matchScenarioCheckbox.checked = entry.matchSources?.includes('scenario') || false;
        DOM.matchCreatorNotesCheckbox.checked = entry.matchSources?.includes('creator_notes') || false;
        DOM.matchPersonaDescCheckbox.checked = entry.matchSources?.includes('persona_desc') || false;

    } else {
        DOM.lorebookEditorTitle.textContent = '新增條目';
        DOM.lorebookEntryNameInput.value = '';
        DOM.lorebookEntryKeywordsInput.value = '';
        DOM.lorebookEntrySecondaryKeywordsInput.value = '';
        DOM.lorebookEntryContentInput.value = '';
        
        // 重設進階設定為預設值
        DOM.lorebookEntryTriggerSelect.value = 'keyword';
        DOM.lorebookEntryLogicSelect.value = 0;
        DOM.lorebookEntryPositionSelect.value = 'before_char';
        DOM.lorebookEntryOrderInput.value = 100;
        DOM.lorebookEntryDepthInput.value = 4;
        
        DOM.matchCharDescCheckbox.checked = false;
        DOM.matchScenarioCheckbox.checked = false;
        DOM.matchCreatorNotesCheckbox.checked = false;
        DOM.matchPersonaDescCheckbox.checked = false;
    }
    toggleModal('lorebook-editor-modal', true);
}


export async function handleSaveLorebookEntry() {
    const entryId = tempState.editingLorebookEntryId;
    const book = state.lorebooks.find(b => b.id === tempState.editingLorebookId);
    if (!book) return;

    const matchSources = [];
    if (DOM.matchCharDescCheckbox.checked) matchSources.push('char_desc');
    if (DOM.matchScenarioCheckbox.checked) matchSources.push('scenario');
    if (DOM.matchCreatorNotesCheckbox.checked) matchSources.push('creator_notes');
    if (DOM.matchPersonaDescCheckbox.checked) matchSources.push('persona_desc');

    const entryData = {
        name: DOM.lorebookEntryNameInput.value.trim() || '未命名條目',
        keywords: DOM.lorebookEntryKeywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
        secondaryKeywords: DOM.lorebookEntrySecondaryKeywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
        content: DOM.lorebookEntryContentInput.value,
        constant: DOM.lorebookEntryTriggerSelect.value === 'constant',
        logic: parseInt(DOM.lorebookEntryLogicSelect.value, 10),
        position: DOM.lorebookEntryPositionSelect.value,
        order: parseInt(DOM.lorebookEntryOrderInput.value, 10) || 100,
        scanDepth: parseInt(DOM.lorebookEntryDepthInput.value, 10) || 4,
        matchSources: matchSources,
    };

    if (entryId) {
        const entryIndex = book.entries.findIndex(e => e.id === entryId);
        if (entryIndex > -1) {
            const existingEntry = book.entries[entryIndex];
            book.entries[entryIndex] = { ...existingEntry, ...entryData };
        }
    } else {
        const newEntry = {
            id: `entry_${Date.now()}`,
            enabled: true,
            ...entryData
        };
        book.entries.push(newEntry);
    }

    await saveLorebook(book);
    renderLorebookEntryList();
    toggleModal('lorebook-editor-modal', false);
    tempState.editingLorebookEntryId = null;
}

export async function handleDeleteLorebookEntry() {
    const entryId = tempState.editingLorebookEntryId;
    if (!entryId) return;

    const book = state.lorebooks.find(b => b.id === tempState.editingLorebookId);
    if (!book) return;

    const entryToDelete = book.entries.find(e => e.id === entryId);

    if (confirm(`確定要刪除條目「${entryToDelete.name}」嗎？`)) {
        book.entries = book.entries.filter(e => e.id !== entryId);
        await saveLorebook(book);
        renderLorebookEntryList();
        toggleModal('lorebook-editor-modal', false);
        tempState.editingLorebookEntryId = null;
    }
}

export function handleExportSingleLorebook() {
    const bookId = tempState.editingLorebookId;
    if (!bookId) {
        alert('錯誤：找不到要匯出的世界書 ID。');
        return;
    }
    const bookToExport = state.lorebooks.find(lb => lb.id === bookId);
    if (!bookToExport) {
        alert('錯誤：在資料中找不到對應的世界書。');
        return;
    }

    const exportData = {
        entries: {}
    };

    bookToExport.entries.forEach((entry, index) => {
        const uid = `${entry.name.replace(/\s/g, '_')}_${index}`;
        exportData.entries[uid] = {
            uid: uid,
            comment: entry.name,
            key: entry.keywords,
            keysecondary: entry.secondaryKeywords || [],
            content: entry.content,
            disable: !entry.enabled,
            constant: !!entry.constant,
            selectiveLogic: entry.logic,
            addMemo: false, // Default value, can be customized if needed
            order: entry.order,
            position: entry.position, // Assuming we store ST-compatible values
            depth: entry.scanDepth,
            // Storing new match sources if they exist
            matchPersonaDescription: entry.matchSources?.includes('persona_desc') || false,
            matchCharacterDescription: entry.matchSources?.includes('char_desc') || false,
            matchScenario: entry.matchSources?.includes('scenario') || false,
            matchCreatorNotes: entry.matchSources?.includes('creator_notes') || false,
        };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookToExport.name || 'lorebook'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}


// ===================================================================================
// 使用者角色 (User Persona)
// ===================================================================================

export function openUserPersonaEditor(personaId = null) {
    tempState.editingUserPersonaId = personaId;
    if (personaId) {
        const persona = state.userPersonas.find(p => p.id === personaId);
        DOM.userPersonaEditorTitle.textContent = '編輯使用者角色';
        DOM.userPersonaAvatarPreview.src = persona.avatarUrl || DEFAULT_AVATAR;
        DOM.userPersonaNameInput.value = persona.name;
        DOM.userPersonaDescriptionInput.value = persona.description || '';
    } else {
        DOM.userPersonaEditorTitle.textContent = '新增使用者角色';
        DOM.userPersonaAvatarPreview.src = DEFAULT_AVATAR;
        DOM.userPersonaNameInput.value = '';
        DOM.userPersonaDescriptionInput.value = '';
    }
    toggleModal('user-persona-editor-modal', true);
}

export async function handleSaveUserPersona() {
    const personaData = {
        name: DOM.userPersonaNameInput.value.trim(),
        avatarUrl: DOM.userPersonaAvatarPreview.src,
        description: DOM.userPersonaDescriptionInput.value.trim(),
    };
    if (!personaData.name) { alert('角色名稱不能為空！'); return; }

    if (tempState.editingUserPersonaId) {
        const personaIndex = state.userPersonas.findIndex(p => p.id === tempState.editingUserPersonaId);
        const updatedPersona = { ...state.userPersonas[personaIndex], ...personaData };
        state.userPersonas[personaIndex] = updatedPersona;
        await saveUserPersona(updatedPersona);
    } else {
        const newPersona = { id: `user_${Date.now()}`, ...personaData };
        state.userPersonas.push(newPersona);
        await saveUserPersona(newPersona);
    }
    
    loadGlobalSettingsToUI();
    toggleModal('user-persona-editor-modal', false);
}

export async function handleDeleteUserPersona(personaId) {
    if (state.userPersonas.length <= 1) {
        alert('至少需要保留一個使用者角色。');
        return;
    }
    if (confirm('確定要刪除這個使用者角色嗎？')) {
        state.userPersonas = state.userPersonas.filter(p => p.id !== personaId);
        await deleteUserPersona(personaId);
        if (state.activeUserPersonaId === personaId) {
            state.activeUserPersonaId = state.userPersonas[0].id;
            await saveSettings();
        }
        loadGlobalSettingsToUI();
    }
}

export async function handleChatPersonaChange(e) {
    const newPersonaId = e.target.value;
    if (state.activeCharacterId && state.activeChatId) {
        state.chatMetadatas[state.activeCharacterId][state.activeChatId].userPersonaId = newPersonaId;
        await saveAllChatMetadatasForChar(state.activeCharacterId);
        renderChatMessages();
    }
}



// ===================================================================================
// 長期記憶 (Long-term Memory)
// ===================================================================================

export function openMemoryEditor() {
    if (!state.activeCharacterId || !state.activeChatId) {
        alert('請先選擇一個對話才能查看記憶。');
        return;
    }
    const memory = state.longTermMemories[state.activeCharacterId]?.[state.activeChatId] || '尚無長期記憶。';
    DOM.memoryEditorTextarea.value = memory;
    
    try {
        // 預設進入預覽模式
        const markdownText = DOM.memoryEditorTextarea.value;
        const htmlContent = safeRenderMarkdown(markdownText);
        
        DOM.memoryMarkdownPreview.innerHTML = htmlContent;
        DOM.memoryEditorTextarea.classList.add('hidden');
        DOM.memoryMarkdownPreview.classList.remove('hidden');
        if (DOM.toggleMemoryPreviewBtn) {
            DOM.toggleMemoryPreviewBtn.innerHTML = '<i class="fa-solid fa-pen"></i> 編輯模式';
        }
    } catch (e) {
        console.error("Markdown 渲染失敗，切換回編輯模式:", e);
        DOM.memoryEditorTextarea.classList.remove('hidden');
        DOM.memoryMarkdownPreview.classList.add('hidden');
        if (DOM.toggleMemoryPreviewBtn) {
            DOM.toggleMemoryPreviewBtn.innerHTML = '<i class="fa-solid fa-eye"></i> 預覽 Markdown';
        }
    }
    
    toggleModal('memory-editor-modal', true);
}

export function handleToggleMemoryPreview() {
    const isPreviewing = !DOM.memoryMarkdownPreview.classList.contains('hidden');
    
    if (isPreviewing) {
        // 切換回編輯模式
        DOM.memoryMarkdownPreview.classList.add('hidden');
        DOM.memoryEditorTextarea.classList.remove('hidden');
        if (DOM.toggleMemoryPreviewBtn) {
            DOM.toggleMemoryPreviewBtn.innerHTML = '<i class="fa-solid fa-eye"></i> 預覽 Markdown';
        }
    } else {
        // 切換到預覽模式
        try {
            const markdownText = DOM.memoryEditorTextarea.value;
            const htmlContent = safeRenderMarkdown(markdownText);
            
            DOM.memoryMarkdownPreview.innerHTML = htmlContent;
            DOM.memoryEditorTextarea.classList.add('hidden');
            DOM.memoryMarkdownPreview.classList.remove('hidden');
            if (DOM.toggleMemoryPreviewBtn) {
                DOM.toggleMemoryPreviewBtn.innerHTML = '<i class="fa-solid fa-pen"></i> 編輯模式';
            }
        } catch (e) {
            console.error("Markdown 渲染失敗:", e);
            alert("預覽生成失敗，請檢查內容格式。");
        }
    }
}

export async function handleSaveMemory() {
    if (!state.activeCharacterId || !state.activeChatId) return;

    if (!state.longTermMemories[state.activeCharacterId]) {
        state.longTermMemories[state.activeCharacterId] = {};
    }
    state.longTermMemories[state.activeCharacterId][state.activeChatId] = DOM.memoryEditorTextarea.value.trim();
    await saveAllLongTermMemoriesForChar(state.activeCharacterId);
    toggleModal('memory-editor-modal', false);
    alert('長期記憶已儲存！');
}

export async function handleUpdateMemory() {
    if (state.globalSettings.apiProvider !== 'official_gemini' && !state.globalSettings.apiKey) {
        alert('請先在全域設定中設定您的 API 金鑰。');
        return;
    }
    if (!state.activeCharacterId || !state.activeChatId) { alert('請先選擇一個對話。'); return; }
    
    const history = state.chatHistories[state.activeCharacterId][state.activeChatId];
    if (history.length < 4) { alert('對話太短，無法生成有意義的記憶。'); return; }
    
    DOM.updateMemoryBtn.textContent = '記憶生成中...';
    DOM.updateMemoryBtn.disabled = true;
    setGeneratingState(true, false);
    
    try {
        const MAX_SUMMARY_HISTORY_TOKENS = 28000;
        let tokens = 0;
        const truncatedHistory = [];

        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            const content = (msg.role === 'assistant' && Array.isArray(msg.content))
                ? msg.content[msg.activeContentIndex]
                : msg.content;
            
            const messageTokens = (content || '').length;

            if (tokens + messageTokens > MAX_SUMMARY_HISTORY_TOKENS) {
                break;
            }

            tokens += messageTokens;
            truncatedHistory.unshift(msg);
        }

        const conversationText = truncatedHistory.map(m => `${m.role}: ${m.role === 'assistant' ? m.content[m.activeContentIndex] : m.content}`).join('\n');
        
        let userPrompt = state.globalSettings.summarizationPrompt;
        if (!userPrompt) {
            throw new Error("在全域設定中找不到 'summarizationPrompt'。");
        }
        
        const summaryPrompt = userPrompt.replace('{{conversation}}', conversationText);
        
        const provider = state.globalSettings.apiProvider || 'openai';
        let summaryMessages;

        // [FIX] Correctly format payload for each provider
        if (provider === 'google') {
            const contents = [{ role: 'user', parts: [{ text: summaryPrompt }] }];
            summaryMessages = { 
                contents: contents,
                systemInstruction: { parts: [{ text: 'You are a summarization expert.' }] }
            };
        } else if (provider === 'anthropic') {
            summaryMessages = { system: 'You are a summarization expert.', messages: [{ role: 'user', content: summaryPrompt }] };
        } else { // This now includes 'official_gemini', 'openai', etc.
            summaryMessages = [{ role: 'system', content: 'You are a summarization expert.' }, { role: 'user', content: summaryPrompt }];
        }
        
        const summary = await callApi(summaryMessages, true);
        
        if (!state.longTermMemories[state.activeCharacterId]) {
            state.longTermMemories[state.activeCharacterId] = {};
        }
        state.longTermMemories[state.activeCharacterId][state.activeChatId] = summary;
        await saveAllLongTermMemoriesForChar(state.activeCharacterId);
        alert('長期記憶已更新！');
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert(`記憶更新失敗: ${error.message}`);
        }
    } finally {
        DOM.updateMemoryBtn.textContent = '更新記憶';
        DOM.updateMemoryBtn.disabled = false;
        setGeneratingState(false, false);
    }
}

// ===================================================================================
// 匯入/匯出與截圖
// ===================================================================================

export function openExportModal() {
    if (!state.activeCharacterId || !state.activeChatId) {
        alert('請先選擇角色並開啟一個對話。');
        return;
    }
    toggleModal('export-chat-modal', true);
}

export function handleImportChat() {
    if (!state.activeCharacterId || !state.activeChatId) {
        alert('請先選擇一個要匯入紀錄的聊天室。');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jsonl';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonObjects = parseChatLogFile(e.target.result);
                
                const meta = jsonObjects.shift(); 
                if (!meta || !meta.user_name || !meta.character_name) {
                    throw new Error('檔案格式不符，缺少元數據。');
                }

                const newHistory = jsonObjects.map(item => {
                    const date = parseCustomDate(item.send_date);
                    if (isNaN(date.getTime())) {
                        console.warn('無法解析日期:', item.send_date, '將使用目前時間。');
                        item.timestamp = new Date().toISOString();
                    } else {
                        item.timestamp = date.toISOString();
                    }
                    
                    return {
                        role: item.is_user ? 'user' : 'assistant',
                        content: item.is_user ? item.mes : (item.swipes || [item.mes]),
                        activeContentIndex: item.is_user ? 0 : (item.swipe_id || 0),
                        timestamp: item.timestamp
                    };
                });

                const history = state.chatHistories[state.activeCharacterId][state.activeChatId] || [];
                const confirmationMessage = history.length > 0
                    ? '匯入將會覆蓋目前的對話紀錄。此操作無法復原。您確定要繼續嗎？'
                    : '確定要匯入這份對話紀錄嗎？';

                if (confirm(confirmationMessage)) {
                    state.chatHistories[state.activeCharacterId][state.activeChatId] = newHistory;
                    await saveAllChatHistoriesForChar(state.activeCharacterId);

                    // 恢復長期記憶 (如果存在)
                    if (meta.long_term_memory) {
                        if (!state.longTermMemories[state.activeCharacterId]) {
                            state.longTermMemories[state.activeCharacterId] = {};
                        }
                        state.longTermMemories[state.activeCharacterId][state.activeChatId] = meta.long_term_memory;
                        await saveAllLongTermMemoriesForChar(state.activeCharacterId);
                    }

                    renderChatMessages();
                    alert('對話紀錄匯入成功！' + (meta.long_term_memory ? '（包含長期記憶）' : ''));
                }
            } catch (error) {
                console.error("匯入聊天紀錄失敗:", error);
                alert(`匯入失敗：${error.message}`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}


export async function handleConfirmExport() {
    if (!state.activeCharacterId || !state.activeChatId) return;

    toggleModal('export-chat-modal', false);

    if (DOM.exportFormatPng.checked) {
        handleToggleScreenshotMode();
    } else {
        DOM.loadingOverlay.querySelector('p').textContent = '聊天紀錄處理中...';
        DOM.loadingOverlay.classList.remove('hidden');
        try {
            await exportChatAsJsonl();
        } catch (error) {
            alert('匯出失敗，請查看主控台獲取更多資訊。');
        } finally {
            DOM.loadingOverlay.classList.add('hidden');
            DOM.loadingOverlay.querySelector('p').textContent = '圖片生成中，請稍候...';
        }
    }
}


export function handleToggleScreenshotMode() {
    tempState.isScreenshotMode = !tempState.isScreenshotMode;
    
    DOM.chatWindow.classList.toggle('screenshot-mode', tempState.isScreenshotMode);
    DOM.messageInputContainer.classList.toggle('hidden', tempState.isScreenshotMode);
    DOM.screenshotToolbar.classList.toggle('hidden', !tempState.isScreenshotMode);

    if (!tempState.isScreenshotMode) {
        tempState.selectedMessageIndices = [];
        renderChatMessages();
    } else {
        DOM.screenshotInfoText.textContent = `已選擇 0 則訊息`;
    }
}

export function handleSelectMessage(index) {
    if (!tempState.isScreenshotMode) return;

    const selectedIndex = tempState.selectedMessageIndices.indexOf(index);
    if (selectedIndex > -1) {
        tempState.selectedMessageIndices.splice(selectedIndex, 1);
    } else {
        tempState.selectedMessageIndices.push(index);
    }
    
    DOM.screenshotInfoText.textContent = `已選擇 ${tempState.selectedMessageIndices.length} 則訊息`;
    const messageRow = DOM.chatWindow.querySelector(`.message-row[data-index="${index}"]`);
    if (messageRow) {
        messageRow.classList.toggle('selected');
    }
}

export async function handleGenerateScreenshot() {
    if (tempState.selectedMessageIndices.length === 0) {
        alert('請先選擇至少一則訊息！');
        return;
    }

    DOM.loadingOverlay.classList.remove('hidden');
    
    const screenshotContainer = document.createElement('div');
    screenshotContainer.style.backgroundColor = getComputedStyle(DOM.chatWindow).backgroundColor;
    screenshotContainer.style.padding = '20px';
    screenshotContainer.style.width = `${DOM.chatWindow.clientWidth}px`;
    screenshotContainer.style.position = 'absolute';
    screenshotContainer.style.left = '-9999px';
    screenshotContainer.style.top = '0';

    const sortedIndices = [...tempState.selectedMessageIndices].sort((a, b) => a - b);
    
    sortedIndices.forEach(index => {
        const originalMessageNode = DOM.chatWindow.querySelector(`.message-row[data-index="${index}"]`);
        if (originalMessageNode) {
            const clonedMessageNode = originalMessageNode.cloneNode(true);
            clonedMessageNode.classList.remove('selected');
            screenshotContainer.appendChild(clonedMessageNode);
        }
    });

    document.body.appendChild(screenshotContainer);

    try {
        const canvas = await html2canvas(screenshotContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            letterRendering: true, // 改善文字渲染精確度
        });

        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
        link.download = `chat-screenshot-${timestamp}.png`;
        link.href = image;
        link.click();

    } catch (error) {
        console.error('截圖生成失敗:', error);
        alert('抱歉，生成截圖時發生錯誤。');
    } finally {
        document.body.removeChild(screenshotContainer);
        DOM.loadingOverlay.classList.add('hidden');
        handleToggleScreenshotMode();
    }
}

export async function handleGlobalExport() {
    if (!confirm('確定要匯出所有資料嗎？匯出的檔案將不包含您的 API 金鑰以確保安全。')) {
        return;
    }

    try {
        console.log("開始全域匯出...");

        // Deep copy function to avoid modifying the live state
        const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

        // Get all data from DB
        const characters = await db.getAll('characters');
        const chatHistories = await db.getAll('chatHistories');
        const longTermMemories = await db.getAll('longTermMemories');
        const chatMetadatas = await db.getAll('chatMetadatas');
        const userPersonas = await db.getAll('userPersonas');
        const promptSets = await db.getAll('promptSets');
        const lorebooks = await db.getAll('lorebooks');
        const keyValueStore = await db.getAll('keyValueStore');

        // Sanitize the data to remove API keys
        const sanitizedKeyValueStore = deepCopy(keyValueStore);
        const settingsItem = sanitizedKeyValueStore.find(item => item.key === 'settings');

        if (settingsItem) {
            // Remove the main API key from global settings
            if (settingsItem.globalSettings && settingsItem.globalSettings.apiKey) {
                delete settingsItem.globalSettings.apiKey;
            }
            // Remove API keys from presets
            if (settingsItem.apiPresets && Array.isArray(settingsItem.apiPresets)) {
                settingsItem.apiPresets.forEach(preset => {
                    if (preset.apiKey) {
                        delete preset.apiKey;
                    }
                });
            }
        }

        const allData = {
            version: "2.0",
            exportDate: new Date().toISOString(),
            characters,
            chatHistories,
            longTermMemories,
            chatMetadatas,
            userPersonas,
            promptSets,
            lorebooks,
            keyValueStore: sanitizedKeyValueStore, // Use the sanitized data
        };

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `AiChat_Backup_V2_${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('所有資料已成功匯出！');
    } catch (error) {
        console.error("全域匯出失敗:", error);
        alert('匯出失敗，請查看主控台獲取更多資訊。');
    }
}

export function handleGlobalImport(mode) {
    const confirmationMessage = mode === 'overwrite' 
        ? '警告：覆蓋匯入將會完全清除您目前所有的資料。此操作無法復原。您確定要繼續嗎？'
        : '合併匯入將會加入新的資料，但不會覆蓋任何現有項目。您確定要繼續嗎？';

    if (!confirm(confirmationMessage)) {
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (!importedData.version || !importedData.characters || !importedData.keyValueStore) {
                    throw new Error('檔案格式不符或已損壞。');
                }

                DOM.loadingOverlay.classList.remove('hidden');
                
                const storesToProcess = ['characters', 'chatHistories', 'longTermMemories', 'chatMetadatas', 'userPersonas', 'promptSets', 'lorebooks', 'keyValueStore'];

                if (mode === 'overwrite') {
                    for (const storeName of storesToProcess) {
                        await db.clearStore(storeName);
                        if (importedData[storeName]) {
                            for (const item of importedData[storeName]) {
                                await db.put(storeName, item);
                            }
                        }
                    }
                } else { 
                    for (const storeName of storesToProcess) {
                         if (importedData[storeName]) {
                            const existingItems = await db.getAll(storeName);
                            const keyPath = storeName === 'keyValueStore' ? 'key' : 'id';
                            const existingIds = new Set(existingItems.map(item => item[keyPath]));
                            const itemsToImport = importedData[storeName].filter(item => !existingIds.has(item[keyPath]));
                            for (const item of itemsToImport) {
                                await db.put(storeName, item);
                            }
                        }
                    }
                }

                DOM.loadingOverlay.classList.add('hidden');
                alert('資料匯入成功！應用程式將會重新載入以套用變更。');
                location.reload();

            } catch (error) {
                DOM.loadingOverlay.classList.add('hidden');
                console.error("全域匯入失敗:", error);
                alert(`匯入失敗：${error.message}`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

// ===================================================================================
// 正規表達式規則處理
// ===================================================================================

export async function handleAddRegexRule() {
    const newRule = {
        id: `regex_${Date.now()}`,
        name: '新規則',
        find: '',
        replace: '',
        enabled: true
    };
    if (!state.globalSettings.regexRules) {
        state.globalSettings.regexRules = [];
    }
    state.globalSettings.regexRules.push(newRule);
    await saveSettings();
    renderRegexRulesList();
}

export async function handleRegexRuleChange(event) {
    const input = event.target;
    const ruleItem = input.closest('.regex-rule-item');
    if (!ruleItem) return;

    const ruleId = ruleItem.dataset.id;
    const rule = state.globalSettings.regexRules.find(r => r.id === ruleId);
    if (!rule) return;

    if (input.classList.contains('regex-name-input')) {
        rule.name = input.value;
    } else if (input.classList.contains('regex-find-input')) {
        rule.find = input.value;
    } else if (input.classList.contains('regex-replace-input')) {
        rule.replace = input.value;
    }

    await saveSettings();
}

export async function handleRegexRuleToggle(ruleId) {
    const rule = state.globalSettings.regexRules.find(r => r.id === ruleId);
    if (rule) {
        rule.enabled = !rule.enabled;
        await saveSettings();
        renderRegexRulesList();
    }
}

export async function handleDeleteRegexRule(ruleId) {
    if (confirm('確定要刪除這條規則嗎？')) {
        state.globalSettings.regexRules = state.globalSettings.regexRules.filter(r => r.id !== ruleId);
        await saveSettings();
        renderRegexRulesList();
    }
}

/**
 * @description [NEW] 處理進階匯入的邏輯
 */
export async function handleAdvancedImport(importBoth) {
    // 從 tempState 讀取暫存的資料
    const { importedData, importedLorebook, importedRegex, importedImageBase64 } = tempState;

    if (!importedData) {
        alert("匯入錯誤：找不到角色卡資料。");
        return;
    }
    
    toggleModal('advanced-import-modal', false);

    if (importBoth) {
        // 匯入世界書
        if (importedLorebook) {
            const data = importedData.data || importedData;
            const bookName = importedLorebook.name || `${data.name} 的世界書`;
            const existingBook = state.lorebooks.find(book => book.name === bookName);

            let bookToActivateId;

            if (existingBook) {
                // 如果已存在同名世界書
                if (confirm(`偵測到已存在名為「${bookName}」的世界書。\n\n您是否要直接啟用它？\n(按「取消」將不會變更目前啟用的世界書)`)) {
                    bookToActivateId = existingBook.id;
                }
            } else {
                // 如果不存在，則建立新的世界書
                const entriesSource = Array.isArray(importedLorebook.entries) ? importedLorebook.entries : Object.values(importedLorebook.entries);
                const newEntries = entriesSource.map((entry, index) => ({
                    id: `entry_${entry.id || Date.now() + index}`,
                    name: entry.comment || entry.name || '未命名條目',
                    keywords: entry.key || entry.keywords || [],
                    secondaryKeywords: entry.keysecondary || [],
                    content: entry.content || '',
                    // [修正] 增加相容性，同時檢查 disable 和 enabled 屬性
                    enabled: typeof entry.disable !== 'undefined' ? !entry.disable : (entry.enabled !== false),
                    order: entry.order || 100,
                    position: entry.position || 'before_char',
                    scanDepth: entry.depth || 4,
                    logic: entry.selectiveLogic || 0,
                    constant: !!entry.constant, 
                    matchSources: [], // Start with empty and populate below
                }));

                const newLorebook = {
                    id: `lorebook_${Date.now()}`,
                    name: bookName,
                    entries: newEntries,
                    enabled: false, // 預設不啟用，讓使用者決定
                };

                state.lorebooks.push(newLorebook);
                await saveLorebook(newLorebook);
                renderLorebookList(); // 匯入後立刻刷新列表
                
                if (confirm(`已成功匯入新的世界書「${bookName}」。\n\n您是否要立刻將其設為啟用狀態？`)) {
                    bookToActivateId = newLorebook.id;
                }
            }

            if (bookToActivateId) {
                const book = state.lorebooks.find(b => b.id === bookToActivateId);
                if(book) {
                    book.enabled = true;
                    await saveLorebook(book);
                    renderLorebookList(); // 啟用後再次刷新列表
                }
            }
        }

        // 匯入正規表達式
        if (importedRegex) {
            const data = importedData.data || importedData;
            const newRule = {
                id: `regex_${Date.now()}`,
                name: `來自 ${data.name} 的規則`,
                find: importedRegex,
                replace: '',
                enabled: true
            };
            if (!state.globalSettings.regexRules) {
                state.globalSettings.regexRules = [];
            }
            state.globalSettings.regexRules.push(newRule);
            await saveSettings();
            alert(`已成功將一條來自「${data.name}」的正規表達式規則新增至您的設定中。`);
        }
    }
    
    populateEditorFields(importedData, importedImageBase64);

    // 清空暫存資料
    tempState.importedData = null;
    tempState.importedLorebook = null;
    tempState.importedRegex = null;
    tempState.importedImageBase64 = null;
}

