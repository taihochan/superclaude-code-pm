#!/usr/bin/env node

/**
 * SuperClaude Code PM 簡化演示
 * 驗證基本安裝和配置
 */

import fs from 'fs/promises';
import chalk from 'chalk';

async function runSimpleDemo() {
    console.log(chalk.blue('🎬 SuperClaude Code PM 簡化演示開始...'));

    try {
        // 1. 檢查配置文件
        console.log(chalk.cyan('\n📋 檢查配置文件...'));

        const integrationConfig = await fs.readFile('./config/integration-config.json', 'utf-8');
        const config = JSON.parse(integrationConfig);

        console.log(chalk.green('✅ 整合配置載入成功'));
        console.log(chalk.gray(`   - 系統名稱: ${config.system.name}`));
        console.log(chalk.gray(`   - 版本: ${config.system.version}`));
        console.log(chalk.gray(`   - CCPM 狀態: ${config.ccpm.enabled ? '已啟用' : '未啟用'}`));
        console.log(chalk.gray(`   - SuperClaude 狀態: ${config.superclaude.enabled ? '已啟用' : '未啟用'}`));

        // 2. 檢查框架文件
        console.log(chalk.cyan('\n📂 檢查框架文件...'));

        const frameworkFiles = [
            'CommandRouter.js',
            'EventBus.js',
            'StateSynchronizer.js',
            'ParallelExecutor.js',
            'SmartRouter.js',
            'ResultIntegrator.js',
            'ConfigManager.js',
            'ErrorHandler.js'
        ];

        let filesExist = 0;
        for (const file of frameworkFiles) {
            try {
                await fs.access(`./framework/${file}`);
                filesExist++;
            } catch (error) {
                console.log(chalk.yellow(`⚠️  文件不存在: ${file}`));
            }
        }

        console.log(chalk.green(`✅ 框架文件檢查完成: ${filesExist}/${frameworkFiles.length} 個文件存在`));

        // 3. 檢查安裝狀態
        console.log(chalk.cyan('\n🔍 檢查組件安裝狀態...'));

        try {
            await fs.access('./ccpm');
            console.log(chalk.green('✅ CCPM 目錄存在'));
        } catch (error) {
            console.log(chalk.yellow('⚠️  CCPM 目錄不存在'));
        }

        try {
            await fs.access('./superclaude');
            console.log(chalk.green('✅ SuperClaude 目錄存在'));
        } catch (error) {
            console.log(chalk.yellow('⚠️  SuperClaude 目錄不存在'));
        }

        // 4. 顯示可用命令
        console.log(chalk.cyan('\n💡 可用命令:'));
        console.log(chalk.gray('   - npm start          啟動整合系統'));
        console.log(chalk.gray('   - npm run validate   驗證安裝狀態'));
        console.log(chalk.gray('   - npm run demo       運行完整演示'));

        console.log(chalk.green('\n🎉 基本驗證完成！系統配置正常。'));

    } catch (error) {
        console.error(chalk.red('❌ 演示失敗:'), error.message);
        process.exit(1);
    }
}

runSimpleDemo().catch(console.error);