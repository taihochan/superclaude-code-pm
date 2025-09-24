/**
 * 配置管理系統使用示例 - CCPM+SuperClaude統一配置中心
 *
 * 本文件提供完整的使用示例，展示如何在實際專案中使用配置管理系統
 * 包含基礎使用、進階功能、錯誤處理、性能優化等各種場景
 *
 * @author Claude Code Framework
 * @version 1.0.0
 */

import ConfigSystemIntegration from './ConfigSystemIntegration';

// ==================== 基礎使用示例 ====================

/**
 * 示例 1: 基本系統初始化和配置操作
 */
async function basicUsageExample() {
    console.log('\n=== 基礎使用示例 ===');

    try {
        // 1. 創建配置系統實例
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            environment: 'development',
            enableHotReload: true,
            debug: true
        });

        // 2. 監聽系統事件
        configSystem.on('initialized', (data) => {
            console.log('✅ 系統初始化完成:', data.initTime);
        });

        configSystem.on('configChanged', (data) => {
            console.log('🔄 配置已更新:', data);
        });

        configSystem.on('error', (error) => {
            console.error('❌ 系統錯誤:', error.message);
        });

        // 3. 初始化系統
        await configSystem.initialize();

        // 4. 基本配置操作
        console.log('\n--- 基本配置操作 ---');

        // 設置配置
        await configSystem.set('app.name', 'CCPM Trading Bot');
        await configSystem.set('app.version', '1.0.0');
        await configSystem.set('trading.defaultSymbol', 'BTCUSDT');

        // 獲取配置
        const appName = await configSystem.get('app.name');
        const version = await configSystem.get('app.version');
        const symbol = await configSystem.get('trading.defaultSymbol');

        console.log(`應用名稱: ${appName}`);
        console.log(`版本: ${version}`);
        console.log(`預設交易對: ${symbol}`);

        // 5. 獲取系統狀態
        const status = configSystem.getStatus();
        console.log('系統狀態:', {
            健康狀態: status.healthy,
            組件數量: Object.keys(status.components).length,
            記憶體使用: `${(status.memoryUsage / 1024 / 1024).toFixed(2)}MB`
        });

        // 6. 優雅關閉
        await configSystem.shutdown();

    } catch (error) {
        console.error('基礎使用示例失敗:', error);
    }
}

/**
 * 示例 2: 用戶偏好管理
 */
async function userPreferencesExample() {
    console.log('\n=== 用戶偏好管理示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            debug: true
        });

        await configSystem.initialize();

        // 用戶偏好設置（使用 user: 前綴）
        console.log('\n--- 用戶偏好操作 ---');

        // 設置不同作用域的偏好
        await configSystem.set('user:theme', 'dark');
        await configSystem.set('user:language', 'zh-TW');
        await configSystem.set('user:tradingView.timeframe', '15m');
        await configSystem.set('user:notifications.email', true);

        // 獲取用戶偏好
        const theme = await configSystem.get('user:theme');
        const language = await configSystem.get('user:language');
        const timeframe = await configSystem.get('user:tradingView.timeframe');
        const emailNotifications = await configSystem.get('user:notifications.email');

        console.log('用戶偏好設置:');
        console.log(`- 主題: ${theme}`);
        console.log(`- 語言: ${language}`);
        console.log(`- 預設時間週期: ${timeframe}`);
        console.log(`- 郵件通知: ${emailNotifications}`);

        await configSystem.shutdown();

    } catch (error) {
        console.error('用戶偏好示例失敗:', error);
    }
}

/**
 * 示例 3: 環境配置管理
 */
async function environmentConfigExample() {
    console.log('\n=== 環境配置管理示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            environment: 'development',
            enableEncryption: true,
            debug: true
        });

        await configSystem.initialize();

        console.log('\n--- 環境配置操作 ---');

        // 設置不同環境的配置
        await configSystem.set('env:database.host', 'localhost');
        await configSystem.set('env:database.port', 5432);
        await configSystem.set('env:api.endpoint', 'https://api.binance.com');
        await configSystem.set('env:api.timeout', 5000);

        // 敏感配置（會自動加密）
        await configSystem.set('env:api.key', 'your-api-key-here');
        await configSystem.set('env:api.secret', 'your-api-secret-here');

        // 獲取環境配置
        const dbHost = await configSystem.get('env:database.host');
        const dbPort = await configSystem.get('env:database.port');
        const apiEndpoint = await configSystem.get('env:api.endpoint');
        const apiTimeout = await configSystem.get('env:api.timeout');

        console.log('環境配置:');
        console.log(`- 資料庫主機: ${dbHost}`);
        console.log(`- 資料庫端口: ${dbPort}`);
        console.log(`- API端點: ${apiEndpoint}`);
        console.log(`- API超時: ${apiTimeout}ms`);

        // 敏感配置不會在日誌中顯示
        console.log('- API密鑰: [已加密]');

        await configSystem.shutdown();

    } catch (error) {
        console.error('環境配置示例失敗:', error);
    }
}

/**
 * 示例 4: 模板管理
 */
async function templateManagementExample() {
    console.log('\n=== 模板管理示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            debug: true
        });

        await configSystem.initialize();

        console.log('\n--- 模板管理操作 ---');

        // 創建交易策略模板
        const strategyTemplate = {
            name: '{{strategyName}}',
            type: '{{strategyType}}',
            parameters: {
                timeframe: '{{timeframe}}',
                indicators: '{{#each indicators}}{{this}}{{#unless @last}},{{/unless}}{{/each}}',
                riskLevel: '{{riskLevel}}'
            },
            conditions: {
                entry: '{{entryCondition}}',
                exit: '{{exitCondition}}',
                stopLoss: '{{stopLoss}}'
            }
        };

        // 保存模板
        await configSystem.set('template:trading/strategy', JSON.stringify(strategyTemplate));

        // 創建通知模板
        const notificationTemplate = {
            title: '交易信號: {{symbol}}',
            message: '策略 {{strategy}} 在 {{timeframe}} 週期產生 {{action}} 信號\n價格: {{price}}\n時間: {{timestamp}}'
        };

        await configSystem.set('template:notifications/trade-signal', JSON.stringify(notificationTemplate));

        // 使用模板生成具體配置
        const strategyData = {
            strategyName: 'RSI超賣反彈',
            strategyType: 'mean_reversion',
            timeframe: '15m',
            indicators: ['RSI', 'MACD', 'BB'],
            riskLevel: 'medium',
            entryCondition: 'RSI < 30 AND MACD > signal',
            exitCondition: 'RSI > 70 OR price > BB_upper',
            stopLoss: '2%'
        };

        // 獲取並編譯模板
        const templateStr = await configSystem.get('template:trading/strategy');
        console.log('策略模板已創建並可用於生成具體配置');

        await configSystem.shutdown();

    } catch (error) {
        console.error('模板管理示例失敗:', error);
    }
}

/**
 * 示例 5: 批量配置操作
 */
async function batchOperationsExample() {
    console.log('\n=== 批量配置操作示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            debug: true
        });

        await configSystem.initialize();

        console.log('\n--- 批量配置操作 ---');

        // 準備批量操作
        const batchOperations = [
            // 設置應用配置
            { action: 'set', path: 'app.name', value: 'CCPM Trading Bot' },
            { action: 'set', path: 'app.version', value: '2.0.0' },
            { action: 'set', path: 'app.author', value: 'Claude Code Framework' },

            // 設置交易配置
            { action: 'set', path: 'trading.symbols', value: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'] },
            { action: 'set', path: 'trading.timeframes', value: ['1m', '5m', '15m', '1h', '4h', '1d'] },
            { action: 'set', path: 'trading.maxPositions', value: 5 },

            // 設置用戶偏好
            { action: 'set', path: 'user:ui.theme', value: 'dark' },
            { action: 'set', path: 'user:ui.language', value: 'zh-TW' },

            // 獲取配置
            { action: 'get', path: 'app.name' },
            { action: 'get', path: 'trading.symbols' },
            { action: 'get', path: 'user:ui.theme' }
        ];

        // 執行批量操作
        console.log(`執行 ${batchOperations.length} 個批量操作...`);
        const results = await configSystem.batch(batchOperations);

        // 分析結果
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`批量操作完成: ${successful} 成功, ${failed} 失敗`);

        // 顯示獲取操作的結果
        results.forEach((result, index) => {
            const operation = batchOperations[index];
            if (operation.action === 'get' && result.success) {
                console.log(`${operation.path} = ${JSON.stringify(result.result)}`);
            }
        });

        await configSystem.shutdown();

    } catch (error) {
        console.error('批量操作示例失敗:', error);
    }
}

/**
 * 示例 6: 配置驗證
 */
async function configValidationExample() {
    console.log('\n=== 配置驗證示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            enableValidation: true,
            debug: true
        });

        await configSystem.initialize();

        console.log('\n--- 配置驗證操作 ---');

        // 定義配置架構
        const tradingConfigSchema = {
            type: 'object',
            required: ['symbol', 'timeframe', 'riskLevel'],
            properties: {
                symbol: {
                    type: 'string',
                    pattern: '^[A-Z]{3,10}USDT$',
                    description: '交易對符號'
                },
                timeframe: {
                    type: 'string',
                    enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
                    description: '時間週期'
                },
                riskLevel: {
                    type: 'number',
                    minimum: 0.1,
                    maximum: 5.0,
                    description: '風險等級 (0.1-5.0)'
                },
                indicators: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '技術指標列表'
                }
            }
        };

        // 測試有效配置
        const validConfig = {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            riskLevel: 2.5,
            indicators: ['RSI', 'MACD', 'SMA']
        };

        console.log('驗證有效配置...');
        const validResult = await configSystem.validate(validConfig, tradingConfigSchema);
        console.log('驗證結果:', validResult.isValid ? '✅ 有效' : '❌ 無效');

        // 測試無效配置
        const invalidConfig = {
            symbol: 'INVALID', // 不符合格式
            timeframe: '2m',    // 不在允許列表中
            riskLevel: 10       // 超出範圍
        };

        console.log('\n驗證無效配置...');
        const invalidResult = await configSystem.validate(invalidConfig, tradingConfigSchema);
        console.log('驗證結果:', invalidResult.isValid ? '✅ 有效' : '❌ 無效');

        if (!invalidResult.isValid) {
            console.log('錯誤詳情:');
            invalidResult.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.path}: ${error.message}`);
            });
        }

        await configSystem.shutdown();

    } catch (error) {
        console.error('配置驗證示例失敗:', error);
    }
}

/**
 * 示例 7: 配置匯入匯出和備份
 */
async function importExportExample() {
    console.log('\n=== 配置匯入匯出示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            enableBackup: true,
            enableEncryption: true,
            debug: true
        });

        await configSystem.initialize();

        console.log('\n--- 配置匯出操作 ---');

        // 先設置一些配置
        await configSystem.set('app.name', 'CCPM Trading Bot');
        await configSystem.set('trading.symbols', ['BTCUSDT', 'ETHUSDT']);
        await configSystem.set('user:theme', 'dark');

        // 匯出配置
        const exportResult = await configSystem.export({
            format: 'json',
            includeUserPreferences: true,
            includeTemplates: true,
            compress: true,
            encrypt: true
        });

        console.log('配置匯出完成:');
        console.log(`- 檔案路徑: ${exportResult.filePath}`);
        console.log(`- 檔案大小: ${(exportResult.fileSize / 1024).toFixed(2)}KB`);
        console.log(`- 包含項目: ${exportResult.includedItems.join(', ')}`);

        console.log('\n--- 配置匯入操作 ---');

        // 模擬從外部匯入配置
        const importData = {
            app: {
                name: 'Imported CCPM Bot',
                version: '2.1.0'
            },
            trading: {
                defaultSymbol: 'ETHUSDT',
                maxPositions: 3
            }
        };

        const importResult = await configSystem.import(importData, {
            format: 'json',
            merge: true, // 合併而不是替換
            backup: true // 匯入前先備份
        });

        console.log('配置匯入完成:');
        console.log(`- 處理項目數: ${importResult.processedCount}`);
        console.log(`- 成功項目數: ${importResult.successCount}`);
        console.log(`- 備份路徑: ${importResult.backupPath}`);

        // 驗證匯入結果
        const importedAppName = await configSystem.get('app.name');
        const importedVersion = await configSystem.get('app.version');
        console.log(`匯入後應用名稱: ${importedAppName}`);
        console.log(`匯入後版本: ${importedVersion}`);

        await configSystem.shutdown();

    } catch (error) {
        console.error('匯入匯出示例失敗:', error);
    }
}

/**
 * 示例 8: 熱更新和實時同步
 */
async function hotReloadExample() {
    console.log('\n=== 熱更新和實時同步示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            enableHotReload: true,
            debug: true
        });

        // 監聽熱更新事件
        configSystem.on('fileChanged', (data) => {
            console.log(`🔄 檔案變更: ${data.filePath}`);
            console.log(`   變更類型: ${data.changeType}`);
            console.log(`   影響配置: ${data.affectedConfigs.join(', ')}`);
        });

        configSystem.on('configChanged', (data) => {
            console.log(`⚡ 配置更新: ${data.path} = ${data.value}`);
        });

        configSystem.on('conflictDetected', (data) => {
            console.log(`⚠️ 衝突偵測: ${data.path}`);
            console.log(`   本地值: ${data.localValue}`);
            console.log(`   遠端值: ${data.remoteValue}`);
        });

        await configSystem.initialize();

        console.log('熱更新系統已啟動，正在監控配置檔案變更...');

        // 模擬配置變更
        console.log('\n--- 模擬配置變更 ---');
        await configSystem.set('app.lastUpdate', new Date().toISOString());

        // 等待一段時間以觀察熱更新
        console.log('等待5秒以觀察熱更新事件...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        await configSystem.shutdown();

    } catch (error) {
        console.error('熱更新示例失敗:', error);
    }
}

/**
 * 示例 9: 性能監控和優化
 */
async function performanceMonitoringExample() {
    console.log('\n=== 性能監控示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            enablePerformanceOptimization: true,
            loadTimeout: 50, // 50ms 載入超時要求
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB 記憶體限制
            debug: true
        });

        // 監聽性能警報
        configSystem.on('performanceAlert', (data) => {
            console.log(`⚠️ 性能警報: ${data.type}`);
            console.log(`   詳情: ${data.message}`);
            console.log(`   指標: ${JSON.stringify(data.metrics)}`);
        });

        configSystem.on('memoryWarning', (data) => {
            console.log(`🚨 記憶體警告: 使用量 ${(data.usage / 1024 / 1024).toFixed(2)}MB`);
        });

        await configSystem.initialize();

        console.log('\n--- 性能測試 ---');

        // 執行大量配置操作以測試性能
        const startTime = Date.now();

        for (let i = 0; i < 100; i++) {
            await configSystem.set(`perf.test.${i}`, `value_${i}`);
        }

        for (let i = 0; i < 100; i++) {
            await configSystem.get(`perf.test.${i}`);
        }

        const totalTime = Date.now() - startTime;
        console.log(`100次設置 + 100次獲取操作總時間: ${totalTime}ms`);
        console.log(`平均每次操作時間: ${(totalTime / 200).toFixed(2)}ms`);

        // 檢查系統狀態
        const status = configSystem.getStatus();
        console.log('\n系統性能狀態:');
        console.log(`- 記憶體使用: ${(status.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        console.log(`- 總請求數: ${status.stats.totalRequests}`);
        console.log(`- 成功請求數: ${status.stats.successfulRequests}`);
        console.log(`- 平均響應時間: ${status.stats.averageResponseTime.toFixed(2)}ms`);
        console.log(`- 系統健康: ${status.healthy ? '✅ 健康' : '❌ 異常'}`);

        await configSystem.shutdown();

    } catch (error) {
        console.error('性能監控示例失敗:', error);
    }
}

/**
 * 示例 10: 錯誤處理和恢復
 */
async function errorHandlingExample() {
    console.log('\n=== 錯誤處理示例 ===');

    try {
        const configSystem = new ConfigSystemIntegration({
            basePath: './configs',
            debug: true
        });

        // 監聽錯誤事件
        configSystem.on('error', (error) => {
            console.log(`❌ 系統錯誤: ${error.message}`);
        });

        configSystem.on('healthCheckFailed', (data) => {
            console.log('🏥 健康檢查失敗:', data.componentHealth);
        });

        await configSystem.initialize();

        console.log('\n--- 錯誤處理測試 ---');

        // 測試 1: 獲取不存在的配置
        try {
            const nonExistentConfig = await configSystem.get('non.existent.config');
            console.log('不存在的配置:', nonExistentConfig);
        } catch (error) {
            console.log('✅ 正確捕獲錯誤: 配置不存在');
        }

        // 測試 2: 設置無效路徑
        try {
            await configSystem.set('', 'invalid');
        } catch (error) {
            console.log('✅ 正確捕獲錯誤: 無效路徑');
        }

        // 測試 3: 批量操作中的部分失敗
        const batchOps = [
            { action: 'set', path: 'valid.config', value: 'test' },
            { action: 'get', path: 'another.valid.config' },
            { action: 'set', path: '', value: 'invalid' } // 這個會失敗
        ];

        const batchResults = await configSystem.batch(batchOps);
        console.log('批量操作結果:');
        batchResults.forEach((result, index) => {
            console.log(`  操作 ${index + 1}: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
            if (!result.success) {
                console.log(`    錯誤: ${result.error}`);
            }
        });

        // 測試系統恢復能力
        console.log('\n執行健康檢查...');
        await configSystem.performHealthCheck();

        const finalStatus = configSystem.getStatus();
        console.log(`系統最終狀態: ${finalStatus.healthy ? '✅ 健康' : '❌ 異常'}`);

        await configSystem.shutdown();

    } catch (error) {
        console.error('錯誤處理示例失敗:', error);
    }
}

// ==================== 主執行函數 ====================

/**
 * 執行所有示例
 */
async function runAllExamples() {
    console.log('🚀 CCPM+SuperClaude 配置管理系統示例');
    console.log('==========================================');

    const examples = [
        { name: '基礎使用示例', fn: basicUsageExample },
        { name: '用戶偏好管理', fn: userPreferencesExample },
        { name: '環境配置管理', fn: environmentConfigExample },
        { name: '模板管理', fn: templateManagementExample },
        { name: '批量配置操作', fn: batchOperationsExample },
        { name: '配置驗證', fn: configValidationExample },
        { name: '配置匯入匯出', fn: importExportExample },
        { name: '熱更新和實時同步', fn: hotReloadExample },
        { name: '性能監控', fn: performanceMonitoringExample },
        { name: '錯誤處理', fn: errorHandlingExample }
    ];

    for (const example of examples) {
        try {
            console.log(`\n🔸 執行 ${example.name}...`);
            await example.fn();
            console.log(`✅ ${example.name} 完成`);
        } catch (error) {
            console.error(`❌ ${example.name} 失敗:`, error.message);
        }

        // 每個示例間稍作停頓
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 所有示例執行完成！');
}

// ==================== 快速入門指南 ====================

/**
 * 快速入門示例 - 3分鐘上手配置管理系統
 */
async function quickStartGuide() {
    console.log('\n🚀 快速入門 - 3分鐘上手配置管理系統');
    console.log('=======================================');

    try {
        // 步驟 1: 創建和初始化系統
        console.log('\n步驟 1: 創建配置系統');
        const config = new ConfigSystemIntegration({
            basePath: './my-app-configs',
            environment: 'development',
            debug: true
        });

        console.log('步驟 2: 初始化系統');
        await config.initialize();

        // 步驟 3: 基本配置操作
        console.log('\n步驟 3: 設置基本配置');
        await config.set('app.name', '我的交易應用');
        await config.set('user:theme', 'dark');
        await config.set('env:api.endpoint', 'https://api.example.com');

        // 步驟 4: 讀取配置
        console.log('\n步驟 4: 讀取配置');
        const appName = await config.get('app.name');
        const userTheme = await config.get('user:theme');

        console.log(`✅ 應用名稱: ${appName}`);
        console.log(`✅ 用戶主題: ${userTheme}`);

        // 步驟 5: 批量操作
        console.log('\n步驟 5: 批量操作');
        const results = await config.batch([
            { action: 'set', path: 'trading.symbol', value: 'BTCUSDT' },
            { action: 'set', path: 'trading.amount', value: 100 },
            { action: 'get', path: 'app.name' }
        ]);

        console.log(`✅ 批量操作完成: ${results.filter(r => r.success).length}/${results.length} 成功`);

        // 步驟 6: 系統狀態
        console.log('\n步驟 6: 檢查系統狀態');
        const status = config.getStatus();
        console.log(`✅ 系統健康: ${status.healthy}`);
        console.log(`✅ 總請求數: ${status.stats.totalRequests}`);

        // 步驟 7: 清理
        console.log('\n步驟 7: 清理資源');
        await config.shutdown();

        console.log('\n🎉 快速入門完成！您已成功掌握配置管理系統的基本用法。');

    } catch (error) {
        console.error('❌ 快速入門失敗:', error);
    }
}

// ==================== 模組匯出 ====================

module.exports = {
    // 基礎示例
    basicUsageExample,
    userPreferencesExample,
    environmentConfigExample,
    templateManagementExample,
    batchOperationsExample,

    // 進階示例
    configValidationExample,
    importExportExample,
    hotReloadExample,
    performanceMonitoringExample,
    errorHandlingExample,

    // 工具函數
    runAllExamples,
    quickStartGuide,

    // 配置模板
    getDefaultConfig: () => ({
        basePath: './configs',
        environment: 'development',
        enableHotReload: true,
        enableValidation: true,
        enableBackup: true,
        enablePerformanceOptimization: true,
        debug: false
    })
};

// 如果直接執行此文件，則運行快速入門
if (require.main === module) {
    quickStartGuide()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('執行失敗:', error);
            process.exit(1);
        });
}