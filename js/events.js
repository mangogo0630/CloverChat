// js/events.js
// 這個檔案專門用來綁定所有的事件監聽器，並使用事件委派處理動態內容。

import * as DOM from './dom.js';
import * as Handlers from './handlers.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';
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
    if (DOM.maxTokensSlider) Utils.setupSliderSync(DOM.maxTokensSlider, DOM.maxTokensValue);
    if (DOM.summarizationMaxTokensSlider) Utils.setupSliderSync(DOM.summarizationMaxTokensSlider, DOM.summarizationMaxTokensValue);
    
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
}

