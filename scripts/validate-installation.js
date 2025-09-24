#!/usr/bin/env node

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
            console.log(chalk.green(`✅ ${check.name}`));
        } else {
            console.log(chalk.red(`❌ ${check.name}`));
            allPassed = false;
        }
    }

    // 檢查框架文件
    console.log(chalk.blue('\n🔍 檢查框架文件...'));
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
        const exists = await fs.pathExists(`./framework/${file}`);
        if (exists) {
            console.log(chalk.green(`✅ ${file}`));
        } else {
            console.log(chalk.red(`❌ ${file}`));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log(chalk.green('\n🎉 所有檢查通過！系統安裝成功！'));
        console.log(chalk.cyan('💡 運行 npm start 啟動系統'));
        console.log(chalk.cyan('💡 運行 npm run demo 查看演示'));
    } else {
        console.log(chalk.red('\n❌ 安裝驗證失敗，請檢查上述錯誤'));
        process.exit(1);
    }
}

validateInstallation().catch(console.error);
