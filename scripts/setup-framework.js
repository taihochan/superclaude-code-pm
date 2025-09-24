#!/usr/bin/env node

/**
 * 整合框架設置腳本
 * 配置 CCPM + SuperClaude 整合系統
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

console.log(chalk.blue('🛠️  開始設置整合框架...'));

async function setupFramework() {
    try {
        // 檢查前置條件
        console.log(chalk.green('🔍 檢查安裝狀態...'));

        const ccpmInstalled = await fs.pathExists('./config/ccpm-integration.json');
        const superclaudeInstalled = await fs.pathExists('./config/superclaude-integration.json');

        if (!ccpmInstalled) {
            console.log(chalk.red('❌ CCPM 尚未安裝，請先運行: npm run install-ccpm'));
            process.exit(1);
        }

        if (!superclaudeInstalled) {
            console.log(chalk.red('❌ SuperClaude 尚未安裝，請先運行: npm run install-superclaude'));
            process.exit(1);
        }

        console.log(chalk.green('✅ 前置條件檢查通過'));

        // 讀取組件配置
        const ccpmConfig = await fs.readJSON('./config/ccpm-integration.json');
        const superclaudeConfig = await fs.readJSON('./config/superclaude-integration.json');

        // 創建主整合配置
        console.log(chalk.green('⚙️  創建主整合配置...'));

        const integrationConfig = {
            system: {
                name: "SuperClaude Code PM",
                version: "1.0.0",
                environment: "production",
                debug: false,
                installedAt: new Date().toISOString()
            },
            ccpm: {
                enabled: true,
                basePath: "./ccpm",
                configPath: "./ccpm/config",
                version: ccpmConfig.ccpm?.version || "1.0.0",
                commands: ccpmConfig.ccpm?.commands || [],
                integrationStatus: "active"
            },
            superclaude: {
                enabled: true,
                basePath: "./superclaude",
                configPath: "./superclaude/config",
                version: superclaudeConfig.superclaude?.version || "2.0.0",
                commands: superclaudeConfig.superclaude?.commands || [],
                modes: superclaudeConfig.superclaude?.modes || [],
                integrationStatus: "active"
            },
            integration: {
                frameworkPath: "./framework",
                configPath: "./config",
                maxConcurrentAgents: 15,
                routingStrategy: "ai-optimized",
                routingAccuracy: 0.9,
                performanceOptimization: true,
                enableSmartCaching: true,
                cacheSize: "100MB",
                sessionTimeout: 3600,
                retryPolicy: {
                    maxRetries: 3,
                    backoffMs: 1000,
                    exponentialBackoff: true
                }
            },
            commands: {
                integrated: [
                    "integrated:status",
                    "integrated:analyze",
                    "integrated:workflow",
                    "integrated:report",
                    "integrated:config",
                    "integrated:help",
                    "integrated:monitor",
                    "integrated:optimize",
                    "integrated:parallel",
                    "integrated:routing",
                    "integrated:merge"
                ]
            },
            performance: {
                commandTimeout: 30000,
                eventQueueSize: 10000,
                maxMemoryUsage: "512MB",
                gcInterval: 60000,
                monitoringEnabled: true,
                metricsCollection: true
            },
            logging: {
                level: "info",
                file: "./logs/integration.log",
                maxSize: "100MB",
                maxFiles: 10,
                compression: true
            }
        };

        await fs.writeJSON('./config/integration-config.json', integrationConfig, { spaces: 2 });

        // 創建日誌目錄
        await fs.ensureDir('./logs');

        // 創建主入口文件
        console.log(chalk.green('📝 創建主入口文件...'));

        const indexContent = `#!/usr/bin/env node

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
if (import.meta.url === \`file://\${process.argv[1]}\`) {
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
`;

        await fs.writeFile('./index.js', indexContent);

        // 創建示例配置
        console.log(chalk.green('📋 創建示例和文檔...'));

        const exampleContent = `#!/usr/bin/env node

/**
 * SuperClaude Code PM 使用示例
 */

import scpm from './index.js';
import chalk from 'chalk';

async function runDemo() {
    console.log(chalk.blue('🎬 SuperClaude Code PM 演示開始...'));

    // 初始化系統
    await scpm.initialize();

    // 示例 1: 查看系統狀態
    console.log(chalk.cyan('\\n📊 示例 1: 查看系統狀態'));
    const status = await scpm.execute('/integrated:status');
    console.log('系統狀態:', status);

    // 示例 2: 執行整合分析
    console.log(chalk.cyan('\\n🔍 示例 2: 執行整合分析'));
    const analysis = await scpm.execute('/integrated:analyze', {
        project: './example-project',
        type: 'full'
    });
    console.log('分析結果:', analysis);

    // 示例 3: 並行工作流
    console.log(chalk.cyan('\\n⚡ 示例 3: 並行工作流'));
    const workflow = await scpm.execute('/integrated:workflow', {
        agents: ['ccmp', 'superclaude'],
        task: 'project-review',
        parallel: true
    });
    console.log('工作流結果:', workflow);

    console.log(chalk.green('\\n✨ 演示完成！'));
    await scpm.shutdown();
}

runDemo().catch(console.error);
`;

        await fs.writeFile('./examples/demo.js', exampleContent);

        // 創建驗證腳本
        const validationContent = `#!/usr/bin/env node

/**
 * 安裝驗證腳本
 */

import fs from 'fs-extra';
import chalk from 'chalk';

async function validateInstallation() {
    console.log(chalk.blue('🔍 驗證安裝狀態...'));

    const checks = [
        { name: 'package.json', path: './package.json' },
        { name: '整合配置', path: './config/integration-config.json' },
        { name: 'CCPM 配置', path: './config/ccpm-integration.json' },
        { name: 'SuperClaude 配置', path: './config/superclaude-integration.json' },
        { name: '框架目錄', path: './framework' },
        { name: '主入口文件', path: './index.js' },
        { name: '演示腳本', path: './examples/demo.js' }
    ];

    let allPassed = true;

    for (const check of checks) {
        const exists = await fs.pathExists(check.path);
        if (exists) {
            console.log(chalk.green(\`✅ \${check.name}\`));
        } else {
            console.log(chalk.red(\`❌ \${check.name}\`));
            allPassed = false;
        }
    }

    // 檢查框架文件
    console.log(chalk.blue('\\n🔍 檢查框架文件...'));
    const frameworkFiles = [
        'CommandRouter.js',
        'EventBus.js',
        'StateSynchronizer.js',
        'ParallelExecutor.js',
        'SmartRouter.js',
        'ResultIntegrator.js',
        'IntegratedCommandInterface.js',
        'ConfigManager.js',
        'ErrorHandler.js'
    ];

    for (const file of frameworkFiles) {
        const exists = await fs.pathExists(\`./framework/\${file}\`);
        if (exists) {
            console.log(chalk.green(\`✅ \${file}\`));
        } else {
            console.log(chalk.red(\`❌ \${file}\`));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log(chalk.green('\\n🎉 所有檢查通過！系統安裝成功！'));
        console.log(chalk.cyan('💡 運行 npm start 啟動系統'));
        console.log(chalk.cyan('💡 運行 npm run demo 查看演示'));
    } else {
        console.log(chalk.red('\\n❌ 安裝驗證失敗，請檢查上述錯誤'));
        process.exit(1);
    }
}

validateInstallation().catch(console.error);
`;

        await fs.writeFile('./scripts/validate-installation.js', validationContent);

        console.log(chalk.green('✅ 整合框架設置完成！'));
        console.log(chalk.blue('📁 配置文件已創建:'));
        console.log(chalk.gray('  - ./config/integration-config.json'));
        console.log(chalk.gray('  - ./index.js'));
        console.log(chalk.gray('  - ./examples/demo.js'));
        console.log(chalk.gray('  - ./scripts/validate-installation.js'));

    } catch (error) {
        console.error(chalk.red('❌ 框架設置失敗:'), error.message);
        process.exit(1);
    }
}

// 執行設置
setupFramework().catch(console.error);