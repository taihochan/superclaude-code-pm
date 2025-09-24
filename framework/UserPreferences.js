/**
 * UserPreferences - 用戶偏好管理系統
 *
 * 功能：
 * - 個性化用戶設置和偏好管理
 * - 多用戶環境支持和權限控制
 * - 偏好繼承和覆蓋機制
 * - 實時偏好同步和持久化
 * - 偏好驗證和類型安全
 *
 * 用途：管理用戶界面、行為、工作流偏好設置
 * 配合：ConfigManager進行偏好存儲和同步
 */

import { EventEmitter } from 'events';
import path from 'path';
import ConfigManager from './ConfigManager';

/**
 * 偏好類型定義
 */
const PREFERENCE_TYPES = {
    // 界面偏好
    UI: 'ui',                           // 界面設置
    THEME: 'theme',                     // 主題設定
    LAYOUT: 'layout',                   // 佈局偏好

    // 行為偏好
    WORKFLOW: 'workflow',               // 工作流設置
    SHORTCUTS: 'shortcuts',             // 快捷鍵設定
    AUTOMATION: 'automation',           // 自動化設置

    // 協作偏好
    COLLABORATION: 'collaboration',     // 協作設置
    COMMUNICATION: 'communication',     // 溝通偏好
    SHARING: 'sharing',                 // 共享設置

    // 性能偏好
    PERFORMANCE: 'performance',         // 性能設置
    CACHING: 'caching',                // 緩存偏好
    SYNC: 'sync'                       // 同步設置
};

/**
 * 偏好作用域
 */
const PREFERENCE_SCOPES = {
    GLOBAL: 'global',                   // 全局偏好
    USER: 'user',                      // 用戶偏好
    PROJECT: 'project',                // 專案偏好
    SESSION: 'session',                // 會話偏好
    TEMPORARY: 'temporary'             // 臨時偏好
};

/**
 * 偏好繼承優先級
 */
const PREFERENCE_PRIORITY = {
    TEMPORARY: 5,                      // 最高優先級
    SESSION: 4,
    PROJECT: 3,
    USER: 2,
    GLOBAL: 1                          // 最低優先級
};

/**
 * 預設偏好配置
 */
const DEFAULT_PREFERENCES = {
    // UI偏好
    ui: {
        theme: 'dark',
        language: 'zh-TW',
        fontSize: 14,
        sidebar: {
            visible: true,
            width: 280,
            position: 'left'
        },
        panels: {
            explorer: { visible: true, width: 240 },
            console: { visible: true, height: 200 },
            terminal: { visible: false, height: 300 }
        },
        animations: true,
        compactMode: false
    },

    // 主題偏好
    theme: {
        mode: 'dark',
        accent: '#007acc',
        colors: {
            primary: '#007acc',
            secondary: '#6c757d',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8'
        },
        fonts: {
            editor: 'Consolas, Monaco, monospace',
            ui: 'system-ui, sans-serif'
        }
    },

    // 工作流偏好
    workflow: {
        autoSave: true,
        autoSaveInterval: 30000,        // 30秒
        confirmOnExit: true,
        reopenLastProject: true,
        maxRecentProjects: 10,
        parallelExecution: true,
        maxConcurrentTasks: 5
    },

    // 快捷鍵偏好
    shortcuts: {
        save: ['Ctrl+S', 'Cmd+S'],
        open: ['Ctrl+O', 'Cmd+O'],
        find: ['Ctrl+F', 'Cmd+F'],
        replace: ['Ctrl+H', 'Cmd+Alt+F'],
        toggleTerminal: ['Ctrl+`', 'Cmd+`'],
        toggleSidebar: ['Ctrl+B', 'Cmd+B']
    },

    // 自動化偏好
    automation: {
        enabled: true,
        smartCompletion: true,
        autoFormat: true,
        autoLint: true,
        autoCommit: false,
        smartSuggestions: true
    },

    // 協作偏好
    collaboration: {
        enabled: true,
        shareByDefault: false,
        notifyOnChanges: true,
        conflictResolution: 'prompt',    // 'auto', 'prompt', 'manual'
        maxCollaborators: 10
    },

    // 性能偏好
    performance: {
        enableCaching: true,
        cacheSize: 1000,
        lazyLoading: true,
        prefetchEnabled: true,
        memoryOptimization: true,
        diskCacheEnabled: true
    },

    // 同步偏好
    sync: {
        enabled: true,
        interval: 30000,               // 30秒
        mode: 'auto',                  // 'auto', 'manual', 'realtime'
        conflictHandling: 'merge',     // 'overwrite', 'merge', 'prompt'
        backup: true,
        maxBackups: 5
    }
};

/**
 * 偏好驗證規則
 */
const PREFERENCE_VALIDATORS = {
    ui: {
        theme: (value) => ['light', 'dark', 'auto'].includes(value),
        language: (value) => typeof value === 'string' && value.length >= 2,
        fontSize: (value) => typeof value === 'number' && value >= 8 && value <= 72
    },

    theme: {
        mode: (value) => ['light', 'dark', 'auto'].includes(value),
        accent: (value) => /^#[0-9A-F]{6}$/i.test(value)
    },

    workflow: {
        autoSaveInterval: (value) => typeof value === 'number' && value >= 1000,
        maxRecentProjects: (value) => typeof value === 'number' && value >= 1 && value <= 50,
        maxConcurrentTasks: (value) => typeof value === 'number' && value >= 1 && value <= 20
    },

    performance: {
        cacheSize: (value) => typeof value === 'number' && value >= 10 && value <= 10000,
        memoryOptimization: (value) => typeof value === 'boolean'
    }
};

/**
 * 偏好項目類
 */
class PreferenceItem {
    constructor(key, value, options = {}) {
        this.key = key;
        this.value = value;
        this.type = options.type || PREFERENCE_TYPES.UI;
        this.scope = options.scope || PREFERENCE_SCOPES.USER;
        this.priority = options.priority || PREFERENCE_PRIORITY[this.scope];
        this.timestamp = Date.now();
        this.userId = options.userId || null;
        this.projectId = options.projectId || null;
        this.sessionId = options.sessionId || null;
        this.metadata = options.metadata || {};
        this.validator = options.validator || null;
        this.sensitive = options.sensitive || false;
        this.readonly = options.readonly || false;
    }

    /**
     * 驗證偏好值
     */
    validate() {
        if (this.readonly && this.value !== this.originalValue) {
            throw new Error(`偏好項目是唯讀的: ${this.key}`);
        }

        if (this.validator && typeof this.validator === 'function') {
            const isValid = this.validator(this.value, this);
            if (!isValid) {
                throw new Error(`偏好值驗證失敗: ${this.key}`);
            }
        }

        // 使用內置驗證器
        const [category, ...subKeys] = this.key.split('.');
        if (PREFERENCE_VALIDATORS[category]) {
            const subKey = subKeys.join('.');
            const validator = PREFERENCE_VALIDATORS[category][subKey];
            if (validator && !validator(this.value)) {
                throw new Error(`偏好值不符合規則: ${this.key}`);
            }
        }

        return true;
    }

    /**
     * 克隆偏好項目
     */
    clone() {
        return new PreferenceItem(this.key, this.value, {
            type: this.type,
            scope: this.scope,
            priority: this.priority,
            userId: this.userId,
            projectId: this.projectId,
            sessionId: this.sessionId,
            metadata: { ...this.metadata },
            validator: this.validator,
            sensitive: this.sensitive,
            readonly: this.readonly
        });
    }

    /**
     * 序列化
     */
    serialize(includeSensitive = false) {
        return {
            key: this.key,
            value: this.sensitive && !includeSensitive ? '***' : this.value,
            type: this.type,
            scope: this.scope,
            priority: this.priority,
            timestamp: this.timestamp,
            userId: this.userId,
            projectId: this.projectId,
            sessionId: this.sessionId,
            metadata: this.metadata,
            sensitive: this.sensitive,
            readonly: this.readonly
        };
    }
}

/**
 * 主用戶偏好管理器
 */
class UserPreferences extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 基礎配置
            configManager: options.configManager || null,
            userId: options.userId || 'default',
            projectId: options.projectId || null,
            sessionId: options.sessionId || this._generateSessionId(),

            // 存儲配置
            persistenceEnabled: options.persistenceEnabled !== false,
            autoSave: options.autoSave !== false,
            autoSaveInterval: options.autoSaveInterval || 10000, // 10秒

            // 驗證配置
            enableValidation: options.enableValidation !== false,
            strictMode: options.strictMode || false,

            // 繼承配置
            enableInheritance: options.enableInheritance !== false,
            cascadeUpdates: options.cascadeUpdates !== false,

            // 性能配置
            cacheEnabled: options.cacheEnabled !== false,
            batchUpdates: options.batchUpdates !== false,
            updateBatchSize: options.updateBatchSize || 50,

            ...options
        };

        // 核心組件
        this.configManager = this.options.configManager;

        // 偏好存儲
        this.preferences = new Map(); // key -> Map<scope, PreferenceItem>
        this.scopePreferences = new Map(); // scope -> Map<key, PreferenceItem>

        // 預設值
        this.defaults = new Map();
        this._loadDefaultPreferences();

        // 緩存
        this.resolvedCache = new Map(); // key -> resolvedValue
        this.cacheStats = { hits: 0, misses: 0 };

        // 批量更新
        this.pendingUpdates = new Map();
        this.batchTimer = null;

        // 統計信息
        this.stats = {
            preferencesCount: 0,
            updatesCount: 0,
            validationErrors: 0,
            cacheHitRate: 0
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化用戶偏好管理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 初始化ConfigManager
            if (!this.configManager) {
                this.configManager = new ConfigManager();
                await this.configManager.initialize();
            }

            // 為不同作用域創建存儲映射
            for (const scope of Object.values(PREFERENCE_SCOPES)) {
                this.scopePreferences.set(scope, new Map());
            }

            // 加載現有偏好
            await this._loadPersistedPreferences();

            // 設置自動保存
            if (this.options.autoSave) {
                this._startAutoSave();
            }

            // 監聽ConfigManager事件
            this._setupEventHandlers();

            this.initialized = true;
            console.log(`[UserPreferences] 已初始化 用戶: ${this.options.userId}`);
            this.emit('initialized');

        } catch (error) {
            console.error('[UserPreferences] 初始化失敗:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 獲取偏好值
     * @param {string} key - 偏好鍵
     * @param {*} defaultValue - 預設值
     * @param {object} options - 選項
     */
    async get(key, defaultValue = null, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // 檢查緩存
            if (this.options.cacheEnabled && this.resolvedCache.has(key)) {
                this.cacheStats.hits++;
                this._updateCacheHitRate();
                return this.resolvedCache.get(key);
            }

            this.cacheStats.misses++;
            this._updateCacheHitRate();

            // 解析偏好值（考慮繼承）
            const resolvedValue = this._resolvePreference(key, options);

            if (resolvedValue !== null) {
                // 更新緩存
                if (this.options.cacheEnabled) {
                    this.resolvedCache.set(key, resolvedValue);
                }
                return resolvedValue;
            }

            // 返回預設值
            const finalDefault = defaultValue !== null ? defaultValue : this._getDefaultValue(key);
            return finalDefault;

        } catch (error) {
            console.error(`[UserPreferences] 獲取偏好失敗 [${key}]:`, error);
            return defaultValue;
        }
    }

    /**
     * 設置偏好值
     * @param {string} key - 偏好鍵
     * @param {*} value - 偏好值
     * @param {object} options - 選項
     */
    async set(key, value, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const scope = options.scope || PREFERENCE_SCOPES.USER;
            const type = options.type || this._inferPreferenceType(key);

            // 創建偏好項目
            const preferenceItem = new PreferenceItem(key, value, {
                ...options,
                type,
                scope,
                userId: this.options.userId,
                projectId: this.options.projectId,
                sessionId: this.options.sessionId
            });

            // 驗證偏好
            if (this.options.enableValidation) {
                preferenceItem.validate();
            }

            // 獲取舊值
            const oldValue = await this.get(key, null, { skipCache: true });

            // 存儲偏好
            this._storePreference(preferenceItem);

            // 清除相關緩存
            this._invalidateCache(key);

            // 批量更新或立即保存
            if (this.options.batchUpdates && !options.immediate) {
                this.pendingUpdates.set(key, preferenceItem);
                this._scheduleBatchUpdate();
            } else {
                await this._persistPreference(preferenceItem);
            }

            // 級聯更新
            if (this.options.cascadeUpdates) {
                await this._cascadeUpdate(key, value, scope, options);
            }

            this.stats.updatesCount++;
            console.log(`[UserPreferences] 偏好已更新 [${key}] 作用域: ${scope}`);

            this.emit('preferenceChanged', {
                key,
                oldValue,
                newValue: value,
                scope,
                type
            });

            return true;

        } catch (error) {
            this.stats.validationErrors++;
            console.error(`[UserPreferences] 設置偏好失敗 [${key}]:`, error);
            this.emit('preferenceError', { key, error });
            throw error;
        }
    }

    /**
     * 批量設置偏好
     * @param {Object} preferences - 偏好對象 { key: value }
     * @param {object} options - 選項
     */
    async setMany(preferences, options = {}) {
        const entries = Object.entries(preferences);
        const results = [];

        if (options.atomic) {
            // 原子操作：全部成功或全部失敗
            const backupData = new Map();

            try {
                // 備份當前值
                for (const [key] of entries) {
                    backupData.set(key, await this.get(key));
                }

                // 批量設置
                for (const [key, value] of entries) {
                    await this.set(key, value, {
                        ...options,
                        immediate: false
                    });
                    results.push({ key, success: true });
                }

                // 批量保存
                if (this.pendingUpdates.size > 0) {
                    await this._flushBatchUpdates();
                }

            } catch (error) {
                // 回滾操作
                console.log('[UserPreferences] 原子操作失敗，正在回滾...');
                for (const [key, backupValue] of backupData) {
                    try {
                        await this.set(key, backupValue, { immediate: true });
                    } catch (rollbackError) {
                        console.error(`[UserPreferences] 回滾失敗 [${key}]:`, rollbackError);
                    }
                }
                throw error;
            }
        } else {
            // 非原子操作：部分成功
            const promises = entries.map(async ([key, value]) => {
                try {
                    await this.set(key, value, options);
                    return { key, success: true };
                } catch (error) {
                    return { key, success: false, error: error.message };
                }
            });

            results.push(...await Promise.all(promises));
        }

        const successCount = results.filter(r => r.success).length;
        this.emit('batchPreferencesChanged', {
            total: entries.length,
            successful: successCount,
            results
        });

        return results;
    }

    /**
     * 刪除偏好
     * @param {string} key - 偏好鍵
     * @param {object} options - 選項
     */
    async delete(key, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const scope = options.scope || PREFERENCE_SCOPES.USER;
            const oldValue = await this.get(key);

            // 從存儲中刪除
            this._removePreference(key, scope);

            // 清除緩存
            this._invalidateCache(key);

            // 從ConfigManager刪除
            if (this.options.persistenceEnabled) {
                const configKey = this._getConfigKey(key, scope);
                await this.configManager.delete(configKey);
            }

            console.log(`[UserPreferences] 偏好已刪除 [${key}] 作用域: ${scope}`);
            this.emit('preferenceDeleted', { key, oldValue, scope });

            return true;

        } catch (error) {
            console.error(`[UserPreferences] 刪除偏好失敗 [${key}]:`, error);
            throw error;
        }
    }

    /**
     * 檢查偏好是否存在
     * @param {string} key - 偏好鍵
     * @param {string} scope - 作用域
     */
    has(key, scope = null) {
        if (scope) {
            return this.scopePreferences.has(scope) &&
                   this.scopePreferences.get(scope).has(key);
        }

        // 檢查所有作用域
        for (const scopeMap of this.scopePreferences.values()) {
            if (scopeMap.has(key)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 獲取作用域內的所有偏好
     * @param {string} scope - 作用域
     * @param {object} options - 選項
     */
    getScope(scope, options = {}) {
        if (!this.scopePreferences.has(scope)) {
            return {};
        }

        const scopeMap = this.scopePreferences.get(scope);
        const preferences = {};

        for (const [key, item] of scopeMap) {
            if (!item.sensitive || options.includeSensitive) {
                preferences[key] = item.value;
            }
        }

        return preferences;
    }

    /**
     * 獲取偏好的所有作用域值
     * @param {string} key - 偏好鍵
     */
    getAll(key) {
        const allValues = {};

        for (const [scope, scopeMap] of this.scopePreferences) {
            if (scopeMap.has(key)) {
                allValues[scope] = scopeMap.get(key).value;
            }
        }

        return allValues;
    }

    /**
     * 重置偏好到預設值
     * @param {string|Array} keys - 偏好鍵或鍵數組
     * @param {object} options - 選項
     */
    async reset(keys = null, options = {}) {
        try {
            const keysToReset = keys
                ? (Array.isArray(keys) ? keys : [keys])
                : Array.from(this.defaults.keys());

            for (const key of keysToReset) {
                const defaultValue = this._getDefaultValue(key);
                if (defaultValue !== null) {
                    await this.set(key, defaultValue, {
                        ...options,
                        reason: 'reset_to_default'
                    });
                } else {
                    await this.delete(key, options);
                }
            }

            this.emit('preferencesReset', { keys: keysToReset });
            console.log(`[UserPreferences] 已重置 ${keysToReset.length} 個偏好`);

        } catch (error) {
            console.error('[UserPreferences] 重置偏好失敗:', error);
            throw error;
        }
    }

    /**
     * 導出偏好設置
     * @param {object} options - 選項
     */
    async export(options = {}) {
        const scopes = options.scopes || Object.values(PREFERENCE_SCOPES);
        const preferences = {};

        for (const scope of scopes) {
            preferences[scope] = this.getScope(scope, {
                includeSensitive: options.includeSensitive
            });
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            userId: this.options.userId,
            projectId: this.options.projectId,
            preferences,
            metadata: {
                totalPreferences: this.stats.preferencesCount,
                exportedScopes: scopes,
                ...options.metadata
            }
        };

        return exportData;
    }

    /**
     * 導入偏好設置
     * @param {object} data - 導入數據
     * @param {object} options - 選項
     */
    async import(data, options = {}) {
        try {
            if (!data.preferences) {
                throw new Error('無效的偏好導入格式');
            }

            const importCounts = {};
            let totalImported = 0;

            for (const [scope, scopePreferences] of Object.entries(data.preferences)) {
                if (!Object.values(PREFERENCE_SCOPES).includes(scope)) {
                    console.warn(`[UserPreferences] 跳過未知作用域: ${scope}`);
                    continue;
                }

                const entries = Object.entries(scopePreferences);
                importCounts[scope] = 0;

                for (const [key, value] of entries) {
                    try {
                        await this.set(key, value, {
                            ...options,
                            scope,
                            reason: 'imported'
                        });
                        importCounts[scope]++;
                        totalImported++;
                    } catch (error) {
                        console.warn(`[UserPreferences] 導入偏好失敗 [${key}]:`, error);
                    }
                }
            }

            this.emit('preferencesImported', {
                totalImported,
                importCounts,
                metadata: data.metadata
            });

            console.log(`[UserPreferences] 已導入 ${totalImported} 個偏好設置`);
            return { success: true, totalImported, importCounts };

        } catch (error) {
            console.error('[UserPreferences] 導入偏好失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            cacheStats: this.cacheStats,
            scopeCounts: this._getScopeCounts(),
            pendingUpdates: this.pendingUpdates.size,
            initialized: this.initialized,
            userId: this.options.userId,
            projectId: this.options.projectId,
            sessionId: this.options.sessionId
        };
    }

    // ========== 私有方法 ==========

    /**
     * 加載預設偏好
     */
    _loadDefaultPreferences() {
        for (const [category, categoryDefaults] of Object.entries(DEFAULT_PREFERENCES)) {
            this._loadCategoryDefaults(category, categoryDefaults, '');
        }
    }

    /**
     * 遞歸加載分類預設值
     */
    _loadCategoryDefaults(category, obj, prefix) {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const prefKey = category === fullKey ? category : `${category}.${fullKey}`;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                this._loadCategoryDefaults(category, value, fullKey);
            } else {
                this.defaults.set(prefKey, value);
            }
        }
    }

    /**
     * 獲取預設值
     */
    _getDefaultValue(key) {
        return this.defaults.get(key) || null;
    }

    /**
     * 推斷偏好類型
     */
    _inferPreferenceType(key) {
        const [category] = key.split('.');

        const typeMapping = {
            ui: PREFERENCE_TYPES.UI,
            theme: PREFERENCE_TYPES.THEME,
            layout: PREFERENCE_TYPES.LAYOUT,
            workflow: PREFERENCE_TYPES.WORKFLOW,
            shortcuts: PREFERENCE_TYPES.SHORTCUTS,
            automation: PREFERENCE_TYPES.AUTOMATION,
            collaboration: PREFERENCE_TYPES.COLLABORATION,
            communication: PREFERENCE_TYPES.COMMUNICATION,
            sharing: PREFERENCE_TYPES.SHARING,
            performance: PREFERENCE_TYPES.PERFORMANCE,
            caching: PREFERENCE_TYPES.CACHING,
            sync: PREFERENCE_TYPES.SYNC
        };

        return typeMapping[category] || PREFERENCE_TYPES.UI;
    }

    /**
     * 解析偏好值（考慮繼承）
     */
    _resolvePreference(key, options = {}) {
        if (!this.options.enableInheritance) {
            // 不啟用繼承時，只查找用戶作用域
            const userScope = this.scopePreferences.get(PREFERENCE_SCOPES.USER);
            return userScope && userScope.has(key) ? userScope.get(key).value : null;
        }

        // 按優先級順序檢查各作用域
        const scopeOrder = [
            PREFERENCE_SCOPES.TEMPORARY,
            PREFERENCE_SCOPES.SESSION,
            PREFERENCE_SCOPES.PROJECT,
            PREFERENCE_SCOPES.USER,
            PREFERENCE_SCOPES.GLOBAL
        ];

        for (const scope of scopeOrder) {
            const scopeMap = this.scopePreferences.get(scope);
            if (scopeMap && scopeMap.has(key)) {
                return scopeMap.get(key).value;
            }
        }

        return null;
    }

    /**
     * 存儲偏好項目
     */
    _storePreference(preferenceItem) {
        const { key, scope } = preferenceItem;

        // 更新主存儲
        if (!this.preferences.has(key)) {
            this.preferences.set(key, new Map());
        }
        this.preferences.get(key).set(scope, preferenceItem);

        // 更新作用域存儲
        const scopeMap = this.scopePreferences.get(scope);
        scopeMap.set(key, preferenceItem);

        // 更新統計
        this._updatePreferencesCount();
    }

    /**
     * 移除偏好項目
     */
    _removePreference(key, scope) {
        // 從主存儲移除
        if (this.preferences.has(key)) {
            const keyMap = this.preferences.get(key);
            keyMap.delete(scope);

            if (keyMap.size === 0) {
                this.preferences.delete(key);
            }
        }

        // 從作用域存儲移除
        const scopeMap = this.scopePreferences.get(scope);
        if (scopeMap) {
            scopeMap.delete(key);
        }

        // 更新統計
        this._updatePreferencesCount();
    }

    /**
     * 無效化緩存
     */
    _invalidateCache(key = null) {
        if (key) {
            this.resolvedCache.delete(key);
        } else {
            this.resolvedCache.clear();
        }
    }

    /**
     * 持久化偏好
     */
    async _persistPreference(preferenceItem) {
        if (!this.options.persistenceEnabled || !this.configManager) {
            return;
        }

        try {
            const configKey = this._getConfigKey(preferenceItem.key, preferenceItem.scope);
            await this.configManager.set(configKey, preferenceItem.serialize(), {
                source: 'user_preferences',
                userId: this.options.userId
            });
        } catch (error) {
            console.error(`[UserPreferences] 持久化偏好失敗:`, error);
        }
    }

    /**
     * 加載持久化偏好
     */
    async _loadPersistedPreferences() {
        if (!this.options.persistenceEnabled || !this.configManager) {
            return;
        }

        try {
            const configKeys = await this.configManager.keys();
            const preferenceKeys = configKeys.filter(key =>
                key.startsWith(`preferences_${this.options.userId}`)
            );

            for (const configKey of preferenceKeys) {
                try {
                    const data = await this.configManager.get(configKey);
                    if (data) {
                        const item = new PreferenceItem(data.key, data.value, {
                            type: data.type,
                            scope: data.scope,
                            userId: data.userId,
                            projectId: data.projectId,
                            sessionId: data.sessionId,
                            metadata: data.metadata,
                            sensitive: data.sensitive,
                            readonly: data.readonly
                        });

                        this._storePreference(item);
                    }
                } catch (error) {
                    console.warn(`[UserPreferences] 載入偏好失敗 [${configKey}]:`, error);
                }
            }
        } catch (error) {
            console.warn('[UserPreferences] 載入持久化偏好失敗:', error);
        }
    }

    /**
     * 獲取配置鍵
     */
    _getConfigKey(key, scope) {
        return `preferences_${this.options.userId}_${scope}_${key}`;
    }

    /**
     * 級聯更新
     */
    async _cascadeUpdate(key, value, scope, options) {
        // 實現級聯更新邏輯
        // 例如：當用戶偏好改變時，影響會話偏好
        if (scope === PREFERENCE_SCOPES.USER) {
            const sessionScope = this.scopePreferences.get(PREFERENCE_SCOPES.SESSION);
            if (sessionScope && sessionScope.has(key)) {
                // 可以選擇性地更新會話偏好
                console.log(`[UserPreferences] 級聯更新會話偏好 [${key}]`);
            }
        }
    }

    /**
     * 調度批量更新
     */
    _scheduleBatchUpdate() {
        if (this.batchTimer) return;

        this.batchTimer = setTimeout(async () => {
            await this._flushBatchUpdates();
        }, 100); // 100ms批量延遲
    }

    /**
     * 刷新批量更新
     */
    async _flushBatchUpdates() {
        if (this.pendingUpdates.size === 0) return;

        const updates = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            const promises = updates.map(item => this._persistPreference(item));
            await Promise.all(promises);

            console.log(`[UserPreferences] 已批量更新 ${updates.length} 個偏好`);
        } catch (error) {
            console.error('[UserPreferences] 批量更新失敗:', error);
        }
    }

    /**
     * 啟動自動保存
     */
    _startAutoSave() {
        setInterval(async () => {
            if (this.pendingUpdates.size > 0) {
                await this._flushBatchUpdates();
            }
        }, this.options.autoSaveInterval);
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        if (this.configManager) {
            this.configManager.on('configChanged', (event) => {
                // 處理外部配置變更
                if (event.key.startsWith(`preferences_${this.options.userId}`)) {
                    this._invalidateCache();
                    this.emit('externalChange', event);
                }
            });
        }
    }

    /**
     * 更新偏好數量統計
     */
    _updatePreferencesCount() {
        let count = 0;
        for (const scopeMap of this.scopePreferences.values()) {
            count += scopeMap.size;
        }
        this.stats.preferencesCount = count;
    }

    /**
     * 獲取作用域統計
     */
    _getScopeCounts() {
        const counts = {};
        for (const [scope, scopeMap] of this.scopePreferences) {
            counts[scope] = scopeMap.size;
        }
        return counts;
    }

    /**
     * 更新緩存命中率
     */
    _updateCacheHitRate() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        this.stats.cacheHitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    }

    /**
     * 生成會話ID
     */
    _generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            // 刷新待處理更新
            await this._flushBatchUpdates();

            // 清理定時器
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }

            // 清理數據
            this.preferences.clear();
            this.scopePreferences.clear();
            this.resolvedCache.clear();
            this.pendingUpdates.clear();

            this.initialized = false;
            console.log('[UserPreferences] 清理完成');

        } catch (error) {
            console.error('[UserPreferences] 清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
UserPreferences.PREFERENCE_TYPES = PREFERENCE_TYPES;
UserPreferences.PREFERENCE_SCOPES = PREFERENCE_SCOPES;
UserPreferences.PREFERENCE_PRIORITY = PREFERENCE_PRIORITY;

export default UserPreferences;