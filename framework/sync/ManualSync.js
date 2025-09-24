/**
 * ManualSync - 手動同步策略
 *
 * 功能：
 * - 通過命令觸發同步
 * - 適用於敏感操作
 * - 最大用戶控制度
 * - 支持互動式確認
 *
 * 用途：為敏感操作提供用戶控制的同步機制
 * 配合：與StateSynchronizer和CommandRouter配合實現手動觸發
 */

import { EventEmitter } from 'events';

/**
 * 手動同步策略
 */
class ManualSync extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            requireConfirmation: true,     // 需要確認
            showPreview: true,             // 顯示預覽
            allowBulkOperations: false,    // 允許批量操作
            timeout: 30000,                // 用戶確認超時時間（30秒）
            ...options
        };

        this.pendingOperations = new Map(); // 待確認的操作
        this.operationHistory = [];         // 操作歷史

        // 統計信息
        this.stats = {
            totalRequests: 0,
            confirmedOperations: 0,
            cancelledOperations: 0,
            timeoutOperations: 0,
            averageResponseTime: 0
        };
    }

    /**
     * 執行手動同步
     * @param {object} syncTask 同步任務
     * @param {object} context 執行上下文
     * @returns {Promise<object>} 同步結果
     */
    async execute(syncTask, context = {}) {
        const operationId = this._generateOperationId();
        const startTime = Date.now();

        try {
            console.log(`[ManualSync] 請求手動同步: ${operationId}`);

            // 創建操作記錄
            const operation = {
                id: operationId,
                syncTask,
                context,
                status: 'pending',
                requestTime: startTime,
                preview: null
            };

            // 生成同步預覽
            if (this.options.showPreview) {
                operation.preview = await this._generatePreview(syncTask, context);
            }

            // 添加到待確認操作
            this.pendingOperations.set(operationId, operation);
            this.stats.totalRequests++;

            // 發送確認請求
            this.emit('confirmationRequired', {
                operationId,
                syncTask,
                preview: operation.preview,
                requireConfirmation: this.options.requireConfirmation
            });

            // 等待用戶確認
            const result = await this._waitForConfirmation(operationId);

            // 更新統計
            const responseTime = Date.now() - startTime;
            this._updateStats(result.action, responseTime);

            return result;

        } catch (error) {
            console.error(`[ManualSync] 手動同步失敗 [${operationId}]:`, error);

            // 清理待確認操作
            this.pendingOperations.delete(operationId);

            return {
                success: false,
                operationId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 確認操作
     * @param {string} operationId 操作ID
     * @param {object} options 確認選項
     */
    async confirmOperation(operationId, options = {}) {
        const operation = this.pendingOperations.get(operationId);

        if (!operation) {
            throw new Error(`操作不存在: ${operationId}`);
        }

        if (operation.status !== 'pending') {
            throw new Error(`操作已處理: ${operationId} (狀態: ${operation.status})`);
        }

        try {
            console.log(`[ManualSync] 確認執行操作: ${operationId}`);

            operation.status = 'confirmed';
            operation.confirmTime = Date.now();
            operation.options = options;

            // 執行同步操作
            const syncResult = await this._performManualSync(operation);

            operation.status = 'completed';
            operation.result = syncResult;

            // 記錄操作歷史
            this._recordOperationHistory(operation, 'confirmed');

            // 清理待確認操作
            this.pendingOperations.delete(operationId);

            this.emit('operationCompleted', {
                operationId,
                result: syncResult,
                responseTime: operation.confirmTime - operation.requestTime
            });

            return {
                success: true,
                operationId,
                result: syncResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[ManualSync] 執行操作失敗 [${operationId}]:`, error);

            operation.status = 'failed';
            operation.error = error.message;

            this._recordOperationHistory(operation, 'failed');
            this.pendingOperations.delete(operationId);

            throw error;
        }
    }

    /**
     * 取消操作
     * @param {string} operationId 操作ID
     * @param {string} reason 取消原因
     */
    async cancelOperation(operationId, reason = '用戶取消') {
        const operation = this.pendingOperations.get(operationId);

        if (!operation) {
            throw new Error(`操作不存在: ${operationId}`);
        }

        if (operation.status !== 'pending') {
            throw new Error(`操作已處理: ${operationId} (狀態: ${operation.status})`);
        }

        console.log(`[ManualSync] 取消操作: ${operationId} (原因: ${reason})`);

        operation.status = 'cancelled';
        operation.cancelReason = reason;
        operation.cancelTime = Date.now();

        // 記錄操作歷史
        this._recordOperationHistory(operation, 'cancelled');

        // 清理待確認操作
        this.pendingOperations.delete(operationId);

        this.emit('operationCancelled', {
            operationId,
            reason,
            responseTime: operation.cancelTime - operation.requestTime
        });

        return {
            success: true,
            operationId,
            action: 'cancelled',
            reason,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 獲取待確認操作列表
     */
    getPendingOperations() {
        const pending = [];

        for (const [id, operation] of this.pendingOperations) {
            pending.push({
                id,
                syncTask: operation.syncTask,
                preview: operation.preview,
                requestTime: operation.requestTime,
                age: Date.now() - operation.requestTime
            });
        }

        return pending.sort((a, b) => a.requestTime - b.requestTime);
    }

    /**
     * 獲取操作歷史
     * @param {number} limit 返回數量限制
     */
    getOperationHistory(limit = 50) {
        return this.operationHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * 獲取統計信息
     */
    getStatistics() {
        return {
            ...this.stats,
            pendingOperations: this.pendingOperations.size,
            historySize: this.operationHistory.length
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        // 取消所有待確認操作
        const pendingOps = Array.from(this.pendingOperations.keys());

        for (const operationId of pendingOps) {
            try {
                await this.cancelOperation(operationId, '系統清理');
            } catch (error) {
                console.warn(`[ManualSync] 清理操作失敗 [${operationId}]:`, error);
            }
        }

        this.pendingOperations.clear();
        console.log('[ManualSync] 清理完成');
    }

    // ========== 私有方法 ==========

    /**
     * 生成操作ID
     */
    _generateOperationId() {
        return `manual_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }

    /**
     * 生成同步預覽
     */
    async _generatePreview(syncTask, context) {
        try {
            const { sourceState, targetState, stateStore } = context;

            if (!sourceState || !targetState) {
                return {
                    message: '無法生成預覽：狀態數據不足',
                    available: false
                };
            }

            // 計算差異
            const differences = await this._calculateDifferences(sourceState, targetState);

            // 預測合併結果
            const mergedState = this._mergeStates(sourceState, targetState);

            return {
                available: true,
                sourceType: syncTask.sourceType,
                targetType: syncTask.targetType,
                differences: {
                    added: Object.keys(differences.added).length,
                    removed: Object.keys(differences.removed).length,
                    modified: Object.keys(differences.modified).length,
                    details: differences
                },
                mergedState: {
                    totalFields: Object.keys(mergedState).length,
                    preview: this._createStatePreview(mergedState)
                },
                riskLevel: this._assessRiskLevel(differences),
                recommendations: this._generateRecommendations(differences)
            };

        } catch (error) {
            console.warn('[ManualSync] 生成預覽失敗:', error);
            return {
                message: '無法生成預覽：' + error.message,
                available: false
            };
        }
    }

    /**
     * 計算狀態差異
     */
    async _calculateDifferences(sourceState, targetState) {
        const differences = {
            added: {},
            removed: {},
            modified: {}
        };

        const sourceKeys = Object.keys(sourceState);
        const targetKeys = Object.keys(targetState);

        // 檢查新增字段
        for (const key of sourceKeys) {
            if (!targetKeys.includes(key)) {
                differences.added[key] = sourceState[key];
            } else if (JSON.stringify(sourceState[key]) !== JSON.stringify(targetState[key])) {
                differences.modified[key] = {
                    from: targetState[key],
                    to: sourceState[key]
                };
            }
        }

        // 檢查移除字段
        for (const key of targetKeys) {
            if (!sourceKeys.includes(key)) {
                differences.removed[key] = targetState[key];
            }
        }

        return differences;
    }

    /**
     * 創建狀態預覽
     */
    _createStatePreview(state, maxDepth = 2, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            return typeof state === 'object' ? '...' : state;
        }

        if (Array.isArray(state)) {
            return state.slice(0, 3).map(item =>
                this._createStatePreview(item, maxDepth, currentDepth + 1)
            );
        }

        if (typeof state === 'object' && state !== null) {
            const preview = {};
            const keys = Object.keys(state).slice(0, 5); // 限制顯示前5個鍵

            for (const key of keys) {
                preview[key] = this._createStatePreview(state[key], maxDepth, currentDepth + 1);
            }

            if (Object.keys(state).length > 5) {
                preview['...'] = `(${Object.keys(state).length - 5} more fields)`;
            }

            return preview;
        }

        return state;
    }

    /**
     * 評估風險等級
     */
    _assessRiskLevel(differences) {
        const addedCount = Object.keys(differences.added).length;
        const removedCount = Object.keys(differences.removed).length;
        const modifiedCount = Object.keys(differences.modified).length;

        const totalChanges = addedCount + removedCount + modifiedCount;

        if (totalChanges === 0) return 'none';
        if (totalChanges <= 5 && removedCount === 0) return 'low';
        if (totalChanges <= 15 || removedCount <= 3) return 'medium';
        return 'high';
    }

    /**
     * 生成建議
     */
    _generateRecommendations(differences) {
        const recommendations = [];

        if (Object.keys(differences.removed).length > 0) {
            recommendations.push({
                type: 'warning',
                message: `將移除 ${Object.keys(differences.removed).length} 個字段，請確認這些字段不再需要`
            });
        }

        if (Object.keys(differences.modified).length > 10) {
            recommendations.push({
                type: 'caution',
                message: '大量字段將被修改，建議先備份當前狀態'
            });
        }

        if (Object.keys(differences.added).length > 0) {
            recommendations.push({
                type: 'info',
                message: `將添加 ${Object.keys(differences.added).length} 個新字段`
            });
        }

        return recommendations;
    }

    /**
     * 等待用戶確認
     */
    async _waitForConfirmation(operationId) {
        return new Promise((resolve) => {
            // 設置超時
            const timeout = setTimeout(() => {
                const operation = this.pendingOperations.get(operationId);
                if (operation && operation.status === 'pending') {
                    operation.status = 'timeout';
                    this._recordOperationHistory(operation, 'timeout');
                    this.pendingOperations.delete(operationId);

                    this.emit('operationTimeout', { operationId });

                    resolve({
                        success: false,
                        operationId,
                        action: 'timeout',
                        message: '用戶確認超時',
                        timestamp: new Date().toISOString()
                    });
                }
            }, this.options.timeout);

            // 監聽操作狀態變化
            const checkStatus = () => {
                const operation = this.pendingOperations.get(operationId);

                if (!operation || operation.status === 'pending') {
                    // 繼續等待
                    setTimeout(checkStatus, 100);
                    return;
                }

                clearTimeout(timeout);

                if (operation.status === 'confirmed') {
                    // 操作已確認，結果將通過 confirmOperation 返回
                    return;
                }

                // 其他狀態（取消、失敗等）
                resolve({
                    success: operation.status !== 'failed',
                    operationId,
                    action: operation.status,
                    error: operation.error,
                    timestamp: new Date().toISOString()
                });
            };

            checkStatus();
        });
    }

    /**
     * 執行手動同步
     */
    async _performManualSync(operation) {
        const { syncTask, context } = operation;
        const { sourceState, targetState, stateStore } = context;

        if (!stateStore) {
            throw new Error('缺少狀態存儲上下文');
        }

        console.log(`[ManualSync] 執行手動同步邏輯: ${operation.id}`);

        // 合併狀態
        const mergedState = this._mergeStates(sourceState || {}, targetState || {});

        // 保存狀態
        const stateId = await stateStore.saveState(
            syncTask.targetType || 'manual_sync',
            mergedState,
            {
                syncType: 'manual',
                sourceType: syncTask.sourceType,
                operationId: operation.id,
                userConfirmed: true,
                timestamp: new Date().toISOString()
            }
        );

        return {
            stateId,
            operation: 'manual_merge',
            mergedFields: Object.keys(mergedState).length,
            userConfirmed: true
        };
    }

    /**
     * 合併狀態
     */
    _mergeStates(sourceState, targetState) {
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
     * 記錄操作歷史
     */
    _recordOperationHistory(operation, action) {
        const historyRecord = {
            operationId: operation.id,
            action,
            syncTask: {
                sourceType: operation.syncTask.sourceType,
                targetType: operation.syncTask.targetType
            },
            requestTime: operation.requestTime,
            responseTime: Date.now(),
            duration: Date.now() - operation.requestTime,
            timestamp: Date.now()
        };

        if (operation.error) {
            historyRecord.error = operation.error;
        }

        if (operation.result) {
            historyRecord.success = true;
            historyRecord.stateId = operation.result.stateId;
        }

        this.operationHistory.push(historyRecord);

        // 限制歷史記錄數量
        if (this.operationHistory.length > 1000) {
            this.operationHistory = this.operationHistory.slice(-1000);
        }
    }

    /**
     * 更新統計信息
     */
    _updateStats(action, responseTime) {
        switch (action) {
            case 'confirmed':
                this.stats.confirmedOperations++;
                break;
            case 'cancelled':
                this.stats.cancelledOperations++;
                break;
            case 'timeout':
                this.stats.timeoutOperations++;
                break;
        }

        // 更新平均響應時間
        const totalResponses = this.stats.confirmedOperations +
                              this.stats.cancelledOperations +
                              this.stats.timeoutOperations;

        if (totalResponses > 0) {
            this.stats.averageResponseTime = (
                (this.stats.averageResponseTime * (totalResponses - 1) + responseTime) /
                totalResponses
            );
        }
    }
}

export default ManualSync;