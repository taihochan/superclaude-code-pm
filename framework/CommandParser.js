/**
 * CommandParser - 統一命令路由系統的命令解析器
 *
 * 功能：
 * - 解析CCPM和SuperClaude命令語法
 * - 提取命令參數和選項
 * - 驗證命令格式和參數類型
 * - 提供統一的錯誤處理
 *
 * 支援格式：
 * - CCPM: /pm:command [options] [args]
 * - SuperClaude: /sc:command [options] [args]
 * - 整合: /integrated:command [options] [args]
 */

import EventEmitter from 'eventemitter3';

// 命令類型枚舉
export const COMMAND_TYPES = {
    CCPM: 'ccpm',
    SUPERCLAUDE: 'superclaude',
    INTEGRATED: 'integrated',
    UNKNOWN: 'unknown'
};

// 錯誤類型
export class CommandParseError extends Error {
    constructor(message, code, command = null) {
        super(message);
        this.name = 'CommandParseError';
        this.code = code;
        this.command = command;
    }
}

export class CommandParser extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            strict: false, // 嚴格模式：不允許未知參數
            caseSensitive: true, // 區分大小寫
            allowShorthand: true, // 允許參數簡寫
            ...options
        };

        // 命令模式匹配正則表達式
        this.patterns = {
            ccpm: /^\/pm:([a-zA-Z][a-zA-Z0-9\-_]*)(.*)?$/,
            superclaude: /^\/sc:([a-zA-Z][a-zA-Z0-9\-_]*)(.*)?$/,
            integrated: /^\/integrated:([a-zA-Z][a-zA-Z0-9\-_]*)(.*)?$/
        };

        // 參數解析正則表達式
        this.argPatterns = {
            longFlag: /--([a-zA-Z][a-zA-Z0-9\-_]*)(?:=(.*))?/g,
            shortFlag: /-([a-zA-Z])(?:=(.*))?/g,
            quotedArg: /"([^"]*)"|'([^']*)'/g,
            plainArg: /(\S+)/g
        };
    }

    /**
     * 解析命令字符串
     * @param {string} commandString - 要解析的命令字符串
     * @param {Object} context - 解析上下文
     * @returns {Object} 解析結果
     */
    parse(commandString, context = {}) {
        try {
            // 基本驗證
            if (!commandString || typeof commandString !== 'string') {
                throw new CommandParseError('命令字符串不能為空', 'EMPTY_COMMAND');
            }

            const trimmed = commandString.trim();
            if (!trimmed.startsWith('/')) {
                throw new CommandParseError('命令必須以 "/" 開頭', 'INVALID_PREFIX', trimmed);
            }

            // 識別命令類型
            const commandType = this._identifyCommandType(trimmed);

            // 解析命令結構
            const parsed = this._parseCommand(trimmed, commandType);

            // 驗證命令結構
            this._validateCommand(parsed);

            // 添加元數據
            const result = {
                ...parsed,
                raw: commandString,
                context,
                timestamp: Date.now(),
                valid: true
            };

            // 發送解析成功事件
            this.emit('parsed', result);

            return result;

        } catch (error) {
            // 發送解析失敗事件
            this.emit('parseError', error, commandString, context);

            if (error instanceof CommandParseError) {
                throw error;
            }

            throw new CommandParseError(
                `解析命令時發生未知錯誤: ${error.message}`,
                'PARSE_ERROR',
                commandString
            );
        }
    }

    /**
     * 識別命令類型
     * @private
     */
    _identifyCommandType(command) {
        for (const [type, pattern] of Object.entries(this.patterns)) {
            if (pattern.test(command)) {
                return type;
            }
        }
        return 'unknown';
    }

    /**
     * 解析命令結構
     * @private
     */
    _parseCommand(command, type) {
        const pattern = this.patterns[type];

        if (!pattern) {
            throw new CommandParseError(`未知的命令類型: ${type}`, 'UNKNOWN_TYPE', command);
        }

        const match = command.match(pattern);
        if (!match) {
            throw new CommandParseError(`命令格式不正確`, 'INVALID_FORMAT', command);
        }

        const [, commandName, argsString = ''] = match;

        // 解析參數
        const { flags, args } = this._parseArguments(argsString.trim());

        return {
            type: COMMAND_TYPES[type.toUpperCase()] || COMMAND_TYPES.UNKNOWN,
            namespace: type,
            command: commandName,
            flags,
            arguments: args,
            fullCommand: `${type}:${commandName}`
        };
    }

    /**
     * 解析命令參數和標記
     * @private
     */
    _parseArguments(argsString) {
        if (!argsString) {
            return { flags: {}, args: [] };
        }

        const flags = {};
        const args = [];
        const tokens = this._tokenize(argsString);

        let i = 0;
        while (i < tokens.length) {
            const token = tokens[i];

            if (token.startsWith('--')) {
                // 長標記 --flag=value 或 --flag value
                const [flagName, flagValue] = this._parseLongFlag(token, tokens, i);
                flags[flagName] = flagValue;
                if (flagValue === null && i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
                    flags[flagName] = tokens[++i];
                }
            } else if (token.startsWith('-') && token.length > 1) {
                // 短標記 -f value
                const flagName = token.substring(1);
                let flagValue = true;
                if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
                    flagValue = tokens[++i];
                }
                flags[flagName] = flagValue;
            } else {
                // 普通參數
                args.push(token);
            }
            i++;
        }

        return { flags, args };
    }

    /**
     * 標記化參數字符串
     * @private
     */
    _tokenize(argsString) {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];

            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens;
    }

    /**
     * 解析長標記
     * @private
     */
    _parseLongFlag(token, tokens, index) {
        const equalIndex = token.indexOf('=');
        if (equalIndex > -1) {
            const flagName = token.substring(2, equalIndex);
            const flagValue = token.substring(equalIndex + 1) || true;
            return [flagName, flagValue];
        }

        const flagName = token.substring(2);
        return [flagName, null];
    }

    /**
     * 驗證解析後的命令
     * @private
     */
    _validateCommand(parsed) {
        // 驗證命令名稱
        if (!parsed.command || !/^[a-zA-Z][a-zA-Z0-9\-_]*$/.test(parsed.command)) {
            throw new CommandParseError(
                `無效的命令名稱: ${parsed.command}`,
                'INVALID_COMMAND_NAME',
                parsed.fullCommand
            );
        }

        // 嚴格模式下的額外驗證
        if (this.options.strict) {
            this._strictValidation(parsed);
        }

        return true;
    }

    /**
     * 嚴格模式驗證
     * @private
     */
    _strictValidation(parsed) {
        // 在嚴格模式下，可以添加更多驗證規則
        // 例如：檢查未知參數、必需參數等

        // 這裡可以根據具體需求擴展
        if (parsed.arguments.length === 0 && Object.keys(parsed.flags).length === 0) {
            // 某些命令可能需要參數
            // 具體的驗證規則應該在CommandRegistry中定義
        }
    }

    /**
     * 批量解析命令
     * @param {string[]} commands - 命令字符串數組
     * @param {Object} context - 解析上下文
     * @returns {Object[]} 解析結果數組
     */
    parseMultiple(commands, context = {}) {
        return commands.map((cmd, index) => {
            try {
                return this.parse(cmd, { ...context, index });
            } catch (error) {
                return {
                    raw: cmd,
                    error: error.message,
                    valid: false,
                    index
                };
            }
        });
    }

    /**
     * 驗證命令是否有效
     * @param {string} command - 要驗證的命令
     * @returns {boolean} 是否有效
     */
    isValidCommand(command) {
        try {
            this.parse(command);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 獲取命令的幫助信息
     * @param {string} commandType - 命令類型
     * @returns {string} 幫助信息
     */
    getHelp(commandType = null) {
        if (!commandType) {
            return `
統一命令路由系統支持的命令格式：

• CCPM 命令:        /pm:command [flags] [arguments]
• SuperClaude 命令: /sc:command [flags] [arguments]
• 整合命令:         /integrated:command [flags] [arguments]

標記格式：
  --flag=value    長標記帶值
  --flag          長標記布爾值
  -f value        短標記帶值
  -f              短標記布爾值

範例：
  /pm:epic-start --branch=feature/new-api --parallel
  /sc:analyze -d /path/to/code --depth=detailed
  /integrated:status --format=json
`;
        }

        const examples = {
            ccpm: '/pm:epic-start --branch=feature/auth',
            superclaude: '/sc:analyze --depth=detailed',
            integrated: '/integrated:status --format=json'
        };

        return `${commandType.toUpperCase()} 命令格式: ${examples[commandType] || '範例不可用'}`;
    }

    /**
     * 重設解析器狀態
     */
    reset() {
        this.removeAllListeners();
    }

    /**
     * 設置解析選項
     * @param {Object} newOptions - 新的選項
     */
    setOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
}

// 創建預設的解析器實例
export const defaultParser = new CommandParser();

// 便利函數
export const parseCommand = (command, context) => defaultParser.parse(command, context);
export const isValidCommand = (command) => defaultParser.isValidCommand(command);
export const getCommandHelp = (type) => defaultParser.getHelp(type);

export default CommandParser;