// js/events.js
// 這個檔案專門用來綁定所有的事件監聽器，並使用事件委派處理動態內容。

import * as DOM from './dom.js';
import * as Handlers from './handlers.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';
import * as SceneMapManager from './sceneMapManager.js';
import { state, tempState, saveSettings, loadChatDataForCharacter } from './state.js';

/**
 * @description 集中設定所有 DOM 元素的事件監聽器
 */
export function setupEventListeners() {
    // Helper function to safely add event listeners
    const safeAddEventListener = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            // console.warn(`Event listener for ${event} could not be attached as the element is null.`);
        }
    };

    // 帳號認證
    safeAddEventListener(DOM.loginBtnInSettings, 'click', Handlers.handleLogin);
    safeAddEventListener(DOM.logoutBtn, 'click', Handlers.handleLogout);

    // 側邊欄與行動裝置
    safeAddEventListener(DOM.menuToggleBtn, 'click', () => {
        DOM.leftPanel.classList.toggle('mobile-visible');
        DOM.mobileOverlay.classList.toggle('hidden');
    });
    safeAddEventListener(DOM.mobileOverlay, 'click', () => {
        DOM.leftPanel.classList.remove('mobile-visible');
        DOM.mobileOverlay.classList.add('hidden');
    });

    // 角色與聊天室列表
    safeAddEventListener(DOM.backToCharsBtn, 'click', async () => {
        UI.switchPanelToCharacterView();
        state.activeChatId = null;
        await saveSettings();
    });
    safeAddEventListener(DOM.addChatBtn, 'click', Handlers.handleAddNewChat);

    if (DOM.editActiveCharacterBtn) {
        safeAddEventListener(DOM.editActiveCharacterBtn, 'click', () => {
            if (DOM.leftPanel.classList.contains('mobile-visible')) {
                DOM.leftPanel.classList.remove('mobile-visible');
                DOM.mobileOverlay.classList.add('hidden');
            }
            Handlers.openCharacterEditor(state.activeCharacterId)
        });
    }

    safeAddEventListener(DOM.deleteActiveCharacterBtn, 'click', Handlers.handleDeleteActiveCharacter);
    safeAddEventListener(DOM.headerLoveChatBtn, 'click', () => Handlers.handleToggleCharacterLove(state.activeCharacterId));

    // 聊天介面
    safeAddEventListener(DOM.chatNotesInput, 'blur', Handlers.handleSaveNote);
    safeAddEventListener(DOM.sendBtn, 'click', Handlers.handleSendBtnClick);

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    safeAddEventListener(DOM.messageInput, 'keydown', (e) => {
        if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
            e.preventDefault();
            Handlers.handleSendBtnClick();
        }
    });

    safeAddEventListener(DOM.messageInput, 'input', () => {
        DOM.messageInput.style.height = 'auto';
        DOM.messageInput.style.height = `${DOM.messageInput.scrollHeight}px`;
        UI.updateSendButtonState();
    });

    safeAddEventListener(DOM.chatOptionsBtn, 'click', (e) => {
        e.stopPropagation();
        DOM.chatOptionsMenu.classList.toggle('hidden');
    });
    safeAddEventListener(DOM.deleteChatOptionBtn, 'click', Handlers.handleDeleteCurrentChat);

    window.addEventListener('click', (e) => {
        // 隱藏聊天室右上角的下拉選單
        if (DOM.chatOptionsMenu && !DOM.chatOptionsMenu.classList.contains('hidden')) {
            DOM.chatOptionsMenu.classList.add('hidden');
        }
        // [NEW] 隱藏側邊欄聊天室項目的下拉選單
        document.querySelectorAll('.session-dropdown-menu').forEach(menu => {
            if (!menu.classList.contains('hidden') && !menu.parentElement.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
    });

    // Modals
    safeAddEventListener(DOM.saveRenameChatBtn, 'click', Handlers.handleSaveChatName);
    safeAddEventListener(DOM.cancelRenameChatBtn, 'click', () => UI.toggleModal('rename-chat-modal', false));
    safeAddEventListener(DOM.updateMemoryBtn, 'click', Handlers.handleUpdateMemory);
    safeAddEventListener(DOM.viewMemoryBtn, 'click', Handlers.openMemoryEditor);
    safeAddEventListener(DOM.saveMemoryEditorBtn, 'click', Handlers.handleSaveMemory);
    safeAddEventListener(DOM.toggleMemoryPreviewBtn, 'click', Handlers.handleToggleMemoryPreview); // NEW
    safeAddEventListener(DOM.cancelMemoryEditorBtn, 'click', () => UI.toggleModal('memory-editor-modal', false));

    safeAddEventListener(DOM.addCharacterBtn, 'click', () => {
        if (DOM.leftPanel.classList.contains('mobile-visible')) {
            DOM.leftPanel.classList.remove('mobile-visible');
            DOM.mobileOverlay.classList.add('hidden');
        }
        Handlers.openCharacterEditor()
    });

    safeAddEventListener(DOM.saveCharBtn, 'click', Handlers.handleSaveCharacter);
    safeAddEventListener(DOM.cancelCharEditorBtn, 'click', () => UI.toggleModal('character-editor-modal', false));
    safeAddEventListener(DOM.importCharBtn, 'click', Utils.importCharacter);
    safeAddEventListener(DOM.exportCharBtn, 'click', Utils.exportCharacter);
    safeAddEventListener(DOM.charAvatarUpload, 'change', (e) => Utils.handleImageUpload(e, DOM.charAvatarPreview));

    safeAddEventListener(DOM.addFirstMessageBtn, 'click', () => {
        const item = document.createElement('div');
        item.className = 'first-message-item';
        const nextIndex = DOM.firstMessageList.children.length + 1;
        item.innerHTML = `
            <textarea class="char-first-message" placeholder="開場白 #${nextIndex}" rows="1"></textarea>
            <button type="button" class="icon-btn-sm danger remove-first-message-btn" title="移除此開場白">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        DOM.firstMessageList.appendChild(item);
        const textarea = item.querySelector('textarea');
        textarea.focus();
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });
    });
    safeAddEventListener(DOM.firstMessageList, 'click', (e) => {
        const removeBtn = e.target.closest('.remove-first-message-btn');
        if (removeBtn) {
            if (DOM.firstMessageList.children.length > 1) {
                removeBtn.closest('.first-message-item').remove();
            } else {
                alert('至少需要保留一個開場白。');
            }
        }
    });

    safeAddEventListener(DOM.charEditorModal, 'click', (e) => {
        const header = e.target.closest('.advanced-section-header');
        if (header) {
            header.parentElement.classList.toggle('expanded');
        }
    });

    safeAddEventListener(DOM.lorebookEditorModal, 'click', (e) => {
        const header = e.target.closest('.advanced-section-header');
        if (header) {
            header.parentElement.classList.toggle('expanded');
        }
    });

    safeAddEventListener(DOM.globalSettingsBtn, 'click', () => {
        if (DOM.leftPanel.classList.contains('mobile-visible')) {
            DOM.leftPanel.classList.remove('mobile-visible');
            DOM.mobileOverlay.classList.add('hidden');
        }
        UI.loadGlobalSettingsToUI();
        UI.toggleModal('global-settings-modal', true);
    });

    safeAddEventListener(DOM.globalSettingsModal, 'click', (e) => {
        const advancedHeader = e.target.closest('.advanced-section-header');
        if (advancedHeader) {
            advancedHeader.parentElement.classList.toggle('expanded');
        }

        const aboutHeader = e.target.closest('.about-section-header');
        if (aboutHeader) {
            aboutHeader.parentElement.classList.toggle('expanded');
        }
    });

    safeAddEventListener(DOM.testApiBtn, 'click', Handlers.handleTestApiConnection);
    safeAddEventListener(DOM.saveGlobalSettingsBtn, 'click', Handlers.handleSaveGlobalSettings);
    safeAddEventListener(DOM.cancelGlobalSettingsBtn, 'click', () => UI.toggleModal('global-settings-modal', false));

    if (DOM.temperatureSlider) Utils.setupSliderSync(DOM.temperatureSlider, DOM.temperatureValue);
    if (DOM.topPSlider) Utils.setupSliderSync(DOM.topPSlider, DOM.topPValue);
    if (DOM.repetitionPenaltySlider) Utils.setupSliderSync(DOM.repetitionPenaltySlider, DOM.repetitionPenaltyValue);

    safeAddEventListener(DOM.apiProviderSelect, 'change', UI.updateModelDropdown);

    // API 設定檔
    safeAddEventListener(DOM.saveApiPresetBtn, 'click', Handlers.handleSaveApiPreset);
    safeAddEventListener(DOM.apiPresetSelect, 'change', Handlers.handleLoadApiPreset);
    safeAddEventListener(DOM.deleteApiPresetBtn, 'click', Handlers.handleDeleteApiPreset);

    // 设定分页
    safeAddEventListener(DOM.settingsTabsContainer, 'click', (e) => {
        const tabButton = e.target.closest('.tab-btn');
        if (!tabButton) return;
        const tabId = tabButton.dataset.tab;
        DOM.settingsTabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        tabButton.classList.add('active');
        DOM.globalSettingsModal.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    });
    safeAddEventListener(DOM.themeSelect, 'change', (e) => Utils.applyTheme(e.target.value));

    // 提示词库
    safeAddEventListener(DOM.importPromptSetBtn, 'click', Handlers.handleImportPromptSet);
    safeAddEventListener(DOM.exportPromptSetBtn, 'click', Handlers.handleExportPromptSet);
    safeAddEventListener(DOM.addPromptSetBtn, 'click', Handlers.handleAddPromptSet);
    safeAddEventListener(DOM.deletePromptSetBtn, 'click', Handlers.handleDeletePromptSet);
    safeAddEventListener(DOM.promptSetSelect, 'change', Handlers.handleSwitchPromptSet);
    safeAddEventListener(DOM.addPromptBtn, 'click', Handlers.handleAddPromptItem);
    safeAddEventListener(DOM.promptList, 'click', (e) => {
        const toggle = e.target.closest('.prompt-item-toggle');
        const editBtn = e.target.closest('.edit-prompt-btn');
        if (toggle) {
            Handlers.handleTogglePromptEnabled(toggle.closest('.prompt-item').dataset.id);
        } else if (editBtn) {
            Handlers.openPromptEditor(editBtn.closest('.prompt-item').dataset.id);
        }
    });
    safeAddEventListener(DOM.savePromptEditorBtn, 'click', Handlers.handleSavePrompt);
    safeAddEventListener(DOM.cancelPromptEditorBtn, 'click', () => {
        UI.toggleModal('prompt-editor-modal', false);
        tempState.editingPromptIdentifier = null;
    });
    safeAddEventListener(DOM.deletePromptEditorBtn, 'click', Handlers.handleDeletePromptItem);
    safeAddEventListener(DOM.promptEditorPositionSelect, 'change', Handlers.handlePromptPositionChange);

    // 場景地圖 (Scene Map) - 聊天室層級
    safeAddEventListener(DOM.viewSceneBtn, 'click', Handlers.openSceneMapEditor);
    safeAddEventListener(DOM.undoSessionBtn, 'click', Handlers.handleUndoSession);
    safeAddEventListener(DOM.resetSceneMapBtn, 'click', Handlers.handleResetSceneMap);
    safeAddEventListener(DOM.closeSceneMapEditorBtn, 'click', () => UI.toggleModal('scene-map-editor-modal', false));
    safeAddEventListener(DOM.closeSceneMapEditorBtnMobile, 'click', () => UI.toggleModal('scene-map-editor-modal', false));
    safeAddEventListener(DOM.addRootSceneNodeBtn, 'click', () => Handlers.openSceneNodeEditor(null, null));

    safeAddEventListener(DOM.sceneTreeContainer, 'click', (e) => {
        const editBtn = e.target.closest('.edit-node-btn');
        const addChildBtn = e.target.closest('.add-child-node-btn');
        const toggleBtn = e.target.closest('.toggle-node-btn');

        if (editBtn) {
            const nodeId = editBtn.dataset.nodeId;
            Handlers.openSceneNodeEditor(nodeId, null);
        } else if (addChildBtn) {
            const parentId = addChildBtn.dataset.nodeId;
            Handlers.openSceneNodeEditor(null, parentId);
        } else if (toggleBtn) {
            const nodeId = toggleBtn.dataset.nodeId;
            if (tempState.collapsedSceneNodes.has(nodeId)) {
                tempState.collapsedSceneNodes.delete(nodeId);
            } else {
                tempState.collapsedSceneNodes.add(nodeId);
            }
            UI.renderSceneTree();
        }
    });

    safeAddEventListener(DOM.saveSceneNodeBtn, 'click', Handlers.handleSaveSceneNode);
    safeAddEventListener(DOM.cancelSceneNodeEditorBtn, 'click', () => UI.toggleModal('scene-node-editor-modal', false));
    safeAddEventListener(DOM.deleteSceneNodeBtn, 'click', Handlers.handleDeleteSceneNode);
    safeAddEventListener(DOM.aiSuggestKeywordsBtn, 'click', Handlers.handleAiSuggestKeywords); // AI 建議關鍵字

    // AI 輔助場景分析
    safeAddEventListener(DOM.aiSceneAnalysisBtn, 'click', Handlers.handleAiSceneAnalysis);
    safeAddEventListener(DOM.applySceneUpdatesBtn, 'click', Handlers.applySelectedSceneUpdates);
    safeAddEventListener(DOM.applySceneUpdatesBtn, 'click', Handlers.applySelectedSceneUpdates);
    safeAddEventListener(DOM.cancelSceneUpdatesBtn, 'click', Handlers.cancelSceneUpdates);
    // [NEW] 場景地圖匯入/匯出
    if (DOM.exportSceneMapBtn) {
        console.log('Binding exportSceneMapBtn');
        safeAddEventListener(DOM.exportSceneMapBtn, 'click', Handlers.handleExportSceneBtnClick);
    } else {
        console.error('exportSceneMapBtn not found in DOM');
    }

    if (DOM.importSceneMapBtn) {
        console.log('Binding importSceneMapBtn');
        safeAddEventListener(DOM.importSceneMapBtn, 'click', Handlers.handleImportSceneBtnClick);
    } else {
        console.error('importSceneMapBtn not found in DOM');
    }


    // 場景節點拖放
    setupSceneNodeDragAndDrop();

    // [NEW] 場景地圖拖曳捲動 (Panning)
    setupSceneMapPanning();

    // 世界書 (Lorebook)
    safeAddEventListener(DOM.addLorebookBtn, 'click', Handlers.handleAddNewLorebook);
    safeAddEventListener(DOM.importLorebookBtn, 'click', Handlers.handleImportLorebook);
    safeAddEventListener(DOM.lorebookList, 'click', (e) => {
        const item = e.target.closest('.lorebook-item');
        if (!item) return;
        const bookId = item.dataset.id;
        if (e.target.closest('.prompt-item-toggle')) {
            Handlers.handleToggleLorebookEnabled(bookId);
        } else if (e.target.closest('.edit-lorebook-btn')) {
            Handlers.openLorebookEntryManager(bookId);
        } else if (e.target.closest('.delete-lorebook-btn')) {
            Handlers.handleDeleteLorebook(bookId);
        }
    });

    // 條目編輯器 Modal
    safeAddEventListener(DOM.closeLorebookEntryEditorBtn, 'click', () => UI.toggleModal('lorebook-entry-editor-modal', false));
    safeAddEventListener(DOM.addLorebookEntryBtn, 'click', () => Handlers.openLorebookEditor());
    safeAddEventListener(DOM.exportSingleLorebookBtn, 'click', Handlers.handleExportSingleLorebook);
    safeAddEventListener(DOM.lorebookEntryList, 'click', (e) => {
        const item = e.target.closest('.prompt-item');
        if (!item) return;
        const entryId = item.dataset.id;
        if (e.target.closest('.prompt-item-toggle')) {
            Handlers.handleToggleLorebookEntryEnabled(entryId);
        } else if (e.target.closest('.edit-lorebook-entry-btn')) {
            Handlers.openLorebookEditor(entryId);
        } else if (e.target.closest('.lorebook-status-indicator')) {
            Handlers.handleToggleLorebookEntryConstant(entryId);
        }
    });

    // 單一條目編輯 Modal
    safeAddEventListener(DOM.saveLorebookEntryBtn, 'click', Handlers.handleSaveLorebookEntry);
    safeAddEventListener(DOM.cancelLorebookEditorBtn, 'click', () => {
        UI.toggleModal('lorebook-editor-modal', false);
        tempState.editingLorebookEntryId = null;
    });
    safeAddEventListener(DOM.deleteLorebookEntryBtn, 'click', Handlers.handleDeleteLorebookEntry);

    // 正規表達式
    safeAddEventListener(DOM.addRegexRuleBtn, 'click', Handlers.handleAddRegexRule);
    safeAddEventListener(DOM.regexRulesList, 'change', Handlers.handleRegexRuleChange);
    safeAddEventListener(DOM.regexRulesList, 'click', (e) => {
        const ruleItem = e.target.closest('.regex-rule-item');
        if (!ruleItem) return;
        const ruleId = ruleItem.dataset.id;
        if (e.target.closest('.prompt-item-toggle')) Handlers.handleRegexRuleToggle(ruleId);
        else if (e.target.closest('.delete-regex-rule-btn')) Handlers.handleDeleteRegexRule(ruleId);
        else if (e.target.closest('.regex-expand-btn')) ruleItem.classList.toggle('expanded');
    });

    // 使用者角色
    safeAddEventListener(DOM.addUserPersonaBtn, 'click', () => Handlers.openUserPersonaEditor());
    safeAddEventListener(DOM.saveUserPersonaBtn, 'click', Handlers.handleSaveUserPersona);
    safeAddEventListener(DOM.cancelUserPersonaEditorBtn, 'click', () => UI.toggleModal('user-persona-editor-modal', false));
    safeAddEventListener(DOM.activeUserPersonaSelect, 'change', async (e) => {
        state.activeUserPersonaId = e.target.value;
        await saveSettings();
    });
    safeAddEventListener(DOM.chatUserPersonaSelect, 'change', Handlers.handleChatPersonaChange);
    safeAddEventListener(DOM.userPersonaAvatarUpload, 'change', (e) => Utils.handleImageUpload(e, DOM.userPersonaAvatarPreview));

    // 匯出與截圖
    safeAddEventListener(DOM.importChatOptionBtn, 'click', Handlers.handleImportChat);
    safeAddEventListener(DOM.exportChatOptionBtn, 'click', Handlers.openExportModal);
    safeAddEventListener(DOM.confirmExportChatBtn, 'click', Handlers.handleConfirmExport);
    safeAddEventListener(DOM.cancelExportChatBtn, 'click', () => UI.toggleModal('export-chat-modal', false));
    safeAddEventListener(DOM.cancelScreenshotBtn, 'click', Handlers.handleToggleScreenshotMode);
    safeAddEventListener(DOM.generateScreenshotBtn, 'click', Handlers.handleGenerateScreenshot);

    // 全域匯入/匯出
    safeAddEventListener(DOM.globalExportBtn, 'click', Handlers.handleGlobalExport);
    safeAddEventListener(DOM.openImportOptionsBtn, 'click', () => UI.toggleModal('import-options-modal', true));
    safeAddEventListener(DOM.cancelImportOptionsBtn, 'click', () => UI.toggleModal('import-options-modal', false));
    safeAddEventListener(DOM.importMergeBtn, 'click', () => {
        UI.toggleModal('import-options-modal', false);
        Handlers.handleGlobalImport('merge');
    });
    safeAddEventListener(DOM.importOverwriteBtn, 'click', () => {
        UI.toggleModal('import-options-modal', false);
        Handlers.handleGlobalImport('overwrite');
    });

    // 進階匯入 Modal
    safeAddEventListener(DOM.cancelAdvancedImportBtn, 'click', () => {
        UI.toggleModal('advanced-import-modal', false);
        tempState.importedData = null;
        tempState.importedLorebook = null;
        tempState.importedRegex = null;
        tempState.importedImageBase64 = null;
    });
    safeAddEventListener(DOM.importJustCharBtn, 'click', () => Handlers.handleAdvancedImport(false));
    safeAddEventListener(DOM.importWithExtrasBtn, 'click', () => Handlers.handleAdvancedImport(true));

    // Prompt Viewer
    safeAddEventListener(DOM.viewPromptOptionBtn, 'click', Handlers.handleViewPrompt);
    safeAddEventListener(DOM.copyPromptBtn, 'click', Handlers.handleCopyPrompt);
    safeAddEventListener(DOM.closeViewPromptBtn, 'click', () => UI.toggleModal('view-prompt-modal', false));

    // 登入 Modal
    safeAddEventListener(DOM.googleLoginBtn, 'click', Handlers.handleGoogleLogin);
    safeAddEventListener(DOM.loginForm, 'submit', Handlers.handleEmailLogin);
    safeAddEventListener(DOM.registerForm, 'submit', Handlers.handleEmailRegister);
    safeAddEventListener(DOM.cancelAuthModalBtn, 'click', () => UI.toggleModal('auth-modal', false));
    safeAddEventListener(DOM.showRegisterViewBtn, 'click', (e) => {
        e.preventDefault();
        DOM.loginView.classList.add('hidden');
        DOM.registerView.classList.remove('hidden');
    });
    safeAddEventListener(DOM.showLoginViewBtn, 'click', (e) => {
        e.preventDefault();
        DOM.registerView.classList.add('hidden');
        DOM.loginView.classList.remove('hidden');
    });

    // 刪除選項 Modal
    safeAddEventListener(DOM.deleteSingleVersionBtn, 'click', Handlers.handleDeleteSingleVersion);
    safeAddEventListener(DOM.deleteAllVersionsBtn, 'click', Handlers.handleDeleteAllVersions);
    safeAddEventListener(DOM.cancelDeleteOptionsBtn, 'click', () => UI.toggleModal('delete-options-modal', false));

    window.addEventListener('resize', Utils.setAppHeight);

    // ================== 事件委派 (處理動態產生的元素) ==================

    safeAddEventListener(DOM.characterList, 'click', async (e) => {
        const charItem = e.target.closest('.character-item');
        if (!charItem || e.target.closest('.drag-handle')) return;
        const charId = charItem.dataset.id;
        await loadChatDataForCharacter(charId);
        UI.showChatSessionListView(charId);
        state.activeCharacterId = charId;
        state.activeChatId = null;
        await saveSettings();
    });

    safeAddEventListener(DOM.chatSessionList, 'click', async (e) => {
        const sessionItem = e.target.closest('.chat-session-item');
        if (!sessionItem) return;
        const chatId = sessionItem.dataset.id;

        if (e.target.closest('.session-item-content')) {
            await Handlers.switchChat(chatId);
            DOM.leftPanel.classList.remove('mobile-visible');
            DOM.mobileOverlay.classList.add('hidden');
        } else if (e.target.closest('.pin-chat-btn')) {
            await Handlers.handleTogglePinChat(chatId);
        } else if (e.target.closest('.session-more-options-btn')) {
            e.stopPropagation();
            const menu = sessionItem.querySelector('.session-dropdown-menu');
            if (menu) {
                const isOpening = menu.classList.contains('hidden');

                // 隱藏其他所有已開啟的選單，並移除它們父層的 class
                document.querySelectorAll('.session-dropdown-menu').forEach(otherMenu => {
                    otherMenu.classList.add('hidden');
                    otherMenu.closest('.chat-session-item').classList.remove('menu-is-open');
                });

                // 切換目前點擊的選單
                if (isOpening) {
                    menu.classList.remove('hidden');
                    sessionItem.classList.add('menu-is-open');
                }
            }
        } else if (e.target.closest('.rename-chat-btn')) {
            Handlers.openRenameModal(chatId);
        } else if (e.target.closest('.delete-chat-btn')) {
            await Handlers.handleDeleteChat(chatId);
        }
    });

    safeAddEventListener(DOM.chatWindow, 'click', async (e) => {
        const messageRow = e.target.closest('.message-row');

        // Clicked outside any message row
        if (!messageRow) {
            if (!tempState.isScreenshotMode) {
                // Hide all edit buttons
                document.querySelectorAll('.edit-msg-btn').forEach(btn => btn.classList.add('hidden'));
            }
            return;
        }

        const messageIndex = parseInt(messageRow.dataset.index, 10);
        if (tempState.isScreenshotMode) {
            Handlers.handleSelectMessage(messageIndex);
            return;
        }

        // Clicked on a chat bubble
        if (e.target.closest('.chat-bubble')) {
            const currentEditBtn = messageRow.querySelector('.edit-msg-btn');

            // Hide all other edit buttons
            document.querySelectorAll('.edit-msg-btn').forEach(otherBtn => {
                if (otherBtn !== currentEditBtn) {
                    otherBtn.classList.add('hidden');
                }
            });

            // Toggle the current one
            if (currentEditBtn) {
                currentEditBtn.classList.toggle('hidden');
            }
        }
        else if (e.target.closest('.edit-msg-btn')) { // Clicked the edit button itself
            Handlers.makeMessageEditable(messageRow, messageIndex);
        }
        else if (e.target.closest('.regenerate-btn-sm')) await Handlers.regenerateResponse(messageIndex);
        else if (e.target.closest('.retry-btn-sm')) await Handlers.retryMessage(messageIndex);
        else if (e.target.closest('.version-prev-btn')) await Handlers.switchVersion(messageIndex, -1);
        else if (e.target.closest('.version-next-btn')) await Handlers.switchVersion(messageIndex, 1);
    });

    safeAddEventListener(DOM.userPersonaList, 'click', async (e) => {
        const personaItem = e.target.closest('.persona-item');
        if (!personaItem) return;
        const personaId = personaItem.dataset.id;
        if (e.target.closest('.edit-persona-btn')) Handlers.openUserPersonaEditor(personaId);
        else if (e.target.closest('.delete-persona-btn')) await Handlers.handleDeleteUserPersona(personaId);
    });

    // 拖曳排序邏輯
    let draggedId = null;
    let draggedElement = null;
    let isDragging = false;

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[data-id]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    const setupDragSort = (container, handler) => {
        if (!container) return;

        const onPointerDown = (e) => {
            // [MODIFIED] 只在點擊 .drag-handle 時才啟動拖曳
            const dragHandle = e.target.closest('.drag-handle');
            if (!dragHandle) return;

            const targetItem = dragHandle.closest('[data-id]');
            if (!targetItem || (e.pointerType === 'mouse' && e.button !== 0)) return;

            e.preventDefault(); // 防止文字選取等預設行為

            draggedElement = targetItem;
            isDragging = true;
            draggedId = targetItem.dataset.id;

            draggedElement.classList.add('dragging');
            document.body.classList.add('is-dragging');
            if (navigator.vibrate) navigator.vibrate(50);

            document.addEventListener('pointermove', onPointerMove, { passive: false });
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerCancel);
        };
        const onPointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const afterElement = getDragAfterElement(container, e.clientY);
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';

            if (afterElement) {
                afterElement.parentNode.insertBefore(indicator, afterElement);
            } else {
                container.appendChild(indicator);
            }
        };
        const onPointerUp = (e) => {
            if (isDragging && draggedElement && draggedId) {
                const afterElement = getDragAfterElement(container, e.clientY);
                const targetId = afterElement ? afterElement.dataset.id : null;
                handler(draggedId, targetId);
            }
            cleanup();
        };
        const onPointerCancel = () => cleanup();

        const cleanup = () => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerCancel);
            if (draggedElement) draggedElement.classList.remove('dragging');
            document.body.classList.remove('is-dragging');
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            draggedElement = null;
            draggedId = null;
            isDragging = false;
        };

        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('dragstart', (e) => { if (isDragging) e.preventDefault(); });
        container.addEventListener('dragend', () => cleanup());
        container.addEventListener('dragover', (e) => { if (isDragging) e.preventDefault(); });
        container.addEventListener('drop', (e) => { if (isDragging) e.preventDefault(); });
        container.addEventListener('selectstart', (e) => { if (isDragging) e.preventDefault(); });
    };

    setupDragSort(DOM.characterList, Handlers.handleCharacterDropSort);
    setupDragSort(DOM.chatSessionList, Handlers.handleChatSessionDropSort);
    setupDragSort(DOM.promptList, Handlers.handlePromptDropSort);

    // 場景關鍵字映射管理
    safeAddEventListener(DOM.addKeywordMappingBtn, 'click', Handlers.handleAddKeywordMapping);
    safeAddEventListener(DOM.resetKeywordMappingsBtn, 'click', Handlers.handleResetKeywordMappings);
    safeAddEventListener(DOM.enableAiSceneAnalysisCheckbox, 'change', (e) => {
        state.globalSettings.enableAiSceneAnalysis = e.target.checked;
        saveSettings();
    });

    // 關鍵字映射列表的刪除按鈕事件委派
    safeAddEventListener(DOM.keywordMappingList, 'click', (e) => {
        const deleteBtn = e.target.closest('.icon-btn-sm.danger');
        if (deleteBtn) {
            const keyword = deleteBtn.dataset.keyword;
            Handlers.handleDeleteKeywordMapping(keyword);
        }
    });
}

/**
 * 設置場景節點的拖放功能
 */
let draggedNodeId = null;
let isDragDropSetup = false;

function setupSceneNodeDragAndDrop() {
    // 防止重複綁定
    if (isDragDropSetup) return;
    isDragDropSetup = true;

    // Helper function to determine if cursor is in the left half of an element
    const isCursorInLeftHalf = (element, clientX) => {
        const rect = element.getBoundingClientRect();
        return (clientX - rect.left) < (rect.width / 2);
    };

    // Helper function to determine if cursor is in the top half of an element
    const isCursorInTopHalf = (element, clientY) => {
        const rect = element.getBoundingClientRect();
        return (clientY - rect.top) < (rect.height / 2);
    };

    // ========================================
    // 手機觸控支援
    // ========================================

    let touchDraggedElement = null;
    let touchClone = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let isDraggingTouch = false;

    // 觸控開始
    DOM.sceneTreeContainer.addEventListener('touchstart', (e) => {
        const nodeContent = e.target.closest('.scene-node-content');
        if (!nodeContent) return;

        touchDraggedElement = nodeContent;
        draggedNodeId = nodeContent.dataset.nodeId;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        // 短暫延遲以區分點擊和拖曳
        setTimeout(() => {
            if (touchDraggedElement) {
                isDraggingTouch = true;

                // 創建拖曳中的視覺克隆
                touchClone = touchDraggedElement.cloneNode(true);
                touchClone.style.position = 'fixed';
                touchClone.style.opacity = '0.7';
                touchClone.style.pointerEvents = 'none';
                touchClone.style.zIndex = '10000';
                touchClone.style.width = touchDraggedElement.offsetWidth + 'px';
                document.body.appendChild(touchClone);

                // 原始元素半透明
                touchDraggedElement.style.opacity = '0.3';
                DOM.sceneTreeContainer.classList.add('is-dragging');
            }
        }, 100);
    });

    // 觸控移動
    DOM.sceneTreeContainer.addEventListener('touchmove', (e) => {
        if (!isDraggingTouch || !touchClone) return;

        e.preventDefault(); // 防止頁面滾動

        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - touchStartX + touchDraggedElement.getBoundingClientRect().left) + 'px';
        touchClone.style.top = (touch.clientY - touchStartY + touchDraggedElement.getBoundingClientRect().top) + 'px';

        // 檢測放置目標
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetNode = elementBelow?.closest('.scene-node-content');
        const targetHeader = elementBelow?.closest('.tree-root-header, .scene-column-header');

        // 移除所有高亮
        document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom, .drag-over-left, .drag-over-right').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-left', 'drag-over-right');
        });

        // 添加高亮到目標
        if (targetNode && targetNode !== touchDraggedElement) {
            targetNode.closest('.scene-node').classList.add('drag-over');
        } else if (targetHeader) {
            targetHeader.classList.add('drag-over-bottom');
        }
    });

    // 觸控結束
    DOM.sceneTreeContainer.addEventListener('touchend', async (e) => {
        if (!isDraggingTouch) {
            touchDraggedElement = null;
            draggedNodeId = null;
            return;
        }

        e.preventDefault();

        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

        // 清理視覺效果
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        if (touchDraggedElement) {
            touchDraggedElement.style.opacity = '';
        }
        DOM.sceneTreeContainer.classList.remove('is-dragging');
        document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });

        // 處理放置
        if (elementBelow && draggedNodeId) {
            const targetNode = elementBelow.closest('.scene-node');
            const targetHeader = elementBelow.closest('.tree-root-header, .scene-column-header');
            const fixedZone = elementBelow.closest('.fixed-root-drop-zone');

            let targetNodeId = null;
            let newIndex = null;

            if (targetNode) {
                targetNodeId = targetNode.dataset.nodeId;
            } else if (targetHeader) {
                const rootNodeElement = targetHeader.querySelector('.scene-node');
                if (rootNodeElement) {
                    const targetRootId = rootNodeElement.dataset.nodeId;
                    const sceneMap = SceneMapManager.getActiveSceneMap();
                    if (sceneMap && sceneMap.rootNodes.includes(targetRootId)) {
                        targetNodeId = null;
                        const targetIndex = sceneMap.rootNodes.indexOf(targetRootId);
                        newIndex = targetIndex + 1; // 放在目標後面
                    }
                }
            } else if (fixedZone) {
                targetNodeId = null;
            }

            // 執行移動
            if (targetNodeId !== draggedNodeId) {
                const success = SceneMapManager.moveItem(draggedNodeId, targetNodeId, newIndex);
                if (success) {
                    const sceneMap = SceneMapManager.getActiveSceneMap();
                    await saveAllSceneStatesForChar(state.activeCharacterId);
                    UI.renderSceneTree();
                }
            }
        }

        // 重置狀態
        isDraggingTouch = false;
        touchDraggedElement = null;
        draggedNodeId = null;
    });

    // 觸控取消（例如來電）
    DOM.sceneTreeContainer.addEventListener('touchcancel', () => {
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        if (touchDraggedElement) {
            touchDraggedElement.style.opacity = '';
        }
        DOM.sceneTreeContainer.classList.remove('is-dragging');
        isDraggingTouch = false;
        touchDraggedElement = null;
        draggedNodeId = null;
    });

    // ========================================
    // 桌面版拖放（保留原有邏輯）
    // ========================================

    // 拖曳開始
    DOM.sceneTreeContainer.addEventListener('dragstart', (e) => {
        const nodeElement = e.target.closest('.scene-node');
        if (!nodeElement) return;

        draggedNodeId = nodeElement.dataset.nodeId;
        e.dataTransfer.setData('text/plain', draggedNodeId);
        e.dataTransfer.effectAllowed = 'move';

        // [NEW] 標記容器正在拖曳中，顯示固定放置區
        DOM.sceneTreeContainer.classList.add('is-dragging');

        // 延遲添加 dragging class，避免拖曳影像也變透明
        setTimeout(() => {
            nodeElement.classList.add('dragging');
        }, 0);
    });

    DOM.sceneTreeContainer.addEventListener('dragend', (e) => {
        const nodeElement = e.target.closest('.scene-node');
        if (nodeElement) {
            nodeElement.classList.remove('dragging');
        }
        draggedNodeId = null;

        // [NEW] 移除容器拖曳狀態
        DOM.sceneTreeContainer.classList.remove('is-dragging');

        // 清除所有 drag-over 樣式
        document.querySelectorAll('.drag-over, .drag-over-left, .drag-over-right').forEach(el => {
            el.classList.remove('drag-over');
            el.classList.remove('drag-over-left');
            el.classList.remove('drag-over-right');
        });
    });

    DOM.sceneTreeContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // 允許放置

        // [MODIFIED] 支援 .scene-column-body, .scene-map-columns-container, .scene-column-add-zone, .fixed-root-drop-zone, 和 .scene-column-header 作為放置目標
        const nodeElement = e.target.closest('.scene-node');
        const columnBody = e.target.closest('.scene-column-body');
        const columnHeader = e.target.closest('.scene-column-header'); // [NEW]
        const columnsContainer = e.target.closest('.scene-map-columns-container');
        const addZone = e.target.closest('.scene-column-add-zone');
        const fixedZone = e.target.closest('.fixed-root-drop-zone');

        if (!nodeElement && !columnBody && !columnHeader && !columnsContainer && !addZone && !fixedZone) return;
        if (!draggedNodeId) return;

        // 如果是 Body，目標是該欄位的根節點
        let targetNodeId = null; // null 表示目標是根層級 (container)
        let highlightElement;

        if (columnHeader) {
            // [NEW] 如果是 Header，目標是排序，所以 targetNodeId 為 null (根層級)
            // 但我們需要高亮 Header
            highlightElement = columnHeader;
        } else if (nodeElement) {
            targetNodeId = nodeElement.dataset.nodeId;
            highlightElement = nodeElement;
        } else if (columnBody) {
            // 找到該欄位的根節點 ID
            const column = columnBody.closest('.scene-column');
            const rootNodeElement = column.querySelector('.scene-column-header .scene-node');
            if (rootNodeElement) {
                targetNodeId = rootNodeElement.dataset.nodeId;
                highlightElement = columnBody; // 高亮 Body
            } else {
                return;
            }
        } else if (addZone) {
            // 目標是新增欄位區 (創建新根節點)
            targetNodeId = null;
            highlightElement = addZone;
        } else if (fixedZone) {
            // 目標是固定放置區 (創建新根節點)
            targetNodeId = null;
            highlightElement = fixedZone;
        } else if (columnsContainer) {
            // 目標是容器本身 (創建新根節點)
            targetNodeId = null;
            highlightElement = columnsContainer;
        }

        // 不能拖到自己身上
        if (targetNodeId === draggedNodeId) {
            e.dataTransfer.dropEffect = 'none';
            if (highlightElement) highlightElement.classList.remove('drag-over');
            return;
        }

        // 檢查目標節點
        const sceneMap = SceneMapManager.getActiveSceneMap();
        let targetNode = null;
        if (targetNodeId) {
            targetNode = sceneMap.nodes[targetNodeId];
        }
        const draggedNode = sceneMap.nodes[draggedNodeId];

        // 限制 1（優先）：防止循環引用 - 不能拖到自己的子孫節點下
        // 如果 targetNodeId 為 null (root)，則不需要檢查 descendant，因為 root 不會是任何人的 descendant
        if (targetNodeId && SceneMapManager.isDescendant(draggedNodeId, targetNodeId)) {
            e.dataTransfer.dropEffect = 'none';
            if (highlightElement) highlightElement.classList.remove('drag-over');
            return;
        }

        // 限制 2：Item 類型不能接收子節點
        if (targetNodeId && targetNode.type === 'item') {
            e.dataTransfer.dropEffect = 'none';
            if (highlightElement) highlightElement.classList.remove('drag-over');
            return;
        }

        // 移除其他節點的高亮
        document.querySelectorAll('.scene-node.drag-over, .scene-column-body.drag-over, .scene-column-header.drag-over, .scene-column-header.drag-over-left, .scene-column-header.drag-over-right, .scene-map-columns-container.drag-over, .scene-column-add-zone.drag-over, .fixed-root-drop-zone.drag-over').forEach(el => {
            if (el !== highlightElement) {
                el.classList.remove('drag-over');
                el.classList.remove('drag-over-left');
                el.classList.remove('drag-over-right');
            }
        });

        // 高亮當前目標
        if (highlightElement) {
            if (highlightElement.classList.contains('scene-column-header')) {
                // [NEW] 根據滑鼠位置決定是左還是右
                const isLeftHalf = isCursorInLeftHalf(highlightElement, e.clientX);

                if (isLeftHalf) {
                    highlightElement.classList.add('drag-over-left');
                    highlightElement.classList.remove('drag-over-right');
                } else {
                    highlightElement.classList.add('drag-over-right');
                    highlightElement.classList.remove('drag-over-left');
                }
                // Header 本身不加 drag-over，避免樣式衝突
                highlightElement.classList.remove('drag-over');
            } else {
                highlightElement.classList.add('drag-over');
            }
        }

        e.dataTransfer.dropEffect = 'move';
    });

    DOM.sceneTreeContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nodeElement = e.target.closest('.scene-node');
        const columnBody = e.target.closest('.scene-column-body');
        const columnHeader = e.target.closest('.scene-column-header');
        const treeRootHeader = e.target.closest('.tree-root-header'); // [NEW]
        const columnsContainer = e.target.closest('.scene-map-columns-container');
        const addZone = e.target.closest('.scene-column-add-zone');
        const fixedZone = e.target.closest('.fixed-root-drop-zone');

        if (!nodeElement && !columnBody && !columnHeader && !treeRootHeader && !columnsContainer && !addZone && !fixedZone) return;
        if (!draggedNodeId) return;

        let targetNodeId;
        let highlightElement;

        if (columnHeader) {
            highlightElement = columnHeader;
        } else if (treeRootHeader) {
            highlightElement = treeRootHeader;
        } else if (nodeElement) {
            targetNodeId = nodeElement.dataset.nodeId;
            highlightElement = nodeElement;
        } else if (columnBody) {
            const column = columnBody.closest('.scene-column');
            const rootNodeElement = column.querySelector('.scene-column-header .scene-node');
            if (rootNodeElement) {
                targetNodeId = rootNodeElement.dataset.nodeId;
                highlightElement = columnBody;
            } else {
                return;
            }
        } else if (addZone) {
            targetNodeId = null;
            highlightElement = addZone;
        } else if (fixedZone) {
            targetNodeId = null;
            highlightElement = fixedZone;
        } else if (columnsContainer) {
            targetNodeId = null;
            highlightElement = columnsContainer;
        }

        if (targetNodeId === draggedNodeId) return;

        const sceneMap = SceneMapManager.getActiveSceneMap();
        let targetNode = null;
        if (targetNodeId) {
            targetNode = sceneMap.nodes[targetNodeId];
        }

        // 檢查是否為有效的放置目標
        const isNotDescendant = !SceneMapManager.isDescendant(draggedNodeId, targetNodeId);
        const isNotItem = !targetNode || targetNode.type !== 'item'; // 如果是 root (null)，則不是 item

        const isValidTarget = isNotDescendant && isNotItem;

        if (isValidTarget) {
            // 移除其他節點的高亮
            document.querySelectorAll('.scene-node.drag-over, .scene-column-body.drag-over, .scene-column-header.drag-over, .scene-column-header.drag-over-left, .scene-column-header.drag-over-right, .tree-root-header.drag-over, .tree-root-header.drag-over-top, .tree-root-header.drag-over-bottom, .scene-map-columns-container.drag-over, .scene-column-add-zone.drag-over, .fixed-root-drop-zone.drag-over').forEach(el => {
                if (el !== highlightElement) {
                    el.classList.remove('drag-over');
                    el.classList.remove('drag-over-left');
                    el.classList.remove('drag-over-right');
                    el.classList.remove('drag-over-top');
                    el.classList.remove('drag-over-bottom');
                }
            });

            if (highlightElement.classList.contains('scene-column-header')) {
                // [NEW] 根據滑鼠位置決定是左還是右
                const isLeftHalf = isCursorInLeftHalf(highlightElement, e.clientX);

                if (isLeftHalf) {
                    highlightElement.classList.add('drag-over-left');
                    highlightElement.classList.remove('drag-over-right');
                } else {
                    highlightElement.classList.add('drag-over-right');
                    highlightElement.classList.remove('drag-over-left');
                }
                highlightElement.classList.remove('drag-over');
            } else if (highlightElement.classList.contains('tree-root-header')) {
                // [NEW] Tree view: 根據滑鼠位置決定是上還是下
                const isTopHalf = isCursorInTopHalf(highlightElement, e.clientY);

                if (isTopHalf) {
                    highlightElement.classList.add('drag-over-top');
                    highlightElement.classList.remove('drag-over-bottom');
                } else {
                    highlightElement.classList.add('drag-over-bottom');
                    highlightElement.classList.remove('drag-over-top');
                }
                highlightElement.classList.remove('drag-over');
            } else {
                highlightElement.classList.add('drag-over');
            }
        } else {
            highlightElement.classList.remove('drag-over');
            highlightElement.classList.remove('drag-over-left');
            highlightElement.classList.remove('drag-over-right');
        }
    });

    DOM.sceneTreeContainer.addEventListener('dragleave', (e) => {
        const nodeElement = e.target.closest('.scene-node');
        const columnBody = e.target.closest('.scene-column-body');
        const columnHeader = e.target.closest('.scene-column-header');
        const treeRootHeader = e.target.closest('.tree-root-header'); // [NEW]
        const columnsContainer = e.target.closest('.scene-map-columns-container');
        const addZone = e.target.closest('.scene-column-add-zone');
        const fixedZone = e.target.closest('.fixed-root-drop-zone');

        if (nodeElement) {
            if (!nodeElement.contains(e.relatedTarget)) {
                nodeElement.classList.remove('drag-over');
            }
        } else if (columnHeader) {
            if (!columnHeader.contains(e.relatedTarget)) {
                columnHeader.classList.remove('drag-over');
                columnHeader.classList.remove('drag-over-left');
                columnHeader.classList.remove('drag-over-right');
            }
        } else if (treeRootHeader) {
            // [NEW] Tree view root header cleanup
            if (!treeRootHeader.contains(e.relatedTarget)) {
                treeRootHeader.classList.remove('drag-over');
                treeRootHeader.classList.remove('drag-over-top');
                treeRootHeader.classList.remove('drag-over-bottom');
            }
        } else if (columnBody) {
            if (!columnBody.contains(e.relatedTarget)) {
                columnBody.classList.remove('drag-over');
            }
        } else if (addZone) {
            if (!addZone.contains(e.relatedTarget)) {
                addZone.classList.remove('drag-over');
            }
        } else if (fixedZone) {
            if (!fixedZone.contains(e.relatedTarget)) {
                fixedZone.classList.remove('drag-over');
            }
        } else if (columnsContainer) {
            if (!columnsContainer.contains(e.relatedTarget)) {
                columnsContainer.classList.remove('drag-over');
            }
        }
    });

    DOM.sceneTreeContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nodeElement = e.target.closest('.scene-node');
        const columnBody = e.target.closest('.scene-column-body');
        const columnHeader = e.target.closest('.scene-column-header');
        const treeRootHeader = e.target.closest('.tree-root-header'); // [NEW]
        const columnsContainer = e.target.closest('.scene-map-columns-container');
        const addZone = e.target.closest('.scene-column-add-zone');
        const fixedZone = e.target.closest('.fixed-root-drop-zone');

        if (!nodeElement && !columnBody && !columnHeader && !treeRootHeader && !columnsContainer && !addZone && !fixedZone) return;
        if (!draggedNodeId) return;

        let targetNodeId = null;
        let highlightElement;

        // [NEW] 檢查是否拖曳到 Column Header 進行排序
        let newIndex = null;

        if (columnHeader) {
            const column = columnHeader.closest('.scene-column');
            const rootNodeElement = column.querySelector('.scene-column-header .scene-node');
            if (rootNodeElement) {
                const targetRootId = rootNodeElement.dataset.nodeId;

                // 只有當目標是根節點時才允許排序
                const sceneMap = SceneMapManager.getActiveSceneMap();
                if (sceneMap && sceneMap.rootNodes.includes(targetRootId)) {
                    targetNodeId = null; // 移動到根層級
                    highlightElement = columnHeader; // 高亮 Header

                    const rootNodes = sceneMap.rootNodes;
                    const targetIndex = rootNodes.indexOf(targetRootId);

                    const isLeftHalf = isCursorInLeftHalf(column, e.clientX);

                    newIndex = isLeftHalf ? targetIndex : targetIndex + 1;
                }
            }
        } else if (treeRootHeader) {
            // [NEW] Handle tree view root header sorting
            const rootNodeElement = treeRootHeader.querySelector('.scene-node');
            if (rootNodeElement) {
                const targetRootId = rootNodeElement.dataset.nodeId;

                const sceneMap = SceneMapManager.getActiveSceneMap();
                if (sceneMap && sceneMap.rootNodes.includes(targetRootId)) {
                    targetNodeId = null; // 移動到根層級
                    highlightElement = treeRootHeader;

                    const rootNodes = sceneMap.rootNodes;
                    const targetIndex = rootNodes.indexOf(targetRootId);

                    const isTopHalf = isCursorInTopHalf(treeRootHeader, e.clientY);

                    newIndex = isTopHalf ? targetIndex : targetIndex + 1;
                }
            }
        } else if (nodeElement) {
            targetNodeId = nodeElement.dataset.nodeId;
            highlightElement = nodeElement;
        } else if (columnBody) {
            const column = columnBody.closest('.scene-column');
            const rootNodeElement = column.querySelector('.scene-column-header .scene-node');
            if (rootNodeElement) {
                targetNodeId = rootNodeElement.dataset.nodeId;
                highlightElement = columnBody;
            } else {
                return;
            }
        } else if (addZone) {
            targetNodeId = null;
            highlightElement = addZone;
        } else if (fixedZone) {
            targetNodeId = null;
            highlightElement = fixedZone;
        } else if (columnsContainer) {
            targetNodeId = null;
            highlightElement = columnsContainer;
        }

        // 移除高亮
        if (highlightElement) {
            highlightElement.classList.remove('drag-over');
            highlightElement.classList.remove('drag-over-left');
            highlightElement.classList.remove('drag-over-right');
        }

        console.log('放置:', draggedNodeId, '到', targetNodeId, 'Index:', newIndex);

        // [FIX] 在執行移動和重新渲染之前，先移除容器的拖曳狀態
        // 因為重新渲染會破壞 DOM，導致 dragend 事件可能無法正確冒泡或觸發
        DOM.sceneTreeContainer.classList.remove('is-dragging');
        document.querySelectorAll('.drag-over, .drag-over-left, .drag-over-right').forEach(el => {
            el.classList.remove('drag-over');
            el.classList.remove('drag-over-left');
            el.classList.remove('drag-over-right');
        });

        // 執行移動
        const success = SceneMapManager.moveItem(draggedNodeId, targetNodeId, newIndex);

        if (success) {
            // [NEW] 如果移動到根節點，確保它是展開的，這樣使用者才能看到子節點
            if (!targetNodeId) {
                tempState.collapsedSceneNodes.delete(draggedNodeId);
            }

            // 暫存節點名稱（在重新渲染前）
            const sceneMap = SceneMapManager.getActiveSceneMap();
            const draggedNode = sceneMap.nodes[draggedNodeId];
            const targetNode = targetNodeId ? sceneMap.nodes[targetNodeId] : null;
            const draggedName = draggedNode.name;
            const targetName = targetNode ? targetNode.name : '根層級';

            // 重新渲染場景樹
            UI.renderSceneTree();

            // 顯示成功提示
            console.log(`✅ 已將「${draggedName}」移動到「${targetName}」`);
        } else {
            alert('移動失敗！無法移動到選定的位置。');
        }

        draggedNodeId = null;
    });

    console.log('✅ 拖放功能已啟用');
}

/**
 * [NEW] 設置場景地圖的拖曳捲動 (Panning)
 */
function setupSceneMapPanning() {
    const container = DOM.sceneTreeContainer;
    if (!container) return;

    let isPanning = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
        // 如果點擊的是節點或其子元素，不觸發 Panning
        if (e.target.closest('.scene-node-content') || e.target.closest('.scene-column-body')) return;

        isPanning = true;
        container.classList.add('panning');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
        isPanning = false;
        container.classList.remove('panning');
    });

    container.addEventListener('mouseup', () => {
        isPanning = false;
        container.classList.remove('panning');
    });

    container.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5; // 捲動速度倍率
        container.scrollLeft = scrollLeft - walk;
    });
}

