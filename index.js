#!/usr/bin/env node

/**
 * SuperClaude Code PM - 主入口點
 * CCPM + SuperClaude 整合框架
 */

import { CommandRouter } from './framework/CommandRouter.js';
import { EventBus } from './framework/EventBus.js';
import { StateSynchronizer } from './framework/StateSynchronizer.js';
import { ParallelExecutor } from './framework/ParallelExecutor.js';
import { SmartRouter } from './framework/SmartRouter.js';
import { ResultIntegrator } from './framework/ResultIntegrator.js';
import { IntegratedCommandInterface } from './framework/IntegratedCommandInterface.js';
import { ConfigManager } from './framework/ConfigManager.js';
import { ErrorHandler } from './framework/ErrorHandler.js';
import fs from 'fs-extra';
import chalk from 'chalk';

class SuperClaudeCodePM {
    constructor() {
        this.components = {};
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log(chalk.blue('🚀 啟動 SuperClaude Code PM...'));

            // 讀取配置
            const config = await fs.readJSON('./config/integration-config.json');

            // 初始化核心組件
            console.log(chalk.green('⚙️  初始化核心組件...'));

            this.components.eventBus = new EventBus();
            this.components.configManager = new ConfigManager();
            this.components.commandRouter = new CommandRouter();
            this.components.stateSynchronizer = new StateSynchronizer();
            this.components.errorHandler = new ErrorHandler();

            // 初始化基礎架構層
            await this.components.eventBus.initialize();
            await this.components.configManager.initialize();
            await this.components.commandRouter.initialize();
            await this.components.stateSynchronizer.initialize();
            await this.components.errorHandler.initialize();

            console.log(chalk.green('✅ 基礎架構層已初始化'));

            // 初始化並行執行層
            this.components.parallelExecutor = new ParallelExecutor();
            this.components.smartRouter = new SmartRouter();

            await this.components.parallelExecutor.initialize();
            await this.components.smartRouter.initialize();

            console.log(chalk.green('✅ 並行執行層已初始化'));

            // 初始化核心功能層
            this.components.resultIntegrator = new ResultIntegrator();
            this.components.integratedCommands = new IntegratedCommandInterface();

            await this.components.resultIntegrator.initialize();
            await this.components.integratedCommands.initialize();

            console.log(chalk.green('✅ 核心功能層已初始化'));

            this.initialized = true;

            console.log(chalk.green('🎉 SuperClaude Code PM 已就緒！'));
            console.log(chalk.cyan('💡 使用 /integrated:help 查看可用命令'));

            return true;

        } catch (error) {
            console.error(chalk.red('❌ 初始化失敗:'), error.message);
            return false;
        }
    }

    async execute(command, args = {}) {
        if (!this.initialized) {
            throw new Error('系統尚未初始化，請先調用 initialize()');
        }

        return await this.components.commandRouter.execute(command, args);
    }

    async shutdown() {
        console.log(chalk.yellow('🔄 正在關閉 SuperClaude Code PM...'));

        if (this.components.eventBus) {
            await this.components.eventBus.shutdown();
        }

        console.log(chalk.green('✅ 系統已安全關閉'));
    }
}

// 創建全局實例
const scpm = new SuperClaudeCodePM();

// 如果直接運行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    await scpm.initialize();

    // 設置優雅關閉
    process.on('SIGINT', async () => {
        await scpm.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await scpm.shutdown();
        process.exit(0);
    });
}

export default scpm;
export { SuperClaudeCodePM };
