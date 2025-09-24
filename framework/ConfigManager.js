/**
 * ConfigManager - 統一配置管理系統
 *
 * 功能：
 * - CCPM+SuperClaude整合的核心配置中心
 * - 統一管理用戶偏好、路由規則、協作模板
 * - 配置版本控制和回滾機制
 * - 動態配置更新和實時同步
 * - 高性能緩存和<50ms加載時間
 *
 * 用途：作為整個系統的配置基礎設施
 * 配合：StateSynchronizer、EventBus、SmartRouter進行配置協調
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

import StateSynchronizer from './StateSynchronizer';
import EventBus from './EventBus';

/**
 * 配置狀態類型
 */
const CONFIG_STATUS = {
    LOADING: 'loading',         // 加載中
    READY: 'ready',            // 就緒
    UPDATING: 'updating',      // 更新中
    ERROR: 'error',            // 錯誤
    SYNCING: 'syncing'         // 同步中
};

/**
 * 配置類型
 */
const CONFIG_TYPES = {
    USER_PREFERENCES: 'user_preferences',     // 用戶偏好
    ROUTING_RULES: 'routing_rules',          // 路由規則
    TEMPLATES: 'templates',                  // 協作模板
    ENVIRONMENT: 'environment',              // 環境配置
    SYSTEM: 'system'                        // 系統配置
};

/**
 * 配置優先級
 */
const CONFIG_PRIORITY = {
    SYSTEM: 0,        // 系統預設
    ENVIRONMENT: 1,   // 環境變量
    USER: 2,          // 用戶配置
    SESSION: 3,       // 會話配置
    RUNTIME: 4        // 運行時配置
};

/**
 * 配置快取項目
 */
class ConfigCacheItem {
    constructor(data, options = {}) {
        this.data = data;
        this.hash = this._calculateHash(data);
        this.timestamp = Date.now();
        this.ttl = options.ttl || 300000; // 5分鐘預設TTL
        this.accessCount = 0;
        this.lastAccess = this.timestamp;
        this.version = options.version || 1;
        this.priority = options.priority || CONFIG_PRIORITY.USER;
        this.metadata = options.metadata || {};
    }

    _calculateHash(data) {
        return crypto.createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 16);
    }

    isExpired() {
        return Date.now() - this.timestamp > this.ttl;
    }

    access() {
        this.accessCount++;
        this.lastAccess = Date.now();
        return this.data;
    }

    update(newData, options = {}) {
        const oldHash = this.hash;
        this.data = newData;
        this.hash = this._calculateHash(newData);
        this.timestamp = Date.now();
        this.version = options.version || this.version + 1;

        if (options.ttl !== undefined) {
            this.ttl = options.ttl;
        }

        return oldHash !== this.hash; // 返回是否實際改變
    }

    serialize() {
        return {
            data: this.data,
            hash: this.hash,
            timestamp: this.timestamp,
            ttl: this.ttl,
            accessCount: this.accessCount,
            lastAccess: this.lastAccess,
            version: this.version,
            priority: this.priority,
            metadata: this.metadata
        };
    }

    static deserialize(obj) {
        const item = new ConfigCacheItem(obj.data);
        Object.assign(item, obj);
        return item;
    }
}

/**
 * 配置變更記錄
 */
class ConfigChangeRecord {
    constructor(configKey, oldValue, newValue, options = {}) {
        this.id = this._generateId();
        this.configKey = configKey;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.timestamp = Date.now();
        this.source = options.source || 'unknown';
        this.userId = options.userId || null;
        this.reason = options.reason || null;
        this.rollbackData = options.rollbackData || null;
    }

    _generateId() {
        return `change_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    canRollback() {
        return this.rollbackData !== null || this.oldValue !== undefined;
    }

    serialize() {
        return {
            id: this.id,
            configKey: this.configKey,
            oldValue: this.oldValue,
            newValue: this.newValue,
            timestamp: this.timestamp,
            source: this.source,
            userId: this.userId,
            reason: this.reason,
            rollbackData: this.rollbackData
        };
    }
}

/**
 * 主配置管理器
 */
class ConfigManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 核心配置
            configDir: path.join(process.cwd(), '.claude', 'config'),
            dataDir: path.join(process.cwd(), '.claude', 'data'),
            cacheDir: path.join(process.cwd(), '.claude', 'cache'),

            // 性能配置
            cacheEnabled: true,
            cacheSize: 1000,          // 最大緩存項目數
            defaultTTL: 300000,       // 5分鐘預設TTL
            loadTimeout: 50,          // 50ms加載超時

            // 同步配置
            enableSync: true,
            syncInterval: 30000,      // 30秒同步間隔
            hotReload: true,          // 熱重載

            // 持久化配置
            enablePersistence: true,
            enableVersioning: true,
            maxVersionHistory: 50,

            // 驗證配置
            enableValidation: true,
            strictMode: false,

            ...options
        };

        // 核心組件
        this.stateSynchronizer = null;
        this.eventBus = null;

        // 緩存系統
        this.cache = new Map(); // configKey -> ConfigCacheItem
        this.watchedFiles = new Map(); // filePath -> configKey

        // 配置狀態
        this.status = CONFIG_STATUS.LOADING;
        this.loadPromise = null;
        this.lastLoadTime = null;

        // 變更管理
        this.changeHistory = [];
        this.versions = new Map(); // configKey -> versions[]

        // 統計信息
        this.stats = {
            loadCount: 0,
            saveCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            syncCount: 0,
            errorCount: 0,
            averageLoadTime: 0
        };

        // 監控器
        this.watchers = new Map();
        this.syncTimer = null;

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化配置管理器
     */
    async initialize() {
        if (this.initialized) return;

        const startTime = Date.now();

        try {
            // 確保目錄存在
            await this._ensureDirectories();

            // 初始化StateSynchronizer
            if (this.options.enableSync) {
                this.stateSynchronizer = new StateSynchronizer({
                    watchPaths: [this.options.configDir],
                    criticalFiles: [
                        'config.json',
                        'user-preferences.json',
                        'routing-rules.json'
                    ]
                });
                await this.stateSynchronizer.initialize();

                // 監聽同步事件
                this.stateSynchronizer.on('syncCompleted', (result) => {
                    this._handleSyncCompleted(result);
                });
            }

            // 初始化EventBus
            this.eventBus = new EventBus({
                enablePersistence: false,
                enableBatching: true
            });
            await this.eventBus.initialize();

            // 設置事件處理
            this._setupEventHandlers();

            // 加載所有配置
            await this._loadAllConfigs();

            // 設置檔案監控
            if (this.options.hotReload) {
                await this._setupFileWatching();
            }

            // 啟動同步定時器
            if (this.options.enableSync && this.options.syncInterval > 0) {
                this._startSyncTimer();
            }

            this.initialized = true;
            this.status = CONFIG_STATUS.READY;
            this.lastLoadTime = Date.now();

            const loadTime = Date.now() - startTime;
            this.stats.averageLoadTime = loadTime;

            console.log(`[ConfigManager] 初始化完成 - 耗時: ${loadTime}ms`);
            this.emit('initialized', { loadTime });

            // 檢查加載時間性能要求
            if (loadTime > this.options.loadTimeout) {
                console.warn(`[ConfigManager] 加載時間超過目標 ${this.options.loadTimeout}ms: ${loadTime}ms`);
            }

        } catch (error) {
            this.status = CONFIG_STATUS.ERROR;
            this.stats.errorCount++;
            console.error('[ConfigManager] 初始化失敗:', error);
            this.emit('initializeError', error);
            throw error;
        }
    }

    /**
     * 獲取配置值
     * @param {string} key - 配置鍵
     * @param {*} defaultValue - 預設值
     * @param {object} options - 選項
     */
    async get(key, defaultValue = null, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 檢查緩存
            if (this.options.cacheEnabled && this.cache.has(key)) {
                const cacheItem = this.cache.get(key);

                if (!cacheItem.isExpired() || options.acceptStale) {
                    this.stats.cacheHits++;
                    const value = cacheItem.access();

                    // 非同步刷新過期緩存
                    if (cacheItem.isExpired() && !options.acceptStale) {
                        setImmediate(() => this._refreshConfig(key));
                    }

                    return value;
                }
            }

            this.stats.cacheMisses++;

            // 從存儲加載
            const value = await this._loadConfig(key);

            // 更新緩存
            if (this.options.cacheEnabled) {
                const cacheItem = new ConfigCacheItem(value, {
                    ttl: options.ttl || this.options.defaultTTL,
                    priority: options.priority,
                    metadata: options.metadata
                });

                this._updateCache(key, cacheItem);
            }

            const loadTime = Date.now() - startTime;
            this.stats.loadCount++;
            this.stats.averageLoadTime = (
                this.stats.averageLoadTime * (this.stats.loadCount - 1) + loadTime
            ) / this.stats.loadCount;

            return value !== null ? value : defaultValue;

        } catch (error) {
            this.stats.errorCount++;
            console.error(`[ConfigManager] 獲取配置失敗 [${key}]:`, error);

            if (options.throwOnError) {
                throw error;
            }

            return defaultValue;
        }
    }

    /**
     * 設置配置值
     * @param {string} key - 配置鍵
     * @param {*} value - 配置值
     * @param {object} options - 選項
     */
    async set(key, value, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 獲取舊值
            const oldValue = await this.get(key, null, { acceptStale: true });

            // 驗證配置
            if (this.options.enableValidation) {
                await this._validateConfig(key, value, options);
            }

            // 創建變更記錄
            const changeRecord = new ConfigChangeRecord(key, oldValue, value, {
                source: options.source || 'api',
                userId: options.userId,
                reason: options.reason,
                rollbackData: options.rollbackData
            });

            // 保存到版本歷史
            if (this.options.enableVersioning) {
                this._addToVersionHistory(key, changeRecord);
            }

            // 保存配置
            await this._saveConfig(key, value, options);

            // 更新緩存
            if (this.options.cacheEnabled) {
                const cacheItem = new ConfigCacheItem(value, {
                    ttl: options.ttl || this.options.defaultTTL,
                    version: changeRecord.id,
                    priority: options.priority,
                    metadata: options.metadata
                });

                this._updateCache(key, cacheItem);
            }

            // 記錄變更歷史
            this.changeHistory.push(changeRecord);
            if (this.changeHistory.length > this.options.maxVersionHistory) {
                this.changeHistory = this.changeHistory.slice(-this.options.maxVersionHistory);
            }

            // 發布變更事件
            await this.eventBus.publish('config.changed', {
                key,
                oldValue,
                newValue: value,
                changeId: changeRecord.id,
                source: options.source
            }, {
                priority: options.priority || 0
            });

            // 同步配置
            if (this.options.enableSync && options.sync !== false) {
                await this._syncConfig(key, value, options);
            }

            const saveTime = Date.now() - startTime;
            this.stats.saveCount++;

            console.log(`[ConfigManager] 配置已更新 [${key}] - 耗時: ${saveTime}ms`);
            this.emit('configChanged', {
                key,
                oldValue,
                newValue: value,
                changeId: changeRecord.id,
                saveTime
            });

            return changeRecord.id;

        } catch (error) {
            this.stats.errorCount++;
            console.error(`[ConfigManager] 設置配置失敗 [${key}]:`, error);
            this.emit('configError', { key, error });
            throw error;
        }
    }

    /**
     * 批量獲取配置
     * @param {Array<string>} keys - 配置鍵數組
     * @param {object} options - 選項
     */
    async getMany(keys, options = {}) {
        const promises = keys.map(key =>
            this.get(key, null, options).catch(error => ({ error, key }))
        );

        const results = await Promise.all(promises);
        const configMap = {};

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const result = results[i];

            if (result && result.error) {
                if (options.throwOnError) {
                    throw new Error(`獲取配置失敗 [${key}]: ${result.error.message}`);
                }
                configMap[key] = options.defaultValue || null;
            } else {
                configMap[key] = result;
            }
        }

        return configMap;
    }

    /**
     * 批量設置配置
     * @param {Object} configs - 配置對象 { key: value }
     * @param {object} options - 選項
     */
    async setMany(configs, options = {}) {
        const entries = Object.entries(configs);
        const changeIds = [];

        // 序列化執行以保證一致性
        if (options.atomic) {
            for (const [key, value] of entries) {
                try {
                    const changeId = await this.set(key, value, {
                        ...options,
                        sync: false // 批量操作最後統一同步
                    });
                    changeIds.push(changeId);
                } catch (error) {
                    // 原子操作失敗時回滾
                    if (changeIds.length > 0) {
                        await this._rollbackChanges(changeIds);
                    }
                    throw error;
                }
            }
        } else {
            // 並行執行
            const promises = entries.map(([key, value]) =>
                this.set(key, value, { ...options, sync: false })
                    .catch(error => ({ error, key }))
            );

            const results = await Promise.all(promises);

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result && result.error) {
                    if (options.throwOnError) {
                        throw new Error(`設置配置失敗 [${result.key}]: ${result.error.message}`);
                    }
                } else {
                    changeIds.push(result);
                }
            }
        }

        // 統一同步
        if (this.options.enableSync && options.sync !== false) {
            await this._syncMultipleConfigs(configs, options);
        }

        // 發布批量變更事件
        await this.eventBus.publish('config.batchChanged', {
            configs,
            changeIds,
            count: changeIds.length
        });

        return changeIds;
    }

    /**
     * 刪除配置
     * @param {string} key - 配置鍵
     * @param {object} options - 選項
     */
    async delete(key, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const oldValue = await this.get(key, null, { acceptStale: true });

            if (oldValue === null) {
                return false; // 配置不存在
            }

            // 創建變更記錄
            const changeRecord = new ConfigChangeRecord(key, oldValue, null, {
                source: options.source || 'api',
                userId: options.userId,
                reason: options.reason || 'deleted'
            });

            // 刪除檔案
            await this._deleteConfig(key);

            // 從緩存移除
            this.cache.delete(key);

            // 記錄變更歷史
            this.changeHistory.push(changeRecord);

            // 發布刪除事件
            await this.eventBus.publish('config.deleted', {
                key,
                oldValue,
                changeId: changeRecord.id
            });

            console.log(`[ConfigManager] 配置已刪除 [${key}]`);
            this.emit('configDeleted', { key, oldValue, changeId: changeRecord.id });

            return true;

        } catch (error) {
            this.stats.errorCount++;
            console.error(`[ConfigManager] 刪除配置失敗 [${key}]:`, error);
            throw error;
        }
    }

    /**
     * 檢查配置是否存在
     * @param {string} key - 配置鍵
     */
    async has(key) {
        try {
            const value = await this.get(key, Symbol('not-found'));
            return value !== Symbol('not-found');
        } catch (error) {
            return false;
        }
    }

    /**
     * 獲取所有配置鍵
     */
    async keys() {
        const configFiles = await this._getConfigFiles();
        return configFiles.map(file => path.basename(file, '.json'));
    }

    /**
     * 清空所有配置
     * @param {object} options - 選項
     */
    async clear(options = {}) {
        if (!options.confirm) {
            throw new Error('清空配置需要確認參數 { confirm: true }');
        }

        const keys = await this.keys();

        for (const key of keys) {
            await this.delete(key, options);
        }

        this.cache.clear();
        this.changeHistory = [];
        this.versions.clear();

        await this.eventBus.publish('config.cleared', {
            clearedKeys: keys,
            count: keys.length
        });

        console.log(`[ConfigManager] 已清空 ${keys.length} 個配置`);
        this.emit('configCleared', { count: keys.length });
    }

    /**
     * 回滾配置變更
     * @param {string} changeId - 變更ID或配置鍵
     * @param {object} options - 選項
     */
    async rollback(changeId, options = {}) {
        try {
            let changeRecord = null;

            // 查找變更記錄
            if (changeId.startsWith('change_')) {
                changeRecord = this.changeHistory.find(record => record.id === changeId);
            } else {
                // 按配置鍵查找最後一次變更
                const records = this.changeHistory.filter(record => record.configKey === changeId);
                changeRecord = records[records.length - 1];
            }

            if (!changeRecord) {
                throw new Error(`找不到變更記錄: ${changeId}`);
            }

            if (!changeRecord.canRollback()) {
                throw new Error(`變更記錄不支持回滾: ${changeId}`);
            }

            // 執行回滾
            const rollbackValue = changeRecord.rollbackData || changeRecord.oldValue;

            if (rollbackValue === null || rollbackValue === undefined) {
                await this.delete(changeRecord.configKey, {
                    ...options,
                    source: 'rollback',
                    reason: `回滾變更 ${changeId}`
                });
            } else {
                await this.set(changeRecord.configKey, rollbackValue, {
                    ...options,
                    source: 'rollback',
                    reason: `回滾變更 ${changeId}`
                });
            }

            await this.eventBus.publish('config.rolledBack', {
                originalChangeId: changeId,
                configKey: changeRecord.configKey,
                rolledBackTo: rollbackValue
            });

            console.log(`[ConfigManager] 配置已回滾 [${changeRecord.configKey}] 變更ID: ${changeId}`);
            this.emit('configRolledBack', {
                changeId,
                configKey: changeRecord.configKey,
                rolledBackTo: rollbackValue
            });

            return true;

        } catch (error) {
            console.error(`[ConfigManager] 配置回滾失敗 [${changeId}]:`, error);
            throw error;
        }
    }

    /**
     * 獲取配置變更歷史
     * @param {string} key - 配置鍵（可選）
     * @param {object} options - 選項
     */
    getChangeHistory(key = null, options = {}) {
        let history = this.changeHistory;

        if (key) {
            history = history.filter(record => record.configKey === key);
        }

        if (options.limit) {
            history = history.slice(-options.limit);
        }

        if (options.since) {
            const sinceTime = typeof options.since === 'string'
                ? new Date(options.since).getTime()
                : options.since;
            history = history.filter(record => record.timestamp >= sinceTime);
        }

        return history.map(record => record.serialize());
    }

    /**
     * 導出配置
     * @param {object} options - 選項
     */
    async export(options = {}) {
        const keys = options.keys || await this.keys();
        const configs = await this.getMany(keys, { acceptStale: true });

        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            configs,
            metadata: {
                exportedBy: options.userId || 'system',
                reason: options.reason || 'manual_export',
                keys: keys,
                totalConfigs: Object.keys(configs).length
            }
        };

        if (options.includeHistory) {
            exportData.changeHistory = this.getChangeHistory();
        }

        if (options.format === 'base64') {
            return Buffer.from(JSON.stringify(exportData)).toString('base64');
        }

        return exportData;
    }

    /**
     * 導入配置
     * @param {object|string} data - 配置數據或base64字符串
     * @param {object} options - 選項
     */
    async import(data, options = {}) {
        try {
            // 解析導入數據
            let importData = data;
            if (typeof data === 'string') {
                try {
                    // 嘗試base64解碼
                    importData = JSON.parse(Buffer.from(data, 'base64').toString());
                } catch {
                    // 嘗試直接JSON解析
                    importData = JSON.parse(data);
                }
            }

            if (!importData.configs) {
                throw new Error('無效的配置導入格式');
            }

            const { configs } = importData;
            const importKeys = Object.keys(configs);

            // 備份現有配置
            let backup = null;
            if (options.createBackup) {
                backup = await this.export({ keys: importKeys });
            }

            try {
                // 批量導入配置
                const changeIds = await this.setMany(configs, {
                    ...options,
                    source: 'import',
                    reason: `導入配置 - ${importData.metadata?.reason || '未指定原因'}`,
                    userId: options.userId
                });

                await this.eventBus.publish('config.imported', {
                    importedConfigs: importKeys,
                    changeIds,
                    count: importKeys.length,
                    metadata: importData.metadata
                });

                console.log(`[ConfigManager] 已導入 ${importKeys.length} 個配置`);
                this.emit('configImported', {
                    keys: importKeys,
                    count: importKeys.length,
                    changeIds
                });

                return {
                    success: true,
                    importedKeys: importKeys,
                    changeIds,
                    backup
                };

            } catch (error) {
                // 導入失敗時恢復備份
                if (backup && options.rollbackOnError) {
                    console.log('[ConfigManager] 導入失敗，正在恢復備份...');
                    await this.import(backup, { ...options, rollbackOnError: false });
                }
                throw error;
            }

        } catch (error) {
            console.error('[ConfigManager] 導入配置失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            status: this.status,
            initialized: this.initialized,
            lastLoadTime: this.lastLoadTime,
            cacheSize: this.cache.size,
            changeHistorySize: this.changeHistory.length,
            watchedFilesCount: this.watchedFiles.size,
            uptime: Date.now() - (this.lastLoadTime || 0)
        };
    }

    // ========== 私有方法 ==========

    /**
     * 確保目錄存在
     */
    async _ensureDirectories() {
        const dirs = [
            this.options.configDir,
            this.options.dataDir,
            this.options.cacheDir
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    /**
     * 加載所有配置
     */
    async _loadAllConfigs() {
        try {
            const configFiles = await this._getConfigFiles();
            const loadPromises = configFiles.map(async (filePath) => {
                const key = path.basename(filePath, '.json');
                try {
                    return await this._loadConfig(key);
                } catch (error) {
                    console.warn(`[ConfigManager] 載入配置失敗 [${key}]:`, error);
                    return null;
                }
            });

            await Promise.all(loadPromises);
        } catch (error) {
            console.warn('[ConfigManager] 載入部分配置失敗:', error);
        }
    }

    /**
     * 獲取配置檔案列表
     */
    async _getConfigFiles() {
        try {
            const files = await fs.readdir(this.options.configDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => path.join(this.options.configDir, file));
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    /**
     * 加載單個配置
     */
    async _loadConfig(key) {
        const filePath = path.join(this.options.configDir, `${key}.json`);

        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    /**
     * 保存單個配置
     */
    async _saveConfig(key, value, options = {}) {
        const filePath = path.join(this.options.configDir, `${key}.json`);
        const content = JSON.stringify(value, null, 2);

        await fs.writeFile(filePath, content, 'utf8');

        // 記錄檔案監控
        this.watchedFiles.set(filePath, key);
    }

    /**
     * 刪除配置檔案
     */
    async _deleteConfig(key) {
        const filePath = path.join(this.options.configDir, `${key}.json`);

        try {
            await fs.unlink(filePath);
            this.watchedFiles.delete(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * 更新緩存
     */
    _updateCache(key, cacheItem) {
        // 檢查緩存大小限制
        if (this.cache.size >= this.options.cacheSize) {
            this._evictCache();
        }

        this.cache.set(key, cacheItem);
    }

    /**
     * 緩存驅逐（LRU策略）
     */
    _evictCache() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccess < oldestTime) {
                oldestTime = item.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * 刷新配置
     */
    async _refreshConfig(key) {
        try {
            const value = await this._loadConfig(key);
            if (value !== null && this.cache.has(key)) {
                const existingItem = this.cache.get(key);
                const hasChanged = existingItem.update(value);

                if (hasChanged) {
                    await this.eventBus.publish('config.refreshed', {
                        key,
                        newValue: value
                    });
                }
            }
        } catch (error) {
            console.warn(`[ConfigManager] 刷新配置失敗 [${key}]:`, error);
        }
    }

    /**
     * 驗證配置
     */
    async _validateConfig(key, value, options = {}) {
        // 基本類型檢查
        if (value === undefined) {
            throw new Error(`配置值不能為 undefined: ${key}`);
        }

        // 檢查JSON序列化
        try {
            JSON.stringify(value);
        } catch (error) {
            throw new Error(`配置值無法序列化: ${key} - ${error.message}`);
        }

        // 自定義驗證器
        if (options.validator && typeof options.validator === 'function') {
            const isValid = await options.validator(key, value);
            if (!isValid) {
                throw new Error(`配置值驗證失敗: ${key}`);
            }
        }
    }

    /**
     * 同步配置
     */
    async _syncConfig(key, value, options = {}) {
        if (this.stateSynchronizer) {
            try {
                await this.stateSynchronizer.syncState(
                    'filesystem',
                    'ccpm',
                    {
                        configKey: key,
                        mode: options.syncMode || 'immediate'
                    }
                );
                this.stats.syncCount++;
            } catch (error) {
                console.warn(`[ConfigManager] 同步配置失敗 [${key}]:`, error);
            }
        }
    }

    /**
     * 批量同步配置
     */
    async _syncMultipleConfigs(configs, options = {}) {
        if (this.stateSynchronizer) {
            try {
                await this.stateSynchronizer.syncState(
                    'filesystem',
                    'ccpm',
                    {
                        configs: Object.keys(configs),
                        mode: options.syncMode || 'batch'
                    }
                );
                this.stats.syncCount++;
            } catch (error) {
                console.warn('[ConfigManager] 批量同步配置失敗:', error);
            }
        }
    }

    /**
     * 添加到版本歷史
     */
    _addToVersionHistory(key, changeRecord) {
        if (!this.versions.has(key)) {
            this.versions.set(key, []);
        }

        const versions = this.versions.get(key);
        versions.push(changeRecord);

        if (versions.length > this.options.maxVersionHistory) {
            versions.shift();
        }
    }

    /**
     * 回滾多個變更
     */
    async _rollbackChanges(changeIds) {
        // 按時間倒序回滾
        const sortedIds = changeIds.sort().reverse();

        for (const changeId of sortedIds) {
            try {
                await this.rollback(changeId, { throwOnError: true });
            } catch (error) {
                console.error(`[ConfigManager] 回滾變更失敗 [${changeId}]:`, error);
            }
        }
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        if (this.stateSynchronizer) {
            this.stateSynchronizer.on('fileChanged', async (change) => {
                if (this.watchedFiles.has(change.path)) {
                    const key = this.watchedFiles.get(change.path);
                    await this._refreshConfig(key);
                }
            });
        }
    }

    /**
     * 處理同步完成事件
     */
    _handleSyncCompleted(result) {
        if (result.success) {
            this.emit('syncCompleted', result);
        } else {
            this.emit('syncError', result.error);
        }
    }

    /**
     * 設置檔案監控
     */
    async _setupFileWatching() {
        if (this.stateSynchronizer) {
            await this.stateSynchronizer.watch(this.options.configDir, {
                recursive: true,
                mode: 'immediate'
            });
        }
    }

    /**
     * 啟動同步定時器
     */
    _startSyncTimer() {
        this.syncTimer = setInterval(async () => {
            try {
                if (this.stateSynchronizer) {
                    await this.stateSynchronizer.forceSync();
                }
            } catch (error) {
                console.warn('[ConfigManager] 定時同步失敗:', error);
            }
        }, this.options.syncInterval);
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            // 停止定時器
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
            }

            // 清理監控器
            for (const watcher of this.watchers.values()) {
                if (watcher.close) {
                    watcher.close();
                }
            }
            this.watchers.clear();

            // 清理組件
            if (this.stateSynchronizer) {
                await this.stateSynchronizer.cleanup();
            }

            if (this.eventBus) {
                await this.eventBus.dispose();
            }

            // 清理緩存
            this.cache.clear();

            this.status = CONFIG_STATUS.LOADING;
            this.initialized = false;

            console.log('[ConfigManager] 清理完成');

        } catch (error) {
            console.error('[ConfigManager] 清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
ConfigManager.CONFIG_STATUS = CONFIG_STATUS;
ConfigManager.CONFIG_TYPES = CONFIG_TYPES;
ConfigManager.CONFIG_PRIORITY = CONFIG_PRIORITY;

export default ConfigManager;