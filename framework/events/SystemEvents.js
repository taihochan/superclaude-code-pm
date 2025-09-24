/**
 * SystemEvents - 系統級事件定義
 *
 * 功能：
 * - 定義系統核心事件類型和結構
 * - 提供事件創建和驗證工具
 * - 統一系統間通用事件格式
 *
 * 用途：CCPM和SuperClaude共用的系統事件
 */

/**
 * 系統事件類型常數
 */
const SYSTEM_EVENT_TYPES = {
    // 命令執行事件
    COMMAND_EXECUTED: 'SYSTEM_COMMAND_EXECUTED',
    COMMAND_FAILED: 'SYSTEM_COMMAND_FAILED',
    COMMAND_QUEUED: 'SYSTEM_COMMAND_QUEUED',
    COMMAND_CANCELLED: 'SYSTEM_COMMAND_CANCELLED',

    // 狀態變更事件
    STATE_CHANGED: 'SYSTEM_STATE_CHANGED',
    STATE_SYNC_REQUESTED: 'SYSTEM_STATE_SYNC_REQUESTED',
    STATE_SYNC_COMPLETED: 'SYSTEM_STATE_SYNC_COMPLETED',

    // 錯誤事件
    ERROR_OCCURRED: 'SYSTEM_ERROR_OCCURRED',
    ERROR_RECOVERED: 'SYSTEM_ERROR_RECOVERED',
    CRITICAL_ERROR: 'SYSTEM_CRITICAL_ERROR',

    // 系統生命周期事件
    SYSTEM_INITIALIZED: 'SYSTEM_INITIALIZED',
    SYSTEM_READY: 'SYSTEM_READY',
    SYSTEM_SHUTTING_DOWN: 'SYSTEM_SHUTTING_DOWN',
    SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',

    // 連接和網路事件
    CONNECTION_ESTABLISHED: 'SYSTEM_CONNECTION_ESTABLISHED',
    CONNECTION_LOST: 'SYSTEM_CONNECTION_LOST',
    CONNECTION_RESTORED: 'SYSTEM_CONNECTION_RESTORED',

    // 性能監控事件
    PERFORMANCE_WARNING: 'SYSTEM_PERFORMANCE_WARNING',
    RESOURCE_EXHAUSTED: 'SYSTEM_RESOURCE_EXHAUSTED',
    HEALTH_CHECK: 'SYSTEM_HEALTH_CHECK',

    // 配置事件
    CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',
    CONFIG_RELOAD_REQUESTED: 'SYSTEM_CONFIG_RELOAD_REQUESTED',
    CONFIG_VALIDATION_FAILED: 'SYSTEM_CONFIG_VALIDATION_FAILED'
};

/**
 * 錯誤嚴重程度等級
 */
const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * 系統狀態類型
 */
const SYSTEM_STATUS = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    RUNNING: 'running',
    BUSY: 'busy',
    ERROR: 'error',
    SHUTDOWN: 'shutdown'
};

/**
 * 事件創建工具類
 */
class SystemEventFactory {
    /**
     * 創建命令執行事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createCommandExecutedEvent({
        command,
        args = {},
        result = null,
        source = 'unknown',
        executionTime = 0,
        success = true
    }) {
        return {
            type: SYSTEM_EVENT_TYPES.COMMAND_EXECUTED,
            timestamp: new Date().toISOString(),
            data: {
                command,
                args,
                result,
                source,
                executionTime,
                success
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建命令失敗事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createCommandFailedEvent({
        command,
        args = {},
        error,
        source = 'unknown',
        executionTime = 0,
        retryable = true
    }) {
        return {
            type: SYSTEM_EVENT_TYPES.COMMAND_FAILED,
            timestamp: new Date().toISOString(),
            data: {
                command,
                args,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                source,
                executionTime,
                retryable
            },
            source,
            priority: 2
        };
    }

    /**
     * 創建狀態變更事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createStateChangedEvent({
        module,
        oldState,
        newState,
        reason = '',
        source = 'unknown'
    }) {
        return {
            type: SYSTEM_EVENT_TYPES.STATE_CHANGED,
            timestamp: new Date().toISOString(),
            data: {
                module,
                oldState,
                newState,
                reason,
                changeId: this._generateId()
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建錯誤事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createErrorEvent({
        error,
        context = {},
        severity = ERROR_SEVERITY.MEDIUM,
        source = 'unknown',
        recoverable = true
    }) {
        const priority = severity === ERROR_SEVERITY.CRITICAL ? 3 : 2;

        return {
            type: SYSTEM_EVENT_TYPES.ERROR_OCCURRED,
            timestamp: new Date().toISOString(),
            data: {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    code: error.code || 'UNKNOWN_ERROR'
                },
                context,
                severity,
                recoverable,
                errorId: this._generateId()
            },
            source,
            priority
        };
    }

    /**
     * 創建系統生命周期事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createSystemLifecycleEvent({
        eventType,
        status = SYSTEM_STATUS.RUNNING,
        message = '',
        source = 'system',
        metadata = {}
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                status,
                message,
                metadata,
                uptime: process.uptime(),
                pid: process.pid
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建連接事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createConnectionEvent({
        eventType,
        connectionId,
        endpoint = '',
        protocol = '',
        source = 'network',
        metadata = {}
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                connectionId,
                endpoint,
                protocol,
                metadata
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建性能監控事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createPerformanceEvent({
        eventType,
        metrics = {},
        threshold = null,
        source = 'performance',
        severity = ERROR_SEVERITY.LOW
    }) {
        const priority = severity === ERROR_SEVERITY.CRITICAL ? 3 : 1;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                metrics,
                threshold,
                severity,
                systemInfo: {
                    memory: process.memoryUsage(),
                    uptime: process.uptime(),
                    loadAverage: process.platform !== 'win32' ? require('os').loadavg() : null
                }
            },
            source,
            priority
        };
    }

    /**
     * 創建配置事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createConfigEvent({
        eventType,
        configPath = '',
        oldConfig = null,
        newConfig = null,
        validationErrors = [],
        source = 'config'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                configPath,
                oldConfig,
                newConfig,
                validationErrors,
                changeId: this._generateId()
            },
            source,
            priority: 1
        };
    }

    /**
     * 生成唯一ID
     * @private
     */
    static _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}

/**
 * 事件驗證器
 */
class SystemEventValidator {
    /**
     * 驗證系統事件結構
     * @param {Object} event - 事件對象
     * @returns {Object} 驗證結果
     */
    static validate(event) {
        const errors = [];

        // 基本結構檢查
        if (!event || typeof event !== 'object') {
            return { valid: false, errors: ['事件必須是對象'] };
        }

        // 必需字段檢查
        const requiredFields = ['type', 'timestamp', 'data', 'source'];
        for (const field of requiredFields) {
            if (!(field in event)) {
                errors.push(`缺少必需字段: ${field}`);
            }
        }

        // 事件類型檢查
        if (event.type && !Object.values(SYSTEM_EVENT_TYPES).includes(event.type)) {
            errors.push(`未知的系統事件類型: ${event.type}`);
        }

        // 時間戳格式檢查
        if (event.timestamp && !Date.parse(event.timestamp)) {
            errors.push('時間戳格式無效');
        }

        // 優先級檢查
        if (event.priority !== undefined && (
            typeof event.priority !== 'number' ||
            event.priority < 0 ||
            event.priority > 3
        )) {
            errors.push('優先級必須是0-3的數字');
        }

        // 特定事件類型驗證
        if (errors.length === 0) {
            const typeSpecificErrors = this._validateEventTypeSpecific(event);
            errors.push(...typeSpecificErrors);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 事件類型特定驗證
     * @private
     */
    static _validateEventTypeSpecific(event) {
        const errors = [];

        switch (event.type) {
            case SYSTEM_EVENT_TYPES.COMMAND_EXECUTED:
            case SYSTEM_EVENT_TYPES.COMMAND_FAILED:
                if (!event.data.command) {
                    errors.push('命令事件必須包含command字段');
                }
                break;

            case SYSTEM_EVENT_TYPES.STATE_CHANGED:
                if (!event.data.module || !event.data.newState) {
                    errors.push('狀態變更事件必須包含module和newState字段');
                }
                break;

            case SYSTEM_EVENT_TYPES.ERROR_OCCURRED:
                if (!event.data.error || !event.data.severity) {
                    errors.push('錯誤事件必須包含error和severity字段');
                }

                if (event.data.severity && !Object.values(ERROR_SEVERITY).includes(event.data.severity)) {
                    errors.push('無效的錯誤嚴重程度');
                }
                break;

            case SYSTEM_EVENT_TYPES.CONNECTION_ESTABLISHED:
            case SYSTEM_EVENT_TYPES.CONNECTION_LOST:
            case SYSTEM_EVENT_TYPES.CONNECTION_RESTORED:
                if (!event.data.connectionId) {
                    errors.push('連接事件必須包含connectionId字段');
                }
                break;
        }

        return errors;
    }
}

/**
 * 系統事件工具函數
 */
const SystemEventUtils = {
    /**
     * 檢查事件是否為錯誤事件
     */
    isErrorEvent(event) {
        return [
            SYSTEM_EVENT_TYPES.ERROR_OCCURRED,
            SYSTEM_EVENT_TYPES.CRITICAL_ERROR,
            SYSTEM_EVENT_TYPES.COMMAND_FAILED
        ].includes(event.type);
    },

    /**
     * 檢查事件是否為高優先級事件
     */
    isHighPriorityEvent(event) {
        return event.priority >= 2 || [
            SYSTEM_EVENT_TYPES.CRITICAL_ERROR,
            SYSTEM_EVENT_TYPES.SYSTEM_SHUTTING_DOWN,
            SYSTEM_EVENT_TYPES.RESOURCE_EXHAUSTED
        ].includes(event.type);
    },

    /**
     * 獲取事件摘要
     */
    getEventSummary(event) {
        const baseInfo = {
            type: event.type,
            timestamp: event.timestamp,
            source: event.source,
            priority: event.priority || 0
        };

        switch (event.type) {
            case SYSTEM_EVENT_TYPES.COMMAND_EXECUTED:
                return {
                    ...baseInfo,
                    command: event.data.command,
                    success: event.data.success,
                    executionTime: event.data.executionTime
                };

            case SYSTEM_EVENT_TYPES.ERROR_OCCURRED:
                return {
                    ...baseInfo,
                    errorMessage: event.data.error.message,
                    severity: event.data.severity,
                    recoverable: event.data.recoverable
                };

            case SYSTEM_EVENT_TYPES.STATE_CHANGED:
                return {
                    ...baseInfo,
                    module: event.data.module,
                    oldState: event.data.oldState,
                    newState: event.data.newState
                };

            default:
                return baseInfo;
        }
    }
};

module.exports = {
    SYSTEM_EVENT_TYPES,
    ERROR_SEVERITY,
    SYSTEM_STATUS,
    SystemEventFactory,
    SystemEventValidator,
    SystemEventUtils
};