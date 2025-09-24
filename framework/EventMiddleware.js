/**
 * EventMiddleware - 事件處理中間件系統
 *
 * 功能：
 * - 事件轉換和過濾中間件
 * - 錯誤處理和重試機制
 * - 事件驗證和格式化
 * - 性能監控和日誌記錄
 *
 * 用途：在EventBus中提供靈活的事件處理管道
 */

import EventEmitter from 'events';

/**
 * 中間件處理器基類
 */
class BaseMiddleware {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.enabled = options.enabled !== false;
        this.priority = options.priority || 0;
        this.stats = {
            processed: 0,
            errors: 0,
            averageTime: 0
        };
    }

    /**
     * 處理事件 - 子類需要重寫此方法
     * @param {Object} event - 事件對象
     * @param {Function} next - 下一個中間件函數
     * @param {Object} context - 處理上下文
     */
    async process(event, next, context) {
        throw new Error('子類必須實施process方法');
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStats(processingTime, error = null) {
        this.stats.processed++;

        if (error) {
            this.stats.errors++;
        }

        // 更新平均處理時間
        this.stats.averageTime = (this.stats.averageTime * (this.stats.processed - 1) + processingTime) / this.stats.processed;
    }
}

/**
 * 事件驗證中間件
 */
class ValidationMiddleware extends BaseMiddleware {
    constructor(options = {}) {
        super('validation', options);

        this.requiredFields = options.requiredFields || ['type', 'timestamp'];
        this.allowedTypes = options.allowedTypes || null;
        this.customValidators = options.customValidators || [];
    }

    async process(event, next, context) {
        const startTime = Date.now();

        try {
            // 檢查必需字段
            for (const field of this.requiredFields) {
                if (!(field in event)) {
                    throw new Error(`缺少必需字段: ${field}`);
                }
            }

            // 檢查事件類型
            if (this.allowedTypes && !this.allowedTypes.includes(event.type)) {
                throw new Error(`不允許的事件類型: ${event.type}`);
            }

            // 執行自定義驗證器
            for (const validator of this.customValidators) {
                const result = await validator(event, context);
                if (!result.valid) {
                    throw new Error(`驗證失敗: ${result.message}`);
                }
            }

            this._updateStats(Date.now() - startTime);
            return next(event, context);

        } catch (error) {
            this._updateStats(Date.now() - startTime, error);
            throw error;
        }
    }
}

/**
 * 事件轉換中間件
 */
class TransformMiddleware extends BaseMiddleware {
    constructor(options = {}) {
        super('transform', options);

        this.transformers = options.transformers || [];
        this.preserveOriginal = options.preserveOriginal || false;
    }

    async process(event, next, context) {
        const startTime = Date.now();

        try {
            let transformedEvent = this.preserveOriginal ? { ...event } : event;

            // 應用轉換器
            for (const transformer of this.transformers) {
                transformedEvent = await transformer(transformedEvent, context);
            }

            this._updateStats(Date.now() - startTime);
            return next(transformedEvent, context);

        } catch (error) {
            this._updateStats(Date.now() - startTime, error);
            throw error;
        }
    }
}

/**
 * 事件過濾中間件
 */
class FilterMiddleware extends BaseMiddleware {
    constructor(options = {}) {
        super('filter', options);

        this.filters = options.filters || [];
        this.mode = options.mode || 'all'; // 'all' 或 'any'
    }

    async process(event, next, context) {
        const startTime = Date.now();

        try {
            const results = await Promise.all(
                this.filters.map(filter => filter(event, context))
            );

            let shouldPass = false;

            if (this.mode === 'all') {
                shouldPass = results.every(result => result === true);
            } else {
                shouldPass = results.some(result => result === true);
            }

            if (!shouldPass) {
                // 事件被過濾，不繼續處理
                this._updateStats(Date.now() - startTime);
                return null;
            }

            this._updateStats(Date.now() - startTime);
            return next(event, context);

        } catch (error) {
            this._updateStats(Date.now() - startTime, error);
            throw error;
        }
    }
}

/**
 * 錯誤處理中間件
 */
class ErrorHandlingMiddleware extends BaseMiddleware {
    constructor(options = {}) {
        super('errorHandling', options);

        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.errorHandler = options.errorHandler || this._defaultErrorHandler;
        this.retryableErrors = options.retryableErrors || [];
    }

    async process(event, next, context) {
        const startTime = Date.now();
        let lastError;

        for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
            try {
                const result = await next(event, context);

                if (attempt > 0) {
                    // 重試成功
                    context.retryAttempt = attempt;
                }

                this._updateStats(Date.now() - startTime);
                return result;

            } catch (error) {
                lastError = error;

                // 檢查是否為可重試的錯誤
                const isRetryable = this._isRetryableError(error);

                if (attempt < this.retryAttempts && isRetryable) {
                    // 等待後重試
                    await new Promise(resolve =>
                        setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
                    );
                    continue;
                } else {
                    // 處理最終錯誤
                    await this.errorHandler(error, event, context, attempt);
                    break;
                }
            }
        }

        this._updateStats(Date.now() - startTime, lastError);
        throw lastError;
    }

    _isRetryableError(error) {
        if (this.retryableErrors.length === 0) {
            return true; // 默認所有錯誤都可重試
        }

        return this.retryableErrors.some(pattern => {
            if (typeof pattern === 'string') {
                return error.message.includes(pattern);
            } else if (pattern instanceof RegExp) {
                return pattern.test(error.message);
            } else if (typeof pattern === 'function') {
                return pattern(error);
            }
            return false;
        });
    }

    _defaultErrorHandler(error, event, context, attempt) {
        console.error(`事件處理錯誤 (嘗試 ${attempt + 1}):`, {
            error: error.message,
            event: event.type,
            context: context.id
        });
    }
}

/**
 * 性能監控中間件
 */
class PerformanceMiddleware extends BaseMiddleware {
    constructor(options = {}) {
        super('performance', options);

        this.slowThreshold = options.slowThreshold || 1000; // 1秒
        this.logSlow = options.logSlow !== false;
        this.trackMetrics = options.trackMetrics !== false;

        this.metrics = {
            totalProcessingTime: 0,
            slowEvents: 0,
            fastestTime: Infinity,
            slowestTime: 0
        };
    }

    async process(event, next, context) {
        const startTime = Date.now();

        try {
            const result = await next(event, context);

            const processingTime = Date.now() - startTime;
            this._recordMetrics(processingTime, event);

            if (processingTime > this.slowThreshold && this.logSlow) {
                console.warn(`慢事件檢測:`, {
                    event: event.type,
                    processingTime: `${processingTime}ms`,
                    threshold: `${this.slowThreshold}ms`
                });
            }

            this._updateStats(processingTime);
            return result;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this._recordMetrics(processingTime, event, error);
            this._updateStats(processingTime, error);
            throw error;
        }
    }

    _recordMetrics(processingTime, event, error = null) {
        if (!this.trackMetrics) return;

        this.metrics.totalProcessingTime += processingTime;

        if (processingTime > this.slowThreshold) {
            this.metrics.slowEvents++;
        }

        if (processingTime < this.metrics.fastestTime) {
            this.metrics.fastestTime = processingTime;
        }

        if (processingTime > this.metrics.slowestTime) {
            this.metrics.slowestTime = processingTime;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            averageTime: this.stats.averageTime,
            processed: this.stats.processed
        };
    }
}

/**
 * 事件中間件管理器
 */
class EventMiddleware extends EventEmitter {
    constructor(options = {}) {
        super();

        this.middlewares = [];
        this.options = {
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            enableErrorHandling: options.enableErrorHandling !== false,
            defaultRetryAttempts: options.defaultRetryAttempts || 3,
            ...options
        };

        // 添加默認中間件
        if (this.options.enablePerformanceMonitoring) {
            this.use(new PerformanceMiddleware(options.performance));
        }

        if (this.options.enableErrorHandling) {
            this.use(new ErrorHandlingMiddleware(options.errorHandling));
        }
    }

    /**
     * 添加中間件
     * @param {BaseMiddleware|Function} middleware - 中間件實例或函數
     */
    use(middleware) {
        if (typeof middleware === 'function') {
            // 將函數包裝成中間件類
            const funcMiddleware = new BaseMiddleware('custom');
            funcMiddleware.process = middleware;
            middleware = funcMiddleware;
        }

        if (!(middleware instanceof BaseMiddleware)) {
            throw new Error('中間件必須繼承BaseMiddleware或為函數');
        }

        this.middlewares.push(middleware);

        // 按優先級排序
        this.middlewares.sort((a, b) => b.priority - a.priority);

        this.emit('middlewareAdded', middleware);
    }

    /**
     * 移除中間件
     * @param {String} name - 中間件名稱
     */
    remove(name) {
        const index = this.middlewares.findIndex(m => m.name === name);
        if (index !== -1) {
            const removed = this.middlewares.splice(index, 1)[0];
            this.emit('middlewareRemoved', removed);
            return removed;
        }
        return null;
    }

    /**
     * 執行中間件管道
     * @param {Object} event - 事件對象
     * @param {Object} context - 處理上下文
     * @returns {Promise<Object>} 處理後的事件
     */
    async execute(event, context = {}) {
        if (this.middlewares.length === 0) {
            return event;
        }

        // 創建處理上下文
        const processingContext = {
            id: this._generateContextId(),
            startTime: Date.now(),
            middlewareChain: this.middlewares.map(m => m.name),
            ...context
        };

        return new Promise((resolve, reject) => {
            let currentIndex = 0;

            const next = async (processedEvent, ctx) => {
                try {
                    if (currentIndex >= this.middlewares.length) {
                        // 所有中間件處理完成
                        resolve(processedEvent);
                        return processedEvent;
                    }

                    const middleware = this.middlewares[currentIndex];
                    currentIndex++;

                    if (!middleware.enabled) {
                        // 跳過禁用的中間件
                        return next(processedEvent, ctx);
                    }

                    const result = await middleware.process(processedEvent, next, ctx);

                    if (result === null) {
                        // 事件被過濾
                        resolve(null);
                        return null;
                    }

                    return result;

                } catch (error) {
                    // 中間件執行失敗
                    this.emit('middlewareError', {
                        middleware: this.middlewares[currentIndex - 1]?.name,
                        error,
                        event: processedEvent,
                        context: ctx
                    });

                    reject(error);
                }
            };

            // 開始執行中間件鏈
            next(event, processingContext).catch(reject);
        });
    }

    /**
     * 獲取中間件列表
     * @returns {Array<BaseMiddleware>}
     */
    getMiddlewares() {
        return [...this.middlewares];
    }

    /**
     * 獲取統計信息
     * @returns {Object}
     */
    getStats() {
        return this.middlewares.reduce((stats, middleware) => {
            stats[middleware.name] = middleware.stats;

            // 如果是性能中間件，添加額外指標
            if (middleware instanceof PerformanceMiddleware) {
                stats[middleware.name] = {
                    ...stats[middleware.name],
                    ...middleware.getMetrics()
                };
            }

            return stats;
        }, {});
    }

    /**
     * 重置統計信息
     */
    resetStats() {
        this.middlewares.forEach(middleware => {
            middleware.stats = {
                processed: 0,
                errors: 0,
                averageTime: 0
            };
        });
    }

    /**
     * 生成上下文ID
     * @private
     */
    _generateContextId() {
        return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 清理資源
     */
    dispose() {
        this.middlewares.length = 0;
        this.removeAllListeners();
    }
}

// 導出所有中間件類
module.exports = {
    EventMiddleware,
    BaseMiddleware,
    ValidationMiddleware,
    TransformMiddleware,
    FilterMiddleware,
    ErrorHandlingMiddleware,
    PerformanceMiddleware
};