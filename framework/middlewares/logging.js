/**
 * 日誌中間件 - 統一命令路由系統
 *
 * 功能：
 * - 記錄命令執行的完整生命周期
 * - 提供結構化日誌格式
 * - 支援不同日誌級別和輸出目標
 * - 性能監控和統計分析
 * - 錯誤追蹤和調試信息
 */

import { performance } from 'perf_hooks';

// 日誌級別
export const LOG_LEVELS = {
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50,
    FATAL: 60
};

// 日誌級別名稱
export const LOG_LEVEL_NAMES = {
    [LOG_LEVELS.TRACE]: 'TRACE',
    [LOG_LEVELS.DEBUG]: 'DEBUG',
    [LOG_LEVELS.INFO]: 'INFO',
    [LOG_LEVELS.WARN]: 'WARN',
    [LOG_LEVELS.ERROR]: 'ERROR',
    [LOG_LEVELS.FATAL]: 'FATAL'
};

// 日誌輸出目標
export const LOG_TARGETS = {
    CONSOLE: 'console',
    FILE: 'file',
    MEMORY: 'memory',
    REMOTE: 'remote'
};

// 簡單的內存日誌儲存
class MemoryLogStorage {
    constructor(maxEntries = 1000) {
        this.logs = [];
        this.maxEntries = maxEntries;
    }

    add(entry) {
        this.logs.push(entry);
        if (this.logs.length > this.maxEntries) {
            this.logs.shift(); // 移除最舊的條目
        }
    }

    get(filter = {}) {
        let result = [...this.logs];

        if (filter.level) {
            result = result.filter(log => log.level >= filter.level);
        }

        if (filter.component) {
            result = result.filter(log => log.component === filter.component);
        }

        if (filter.command) {
            result = result.filter(log => log.command?.includes(filter.command));
        }

        if (filter.since) {
            result = result.filter(log => log.timestamp >= filter.since);
        }

        if (filter.limit) {
            result = result.slice(-filter.limit);
        }

        return result;
    }

    clear() {
        this.logs = [];
    }

    size() {
        return this.logs.length;
    }
}

// 日誌格式器
class LogFormatter {
    static formatConsole(entry) {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = LOG_LEVEL_NAMES[entry.level] || 'UNKNOWN';
        const component = entry.component || 'UNKNOWN';

        let message = `[${timestamp}] ${level} [${component}]`;

        if (entry.executionId) {
            message += ` [${entry.executionId}]`;
        }

        message += ` ${entry.message}`;

        if (entry.data && Object.keys(entry.data).length > 0) {
            message += '\n' + JSON.stringify(entry.data, null, 2);
        }

        if (entry.error) {
            message += '\n' + (entry.error.stack || entry.error.message);
        }

        return message;
    }

    static formatJSON(entry) {
        return JSON.stringify({
            ...entry,
            timestamp: new Date(entry.timestamp).toISOString(),
            level: LOG_LEVEL_NAMES[entry.level]
        });
    }

    static formatStructured(entry) {
        return {
            '@timestamp': new Date(entry.timestamp).toISOString(),
            level: LOG_LEVEL_NAMES[entry.level],
            component: entry.component,
            message: entry.message,
            execution_id: entry.executionId,
            command: entry.command,
            duration_ms: entry.duration,
            user: entry.user,
            data: entry.data,
            error: entry.error ? {
                message: entry.error.message,
                stack: entry.error.stack,
                code: entry.error.code
            } : undefined
        };
    }
}

// 主要日誌器類
export class Logger {
    constructor(options = {}) {
        this.options = {
            level: LOG_LEVELS.INFO,
            targets: [LOG_TARGETS.CONSOLE],
            component: 'CommandRouter',
            includePerformance: true,
            includeContext: true,
            maxMemoryEntries: 1000,
            ...options
        };

        this.memoryStorage = new MemoryLogStorage(this.options.maxMemoryEntries);
        this.metrics = {
            totalLogs: 0,
            logsByLevel: {},
            logsByComponent: {},
            errors: 0
        };

        // 初始化日誌級別統計
        Object.values(LOG_LEVELS).forEach(level => {
            this.metrics.logsByLevel[level] = 0;
        });
    }

    log(level, message, data = {}, error = null) {
        // 檢查日誌級別
        if (level < this.options.level) {
            return;
        }

        const entry = {
            timestamp: Date.now(),
            level,
            component: data.component || this.options.component,
            message,
            executionId: data.executionId,
            command: data.command,
            user: data.user,
            duration: data.duration,
            data: { ...data },
            error
        };

        // 移除已經單獨處理的屬性
        delete entry.data.component;
        delete entry.data.executionId;
        delete entry.data.command;
        delete entry.data.user;
        delete entry.data.duration;

        // 更新統計
        this.metrics.totalLogs++;
        this.metrics.logsByLevel[level]++;

        if (entry.component) {
            this.metrics.logsByComponent[entry.component] =
                (this.metrics.logsByComponent[entry.component] || 0) + 1;
        }

        if (error) {
            this.metrics.errors++;
        }

        // 輸出到各個目標
        this._output(entry);
    }

    trace(message, data, error) { this.log(LOG_LEVELS.TRACE, message, data, error); }
    debug(message, data, error) { this.log(LOG_LEVELS.DEBUG, message, data, error); }
    info(message, data, error) { this.log(LOG_LEVELS.INFO, message, data, error); }
    warn(message, data, error) { this.log(LOG_LEVELS.WARN, message, data, error); }
    error(message, data, error) { this.log(LOG_LEVELS.ERROR, message, data, error); }
    fatal(message, data, error) { this.log(LOG_LEVELS.FATAL, message, data, error); }

    _output(entry) {
        this.options.targets.forEach(target => {
            switch (target) {
                case LOG_TARGETS.CONSOLE:
                    this._outputConsole(entry);
                    break;
                case LOG_TARGETS.MEMORY:
                    this.memoryStorage.add(entry);
                    break;
                case LOG_TARGETS.FILE:
                    // 文件輸出需要額外實現
                    break;
                case LOG_TARGETS.REMOTE:
                    // 遠程輸出需要額外實現
                    break;
            }
        });
    }

    _outputConsole(entry) {
        const formatted = LogFormatter.formatConsole(entry);

        switch (entry.level) {
            case LOG_LEVELS.TRACE:
            case LOG_LEVELS.DEBUG:
                console.debug(formatted);
                break;
            case LOG_LEVELS.INFO:
                console.info(formatted);
                break;
            case LOG_LEVELS.WARN:
                console.warn(formatted);
                break;
            case LOG_LEVELS.ERROR:
            case LOG_LEVELS.FATAL:
                console.error(formatted);
                break;
        }
    }

    // 獲取內存中的日誌
    getLogs(filter) {
        return this.memoryStorage.get(filter);
    }

    // 獲取統計信息
    getMetrics() {
        return {
            ...this.metrics,
            memoryLogCount: this.memoryStorage.size()
        };
    }

    // 清理日誌
    clear() {
        this.memoryStorage.clear();
    }

    // 設置日誌級別
    setLevel(level) {
        this.options.level = level;
    }

    // 添加輸出目標
    addTarget(target) {
        if (!this.options.targets.includes(target)) {
            this.options.targets.push(target);
        }
    }

    // 移除輸出目標
    removeTarget(target) {
        const index = this.options.targets.indexOf(target);
        if (index > -1) {
            this.options.targets.splice(index, 1);
        }
    }
}

// 全局日誌器實例
const globalLogger = new Logger();

/**
 * 命令執行日誌中間件工廠函數
 * @param {Object} options - 日誌選項
 * @returns {Function} 中間件函數
 */
export function createLoggingMiddleware(options = {}) {
    const {
        logLevel = LOG_LEVELS.INFO,
        includeRequestData = false,
        includeResponseData = false,
        logPerformance = true,
        logger = globalLogger
    } = options;

    return async function loggingMiddleware(data, middlewareOptions = {}) {
        const { context, parsed, result, handler } = data;
        const executionContext = context.context || {};

        // 準備日誌數據
        const logData = {
            executionId: context.id,
            command: parsed?.fullCommand || context.command,
            user: executionContext.auth?.user?.username,
            component: 'CommandRouter'
        };

        // 根據中間件階段執行不同的日誌記錄
        if (parsed && !result) {
            // 命令開始執行
            logger.info('命令開始執行', {
                ...logData,
                namespace: parsed.namespace,
                arguments: includeRequestData ? parsed.arguments : undefined,
                flags: includeRequestData ? parsed.flags : undefined
            });

            // 記錄性能開始時間
            if (logPerformance) {
                context.performanceStart = performance.now();
            }

        } else if (result !== undefined) {
            // 命令執行完成
            let duration;
            if (logPerformance && context.performanceStart) {
                duration = Math.round(performance.now() - context.performanceStart);
            }

            logger.info('命令執行完成', {
                ...logData,
                duration,
                success: true,
                resultSize: result ? JSON.stringify(result).length : 0,
                result: includeResponseData ? result : undefined
            });

        } else if (middlewareOptions.error) {
            // 命令執行失敗
            let duration;
            if (logPerformance && context.performanceStart) {
                duration = Math.round(performance.now() - context.performanceStart);
            }

            logger.error('命令執行失敗', {
                ...logData,
                duration,
                success: false
            }, middlewareOptions.error);
        }
    };
}

/**
 * 性能監控中間件
 * @param {Object} options - 監控選項
 * @returns {Function} 中間件函數
 */
export function createPerformanceMiddleware(options = {}) {
    const {
        warnThreshold = 1000, // 1秒警告閾值
        errorThreshold = 5000, // 5秒錯誤閾值
        logger = globalLogger
    } = options;

    return async function performanceMiddleware(data) {
        const { context, parsed, result } = data;

        if (parsed && !result) {
            // 記錄開始時間
            context.performanceMetrics = {
                startTime: performance.now(),
                command: parsed.fullCommand
            };
        } else if (result !== undefined && context.performanceMetrics) {
            // 計算執行時間
            const duration = Math.round(performance.now() - context.performanceMetrics.startTime);
            const logData = {
                executionId: context.id,
                command: context.performanceMetrics.command,
                duration
            };

            if (duration > errorThreshold) {
                logger.error('命令執行時間過長', logData);
            } else if (duration > warnThreshold) {
                logger.warn('命令執行時間較長', logData);
            } else {
                logger.debug('命令性能正常', logData);
            }
        }
    };
}

/**
 * 錯誤日誌中間件
 * @param {Object} options - 錯誤日誌選項
 * @returns {Function} 中間件函數
 */
export function createErrorLoggingMiddleware(options = {}) {
    const {
        includeStackTrace = true,
        includeContext = true,
        logger = globalLogger
    } = options;

    return async function errorLoggingMiddleware(error, execContext, middlewareOptions = {}) {
        const logData = {
            executionId: execContext.id,
            command: execContext.command,
            user: execContext.context?.auth?.user?.username,
            duration: execContext.endTime ? execContext.endTime - execContext.startTime : undefined
        };

        if (includeContext) {
            logData.context = {
                retryCount: execContext.retryCount,
                status: execContext.status,
                parsedCommand: execContext.parsedCommand
            };
        }

        logger.error('命令執行異常', logData, includeStackTrace ? error : null);
    };
}

// 預定義的日誌中間件
export const loggingMiddlewares = {
    // 基本命令日誌
    basic: createLoggingMiddleware({
        logLevel: LOG_LEVELS.INFO,
        logPerformance: true
    }),

    // 詳細命令日誌（包含請求和響應數據）
    detailed: createLoggingMiddleware({
        logLevel: LOG_LEVELS.DEBUG,
        includeRequestData: true,
        includeResponseData: true,
        logPerformance: true
    }),

    // 僅錯誤日誌
    errorOnly: createLoggingMiddleware({
        logLevel: LOG_LEVELS.ERROR
    }),

    // 性能監控
    performance: createPerformanceMiddleware({
        warnThreshold: 1000,
        errorThreshold: 5000
    }),

    // 錯誤處理
    error: createErrorLoggingMiddleware({
        includeStackTrace: true,
        includeContext: true
    })
};

// 便利函數

/**
 * 獲取全局日誌器
 * @returns {Logger} 日誌器實例
 */
export function getLogger() {
    return globalLogger;
}

/**
 * 創建子日誌器
 * @param {string} component - 組件名稱
 * @param {Object} options - 選項
 * @returns {Logger} 子日誌器實例
 */
export function createChildLogger(component, options = {}) {
    return new Logger({
        ...globalLogger.options,
        ...options,
        component
    });
}

/**
 * 設置全局日誌級別
 * @param {number} level - 日誌級別
 */
export function setGlobalLogLevel(level) {
    globalLogger.setLevel(level);
}

/**
 * 獲取全局日誌統計
 * @returns {Object} 統計信息
 */
export function getGlobalLogMetrics() {
    return globalLogger.getMetrics();
}

/**
 * 清理全局日誌
 */
export function clearGlobalLogs() {
    globalLogger.clear();
}

export { Logger, LogFormatter, MemoryLogStorage, LOG_LEVELS, LOG_LEVEL_NAMES, LOG_TARGETS };