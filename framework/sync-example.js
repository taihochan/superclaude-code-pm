/**
 * 狀態同步機制使用示例
 *
 * 這個示例展示如何使用Task 65實現的狀態同步機制
 * 包括基本用法、高級配置和與CommandRouter的整合
 */

const path = require('path');
const StateSynchronizer = require('./StateSynchronizer');
const SyncCommandBridge = require('./SyncCommandBridge');
const CommandRouter = require('./CommandRouter');

/**
 * 基本使用示例
 */
async function basicExample() {
    console.log('\n=== 基本狀態同步示例 ===');

    // 1. 創建狀態同步器
    const synchronizer = new StateSynchronizer({
        defaultMode: 'immediate',
        syncTimeout: 10000,
        watchPaths: [
            'package.json',
            'vite.config.js',
            '.claude/config'
        ]
    });

    try {
        // 2. 初始化
        await synchronizer.initialize();
        console.log('✓ 狀態同步器已初始化');

        // 3. 手動觸發狀態同步
        console.log('\n執行手動狀態同步...');
        const syncResult = await synchronizer.syncState(
            'filesystem',
            'ccpm',
            { mode: 'immediate' }
        );

        console.log(`✓ 同步完成:`, {
            success: syncResult.success,
            stateId: syncResult.stateId,
            syncTime: `${syncResult.syncTime}ms`
        });

        // 4. 檢查狀態差異
        console.log('\n檢測狀態差異...');
        const differences = await synchronizer.detectStateDifferences('filesystem', 'ccpm');
        console.log(`差異檢測結果:`, {
            hasChanges: differences.hasChanges,
            isNew: differences.isNew
        });

        // 5. 查看同步狀態
        const status = synchronizer.getSyncStatus();
        console.log(`\n同步狀態:`, {
            status: status.status,
            totalSyncs: status.stats.totalSyncs,
            successfulSyncs: status.stats.successfulSyncs,
            averageSyncTime: `${status.stats.averageSyncTime.toFixed(2)}ms`
        });

    } catch (error) {
        console.error('基本示例執行失敗:', error);
    } finally {
        await synchronizer.cleanup();
        console.log('✓ 資源已清理');
    }
}

/**
 * 檔案監控示例
 */
async function fileWatchingExample() {
    console.log('\n=== 檔案監控示例 ===');

    const synchronizer = new StateSynchronizer({
        defaultMode: 'batch',
        batchDelay: 200,
        criticalFiles: ['package.json', 'vite.config.js']
    });

    try {
        await synchronizer.initialize();

        // 設置事件監聽器
        synchronizer.on('syncCompleted', (result) => {
            console.log(`📁 檔案變化觸發同步完成: ${result.id} (${result.syncTime}ms)`);
        });

        synchronizer.on('fileChanged', (change) => {
            console.log(`📝 檔案變化: ${change.relativePath} [${change.type}]`);
        });

        // 開始監控指定路徑
        const watchPaths = ['.claude/config'];
        console.log(`開始監控路徑: ${watchPaths.join(', ')}`);

        await synchronizer.watch(watchPaths);

        console.log('🔍 檔案監控已啟動，等待變化...');
        console.log('（在 .claude/config 目錄中創建或修改檔案來觸發同步）');

        // 模擬運行30秒
        await new Promise(resolve => {
            setTimeout(() => {
                console.log('⏰ 監控示例結束');
                resolve();
            }, 30000);
        });

    } catch (error) {
        console.error('檔案監控示例執行失敗:', error);
    } finally {
        await synchronizer.cleanup();
    }
}

/**
 * 不同同步模式示例
 */
async function syncModesExample() {
    console.log('\n=== 同步模式示例 ===');

    const synchronizer = new StateSynchronizer();

    try {
        await synchronizer.initialize();

        // 模擬不同的狀態數據
        const sourceStates = {
            immediate: { priority: 'high', data: 'critical update' },
            batch: { items: Array.from({ length: 10 }, (_, i) => `item-${i}`) },
            scheduled: { lastUpdate: new Date().toISOString(), routine: 'check' }
        };

        console.log('\n1. 即時同步模式');
        const immediateStart = Date.now();
        const immediateResult = await synchronizer.syncState(
            'filesystem',
            'ccpm',
            {
                mode: 'immediate',
                sourceState: sourceStates.immediate,
                targetState: {}
            }
        );
        console.log(`✓ 即時同步: ${Date.now() - immediateStart}ms`);

        console.log('\n2. 批量同步模式');
        const batchStart = Date.now();
        const batchResult = await synchronizer.syncState(
            'filesystem',
            'ccpm',
            {
                mode: 'batch',
                sourceState: sourceStates.batch,
                targetState: { items: [] }
            }
        );
        console.log(`✓ 批量同步: ${Date.now() - batchStart}ms`);

        console.log('\n3. 手動同步模式');
        const manualStart = Date.now();
        const manualResult = await synchronizer.syncState(
            'filesystem',
            'ccpm',
            {
                mode: 'manual',
                sourceState: sourceStates.scheduled,
                targetState: {}
            }
        );
        console.log(`✓ 手動同步: ${Date.now() - manualStart}ms`);

        // 比較結果
        console.log('\n📊 同步模式比較:');
        [
            { name: '即時', result: immediateResult },
            { name: '批量', result: batchResult },
            { name: '手動', result: manualResult }
        ].forEach(({ name, result }) => {
            console.log(`  ${name}: ${result.success ? '成功' : '失敗'} - ${result.syncTime || 'N/A'}ms`);
        });

    } catch (error) {
        console.error('同步模式示例執行失敗:', error);
    } finally {
        await synchronizer.cleanup();
    }
}

/**
 * 衝突處理示例
 */
async function conflictResolutionExample() {
    console.log('\n=== 衝突處理示例 ===');

    const synchronizer = new StateSynchronizer();

    try {
        await synchronizer.initialize();

        // 創建衝突狀態
        const sourceState = {
            config: { version: '2.0.0', mode: 'production' },
            features: ['auth', 'api', 'ui'],
            dependencies: { express: '^4.18.0', vue: '^3.3.0' }
        };

        const targetState = {
            config: { version: '1.9.0', mode: 'development' },
            features: ['auth', 'basic-ui'],
            dependencies: { express: '^4.17.0', vue: '^3.2.0' }
        };

        console.log('檢測狀態衝突...');
        const conflicts = await synchronizer.conflictResolver.detectConflicts(
            sourceState,
            targetState,
            null,
            { syncTask: { sourceType: 'filesystem', targetType: 'ccpm' } }
        );

        if (conflicts.length > 0) {
            console.log(`🚨 檢測到 ${conflicts.length} 個衝突:`);
            conflicts.forEach((conflict, index) => {
                console.log(`  ${index + 1}. ${conflict.field}: ${conflict.type}`);
                if (conflict.sourceValue !== undefined && conflict.targetValue !== undefined) {
                    console.log(`     源: ${JSON.stringify(conflict.sourceValue)}`);
                    console.log(`     目標: ${JSON.stringify(conflict.targetValue)}`);
                }
            });

            // 嘗試不同的解決策略
            const strategies = ['auto_merge', 'source_wins', 'target_wins'];

            for (const strategy of strategies) {
                console.log(`\n🔧 使用策略: ${strategy}`);
                try {
                    const resolution = await synchronizer.conflictResolver.resolveConflicts(
                        conflicts,
                        strategy
                    );

                    console.log(`✓ 解決結果: ${resolution.success ? '成功' : '失敗'}`);
                    if (resolution.success) {
                        console.log(`  解決了 ${resolution.results.filter(r => r.success).length} 個衝突`);
                    }
                } catch (error) {
                    console.log(`✗ 策略失敗: ${error.message}`);
                }
            }

            // 查看衝突統計
            const stats = synchronizer.conflictResolver.getConflictStatistics();
            console.log(`\n📈 衝突統計:`);
            console.log(`  總衝突: ${stats.totalConflicts}`);
            console.log(`  已解決: ${stats.resolvedConflicts}`);
            console.log(`  未解決: ${stats.unresolvedConflicts}`);

        } else {
            console.log('✅ 沒有檢測到衝突');
        }

    } catch (error) {
        console.error('衝突處理示例執行失敗:', error);
    } finally {
        await synchronizer.cleanup();
    }
}

/**
 * CommandRouter整合示例
 */
async function commandIntegrationExample() {
    console.log('\n=== CommandRouter整合示例 ===');

    // 創建CommandRouter實例
    const router = new CommandRouter.CommandRouter();

    try {
        // 創建並註冊同步命令橋接器
        const syncBridge = new SyncCommandBridge(router, {
            enableAutoSync: true,
            syncOnCommand: true
        });

        console.log('✓ 同步命令橋接器已註冊');

        // 測試同步相關命令
        const commands = [
            'sync:status',
            'sync:force',
            'sync:config'
        ];

        console.log('\n🔧 測試同步命令:');

        for (const command of commands) {
            try {
                console.log(`\n執行命令: ${command}`);
                const result = await router.route(command);

                if (result && result.success) {
                    console.log(`✓ ${command} 執行成功`);
                    if (result.data) {
                        console.log(`  數據: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
                    }
                } else {
                    console.log(`✗ ${command} 執行失敗:`, result?.error || '未知錯誤');
                }
            } catch (error) {
                console.log(`✗ ${command} 執行異常:`, error.message);
            }
        }

        // 查看路由器統計
        const metrics = router.getMetrics();
        console.log(`\n📊 路由器統計:`);
        console.log(`  總命令: ${metrics.totalCommands}`);
        console.log(`  成功率: ${metrics.successRate}`);

        // 查看同步橋接器統計
        const bridgeStats = syncBridge.getStatistics();
        console.log(`\n🌉 橋接器統計:`);
        console.log(`  註冊命令: ${bridgeStats.commands}`);

    } catch (error) {
        console.error('CommandRouter整合示例執行失敗:', error);
    } finally {
        router.cleanup();
    }
}

/**
 * 性能測試示例
 */
async function performanceExample() {
    console.log('\n=== 性能測試示例 ===');

    const synchronizer = new StateSynchronizer({
        defaultMode: 'immediate',
        maxConcurrentSyncs: 10
    });

    try {
        await synchronizer.initialize();

        // 測試即時同步延遲
        console.log('\n⚡ 即時同步延遲測試:');
        const latencyTests = [];

        for (let i = 0; i < 10; i++) {
            const start = Date.now();
            await synchronizer.syncState('filesystem', 'ccpm', {
                mode: 'immediate',
                sourceState: { test: i },
                targetState: {}
            });
            const latency = Date.now() - start;
            latencyTests.push(latency);
        }

        const avgLatency = latencyTests.reduce((a, b) => a + b, 0) / latencyTests.length;
        const maxLatency = Math.max(...latencyTests);
        const minLatency = Math.min(...latencyTests);

        console.log(`  平均延遲: ${avgLatency.toFixed(2)}ms`);
        console.log(`  最大延遲: ${maxLatency}ms`);
        console.log(`  最小延遲: ${minLatency}ms`);

        if (avgLatency < 100) {
            console.log('✅ 延遲測試通過 (< 100ms)');
        } else {
            console.log('⚠️ 延遲測試未達標準');
        }

        // 測試並發同步
        console.log('\n🔄 並發同步測試:');
        const concurrentStart = Date.now();
        const concurrentPromises = [];

        for (let i = 0; i < 5; i++) {
            concurrentPromises.push(
                synchronizer.syncState('filesystem', 'ccpm', {
                    mode: 'immediate',
                    sourceState: { concurrent: i },
                    targetState: {}
                })
            );
        }

        const concurrentResults = await Promise.all(concurrentPromises);
        const concurrentTime = Date.now() - concurrentStart;

        const successCount = concurrentResults.filter(r => r.success).length;
        console.log(`  並發任務: ${concurrentResults.length}`);
        console.log(`  成功數量: ${successCount}`);
        console.log(`  總耗時: ${concurrentTime}ms`);
        console.log(`  平均耗時: ${(concurrentTime / concurrentResults.length).toFixed(2)}ms`);

        // 最終統計
        const finalStatus = synchronizer.getSyncStatus();
        console.log(`\n📈 最終統計:`);
        console.log(`  總同步數: ${finalStatus.stats.totalSyncs}`);
        console.log(`  成功率: ${((finalStatus.stats.successfulSyncs / finalStatus.stats.totalSyncs) * 100).toFixed(1)}%`);
        console.log(`  平均時間: ${finalStatus.stats.averageSyncTime.toFixed(2)}ms`);

    } catch (error) {
        console.error('性能測試示例執行失敗:', error);
    } finally {
        await synchronizer.cleanup();
    }
}

/**
 * 主函數 - 執行所有示例
 */
async function main() {
    console.log('🚀 狀態同步機制示例演示開始');
    console.log('==========================================');

    try {
        // 基本功能示例
        await basicExample();

        // 不同同步模式示例
        await syncModesExample();

        // 衝突處理示例
        await conflictResolutionExample();

        // CommandRouter整合示例
        await commandIntegrationExample();

        // 性能測試示例
        await performanceExample();

        console.log('\n✅ 所有示例執行完成！');

    } catch (error) {
        console.error('\n❌ 示例執行過程中發生錯誤:', error);
    }

    console.log('==========================================');
    console.log('🏁 狀態同步機制示例演示結束');
}

// 如果直接執行此檔案，運行示例
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    basicExample,
    fileWatchingExample,
    syncModesExample,
    conflictResolutionExample,
    commandIntegrationExample,
    performanceExample,
    main
};