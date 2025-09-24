#!/usr/bin/env node

/**
 * SuperClaude Code PM 使用示例
 */

import scpm from '../index.js';
import chalk from 'chalk';

async function runDemo() {
    console.log(chalk.blue('🎬 SuperClaude Code PM 演示開始...'));

    // 初始化系統
    await scpm.initialize();

    // 示例 1: 查看系統狀態
    console.log(chalk.cyan('\n📊 示例 1: 查看系統狀態'));
    const status = await scpm.execute('/integrated:status');
    console.log('系統狀態:', status);

    // 示例 2: 執行整合分析
    console.log(chalk.cyan('\n🔍 示例 2: 執行整合分析'));
    const analysis = await scpm.execute('/integrated:analyze', {
        project: './example-project',
        type: 'full'
    });
    console.log('分析結果:', analysis);

    // 示例 3: 並行工作流
    console.log(chalk.cyan('\n⚡ 示例 3: 並行工作流'));
    const workflow = await scpm.execute('/integrated:workflow', {
        agents: ['ccmp', 'superclaude'],
        task: 'project-review',
        parallel: true
    });
    console.log('工作流結果:', workflow);

    console.log(chalk.green('\n✨ 演示完成！'));
    await scpm.shutdown();
}

runDemo().catch(console.error);
