/**
 * ImmediateSync - 即時同步策略
 *
 * 功能：
 * - 檔案變化後立即同步
 * - 適用於關鍵配置文件
 * - 同步延遲 < 100ms
 * - 高優先級處理
 *
 * 用途：為關鍵檔案提供即時狀態同步
 * 配合：與StateSynchronizer配合實現即時響應
 */

const { EventEmitter } = require('events');

/**
 * 即時同步策略
 */
class ImmediateSync extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            maxLatency: 100, // 最大同步延遲（毫秒）
            maxConcurrency: 10, // 最大併發同步數
            timeout: 5000, // 同步超時時間
            retryDelay: 50, // 重試延遲
            ...options
        };

        this.activeSyncs = new Map(); // 活動同步任務
        this.syncQueue = []; // 同步佇列
        this.processing = false; // 處理標記

        // 性能統計
        this.stats = {
            totalSyncs: 0,
            averageLatency: 0,
            maxLatency: 0,
            timeouts: 0,
            errors: 0
        };
    }

    /**
     * 執行即時同步
     * @param {object} syncTask 同步任務
     * @param {object} context 執行上下文
     * @returns {Promise<object>} 同步結果
     */
    async execute(syncTask, context = {}) {
        const startTime = Date.now();
        const taskId = `immediate_${startTime}_${Math.random().toString(36).substr(2, 6)}`;

        try {
            // 檢查併發限制
            if (this.activeSyncs.size >= this.options.maxConcurrency) {
                // 加入佇列等待處理
                return await this._queueTask(syncTask, context);
            }

            // 立即執行同步
            const result = await this._performSync(taskId, syncTask, context);

            // 更新統計
            this._updateStats(Date.now() - startTime, true);

            return {
                success: true,
                strategy: 'immediate',
                taskId,
                latency: Date.now() - startTime,
                result,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this._updateStats(Date.now() - startTime, false);

            console.error(`[ImmediateSync] 即時同步失敗 [${taskId}]:`, error);

            return {
                success: false,
                strategy: 'immediate',
                taskId,
                error: error.message,
                latency: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 批量即時同步
     * @param {Array} syncTasks 同步任務列表
     * @param {object} context 執行上下文
     * @returns {Promise<Array>} 同步結果列表
     */
    async executeBatch(syncTasks, context = {}) {
        const startTime = Date.now();
        const results = [];

        try {
            // 並行執行所有任務
            const promises = syncTasks.map(task => this.execute(task, context));
            const batchResults = await Promise.allSettled(promises);

            for (let i = 0; i < batchResults.length; i++) {
                const promiseResult = batchResults[i];

                if (promiseResult.status === 'fulfilled') {
                    results.push(promiseResult.value);
                } else {
                    results.push({
                        success: false,
                        strategy: 'immediate',
                        taskIndex: i,
                        error: promiseResult.reason.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            const totalLatency = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;

            this.emit('batchCompleted', {
                total: syncTasks.length,
                successful: successCount,
                failed: syncTasks.length - successCount,
                totalLatency,
                averageLatency: totalLatency / syncTasks.length
            });

            return results;

        } catch (error) {
            console.error('[ImmediateSync] 批量即時同步失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取性能統計
     */
    getStatistics() {
        return {
            ...this.stats,
            activeSyncs: this.activeSyncs.size,
            queueSize: this.syncQueue.length,
            processing: this.processing
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        // 等待所有活動同步完成
        if (this.activeSyncs.size > 0) {
            console.log(`[ImmediateSync] 等待 ${this.activeSyncs.size} 個同步任務完成...`);

            await Promise.allSettled(Array.from(this.activeSyncs.values()));
        }

        // 清空佇列
        this.syncQueue = [];
        this.activeSyncs.clear();
        this.processing = false;

        console.log('[ImmediateSync] 清理完成');
    }

    // ========== 私有方法 ==========

    /**
     * 執行同步任務
     */
    async _performSync(taskId, syncTask, context) {
        const syncPromise = this._executeSyncLogic(syncTask, context);

        // 添加到活動同步映射
        this.activeSyncs.set(taskId, syncPromise);

        try {
            // 設置超時
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('同步超時')), this.options.timeout);
            });

            const result = await Promise.race([syncPromise, timeoutPromise]);

            return result;

        } catch (error) {
            if (error.message === '同步超時') {
                this.stats.timeouts++;
            }
            throw error;

        } finally {
            // 從活動同步中移除
            this.activeSyncs.delete(taskId);

            // 處理佇列中的任務
            this._processQueue();
        }
    }

    /**
     * 執行同步邏輯
     */
    async _executeSyncLogic(syncTask, context) {
        const { sourceState, targetState, stateStore } = context;

        if (!sourceState || !targetState || !stateStore) {
            throw new Error('缺少必要的同步上下文');
        }

        // 執行狀態合併
        const mergedState = this._mergeStates(sourceState, targetState);

        // 保存合併後的狀態
        const stateId = await stateStore.saveState(
            syncTask.targetType || 'immediate_sync',
            mergedState,
            {
                syncType: 'immediate',
                sourceType: syncTask.sourceType,
                timestamp: new Date().toISOString()
            }
        );

        return {
            stateId,
            mergedState: Object.keys(mergedState).length,
            operation: 'merge'
        };
    }

    /**
     * 合併狀態
     */
    _mergeStates(sourceState, targetState) {
        // 簡單的深度合併實現
        const merged = { ...targetState };

        for (const [key, value] of Object.entries(sourceState)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (merged[key] && typeof merged[key] === 'object') {
                    merged[key] = this._mergeStates(value, merged[key]);
                } else {
                    merged[key] = value;
                }
            } else {
                merged[key] = value;
            }
        }

        return merged;
    }

    /**
     * 任務入佇列
     */
    async _queueTask(syncTask, context) {
        return new Promise((resolve, reject) => {
            const queuedTask = {
                syncTask,
                context,
                resolve,
                reject,
                timestamp: Date.now()
            };

            this.syncQueue.push(queuedTask);

            // 如果佇列過長，拒絕新任務
            if (this.syncQueue.length > 100) {
                this.syncQueue.shift(); // 移除最舊的任務
                reject(new Error('即時同步佇列已滿'));
            }
        });
    }

    /**
     * 處理佇列
     */
    _processQueue() {
        if (this.processing || this.syncQueue.length === 0) {
            return;
        }

        if (this.activeSyncs.size >= this.options.maxConcurrency) {
            return;
        }

        this.processing = true;

        // 處理佇列中的任務
        while (this.syncQueue.length > 0 && this.activeSyncs.size < this.options.maxConcurrency) {
            const queuedTask = this.syncQueue.shift();

            // 檢查任務是否已過期
            const age = Date.now() - queuedTask.timestamp;
            if (age > this.options.timeout) {
                queuedTask.reject(new Error('佇列任務已過期'));
                continue;
            }

            // 異步執行任務
            this.execute(queuedTask.syncTask, queuedTask.context)
                .then(queuedTask.resolve)
                .catch(queuedTask.reject);
        }

        this.processing = false;
    }

    /**
     * 更新統計信息
     */
    _updateStats(latency, success) {
        this.stats.totalSyncs++;

        if (success) {
            // 更新平均延遲
            this.stats.averageLatency = (
                (this.stats.averageLatency * (this.stats.totalSyncs - 1) + latency) /
                this.stats.totalSyncs
            );

            // 更新最大延遲
            if (latency > this.stats.maxLatency) {
                this.stats.maxLatency = latency;
            }

            // 檢查是否超過最大延遲限制
            if (latency > this.options.maxLatency) {
                console.warn(`[ImmediateSync] 同步延遲超過限制: ${latency}ms > ${this.options.maxLatency}ms`);
            }
        } else {
            this.stats.errors++;
        }
    }
}

module.exports = ImmediateSync;