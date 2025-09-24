/**
 * CCPM命令橋接器 - 統一命令路由系統
 *
 * 功能：
 * - 透傳所有CCPM命令到原有的.claude/scripts/pm/*.sh腳本
 * - 保持與現有CCPM系統的100%相容性
 * - 提供統一的錯誤處理和日誌記錄
 * - 支援命令參數和標記的正確傳遞
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CCPM命令錯誤
export class CCPMCommandError extends Error {
    constructor(message, code, command = null, exitCode = null) {
        super(message);
        this.name = 'CCPMCommandError';
        this.code = code;
        this.command = command;
        this.exitCode = exitCode;
    }
}

// CCPM命令映射 - 將命令名稱映射到對應的腳本文件
const CCPM_COMMAND_MAP = {
    'help': 'help.sh',
    'init': 'init.sh',
    'status': 'status.sh',
    'sync': 'sync.sh',
    'validate': 'validate.sh',
    'search': 'search.sh',
    'standup': 'standup.sh',
    'next': 'next.sh',
    'blocked': 'blocked.sh',
    'in-progress': 'in-progress.sh',

    // Epic 相關命令
    'epic-start': 'epic-start.sh',
    'epic-status': 'epic-status.sh',
    'epic-show': 'epic-show.sh',
    'epic-list': 'epic-list.sh',
    'epic-close': 'epic-close.sh',
    'epic-edit': 'epic-edit.sh',
    'epic-sync': 'epic-sync.sh',
    'epic-merge': 'epic-merge.sh',
    'epic-oneshot': 'epic-oneshot.sh',
    'epic-refresh': 'epic-refresh.sh',
    'epic-decompose': 'epic-decompose.sh',
    'epic-start-worktree': 'epic-start-worktree.sh',

    // Issue 相關命令
    'issue-start': 'issue-start.sh',
    'issue-status': 'issue-status.sh',
    'issue-show': 'issue-show.sh',
    'issue-close': 'issue-close.sh',
    'issue-edit': 'issue-edit.sh',
    'issue-reopen': 'issue-reopen.sh',
    'issue-sync': 'issue-sync.sh',
    'issue-analyze': 'issue-analyze.sh',

    // PRD 相關命令
    'prd-new': 'prd-new.sh',
    'prd-edit': 'prd-edit.sh',
    'prd-list': 'prd-list.sh',
    'prd-status': 'prd-status.sh',
    'prd-parse': 'prd-parse.sh',

    // 其他命令
    'import': 'import.sh',
    'clean': 'clean.sh',
    'test-reference-update': 'test-reference-update.sh'
};

export class CCPMCommandBridge {
    constructor(options = {}) {
        this.options = {
            scriptsPath: path.resolve(__dirname, '../scripts/pm'),
            timeout: 300000, // 5分鐘超時
            encoding: 'utf8',
            shell: '/bin/bash',
            env: process.env,
            ...options
        };

        // 驗證腳本目錄存在
        this._validateScriptsPath();
    }

    /**
     * 執行CCPM命令
     * @param {string} command - 命令名稱（不包含pm:前綴）
     * @param {Array} args - 命令參數
     * @param {Object} flags - 命令標記
     * @param {Object} context - 執行上下文
     * @returns {Promise<Object>} 執行結果
     */
    async executeCommand(command, args = [], flags = {}, context = {}) {
        try {
            // 驗證命令
            const scriptFile = this._resolveScriptFile(command);
            await this._validateScript(scriptFile);

            // 構建命令行參數
            const commandArgs = this._buildCommandArguments(args, flags);

            // 執行腳本
            const result = await this._executeScript(scriptFile, commandArgs, context);

            return {
                success: true,
                command: `pm:${command}`,
                output: result.stdout,
                error: result.stderr,
                exitCode: result.exitCode,
                executionTime: result.executionTime
            };

        } catch (error) {
            // 記錄錯誤
            console.error(`[CCPM Bridge] 命令執行失敗: pm:${command}`, error.message);

            if (error instanceof CCPMCommandError) {
                throw error;
            }

            throw new CCPMCommandError(
                `執行CCPM命令失敗: ${error.message}`,
                'EXECUTION_ERROR',
                `pm:${command}`,
                error.exitCode
            );
        }
    }

    /**
     * 獲取所有可用的CCPM命令
     * @returns {Array} 可用命令列表
     */
    getAvailableCommands() {
        return Object.keys(CCPM_COMMAND_MAP).map(command => ({
            name: command,
            fullName: `pm:${command}`,
            scriptFile: CCPM_COMMAND_MAP[command],
            available: this._isScriptAvailable(CCPM_COMMAND_MAP[command])
        }));
    }

    /**
     * 檢查特定命令是否可用
     * @param {string} command - 命令名稱
     * @returns {boolean} 是否可用
     */
    isCommandAvailable(command) {
        const scriptFile = CCPM_COMMAND_MAP[command];
        return scriptFile && this._isScriptAvailable(scriptFile);
    }

    /**
     * 獲取命令幫助信息
     * @param {string} command - 命令名稱
     * @returns {Promise<string>} 幫助信息
     */
    async getCommandHelp(command) {
        if (command === 'help' || !command) {
            // 執行全局幫助命令
            return this.executeCommand('help', [], {});
        }

        // 嘗試為特定命令獲取幫助
        try {
            return await this.executeCommand(command, ['--help'], {});
        } catch (error) {
            return `命令 pm:${command} 的幫助信息不可用。使用 /pm:help 查看所有可用命令。`;
        }
    }

    /**
     * 解析腳本文件路徑
     * @private
     */
    _resolveScriptFile(command) {
        const scriptFile = CCPM_COMMAND_MAP[command];

        if (!scriptFile) {
            throw new CCPMCommandError(
                `未知的CCPM命令: ${command}`,
                'UNKNOWN_COMMAND',
                `pm:${command}`
            );
        }

        return path.join(this.options.scriptsPath, scriptFile);
    }

    /**
     * 驗證腳本文件存在且可執行
     * @private
     */
    async _validateScript(scriptPath) {
        try {
            const stats = await fs.stat(scriptPath);

            if (!stats.isFile()) {
                throw new CCPMCommandError(
                    `腳本文件不存在: ${scriptPath}`,
                    'SCRIPT_NOT_FOUND',
                    scriptPath
                );
            }

            // 檢查是否可執行（Unix系統）
            if (process.platform !== 'win32') {
                await fs.access(scriptPath, fs.constants.X_OK);
            }

        } catch (error) {
            if (error instanceof CCPMCommandError) {
                throw error;
            }

            throw new CCPMCommandError(
                `腳本驗證失敗: ${error.message}`,
                'SCRIPT_VALIDATION_ERROR',
                scriptPath
            );
        }
    }

    /**
     * 檢查腳本是否可用
     * @private
     */
    _isScriptAvailable(scriptFile) {
        try {
            const scriptPath = path.join(this.options.scriptsPath, scriptFile);
            require('fs').accessSync(scriptPath, require('fs').constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 構建命令行參數
     * @private
     */
    _buildCommandArguments(args, flags) {
        const commandArgs = [];

        // 添加位置參數
        commandArgs.push(...args);

        // 添加標記參數
        for (const [name, value] of Object.entries(flags)) {
            if (typeof value === 'boolean') {
                if (value) {
                    commandArgs.push(`--${name}`);
                }
            } else {
                commandArgs.push(`--${name}=${value}`);
            }
        }

        return commandArgs;
    }

    /**
     * 執行腳本
     * @private
     */
    async _executeScript(scriptPath, args, context) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            // 設置環境變數
            const env = {
                ...this.options.env,
                ...context.env,
                CCPM_EXECUTION_ID: context.id?.toString() || 'unknown',
                CCPM_USER: context.user?.username || 'system'
            };

            // 創建子進程
            const child = spawn('bash', [scriptPath, ...args], {
                cwd: process.cwd(),
                env,
                encoding: this.options.encoding,
                timeout: this.options.timeout
            });

            let stdout = '';
            let stderr = '';

            // 收集輸出
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // 設置超時
            const timeoutId = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new CCPMCommandError(
                    `腳本執行超時 (${this.options.timeout}ms)`,
                    'EXECUTION_TIMEOUT',
                    scriptPath
                ));
            }, this.options.timeout);

            // 處理進程結束
            child.on('close', (exitCode) => {
                clearTimeout(timeoutId);

                const executionTime = Date.now() - startTime;

                if (exitCode === 0) {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode,
                        executionTime
                    });
                } else {
                    reject(new CCPMCommandError(
                        `腳本執行失敗: ${stderr.trim() || '未知錯誤'}`,
                        'SCRIPT_EXECUTION_ERROR',
                        scriptPath,
                        exitCode
                    ));
                }
            });

            child.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(new CCPMCommandError(
                    `無法啟動腳本: ${error.message}`,
                    'SPAWN_ERROR',
                    scriptPath
                ));
            });
        });
    }

    /**
     * 驗證腳本路徑
     * @private
     */
    _validateScriptsPath() {
        try {
            require('fs').accessSync(this.options.scriptsPath, require('fs').constants.F_OK);
        } catch (error) {
            throw new CCPMCommandError(
                `CCPM腳本目錄不存在: ${this.options.scriptsPath}`,
                'SCRIPTS_PATH_NOT_FOUND'
            );
        }
    }

    /**
     * 獲取橋接器統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        const totalCommands = Object.keys(CCPM_COMMAND_MAP).length;
        const availableCommands = Object.values(CCPM_COMMAND_MAP)
            .filter(script => this._isScriptAvailable(script)).length;

        return {
            totalCommands,
            availableCommands,
            availabilityRate: totalCommands > 0 ? (availableCommands / totalCommands * 100).toFixed(2) + '%' : '0%',
            scriptsPath: this.options.scriptsPath,
            lastCheck: new Date().toISOString()
        };
    }
}

/**
 * 創建CCPM命令處理器函數
 * @param {CCPMCommandBridge} bridge - CCPM橋接器實例
 * @returns {Function} 命令處理器函數
 */
export function createCCPMHandler(bridge) {
    return async function ccpmCommandHandler(parsedCommand, executionContext) {
        const { command, arguments: args, flags } = parsedCommand;

        try {
            const result = await bridge.executeCommand(command, args, flags, executionContext);

            // 格式化輸出
            return {
                success: true,
                message: result.output || '命令執行完成',
                command: result.command,
                executionTime: result.executionTime,
                details: {
                    exitCode: result.exitCode,
                    stderr: result.error
                }
            };

        } catch (error) {
            // 返回結構化的錯誤信息
            return {
                success: false,
                error: error.message,
                code: error.code,
                command: error.command,
                details: {
                    exitCode: error.exitCode
                }
            };
        }
    };
}

// 創建預設的CCPM橋接器實例
export const defaultCCPMBridge = new CCPMCommandBridge();

// 創建預設的CCPM命令處理器
export const defaultCCPMHandler = createCCPMHandler(defaultCCPMBridge);

// 便利函數

/**
 * 執行CCPM命令
 * @param {string} command - 命令名稱
 * @param {Array} args - 參數
 * @param {Object} flags - 標記
 * @param {Object} context - 上下文
 * @returns {Promise<Object>} 執行結果
 */
export const executeCCPMCommand = (command, args, flags, context) =>
    defaultCCPMBridge.executeCommand(command, args, flags, context);

/**
 * 獲取CCPM命令幫助
 * @param {string} command - 命令名稱
 * @returns {Promise<string>} 幫助信息
 */
export const getCCPMCommandHelp = (command) =>
    defaultCCPMBridge.getCommandHelp(command);

/**
 * 檢查CCPM命令是否可用
 * @param {string} command - 命令名稱
 * @returns {boolean} 是否可用
 */
export const isCCPMCommandAvailable = (command) =>
    defaultCCPMBridge.isCommandAvailable(command);

