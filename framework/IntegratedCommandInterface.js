/**
 * IntegratedCommandInterface - 混合命令接口核心
 *
 * 功能：
 * - 統一CCPM+SuperClaude整合命令接口
 * - 提供直觀的/integrated:*命令系列
 * - 智能命令解析和參數驗證
 * - 實時執行反饋和進度顯示
 * - 支持命令組合和管道操作
 *
 * 用途：CCPM+SuperClaude整合的用戶友好接口層
 * 配合：基於完整基礎架構提供統一用戶體驗
 */

import EventEmitter from 'eventemitter3';
import { createRequire } from 'module';
import { CommandRouter } from './CommandRouter.js';

// 動態導入 CommonJS 模塊
let EventBus, ParallelExecutor, SmartRouter, StateSynchronizer;

async function loadDependencies() {
    const [eventBusModule, parallelExecutorModule, smartRouterModule, stateSynchronizerModule] = await Promise.all([
        import('./EventBus.js'),
        import('./ParallelExecutor.js'),
        import('./SmartRouter.js'),
        import('./StateSynchronizer.js')
    ]);

    EventBus = eventBusModule.default;
    ParallelExecutor = parallelExecutorModule.default;
    SmartRouter = smartRouterModule.default;
    StateSynchronizer = stateSynchronizerModule.default;
}

// 整合命令接口錯誤類型
export class IntegratedCommandError extends Error {
    constructor(message, code, command = null, context = null) {
        super(message);
        this.name = 'IntegratedCommandError';
        this.code = code;
        this.command = command;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

// 命令執行狀態
export const COMMAND_EXECUTION_STATUS = {
    PENDING: 'pending',
    PARSING: 'parsing',
    VALIDATING: 'validating',
    ROUTING: 'routing',
    EXECUTING: 'executing',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// 整合命令類型
export const INTEGRATED_COMMAND_TYPES = {
    STATUS: 'status',
    ANALYZE: 'analyze',
    WORKFLOW: 'workflow',
    REPORT: 'report',
    CONFIG: 'config',
    HELP: 'help',
    MONITOR: 'monitor',
    OPTIMIZE: 'optimize',
    DEBUG: 'debug',
    TEST: 'test'
};

// 命令優先級
export const COMMAND_PRIORITY = {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    CRITICAL: 4,
    EMERGENCY: 5
};

/**
 * 命令執行上下文
 */
class CommandExecutionContext {
    constructor(command, options = {}) {
        this.id = this._generateId();
        this.command = command;
        this.timestamp = Date.now();
        this.status = COMMAND_EXECUTION_STATUS.PENDING;

        // 解析結果
        this.parsedCommand = null;
        this.commandType = null;
        this.parameters = {};
        this.flags = {};

        // 執行配置
        this.priority = options.priority || COMMAND_PRIORITY.NORMAL;
        this.timeout = options.timeout || 30000;
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 3;

        // 執行結果
        this.result = null;
        this.error = null;
        this.executionTime = 0;
        this.resources = {};

        // 進度追蹤
        this.progress = {
            current: 0,
            total: 0,
            message: '',
            steps: []
        };

        // 用戶選項
        this.options = {
            verbose: false,
            showProgress: true,
            interactive: false,
            dryRun: false,
            ...options
        };
    }

    _generateId() {
        return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 更新執行進度
     */
    updateProgress(current, total, message = '', stepData = null) {
        this.progress.current = current;
        this.progress.total = total;
        this.progress.message = message;

        if (stepData) {
            this.progress.steps.push({
                timestamp: Date.now(),
                ...stepData
            });
        }
    }

    /**
     * 獲取進度百分比
     */
    getProgressPercentage() {
        if (this.progress.total === 0) return 0;
        return Math.round((this.progress.current / this.progress.total) * 100);
    }
}

/**
 * 整合命令接口主類
 */
export class IntegratedCommandInterface extends EventEmitter {
    constructor(options = {}) {
        super();
        this.dependenciesLoaded = false;

        this.options = {
            // 性能配置
            commandTimeout: 30000,          // 30秒命令超時
            executionDelay: 50,             // 50ms執行延遲目標
            maxConcurrentCommands: 20,      // 最大並發命令數

            // 用戶體驗配置
            enableProgress: true,           // 啟用進度顯示
            enableInteractiveMode: true,    // 啟用互動模式
            enableSmartSuggestions: true,   // 啟用智能建議
            enableCommandHistory: true,     // 啟用命令歷史

            // 整合配置
            enableSmartRouting: true,       // 啟用智能路由
            enableParallelExecution: true,  // 啟用並行執行
            enableStateSynchronization: true, // 啟用狀態同步

            // 安全配置
            enableCommandValidation: true,  // 啟用命令驗證
            enablePermissionChecks: true,   // 啟用權限檢查
            enableAuditLogging: true,       // 啟用審計日誌

            ...options
        };

        // 核心組件 - 延遲初始化
        this.commandRouter = null;
        this.smartRouter = null;
        this.parallelExecutor = null;
        this.eventBus = null;
        this.stateSynchronizer = null;

        // 子系統組件
        this.commandCompletion = null;
        this.commandHistory = null;
        this.helpSystem = null;

        // 命令狀態管理
        this.activeCommands = new Map();        // commandId -> CommandExecutionContext
        this.commandQueue = [];                 // 待執行命令隊列
        this.commandRegistry = new Map();       // 已註冊的整合命令

        // 性能統計
        this.stats = {
            totalCommands: 0,
            successfulCommands: 0,
            failedCommands: 0,
            averageExecutionTime: 0,
            averageResponseTime: 0,
            currentLoad: 0,
            peakConcurrency: 0
        };

        // 初始化狀態
        this.initialized = false;
        this.ready = false;

        // 註冊內建命令
        this._registerBuiltinCommands();
    }

    /**
     * 初始化整合命令接口
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[IntegratedCommandInterface] 開始初始化整合命令接口...');

            // 加載依賴項
            if (!this.dependenciesLoaded) {
                await loadDependencies();
                this.dependenciesLoaded = true;
            }

            // 初始化核心基礎架構
            await this._initializeCoreInfrastructure();

            // 初始化子系統
            await this._initializeSubsystems();

            // 設置事件監聽
            this._setupEventListeners();

            // 驗證系統完整性
            await this._validateSystemIntegrity();

            this.initialized = true;
            this.ready = true;

            console.log('[IntegratedCommandInterface] 整合命令接口初始化完成');
            this.emit('initialized', {
                timestamp: Date.now(),
                componentsLoaded: this._getLoadedComponents(),
                commandsRegistered: Array.from(this.commandRegistry.keys())
            });

        } catch (error) {
            console.error('[IntegratedCommandInterface] 初始化失敗:', error);
            this.ready = false;
            throw new IntegratedCommandError(
                '整合命令接口初始化失敗',
                'INITIALIZATION_FAILED',
                null,
                { error: error.message }
            );
        }
    }

    /**
     * 執行整合命令 - 主入口
     * @param {string} commandString - 命令字符串
     * @param {Object} options - 執行選項
     * @returns {Promise<Object>} 執行結果
     */
    async execute(commandString, options = {}) {
        // 確保系統已初始化
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.ready) {
            throw new IntegratedCommandError(
                '系統未就緒，無法執行命令',
                'SYSTEM_NOT_READY',
                commandString
            );
        }

        const startTime = Date.now();

        // 創建命令執行上下文
        const context = new CommandExecutionContext(commandString, options);
        this.activeCommands.set(context.id, context);

        try {
            // 發送命令開始事件
            this.emit('commandStarted', {
                commandId: context.id,
                command: commandString,
                timestamp: startTime
            });

            // 執行命令處理流水線
            const result = await this._executeCommandPipeline(context);

            // 更新統計信息
            this._updateStatistics(context, true);

            // 發送命令完成事件
            this.emit('commandCompleted', {
                commandId: context.id,
                result,
                executionTime: Date.now() - startTime
            });

            return result;

        } catch (error) {
            // 更新統計信息
            this._updateStatistics(context, false);

            // 發送命令失敗事件
            this.emit('commandFailed', {
                commandId: context.id,
                error: error.message,
                executionTime: Date.now() - startTime
            });

            throw error;

        } finally {
            // 清理命令上下文
            this._cleanupCommandContext(context);
        }
    }

    /**
     * 批量執行命令
     * @param {Array} commands - 命令列表
     * @param {Object} options - 批量選項
     * @returns {Promise<Array>} 執行結果列表
     */
    async executeBatch(commands, options = {}) {
        const {
            parallel = true,
            stopOnError = false,
            maxBatchSize = 50,
            progressCallback = null
        } = options;

        if (commands.length > maxBatchSize) {
            throw new IntegratedCommandError(
                `批量命令數量超過限制 (${maxBatchSize})`,
                'BATCH_SIZE_EXCEEDED'
            );
        }

        const results = [];
        let completed = 0;

        const updateProgress = () => {
            completed++;
            if (progressCallback) {
                progressCallback(completed, commands.length, results);
            }
        };

        if (parallel) {
            // 並行執行
            const promises = commands.map((cmd, index) =>
                this.execute(cmd, { ...options, batchIndex: index })
                    .then(result => {
                        updateProgress();
                        return { success: true, result, command: cmd, index };
                    })
                    .catch(error => {
                        updateProgress();
                        return { success: false, error, command: cmd, index };
                    })
            );

            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (!result.success && stopOnError) {
                    throw result.error;
                }
                results.push(result);
            }
        } else {
            // 順序執行
            for (let i = 0; i < commands.length; i++) {
                try {
                    const result = await this.execute(commands[i], { ...options, batchIndex: i });
                    results.push({ success: true, result, command: commands[i], index: i });
                    updateProgress();
                } catch (error) {
                    const errorResult = { success: false, error, command: commands[i], index: i };
                    results.push(errorResult);
                    updateProgress();

                    if (stopOnError) {
                        throw error;
                    }
                }
            }
        }

        return results;
    }

    /**
     * 註冊整合命令
     * @param {string} name - 命令名稱
     * @param {Function} handler - 命令處理器
     * @param {Object} definition - 命令定義
     */
    registerCommand(name, handler, definition = {}) {
        if (this.commandRegistry.has(name)) {
            throw new IntegratedCommandError(
                `命令已存在: ${name}`,
                'COMMAND_ALREADY_EXISTS',
                name
            );
        }

        const commandDef = {
            name,
            handler,
            type: definition.type || 'custom',
            description: definition.description || '',
            parameters: definition.parameters || [],
            flags: definition.flags || [],
            examples: definition.examples || [],
            category: definition.category || 'general',
            priority: definition.priority || COMMAND_PRIORITY.NORMAL,
            timeout: definition.timeout || this.options.commandTimeout,
            requiresPermission: definition.requiresPermission || false,
            ...definition
        };

        this.commandRegistry.set(name, commandDef);

        console.log(`[IntegratedCommandInterface] 已註冊命令: /integrated:${name}`);
        this.emit('commandRegistered', { name, definition: commandDef });
    }

    /**
     * 獲取可用命令列表
     * @param {Object} filters - 過濾條件
     * @returns {Array} 命令列表
     */
    getAvailableCommands(filters = {}) {
        let commands = Array.from(this.commandRegistry.values());

        if (filters.category) {
            commands = commands.filter(cmd => cmd.category === filters.category);
        }

        if (filters.type) {
            commands = commands.filter(cmd => cmd.type === filters.type);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            commands = commands.filter(cmd =>
                cmd.name.toLowerCase().includes(searchTerm) ||
                cmd.description.toLowerCase().includes(searchTerm)
            );
        }

        return commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            category: cmd.category,
            type: cmd.type,
            syntax: this._generateCommandSyntax(cmd)
        }));
    }

    /**
     * 獲取系統狀態
     * @returns {Object} 系統狀態
     */
    getSystemStatus() {
        return {
            initialized: this.initialized,
            ready: this.ready,
            activeCommands: this.activeCommands.size,
            queuedCommands: this.commandQueue.length,
            registeredCommands: this.commandRegistry.size,
            stats: this.getStatistics(),
            components: {
                commandRouter: this.commandRouter?.getExecutionStatus() || null,
                smartRouter: this.smartRouter?.getStats() || null,
                parallelExecutor: this.parallelExecutor?.getStatus() || null,
                eventBus: this.eventBus?.getStats() || null,
                stateSynchronizer: this.stateSynchronizer?.getSyncStatus() || null
            },
            performance: {
                averageResponseTime: this.stats.averageResponseTime,
                currentLoad: this.stats.currentLoad,
                peakConcurrency: this.stats.peakConcurrency
            }
        };
    }

    /**
     * 獲取執行統計
     * @returns {Object} 統計信息
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalCommands > 0 ?
                ((this.stats.successfulCommands / this.stats.totalCommands) * 100).toFixed(2) + '%' : '0%',
            uptime: this.initialized ? Date.now() - this.initTime : 0,
            commandsPerSecond: this._calculateCommandsPerSecond()
        };
    }

    // ========== 私有方法 ==========

    /**
     * 初始化核心基礎架構
     * @private
     */
    async _initializeCoreInfrastructure() {
        console.log('[IntegratedCommandInterface] 初始化核心基礎架構...');

        // 初始化 CommandRouter
        this.commandRouter = new CommandRouter({
            timeout: this.options.commandTimeout,
            enableMetrics: true,
            maxConcurrency: this.options.maxConcurrentCommands
        });

        // 初始化 SmartRouter
        this.smartRouter = new SmartRouter({
            decisionTimeLimit: this.options.executionDelay,
            enablePersonalization: true,
            enableLoadBalancing: true
        });
        await this.smartRouter.initialize();

        // 初始化 ParallelExecutor
        this.parallelExecutor = new ParallelExecutor({
            maxConcurrency: this.options.maxConcurrentCommands,
            enableOptimization: true
        });
        await this.parallelExecutor.initialize();

        // 初始化 EventBus
        this.eventBus = new EventBus({
            enablePersistence: true,
            enableMiddleware: true
        });
        await this.eventBus.initialize();

        // 初始化 StateSynchronizer
        this.stateSynchronizer = new StateSynchronizer({
            enablePersistence: true,
            defaultMode: 'immediate'
        });
        await this.stateSynchronizer.initialize();

        console.log('[IntegratedCommandInterface] 核心基礎架構初始化完成');
    }

    /**
     * 初始化子系統
     * @private
     */
    async _initializeSubsystems() {
        console.log('[IntegratedCommandInterface] 初始化子系統...');

        // 動態導入子系統組件
        if (this.options.enableCommandHistory) {
            const { CommandHistory } = await import('./CommandHistory.js');
            this.commandHistory = new CommandHistory({
                maxHistorySize: 1000,
                enablePersistence: true
            });
            await this.commandHistory.initialize();
        }

        const { CommandCompletion } = await import('./CommandCompletion.js');
        this.commandCompletion = new CommandCompletion({
            commandRegistry: this.commandRegistry,
            enableSmartSuggestions: this.options.enableSmartSuggestions
        });
        await this.commandCompletion.initialize();

        const { HelpSystem } = await import('./HelpSystem.js');
        this.helpSystem = new HelpSystem({
            commandRegistry: this.commandRegistry,
            enableInteractiveHelp: this.options.enableInteractiveMode
        });
        await this.helpSystem.initialize();

        console.log('[IntegratedCommandInterface] 子系統初始化完成');
    }

    /**
     * 執行命令處理流水線
     * @private
     */
    async _executeCommandPipeline(context) {
        const startTime = Date.now();

        try {
            // 階段 1: 命令解析
            context.status = COMMAND_EXECUTION_STATUS.PARSING;
            context.updateProgress(10, 100, '解析命令...');

            const parsed = await this._parseCommand(context.command, context);
            context.parsedCommand = parsed;
            context.commandType = parsed.type;
            context.parameters = parsed.parameters;
            context.flags = parsed.flags;

            // 階段 2: 命令驗證
            context.status = COMMAND_EXECUTION_STATUS.VALIDATING;
            context.updateProgress(20, 100, '驗證命令...');

            await this._validateCommand(context);

            // 階段 3: 智能路由
            if (this.options.enableSmartRouting) {
                context.status = COMMAND_EXECUTION_STATUS.ROUTING;
                context.updateProgress(30, 100, '智能路由分析...');

                const routingDecision = await this.smartRouter.route(context.command, {
                    context: context,
                    requireFastResponse: true
                });
                context.routingDecision = routingDecision;
            }

            // 階段 4: 命令執行
            context.status = COMMAND_EXECUTION_STATUS.EXECUTING;
            context.updateProgress(40, 100, '執行命令...');

            let result;
            if (this.options.enableParallelExecution && this._canExecuteInParallel(context)) {
                result = await this._executeCommandParallel(context);
            } else {
                result = await this._executeCommandSequential(context);
            }

            // 階段 5: 結果處理
            context.status = COMMAND_EXECUTION_STATUS.PROCESSING;
            context.updateProgress(80, 100, '處理結果...');

            const processedResult = await this._processCommandResult(result, context);

            // 階段 6: 狀態同步
            if (this.options.enableStateSynchronization) {
                context.updateProgress(90, 100, '同步狀態...');

                await this.stateSynchronizer.syncState('command_execution', {
                    commandId: context.id,
                    result: processedResult,
                    timestamp: Date.now()
                });
            }

            // 完成
            context.status = COMMAND_EXECUTION_STATUS.COMPLETED;
            context.updateProgress(100, 100, '執行完成');
            context.executionTime = Date.now() - startTime;
            context.result = processedResult;

            return processedResult;

        } catch (error) {
            context.status = COMMAND_EXECUTION_STATUS.FAILED;
            context.error = error;
            context.executionTime = Date.now() - startTime;

            throw new IntegratedCommandError(
                `命令執行失敗: ${error.message}`,
                'COMMAND_EXECUTION_FAILED',
                context.command,
                context
            );
        }
    }

    /**
     * 解析命令
     * @private
     */
    async _parseCommand(commandString, context) {
        const trimmed = commandString.trim();

        // 檢查是否為整合命令
        if (!trimmed.startsWith('/integrated:')) {
            throw new IntegratedCommandError(
                '無效的整合命令格式。請使用 /integrated:命令名稱',
                'INVALID_COMMAND_FORMAT',
                commandString
            );
        }

        // 移除前綴
        const withoutPrefix = trimmed.substring(12); // "/integrated:".length

        // 分割命令和參數
        const parts = withoutPrefix.split(/\s+/);
        const commandName = parts[0];
        const args = parts.slice(1);

        // 解析參數和標誌
        const parameters = {};
        const flags = {};
        const positionalArgs = [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                // 長標誌
                const flagName = arg.substring(2);
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    parameters[flagName] = args[++i];
                } else {
                    flags[flagName] = true;
                }
            } else if (arg.startsWith('-')) {
                // 短標誌
                const flagName = arg.substring(1);
                flags[flagName] = true;
            } else {
                // 位置參數
                positionalArgs.push(arg);
            }
        }

        return {
            type: this._determineCommandType(commandName),
            command: commandName,
            fullCommand: commandString,
            parameters,
            flags,
            positionalArgs,
            raw: withoutPrefix
        };
    }

    /**
     * 驗證命令
     * @private
     */
    async _validateCommand(context) {
        const { parsedCommand } = context;

        // 檢查命令是否已註冊
        if (!this.commandRegistry.has(parsedCommand.command)) {
            throw new IntegratedCommandError(
                `未知的整合命令: ${parsedCommand.command}`,
                'UNKNOWN_COMMAND',
                parsedCommand.fullCommand
            );
        }

        const commandDef = this.commandRegistry.get(parsedCommand.command);

        // 權限檢查
        if (commandDef.requiresPermission && this.options.enablePermissionChecks) {
            // 實現權限檢查邏輯
            console.log(`[IntegratedCommandInterface] 檢查命令權限: ${parsedCommand.command}`);
        }

        // 參數驗證
        await this._validateCommandParameters(parsedCommand, commandDef);

        // 前置條件檢查
        if (commandDef.preconditions) {
            await this._checkPreconditions(commandDef.preconditions, context);
        }
    }

    /**
     * 驗證命令參數
     * @private
     */
    async _validateCommandParameters(parsed, commandDef) {
        for (const paramDef of commandDef.parameters || []) {
            const value = parsed.parameters[paramDef.name];

            if (paramDef.required && value === undefined) {
                throw new IntegratedCommandError(
                    `缺少必需參數: ${paramDef.name}`,
                    'MISSING_REQUIRED_PARAMETER',
                    parsed.fullCommand
                );
            }

            if (value !== undefined) {
                // 類型驗證
                if (paramDef.type === 'number' && isNaN(Number(value))) {
                    throw new IntegratedCommandError(
                        `參數 ${paramDef.name} 必須是數字`,
                        'INVALID_PARAMETER_TYPE',
                        parsed.fullCommand
                    );
                }

                // 範圍驗證
                if (paramDef.min !== undefined && Number(value) < paramDef.min) {
                    throw new IntegratedCommandError(
                        `參數 ${paramDef.name} 不能小於 ${paramDef.min}`,
                        'PARAMETER_OUT_OF_RANGE',
                        parsed.fullCommand
                    );
                }

                if (paramDef.max !== undefined && Number(value) > paramDef.max) {
                    throw new IntegratedCommandError(
                        `參數 ${paramDef.name} 不能大於 ${paramDef.max}`,
                        'PARAMETER_OUT_OF_RANGE',
                        parsed.fullCommand
                    );
                }
            }
        }
    }

    /**
     * 檢查前置條件
     * @private
     */
    async _checkPreconditions(preconditions, context) {
        for (const condition of preconditions) {
            if (typeof condition === 'function') {
                const result = await condition(context);
                if (!result.passed) {
                    throw new IntegratedCommandError(
                        `前置條件檢查失敗: ${result.message}`,
                        'PRECONDITION_FAILED',
                        context.command
                    );
                }
            }
        }
    }

    /**
     * 順序執行命令
     * @private
     */
    async _executeCommandSequential(context) {
        const commandDef = this.commandRegistry.get(context.parsedCommand.command);

        try {
            const result = await commandDef.handler({
                command: context.parsedCommand,
                context: context,
                services: {
                    commandRouter: this.commandRouter,
                    smartRouter: this.smartRouter,
                    parallelExecutor: this.parallelExecutor,
                    eventBus: this.eventBus,
                    stateSynchronizer: this.stateSynchronizer
                }
            });

            return result;

        } catch (error) {
            throw new IntegratedCommandError(
                `命令處理器執行失敗: ${error.message}`,
                'HANDLER_EXECUTION_FAILED',
                context.command,
                { originalError: error }
            );
        }
    }

    /**
     * 並行執行命令
     * @private
     */
    async _executeCommandParallel(context) {
        // 創建並行執行計劃
        const executionPlan = {
            id: `plan_${context.id}`,
            tasks: [
                {
                    id: `task_${context.id}`,
                    type: 'command',
                    command: context.parsedCommand,
                    context: context
                }
            ],
            strategy: 'adaptive',
            timeout: context.timeout
        };

        const result = await this.parallelExecutor.execute(executionPlan);

        // 從並行執行結果中提取命令結果
        return result.results[0]?.result;
    }

    /**
     * 處理命令結果
     * @private
     */
    async _processCommandResult(result, context) {
        // 結果格式化
        const processedResult = {
            success: true,
            data: result,
            metadata: {
                commandId: context.id,
                command: context.parsedCommand.command,
                executionTime: context.executionTime,
                timestamp: Date.now()
            },
            context: {
                parameters: context.parameters,
                flags: context.flags,
                progress: context.progress
            }
        };

        // 審計日誌
        if (this.options.enableAuditLogging) {
            await this.eventBus.publish('command_audit', {
                commandId: context.id,
                command: context.command,
                result: processedResult,
                timestamp: Date.now()
            });
        }

        // 更新命令歷史
        if (this.commandHistory) {
            await this.commandHistory.addEntry({
                command: context.command,
                result: processedResult,
                timestamp: Date.now()
            });
        }

        return processedResult;
    }

    /**
     * 註冊內建命令
     * @private
     */
    _registerBuiltinCommands() {
        // /integrated:status - 顯示系統整合狀態
        this.registerCommand('status', this._handleStatusCommand.bind(this), {
            type: INTEGRATED_COMMAND_TYPES.STATUS,
            description: '顯示CCPM+SuperClaude整合系統的完整狀態',
            category: 'system',
            examples: [
                '/integrated:status',
                '/integrated:status --verbose',
                '/integrated:status --component=router'
            ],
            flags: [
                { name: 'verbose', description: '顯示詳細信息' },
                { name: 'json', description: '輸出JSON格式' }
            ],
            parameters: [
                { name: 'component', description: '指定組件', type: 'string' }
            ]
        });

        // /integrated:help - 顯示整合命令幫助
        this.registerCommand('help', this._handleHelpCommand.bind(this), {
            type: INTEGRATED_COMMAND_TYPES.HELP,
            description: '顯示整合命令系統的使用幫助',
            category: 'help',
            examples: [
                '/integrated:help',
                '/integrated:help status',
                '/integrated:help --category=system'
            ],
            parameters: [
                { name: 'command', description: '特定命令名稱', type: 'string' }
            ],
            flags: [
                { name: 'category', description: '按類別過濾' }
            ]
        });

        console.log('[IntegratedCommandInterface] 已註冊內建命令');
    }

    /**
     * 處理 status 命令
     * @private
     */
    async _handleStatusCommand({ command, context }) {
        const verbose = command.flags.verbose || false;
        const jsonOutput = command.flags.json || false;
        const component = command.parameters.component;

        const status = this.getSystemStatus();

        if (component) {
            const componentStatus = status.components[component];
            if (!componentStatus) {
                throw new IntegratedCommandError(
                    `未知的組件: ${component}`,
                    'UNKNOWN_COMPONENT',
                    command.fullCommand
                );
            }

            return jsonOutput ? componentStatus : this._formatComponentStatus(component, componentStatus, verbose);
        }

        if (jsonOutput) {
            return status;
        }

        return this._formatSystemStatus(status, verbose);
    }

    /**
     * 處理 help 命令
     * @private
     */
    async _handleHelpCommand({ command, context }) {
        const commandName = command.parameters.command;
        const category = command.parameters.category;

        if (commandName) {
            // 顯示特定命令幫助
            return await this.helpSystem.getCommandHelp(commandName);
        }

        if (category) {
            // 顯示特定類別幫助
            return await this.helpSystem.getCategoryHelp(category);
        }

        // 顯示總體幫助
        return await this.helpSystem.getOverallHelp();
    }

    /**
     * 格式化系統狀態
     * @private
     */
    _formatSystemStatus(status, verbose) {
        let output = '🚀 CCPM+SuperClaude 整合系統狀態\n';
        output += '=' .repeat(50) + '\n\n';

        output += `📊 系統概覽:\n`;
        output += `   初始化狀態: ${status.initialized ? '✅' : '❌'}\n`;
        output += `   就緒狀態: ${status.ready ? '✅' : '❌'}\n`;
        output += `   活動命令: ${status.activeCommands}\n`;
        output += `   註冊命令: ${status.registeredCommands}\n`;
        output += `   成功率: ${status.stats.successRate}\n\n`;

        output += `⚡ 性能指標:\n`;
        output += `   平均響應時間: ${status.performance.averageResponseTime}ms\n`;
        output += `   當前負載: ${(status.performance.currentLoad * 100).toFixed(1)}%\n`;
        output += `   峰值並發: ${status.performance.peakConcurrency}\n\n`;

        if (verbose) {
            output += `🔧 核心組件:\n`;
            Object.entries(status.components).forEach(([name, comp]) => {
                if (comp) {
                    output += `   ${name}: ✅ 運行中\n`;
                } else {
                    output += `   ${name}: ❌ 未載入\n`;
                }
            });
        }

        return output;
    }

    /**
     * 格式化組件狀態
     * @private
     */
    _formatComponentStatus(name, status, verbose) {
        let output = `🔧 ${name} 組件狀態\n`;
        output += '=' .repeat(30) + '\n\n';

        if (typeof status === 'object') {
            output += JSON.stringify(status, null, 2);
        } else {
            output += `狀態: ${status || '未知'}\n`;
        }

        return output;
    }

    /**
     * 其他輔助方法
     * @private
     */
    _determineCommandType(commandName) {
        const typeMapping = {
            'status': INTEGRATED_COMMAND_TYPES.STATUS,
            'analyze': INTEGRATED_COMMAND_TYPES.ANALYZE,
            'workflow': INTEGRATED_COMMAND_TYPES.WORKFLOW,
            'report': INTEGRATED_COMMAND_TYPES.REPORT,
            'config': INTEGRATED_COMMAND_TYPES.CONFIG,
            'help': INTEGRATED_COMMAND_TYPES.HELP,
            'monitor': INTEGRATED_COMMAND_TYPES.MONITOR,
            'optimize': INTEGRATED_COMMAND_TYPES.OPTIMIZE,
            'debug': INTEGRATED_COMMAND_TYPES.DEBUG,
            'test': INTEGRATED_COMMAND_TYPES.TEST
        };

        return typeMapping[commandName] || 'unknown';
    }

    _canExecuteInParallel(context) {
        const commandDef = this.commandRegistry.get(context.parsedCommand.command);
        return commandDef?.parallelizable !== false;
    }

    _generateCommandSyntax(commandDef) {
        let syntax = `/integrated:${commandDef.name}`;

        if (commandDef.parameters?.length) {
            commandDef.parameters.forEach(param => {
                if (param.required) {
                    syntax += ` --${param.name} <${param.type || 'value'}>`;
                } else {
                    syntax += ` [--${param.name} <${param.type || 'value'}>]`;
                }
            });
        }

        if (commandDef.flags?.length) {
            commandDef.flags.forEach(flag => {
                syntax += ` [--${flag.name}]`;
            });
        }

        return syntax;
    }

    _updateStatistics(context, success) {
        this.stats.totalCommands++;

        if (success) {
            this.stats.successfulCommands++;
        } else {
            this.stats.failedCommands++;
        }

        // 更新平均執行時間
        if (context.executionTime) {
            this.stats.averageExecutionTime = (
                (this.stats.averageExecutionTime * (this.stats.totalCommands - 1) + context.executionTime) /
                this.stats.totalCommands
            );
        }

        // 更新當前負載
        this.stats.currentLoad = this.activeCommands.size / this.options.maxConcurrentCommands;

        // 更新峰值並發
        if (this.activeCommands.size > this.stats.peakConcurrency) {
            this.stats.peakConcurrency = this.activeCommands.size;
        }
    }

    _calculateCommandsPerSecond() {
        if (!this.initTime || this.stats.totalCommands === 0) {
            return 0;
        }

        const uptimeSeconds = (Date.now() - this.initTime) / 1000;
        return (this.stats.totalCommands / uptimeSeconds).toFixed(2);
    }

    _cleanupCommandContext(context) {
        this.activeCommands.delete(context.id);

        // 延遲清理詳細記錄
        setTimeout(() => {
            // 保留在歷史記錄中，但清理詳細上下文
            if (this.commandHistory) {
                // 歷史記錄已在結果處理時保存
            }
        }, 60000);
    }

    _getLoadedComponents() {
        return {
            commandRouter: !!this.commandRouter,
            smartRouter: !!this.smartRouter,
            parallelExecutor: !!this.parallelExecutor,
            eventBus: !!this.eventBus,
            stateSynchronizer: !!this.stateSynchronizer,
            commandHistory: !!this.commandHistory,
            commandCompletion: !!this.commandCompletion,
            helpSystem: !!this.helpSystem
        };
    }

    _setupEventListeners() {
        // 監聽核心組件事件
        if (this.eventBus) {
            this.eventBus.on('error', (error) => {
                console.error('[IntegratedCommandInterface] EventBus錯誤:', error);
                this.emit('systemError', { component: 'eventBus', error });
            });
        }

        if (this.smartRouter) {
            this.smartRouter.on('routingCompleted', (data) => {
                this.emit('routingDecision', data);
            });
        }

        if (this.parallelExecutor) {
            this.parallelExecutor.on('executionCompleted', (data) => {
                this.emit('parallelExecutionCompleted', data);
            });
        }
    }

    async _validateSystemIntegrity() {
        const requiredComponents = [
            'commandRouter',
            'smartRouter',
            'parallelExecutor',
            'eventBus',
            'stateSynchronizer'
        ];

        const missingComponents = requiredComponents.filter(comp => !this[comp]);

        if (missingComponents.length > 0) {
            throw new Error(`缺少必需組件: ${missingComponents.join(', ')}`);
        }

        console.log('[IntegratedCommandInterface] 系統完整性驗證通過');
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            console.log('[IntegratedCommandInterface] 開始清理資源...');

            // 等待活動命令完成
            if (this.activeCommands.size > 0) {
                console.log(`[IntegratedCommandInterface] 等待 ${this.activeCommands.size} 個活動命令完成...`);
                // 實現等待邏輯或強制終止
            }

            // 清理子系統
            if (this.commandHistory) await this.commandHistory.dispose();
            if (this.commandCompletion) await this.commandCompletion.dispose();
            if (this.helpSystem) await this.helpSystem.dispose();

            // 清理核心組件
            if (this.stateSynchronizer) await this.stateSynchronizer.cleanup();
            if (this.eventBus) await this.eventBus.dispose();
            if (this.parallelExecutor) await this.parallelExecutor.dispose();
            if (this.smartRouter) await this.smartRouter.dispose();
            if (this.commandRouter) this.commandRouter.cleanup();

            // 清理狀態
            this.activeCommands.clear();
            this.commandQueue.length = 0;
            this.commandRegistry.clear();

            this.initialized = false;
            this.ready = false;

            this.removeAllListeners();
            console.log('[IntegratedCommandInterface] 資源清理完成');

        } catch (error) {
            console.error('[IntegratedCommandInterface] 資源清理失敗:', error);
            throw error;
        }
    }
}

// 創建默認實例
export const integratedCommandInterface = new IntegratedCommandInterface();

// 便利函數
export const executeIntegratedCommand = (command, options) =>
    integratedCommandInterface.execute(command, options);

export const getIntegratedSystemStatus = () =>
    integratedCommandInterface.getSystemStatus();

export const registerIntegratedCommand = (name, handler, definition) =>
    integratedCommandInterface.registerCommand(name, handler, definition);

export default IntegratedCommandInterface;