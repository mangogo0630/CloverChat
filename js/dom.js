// js/dom.js
// 這個檔案專門用來選取所有會用到的 HTML 元素，並將它們匯出。

export const mobileOverlay = document.getElementById('mobile-overlay');
export const menuToggleBtn = document.getElementById('menu-toggle-btn');
export const leftPanel = document.getElementById('left-panel');
export const characterView = document.getElementById('character-view');
export const chatSessionView = document.getElementById('chat-session-view');
export const backToCharsBtn = document.getElementById('back-to-chars-btn');
export const chatListHeaderName = document.getElementById('chat-list-header-name');
export const editActiveCharacterBtn = document.getElementById('edit-active-character-btn');
export const deleteActiveCharacterBtn = document.getElementById('delete-active-character-btn');
export const chatSessionList = document.getElementById('chat-session-list');
export const addChatBtn = document.getElementById('add-chat-btn');
export const chatNotesInput = document.getElementById('chat-notes-input');
export const renameChatModal = document.getElementById('rename-chat-modal');
export const renameChatInput = document.getElementById('rename-chat-input');
export const cancelRenameChatBtn = document.getElementById('cancel-rename-chat-btn');
export const saveRenameChatBtn = document.getElementById('save-rename-chat-btn');
export const updateMemoryBtn = document.getElementById('update-memory-btn');
export const characterList = document.getElementById('character-list');
export const addCharacterBtn = document.getElementById('add-character-btn');
export const globalSettingsBtn = document.getElementById('global-settings-btn');
export const welcomeScreen = document.getElementById('welcome-screen');
export const chatInterface = document.getElementById('chat-interface');
export const chatHeaderAvatar = document.getElementById('chat-header-avatar');
export const chatHeaderName = document.getElementById('chat-header-name');
export const chatHeaderModelName = document.getElementById('chat-header-model-name');
export const chatWindow = document.getElementById('chat-window');
export const messageInput = document.getElementById('message-input');
export const sendBtn = document.getElementById('send-btn');
export const sendIcon = document.getElementById('send-icon');
export const continueIcon = document.getElementById('continue-icon');
export const regenerateIcon = document.getElementById('regenerate-icon');
export const stopIcon = document.getElementById('stop-icon');
export const charEditorModal = document.getElementById('character-editor-modal');
export const charEditorTitle = document.getElementById('character-editor-title');
export const charAvatarUpload = document.getElementById('char-avatar-upload');
export const charAvatarPreview = document.getElementById('char-avatar-preview');
export const charNameInput = document.getElementById('char-name');
export const charDescriptionInput = document.getElementById('char-description');
export const firstMessageList = document.getElementById('first-message-list');
export const addFirstMessageBtn = document.getElementById('add-first-message-btn');
export const charExampleDialogueInput = document.getElementById('char-example-dialogue');
export const charScenarioInput = document.getElementById('char-scenario');
export const charCreatorInput = document.getElementById('char-creator');
export const charVersionInput = document.getElementById('char-version');
export const charCreatorNotesInput = document.getElementById('char-creator-notes');
export const importCharBtn = document.getElementById('import-char-btn');
export const exportCharBtn = document.getElementById('export-char-btn');
export const cancelCharEditorBtn = document.getElementById('cancel-char-editor-btn');
export const saveCharBtn = document.getElementById('save-char-btn');
export const globalSettingsModal = document.getElementById('global-settings-modal');
export const apiProviderSelect = document.getElementById('api-provider');
export const apiModelSelect = document.getElementById('api-model-select');
export const apiKeyInput = document.getElementById('api-key');
export const testApiBtn = document.getElementById('test-api-btn');
export const apiStatusIndicator = document.getElementById('api-status-indicator');
export const apiKeyFormGroup = document.getElementById('api-key-form-group');
export const cancelGlobalSettingsBtn = document.getElementById('cancel-global-settings-btn');
export const saveGlobalSettingsBtn = document.getElementById('save-global-settings-btn');
export const temperatureSlider = document.getElementById('temperature-slider');
export const temperatureValue = document.getElementById('temperature-value');
export const topPSlider = document.getElementById('top-p-slider');
export const topPValue = document.getElementById('top-p-value');
export const repetitionPenaltySlider = document.getElementById('repetition-penalty-slider');
export const repetitionPenaltyValue = document.getElementById('repetition-penalty-value');
export const contextSizeInput = document.getElementById('context-size-input');
export const maxTokensValue = document.getElementById('max-tokens-value');
export const summarizationMaxTokensValue = document.getElementById('summarization-max-tokens-value');
export const userPersonaEditorModal = document.getElementById('user-persona-editor-modal');
export const userPersonaEditorTitle = document.getElementById('user-persona-editor-title');
export const userPersonaAvatarUpload = document.getElementById('user-persona-avatar-upload');
export const userPersonaAvatarPreview = document.getElementById('user-persona-avatar-preview');
export const userPersonaNameInput = document.getElementById('user-persona-name');
export const userPersonaDescriptionInput = document.getElementById('user-persona-description');
export const cancelUserPersonaEditorBtn = document.getElementById('cancel-user-persona-editor-btn');
export const saveUserPersonaBtn = document.getElementById('save-user-persona-btn');
export const activeUserPersonaSelect = document.getElementById('active-user-persona-select');
export const userPersonaList = document.getElementById('user-persona-list');
export const addUserPersonaBtn = document.getElementById('add-user-persona-btn');
export const chatUserPersonaSelect = document.getElementById('chat-user-persona-select');
export const viewMemoryBtn = document.getElementById('view-memory-btn');
export const memoryEditorModal = document.getElementById('memory-editor-modal');
export const memoryEditorTextarea = document.getElementById('memory-editor-textarea');
export const memoryMarkdownPreview = document.getElementById('memory-markdown-preview'); // NEW
export const toggleMemoryPreviewBtn = document.getElementById('toggle-memory-preview-btn'); // NEW
export const cancelMemoryEditorBtn = document.getElementById('cancel-memory-editor-btn');
export const saveMemoryEditorBtn = document.getElementById('save-memory-editor-btn');
export const loadingOverlay = document.getElementById('loading-overlay');
export const chatOptionsBtn = document.getElementById('chat-options-btn');
export const chatOptionsMenu = document.getElementById('chat-options-menu');
export const deleteChatOptionBtn = document.getElementById('delete-chat-option-btn');

// 設定分頁相關
export const settingsTabsContainer = document.getElementById('settings-tabs-container');
export const accountTab = document.getElementById('account-tab');
export const apiSettingsTab = document.getElementById('api-settings-tab');
export const userSettingsTab = document.getElementById('user-settings-tab');
export const promptSettingsTab = document.getElementById('prompt-settings-tab');
export const lorebookSettingsTab = document.getElementById('lorebook-tab');
export const themeSettingsTab = document.getElementById('theme-settings-tab');
export const regexTab = document.getElementById('regex-tab');
export const aboutTab = document.getElementById('about-tab');
export const themeSelect = document.getElementById('theme-select');

// 新提示詞庫相關
export const promptSetSelect = document.getElementById('prompt-set-select');
export const deletePromptSetBtn = document.getElementById('delete-prompt-set-btn');
export const importPromptSetBtn = document.getElementById('importPromptSetBtn');
export const exportPromptSetBtn = document.getElementById('exportPromptSetBtn');
export const addPromptSetBtn = document.getElementById('addPromptSetBtn');
export const addPromptBtn = document.getElementById('addPromptBtn');
export const promptListContainer = document.getElementById('prompt-list-container');
export const promptList = document.getElementById('prompt-list');

// 提示詞編輯器 Modal 相關
export const promptEditorModal = document.getElementById('prompt-editor-modal');
export const promptEditorTitle = document.getElementById('prompt-editor-title');
export const promptEditorNameInput = document.getElementById('prompt-editor-name');
export const promptEditorRoleSelect = document.getElementById('prompt-editor-role');
export const promptEditorContentInput = document.getElementById('prompt-editor-content');
export const cancelPromptEditorBtn = document.getElementById('cancel-prompt-editor-btn');
export const savePromptEditorBtn = document.getElementById('save-prompt-editor-btn');
export const deletePromptEditorBtn = document.getElementById('delete-prompt-editor-btn');
export const promptEditorPositionSelect = document.getElementById('prompt-editor-position');
export const promptEditorDepthInput = document.getElementById('prompt-editor-depth');
export const promptEditorOrderInput = document.getElementById('prompt-editor-order');
export const promptDepthOrderContainer = document.getElementById('prompt-depth-order-container');
export const summarizationPromptInput = document.getElementById('summarization-prompt-input');

// API 設定檔相關
export const apiPresetSelect = document.getElementById('api-preset-select');
export const saveApiPresetBtn = document.getElementById('save-api-preset-btn');
export const deleteApiPresetBtn = document.getElementById('delete-api-preset-btn');

// 截圖與匯出相關
export const importChatOptionBtn = document.getElementById('import-chat-option-btn');
export const exportChatOptionBtn = document.getElementById('export-chat-option-btn');
export const exportChatModal = document.getElementById('export-chat-modal');
export const exportFormatJsonl = document.getElementById('export-format-jsonl');
export const exportFormatPng = document.getElementById('export-format-png');
export const cancelExportChatBtn = document.getElementById('cancel-export-chat-btn');
export const confirmExportChatBtn = document.getElementById('confirm-export-chat-btn');
export const screenshotToolbar = document.getElementById('screenshot-toolbar');
export const cancelScreenshotBtn = document.getElementById('cancel-screenshot-btn');
export const screenshotInfoText = document.getElementById('screenshot-info-text');
export const generateScreenshotBtn = document.getElementById('generate-screenshot-btn');
export const messageInputContainer = document.querySelector('.message-input-container');

// 全域匯入/匯出相關
export const dataManagementTab = document.getElementById('data-management-tab');
export const globalExportBtn = document.getElementById('global-export-btn');
export const openImportOptionsBtn = document.getElementById('open-import-options-btn');
export const importOptionsModal = document.getElementById('import-options-modal');
export const importMergeBtn = document.getElementById('import-merge-btn');
export const importOverwriteBtn = document.getElementById('import-overwrite-btn');
export const cancelImportOptionsBtn = document.getElementById('cancel-import-options-btn');

// 帳號認證 (在設定分頁中)
export const loginPrompt = document.getElementById('login-prompt');
export const loginBtnInSettings = document.getElementById('login-btn-in-settings');
export const userInfoDetails = document.getElementById('user-info-details');
export const userAvatarInSettings = document.getElementById('user-avatar-in-settings');
export const userNameInSettings = document.getElementById('user-name-in-settings');
export const logoutBtn = document.getElementById('logout-btn');

// 帳號認證 Modal 相關
export const authModal = document.getElementById('auth-modal');
export const loginView = document.getElementById('login-view');
export const registerView = document.getElementById('register-view');
export const loginForm = document.getElementById('login-form');
export const registerForm = document.getElementById('register-form');
export const googleLoginBtn = document.getElementById('google-login-btn');
export const showRegisterViewBtn = document.getElementById('show-register-view-btn');
export const showLoginViewBtn = document.getElementById('show-login-view-btn');
export const cancelAuthModalBtn = document.getElementById('cancel-auth-modal-btn');
export const registerNameInput = document.getElementById('register-name');

// 正規表達式相關
export const regexRulesList = document.getElementById('regex-rules-list');
export const addRegexRuleBtn = document.getElementById('add-regex-rule-btn');

// 聊天室列表標頭的愛心按鈕
export const headerLoveChatBtn = document.getElementById('header-love-char-btn');

// 世界書 (Lorebook) 相關
export const lorebookList = document.getElementById('lorebook-list');
export const addLorebookBtn = document.getElementById('add-lorebook-btn');
export const importLorebookBtn = document.getElementById('import-lorebook-btn');

// 世界書條目編輯器 Modal (獨立視窗)
export const lorebookEntryEditorModal = document.getElementById('lorebook-entry-editor-modal');
export const lorebookEntryEditorTitle = document.getElementById('lorebook-entry-editor-title');
export const lorebookEntryList = document.getElementById('lorebook-entry-list');
export const addLorebookEntryBtn = document.getElementById('add-lorebook-entry-btn');
export const closeLorebookEntryEditorBtn = document.getElementById('close-lorebook-entry-editor-btn');
export const exportSingleLorebookBtn = document.getElementById('export-single-lorebook-btn'); 

// 單一條目新增/編輯 Modal
export const lorebookEditorModal = document.getElementById('lorebook-editor-modal');
export const lorebookEditorTitle = document.getElementById('lorebook-editor-title');
export const lorebookEntryNameInput = document.getElementById('lorebook-entry-name');
export const lorebookEntryKeywordsInput = document.getElementById('lorebook-entry-keywords');
export const lorebookEntryContentInput = document.getElementById('lorebook-entry-content');
export const cancelLorebookEditorBtn = document.getElementById('cancel-lorebook-editor-btn');
export const saveLorebookEntryBtn = document.getElementById('save-lorebook-entry-btn');
export const deleteLorebookEntryBtn = document.getElementById('delete-lorebook-entry-btn');

// 世界書進階設定 DOM 元素
export const lorebookEntryTriggerSelect = document.getElementById('lorebook-entry-trigger');
export const lorebookEntryLogicSelect = document.getElementById('lorebook-entry-logic');
export const lorebookEntryPositionSelect = document.getElementById('lorebook-entry-position');
export const lorebookEntryOrderInput = document.getElementById('lorebook-entry-order');
export const lorebookEntryDepthInput = document.getElementById('lorebook-entry-depth');
export const matchCharDescCheckbox = document.getElementById('match-char-desc');
export const matchScenarioCheckbox = document.getElementById('match-scenario');
export const matchCreatorNotesCheckbox = document.getElementById('match-creator-notes');
export const matchPersonaDescCheckbox = document.getElementById('match-persona-desc');
export const lorebookEntrySecondaryKeywordsInput = document.getElementById('lorebook-entry-secondary-keywords');


// 刪除選項 Modal
export const deleteOptionsModal = document.getElementById('delete-options-modal');
export const deleteSingleVersionBtn = document.getElementById('delete-single-version-btn');
export const deleteAllVersionsBtn = document.getElementById('delete-all-versions-btn');
export const cancelDeleteOptionsBtn = document.getElementById('cancel-delete-options-btn');
export const deleteSingleVersionDesc = document.getElementById('delete-single-version-desc');
export const deleteSingleVersionTitle = document.getElementById('delete-single-version-title');
export const deleteAllVersionsDesc = document.getElementById('delete-all-versions-desc');

// 進階匯入 Modal 相關
export const advancedImportModal = document.getElementById('advanced-import-modal');
export const advancedImportContent = document.getElementById('advanced-import-content');
export const cancelAdvancedImportBtn = document.getElementById('cancel-advanced-import-btn');
export const importJustCharBtn = document.getElementById('import-just-char-btn');
export const importWithExtrasBtn = document.getElementById('import-with-extras-btn');
