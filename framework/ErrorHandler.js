/**
 * ErrorHandler - 統一錯誤處理和分類系統
 *
 * 功能：
 * - 錯誤分類和嚴重性評估
 * - 錯誤聚合和去重
 * - 錯誤上報和告警
 * - 錯誤恢復策略調度
 * - 錯誤分析和趨勢監控
 *
 * 用途：CCPM+SuperClaude整合的統一錯誤處理基礎設施
 * 配合：EventBus事件通信、CircuitBreaker熔斷、FallbackManager降級
 */

import { EventEmitter } from 'events';

/**
 * 錯誤嚴重性級別
 */
const ERROR_SEVERITY = {
    CRITICAL: 'critical',     // 系統無法運行
    HIGH: 'high',            // 核心功能受影響
    MEDIUM: 'medium',        // 部分功能受影響
    LOW: 'low',             // 輕微影響
    INFO: 'info'            // 信息性
};

/**
 * 錯誤類別
 */
const ERROR_CATEGORIES = {
    SYSTEM: 'system',           // 系統錯誤
    NETWORK: 'network',         // 網路錯誤
    VALIDATION: 'validation',   // 數據驗證錯誤
    BUSINESS: 'business',       // 業務邏輯錯誤
    SECURITY: 'security',       // 安全錯誤
    PERFORMANCE: 'performance', // 性能錯誤
    INTEGRATION: 'integration', // 整合錯誤
    CONFIG: 'config'           // 配置錯誤
};

/**
 * 錯誤處理策略
 */
const ERROR_STRATEGIES = {
    RETRY: 'retry',           // 重試
    FALLBACK: 'fallback',     // 降級
    CIRCUIT_BREAK: 'circuit_break', // 熔斷
    IGNORE: 'ignore',         // 忽略
    ESCALATE: 'escalate',     // 升級
    RESTART: 'restart'        // 重啟
};

/**
 * 標準錯誤類
 */
class StandardError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;

        // 錯誤屬性
        this.code = options.code || 'UNKNOWN_ERROR';
        this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
        this.category = options.category || ERROR_CATEGORIES.SYSTEM;
        this.component = options.component || 'unknown';
        this.operation = options.operation || 'unknown';

        // 上下文信息
        this.context = options.context || {};
        this.timestamp = new Date().toISOString();
        this.traceId = options.traceId || this._generateTraceId();

        // 錯誤源信息
        this.source = {
            file: options.source?.file || null,
            line: options.source?.line || null,
            function: options.source?.function || null
        };

        // 相關錯誤
        this.cause = options.cause || null;
        this.related = options.related || [];

        // 恢復信息
        this.recoverable = options.recoverable !== false;
        this.retryable = options.retryable !== false;
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;

        // 捕獲堆棧
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, StandardError);
        }
    }

    _generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 轉換為可序列化對象
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            severity: this.severity,
            category: this.category,
            component: this.component,
            operation: this.operation,
            context: this.context,
            timestamp: this.timestamp,
            traceId: this.traceId,
            source: this.source,
            cause: this.cause ? (this.cause.toJSON ? this.cause.toJSON() : this.cause.message) : null,
            related: this.related,
            recoverable: this.recoverable,
            retryable: this.retryable,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay,
            stack: this.stack
        };
    }

    /**
     * 創建相關錯誤
     */
    createRelated(message, options = {}) {
        return new StandardError(message, {
            ...options,
            traceId: this.traceId,
            cause: this,
            related: []
        });
    }
}

/**
 * 錯誤去重器
 */
class ErrorDeduplicator {
    constructor(options = {}) {
        this.windowSize = options.windowSize || 60000; // 1分鐘窗口
        this.maxEntries = options.maxEntries || 1000;
        this.errorSignatures = new Map();
    }

    /**
     * 檢查是否為重複錯誤
     */
    isDuplicate(error) {
        const signature = this._getErrorSignature(error);
        const now = Date.now();

        // 清理過期項目
        this._cleanup(now);

        if (this.errorSignatures.has(signature)) {
            const entry = this.errorSignatures.get(signature);
            entry.count++;
            entry.lastSeen = now;
            return true;
        }

        // 新錯誤
        this.errorSignatures.set(signature, {
            signature,
            count: 1,
            firstSeen: now,
            lastSeen: now,
            error: error.toJSON ? error.toJSON() : error
        });

        return false;
    }

    /**
     * 獲取錯誤簽名
     */
    _getErrorSignature(error) {
        const key = `${error.code || 'NO_CODE'}_${error.component || 'NO_COMPONENT'}_${error.operation || 'NO_OP'}`;
        return key.substring(0, 100); // 限制長度
    }

    /**
     * 清理過期錯誤
     */
    _cleanup(now) {
        const cutoff = now - this.windowSize;

        for (const [signature, entry] of this.errorSignatures.entries()) {
            if (entry.lastSeen < cutoff) {
                this.errorSignatures.delete(signature);
            }
        }

        // 限制最大項目數
        if (this.errorSignatures.size > this.maxEntries) {
            const entries = Array.from(this.errorSignatures.entries())
                .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
                .slice(0, this.maxEntries * 0.8); // 保留80%

            this.errorSignatures.clear();
            for (const [signature, entry] of entries) {
                this.errorSignatures.set(signature, entry);
            }
        }
    }

    /**
     * 獲取重複錯誤統計
     */
    getDuplicateStats() {
        const stats = {};

        for (const [signature, entry] of this.errorSignatures.entries()) {
            if (entry.count > 1) {
                stats[signature] = {
                    count: entry.count,
                    firstSeen: entry.firstSeen,
                    lastSeen: entry.lastSeen,
                    duration: entry.lastSeen - entry.firstSeen
                };
            }
        }

        return stats;
    }
}

/**
 * 錯誤聚合器
 */
class ErrorAggregator {
    constructor(options = {}) {
        this.aggregationWindow = options.aggregationWindow || 300000; // 5分鐘
        this.aggregations = new Map();
    }

    /**
     * 聚合錯誤
     */
    aggregate(error) {
        const now = Date.now();
        const windowKey = this._getWindowKey(now);

        if (!this.aggregations.has(windowKey)) {
            this.aggregations.set(windowKey, {
                window: windowKey,
                startTime: now,
                errors: new Map(),
                totalCount: 0
            });
        }

        const aggregation = this.aggregations.get(windowKey);
        const errorKey = `${error.category}_${error.severity}`;

        if (!aggregation.errors.has(errorKey)) {
            aggregation.errors.set(errorKey, {
                category: error.category,
                severity: error.severity,
                count: 0,
                samples: []
            });
        }

        const errorGroup = aggregation.errors.get(errorKey);
        errorGroup.count++;
        aggregation.totalCount++;

        // 保存樣本（最多10個）
        if (errorGroup.samples.length < 10) {
            errorGroup.samples.push({
                message: error.message,
                component: error.component,
                timestamp: error.timestamp,
                traceId: error.traceId
            });
        }

        // 清理舊聚合
        this._cleanupOldAggregations(now);

        return aggregation;
    }

    /**
     * 獲取聚合統計
     */
    getAggregatedStats(timeRange = 3600000) { // 1小時
        const now = Date.now();
        const cutoff = now - timeRange;
        const stats = {
            totalErrors: 0,
            byCategory: {},
            bySeverity: {},
            byWindow: [],
            topComponents: {},
            trends: {}
        };

        for (const [windowKey, aggregation] of this.aggregations.entries()) {
            if (aggregation.startTime >= cutoff) {
                stats.totalErrors += aggregation.totalCount;
                stats.byWindow.push({
                    window: windowKey,
                    count: aggregation.totalCount,
                    timestamp: aggregation.startTime
                });

                for (const [errorKey, errorGroup] of aggregation.errors.entries()) {
                    // 按類別統計
                    if (!stats.byCategory[errorGroup.category]) {
                        stats.byCategory[errorGroup.category] = 0;
                    }
                    stats.byCategory[errorGroup.category] += errorGroup.count;

                    // 按嚴重性統計
                    if (!stats.bySeverity[errorGroup.severity]) {
                        stats.bySeverity[errorGroup.severity] = 0;
                    }
                    stats.bySeverity[errorGroup.severity] += errorGroup.count;

                    // 按組件統計
                    for (const sample of errorGroup.samples) {
                        if (sample.component) {
                            if (!stats.topComponents[sample.component]) {
                                stats.topComponents[sample.component] = 0;
                            }
                            stats.topComponents[sample.component]++;
                        }
                    }
                }
            }
        }

        return stats;
    }

    /**
     * 獲取窗口鍵
     */
    _getWindowKey(timestamp) {
        const windowStart = Math.floor(timestamp / this.aggregationWindow) * this.aggregationWindow;
        return windowStart.toString();
    }

    /**
     * 清理舊聚合數據
     */
    _cleanupOldAggregations(now) {
        const cutoff = now - (this.aggregationWindow * 24); // 保留24個窗口

        for (const [windowKey, aggregation] of this.aggregations.entries()) {
            if (aggregation.startTime < cutoff) {
                this.aggregations.delete(windowKey);
            }
        }
    }
}

/**
 * 主錯誤處理器類
 */
class ErrorHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(1000);

        this.options = {
            // 去重配置
            enableDeduplication: options.enableDeduplication !== false,
            deduplicationWindow: options.deduplicationWindow || 60000,

            // 聚合配置
            enableAggregation: options.enableAggregation !== false,
            aggregationWindow: options.aggregationWindow || 300000,

            // 告警配置
            alertThresholds: {
                critical: options.alertThresholds?.critical || 1,
                high: options.alertThresholds?.high || 5,
                medium: options.alertThresholds?.medium || 20,
                low: options.alertThresholds?.low || 100,
                ...options.alertThresholds
            },

            // 恢復配置
            autoRecovery: options.autoRecovery !== false,
            maxRetryAttempts: options.maxRetryAttempts || 3,
            retryBackoff: options.retryBackoff || 1000,

            // 存儲配置
            enablePersistence: options.enablePersistence || false,
            storageLimit: options.storageLimit || 10000,

            ...options
        };

        // 核心組件
        this.deduplicator = new ErrorDeduplicator({
            windowSize: this.options.deduplicationWindow,
            maxEntries: 1000
        });

        this.aggregator = new ErrorAggregator({
            aggregationWindow: this.options.aggregationWindow
        });

        // 錯誤存儲
        this.errorHistory = [];
        this.activeErrors = new Map();

        // 恢復管理
        this.recoveryStrategies = new Map();
        this._initializeRecoveryStrategies();

        // 統計信息
        this.stats = {
            totalErrors: 0,
            totalRecovered: 0,
            totalFailed: 0,
            byCategory: {},
            bySeverity: {},
            duplicatesFiltered: 0,
            averageRecoveryTime: 0,
            lastReset: new Date().toISOString()
        };

        // 告警狀態
        this.alertState = {
            active: false,
            level: null,
            since: null,
            count: 0
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化錯誤處理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 設置清理定時器
            this._setupCleanupTimer();

            // 設置告警監控
            this._setupAlertMonitoring();

            this.initialized = true;
            this.emit('initialized');

            console.log('[ErrorHandler] 錯誤處理器已初始化');

        } catch (error) {
            console.error('[ErrorHandler] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 處理錯誤
     * @param {Error|Object} error 錯誤對象
     * @param {Object} options 處理選項
     * @returns {Promise<Object>} 處理結果
     */
    async handle(error, options = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // 標準化錯誤
            const standardError = this._standardizeError(error, options);

            // 檢查去重
            if (this.options.enableDeduplication) {
                const isDuplicate = this.deduplicator.isDuplicate(standardError);
                if (isDuplicate) {
                    this.stats.duplicatesFiltered++;
                    this.emit('errorDuplicate', standardError);
                    return { success: true, duplicate: true, error: standardError };
                }
            }

            // 記錄錯誤
            this._recordError(standardError);

            // 聚合錯誤
            if (this.options.enableAggregation) {
                const aggregation = this.aggregator.aggregate(standardError);
                this.emit('errorAggregated', aggregation);
            }

            // 檢查告警閾值
            await this._checkAlertThresholds(standardError);

            // 嘗試自動恢復
            let recoveryResult = null;
            if (this.options.autoRecovery && standardError.recoverable) {
                recoveryResult = await this._attemptRecovery(standardError, options);
            }

            // 發布錯誤事件
            this.emit('error', standardError, recoveryResult);

            const result = {
                success: true,
                error: standardError,
                recovery: recoveryResult,
                timestamp: new Date().toISOString()
            };

            return result;

        } catch (handlingError) {
            console.error('[ErrorHandler] 錯誤處理失敗:', handlingError);

            // 發布處理錯誤事件
            this.emit('handlingError', handlingError, error);

            return {
                success: false,
                error: handlingError,
                originalError: error,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 創建標準錯誤
     * @param {String} message 錯誤消息
     * @param {Object} options 選項
     * @returns {StandardError} 標準錯誤對象
     */
    createError(message, options = {}) {
        return new StandardError(message, options);
    }

    /**
     * 註冊恢復策略
     * @param {String} strategy 策略名稱
     * @param {Function} handler 處理函數
     */
    registerRecoveryStrategy(strategy, handler) {
        this.recoveryStrategies.set(strategy, handler);
        console.log(`[ErrorHandler] 已註冊恢復策略: ${strategy}`);
    }

    /**
     * 獲取錯誤統計
     * @param {Object} options 選項
     * @returns {Object} 統計信息
     */
    getStats(options = {}) {
        const timeRange = options.timeRange || 3600000; // 1小時

        return {
            summary: { ...this.stats },
            aggregated: this.aggregator.getAggregatedStats(timeRange),
            duplicates: this.deduplicator.getDuplicateStats(),
            alert: { ...this.alertState },
            activeErrors: this.activeErrors.size,
            historySize: this.errorHistory.length
        };
    }

    /**
     * 清除錯誤歷史
     * @param {Object} options 清除選項
     */
    async clearHistory(options = {}) {
        const { olderThan, severity, category } = options;

        if (olderThan) {
            const cutoff = Date.now() - olderThan;
            this.errorHistory = this.errorHistory.filter(error =>
                new Date(error.timestamp).getTime() >= cutoff
            );
        }

        if (severity) {
            this.errorHistory = this.errorHistory.filter(error =>
                error.severity !== severity
            );
        }

        if (category) {
            this.errorHistory = this.errorHistory.filter(error =>
                error.category !== category
            );
        }

        if (!olderThan && !severity && !category) {
            this.errorHistory = [];
            this.activeErrors.clear();
            this._resetStats();
        }

        this.emit('historyCleared', options);
    }

    // ========== 私有方法 ==========

    /**
     * 標準化錯誤對象
     */
    _standardizeError(error, options) {
        // 如果已經是StandardError，直接返回
        if (error instanceof StandardError) {
            return error;
        }

        // 從Error對象創建
        if (error instanceof Error) {
            return new StandardError(error.message, {
                code: error.code || 'UNKNOWN_ERROR',
                cause: error,
                stack: error.stack,
                ...options
            });
        }

        // 從對象創建
        if (typeof error === 'object' && error.message) {
            return new StandardError(error.message, {
                ...error,
                ...options
            });
        }

        // 從字符串創建
        if (typeof error === 'string') {
            return new StandardError(error, options);
        }

        // 未知類型
        return new StandardError('未知錯誤', {
            code: 'UNKNOWN_ERROR_TYPE',
            context: { originalError: error },
            ...options
        });
    }

    /**
     * 記錄錯誤
     */
    _recordError(error) {
        // 添加到歷史
        this.errorHistory.push(error);

        // 限制歷史大小
        if (this.errorHistory.length > this.options.storageLimit) {
            this.errorHistory = this.errorHistory.slice(-this.options.storageLimit);
        }

        // 添加到活動錯誤
        this.activeErrors.set(error.traceId, {
            error,
            attempts: 0,
            lastAttempt: null,
            resolved: false
        });

        // 更新統計
        this.stats.totalErrors++;
        this.stats.byCategory[error.category] = (this.stats.byCategory[error.category] || 0) + 1;
        this.stats.bySeverity[error.severity] = (this.stats.bySeverity[error.severity] || 0) + 1;
    }

    /**
     * 檢查告警閾值
     */
    async _checkAlertThresholds(error) {
        const threshold = this.options.alertThresholds[error.severity];
        if (!threshold) return;

        const currentCount = this.stats.bySeverity[error.severity] || 0;

        if (currentCount >= threshold) {
            if (!this.alertState.active || this.alertState.level !== error.severity) {
                this.alertState = {
                    active: true,
                    level: error.severity,
                    since: new Date().toISOString(),
                    count: currentCount
                };

                this.emit('alert', {
                    level: error.severity,
                    threshold,
                    count: currentCount,
                    error
                });
            } else {
                this.alertState.count = currentCount;
            }
        }
    }

    /**
     * 嘗試自動恢復
     */
    async _attemptRecovery(error, options) {
        const activeError = this.activeErrors.get(error.traceId);
        if (!activeError) return null;

        const startTime = Date.now();

        try {
            // 檢查重試次數
            if (activeError.attempts >= this.options.maxRetryAttempts) {
                return {
                    success: false,
                    reason: 'max_retries_exceeded',
                    attempts: activeError.attempts
                };
            }

            activeError.attempts++;
            activeError.lastAttempt = new Date().toISOString();

            // 選擇恢復策略
            const strategy = this._selectRecoveryStrategy(error, options);
            const handler = this.recoveryStrategies.get(strategy);

            if (!handler) {
                return {
                    success: false,
                    reason: 'no_recovery_strategy',
                    strategy
                };
            }

            // 執行恢復策略
            const result = await handler(error, {
                attempt: activeError.attempts,
                maxAttempts: this.options.maxRetryAttempts,
                ...options
            });

            const recoveryTime = Date.now() - startTime;

            if (result.success) {
                activeError.resolved = true;
                this.stats.totalRecovered++;

                // 更新平均恢復時間
                const totalRecoveryTime = this.stats.averageRecoveryTime * (this.stats.totalRecovered - 1) + recoveryTime;
                this.stats.averageRecoveryTime = totalRecoveryTime / this.stats.totalRecovered;

                this.emit('errorRecovered', error, result);
            } else {
                this.stats.totalFailed++;
                this.emit('errorRecoveryFailed', error, result);
            }

            return {
                ...result,
                strategy,
                attempt: activeError.attempts,
                recoveryTime
            };

        } catch (recoveryError) {
            this.stats.totalFailed++;

            return {
                success: false,
                reason: 'recovery_error',
                error: recoveryError.message,
                attempt: activeError.attempts,
                recoveryTime: Date.now() - startTime
            };
        }
    }

    /**
     * 選擇恢復策略
     */
    _selectRecoveryStrategy(error, options) {
        // 根據錯誤類型和配置選擇策略
        if (options.strategy) {
            return options.strategy;
        }

        switch (error.category) {
            case ERROR_CATEGORIES.NETWORK:
                return ERROR_STRATEGIES.RETRY;
            case ERROR_CATEGORIES.SYSTEM:
                return error.severity === ERROR_SEVERITY.CRITICAL ?
                       ERROR_STRATEGIES.RESTART : ERROR_STRATEGIES.RETRY;
            case ERROR_CATEGORIES.INTEGRATION:
                return ERROR_STRATEGIES.FALLBACK;
            case ERROR_CATEGORIES.PERFORMANCE:
                return ERROR_STRATEGIES.CIRCUIT_BREAK;
            default:
                return ERROR_STRATEGIES.RETRY;
        }
    }

    /**
     * 初始化恢復策略
     */
    _initializeRecoveryStrategies() {
        // 重試策略
        this.registerRecoveryStrategy(ERROR_STRATEGIES.RETRY, async (error, options) => {
            const delay = error.retryDelay * Math.pow(2, options.attempt - 1); // 指數退避
            await new Promise(resolve => setTimeout(resolve, delay));

            return {
                success: true,
                action: 'retry',
                delay
            };
        });

        // 忽略策略
        this.registerRecoveryStrategy(ERROR_STRATEGIES.IGNORE, async (error, options) => {
            return {
                success: true,
                action: 'ignore'
            };
        });

        // 升級策略
        this.registerRecoveryStrategy(ERROR_STRATEGIES.ESCALATE, async (error, options) => {
            this.emit('escalate', error, options);

            return {
                success: true,
                action: 'escalate'
            };
        });
    }

    /**
     * 設置清理定時器
     */
    _setupCleanupTimer() {
        setInterval(() => {
            // 清理已解決的錯誤
            for (const [traceId, activeError] of this.activeErrors.entries()) {
                if (activeError.resolved) {
                    this.activeErrors.delete(traceId);
                }
            }

            // 清理過期錯誤
            const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24小時
            this.errorHistory = this.errorHistory.filter(error =>
                new Date(error.timestamp).getTime() >= cutoff
            );

        }, 300000); // 5分鐘執行一次
    }

    /**
     * 設置告警監控
     */
    _setupAlertMonitoring() {
        setInterval(() => {
            if (this.alertState.active) {
                const duration = Date.now() - new Date(this.alertState.since).getTime();

                // 長時間告警需要升級
                if (duration > 3600000) { // 1小時
                    this.emit('alertEscalation', this.alertState);
                }
            }
        }, 60000); // 1分鐘檢查一次
    }

    /**
     * 重置統計
     */
    _resetStats() {
        this.stats = {
            totalErrors: 0,
            totalRecovered: 0,
            totalFailed: 0,
            byCategory: {},
            bySeverity: {},
            duplicatesFiltered: 0,
            averageRecoveryTime: 0,
            lastReset: new Date().toISOString()
        };

        this.alertState = {
            active: false,
            level: null,
            since: null,
            count: 0
        };
    }

    /**
     * 清理資源
     */
    async dispose() {
        // 清理定時器在Node.js中會自動清理

        // 清空數據
        this.errorHistory = [];
        this.activeErrors.clear();

        // 移除監聽器
        this.removeAllListeners();

        console.log('[ErrorHandler] 已清理資源');
    }
}

// 導出常數和類
ErrorHandler.ERROR_SEVERITY = ERROR_SEVERITY;
ErrorHandler.ERROR_CATEGORIES = ERROR_CATEGORIES;
ErrorHandler.ERROR_STRATEGIES = ERROR_STRATEGIES;
ErrorHandler.StandardError = StandardError;

export default ErrorHandler;