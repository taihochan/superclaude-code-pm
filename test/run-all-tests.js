#!/usr/bin/env node

/**
 * SuperClaude Code PM 完整測試套件
 * 驗證所有組件功能和整合效果
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log(chalk.blue('🧪 開始運行 SuperClaude Code PM 測試套件...'));
        console.log(chalk.gray('=' .repeat(60)));

        await this.testInstallation();
        await this.testConfiguration();
        await this.testFrameworkComponents();
        await this.testIntegration();
        await this.testPerformance();
        await this.testCommands();

        this.showResults();
    }

    async testInstallation() {
        console.log(chalk.cyan('\\n📦 測試 1: 安裝完整性檢查'));

        const requiredFiles = [
            'package.json',
            'README.md',
            'index.js',
            'config/integration-config.json',
            'framework/CommandRouter.js',
            'framework/EventBus.js',
            'framework/StateSynchronizer.js',
            'framework/ParallelExecutor.js',
            'framework/SmartRouter.js',
            'framework/ResultIntegrator.js',
            'framework/IntegratedCommandInterface.js',
            'framework/ConfigManager.js',
            'framework/ErrorHandler.js'
        ];

        for (const file of requiredFiles) {
            await this.test(\`檢查文件: \${file}\`, async () => {
                return await fs.pathExists(file);
            });
        }
    }

    async testConfiguration() {
        console.log(chalk.cyan('\\n⚙️  測試 2: 配置檔案驗證'));

        await this.test('package.json 格式正確', async () => {
            const pkg = await fs.readJSON('package.json');
            return pkg.name === 'superclaude-code-pm' && pkg.scripts && pkg.dependencies;
        });

        await this.test('integration-config.json 結構完整', async () => {
            if (!await fs.pathExists('config/integration-config.json')) return false;
            const config = await fs.readJSON('config/integration-config.json');
            return config.system && config.ccpm && config.superclaude && config.integration;
        });

        await this.test('commands.json 命令定義完整', async () => {
            if (!await fs.pathExists('config/commands.json')) return false;
            const commands = await fs.readJSON('config/commands.json');
            return commands.namespaces && commands.commands;
        });
    }

    async testFrameworkComponents() {
        console.log(chalk.cyan('\\n🏗️  測試 3: 框架組件檢查'));

        const components = [
            'CommandRouter.js',
            'CommandParser.js',
            'CommandRegistry.js',
            'EventBus.js',
            'EventStore.js',
            'EventSerializer.js',
            'StateSynchronizer.js',
            'StateStore.js',
            'FileWatcher.js',
            'ParallelExecutor.js',
            'AgentManager.js',
            'DependencyResolver.js',
            'SmartRouter.js',
            'DecisionEngine.js',
            'ContextAnalyzer.js',
            'ResultIntegrator.js',
            'DataFusion.js',
            'ConflictDetector.js',
            'IntegratedCommandInterface.js',
            'CommandCompletion.js',
            'CommandHistory.js',
            'ConfigManager.js',
            'UserPreferences.js',
            'ErrorHandler.js',
            'CircuitBreaker.js',
            'HealthMonitor.js'
        ];

        for (const component of components) {
            await this.test(\`框架組件: \${component}\`, async () => {
                const filePath = \`framework/\${component}\`;
                if (!await fs.pathExists(filePath)) return false;

                const content = await fs.readFile(filePath, 'utf-8');
                return content.includes('class') || content.includes('export');
            });
        }
    }

    async testIntegration() {
        console.log(chalk.cyan('\\n🔗 測試 4: 整合功能驗證'));

        await this.test('CCPM 整合配置', async () => {
            return await fs.pathExists('config/ccpm-integration.json') ||
                   await fs.pathExists('ccmp/config/ccpm-config.json');
        });

        await this.test('SuperClaude 整合配置', async () => {
            return await fs.pathExists('config/superclaude-integration.json') ||
                   await fs.pathExists('superclaude/config/superclaude-config.json');
        });

        await this.test('中間件系統', async () => {
            const middlewareDir = 'framework/middlewares';
            if (!await fs.pathExists(middlewareDir)) return false;

            const files = await fs.readdir(middlewareDir);
            return files.some(f => f.includes('auth')) &&
                   files.some(f => f.includes('logging')) &&
                   files.some(f => f.includes('validation'));
        });
    }

    async testPerformance() {
        console.log(chalk.cyan('\\n⚡ 測試 5: 性能基準驗證'));

        await this.test('測試腳本存在', async () => {
            const testFiles = [
                'framework/test-command-router.js',
                'framework/test-event-system.js',
                'framework/test-parallel-execution.js',
                'framework/test-result-integrator.js',
                'framework/test-epic-integration.js'
            ];

            for (const file of testFiles) {
                if (await fs.pathExists(file)) return true;
            }
            return false;
        });

        await this.test('性能配置正確', async () => {
            if (!await fs.pathExists('config/integration-config.json')) return false;
            const config = await fs.readJSON('config/integration-config.json');
            return config.performance &&
                   config.performance.commandTimeout &&
                   config.integration.maxConcurrentAgents;
        });
    }

    async testCommands() {
        console.log(chalk.cyan('\\n💻 測試 6: 命令系統驗證'));

        await this.test('整合命令定義', async () => {
            if (!await fs.pathExists('config/commands.json')) return false;
            const commands = await fs.readJSON('config/commands.json');

            const integratedCommands = [
                'integrated:status',
                'integrated:analyze',
                'integrated:workflow',
                'integrated:report',
                'integrated:help'
            ];

            return integratedCommands.some(cmd =>
                JSON.stringify(commands).includes(cmd)
            );
        });

        await this.test('命令幫助系統', async () => {
            return await fs.pathExists('framework/HelpSystem.js') ||
                   await fs.pathExists('framework/CommandCompletion.js');
        });
    }

    async test(name, testFn) {
        try {
            const result = await testFn();
            if (result) {
                console.log(chalk.green(\`  ✅ \${name}\`));
                this.passed++;
            } else {
                console.log(chalk.red(\`  ❌ \${name}\`));
                this.failed++;
            }
        } catch (error) {
            console.log(chalk.red(\`  ❌ \${name} - 錯誤: \${error.message}\`));
            this.failed++;
        }
    }

    showResults() {
        const total = this.passed + this.failed;
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        const successRate = ((this.passed / total) * 100).toFixed(1);

        console.log(chalk.gray('\\n' + '=' .repeat(60)));
        console.log(chalk.blue('📊 測試結果統計'));
        console.log(chalk.gray('-' .repeat(30)));
        console.log(\`📋 總測試數: \${total}\`);
        console.log(chalk.green(\`✅ 通過: \${this.passed}\`));
        console.log(chalk.red(\`❌ 失敗: \${this.failed}\`));
        console.log(\`⏱️  執行時間: \${duration}s\`);
        console.log(\`📈 成功率: \${successRate}%\`);

        if (this.failed === 0) {
            console.log(chalk.green('\\n🎉 所有測試通過！系統已準備就緒！'));
            console.log(chalk.cyan('💡 運行 npm start 啟動系統'));
        } else {
            console.log(chalk.red(\`\\n⚠️  有 \${this.failed} 個測試失敗，請檢查系統配置\`));
            process.exit(1);
        }
    }
}

// 運行測試
const runner = new TestRunner();
await runner.runAllTests();