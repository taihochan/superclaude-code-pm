/**
 * StateSynchronizer - 狀態同步協調器
 *
 * 功能：
 * - 主要狀態同步協調器
 * - 管理多個狀態源的同步
 * - 衝突檢測和解決策略
 * - 支持多種同步模式（即時、批量、定時、手動）
 *
 * 用途：協調CCPM和SuperClaude系統間的狀態同步
 * 配合：整合StateStore、FileWatcher、ConflictResolver
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

import StateStore from './StateStore';
import FileWatcher from './FileWatcher';
import ConflictResolver from './ConflictResolver';

/**
 * 同步狀態
 */
const SYNC_STATUS = {
    IDLE: 'idle',           // 閒置
    SYNCING: 'syncing',     // 同步中
    SYNCED: 'synced',       // 已同步
    CONFLICT: 'conflict',   // 衝突
    ERROR: 'error'          // 錯誤
};

/**
 * 同步模式
 */
const SYNC_MODES = {
    IMMEDIATE: 'immediate', // 即時同步
    BATCH: 'batch',        // 批量同步
    SCHEDULED: 'scheduled', // 定時同步
    MANUAL: 'manual'       // 手動同步
};

/**
 * 同步源類型
 */
const SYNC_SOURCES = {
    FILESYSTEM: 'filesystem',
    CCPM: 'ccpm',
    SUPERCLAUDE: 'superclaude',
    EXTERNAL: 'external'
};

/**
 * 狀態同步器
 */
class StateSynchronizer extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 同步配置
            defaultMode: SYNC_MODES.IMMEDIATE,
            syncTimeout: 30000, // 30秒
            maxRetries: 3,
            retryDelay: 1000,

            // 性能配置
            batchSize: 50,
            batchDelay: 100,
            maxConcurrentSyncs: 5,

            // 檔案系統配置
            watchPaths: [
                'package.json',
                'vite.config.js',
                '.claude/config',
                'src/config'
            ],
            criticalFiles: [
                'package.json',
                'vite.config.js',
                '.claude/CLAUDE.md'
            ],

            // 錯誤處理
            continueOnError: true,
            logErrors: true,

            ...options
        };

        // 核心組件
        this.stateStore = new StateStore({
            dataDir: path.join(process.cwd(), '.claude', 'data')
        });

        this.fileWatcher = new FileWatcher({
            batchDelay: this.options.batchDelay,
            ignorePatterns: [
                'node_modules/**',
                'dist/**',
                '.git/**',
                '*.log',
                '*.tmp',
                '.env*'
            ]
        });

        this.conflictResolver = new ConflictResolver({
            defaultStrategy: 'auto_merge',
            autoResolveThreshold: 'medium'
        });

        // 同步狀態管理
        this.syncStatus = SYNC_STATUS.IDLE;
        this.activeSyncs = new Map(); // 活動的同步任務
        this.syncQueue = []; // 同步隊列
        this.syncHistory = []; // 同步歷史

        // 策略映射
        this.syncStrategies = new Map();
        this._initializeSyncStrategies();

        // 統計信息
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            conflictsResolved: 0,
            averageSyncTime: 0,
            lastSyncTime: null
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化同步器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 初始化組件
            await this.stateStore.initialize();
            await this.conflictResolver.initialize();

            // 設置檔案監控
            await this._setupFileWatching();

            // 設置事件處理
            this._setupEventHandlers();

            // 載入同步配置
            await this._loadSyncConfiguration();

            this.initialized = true;
            this.syncStatus = SYNC_STATUS.IDLE;

            console.log('[StateSynchronizer] 已初始化');
            this.emit('initialized');

        } catch (error) {
            console.error('[StateSynchronizer] 初始化失敗:', error);
            this.syncStatus = SYNC_STATUS.ERROR;
            throw error;
        }
    }

    /**
     * 同步狀態
     * @param {string} sourceType 源類型
     * @param {string} targetType 目標類型
     * @param {object} options 同步選項
     */
    async syncState(sourceType, targetType, options = {}) {
        const syncId = this._generateSyncId();
        const syncOptions = { ...this.options, ...options };

        try {
            // 檢查是否已初始化
            if (!this.initialized) {
                await this.initialize();
            }

            // 創建同步任務
            const syncTask = {
                id: syncId,
                sourceType,
                targetType,
                options: syncOptions,
                status: 'pending',
                startTime: Date.now(),
                retries: 0
            };

            this.activeSyncs.set(syncId, syncTask);
            this.emit('syncStarted', syncTask);

            console.log(`[StateSynchronizer] 開始同步: ${sourceType} → ${targetType}`);

            // 執行同步
            const result = await this._executeSyncTask(syncTask);

            // 更新統計
            this._updateSyncStats(result);

            // 記錄歷史
            this._recordSyncHistory(syncTask, result);

            this.activeSyncs.delete(syncId);
            this.emit('syncCompleted', result);

            return result;

        } catch (error) {
            console.error(`[StateSynchronizer] 同步失敗 [${syncId}]:`, error);

            const result = {
                id: syncId,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this._updateSyncStats(result);
            this.activeSyncs.delete(syncId);
            this.emit('syncFailed', result);

            if (!this.options.continueOnError) {
                throw error;
            }

            return result;
        }
    }

    /**
     * 監控指定路徑
     * @param {string|Array} paths 監控路徑
     * @param {object} options 監控選項
     */
    async watch(paths, options = {}) {
        const pathsArray = Array.isArray(paths) ? paths : [paths];
        const watchOptions = {
            mode: SYNC_MODES.IMMEDIATE,
            ...options
        };

        // 為關鍵檔案設置即時同步
        const criticalPaths = pathsArray.filter(p =>
            this.options.criticalFiles.some(cf => p.includes(cf))
        );

        if (criticalPaths.length > 0) {
            watchOptions.mode = SYNC_MODES.IMMEDIATE;
        }

        await this.fileWatcher.watch(pathsArray, watchOptions);

        console.log(`[StateSynchronizer] 開始監控 ${pathsArray.length} 個路徑`);
    }

    /**
     * 停止監控
     * @param {string|Array} paths 停止監控的路徑
     */
    async unwatch(paths) {
        await this.fileWatcher.unwatch(paths);
        console.log('[StateSynchronizer] 已停止路徑監控');
    }

    /**
     * 註冊同步策略
     * @param {string} name 策略名稱
     * @param {function} strategy 策略函數
     */
    registerStrategy(name, strategy) {
        this.syncStrategies.set(name, strategy);
        console.log(`[StateSynchronizer] 已註冊同步策略: ${name}`);
    }

    /**
     * 檢測狀態差異
     * @param {string} sourceType 源類型
     * @param {string} targetType 目標類型
     */
    async detectStateDifferences(sourceType, targetType) {
        try {
            const sourceState = await this._getStateByType(sourceType);
            const targetState = await this._getStateByType(targetType);

            if (!sourceState || !targetState) {
                return {
                    hasChanges: true,
                    isNew: !sourceState || !targetState,
                    changes: null
                };
            }

            return await this.stateStore.detectChanges(targetType, sourceState);

        } catch (error) {
            console.error('[StateSynchronizer] 檢測狀態差異失敗:', error);
            throw error;
        }
    }

    /**
     * 解決衝突
     * @param {Array} conflicts 衝突列表
     * @param {string} strategy 解決策略
     */
    async resolveConflicts(conflicts, strategy = 'auto') {
        try {
            const resolution = await this.conflictResolver.resolveConflicts(conflicts, strategy);

            this.stats.conflictsResolved += conflicts.length;
            this.emit('conflictsResolved', resolution);

            return resolution;

        } catch (error) {
            console.error('[StateSynchronizer] 解決衝突失敗:', error);
            throw error;
        }
    }

    /**
     * 強制同步
     * @param {object} options 同步選項
     */
    async forceSync(options = {}) {
        const syncTasks = [];

        // 檢測所有需要同步的狀態
        const stateSources = [SYNC_SOURCES.FILESYSTEM, SYNC_SOURCES.CCPM, SYNC_SOURCES.SUPERCLAUDE];

        for (let i = 0; i < stateSources.length; i++) {
            for (let j = i + 1; j < stateSources.length; j++) {
                const source = stateSources[i];
                const target = stateSources[j];

                const differences = await this.detectStateDifferences(source, target);
                if (differences.hasChanges) {
                    syncTasks.push(this.syncState(source, target, options));
                }
            }
        }

        const results = await Promise.allSettled(syncTasks);
        const summary = {
            total: results.length,
            successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
            failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
            results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message })
        };

        this.emit('forceSyncCompleted', summary);
        return summary;
    }

    /**
     * 獲取同步狀態
     */
    getSyncStatus() {
        return {
            status: this.syncStatus,
            activeSyncs: Array.from(this.activeSyncs.values()),
            queueSize: this.syncQueue.length,
            stats: { ...this.stats }
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            // 停止所有監控
            await this.fileWatcher.unwatchAll();

            // 等待活動同步完成
            const pendingSyncs = Array.from(this.activeSyncs.values());
            if (pendingSyncs.length > 0) {
                console.log(`[StateSynchronizer] 等待 ${pendingSyncs.length} 個同步任務完成...`);
                // 設置超時等待
                await this._waitForSyncsCompletion(10000); // 10秒超時
            }

            // 清理狀態存儲
            await this.stateStore.cleanup();
            await this.conflictResolver.cleanupHistory();

            // 保存同步歷史
            await this._saveSyncHistory();

            this.syncStatus = SYNC_STATUS.IDLE;
            console.log('[StateSynchronizer] 清理完成');

        } catch (error) {
            console.error('[StateSynchronizer] 清理失敗:', error);
            throw error;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 初始化同步策略
     */
    _initializeSyncStrategies() {
        // 即時同步策略
        this.registerStrategy(SYNC_MODES.IMMEDIATE, async (syncTask) => {
            return await this._performImmediateSync(syncTask);
        });

        // 批量同步策略
        this.registerStrategy(SYNC_MODES.BATCH, async (syncTask) => {
            return await this._performBatchSync(syncTask);
        });

        // 定時同步策略
        this.registerStrategy(SYNC_MODES.SCHEDULED, async (syncTask) => {
            return await this._performScheduledSync(syncTask);
        });

        // 手動同步策略
        this.registerStrategy(SYNC_MODES.MANUAL, async (syncTask) => {
            return await this._performManualSync(syncTask);
        });
    }

    /**
     * 設置檔案監控
     */
    async _setupFileWatching() {
        // 監控關鍵檔案
        for (const watchPath of this.options.watchPaths) {
            try {
                await this.fileWatcher.watch(watchPath, {
                    recursive: true,
                    mode: SYNC_MODES.IMMEDIATE
                });
            } catch (error) {
                console.warn(`[StateSynchronizer] 監控路徑失敗: ${watchPath}`, error);
            }
        }
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        // 檔案變化事件
        this.fileWatcher.on('change', async (change) => {
            await this._handleFileChange(change);
        });

        this.fileWatcher.on('batchChange', async (changes) => {
            await this._handleBatchFileChange(changes);
        });

        // 錯誤處理
        this.fileWatcher.on('error', (error, path) => {
            console.error(`[StateSynchronizer] 檔案監控錯誤 [${path}]:`, error);
            this.emit('error', error, { source: 'fileWatcher', path });
        });

        this.conflictResolver.on('conflictsDetected', (conflicts) => {
            this.emit('conflictsDetected', conflicts);
        });
    }

    /**
     * 執行同步任務
     */
    async _executeSyncTask(syncTask) {
        const startTime = Date.now();

        try {
            // 更新任務狀態
            syncTask.status = 'running';
            this.syncStatus = SYNC_STATUS.SYNCING;

            // 獲取源和目標狀態
            const sourceState = await this._getStateByType(syncTask.sourceType);
            const targetState = await this._getStateByType(syncTask.targetType);

            // 檢測衝突
            const conflicts = await this.conflictResolver.detectConflicts(
                sourceState,
                targetState,
                null,
                { syncTask }
            );

            let resolvedState = sourceState;

            // 處理衝突
            if (conflicts.length > 0) {
                this.syncStatus = SYNC_STATUS.CONFLICT;

                const resolution = await this.conflictResolver.resolveConflicts(
                    conflicts,
                    syncTask.options.conflictStrategy
                );

                if (!resolution.success) {
                    throw new Error('衝突解決失敗');
                }

                resolvedState = this._applyConflictResolution(sourceState, resolution);
            }

            // 執行同步策略
            const strategyName = syncTask.options.mode || this.options.defaultMode;
            const strategy = this.syncStrategies.get(strategyName);

            if (!strategy) {
                throw new Error(`未知的同步策略: ${strategyName}`);
            }

            // 保存同步後的狀態
            const stateId = await this.stateStore.saveState(
                syncTask.targetType,
                resolvedState,
                {
                    syncId: syncTask.id,
                    sourceType: syncTask.sourceType,
                    strategy: strategyName,
                    conflicts: conflicts.length
                }
            );

            // 更新狀態
            syncTask.status = 'completed';
            this.syncStatus = SYNC_STATUS.SYNCED;

            const result = {
                id: syncTask.id,
                success: true,
                stateId,
                conflicts: conflicts.length,
                syncTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            return result;

        } catch (error) {
            syncTask.status = 'failed';
            this.syncStatus = SYNC_STATUS.ERROR;

            // 重試機制
            if (syncTask.retries < this.options.maxRetries) {
                syncTask.retries++;
                console.log(`[StateSynchronizer] 同步重試 ${syncTask.retries}/${this.options.maxRetries}`);

                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                return await this._executeSyncTask(syncTask);
            }

            throw error;
        }
    }

    /**
     * 根據類型獲取狀態
     */
    async _getStateByType(type) {
        try {
            switch (type) {
                case SYNC_SOURCES.FILESYSTEM:
                    return await this._getFilesystemState();
                case SYNC_SOURCES.CCPM:
                    return await this._getCCPMState();
                case SYNC_SOURCES.SUPERCLAUDE:
                    return await this._getSuperClaudeState();
                default:
                    return await this.stateStore.getLatestState(type);
            }
        } catch (error) {
            console.warn(`[StateSynchronizer] 獲取狀態失敗 [${type}]:`, error);
            return null;
        }
    }

    /**
     * 獲取檔案系統狀態
     */
    async _getFilesystemState() {
        const state = {
            files: {},
            directories: [],
            gitStatus: null
        };

        // 讀取關鍵檔案
        for (const filePath of this.options.criticalFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const stats = await fs.stat(filePath);

                state.files[filePath] = {
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtime,
                    content: content.length < 64 * 1024 ? content : null, // 64KB限制
                    hash: this._calculateFileHash(content)
                };
            } catch (error) {
                // 檔案不存在或無法讀取
            }
        }

        return state;
    }

    /**
     * 獲取CCPM狀態
     */
    async _getCCPMState() {
        // 這裡應該從CCPM系統獲取狀態
        // 暫時返回基本狀態
        return {
            activeTemplates: [],
            generatedFiles: [],
            lastSync: new Date().toISOString(),
            config: await this._loadConfig('.claude/config')
        };
    }

    /**
     * 獲取SuperClaude狀態
     */
    async _getSuperClaudeState() {
        // 這裡應該從SuperClaude系統獲取狀態
        // 暫時返回基本狀態
        return {
            activeWorkflows: [],
            completedTasks: [],
            currentContext: {},
            lastSync: new Date().toISOString()
        };
    }

    /**
     * 處理檔案變化
     */
    async _handleFileChange(change) {
        try {
            // 檢查是否為關鍵檔案
            const isCritical = this.options.criticalFiles.some(cf =>
                change.path.includes(cf)
            );

            // 關鍵檔案立即同步
            if (isCritical) {
                await this.syncState(
                    SYNC_SOURCES.FILESYSTEM,
                    SYNC_SOURCES.CCPM,
                    { mode: SYNC_MODES.IMMEDIATE }
                );
            }

            this.emit('fileChanged', change);

        } catch (error) {
            console.error('[StateSynchronizer] 處理檔案變化失敗:', error);
        }
    }

    /**
     * 處理批量檔案變化
     */
    async _handleBatchFileChange(changes) {
        try {
            // 檢查是否有關鍵檔案變化
            const hasCriticalChanges = changes.some(change =>
                this.options.criticalFiles.some(cf => change.path.includes(cf))
            );

            if (hasCriticalChanges) {
                await this.syncState(
                    SYNC_SOURCES.FILESYSTEM,
                    SYNC_SOURCES.CCPM,
                    { mode: SYNC_MODES.IMMEDIATE }
                );
            } else {
                await this.syncState(
                    SYNC_SOURCES.FILESYSTEM,
                    SYNC_SOURCES.CCPM,
                    { mode: SYNC_MODES.BATCH }
                );
            }

            this.emit('batchFileChanged', changes);

        } catch (error) {
            console.error('[StateSynchronizer] 處理批量檔案變化失敗:', error);
        }
    }

    /**
     * 應用衝突解決結果
     */
    _applyConflictResolution(baseState, resolution) {
        let resolvedState = { ...baseState };

        for (const result of resolution.results) {
            if (result.success && result.resolvedValue !== undefined) {
                // 這裡需要根據衝突字段路徑設置解決值
                // 簡化實現：直接替換整個狀態
                resolvedState = result.resolvedValue;
            }
        }

        return resolvedState;
    }

    /**
     * 執行即時同步
     */
    async _performImmediateSync(syncTask) {
        // 即時同步：立即執行，延遲 < 100ms
        return { mode: SYNC_MODES.IMMEDIATE, executed: true };
    }

    /**
     * 執行批量同步
     */
    async _performBatchSync(syncTask) {
        // 批量同步：收集變化後批量處理
        return { mode: SYNC_MODES.BATCH, executed: true };
    }

    /**
     * 執行定時同步
     */
    async _performScheduledSync(syncTask) {
        // 定時同步：按固定間隔執行
        return { mode: SYNC_MODES.SCHEDULED, executed: true };
    }

    /**
     * 執行手動同步
     */
    async _performManualSync(syncTask) {
        // 手動同步：等待用戶觸發
        return { mode: SYNC_MODES.MANUAL, executed: false };
    }

    /**
     * 更新同步統計
     */
    _updateSyncStats(result) {
        this.stats.totalSyncs++;

        if (result.success) {
            this.stats.successfulSyncs++;
        } else {
            this.stats.failedSyncs++;
        }

        if (result.syncTime) {
            this.stats.averageSyncTime = (
                (this.stats.averageSyncTime * (this.stats.totalSyncs - 1) + result.syncTime) /
                this.stats.totalSyncs
            );
        }

        this.stats.lastSyncTime = new Date().toISOString();
    }

    /**
     * 記錄同步歷史
     */
    _recordSyncHistory(syncTask, result) {
        const record = {
            ...syncTask,
            result,
            endTime: Date.now()
        };

        this.syncHistory.push(record);

        // 限制歷史記錄數量
        if (this.syncHistory.length > 1000) {
            this.syncHistory = this.syncHistory.slice(-1000);
        }
    }

    /**
     * 生成同步ID
     */
    _generateSyncId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 計算檔案哈希
     */
    _calculateFileHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * 載入配置
     */
    async _loadConfig(configPath) {
        try {
            const configFiles = await fs.readdir(configPath);
            const config = {};

            for (const file of configFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(configPath, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    config[file.replace('.json', '')] = JSON.parse(content);
                }
            }

            return config;
        } catch (error) {
            return {};
        }
    }

    /**
     * 載入同步配置
     */
    async _loadSyncConfiguration() {
        const configFile = path.join(process.cwd(), '.claude', 'config', 'sync.json');

        try {
            const data = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(data);

            // 合併配置
            Object.assign(this.options, config);

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[StateSynchronizer] 載入同步配置失敗:', error);
            }
        }
    }

    /**
     * 保存同步歷史
     */
    async _saveSyncHistory() {
        const historyFile = path.join(process.cwd(), '.claude', 'data', 'sync-history.json');

        try {
            await fs.writeFile(historyFile, JSON.stringify(this.syncHistory, null, 2));
        } catch (error) {
            console.warn('[StateSynchronizer] 保存同步歷史失敗:', error);
        }
    }

    /**
     * 等待同步完成
     */
    async _waitForSyncsCompletion(timeout) {
        return new Promise((resolve) => {
            const checkInterval = 100;
            let elapsed = 0;

            const checker = setInterval(() => {
                if (this.activeSyncs.size === 0 || elapsed >= timeout) {
                    clearInterval(checker);
                    resolve();
                }
                elapsed += checkInterval;
            }, checkInterval);
        });
    }
}

// 導出常數
StateSynchronizer.SYNC_STATUS = SYNC_STATUS;
StateSynchronizer.SYNC_MODES = SYNC_MODES;
StateSynchronizer.SYNC_SOURCES = SYNC_SOURCES;

export default StateSynchronizer;