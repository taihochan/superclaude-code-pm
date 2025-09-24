/**
 * BatchSync - 批量同步策略
 *
 * 功能：
 * - 收集一段時間內的變化後批量處理
 * - 適用於大量檔案操作
 * - 平衡性能和即時性
 * - 智能合併相同檔案的多次變更
 *
 * 用途：提高大量檔案變更時的同步效率
 * 配合：與StateSynchronizer配合優化性能
 */

const { EventEmitter } = require('events');

/**
 * 批量同步策略
 */
class BatchSync extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            batchInterval: 1000, // 批量處理間隔（毫秒）
            maxBatchSize: 50,    // 最大批量大小
            maxWaitTime: 5000,   // 最大等待時間
            mergeSimilar: true,  // 合併相似變更
            ...options
        };

        this.pendingChanges = new Map(); // 待處理變更
        this.batchTimer = null;          // 批量計時器
        this.processing = false;         // 處理中標記

        // 統計信息
        this.stats = {
            totalBatches: 0,
            totalChanges: 0,
            averageBatchSize: 0,
            averageProcessTime: 0,
            mergedChanges: 0
        };
    }

    /**
     * 執行批量同步
     * @param {object} syncTask 同步任務
     * @param {object} context 執行上下文
     * @returns {Promise<object>} 同步結果
     */
    async execute(syncTask, context = {}) {
        try {
            // 添加到待處理變更
            this._addToBatch(syncTask, context);

            // 啟動批量處理
            this._scheduleBatchProcessing();

            // 返回批量處理承諾
            return new Promise((resolve, reject) => {
                syncTask._resolve = resolve;
                syncTask._reject = reject;
            });

        } catch (error) {
            console.error('[BatchSync] 批量同步失敗:', error);
            throw error;
        }
    }

    /**
     * 強制執行當前批次
     * @returns {Promise<object>} 批次處理結果
     */
    async flush() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        return await this._processBatch();
    }

    /**
     * 獲取批量統計信息
     */
    getStatistics() {
        return {
            ...this.stats,
            pendingChanges: this.pendingChanges.size,
            processing: this.processing
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        // 處理剩餘的批量變更
        if (this.pendingChanges.size > 0) {
            console.log(`[BatchSync] 處理剩餘的 ${this.pendingChanges.size} 個變更...`);
            await this._processBatch();
        }

        // 清理計時器
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        this.pendingChanges.clear();
        this.processing = false;

        console.log('[BatchSync] 清理完成');
    }

    // ========== 私有方法 ==========

    /**
     * 添加到批次
     */
    _addToBatch(syncTask, context) {
        const changeKey = this._generateChangeKey(syncTask);

        // 檢查是否需要合併相似變更
        if (this.options.mergeSimilar && this.pendingChanges.has(changeKey)) {
            const existing = this.pendingChanges.get(changeKey);
            const merged = this._mergeChanges(existing, { syncTask, context });
            this.pendingChanges.set(changeKey, merged);
            this.stats.mergedChanges++;
        } else {
            this.pendingChanges.set(changeKey, {
                syncTask,
                context,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 生成變更鍵
     */
    _generateChangeKey(syncTask) {
        // 基於源和目標類型生成唯一鍵
        return `${syncTask.sourceType || 'unknown'}_${syncTask.targetType || 'unknown'}`;
    }

    /**
     * 合併相似變更
     */
    _mergeChanges(existing, newChange) {
        return {
            syncTask: {
                ...existing.syncTask,
                ...newChange.syncTask,
                // 保留最新的時間戳
                timestamp: Math.max(existing.timestamp, newChange.context.timestamp || 0)
            },
            context: {
                ...existing.context,
                ...newChange.context
            },
            timestamp: Math.max(existing.timestamp, newChange.timestamp || Date.now()),
            merged: true
        };
    }

    /**
     * 安排批量處理
     */
    _scheduleBatchProcessing() {
        // 如果已經在處理中，不重複安排
        if (this.processing) {
            return;
        }

        // 如果達到最大批量大小，立即處理
        if (this.pendingChanges.size >= this.options.maxBatchSize) {
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }
            this._processBatch();
            return;
        }

        // 如果計時器已存在，不重複設置
        if (this.batchTimer) {
            return;
        }

        // 設置批量處理計時器
        this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            this._processBatch();
        }, this.options.batchInterval);
    }

    /**
     * 處理批次
     */
    async _processBatch() {
        if (this.processing || this.pendingChanges.size === 0) {
            return { processed: 0, success: true };
        }

        this.processing = true;
        const startTime = Date.now();
        const batchChanges = Array.from(this.pendingChanges.values());
        const batchSize = batchChanges.length;

        console.log(`[BatchSync] 開始處理批次: ${batchSize} 個變更`);

        try {
            // 清空待處理變更
            this.pendingChanges.clear();

            // 按時間戳排序變更
            batchChanges.sort((a, b) => a.timestamp - b.timestamp);

            // 過濾過期變更
            const validChanges = batchChanges.filter(change => {
                const age = Date.now() - change.timestamp;
                return age <= this.options.maxWaitTime;
            });

            if (validChanges.length !== batchChanges.length) {
                console.warn(`[BatchSync] 過濾了 ${batchChanges.length - validChanges.length} 個過期變更`);
            }

            // 執行批次處理
            const results = await this._executeBatchSync(validChanges);

            // 更新統計
            this._updateBatchStats(batchSize, Date.now() - startTime);

            // 通知完成
            const batchResult = {
                success: true,
                processed: validChanges.length,
                filtered: batchChanges.length - validChanges.length,
                results,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            // 解析所有承諾
            for (let i = 0; i < validChanges.length; i++) {
                const change = validChanges[i];
                const result = results[i];

                if (change.syncTask._resolve) {
                    change.syncTask._resolve(result);
                }
            }

            this.emit('batchCompleted', batchResult);
            return batchResult;

        } catch (error) {
            console.error('[BatchSync] 批次處理失敗:', error);

            // 拒絕所有承諾
            for (const change of batchChanges) {
                if (change.syncTask._reject) {
                    change.syncTask._reject(error);
                }
            }

            this.emit('batchFailed', {
                error: error.message,
                batchSize,
                timestamp: new Date().toISOString()
            });

            throw error;

        } finally {
            this.processing = false;

            // 如果有新的變更加入，繼續處理
            if (this.pendingChanges.size > 0) {
                this._scheduleBatchProcessing();
            }
        }
    }

    /**
     * 執行批次同步
     */
    async _executeBatchSync(validChanges) {
        const results = [];

        // 按類型分組變更
        const changeGroups = this._groupChangesByType(validChanges);

        for (const [groupType, changes] of changeGroups) {
            try {
                console.log(`[BatchSync] 處理 ${groupType} 組: ${changes.length} 個變更`);

                // 並行處理同類型變更
                const groupResults = await Promise.allSettled(
                    changes.map(change => this._processSingleChange(change))
                );

                // 收集結果
                for (let i = 0; i < groupResults.length; i++) {
                    const promiseResult = groupResults[i];

                    if (promiseResult.status === 'fulfilled') {
                        results.push({
                            success: true,
                            groupType,
                            changeIndex: i,
                            result: promiseResult.value
                        });
                    } else {
                        results.push({
                            success: false,
                            groupType,
                            changeIndex: i,
                            error: promiseResult.reason.message
                        });
                    }
                }

            } catch (error) {
                console.error(`[BatchSync] 處理 ${groupType} 組失敗:`, error);

                // 為該組的所有變更添加失敗結果
                for (let i = 0; i < changes.length; i++) {
                    results.push({
                        success: false,
                        groupType,
                        changeIndex: i,
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * 按類型分組變更
     */
    _groupChangesByType(changes) {
        const groups = new Map();

        for (const change of changes) {
            const groupKey = `${change.syncTask.sourceType}_${change.syncTask.targetType}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }

            groups.get(groupKey).push(change);
        }

        return groups;
    }

    /**
     * 處理單個變更
     */
    async _processSingleChange(change) {
        const { syncTask, context } = change;

        // 執行狀態同步邏輯
        const { sourceState, targetState, stateStore } = context;

        if (!stateStore) {
            throw new Error('缺少狀態存儲上下文');
        }

        // 合併狀態
        const mergedState = this._mergeStates(sourceState || {}, targetState || {});

        // 保存狀態
        const stateId = await stateStore.saveState(
            syncTask.targetType || 'batch_sync',
            mergedState,
            {
                syncType: 'batch',
                sourceType: syncTask.sourceType,
                batchTimestamp: new Date().toISOString(),
                merged: change.merged || false
            }
        );

        return {
            stateId,
            operation: 'batch_merge',
            mergedFields: Object.keys(mergedState).length
        };
    }

    /**
     * 合併狀態
     */
    _mergeStates(sourceState, targetState) {
        // 深度合併狀態
        const merged = { ...targetState };

        for (const [key, value] of Object.entries(sourceState)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (merged[key] && typeof merged[key] === 'object') {
                    merged[key] = this._mergeStates(value, merged[key]);
                } else {
                    merged[key] = { ...value };
                }
            } else {
                merged[key] = value;
            }
        }

        return merged;
    }

    /**
     * 更新批次統計
     */
    _updateBatchStats(batchSize, processingTime) {
        this.stats.totalBatches++;
        this.stats.totalChanges += batchSize;

        // 更新平均批次大小
        this.stats.averageBatchSize = this.stats.totalChanges / this.stats.totalBatches;

        // 更新平均處理時間
        this.stats.averageProcessTime = (
            (this.stats.averageProcessTime * (this.stats.totalBatches - 1) + processingTime) /
            this.stats.totalBatches
        );
    }
}

module.exports = BatchSync;