/**
 * CircuitBreaker - 熔斷器防止級聯故障
 *
 * 功能：
 * - 實現熔斷器模式防止級聯故障
 * - 多種熔斷策略（失敗率、響應時間、併發數）
 * - 自適應恢復和半開狀態
 * - 熔斷事件監控和通知
 * - 熔斷統計和健康檢查
 *
 * 用途：CCPM+SuperClaude整合的故障隔離和系統保護
 * 配合：ErrorHandler錯誤處理、HealthMonitor健康監控
 */

import { EventEmitter } from 'events';

/**
 * 熔斷器狀態
 */
const CIRCUIT_STATES = {
    CLOSED: 'closed',       // 關閉 - 正常運行
    OPEN: 'open',           // 開啟 - 拒絕請求
    HALF_OPEN: 'half_open'  // 半開 - 探測恢復
};

/**
 * 熔斷觸發策略
 */
const TRIP_STRATEGIES = {
    FAILURE_RATE: 'failure_rate',        // 失敗率
    RESPONSE_TIME: 'response_time',      // 響應時間
    CONCURRENT_REQUESTS: 'concurrent',   // 併發請求數
    CONSECUTIVE_FAILURES: 'consecutive', // 連續失敗
    ERROR_PERCENTAGE: 'error_percentage' // 錯誤百分比
};

/**
 * 恢復策略
 */
const RECOVERY_STRATEGIES = {
    TIME_BASED: 'time_based',           // 基於時間
    SUCCESS_BASED: 'success_based',     // 基於成功次數
    ADAPTIVE: 'adaptive',               // 自適應
    EXPONENTIAL: 'exponential'          // 指數退避
};

/**
 * 請求統計窗口
 */
class StatisticsWindow {
    constructor(options = {}) {
        this.size = options.size || 100;
        this.timeWindow = options.timeWindow || 60000; // 1分鐘
        this.buckets = [];
        this.currentBucket = this._createBucket();
        this.buckets.push(this.currentBucket);
    }

    /**
     * 記錄請求結果
     */
    record(success, responseTime = 0, error = null) {
        const now = Date.now();

        // 檢查是否需要新的bucket
        if (now - this.currentBucket.startTime >= this.timeWindow / 10) {
            this._rotateBucket(now);
        }

        this.currentBucket.total++;
        if (success) {
            this.currentBucket.success++;
        } else {
            this.currentBucket.failures++;
            if (error) {
                this.currentBucket.errors.push({
                    error: error.message || error,
                    timestamp: now
                });
            }
        }

        this.currentBucket.totalResponseTime += responseTime;
        this.currentBucket.maxResponseTime = Math.max(this.currentBucket.maxResponseTime, responseTime);
        this.currentBucket.minResponseTime = Math.min(this.currentBucket.minResponseTime, responseTime);
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        const now = Date.now();
        this._cleanOldBuckets(now);

        const stats = {
            total: 0,
            success: 0,
            failures: 0,
            errors: [],
            totalResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Number.MAX_SAFE_INTEGER,
            buckets: this.buckets.length
        };

        for (const bucket of this.buckets) {
            stats.total += bucket.total;
            stats.success += bucket.success;
            stats.failures += bucket.failures;
            stats.errors = stats.errors.concat(bucket.errors.slice(-10)); // 最近10個錯誤
            stats.totalResponseTime += bucket.totalResponseTime;
            stats.maxResponseTime = Math.max(stats.maxResponseTime, bucket.maxResponseTime);
            stats.minResponseTime = Math.min(stats.minResponseTime, bucket.minResponseTime);
        }

        if (stats.minResponseTime === Number.MAX_SAFE_INTEGER) {
            stats.minResponseTime = 0;
        }

        stats.failureRate = stats.total > 0 ? stats.failures / stats.total : 0;
        stats.averageResponseTime = stats.total > 0 ? stats.totalResponseTime / stats.total : 0;
        stats.successRate = stats.total > 0 ? stats.success / stats.total : 0;

        return stats;
    }

    /**
     * 重置統計
     */
    reset() {
        this.buckets = [];
        this.currentBucket = this._createBucket();
        this.buckets.push(this.currentBucket);
    }

    _createBucket() {
        return {
            startTime: Date.now(),
            total: 0,
            success: 0,
            failures: 0,
            errors: [],
            totalResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Number.MAX_SAFE_INTEGER
        };
    }

    _rotateBucket(now) {
        this.currentBucket = this._createBucket();
        this.currentBucket.startTime = now;
        this.buckets.push(this.currentBucket);

        // 限制bucket數量
        if (this.buckets.length > this.size) {
            this.buckets = this.buckets.slice(-this.size);
        }
    }

    _cleanOldBuckets(now) {
        const cutoff = now - this.timeWindow;
        this.buckets = this.buckets.filter(bucket => bucket.startTime >= cutoff);

        if (this.buckets.length === 0) {
            this.currentBucket = this._createBucket();
            this.buckets.push(this.currentBucket);
        }
    }
}

/**
 * 熔斷器實例
 */
class CircuitBreakerInstance extends EventEmitter {
    constructor(name, options = {}) {
        super();

        this.name = name;
        this.state = CIRCUIT_STATES.CLOSED;
        this.options = {
            // 熔斷條件
            failureThreshold: options.failureThreshold || 0.5, // 50%失敗率
            responseTimeThreshold: options.responseTimeThreshold || 5000, // 5秒
            minimumRequests: options.minimumRequests || 10, // 最少請求數
            consecutiveFailures: options.consecutiveFailures || 5, // 連續失敗數

            // 恢復設置
            recoveryTimeout: options.recoveryTimeout || 30000, // 30秒
            recoveryStrategy: options.recoveryStrategy || RECOVERY_STRATEGIES.TIME_BASED,
            halfOpenRequests: options.halfOpenRequests || 3, // 半開狀態測試請求數

            // 統計設置
            statisticsWindow: options.statisticsWindow || 60000, // 1分鐘
            statisticsSize: options.statisticsSize || 100,

            // 熔斷策略
            tripStrategy: options.tripStrategy || TRIP_STRATEGIES.FAILURE_RATE,

            ...options
        };

        // 統計窗口
        this.statistics = new StatisticsWindow({
            size: this.options.statisticsSize,
            timeWindow: this.options.statisticsWindow
        });

        // 狀態追蹤
        this.stateHistory = [];
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.openTime = null;
        this.halfOpenTestCount = 0;
        this.consecutiveFailureCount = 0;

        // 並發追蹤
        this.activeRequests = 0;
        this.maxConcurrentRequests = options.maxConcurrentRequests || 100;

        // 恢復定時器
        this.recoveryTimer = null;
    }

    /**
     * 執行被保護的操作
     * @param {Function} operation 要執行的操作
     * @param {Object} context 執行上下文
     * @returns {Promise} 執行結果
     */
    async execute(operation, context = {}) {
        // 檢查是否允許執行
        if (!this._canExecute()) {
            const error = new Error(`熔斷器開啟: ${this.name}`);
            error.circuitOpen = true;
            error.circuitName = this.name;
            error.circuitState = this.state;
            throw error;
        }

        const startTime = Date.now();
        this.activeRequests++;

        try {
            // 執行操作
            const result = await operation(context);
            const responseTime = Date.now() - startTime;

            // 記錄成功
            this._recordSuccess(responseTime);

            return result;

        } catch (error) {
            const responseTime = Date.now() - startTime;

            // 記錄失敗
            this._recordFailure(error, responseTime);

            throw error;

        } finally {
            this.activeRequests--;
        }
    }

    /**
     * 手動觸發熔斷
     * @param {String} reason 觸發原因
     */
    trip(reason = 'manual') {
        if (this.state !== CIRCUIT_STATES.OPEN) {
            this._changeState(CIRCUIT_STATES.OPEN, reason);
        }
    }

    /**
     * 手動重置熔斷器
     */
    reset() {
        this._changeState(CIRCUIT_STATES.CLOSED, 'manual_reset');
        this.statistics.reset();
        this.consecutiveFailureCount = 0;
        this.halfOpenTestCount = 0;
        this._clearRecoveryTimer();
    }

    /**
     * 強制進入半開狀態
     */
    halfOpen() {
        if (this.state === CIRCUIT_STATES.OPEN) {
            this._changeState(CIRCUIT_STATES.HALF_OPEN, 'manual_half_open');
            this.halfOpenTestCount = 0;
        }
    }

    /**
     * 獲取當前狀態
     */
    getState() {
        return {
            name: this.name,
            state: this.state,
            statistics: this.statistics.getStats(),
            activeRequests: this.activeRequests,
            consecutiveFailures: this.consecutiveFailureCount,
            halfOpenTests: this.halfOpenTestCount,
            lastFailure: this.lastFailureTime,
            lastSuccess: this.lastSuccessTime,
            openSince: this.openTime,
            stateHistory: this.stateHistory.slice(-10) // 最近10個狀態變化
        };
    }

    /**
     * 獲取健康狀態
     */
    getHealthStatus() {
        const stats = this.statistics.getStats();
        const health = {
            healthy: this.state === CIRCUIT_STATES.CLOSED && stats.failureRate < 0.1,
            state: this.state,
            failureRate: stats.failureRate,
            responseTime: stats.averageResponseTime,
            activeRequests: this.activeRequests,
            lastCheck: new Date().toISOString()
        };

        // 健康評分 (0-100)
        let score = 100;
        if (this.state === CIRCUIT_STATES.OPEN) {
            score = 0;
        } else if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            score = 30;
        } else {
            score = Math.max(0, 100 - (stats.failureRate * 100) - (stats.averageResponseTime / 100));
        }

        health.score = Math.round(score);

        return health;
    }

    // ========== 私有方法 ==========

    /**
     * 檢查是否可以執行
     */
    _canExecute() {
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED:
                return this.activeRequests < this.maxConcurrentRequests;

            case CIRCUIT_STATES.OPEN:
                // 檢查是否到了恢復時間
                if (this._shouldAttemptReset()) {
                    this._changeState(CIRCUIT_STATES.HALF_OPEN, 'timeout_recovery');
                    return true;
                }
                return false;

            case CIRCUIT_STATES.HALF_OPEN:
                return this.halfOpenTestCount < this.options.halfOpenRequests;

            default:
                return false;
        }
    }

    /**
     * 記錄成功
     */
    _recordSuccess(responseTime) {
        this.lastSuccessTime = new Date().toISOString();
        this.consecutiveFailureCount = 0;
        this.statistics.record(true, responseTime);

        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this.halfOpenTestCount++;

            // 半開狀態下足夠的成功請求可以關閉熔斷器
            if (this.halfOpenTestCount >= this.options.halfOpenRequests) {
                this._changeState(CIRCUIT_STATES.CLOSED, 'recovery_success');
            }
        }

        this.emit('success', {
            circuitName: this.name,
            responseTime,
            state: this.state
        });
    }

    /**
     * 記錄失敗
     */
    _recordFailure(error, responseTime) {
        this.lastFailureTime = new Date().toISOString();
        this.consecutiveFailureCount++;
        this.statistics.record(false, responseTime, error);

        // 半開狀態下的失敗立即觸發熔斷
        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this._changeState(CIRCUIT_STATES.OPEN, 'half_open_failure');
            return;
        }

        // 檢查是否應該觸發熔斷
        if (this.state === CIRCUIT_STATES.CLOSED && this._shouldTrip()) {
            this._changeState(CIRCUIT_STATES.OPEN, 'threshold_exceeded');
        }

        this.emit('failure', {
            circuitName: this.name,
            error,
            responseTime,
            consecutiveFailures: this.consecutiveFailureCount,
            state: this.state
        });
    }

    /**
     * 檢查是否應該觸發熔斷
     */
    _shouldTrip() {
        const stats = this.statistics.getStats();

        // 最少請求數檢查
        if (stats.total < this.options.minimumRequests) {
            return false;
        }

        switch (this.options.tripStrategy) {
            case TRIP_STRATEGIES.FAILURE_RATE:
                return stats.failureRate >= this.options.failureThreshold;

            case TRIP_STRATEGIES.RESPONSE_TIME:
                return stats.averageResponseTime >= this.options.responseTimeThreshold;

            case TRIP_STRATEGIES.CONSECUTIVE_FAILURES:
                return this.consecutiveFailureCount >= this.options.consecutiveFailures;

            case TRIP_STRATEGIES.ERROR_PERCENTAGE:
                return stats.failureRate >= this.options.failureThreshold;

            case TRIP_STRATEGIES.CONCURRENT_REQUESTS:
                return this.activeRequests >= this.maxConcurrentRequests;

            default:
                return stats.failureRate >= this.options.failureThreshold;
        }
    }

    /**
     * 檢查是否應該嘗試重置
     */
    _shouldAttemptReset() {
        if (!this.openTime) return false;

        const now = Date.now();
        const timeSinceOpen = now - new Date(this.openTime).getTime();

        switch (this.options.recoveryStrategy) {
            case RECOVERY_STRATEGIES.TIME_BASED:
                return timeSinceOpen >= this.options.recoveryTimeout;

            case RECOVERY_STRATEGIES.EXPONENTIAL:
                const attempts = this.stateHistory.filter(h => h.to === CIRCUIT_STATES.OPEN).length;
                const backoff = this.options.recoveryTimeout * Math.pow(2, Math.min(attempts, 10));
                return timeSinceOpen >= backoff;

            case RECOVERY_STRATEGIES.ADAPTIVE:
                // 根據失敗率自適應調整恢復時間
                const stats = this.statistics.getStats();
                const adaptiveTimeout = this.options.recoveryTimeout * (1 + stats.failureRate);
                return timeSinceOpen >= adaptiveTimeout;

            default:
                return timeSinceOpen >= this.options.recoveryTimeout;
        }
    }

    /**
     * 改變狀態
     */
    _changeState(newState, reason) {
        const oldState = this.state;

        if (oldState === newState) return;

        this.state = newState;

        // 記錄狀態歷史
        const stateChange = {
            from: oldState,
            to: newState,
            reason,
            timestamp: new Date().toISOString()
        };

        this.stateHistory.push(stateChange);

        // 限制歷史記錄數量
        if (this.stateHistory.length > 100) {
            this.stateHistory = this.stateHistory.slice(-100);
        }

        // 處理狀態特定邏輯
        switch (newState) {
            case CIRCUIT_STATES.OPEN:
                this.openTime = new Date().toISOString();
                this.halfOpenTestCount = 0;
                this._scheduleRecoveryAttempt();
                break;

            case CIRCUIT_STATES.HALF_OPEN:
                this.halfOpenTestCount = 0;
                this._clearRecoveryTimer();
                break;

            case CIRCUIT_STATES.CLOSED:
                this.openTime = null;
                this.halfOpenTestCount = 0;
                this._clearRecoveryTimer();
                break;
        }

        this.emit('stateChanged', stateChange);
    }

    /**
     * 計劃恢復嘗試
     */
    _scheduleRecoveryAttempt() {
        this._clearRecoveryTimer();

        let timeout = this.options.recoveryTimeout;

        if (this.options.recoveryStrategy === RECOVERY_STRATEGIES.EXPONENTIAL) {
            const attempts = this.stateHistory.filter(h => h.to === CIRCUIT_STATES.OPEN).length;
            timeout = timeout * Math.pow(2, Math.min(attempts, 10));
        }

        this.recoveryTimer = setTimeout(() => {
            if (this.state === CIRCUIT_STATES.OPEN) {
                this._changeState(CIRCUIT_STATES.HALF_OPEN, 'scheduled_recovery');
            }
        }, timeout);
    }

    /**
     * 清除恢復定時器
     */
    _clearRecoveryTimer() {
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
            this.recoveryTimer = null;
        }
    }

    /**
     * 清理資源
     */
    dispose() {
        this._clearRecoveryTimer();
        this.removeAllListeners();
    }
}

/**
 * 熔斷器管理器
 */
class CircuitBreaker extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(1000);

        this.options = {
            // 默認配置
            defaultConfig: {
                failureThreshold: 0.5,
                responseTimeThreshold: 5000,
                minimumRequests: 10,
                recoveryTimeout: 30000,
                halfOpenRequests: 3,
                statisticsWindow: 60000,
                ...options.defaultConfig
            },

            // 全局設置
            maxCircuits: options.maxCircuits || 100,
            enableMetrics: options.enableMetrics !== false,
            enableEvents: options.enableEvents !== false,

            ...options
        };

        // 熔斷器實例
        this.circuits = new Map();

        // 全局統計
        this.globalStats = {
            totalCircuits: 0,
            openCircuits: 0,
            halfOpenCircuits: 0,
            closedCircuits: 0,
            totalExecutions: 0,
            totalFailures: 0,
            lastUpdate: new Date().toISOString()
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化熔斷器管理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 設置統計更新定時器
            if (this.options.enableMetrics) {
                this._setupMetricsCollection();
            }

            // 設置清理定時器
            this._setupCleanupTimer();

            this.initialized = true;
            this.emit('initialized');

            console.log('[CircuitBreaker] 熔斷器管理器已初始化');

        } catch (error) {
            console.error('[CircuitBreaker] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 創建或獲取熔斷器
     * @param {String} name 熔斷器名稱
     * @param {Object} options 配置選項
     * @returns {CircuitBreakerInstance} 熔斷器實例
     */
    getCircuit(name, options = {}) {
        if (this.circuits.has(name)) {
            return this.circuits.get(name);
        }

        if (this.circuits.size >= this.options.maxCircuits) {
            throw new Error(`熔斷器數量已達上限: ${this.options.maxCircuits}`);
        }

        // 合併配置
        const config = {
            ...this.options.defaultConfig,
            ...options
        };

        // 創建新的熔斷器實例
        const circuit = new CircuitBreakerInstance(name, config);

        // 設置事件轉發
        if (this.options.enableEvents) {
            circuit.on('stateChanged', (change) => {
                this.emit('circuitStateChanged', name, change);
            });

            circuit.on('success', (event) => {
                this.emit('circuitSuccess', name, event);
            });

            circuit.on('failure', (event) => {
                this.emit('circuitFailure', name, event);
            });
        }

        this.circuits.set(name, circuit);
        this.globalStats.totalCircuits++;

        this.emit('circuitCreated', name, config);
        console.log(`[CircuitBreaker] 已創建熔斷器: ${name}`);

        return circuit;
    }

    /**
     * 執行被保護的操作
     * @param {String} circuitName 熔斷器名稱
     * @param {Function} operation 操作函數
     * @param {Object} options 選項
     * @returns {Promise} 執行結果
     */
    async execute(circuitName, operation, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const circuit = this.getCircuit(circuitName, options.circuitConfig);

        try {
            this.globalStats.totalExecutions++;
            const result = await circuit.execute(operation, options.context);
            return result;

        } catch (error) {
            this.globalStats.totalFailures++;
            throw error;
        }
    }

    /**
     * 批量執行操作
     * @param {Array} operations 操作列表 [{name, operation, options}]
     * @returns {Promise<Array>} 執行結果列表
     */
    async executeBatch(operations) {
        const promises = operations.map(async (op) => {
            try {
                const result = await this.execute(op.name, op.operation, op.options);
                return { success: true, result, name: op.name };
            } catch (error) {
                return { success: false, error, name: op.name };
            }
        });

        return await Promise.allSettled(promises);
    }

    /**
     * 獲取所有熔斷器狀態
     * @returns {Object} 熔斷器狀態映射
     */
    getAllCircuitStates() {
        const states = {};

        for (const [name, circuit] of this.circuits.entries()) {
            states[name] = circuit.getState();
        }

        return states;
    }

    /**
     * 獲取健康狀況
     * @returns {Object} 健康狀況報告
     */
    getHealthReport() {
        const report = {
            overall: {
                healthy: true,
                score: 100,
                totalCircuits: this.circuits.size,
                openCircuits: 0,
                halfOpenCircuits: 0,
                unhealthyCircuits: []
            },
            circuits: {},
            globalStats: { ...this.globalStats },
            timestamp: new Date().toISOString()
        };

        let totalScore = 0;
        let unhealthyCount = 0;

        for (const [name, circuit] of this.circuits.entries()) {
            const health = circuit.getHealthStatus();
            report.circuits[name] = health;
            totalScore += health.score;

            if (!health.healthy) {
                unhealthyCount++;
                report.overall.unhealthyCircuits.push(name);
            }

            if (health.state === CIRCUIT_STATES.OPEN) {
                report.overall.openCircuits++;
            } else if (health.state === CIRCUIT_STATES.HALF_OPEN) {
                report.overall.halfOpenCircuits++;
            }
        }

        if (this.circuits.size > 0) {
            report.overall.score = Math.round(totalScore / this.circuits.size);
            report.overall.healthy = unhealthyCount / this.circuits.size < 0.1; // 10%閾值
        }

        return report;
    }

    /**
     * 重置熔斷器
     * @param {String|Array} names 熔斷器名稱或名稱數組
     */
    reset(names) {
        const targetNames = Array.isArray(names) ? names : [names];

        for (const name of targetNames) {
            const circuit = this.circuits.get(name);
            if (circuit) {
                circuit.reset();
                this.emit('circuitReset', name);
            }
        }
    }

    /**
     * 重置所有熔斷器
     */
    resetAll() {
        for (const [name, circuit] of this.circuits.entries()) {
            circuit.reset();
            this.emit('circuitReset', name);
        }
    }

    /**
     * 移除熔斷器
     * @param {String} name 熔斷器名稱
     */
    removeCircuit(name) {
        const circuit = this.circuits.get(name);
        if (circuit) {
            circuit.dispose();
            this.circuits.delete(name);
            this.globalStats.totalCircuits--;
            this.emit('circuitRemoved', name);
        }
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        this._updateGlobalStats();

        return {
            global: { ...this.globalStats },
            circuits: this.getAllCircuitStates(),
            health: this.getHealthReport()
        };
    }

    // ========== 私有方法 ==========

    /**
     * 設置指標收集
     */
    _setupMetricsCollection() {
        setInterval(() => {
            this._updateGlobalStats();
        }, 10000); // 10秒更新一次
    }

    /**
     * 更新全局統計
     */
    _updateGlobalStats() {
        let openCount = 0;
        let halfOpenCount = 0;
        let closedCount = 0;

        for (const circuit of this.circuits.values()) {
            switch (circuit.state) {
                case CIRCUIT_STATES.OPEN:
                    openCount++;
                    break;
                case CIRCUIT_STATES.HALF_OPEN:
                    halfOpenCount++;
                    break;
                case CIRCUIT_STATES.CLOSED:
                    closedCount++;
                    break;
            }
        }

        this.globalStats.openCircuits = openCount;
        this.globalStats.halfOpenCircuits = halfOpenCount;
        this.globalStats.closedCircuits = closedCount;
        this.globalStats.lastUpdate = new Date().toISOString();
    }

    /**
     * 設置清理定時器
     */
    _setupCleanupTimer() {
        setInterval(() => {
            // 這裡可以添加清理未使用熔斷器的邏輯
            // 暫時不實現，保持所有熔斷器
        }, 300000); // 5分鐘
    }

    /**
     * 清理資源
     */
    async dispose() {
        // 清理所有熔斷器實例
        for (const circuit of this.circuits.values()) {
            circuit.dispose();
        }

        this.circuits.clear();
        this.removeAllListeners();

        console.log('[CircuitBreaker] 已清理資源');
    }
}

// 導出常數和類
CircuitBreaker.CIRCUIT_STATES = CIRCUIT_STATES;
CircuitBreaker.TRIP_STRATEGIES = TRIP_STRATEGIES;
CircuitBreaker.RECOVERY_STRATEGIES = RECOVERY_STRATEGIES;
CircuitBreaker.CircuitBreakerInstance = CircuitBreakerInstance;

export default CircuitBreaker;