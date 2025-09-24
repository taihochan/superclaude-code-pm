/**
 * ScheduledSync - 定時同步策略
 *
 * 功能：
 * - 按固定間隔執行同步
 * - 適用於非關鍵狀態
 * - 最小化系統開銷
 * - 支持靈活的定時配置
 *
 * 用途：為非關鍵狀態提供定期同步
 * 配合：與StateSynchronizer配合減少系統負載
 */

const { EventEmitter } = require('events');

/**
 * 定時同步策略
 */
class ScheduledSync extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            defaultInterval: 5 * 60 * 1000, // 預設5分鐘間隔
            maxInterval: 60 * 60 * 1000,    // 最大1小時間隔
            minInterval: 30 * 1000,         // 最小30秒間隔
            executeOnStart: false,          // 啟動時是否立即執行
            skipIfNoChanges: true,          // 無變化時跳過同步
            ...options
        };

        this.schedules = new Map();    // 定時任務映射
        this.lastSyncTimes = new Map(); // 最後同步時間
        this.running = false;          // 運行狀態

        // 統計信息
        this.stats = {
            totalSchedules: 0,
            totalExecutions: 0,
            skippedExecutions: 0,
            averageExecutionTime: 0,
            lastExecutionTime: null
        };
    }

    /**
     * 執行定時同步
     * @param {object} syncTask 同步任務
     * @param {object} context 執行上下文
     * @returns {Promise<object>} 同步結果
     */
    async execute(syncTask, context = {}) {
        const scheduleId = this._generateScheduleId(syncTask);

        try {
            // 如果已存在相同的定時任務，則更新
            if (this.schedules.has(scheduleId)) {
                return await this._updateSchedule(scheduleId, syncTask, context);
            }

            // 創建新的定時任務
            return await this._createSchedule(scheduleId, syncTask, context);

        } catch (error) {
            console.error(`[ScheduledSync] 定時同步失敗 [${scheduleId}]:`, error);
            throw error;
        }
    }

    /**
     * 添加定時同步任務
     * @param {string} name 任務名稱
     * @param {object} syncTask 同步任務
     * @param {object} options 定時選項
     */
    async addSchedule(name, syncTask, options = {}) {
        const scheduleOptions = {
            interval: this.options.defaultInterval,
            enabled: true,
            ...options
        };

        // 驗證間隔時間
        if (scheduleOptions.interval < this.options.minInterval) {
            scheduleOptions.interval = this.options.minInterval;
            console.warn(`[ScheduledSync] 間隔時間過短，調整為最小值: ${this.options.minInterval}ms`);
        }

        if (scheduleOptions.interval > this.options.maxInterval) {
            scheduleOptions.interval = this.options.maxInterval;
            console.warn(`[ScheduledSync] 間隔時間過長，調整為最大值: ${this.options.maxInterval}ms`);
        }

        const schedule = {
            id: name,
            syncTask,
            options: scheduleOptions,
            timer: null,
            nextExecution: null,
            created: Date.now()
        };

        this.schedules.set(name, schedule);
        this.stats.totalSchedules++;

        // 啟動定時任務
        if (scheduleOptions.enabled) {
            this._startSchedule(schedule);
        }

        console.log(`[ScheduledSync] 已添加定時同步: ${name} (間隔: ${scheduleOptions.interval}ms)`);

        return {
            success: true,
            scheduleId: name,
            nextExecution: schedule.nextExecution,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 移除定時同步任務
     * @param {string} name 任務名稱
     */
    async removeSchedule(name) {
        const schedule = this.schedules.get(name);

        if (!schedule) {
            console.warn(`[ScheduledSync] 定時任務不存在: ${name}`);
            return false;
        }

        // 停止定時器
        if (schedule.timer) {
            clearTimeout(schedule.timer);
        }

        this.schedules.delete(name);
        console.log(`[ScheduledSync] 已移除定時同步: ${name}`);

        return true;
    }

    /**
     * 啟動所有定時同步
     */
    async start() {
        if (this.running) {
            console.log('[ScheduledSync] 定時同步已在運行中');
            return;
        }

        this.running = true;

        // 啟動所有啟用的定時任務
        for (const schedule of this.schedules.values()) {
            if (schedule.options.enabled) {
                this._startSchedule(schedule);
            }
        }

        console.log(`[ScheduledSync] 已啟動 ${this.schedules.size} 個定時同步任務`);
        this.emit('started');
    }

    /**
     * 停止所有定時同步
     */
    async stop() {
        if (!this.running) {
            console.log('[ScheduledSync] 定時同步已停止');
            return;
        }

        this.running = false;

        // 停止所有定時器
        for (const schedule of this.schedules.values()) {
            if (schedule.timer) {
                clearTimeout(schedule.timer);
                schedule.timer = null;
            }
        }

        console.log('[ScheduledSync] 已停止所有定時同步任務');
        this.emit('stopped');
    }

    /**
     * 立即執行指定的定時同步
     * @param {string} name 任務名稱
     */
    async executeNow(name) {
        const schedule = this.schedules.get(name);

        if (!schedule) {
            throw new Error(`定時任務不存在: ${name}`);
        }

        console.log(`[ScheduledSync] 立即執行定時同步: ${name}`);

        return await this._executeSchedule(schedule, true);
    }

    /**
     * 獲取定時同步狀態
     */
    getScheduleStatus() {
        const schedules = [];

        for (const [id, schedule] of this.schedules) {
            schedules.push({
                id,
                enabled: schedule.options.enabled,
                interval: schedule.options.interval,
                nextExecution: schedule.nextExecution,
                lastExecution: this.lastSyncTimes.get(id),
                created: schedule.created
            });
        }

        return {
            running: this.running,
            totalSchedules: this.schedules.size,
            schedules,
            stats: { ...this.stats }
        };
    }

    /**
     * 清理資源
     */
    async cleanup() {
        await this.stop();
        this.schedules.clear();
        this.lastSyncTimes.clear();

        console.log('[ScheduledSync] 清理完成');
    }

    // ========== 私有方法 ==========

    /**
     * 生成定時任務ID
     */
    _generateScheduleId(syncTask) {
        return `scheduled_${syncTask.sourceType || 'unknown'}_${syncTask.targetType || 'unknown'}`;
    }

    /**
     * 創建定時任務
     */
    async _createSchedule(scheduleId, syncTask, context) {
        const interval = context.interval || this.options.defaultInterval;

        const schedule = {
            id: scheduleId,
            syncTask,
            context,
            options: {
                interval,
                enabled: true,
                ...context.options
            },
            timer: null,
            nextExecution: null,
            created: Date.now()
        };

        this.schedules.set(scheduleId, schedule);
        this.stats.totalSchedules++;

        if (this.running) {
            this._startSchedule(schedule);
        }

        return {
            success: true,
            scheduleId,
            interval,
            nextExecution: schedule.nextExecution,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 更新定時任務
     */
    async _updateSchedule(scheduleId, syncTask, context) {
        const schedule = this.schedules.get(scheduleId);

        // 停止現有定時器
        if (schedule.timer) {
            clearTimeout(schedule.timer);
        }

        // 更新任務配置
        schedule.syncTask = syncTask;
        schedule.context = context;

        const newInterval = context.interval || schedule.options.interval;
        if (newInterval !== schedule.options.interval) {
            schedule.options.interval = newInterval;
            console.log(`[ScheduledSync] 更新定時間隔: ${scheduleId} (${newInterval}ms)`);
        }

        // 重新啟動定時器
        if (this.running && schedule.options.enabled) {
            this._startSchedule(schedule);
        }

        return {
            success: true,
            scheduleId,
            updated: true,
            interval: schedule.options.interval,
            nextExecution: schedule.nextExecution,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 啟動單個定時任務
     */
    _startSchedule(schedule) {
        const executeTime = this.options.executeOnStart ? 0 : schedule.options.interval;
        schedule.nextExecution = new Date(Date.now() + executeTime).toISOString();

        schedule.timer = setTimeout(() => {
            this._executeSchedule(schedule);
        }, executeTime);

        console.log(`[ScheduledSync] 已啟動定時任務: ${schedule.id} (下次執行: ${schedule.nextExecution})`);
    }

    /**
     * 執行定時任務
     */
    async _executeSchedule(schedule, isManual = false) {
        const startTime = Date.now();

        try {
            console.log(`[ScheduledSync] 執行定時同步: ${schedule.id} ${isManual ? '(手動)' : '(自動)'}`);

            // 檢查是否需要跳過（無變化時）
            if (this.options.skipIfNoChanges && !isManual) {
                const hasChanges = await this._checkForChanges(schedule);
                if (!hasChanges) {
                    console.log(`[ScheduledSync] 跳過同步 (無變化): ${schedule.id}`);
                    this.stats.skippedExecutions++;
                    this._scheduleNext(schedule);
                    return { success: true, skipped: true };
                }
            }

            // 執行同步邏輯
            const result = await this._performScheduledSync(schedule);

            // 更新統計
            const executionTime = Date.now() - startTime;
            this._updateExecutionStats(executionTime);

            // 記錄最後執行時間
            this.lastSyncTimes.set(schedule.id, new Date().toISOString());

            // 安排下次執行
            if (!isManual) {
                this._scheduleNext(schedule);
            }

            this.emit('scheduleExecuted', {
                scheduleId: schedule.id,
                result,
                executionTime,
                isManual
            });

            return {
                success: true,
                result,
                executionTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[ScheduledSync] 定時同步執行失敗 [${schedule.id}]:`, error);

            // 即使失敗也要安排下次執行
            if (!isManual) {
                this._scheduleNext(schedule);
            }

            this.emit('scheduleError', {
                scheduleId: schedule.id,
                error: error.message,
                isManual
            });

            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 檢查是否有變化
     */
    async _checkForChanges(schedule) {
        try {
            const { context } = schedule;
            const { stateStore } = context;

            if (!stateStore) {
                // 無法檢查變化，假設有變化
                return true;
            }

            const targetType = schedule.syncTask.targetType || 'scheduled_sync';
            const lastSyncTime = this.lastSyncTimes.get(schedule.id);

            if (!lastSyncTime) {
                // 首次執行，假設有變化
                return true;
            }

            // 獲取最近的狀態變化
            const stateHistory = await stateStore.getStateHistory(targetType, 5);
            const recentChanges = stateHistory.filter(state =>
                new Date(state.timestamp) > new Date(lastSyncTime)
            );

            return recentChanges.length > 0;

        } catch (error) {
            console.warn(`[ScheduledSync] 檢查變化失敗 [${schedule.id}]:`, error);
            // 出錯時假設有變化
            return true;
        }
    }

    /**
     * 執行定時同步邏輯
     */
    async _performScheduledSync(schedule) {
        const { syncTask, context } = schedule;
        const { sourceState, targetState, stateStore } = context;

        if (!stateStore) {
            throw new Error('缺少狀態存儲上下文');
        }

        // 獲取當前狀態（如果未提供）
        const currentSourceState = sourceState || await stateStore.getLatestState(syncTask.sourceType);
        const currentTargetState = targetState || await stateStore.getLatestState(syncTask.targetType);

        // 合併狀態
        const mergedState = this._mergeStates(
            currentSourceState || {},
            currentTargetState || {}
        );

        // 保存狀態
        const stateId = await stateStore.saveState(
            syncTask.targetType || 'scheduled_sync',
            mergedState,
            {
                syncType: 'scheduled',
                sourceType: syncTask.sourceType,
                scheduleId: schedule.id,
                scheduledTime: new Date().toISOString()
            }
        );

        return {
            stateId,
            operation: 'scheduled_merge',
            mergedFields: Object.keys(mergedState).length
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
     * 安排下次執行
     */
    _scheduleNext(schedule) {
        if (!this.running || !schedule.options.enabled) {
            return;
        }

        const nextTime = Date.now() + schedule.options.interval;
        schedule.nextExecution = new Date(nextTime).toISOString();

        schedule.timer = setTimeout(() => {
            this._executeSchedule(schedule);
        }, schedule.options.interval);
    }

    /**
     * 更新執行統計
     */
    _updateExecutionStats(executionTime) {
        this.stats.totalExecutions++;
        this.stats.lastExecutionTime = new Date().toISOString();

        this.stats.averageExecutionTime = (
            (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) /
            this.stats.totalExecutions
        );
    }
}

module.exports = ScheduledSync;