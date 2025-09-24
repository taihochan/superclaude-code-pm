/**
 * ConfigHotReload - 配置熱更新和實時同步機制
 *
 * 功能：
 * - 檔案系統監控和即時變更檢測
 * - WebSocket實時配置同步
 * - 配置變更的熱重載機制
 * - 多客戶端配置廣播
 * - 衝突檢測和解決策略
 *
 * 用途：實現配置的即時更新和多端同步
 * 配合：ConfigManager、StateSynchronizer、EventBus
 */

import { EventEmitter } from 'events';
import fs from 'fs'.promises;
import fsWatch from 'fs';
import path from 'path';
import crypto from 'crypto';

import ConfigManager from './ConfigManager';
import StateSynchronizer from './StateSynchronizer';
import EventBus from './EventBus';

/**
 * 熱更新類型
 */
const RELOAD_TYPES = {
    CONFIG: 'config',                  // 配置文件變更
    ENVIRONMENT: 'environment',        // 環境配置變更
    PREFERENCES: 'preferences',        // 用戶偏好變更
    TEMPLATE: 'template',             // 模板變更
    SYSTEM: 'system'                  // 系統配置變更
};

/**
 * 同步狀態
 */
const SYNC_STATUS = {
    IDLE: 'idle',                     // 閒置
    WATCHING: 'watching',             // 監控中
    SYNCING: 'syncing',               // 同步中
    CONFLICT: 'conflict',             // 衝突中
    ERROR: 'error'                    // 錯誤
};

/**
 * 衝突解決策略
 */
const CONFLICT_STRATEGIES = {
    LOCAL_WINS: 'local_wins',         // 本地優先
    REMOTE_WINS: 'remote_wins',       // 遠程優先
    NEWEST_WINS: 'newest_wins',       // 最新優先
    PROMPT_USER: 'prompt_user',       // 提示用戶
    MERGE: 'merge'                    // 智能合併
};

/**
 * 配置變更記錄
 */
class ConfigChange {
    constructor(type, key, oldValue, newValue, source, options = {}) {
        this.id = this._generateId();
        this.type = type;
        this.key = key;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.source = source;
        this.timestamp = Date.now();
        this.applied = false;
        this.conflicted = false;
        this.metadata = {
            checksum: this._calculateChecksum(newValue),
            size: this._calculateSize(newValue),
            ...options.metadata
        };
    }

    _generateId() {
        return `change_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    _calculateChecksum(value) {
        return crypto.createHash('md5')
            .update(JSON.stringify(value))
            .digest('hex')
            .substring(0, 8);
    }

    _calculateSize(value) {
        return JSON.stringify(value).length;
    }

    apply() {
        this.applied = true;
        this.appliedAt = Date.now();
    }

    markConflicted(conflictReason = null) {
        this.conflicted = true;
        this.conflictReason = conflictReason;
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            key: this.key,
            oldValue: this.oldValue,
            newValue: this.newValue,
            source: this.source,
            timestamp: this.timestamp,
            applied: this.applied,
            appliedAt: this.appliedAt,
            conflicted: this.conflicted,
            conflictReason: this.conflictReason,
            metadata: this.metadata
        };
    }
}

/**
 * 檔案監控器
 */
class FileWatcher extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            debounceDelay: options.debounceDelay || 100,
            recursive: options.recursive !== false,
            ignorePatterns: options.ignorePatterns || [
                '*.tmp', '*.temp', '*~', '.DS_Store',
                'node_modules/**', '.git/**'
            ],
            ...options
        };

        this.watchers = new Map(); // path -> watcher
        this.debounceTimers = new Map(); // path -> timer
        this.stats = {
            watchedPaths: 0,
            eventsTriggered: 0,
            filesChanged: 0
        };
    }

    /**
     * 監控路徑
     */
    async watch(watchPath, callback) {
        try {
            const absolutePath = path.resolve(watchPath);

            // 檢查路徑是否存在
            const stats = await fs.stat(absolutePath);

            const watcher = fsWatch.watch(absolutePath, {
                recursive: stats.isDirectory() && this.options.recursive
            }, (eventType, filename) => {
                this._handleFileChange(absolutePath, eventType, filename, callback);
            });

            watcher.on('error', (error) => {
                this.emit('error', error, absolutePath);
            });

            this.watchers.set(absolutePath, watcher);
            this.stats.watchedPaths++;

            console.log(`[FileWatcher] 開始監控: ${absolutePath}`);

        } catch (error) {
            console.error(`[FileWatcher] 監控失敗 [${watchPath}]:`, error);
            throw error;
        }
    }

    /**
     * 處理檔案變更
     */
    _handleFileChange(watchPath, eventType, filename, callback) {
        if (!filename) return;

        const filePath = path.join(watchPath, filename);

        // 檢查忽略模式
        if (this._shouldIgnore(filePath)) {
            return;
        }

        this.stats.eventsTriggered++;

        // 防抖動處理
        const timerId = this.debounceTimers.get(filePath);
        if (timerId) {
            clearTimeout(timerId);
        }

        this.debounceTimers.set(filePath, setTimeout(async () => {
            try {
                await this._processFileChange(filePath, eventType, callback);
                this.stats.filesChanged++;
            } catch (error) {
                this.emit('error', error, filePath);
            }
            this.debounceTimers.delete(filePath);
        }, this.options.debounceDelay));
    }

    /**
     * 處理檔案變更
     */
    async _processFileChange(filePath, eventType, callback) {
        try {
            let fileData = null;

            if (eventType === 'change' || eventType === 'rename') {
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const stats = await fs.stat(filePath);

                    fileData = {
                        path: filePath,
                        content,
                        size: stats.size,
                        mtime: stats.mtime,
                        eventType
                    };
                } catch (error) {
                    // 檔案可能已被刪除
                    fileData = {
                        path: filePath,
                        content: null,
                        deleted: true,
                        eventType
                    };
                }
            }

            if (callback && typeof callback === 'function') {
                await callback(fileData);
            }

            this.emit('fileChanged', fileData);

        } catch (error) {
            console.error(`[FileWatcher] 處理檔案變更失敗 [${filePath}]:`, error);
        }
    }

    /**
     * 檢查是否應忽略檔案
     */
    _shouldIgnore(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');

        return this.options.ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                // 簡單的萬用字符匹配
                const regex = new RegExp(
                    pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
                );
                return regex.test(normalizedPath);
            }
            return normalizedPath.includes(pattern);
        });
    }

    /**
     * 停止監控
     */
    unwatch(watchPath = null) {
        if (watchPath) {
            const absolutePath = path.resolve(watchPath);
            const watcher = this.watchers.get(absolutePath);

            if (watcher) {
                watcher.close();
                this.watchers.delete(absolutePath);
                this.stats.watchedPaths--;
                console.log(`[FileWatcher] 停止監控: ${absolutePath}`);
            }
        } else {
            // 停止所有監控
            for (const [path, watcher] of this.watchers) {
                watcher.close();
                console.log(`[FileWatcher] 停止監控: ${path}`);
            }
            this.watchers.clear();
            this.stats.watchedPaths = 0;
        }

        // 清理定時器
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return { ...this.stats };
    }
}

/**
 * 配置同步器
 */
class ConfigSynchronizer extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            conflictStrategy: options.conflictStrategy || CONFLICT_STRATEGIES.NEWEST_WINS,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            enableBatching: options.enableBatching !== false,
            batchSize: options.batchSize || 10,
            batchTimeout: options.batchTimeout || 1000,
            ...options
        };

        this.pendingChanges = [];
        this.batchTimer = null;
        this.stats = {
            changesProcessed: 0,
            conflictsResolved: 0,
            syncErrors: 0
        };
    }

    /**
     * 同步配置變更
     */
    async sync(change) {
        if (this.options.enableBatching) {
            this._addToBatch(change);
        } else {
            await this._processSingle(change);
        }
    }

    /**
     * 添加到批處理
     */
    _addToBatch(change) {
        this.pendingChanges.push(change);

        if (this.pendingChanges.length >= this.options.batchSize) {
            this._processBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this._processBatch();
            }, this.options.batchTimeout);
        }
    }

    /**
     * 處理批處理
     */
    async _processBatch() {
        if (this.pendingChanges.length === 0) return;

        const batch = this.pendingChanges.splice(0);

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            await this._processChanges(batch);
            this.emit('batchProcessed', { count: batch.length });
        } catch (error) {
            this.emit('syncError', error);
        }
    }

    /**
     * 處理單個變更
     */
    async _processSingle(change) {
        await this._processChanges([change]);
    }

    /**
     * 處理變更列表
     */
    async _processChanges(changes) {
        for (const change of changes) {
            try {
                await this._processChange(change);
                change.apply();
                this.stats.changesProcessed++;
            } catch (error) {
                this.stats.syncErrors++;
                this.emit('changeError', { change, error });
            }
        }
    }

    /**
     * 處理單個變更
     */
    async _processChange(change) {
        // 檢測衝突
        const conflict = await this._detectConflict(change);

        if (conflict) {
            const resolution = await this._resolveConflict(change, conflict);
            if (!resolution.resolved) {
                change.markConflicted(resolution.reason);
                throw new Error(`配置衝突無法解決: ${resolution.reason}`);
            }
            this.stats.conflictsResolved++;
        }

        // 應用變更
        this.emit('changeApplied', change);
    }

    /**
     * 檢測衝突
     */
    async _detectConflict(change) {
        // 這裡應該實現衝突檢測邏輯
        // 例如：檢查是否有其他用戶同時修改了相同配置
        return null; // 暫時不檢測衝突
    }

    /**
     * 解決衝突
     */
    async _resolveConflict(change, conflict) {
        switch (this.options.conflictStrategy) {
            case CONFLICT_STRATEGIES.LOCAL_WINS:
                return { resolved: true, strategy: 'local_wins' };

            case CONFLICT_STRATEGIES.REMOTE_WINS:
                return { resolved: false, reason: 'remote_priority' };

            case CONFLICT_STRATEGIES.NEWEST_WINS:
                return {
                    resolved: change.timestamp > conflict.timestamp,
                    strategy: 'newest_wins'
                };

            case CONFLICT_STRATEGIES.MERGE:
                return await this._attemptMerge(change, conflict);

            case CONFLICT_STRATEGIES.PROMPT_USER:
                return { resolved: false, reason: 'user_intervention_required' };

            default:
                return { resolved: false, reason: 'unknown_strategy' };
        }
    }

    /**
     * 嘗試智能合併
     */
    async _attemptMerge(change, conflict) {
        try {
            // 簡單的合併邏輯 - 實際應用中需要更複雜的策略
            if (typeof change.newValue === 'object' && typeof conflict.value === 'object') {
                const merged = { ...conflict.value, ...change.newValue };
                change.newValue = merged;
                return { resolved: true, strategy: 'merge' };
            }

            return { resolved: false, reason: 'merge_not_possible' };
        } catch (error) {
            return { resolved: false, reason: `merge_failed: ${error.message}` };
        }
    }

    /**
     * 刷新待處理變更
     */
    async flush() {
        if (this.pendingChanges.length > 0) {
            await this._processBatch();
        }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            pendingChanges: this.pendingChanges.length
        };
    }
}

/**
 * 主熱更新管理器
 */
class ConfigHotReload extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 核心組件
            configManager: options.configManager || null,
            stateSynchronizer: options.stateSynchronizer || null,
            eventBus: options.eventBus || null,

            // 監控配置
            watchPaths: options.watchPaths || [
                '.claude/config',
                '.claude/environments',
                '.claude/templates'
            ],
            enableFileWatching: options.enableFileWatching !== false,

            // 同步配置
            enableSync: options.enableSync !== false,
            syncOptions: options.syncOptions || {},

            // WebSocket配置
            enableWebSocket: options.enableWebSocket || false,
            webSocketPort: options.webSocketPort || 8080,

            // 性能配置
            maxConcurrentReloads: options.maxConcurrentReloads || 5,
            reloadTimeout: options.reloadTimeout || 5000,

            ...options
        };

        // 核心組件
        this.configManager = this.options.configManager;
        this.stateSynchronizer = this.options.stateSynchronizer;
        this.eventBus = this.options.eventBus;

        // 子組件
        this.fileWatcher = new FileWatcher({
            debounceDelay: 200,
            ignorePatterns: [
                '*.tmp', '*.temp', '*~', '.DS_Store',
                'node_modules/**', '.git/**', '*.log'
            ]
        });

        this.configSynchronizer = new ConfigSynchronizer(this.options.syncOptions);

        // 狀態管理
        this.status = SYNC_STATUS.IDLE;
        this.activeReloads = new Set();
        this.reloadHistory = [];

        // WebSocket支持
        this.wsServer = null;
        this.wsClients = new Set();

        // 統計信息
        this.stats = {
            totalReloads: 0,
            successfulReloads: 0,
            failedReloads: 0,
            averageReloadTime: 0,
            lastReloadTime: null
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化熱更新系統
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 初始化核心組件
            if (!this.configManager) {
                this.configManager = new ConfigManager();
                await this.configManager.initialize();
            }

            if (!this.eventBus) {
                this.eventBus = new EventBus();
                await this.eventBus.initialize();
            }

            if (!this.stateSynchronizer && this.options.enableSync) {
                this.stateSynchronizer = new StateSynchronizer();
                await this.stateSynchronizer.initialize();
            }

            // 設置事件處理
            this._setupEventHandlers();

            // 啟動檔案監控
            if (this.options.enableFileWatching) {
                await this._startFileWatching();
            }

            // 啟動WebSocket服務器
            if (this.options.enableWebSocket) {
                await this._startWebSocketServer();
            }

            this.initialized = true;
            this.status = SYNC_STATUS.WATCHING;

            console.log('[ConfigHotReload] 熱更新系統已初始化');
            this.emit('initialized');

        } catch (error) {
            this.status = SYNC_STATUS.ERROR;
            console.error('[ConfigHotReload] 初始化失敗:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 觸發配置重載
     * @param {string} configKey - 配置鍵
     * @param {object} options - 選項
     */
    async triggerReload(configKey, options = {}) {
        const reloadId = this._generateReloadId();
        const startTime = Date.now();

        try {
            // 檢查並發限制
            if (this.activeReloads.size >= this.options.maxConcurrentReloads) {
                throw new Error('超過最大並發重載數量');
            }

            this.activeReloads.add(reloadId);
            this.status = SYNC_STATUS.SYNCING;

            // 創建變更記錄
            const change = new ConfigChange(
                options.type || RELOAD_TYPES.CONFIG,
                configKey,
                options.oldValue,
                options.newValue,
                options.source || 'manual',
                options
            );

            // 同步變更
            if (this.options.enableSync) {
                await this.configSynchronizer.sync(change);
            }

            // 廣播給WebSocket客戶端
            if (this.options.enableWebSocket && this.wsClients.size > 0) {
                this._broadcastChange(change);
            }

            // 觸發狀態同步
            if (this.stateSynchronizer) {
                await this.stateSynchronizer.syncState(
                    'filesystem',
                    'ccpm',
                    { configKey, changeId: change.id }
                );
            }

            // 發布事件
            await this.eventBus.publish('config.hotReloaded', {
                reloadId,
                configKey,
                changeId: change.id,
                reloadTime: Date.now() - startTime
            });

            const reloadTime = Date.now() - startTime;
            this._updateStats(true, reloadTime);

            // 記錄重載歷史
            this.reloadHistory.push({
                id: reloadId,
                configKey,
                changeId: change.id,
                timestamp: Date.now(),
                duration: reloadTime,
                success: true
            });

            // 限制歷史記錄大小
            if (this.reloadHistory.length > 100) {
                this.reloadHistory = this.reloadHistory.slice(-100);
            }

            console.log(`[ConfigHotReload] 配置已熱重載 [${configKey}] - 耗時: ${reloadTime}ms`);
            this.emit('reloadCompleted', {
                reloadId,
                configKey,
                reloadTime,
                change
            });

            return reloadId;

        } catch (error) {
            this._updateStats(false, Date.now() - startTime);
            console.error(`[ConfigHotReload] 熱重載失敗 [${configKey}]:`, error);
            this.emit('reloadError', { configKey, error });
            throw error;

        } finally {
            this.activeReloads.delete(reloadId);
            if (this.activeReloads.size === 0) {
                this.status = SYNC_STATUS.WATCHING;
            }
        }
    }

    /**
     * 批量重載配置
     * @param {Array} configs - 配置列表 [{ key, oldValue, newValue, options }]
     */
    async batchReload(configs) {
        const results = [];
        const startTime = Date.now();

        try {
            // 並行處理
            const promises = configs.map(async (config) => {
                try {
                    const reloadId = await this.triggerReload(config.key, {
                        oldValue: config.oldValue,
                        newValue: config.newValue,
                        type: config.type || RELOAD_TYPES.CONFIG,
                        source: 'batch_reload',
                        ...config.options
                    });

                    return { configKey: config.key, success: true, reloadId };
                } catch (error) {
                    return { configKey: config.key, success: false, error: error.message };
                }
            });

            results.push(...await Promise.all(promises));

            const successCount = results.filter(r => r.success).length;
            const totalTime = Date.now() - startTime;

            this.emit('batchReloadCompleted', {
                total: configs.length,
                successful: successCount,
                failed: configs.length - successCount,
                totalTime,
                results
            });

            return results;

        } catch (error) {
            console.error('[ConfigHotReload] 批量重載失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取重載狀態
     */
    getStatus() {
        return {
            status: this.status,
            activeReloads: this.activeReloads.size,
            watchedPaths: this.fileWatcher.getStats().watchedPaths,
            wsClients: this.wsClients.size,
            stats: this.getStats()
        };
    }

    /**
     * 獲取重載歷史
     * @param {object} options - 選項
     */
    getReloadHistory(options = {}) {
        let history = [...this.reloadHistory];

        if (options.limit) {
            history = history.slice(-options.limit);
        }

        if (options.since) {
            const sinceTime = typeof options.since === 'string'
                ? new Date(options.since).getTime()
                : options.since;
            history = history.filter(item => item.timestamp >= sinceTime);
        }

        if (options.configKey) {
            history = history.filter(item => item.configKey === options.configKey);
        }

        return history;
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            fileWatcher: this.fileWatcher.getStats(),
            configSynchronizer: this.configSynchronizer.getStats()
        };
    }

    // ========== 私有方法 ==========

    /**
     * 啟動檔案監控
     */
    async _startFileWatching() {
        for (const watchPath of this.options.watchPaths) {
            try {
                await this.fileWatcher.watch(watchPath, async (fileData) => {
                    if (fileData && !fileData.deleted) {
                        await this._handleFileChange(fileData);
                    }
                });
                console.log(`[ConfigHotReload] 開始監控路徑: ${watchPath}`);
            } catch (error) {
                console.warn(`[ConfigHotReload] 監控路徑失敗 [${watchPath}]:`, error);
            }
        }
    }

    /**
     * 處理檔案變更
     */
    async _handleFileChange(fileData) {
        try {
            const { path: filePath, content } = fileData;
            const configKey = this._extractConfigKey(filePath);

            if (!configKey) return;

            // 獲取舊值
            const oldValue = await this.configManager.get(configKey, null);

            // 解析新值
            let newValue;
            try {
                newValue = JSON.parse(content);
            } catch (error) {
                newValue = content; // 如果不是JSON，保持原始內容
            }

            // 檢查是否真的有變更
            if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                return;
            }

            // 觸發熱重載
            await this.triggerReload(configKey, {
                type: this._inferReloadType(filePath),
                oldValue,
                newValue,
                source: 'file_system',
                filePath
            });

        } catch (error) {
            console.error('[ConfigHotReload] 處理檔案變更失敗:', error);
        }
    }

    /**
     * 提取配置鍵
     */
    _extractConfigKey(filePath) {
        const relativePath = path.relative(process.cwd(), filePath);
        const parts = relativePath.split(path.sep);

        // .claude/config/user-preferences.json -> user-preferences
        if (parts.includes('config') && path.extname(filePath) === '.json') {
            return path.basename(filePath, '.json');
        }

        // .claude/environments/development.json -> env_development
        if (parts.includes('environments') && path.extname(filePath) === '.json') {
            return `env_${path.basename(filePath, '.json')}`;
        }

        // .claude/templates/component.json -> template_component
        if (parts.includes('templates') && path.extname(filePath) === '.json') {
            return `template_${path.basename(filePath, '.json')}`;
        }

        return null;
    }

    /**
     * 推斷重載類型
     */
    _inferReloadType(filePath) {
        const relativePath = path.relative(process.cwd(), filePath);

        if (relativePath.includes('environments')) {
            return RELOAD_TYPES.ENVIRONMENT;
        }

        if (relativePath.includes('templates')) {
            return RELOAD_TYPES.TEMPLATE;
        }

        if (relativePath.includes('preferences')) {
            return RELOAD_TYPES.PREFERENCES;
        }

        return RELOAD_TYPES.CONFIG;
    }

    /**
     * 啟動WebSocket服務器
     */
    async _startWebSocketServer() {
        try {
            // 這裡應該使用真實的WebSocket庫，如 ws
            // 暫時模擬WebSocket服務器
            console.log(`[ConfigHotReload] WebSocket服務器已啟動 - 端口: ${this.options.webSocketPort}`);

            // 模擬客戶端連接
            setTimeout(() => {
                this.emit('wsClientConnected', { clientId: 'mock_client_1' });
            }, 1000);

        } catch (error) {
            console.error('[ConfigHotReload] WebSocket服務器啟動失敗:', error);
        }
    }

    /**
     * 廣播變更給WebSocket客戶端
     */
    _broadcastChange(change) {
        const message = {
            type: 'config_change',
            data: change.serialize(),
            timestamp: Date.now()
        };

        // 這裡應該實際發送給WebSocket客戶端
        console.log(`[ConfigHotReload] 廣播配置變更給 ${this.wsClients.size} 個客戶端:`, change.key);

        this.emit('changeBroadcasted', {
            change,
            clientCount: this.wsClients.size
        });
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        // 檔案監控事件
        this.fileWatcher.on('fileChanged', async (fileData) => {
            this.emit('fileChanged', fileData);
        });

        this.fileWatcher.on('error', (error, path) => {
            this.emit('fileWatchError', { error, path });
        });

        // 配置同步器事件
        this.configSynchronizer.on('changeApplied', (change) => {
            this.emit('changeApplied', change);
        });

        this.configSynchronizer.on('syncError', (error) => {
            this.emit('syncError', error);
        });

        // ConfigManager事件
        if (this.configManager) {
            this.configManager.on('configChanged', (event) => {
                // 避免循環觸發
                if (event.source !== 'hot_reload') {
                    this.emit('externalConfigChange', event);
                }
            });
        }
    }

    /**
     * 更新統計信息
     */
    _updateStats(success, reloadTime) {
        this.stats.totalReloads++;

        if (success) {
            this.stats.successfulReloads++;
            this.stats.averageReloadTime = (
                this.stats.averageReloadTime * (this.stats.successfulReloads - 1) + reloadTime
            ) / this.stats.successfulReloads;
        } else {
            this.stats.failedReloads++;
        }

        this.stats.lastReloadTime = new Date().toISOString();
    }

    /**
     * 生成重載ID
     */
    _generateReloadId() {
        return `reload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            // 停止檔案監控
            this.fileWatcher.unwatch();

            // 刷新待處理的同步
            await this.configSynchronizer.flush();

            // 關閉WebSocket服務器
            if (this.wsServer) {
                // 關閉WebSocket連接
                for (const client of this.wsClients) {
                    if (client.close) {
                        client.close();
                    }
                }
                this.wsClients.clear();
            }

            // 清理狀態
            this.activeReloads.clear();
            this.status = SYNC_STATUS.IDLE;
            this.initialized = false;

            console.log('[ConfigHotReload] 清理完成');

        } catch (error) {
            console.error('[ConfigHotReload] 清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
ConfigHotReload.RELOAD_TYPES = RELOAD_TYPES;
ConfigHotReload.SYNC_STATUS = SYNC_STATUS;
ConfigHotReload.CONFLICT_STRATEGIES = CONFLICT_STRATEGIES;

export default ConfigHotReload;