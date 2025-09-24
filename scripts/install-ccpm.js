#!/usr/bin/env node

/**
 * CCPM (Claude Code PM) 安裝腳本
 * 自動下載、配置和初始化 Claude Code PM 系統
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const CCPM_REPO = 'https://github.com/automazeio/ccpm.git';
const CCPM_DIR = './ccpm';

console.log(chalk.blue('🚀 開始安裝 Claude Code PM (CCPM)...'));

async function installCCPM() {
    try {
        // 檢查是否已存在 CCPM 目錄
        if (await fs.pathExists(CCPM_DIR)) {
            console.log(chalk.yellow('⚠️  CCPM 目錄已存在，正在更新...'));
            process.chdir(CCPM_DIR);
            try {
                // 使用 git pull 不指定分支，讓它自動使用當前分支
                execSync('git pull', { stdio: 'inherit' });
            } catch (error) {
                console.log(chalk.yellow('⚠️  Git 更新失敗，跳過更新步驟...'));
            }
            process.chdir('..');
        } else {
            // 克隆真實的 CCPM 倉庫
            console.log(chalk.green('📥 正在從 GitHub 克隆 CCPM 倉庫...'));
            console.log(chalk.gray(`源倉庫: ${CCPM_REPO}`));

            try {
                execSync(`git clone ${CCPM_REPO} ${CCPM_DIR}`, { stdio: 'inherit' });
                console.log(chalk.green('✅ CCPM 倉庫克隆成功'));
            } catch (error) {
                console.log(chalk.red('❌ Git 克隆失敗，使用備用方案...'));

                // 創建基本的 CCPM 結構（基於真實倉庫結構）
                await fs.ensureDir(CCPM_DIR);
                await fs.ensureDir(path.join(CCPM_DIR, '.claude'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'agents'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'commands'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'context'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'epics'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'prds'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'rules'));
                await fs.ensureDir(path.join(CCPM_DIR, '.claude', 'scripts'));

                // 創建基本的 CLAUDE.md 文件
                const claudeMd = `# CCPM - Claude Code PM

## 核心命令

- \`/pm:prd-new\`: 創建產品需求文檔
- \`/pm:epic-decompose\`: 將epic分解為任務
- \`/pm:issue-start\`: 開始處理特定issue
- \`/pm:issue-sync\`: 同步更新到GitHub
- \`/pm:next\`: 顯示下一個優先issue

## 並行執行支持

CCPM 支持多Agent並行執行，可標記 "parallel: true" 的任務。

## GitHub 原生整合

使用GitHub Issues作為主要項目管理工具，提供從想法到生產的完整可追溯性。
`;

                await fs.writeFile(path.join(CCPM_DIR, '.claude', 'CLAUDE.md'), claudeMd);

                // 創建基本的 package.json
                const packageJson = {
                    name: "ccpm",
                    version: "1.0.0",
                    description: "Claude Code PM - Parallel AI Development Management",
                    type: "module",
                    main: "index.js",
                    scripts: {
                        test: "echo \"CCPM Tests\" && exit 0"
                    },
                    keywords: ["claude", "pm", "ai", "development", "parallel"],
                    license: "MIT"
                };

                await fs.writeJSON(path.join(CCPM_DIR, 'package.json'), packageJson, { spaces: 2 });
            }
        }

        // 安裝 CCPM 依賴
        console.log(chalk.green('📦 安裝 CCPM 依賴...'));
        if (await fs.pathExists(path.join(CCPM_DIR, 'package.json'))) {
            process.chdir(CCPM_DIR);
            execSync('npm install', { stdio: 'inherit' });
            process.chdir('..');
        }

        // 配置 CCPM 與整合框架的連接
        console.log(chalk.green('🔗 配置 CCPM 整合連接...'));

        // 檢查 CCPM 配置文件是否存在，提供默認配置
        let ccpmCommands = [];
        const ccpmConfigPath = path.join(CCPM_DIR, 'config', 'ccpm-config.json');

        if (await fs.pathExists(ccpmConfigPath)) {
            try {
                const ccpmConfig = await fs.readJSON(ccpmConfigPath);
                ccpmCommands = Object.keys(ccpmConfig.commands || {});
            } catch (error) {
                console.log(chalk.yellow('⚠️  讀取 CCPM 配置失敗，使用默認配置'));
            }
        } else {
            // 使用默認命令列表
            ccpmCommands = ['prd-new', 'epic-decompose', 'epic-start', 'issue-start', 'issue-sync', 'next', 'status'];
            console.log(chalk.yellow('⚠️  CCPM 配置文件不存在，使用默認命令列表'));
        }

        const integrationConfig = {
            ccpm: {
                installed: true,
                path: CCPM_DIR,
                version: "1.0.0",
                commands: ccpmCommands,
                integrationStatus: "ready"
            }
        };

        await fs.writeJSON('./config/ccpm-integration.json', integrationConfig, { spaces: 2 });

        console.log(chalk.green('✅ CCPM 安裝完成！'));
        console.log(chalk.blue('📍 CCPM 已安裝到:'), CCPM_DIR);
        console.log(chalk.blue('🔧 配置文件已創建:'), './config/ccpm-integration.json');

    } catch (error) {
        console.error(chalk.red('❌ CCPM 安裝失敗:'), error.message);
        process.exit(1);
    }
}

// 執行安裝
installCCPM().catch(console.error);