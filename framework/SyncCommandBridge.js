/**
 * SyncCommandBridge - 狀態同步命令橋接器
 *
 * 功能：
 * - 將狀態同步功能整合到CommandRouter中
 * - 提供狀態同步相關命令
 * - 支持與現有命令系統的無縫整合
 * - 實現同步操作的命令化管理
 *
 * 用途：為CommandRouter提供狀態同步命令支持
 * 配合：與StateSynchronizer、CommandRouter配合實現統一命令介面
 */

import StateSynchronizer from './StateSynchronizer';
import { MIDDLEWARE_TYPES } from './CommandRouter';

/**
 * 狀態同步命令橋接器
 */
class SyncCommandBridge {
    constructor(commandRouter, options = {}) {
        this.commandRouter = commandRouter;
        this.options = {
            enableAutoSync: true,     // 啟用自動同步
            syncOnCommand: true,      // 命令執行後自動同步
            prefix: 'sync:',          // 同步命令前綴
            ...options
        };

        // 初始化狀態同步器
        this.synchronizer = new StateSynchronizer({
            defaultMode: 'immediate',
            watchPaths: [
                'package.json',
                'vite.config.js',
                '.claude/config',
                'src/config'
            ]
        });

        // 命令定義
        this.commands = new Map();

        // 初始化橋接器
        this._initialize();
    }

    /**
     * 初始化橋接器
     */
    async _initialize() {
        try {
            // 初始化狀態同步器
            await this.synchronizer.initialize();

            // 註冊同步相關命令
            this._registerSyncCommands();

            // 設置中間件
            this._setupMiddlewares();

            // 設置事件處理
            this._setupEventHandlers();

            console.log('[SyncCommandBridge] 已初始化');

        } catch (error) {
            console.error('[SyncCommandBridge] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 註冊同步相關命令
     */
    _registerSyncCommands() {
        // sync:status - 獲取同步狀態
        this._registerCommand('status', {
            name: 'sync:status',
            description: '獲取當前狀態同步狀態',
            usage: 'sync:status',
            examples: ['sync:status']
        }, async (parsed, context) => {
            const status = this.synchronizer.getSyncStatus();
            const statistics = await this.synchronizer.stateStore.getStatistics();

            return {
                success: true,
                data: {
                    syncStatus: status,
                    stateStore: statistics,
                    timestamp: new Date().toISOString()
                }
            };
        });

        // sync:force - 強制同步
        this._registerCommand('force', {
            name: 'sync:force',
            description: '強制執行狀態同步',
            usage: 'sync:force [source] [target]',
            examples: [
                'sync:force',
                'sync:force filesystem ccpm',
                'sync:force ccpm superclaude'
            ]
        }, async (parsed, context) => {
            const source = parsed.args[0] || null;
            const target = parsed.args[1] || null;

            let result;
            if (source && target) {
                // 指定源和目標的同步
                result = await this.synchronizer.syncState(source, target, {
                    mode: 'manual',
                    force: true
                });
            } else {
                // 全面同步
                result = await this.synchronizer.forceSync({
                    mode: 'manual'
                });
            }

            return {
                success: true,
                data: result,
                message: '強制同步已完成'
            };
        });

        // sync:watch - 開始監控
        this._registerCommand('watch', {
            name: 'sync:watch',
            description: '開始監控指定路徑',
            usage: 'sync:watch <path> [options]',
            examples: [
                'sync:watch src/',
                'sync:watch package.json --mode immediate',
                'sync:watch .claude/config --recursive'
            ]
        }, async (parsed, context) => {
            const path = parsed.args[0];
            if (!path) {
                throw new Error('請指定要監控的路徑');
            }

            const watchOptions = {
                mode: parsed.options.mode || 'immediate',
                recursive: parsed.options.recursive !== false
            };

            await this.synchronizer.watch(path, watchOptions);

            return {
                success: true,
                message: `已開始監控路徑: ${path}`,
                options: watchOptions
            };
        });

        // sync:unwatch - 停止監控
        this._registerCommand('unwatch', {
            name: 'sync:unwatch',
            description: '停止監控指定路徑',
            usage: 'sync:unwatch <path>',
            examples: [
                'sync:unwatch src/',
                'sync:unwatch package.json'
            ]
        }, async (parsed, context) => {
            const path = parsed.args[0];
            if (!path) {
                throw new Error('請指定要停止監控的路徑');
            }

            await this.synchronizer.unwatch(path);

            return {
                success: true,
                message: `已停止監控路徑: ${path}`
            };
        });

        // sync:conflicts - 獲取衝突信息
        this._registerCommand('conflicts', {
            name: 'sync:conflicts',
            description: '獲取當前狀態衝突信息',
            usage: 'sync:conflicts [source] [target]',
            examples: [
                'sync:conflicts',
                'sync:conflicts filesystem ccpm'
            ]
        }, async (parsed, context) => {
            const source = parsed.args[0] || 'filesystem';
            const target = parsed.args[1] || 'ccpm';

            // 檢測衝突
            const differences = await this.synchronizer.detectStateDifferences(source, target);

            if (!differences.hasChanges) {
                return {
                    success: true,
                    message: '沒有檢測到狀態衝突',
                    data: { hasConflicts: false }
                };
            }

            // 模擬衝突檢測（實際實現中會使用ConflictResolver）
            const conflicts = [];
            if (differences.changes) {
                for (const [field, change] of Object.entries(differences.changes.modified || {})) {
                    conflicts.push({
                        field,
                        type: 'modification',
                        sourceValue: change.to,
                        targetValue: change.from
                    });
                }
            }

            return {
                success: true,
                data: {
                    hasConflicts: conflicts.length > 0,
                    conflicts,
                    summary: {
                        total: conflicts.length,
                        source,
                        target
                    }
                }
            };
        });

        // sync:resolve - 解決衝突
        this._registerCommand('resolve', {
            name: 'sync:resolve',
            description: '解決狀態衝突',
            usage: 'sync:resolve <strategy> [source] [target]',
            examples: [
                'sync:resolve auto_merge',
                'sync:resolve source_wins filesystem ccmp',
                'sync:resolve manual filesystem superclaude'
            ]
        }, async (parsed, context) => {
            const strategy = parsed.args[0];
            if (!strategy) {
                throw new Error('請指定衝突解決策略');
            }

            const source = parsed.args[1] || 'filesystem';
            const target = parsed.args[2] || 'ccpm';

            // 先檢測衝突
            const differences = await this.synchronizer.detectStateDifferences(source, target);

            if (!differences.hasChanges) {
                return {
                    success: true,
                    message: '沒有需要解決的衝突'
                };
            }

            // 模擬衝突解決
            const conflicts = differences.changes ? Object.keys(differences.changes.modified || {}).map(field => ({
                field,
                type: 'modification'
            })) : [];

            const resolution = await this.synchronizer.resolveConflicts(conflicts, strategy);

            return {
                success: true,
                message: `使用策略 ${strategy} 解決了 ${conflicts.length} 個衝突`,
                data: resolution
            };
        });

        // sync:history - 獲取同步歷史
        this._registerCommand('history', {
            name: 'sync:history',
            description: '獲取狀態同步歷史',
            usage: 'sync:history [limit]',
            examples: [
                'sync:history',
                'sync:history 20'
            ]
        }, async (parsed, context) => {
            const limit = parseInt(parsed.args[0]) || 10;

            // 獲取狀態歷史
            const stateHistory = await this.synchronizer.stateStore.getStateHistory('filesystem', limit);
            const conflictStats = this.synchronizer.conflictResolver.getConflictStatistics();

            return {
                success: true,
                data: {
                    stateHistory,
                    conflictStatistics: conflictStats,
                    limit
                }
            };
        });

        // sync:cleanup - 清理同步數據
        this._registerCommand('cleanup', {
            name: 'sync:cleanup',
            description: '清理過期的同步數據',
            usage: 'sync:cleanup [--max-age days] [--max-versions count]',
            examples: [
                'sync:cleanup',
                'sync:cleanup --max-age 30',
                'sync:cleanup --max-versions 100'
            ]
        }, async (parsed, context) => {
            const maxAge = parsed.options['max-age'] ?
                parseInt(parsed.options['max-age']) * 24 * 60 * 60 * 1000 :
                undefined;

            const maxVersions = parsed.options['max-versions'] ?
                parseInt(parsed.options['max-versions']) :
                undefined;

            const cleanupOptions = {};
            if (maxAge) cleanupOptions.maxAge = maxAge;
            if (maxVersions) cleanupOptions.maxVersions = maxVersions;

            // 清理狀態存儲
            const stateCleanupCount = await this.synchronizer.stateStore.cleanup(cleanupOptions);

            // 清理衝突歷史
            const conflictCleanupCount = await this.synchronizer.conflictResolver.cleanupHistory(cleanupOptions);

            return {
                success: true,
                message: `清理完成`,
                data: {
                    stateRecordsRemoved: stateCleanupCount,
                    conflictRecordsRemoved: conflictCleanupCount,
                    options: cleanupOptions
                }
            };
        });

        // sync:config - 配置同步設置
        this._registerCommand('config', {
            name: 'sync:config',
            description: '查看或修改同步配置',
            usage: 'sync:config [key] [value]',
            examples: [
                'sync:config',
                'sync:config defaultMode batch',
                'sync:config syncTimeout 60000'
            ]
        }, async (parsed, context) => {
            const key = parsed.args[0];
            const value = parsed.args[1];

            if (!key) {
                // 返回當前配置
                return {
                    success: true,
                    data: {
                        synchronizer: this.synchronizer.options,
                        bridge: this.options
                    }
                };
            }

            if (!value) {
                // 返回指定鍵的值
                const configValue = this.synchronizer.options[key] || this.options[key];
                return {
                    success: true,
                    data: { [key]: configValue }
                };
            }

            // 設置配置值
            if (key in this.synchronizer.options) {
                // 轉換值類型
                let parsedValue = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else if (!isNaN(value)) parsedValue = Number(value);

                this.synchronizer.options[key] = parsedValue;
            } else if (key in this.options) {
                let parsedValue = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else if (!isNaN(value)) parsedValue = Number(value);

                this.options[key] = parsedValue;
            } else {
                throw new Error(`未知的配置鍵: ${key}`);
            }

            return {
                success: true,
                message: `已更新配置: ${key} = ${value}`
            };
        });

        console.log(`[SyncCommandBridge] 已註冊 ${this.commands.size} 個同步命令`);
    }

    /**
     * 註冊單個命令
     */
    _registerCommand(name, definition, handler) {
        this.commands.set(name, { definition, handler });
        this.commandRouter.registerCommand(definition, handler);
    }

    /**
     * 設置中間件
     */
    _setupMiddlewares() {
        // 如果啟用了命令後自動同步，添加後執行中間件
        if (this.options.syncOnCommand) {
            this.commandRouter.use(MIDDLEWARE_TYPES.POST_EXECUTE, async (data) => {
                const { parsed, result, context } = data;

                // 跳過同步命令本身
                if (parsed.fullCommand.startsWith(this.options.prefix)) {
                    return;
                }

                // 檢查是否需要同步
                if (this._shouldSyncAfterCommand(parsed, result)) {
                    try {
                        await this.synchronizer.syncState(
                            'filesystem',
                            'ccpm',
                            {
                                mode: 'batch',
                                trigger: 'command_execution',
                                commandId: context.id
                            }
                        );
                    } catch (error) {
                        console.warn('[SyncCommandBridge] 命令後同步失敗:', error.message);
                    }
                }
            });
        }

        // 添加同步狀態檢查中間件
        this.commandRouter.use(MIDDLEWARE_TYPES.PRE_EXECUTE, async (data) => {
            const { parsed, context } = data;

            // 為同步命令添加狀態檢查
            if (parsed.fullCommand.startsWith(this.options.prefix)) {
                context.middlewareState.syncStatus = this.synchronizer.getSyncStatus();
            }
        });
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        // 監聽同步器事件
        this.synchronizer.on('syncCompleted', (result) => {
            this.commandRouter.emit('syncCompleted', result);
        });

        this.synchronizer.on('syncFailed', (error) => {
            this.commandRouter.emit('syncFailed', error);
        });

        this.synchronizer.on('conflictsDetected', (conflicts) => {
            this.commandRouter.emit('conflictsDetected', conflicts);
        });

        this.synchronizer.on('conflictsResolved', (resolution) => {
            this.commandRouter.emit('conflictsResolved', resolution);
        });

        // 監聽檔案變化
        this.synchronizer.on('fileChanged', (change) => {
            this.commandRouter.emit('fileChanged', change);
        });
    }

    /**
     * 判斷命令後是否需要同步
     */
    _shouldSyncAfterCommand(parsed, result) {
        // 如果命令失敗，不進行同步
        if (!result || !result.success) {
            return false;
        }

        // 檢查命令類型
        const syncTriggerCommands = [
            'ccpm:generate',
            'ccpm:update',
            'claude:save',
            'claude:load',
            'config:update'
        ];

        return syncTriggerCommands.some(cmd =>
            parsed.fullCommand.startsWith(cmd) ||
            parsed.command === cmd
        );
    }

    /**
     * 獲取橋接器統計信息
     */
    getStatistics() {
        return {
            commands: this.commands.size,
            synchronizer: this.synchronizer.getSyncStatus(),
            options: this.options
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            await this.synchronizer.cleanup();
            this.commands.clear();
            console.log('[SyncCommandBridge] 清理完成');
        } catch (error) {
            console.error('[SyncCommandBridge] 清理失敗:', error);
            throw error;
        }
    }
}

export default SyncCommandBridge;