/**
 * CommandRouter - 統一命令路由系統的核心路由器
 *
 * 功能：
 * - 統一處理CCPM、SuperClaude和整合命令
 * - 提供中間件機制用於認證、日誌、驗證等
 * - 實現命令執行的完整生命周期管理
 * - 支援異步命令處理和錯誤恢復
 * - 提供性能監控和統計報告
 *
 * 架構：
 * Command Input → Parser → Registry → Middleware → Handler → Response
 */

import EventEmitter from 'eventemitter3';
import CommandParser from './CommandParser.js';
import CommandRegistry from './CommandRegistry.js';

// 路由錯誤類型
export class CommandRouterError extends Error {
    constructor(message, code, command = null, context = null) {
        super(message);
        this.name = 'CommandRouterError';
        this.code = code;
        this.command = command;
        this.context = context;
    }
}

// 執行狀態
export const EXECUTION_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    TIMEOUT: 'timeout',
    CANCELLED: 'cancelled'
};

// 中間件類型
export const MIDDLEWARE_TYPES = {
    PRE_PARSE: 'pre-parse',
    POST_PARSE: 'post-parse',
    PRE_EXECUTE: 'pre-execute',
    POST_EXECUTE: 'post-execute',
    ERROR: 'error'
};

export class CommandRouter extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            timeout: 30000, // 30秒命令執行超時
            enableMetrics: true, // 啟用性能指標
            enableLogging: true, // 啟用日誌記錄
            maxConcurrency: 10, // 最大並發執行數
            retryAttempts: 3, // 失敗重試次數
            retryDelay: 1000, // 重試延遲（毫秒）
            ...options
        };

        // 初始化核心組件
        this.parser = new CommandParser();
        this.registry = new CommandRegistry();

        // 中間件存儲
        this.middlewares = new Map(); // type -> middleware[]
        this.globalMiddlewares = []; // 全局中間件

        // 執行狀態追蹤
        this.executions = new Map(); // executionId -> ExecutionContext
        this.executionCounter = 0;

        // 性能和統計
        this.metrics = {
            totalCommands: 0,
            successfulCommands: 0,
            failedCommands: 0,
            averageExecutionTime: 0,
            activeExecutions: 0,
            peakConcurrency: 0
        };

        // 初始化內建中間件
        this._initializeBuiltinMiddlewares();

        // 設置事件監聽
        this._setupEventListeners();
    }

    /**
     * 路由並執行命令
     * @param {string} commandString - 命令字符串
     * @param {Object} context - 執行上下文
     * @returns {Promise<Object>} 執行結果
     */
    async route(commandString, context = {}) {
        const startTime = Date.now();
        const executionId = ++this.executionCounter;

        // 創建執行上下文
        const execContext = {
            id: executionId,
            command: commandString,
            context,
            status: EXECUTION_STATUS.PENDING,
            startTime,
            endTime: null,
            result: null,
            error: null,
            retryCount: 0,
            middlewareState: {}
        };

        this.executions.set(executionId, execContext);
        this.metrics.activeExecutions++;

        if (this.metrics.activeExecutions > this.metrics.peakConcurrency) {
            this.metrics.peakConcurrency = this.metrics.activeExecutions;
        }

        try {
            // 檢查並發限制
            if (this.metrics.activeExecutions > this.options.maxConcurrency) {
                throw new CommandRouterError(
                    `超出最大並發限制 (${this.options.maxConcurrency})`,
                    'CONCURRENCY_LIMIT_EXCEEDED',
                    commandString,
                    execContext
                );
            }

            // 執行命令處理流水線
            const result = await this._executeCommandPipeline(commandString, execContext);

            // 更新執行狀態
            execContext.status = EXECUTION_STATUS.COMPLETED;
            execContext.result = result;
            execContext.endTime = Date.now();

            // 更新統計
            this._updateMetrics(execContext);

            // 發送成功事件
            this.emit('commandExecuted', execContext);

            return result;

        } catch (error) {
            // 更新執行狀態
            execContext.status = EXECUTION_STATUS.FAILED;
            execContext.error = error;
            execContext.endTime = Date.now();

            // 嘗試重試
            if (execContext.retryCount < this.options.retryAttempts && this._shouldRetry(error)) {
                return this._retryCommand(commandString, execContext);
            }

            // 更新統計
            this._updateMetrics(execContext);

            // 發送失敗事件
            this.emit('commandFailed', error, execContext);

            // 執行錯誤中間件
            await this._executeErrorMiddlewares(error, execContext);

            throw error;

        } finally {
            // 清理執行狀態
            this.metrics.activeExecutions--;

            // 保留執行記錄一段時間用於統計
            setTimeout(() => {
                this.executions.delete(executionId);
            }, 60000); // 1分鐘後清理
        }
    }

    /**
     * 註冊命令
     * @param {Object} definition - 命令定義
     * @param {Function} handler - 命令處理器
     * @param {Object} options - 選項
     */
    registerCommand(definition, handler, options = {}) {
        return this.registry.register(definition, handler, options);
    }

    /**
     * 註冊中間件
     * @param {string} type - 中間件類型
     * @param {Function} middleware - 中間件函數
     * @param {Object} options - 選項
     */
    use(type, middleware, options = {}) {
        if (typeof type === 'function') {
            // 全局中間件
            this.globalMiddlewares.push({ middleware: type, options });
        } else {
            // 特定類型中間件
            if (!this.middlewares.has(type)) {
                this.middlewares.set(type, []);
            }
            this.middlewares.get(type).push({ middleware, options });
        }

        this.emit('middlewareRegistered', type, middleware, options);
    }

    /**
     * 批量執行命令
     * @param {string[]} commands - 命令列表
     * @param {Object} context - 執行上下文
     * @param {Object} options - 批量執行選項
     * @returns {Promise<Array>} 執行結果列表
     */
    async routeMultiple(commands, context = {}, options = {}) {
        const {
            parallel = false,
            stopOnError = false,
            maxBatchSize = 50
        } = options;

        if (commands.length > maxBatchSize) {
            throw new CommandRouterError(
                `批量命令數量超過限制 (${maxBatchSize})`,
                'BATCH_SIZE_EXCEEDED'
            );
        }

        const results = [];

        if (parallel) {
            // 並行執行
            const promises = commands.map((cmd, index) =>
                this.route(cmd, { ...context, batchIndex: index })
                    .catch(error => ({ error, command: cmd, index }))
            );

            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (result.error) {
                    if (stopOnError) {
                        throw result.error;
                    }
                    results.push({ success: false, error: result.error, command: result.command });
                } else {
                    results.push({ success: true, result });
                }
            }
        } else {
            // 順序執行
            for (let i = 0; i < commands.length; i++) {
                try {
                    const result = await this.route(commands[i], { ...context, batchIndex: i });
                    results.push({ success: true, result });
                } catch (error) {
                    results.push({ success: false, error, command: commands[i] });

                    if (stopOnError) {
                        throw error;
                    }
                }
            }
        }

        return results;
    }

    /**
     * 取消命令執行
     * @param {number} executionId - 執行ID
     * @returns {boolean} 是否成功取消
     */
    cancelExecution(executionId) {
        const execution = this.executions.get(executionId);

        if (!execution) {
            return false;
        }

        if (execution.status === EXECUTION_STATUS.COMPLETED ||
            execution.status === EXECUTION_STATUS.FAILED) {
            return false;
        }

        execution.status = EXECUTION_STATUS.CANCELLED;
        execution.endTime = Date.now();

        this.emit('commandCancelled', execution);
        return true;
    }

    /**
     * 獲取當前執行狀態
     * @returns {Object} 執行狀態報告
     */
    getExecutionStatus() {
        const active = Array.from(this.executions.values())
            .filter(exec => exec.status === EXECUTION_STATUS.RUNNING);

        return {
            activeExecutions: active.length,
            totalExecutions: this.executions.size,
            metrics: this.getMetrics(),
            activeCommands: active.map(exec => ({
                id: exec.id,
                command: exec.command,
                startTime: exec.startTime,
                duration: Date.now() - exec.startTime
            }))
        };
    }

    /**
     * 獲取性能指標
     * @returns {Object} 性能指標
     */
    getMetrics() {
        return {
            ...this.metrics,
            registryMetrics: this.registry.getMetrics(),
            successRate: this.metrics.totalCommands > 0 ?
                (this.metrics.successfulCommands / this.metrics.totalCommands * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * 執行命令處理流水線
     * @private
     */
    async _executeCommandPipeline(commandString, execContext) {
        let parsedCommand = null;

        try {
            // 階段 1: 預解析中間件
            await this._executeMiddlewares(MIDDLEWARE_TYPES.PRE_PARSE, {
                command: commandString,
                context: execContext
            });

            // 階段 2: 解析命令
            parsedCommand = this.parser.parse(commandString, execContext.context);
            execContext.parsedCommand = parsedCommand;

            // 階段 3: 後解析中間件
            await this._executeMiddlewares(MIDDLEWARE_TYPES.POST_PARSE, {
                parsed: parsedCommand,
                context: execContext
            });

            // 階段 4: 獲取命令處理器
            const handler = this.registry.getHandler(parsedCommand.fullCommand);
            if (!handler) {
                throw new CommandRouterError(
                    `未找到命令處理器: ${parsedCommand.fullCommand}`,
                    'HANDLER_NOT_FOUND',
                    commandString,
                    execContext
                );
            }

            // 階段 5: 預執行中間件
            await this._executeMiddlewares(MIDDLEWARE_TYPES.PRE_EXECUTE, {
                parsed: parsedCommand,
                handler,
                context: execContext
            });

            // 階段 6: 更新執行狀態
            execContext.status = EXECUTION_STATUS.RUNNING;

            // 階段 7: 執行命令（支持超時）
            const result = await this._executeWithTimeout(handler, parsedCommand, execContext);

            // 階段 8: 後執行中間件
            await this._executeMiddlewares(MIDDLEWARE_TYPES.POST_EXECUTE, {
                parsed: parsedCommand,
                result,
                context: execContext
            });

            // 階段 9: 更新統計
            this.registry.updateMetrics(parsedCommand.fullCommand, {
                executionTime: execContext.endTime - execContext.startTime
            });

            return result;

        } catch (error) {
            // 更新統計
            if (parsedCommand) {
                this.registry.updateMetrics(parsedCommand.fullCommand, {
                    error: true,
                    executionTime: (execContext.endTime || Date.now()) - execContext.startTime
                });
            }

            throw error;
        }
    }

    /**
     * 執行中間件
     * @private
     */
    async _executeMiddlewares(type, data) {
        // 執行全局中間件
        for (const { middleware, options } of this.globalMiddlewares) {
            if (options.types && !options.types.includes(type)) {
                continue;
            }
            await middleware(data, type);
        }

        // 執行特定類型中間件
        const typeMiddlewares = this.middlewares.get(type) || [];
        for (const { middleware, options } of typeMiddlewares) {
            await middleware(data, options);
        }
    }

    /**
     * 執行錯誤中間件
     * @private
     */
    async _executeErrorMiddlewares(error, execContext) {
        const errorMiddlewares = this.middlewares.get(MIDDLEWARE_TYPES.ERROR) || [];

        for (const { middleware, options } of errorMiddlewares) {
            try {
                await middleware(error, execContext, options);
            } catch (middlewareError) {
                // 錯誤中間件自身的錯誤不應該阻斷流程
                this.emit('middlewareError', middlewareError, middleware);
            }
        }
    }

    /**
     * 帶超時執行命令
     * @private
     */
    async _executeWithTimeout(handler, parsedCommand, execContext) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                execContext.status = EXECUTION_STATUS.TIMEOUT;
                reject(new CommandRouterError(
                    `命令執行超時 (${this.options.timeout}ms)`,
                    'EXECUTION_TIMEOUT',
                    parsedCommand.raw,
                    execContext
                ));
            }, this.options.timeout);

            Promise.resolve(handler(parsedCommand, execContext))
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * 重試命令執行
     * @private
     */
    async _retryCommand(commandString, execContext) {
        execContext.retryCount++;
        execContext.status = EXECUTION_STATUS.PENDING;

        // 等待重試延遲
        await new Promise(resolve => setTimeout(resolve,
            this.options.retryDelay * Math.pow(2, execContext.retryCount - 1) // 指數退避
        ));

        this.emit('commandRetry', execContext);

        return this.route(commandString, execContext.context);
    }

    /**
     * 判斷是否應該重試
     * @private
     */
    _shouldRetry(error) {
        const retryableCodes = [
            'NETWORK_ERROR',
            'TIMEOUT',
            'TEMPORARY_FAILURE',
            'SERVICE_UNAVAILABLE'
        ];

        return error instanceof CommandRouterError &&
               retryableCodes.includes(error.code);
    }

    /**
     * 更新性能指標
     * @private
     */
    _updateMetrics(execContext) {
        this.metrics.totalCommands++;

        if (execContext.status === EXECUTION_STATUS.COMPLETED) {
            this.metrics.successfulCommands++;
        } else if (execContext.status === EXECUTION_STATUS.FAILED) {
            this.metrics.failedCommands++;
        }

        // 更新平均執行時間
        const executionTime = (execContext.endTime || Date.now()) - execContext.startTime;
        const totalCommands = this.metrics.totalCommands;
        this.metrics.averageExecutionTime =
            (this.metrics.averageExecutionTime * (totalCommands - 1) + executionTime) / totalCommands;
    }

    /**
     * 初始化內建中間件
     * @private
     */
    _initializeBuiltinMiddlewares() {
        // 日誌中間件
        if (this.options.enableLogging) {
            this.use(MIDDLEWARE_TYPES.PRE_EXECUTE, async (data) => {
                const { parsed, context } = data;
                console.log(`[CommandRouter] 執行命令: ${parsed.fullCommand}`, {
                    id: context.id,
                    timestamp: new Date().toISOString()
                });
            });

            this.use(MIDDLEWARE_TYPES.POST_EXECUTE, async (data) => {
                const { parsed, context } = data;
                const duration = Date.now() - context.startTime;
                console.log(`[CommandRouter] 完成命令: ${parsed.fullCommand} (${duration}ms)`, {
                    id: context.id
                });
            });
        }

        // 錯誤處理中間件
        this.use(MIDDLEWARE_TYPES.ERROR, async (error, execContext) => {
            console.error(`[CommandRouter] 命令執行失敗:`, {
                id: execContext.id,
                command: execContext.command,
                error: error.message,
                code: error.code
            });
        });
    }

    /**
     * 設置事件監聽器
     * @private
     */
    _setupEventListeners() {
        this.parser.on('parseError', (error, command, context) => {
            this.emit('parseError', error, command, context);
        });

        this.registry.on('commandRegistered', (definition) => {
            this.emit('commandRegistered', definition);
        });

        this.registry.on('registrationError', (error, definition) => {
            this.emit('registrationError', error, definition);
        });
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.executions.clear();
        this.removeAllListeners();
        this.parser.removeAllListeners();
        this.registry.removeAllListeners();
    }

    /**
     * 重設路由器狀態
     */
    reset() {
        this.executions.clear();
        this.executionCounter = 0;
        this.metrics = {
            totalCommands: 0,
            successfulCommands: 0,
            failedCommands: 0,
            averageExecutionTime: 0,
            activeExecutions: 0,
            peakConcurrency: 0
        };

        this.emit('routerReset');
    }
}

// 創建預設的路由器實例
export const defaultRouter = new CommandRouter();

// 便利函數
export const routeCommand = (command, context) => defaultRouter.route(command, context);
export const registerCommand = (definition, handler, options) =>
    defaultRouter.registerCommand(definition, handler, options);
export const useMiddleware = (type, middleware, options) =>
    defaultRouter.use(type, middleware, options);
export const getRouterMetrics = () => defaultRouter.getMetrics();

export default CommandRouter;