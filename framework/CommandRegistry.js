/**
 * CommandRegistry - 統一命令路由系統的命令註冊表
 *
 * 功能：
 * - 註冊和管理所有系統命令
 * - 存儲命令元數據和處理器
 * - 提供命令發現和驗證機制
 * - 支持動態命令載入和卸載
 * - 處理命令衝突和優先級
 *
 * 支援的命令類型：
 * - CCPM 命令 (/pm:*)
 * - SuperClaude 命令 (/sc:*)
 * - 整合命令 (/integrated:*)
 */

import EventEmitter from 'eventemitter3';
import { COMMAND_TYPES } from './CommandParser.js';

// 命令註冊錯誤
export class CommandRegistryError extends Error {
    constructor(message, code, command = null) {
        super(message);
        this.name = 'CommandRegistryError';
        this.code = code;
        this.command = command;
    }
}

// 命令狀態
export const COMMAND_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DEPRECATED: 'deprecated',
    DISABLED: 'disabled'
};

// 命令優先級
export const COMMAND_PRIORITY = {
    CRITICAL: 1000,
    HIGH: 100,
    NORMAL: 10,
    LOW: 1
};

export class CommandRegistry extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            allowOverride: false, // 是否允許覆蓋現有命令
            enableMetrics: true, // 啟用命令使用統計
            validateHandlers: true, // 驗證命令處理器
            ...options
        };

        // 命令存儲結構
        this.commands = new Map(); // command -> CommandDefinition
        this.namespaces = new Map(); // namespace -> Set<command>
        this.aliases = new Map(); // alias -> command
        this.handlers = new Map(); // command -> handler function
        this.middleware = new Map(); // command -> middleware[]

        // 統計數據
        this.metrics = {
            registrations: 0,
            executions: 0,
            errors: 0,
            lastUsed: new Map() // command -> timestamp
        };

        // 初始化內建命令
        this._initializeBuiltinCommands();
    }

    /**
     * 註冊新命令
     * @param {Object} definition - 命令定義
     * @param {Function} handler - 命令處理器
     * @param {Object} options - 註冊選項
     */
    register(definition, handler, options = {}) {
        try {
            // 驗證命令定義
            this._validateDefinition(definition);

            // 驗證處理器
            if (this.options.validateHandlers) {
                this._validateHandler(handler, definition.command);
            }

            const fullCommand = `${definition.namespace}:${definition.command}`;

            // 檢查命令衝突
            if (this.commands.has(fullCommand) && !this.options.allowOverride && !options.override) {
                throw new CommandRegistryError(
                    `命令 "${fullCommand}" 已存在`,
                    'COMMAND_EXISTS',
                    fullCommand
                );
            }

            // 構建完整的命令定義
            const commandDef = {
                ...definition,
                fullCommand,
                registered: Date.now(),
                status: definition.status || COMMAND_STATUS.ACTIVE,
                priority: definition.priority || COMMAND_PRIORITY.NORMAL,
                metrics: {
                    executions: 0,
                    lastUsed: null,
                    averageTime: 0,
                    errors: 0
                },
                ...options
            };

            // 註冊命令
            this.commands.set(fullCommand, commandDef);
            this.handlers.set(fullCommand, handler);

            // 更新命名空間索引
            if (!this.namespaces.has(definition.namespace)) {
                this.namespaces.set(definition.namespace, new Set());
            }
            this.namespaces.get(definition.namespace).add(fullCommand);

            // 註冊別名
            if (definition.aliases && Array.isArray(definition.aliases)) {
                definition.aliases.forEach(alias => {
                    this.aliases.set(alias, fullCommand);
                });
            }

            // 註冊中間件
            if (definition.middleware && Array.isArray(definition.middleware)) {
                this.middleware.set(fullCommand, definition.middleware);
            }

            // 更新統計
            this.metrics.registrations++;

            // 發送註冊事件
            this.emit('commandRegistered', commandDef);

            return commandDef;

        } catch (error) {
            this.emit('registrationError', error, definition);

            if (error instanceof CommandRegistryError) {
                throw error;
            }

            throw new CommandRegistryError(
                `註冊命令時發生錯誤: ${error.message}`,
                'REGISTRATION_ERROR',
                definition?.command
            );
        }
    }

    /**
     * 卸載命令
     * @param {string} command - 要卸載的命令
     * @returns {boolean} 是否成功卸載
     */
    unregister(command) {
        const fullCommand = this._resolveCommand(command);

        if (!this.commands.has(fullCommand)) {
            return false;
        }

        const commandDef = this.commands.get(fullCommand);

        // 移除命令
        this.commands.delete(fullCommand);
        this.handlers.delete(fullCommand);
        this.middleware.delete(fullCommand);

        // 移除別名
        if (commandDef.aliases) {
            commandDef.aliases.forEach(alias => {
                this.aliases.delete(alias);
            });
        }

        // 更新命名空間索引
        const namespace = this.namespaces.get(commandDef.namespace);
        if (namespace) {
            namespace.delete(fullCommand);
            if (namespace.size === 0) {
                this.namespaces.delete(commandDef.namespace);
            }
        }

        // 發送卸載事件
        this.emit('commandUnregistered', commandDef);

        return true;
    }

    /**
     * 獲取命令定義
     * @param {string} command - 命令名稱
     * @returns {Object|null} 命令定義
     */
    get(command) {
        const fullCommand = this._resolveCommand(command);
        return this.commands.get(fullCommand) || null;
    }

    /**
     * 獲取命令處理器
     * @param {string} command - 命令名稱
     * @returns {Function|null} 命令處理器
     */
    getHandler(command) {
        const fullCommand = this._resolveCommand(command);
        return this.handlers.get(fullCommand) || null;
    }

    /**
     * 獲取命令中間件
     * @param {string} command - 命令名稱
     * @returns {Array} 中間件數組
     */
    getMiddleware(command) {
        const fullCommand = this._resolveCommand(command);
        return this.middleware.get(fullCommand) || [];
    }

    /**
     * 檢查命令是否存在
     * @param {string} command - 命令名稱
     * @returns {boolean} 命令是否存在
     */
    has(command) {
        const fullCommand = this._resolveCommand(command);
        return this.commands.has(fullCommand);
    }

    /**
     * 列出所有命令
     * @param {Object} filter - 過濾條件
     * @returns {Array} 命令列表
     */
    list(filter = {}) {
        let commands = Array.from(this.commands.values());

        // 應用過濾器
        if (filter.namespace) {
            commands = commands.filter(cmd => cmd.namespace === filter.namespace);
        }

        if (filter.status) {
            commands = commands.filter(cmd => cmd.status === filter.status);
        }

        if (filter.type) {
            commands = commands.filter(cmd => cmd.type === filter.type);
        }

        // 排序
        if (filter.sortBy) {
            commands.sort((a, b) => {
                const aVal = a[filter.sortBy];
                const bVal = b[filter.sortBy];
                return filter.sortDesc ? bVal - aVal : aVal - bVal;
            });
        }

        return commands;
    }

    /**
     * 搜索命令
     * @param {string} query - 搜索查詢
     * @param {Object} options - 搜索選項
     * @returns {Array} 匹配的命令
     */
    search(query, options = {}) {
        const {
            fuzzy = false,
            includeDescription = true,
            includeAliases = true,
            limit = 10
        } = options;

        let results = [];
        const queryLower = query.toLowerCase();

        for (const [fullCommand, definition] of this.commands) {
            let score = 0;

            // 檢查命令名稱匹配
            if (fullCommand.toLowerCase().includes(queryLower)) {
                score += 100;
            }

            // 檢查簡短名稱匹配
            if (definition.command.toLowerCase().includes(queryLower)) {
                score += 80;
            }

            // 檢查描述匹配
            if (includeDescription && definition.description) {
                if (definition.description.toLowerCase().includes(queryLower)) {
                    score += 50;
                }
            }

            // 檢查別名匹配
            if (includeAliases && definition.aliases) {
                for (const alias of definition.aliases) {
                    if (alias.toLowerCase().includes(queryLower)) {
                        score += 60;
                        break;
                    }
                }
            }

            // 模糊匹配
            if (fuzzy && score === 0) {
                score = this._fuzzyMatch(queryLower, fullCommand.toLowerCase());
            }

            if (score > 0) {
                results.push({ ...definition, score });
            }
        }

        // 按分數排序並限制結果數量
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * 獲取命名空間下的所有命令
     * @param {string} namespace - 命名空間
     * @returns {Array} 命令列表
     */
    getNamespaceCommands(namespace) {
        const commands = this.namespaces.get(namespace);
        if (!commands) return [];

        return Array.from(commands).map(cmd => this.commands.get(cmd));
    }

    /**
     * 更新命令統計
     * @param {string} command - 命令名稱
     * @param {Object} stats - 統計數據
     */
    updateMetrics(command, stats = {}) {
        if (!this.options.enableMetrics) return;

        const fullCommand = this._resolveCommand(command);
        const definition = this.commands.get(fullCommand);

        if (definition) {
            definition.metrics.executions++;
            definition.metrics.lastUsed = Date.now();

            if (stats.executionTime) {
                const currentAvg = definition.metrics.averageTime || 0;
                const executions = definition.metrics.executions;
                definition.metrics.averageTime = (currentAvg * (executions - 1) + stats.executionTime) / executions;
            }

            if (stats.error) {
                definition.metrics.errors++;
            }

            // 更新全局統計
            this.metrics.executions++;
            this.metrics.lastUsed.set(fullCommand, Date.now());

            if (stats.error) {
                this.metrics.errors++;
            }
        }
    }

    /**
     * 獲取統計報告
     * @returns {Object} 統計報告
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalCommands: this.commands.size,
            activeCommands: this.list({ status: COMMAND_STATUS.ACTIVE }).length,
            namespaces: Array.from(this.namespaces.keys()),
            mostUsed: this._getMostUsedCommands(5),
            recentlyUsed: this._getRecentlyUsedCommands(5)
        };
    }

    /**
     * 驗證命令定義
     * @private
     */
    _validateDefinition(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new CommandRegistryError('命令定義必須是對象', 'INVALID_DEFINITION');
        }

        // 必需字段
        const required = ['namespace', 'command', 'description'];
        for (const field of required) {
            if (!definition[field]) {
                throw new CommandRegistryError(`命令定義缺少必需字段: ${field}`, 'MISSING_FIELD');
            }
        }

        // 驗證命令名稱格式
        if (!/^[a-zA-Z][a-zA-Z0-9\-_]*$/.test(definition.command)) {
            throw new CommandRegistryError(
                `無效的命令名稱格式: ${definition.command}`,
                'INVALID_COMMAND_NAME'
            );
        }

        // 驗證命名空間
        const validNamespaces = ['pm', 'sc', 'integrated'];
        if (!validNamespaces.includes(definition.namespace)) {
            throw new CommandRegistryError(
                `無效的命名空間: ${definition.namespace}`,
                'INVALID_NAMESPACE'
            );
        }
    }

    /**
     * 驗證命令處理器
     * @private
     */
    _validateHandler(handler, command) {
        if (typeof handler !== 'function') {
            throw new CommandRegistryError(
                `命令 "${command}" 的處理器必須是函數`,
                'INVALID_HANDLER'
            );
        }

        // 檢查處理器簽名
        if (handler.length < 1) {
            throw new CommandRegistryError(
                `命令 "${command}" 的處理器必須接受至少一個參數`,
                'INVALID_HANDLER_SIGNATURE'
            );
        }
    }

    /**
     * 解析命令名稱（處理別名）
     * @private
     */
    _resolveCommand(command) {
        // 檢查是否為別名
        if (this.aliases.has(command)) {
            return this.aliases.get(command);
        }

        // 檢查是否為完整命令
        if (this.commands.has(command)) {
            return command;
        }

        // 檢查是否為短命令格式（需要補全命名空間）
        if (!command.includes(':')) {
            // 嘗試在所有命名空間中查找
            for (const namespace of this.namespaces.keys()) {
                const fullCommand = `${namespace}:${command}`;
                if (this.commands.has(fullCommand)) {
                    return fullCommand;
                }
            }
        }

        return command;
    }

    /**
     * 模糊匹配算法
     * @private
     */
    _fuzzyMatch(pattern, text) {
        let score = 0;
        let patternIdx = 0;

        for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
            if (text[i] === pattern[patternIdx]) {
                score++;
                patternIdx++;
            }
        }

        return patternIdx === pattern.length ? score : 0;
    }

    /**
     * 獲取最常使用的命令
     * @private
     */
    _getMostUsedCommands(limit = 5) {
        return Array.from(this.commands.values())
            .sort((a, b) => b.metrics.executions - a.metrics.executions)
            .slice(0, limit)
            .map(cmd => ({
                command: cmd.fullCommand,
                executions: cmd.metrics.executions
            }));
    }

    /**
     * 獲取最近使用的命令
     * @private
     */
    _getRecentlyUsedCommands(limit = 5) {
        return Array.from(this.commands.values())
            .filter(cmd => cmd.metrics.lastUsed)
            .sort((a, b) => b.metrics.lastUsed - a.metrics.lastUsed)
            .slice(0, limit)
            .map(cmd => ({
                command: cmd.fullCommand,
                lastUsed: cmd.metrics.lastUsed
            }));
    }

    /**
     * 初始化內建命令
     * @private
     */
    _initializeBuiltinCommands() {
        // 註冊整合命令的基本命令
        this.register({
            namespace: 'integrated',
            command: 'status',
            description: '顯示系統整合狀態',
            type: COMMAND_TYPES.INTEGRATED,
            parameters: [],
            flags: [
                { name: 'format', description: '輸出格式', default: 'text', options: ['text', 'json', 'yaml'] },
                { name: 'detailed', description: '顯示詳細信息', type: 'boolean', default: false }
            ]
        }, async (context) => {
            return {
                status: 'active',
                commands: this.commands.size,
                namespaces: this.namespaces.size,
                uptime: Date.now() - this.metrics.registrations
            };
        });

        this.register({
            namespace: 'integrated',
            command: 'help',
            description: '顯示可用命令幫助',
            type: COMMAND_TYPES.INTEGRATED,
            parameters: [
                { name: 'command', description: '特定命令名稱', optional: true }
            ],
            flags: [
                { name: 'namespace', description: '過濾命名空間', optional: true }
            ]
        }, async (context) => {
            const { arguments: args, flags } = context;
            const command = args[0];
            const namespace = flags.namespace;

            if (command) {
                const def = this.get(command);
                return def ? this._formatCommandHelp(def) : `命令 "${command}" 不存在`;
            }

            const filter = namespace ? { namespace } : {};
            const commands = this.list(filter);

            return this._formatCommandsList(commands);
        });

        this.register({
            namespace: 'integrated',
            command: 'config',
            description: '配置整合設置',
            type: COMMAND_TYPES.INTEGRATED,
            parameters: [
                { name: 'key', description: '配置鍵', optional: true },
                { name: 'value', description: '配置值', optional: true }
            ],
            flags: [
                { name: 'list', description: '列出所有配置', type: 'boolean', default: false },
                { name: 'reset', description: '重置配置', type: 'boolean', default: false }
            ]
        }, async (context) => {
            // 基本配置管理實現
            return { message: '配置功能待實現' };
        });
    }

    /**
     * 格式化命令幫助信息
     * @private
     */
    _formatCommandHelp(definition) {
        let help = `命令: ${definition.fullCommand}\n`;
        help += `描述: ${definition.description}\n`;

        if (definition.parameters && definition.parameters.length > 0) {
            help += '\n參數:\n';
            definition.parameters.forEach(param => {
                help += `  ${param.name}${param.optional ? ' (可選)' : ''}: ${param.description}\n`;
            });
        }

        if (definition.flags && definition.flags.length > 0) {
            help += '\n標記:\n';
            definition.flags.forEach(flag => {
                help += `  --${flag.name}: ${flag.description}`;
                if (flag.default !== undefined) {
                    help += ` (預設: ${flag.default})`;
                }
                help += '\n';
            });
        }

        if (definition.aliases && definition.aliases.length > 0) {
            help += `\n別名: ${definition.aliases.join(', ')}`;
        }

        return help;
    }

    /**
     * 格式化命令列表
     * @private
     */
    _formatCommandsList(commands) {
        if (commands.length === 0) {
            return '沒有找到匹配的命令';
        }

        let output = '可用命令:\n\n';

        // 按命名空間分組
        const grouped = commands.reduce((acc, cmd) => {
            if (!acc[cmd.namespace]) acc[cmd.namespace] = [];
            acc[cmd.namespace].push(cmd);
            return acc;
        }, {});

        for (const [namespace, namespaceCommands] of Object.entries(grouped)) {
            output += `${namespace.toUpperCase()} 命令:\n`;
            namespaceCommands.forEach(cmd => {
                output += `  /${cmd.namespace}:${cmd.command} - ${cmd.description}\n`;
            });
            output += '\n';
        }

        return output;
    }

    /**
     * 清理註冊表
     */
    clear() {
        this.commands.clear();
        this.namespaces.clear();
        this.aliases.clear();
        this.handlers.clear();
        this.middleware.clear();
        this.metrics.lastUsed.clear();

        this.metrics = {
            registrations: 0,
            executions: 0,
            errors: 0,
            lastUsed: new Map()
        };

        this.emit('registryCleared');
    }

    /**
     * 導出註冊表配置
     * @returns {Object} 配置對象
     */
    export() {
        return {
            commands: Array.from(this.commands.entries()),
            aliases: Array.from(this.aliases.entries()),
            metrics: this.getMetrics(),
            exported: Date.now()
        };
    }

    /**
     * 導入註冊表配置
     * @param {Object} config - 配置對象
     */
    import(config) {
        if (!config || !config.commands) {
            throw new CommandRegistryError('無效的配置格式', 'INVALID_CONFIG');
        }

        this.clear();

        // 導入命令定義
        for (const [command, definition] of config.commands) {
            // 注意：導入時不包含處理器，需要重新註冊
            this.commands.set(command, definition);
        }

        // 導入別名
        if (config.aliases) {
            for (const [alias, command] of config.aliases) {
                this.aliases.set(alias, command);
            }
        }

        this.emit('registryImported', config);
    }
}

// 創建預設的註冊表實例
export const defaultRegistry = new CommandRegistry();

// 便利函數
export const registerCommand = (definition, handler, options) =>
    defaultRegistry.register(definition, handler, options);

export const getCommand = (command) => defaultRegistry.get(command);
export const getCommandHandler = (command) => defaultRegistry.getHandler(command);
export const hasCommand = (command) => defaultRegistry.has(command);
export const listCommands = (filter) => defaultRegistry.list(filter);
export const searchCommands = (query, options) => defaultRegistry.search(query, options);

export default CommandRegistry;