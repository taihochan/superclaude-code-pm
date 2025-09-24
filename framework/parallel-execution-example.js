/**
 * 並行執行協調器集成示例
 *
 * 功能：
 * - 展示ParallelExecutor的實際使用場景
 * - CCPM+SuperClaude整合應用示例
 * - 不同執行策略的對比演示
 * - 實時監控和動態調整展示
 * - 完整的項目開發流程模擬
 */

import ParallelExecutor from './ParallelExecutor';

/**
 * 場景1: 代碼分析和重構項目
 *
 * 模擬一個大型代碼庫的分析、重構和測試流程
 * 展示複雜依賴關係的處理和並行優化
 */
async function demoCodeAnalysisProject() {
    console.log('🔍 場景1: 代碼分析和重構項目');
    console.log('=' .repeat(50));

    const executor = new ParallelExecutor({
        maxConcurrentPlans: 2,
        enableResourceOptimization: true,
        enableAdaptiveScheduling: true
    });

    try {
        await executor.initialize();

        // 定義代碼分析任務
        const analysisTasks = [
            {
                id: 'setup_env',
                name: '設置分析環境',
                type: 'setup',
                dependencies: [],
                outputs: ['analysis_env'],
                estimatedTime: 2000,
                requiredResources: { cpu: 5, memory: 256, network: 10 },
                metadata: {
                    description: '初始化代碼分析工具和環境',
                    criticality: 'high'
                }
            },
            {
                id: 'scan_dependencies',
                name: '掃描項目依賴',
                type: 'analysis',
                dependencies: ['setup_env'],
                inputs: ['analysis_env'],
                outputs: ['dependency_graph'],
                estimatedTime: 3000,
                requiredResources: { cpu: 10, memory: 512, network: 20 }
            },
            {
                id: 'analyze_complexity',
                name: '代碼複雜度分析',
                type: 'analysis',
                dependencies: ['setup_env'],
                inputs: ['analysis_env'],
                outputs: ['complexity_report'],
                estimatedTime: 4000,
                requiredResources: { cpu: 15, memory: 384, network: 5 }
            },
            {
                id: 'security_scan',
                name: '安全漏洞掃描',
                type: 'analysis',
                dependencies: ['setup_env'],
                inputs: ['analysis_env'],
                outputs: ['security_report'],
                estimatedTime: 5000,
                requiredResources: { cpu: 20, memory: 512, network: 15 }
            },
            {
                id: 'performance_analysis',
                name: '性能瓶頸分析',
                type: 'analysis',
                dependencies: ['scan_dependencies'],
                inputs: ['dependency_graph'],
                outputs: ['performance_report'],
                estimatedTime: 3500,
                requiredResources: { cpu: 12, memory: 256, network: 8 }
            },
            {
                id: 'generate_refactor_plan',
                name: '生成重構計劃',
                type: 'planning',
                dependencies: ['analyze_complexity', 'security_scan', 'performance_analysis'],
                inputs: ['complexity_report', 'security_report', 'performance_report'],
                outputs: ['refactor_plan'],
                estimatedTime: 2500,
                requiredResources: { cpu: 8, memory: 256, network: 5 }
            },
            {
                id: 'refactor_critical_modules',
                name: '重構關鍵模組',
                type: 'implementation',
                dependencies: ['generate_refactor_plan'],
                inputs: ['refactor_plan'],
                outputs: ['refactored_code'],
                estimatedTime: 6000,
                requiredResources: { cpu: 25, memory: 512, network: 10 }
            },
            {
                id: 'update_tests',
                name: '更新測試案例',
                type: 'testing',
                dependencies: ['refactor_critical_modules'],
                inputs: ['refactored_code'],
                outputs: ['updated_tests'],
                estimatedTime: 4000,
                requiredResources: { cpu: 15, memory: 384, network: 5 }
            },
            {
                id: 'run_regression_tests',
                name: '運行回歸測試',
                type: 'testing',
                dependencies: ['update_tests'],
                inputs: ['updated_tests'],
                outputs: ['test_results'],
                estimatedTime: 5000,
                requiredResources: { cpu: 30, memory: 768, network: 15 }
            },
            {
                id: 'generate_report',
                name: '生成分析報告',
                type: 'reporting',
                dependencies: ['run_regression_tests'],
                inputs: ['test_results'],
                outputs: ['final_report'],
                estimatedTime: 2000,
                requiredResources: { cpu: 5, memory: 256, network: 10 }
            }
        ];

        console.log(`📋 創建包含 ${analysisTasks.length} 個任務的執行計劃...`);

        // 設置監控
        executor.on('taskCompleted', (data) => {
            console.log(`  ✅ 完成任務: ${data.taskId} (進度: ${data.progress.percentage}%)`);
        });

        executor.on('phaseCompleted', (data) => {
            console.log(`  🎯 完成階段 ${data.phase}: ${data.completedTasks} 個任務成功, ${data.failedTasks} 個失敗`);
        });

        const startTime = Date.now();

        // 創建並執行計劃
        const planId = await executor.createExecutionPlan(analysisTasks, {
            strategy: 'balanced',
            maxConcurrency: 8,
            resourceLimits: {
                cpu: 150,
                memory: 2048,
                network: 100
            }
        });

        const result = await executor.executePlan(planId);
        const executionTime = Date.now() - startTime;

        // 顯示結果
        console.log(`\n📊 執行結果:`);
        console.log(`  總耗時: ${(executionTime / 1000).toFixed(2)}秒`);
        console.log(`  完成任務: ${Object.keys(result.results).length}/${analysisTasks.length}`);
        console.log(`  並行效率: ${((result.metrics.parallelismEfficiency || 0) * 100).toFixed(1)}%`);
        console.log(`  資源利用率: CPU=${((result.metrics.resourceUtilization?.cpu || 0) * 100).toFixed(1)}%, Memory=${((result.metrics.resourceUtilization?.memory || 0) * 100).toFixed(1)}%`);

        return result;

    } finally {
        await executor.shutdown();
    }
}

/**
 * 場景2: 多模組開發項目
 *
 * 模擬前端、後端、API、文檔等多個模組的並行開發
 * 展示資源分配和Agent負載均衡
 */
async function demoMultiModuleDevelopment() {
    console.log('\n🏗️ 場景2: 多模組開發項目');
    console.log('=' .repeat(50));

    const executor = new ParallelExecutor({
        maxConcurrentPlans: 1,
        enableResourceOptimization: true,
        enablePerformanceTuning: true
    });

    try {
        await executor.initialize();

        // 前端開發任務
        const frontendTasks = [
            { id: 'fe_setup', name: '前端環境設置', type: 'setup', dependencies: [], estimatedTime: 2000 },
            { id: 'fe_components', name: '開發UI組件', type: 'implementation', dependencies: ['fe_setup'], estimatedTime: 8000 },
            { id: 'fe_integration', name: '前端整合', type: 'integration', dependencies: ['fe_components'], estimatedTime: 4000 },
            { id: 'fe_tests', name: '前端測試', type: 'testing', dependencies: ['fe_integration'], estimatedTime: 3000 }
        ];

        // 後端開發任務
        const backendTasks = [
            { id: 'be_setup', name: '後端環境設置', type: 'setup', dependencies: [], estimatedTime: 2500 },
            { id: 'be_database', name: '資料庫設計', type: 'design', dependencies: ['be_setup'], estimatedTime: 3000 },
            { id: 'be_api', name: 'API開發', type: 'implementation', dependencies: ['be_database'], estimatedTime: 6000 },
            { id: 'be_services', name: '業務邏輯開發', type: 'implementation', dependencies: ['be_database'], estimatedTime: 7000 },
            { id: 'be_tests', name: '後端測試', type: 'testing', dependencies: ['be_api', 'be_services'], estimatedTime: 4000 }
        ];

        // 文檔和部署任務
        const docsTasks = [
            { id: 'docs_api', name: 'API文檔', type: 'documentation', dependencies: ['be_api'], estimatedTime: 2000 },
            { id: 'docs_user', name: '用戶手冊', type: 'documentation', dependencies: ['fe_integration'], estimatedTime: 3000 },
            { id: 'deployment', name: '部署配置', type: 'deployment', dependencies: ['be_tests', 'fe_tests'], estimatedTime: 2500 }
        ];

        // 合併所有任務並添加跨模組依賴
        const allTasks = [...frontendTasks, ...backendTasks, ...docsTasks].map(task => ({
            ...task,
            requiredResources: {
                cpu: Math.ceil(Math.random() * 10) + 5,
                memory: Math.ceil(Math.random() * 256) + 128,
                network: Math.ceil(Math.random() * 20) + 5
            }
        }));

        console.log(`📋 多模組項目包含 ${allTasks.length} 個任務:`);
        console.log(`  前端模組: ${frontendTasks.length} 個任務`);
        console.log(`  後端模組: ${backendTasks.length} 個任務`);
        console.log(`  文檔部署: ${docsTasks.length} 個任務`);

        // 設置進度監控
        let completedByModule = { frontend: 0, backend: 0, docs: 0 };

        executor.on('taskCompleted', (data) => {
            if (data.taskId.startsWith('fe_')) completedByModule.frontend++;
            else if (data.taskId.startsWith('be_')) completedByModule.backend++;
            else completedByModule.docs++;

            console.log(`  📈 模組進度: 前端=${completedByModule.frontend}/${frontendTasks.length}, 後端=${completedByModule.backend}/${backendTasks.length}, 文檔=${completedByModule.docs}/${docsTasks.length}`);
        });

        const startTime = Date.now();

        // 創建並執行計劃
        const planId = await executor.createExecutionPlan(allTasks, {
            strategy: 'adaptive',
            maxConcurrency: 10,
            resourceLimits: {
                cpu: 200,
                memory: 3072,
                network: 150
            }
        });

        const result = await executor.executePlan(planId);
        const executionTime = Date.now() - startTime;

        console.log(`\n📊 多模組開發執行結果:`);
        console.log(`  總耗時: ${(executionTime / 1000).toFixed(2)}秒`);
        console.log(`  完成任務: ${Object.keys(result.results).length}/${allTasks.length}`);
        console.log(`  模組完成度: 前端=${completedByModule.frontend}/${frontendTasks.length}, 後端=${completedByModule.backend}/${backendTasks.length}, 文檔=${completedByModule.docs}/${docsTasks.length}`);

        return result;

    } finally {
        await executor.shutdown();
    }
}

/**
 * 場景3: 執行策略對比演示
 *
 * 使用相同任務集合測試不同執行策略的性能差異
 * 展示自適應調度的效果
 */
async function demoExecutionStrategies() {
    console.log('\n⚡ 場景3: 執行策略對比演示');
    console.log('=' .repeat(50));

    const strategies = ['aggressive', 'balanced', 'conservative', 'adaptive'];
    const results = {};

    // 創建標準測試任務集
    const standardTasks = [
        { id: 'task_1', name: '輕量任務1', type: 'analysis', dependencies: [], estimatedTime: 1000, requiredResources: { cpu: 2, memory: 128 } },
        { id: 'task_2', name: '輕量任務2', type: 'analysis', dependencies: [], estimatedTime: 1200, requiredResources: { cpu: 3, memory: 128 } },
        { id: 'task_3', name: '中等任務1', type: 'implementation', dependencies: ['task_1'], estimatedTime: 3000, requiredResources: { cpu: 8, memory: 256 } },
        { id: 'task_4', name: '中等任務2', type: 'implementation', dependencies: ['task_2'], estimatedTime: 3500, requiredResources: { cpu: 10, memory: 256 } },
        { id: 'task_5', name: '重型任務1', type: 'processing', dependencies: ['task_3'], estimatedTime: 6000, requiredResources: { cpu: 15, memory: 512 } },
        { id: 'task_6', name: '重型任務2', type: 'processing', dependencies: ['task_4'], estimatedTime: 5500, requiredResources: { cpu: 12, memory: 512 } },
        { id: 'task_7', name: '集成任務', type: 'integration', dependencies: ['task_5', 'task_6'], estimatedTime: 2500, requiredResources: { cpu: 6, memory: 256 } },
        { id: 'task_8', name: '測試任務', type: 'testing', dependencies: ['task_7'], estimatedTime: 4000, requiredResources: { cpu: 8, memory: 384 } }
    ];

    for (const strategy of strategies) {
        console.log(`\n🎯 測試策略: ${strategy.toUpperCase()}`);

        const executor = new ParallelExecutor({
            maxConcurrentPlans: 1,
            enableResourceOptimization: strategy !== 'aggressive',
            enableAdaptiveScheduling: strategy === 'adaptive'
        });

        try {
            await executor.initialize();

            const startTime = Date.now();

            const planId = await executor.createExecutionPlan([...standardTasks], {
                strategy: strategy,
                maxConcurrency: strategy === 'aggressive' ? 15 :
                               strategy === 'balanced' ? 8 :
                               strategy === 'conservative' ? 4 : 6 // adaptive
            });

            const result = await executor.executePlan(planId);
            const executionTime = Date.now() - startTime;

            results[strategy] = {
                executionTime,
                completedTasks: Object.keys(result.results).length,
                totalTasks: standardTasks.length,
                metrics: result.metrics,
                success: result.success
            };

            console.log(`  ⏱️  執行時間: ${(executionTime / 1000).toFixed(2)}秒`);
            console.log(`  ✅ 完成任務: ${Object.keys(result.results).length}/${standardTasks.length}`);
            console.log(`  🔄 並行效率: ${((result.metrics.parallelismEfficiency || 0) * 100).toFixed(1)}%`);

        } catch (error) {
            console.error(`  ❌ 策略 ${strategy} 執行失敗:`, error.message);
            results[strategy] = { error: error.message, success: false };
        } finally {
            await executor.shutdown();
        }

        // 策略間間隔
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 對比分析
    console.log(`\n📊 策略對比分析:`);
    console.log('-'.repeat(70));
    console.log('策略\t\t執行時間\t完成率\t\t並行效率');
    console.log('-'.repeat(70));

    const successfulResults = Object.entries(results).filter(([_, result]) => result.success);

    successfulResults.forEach(([strategy, result]) => {
        const completionRate = ((result.completedTasks / result.totalTasks) * 100).toFixed(1);
        const parallelismEff = ((result.metrics.parallelismEfficiency || 0) * 100).toFixed(1);

        console.log(`${strategy.padEnd(12)}\t${(result.executionTime / 1000).toFixed(2)}s\t\t${completionRate}%\t\t${parallelismEff}%`);
    });

    // 找出最佳策略
    if (successfulResults.length > 0) {
        const bestStrategy = successfulResults.reduce((best, current) => {
            const bestScore = best[1].executionTime * (1 - (best[1].metrics.parallelismEfficiency || 0));
            const currentScore = current[1].executionTime * (1 - (current[1].metrics.parallelismEfficiency || 0));
            return currentScore < bestScore ? current : best;
        });

        console.log(`\n🏆 最佳策略: ${bestStrategy[0].toUpperCase()} (${(bestStrategy[1].executionTime / 1000).toFixed(2)}秒)`);
    }

    return results;
}

/**
 * 場景4: 實時監控和動態調整演示
 *
 * 展示執行過程中的實時監控和動態資源調整
 */
async function demoRealTimeMonitoring() {
    console.log('\n📊 場景4: 實時監控和動態調整演示');
    console.log('=' .repeat(50));

    const executor = new ParallelExecutor({
        enableResourceOptimization: true,
        enableAdaptiveScheduling: true,
        enablePerformanceTuning: true,
        monitoringInterval: 1000, // 1秒監控間隔
        adaptiveAdjustmentInterval: 5000 // 5秒調整間隔
    });

    try {
        await executor.initialize();

        // 創建長時間運行的任務
        const longRunningTasks = [
            { id: 'monitor_1', name: '長時間任務1', type: 'processing', dependencies: [], estimatedTime: 8000, requiredResources: { cpu: 20, memory: 512 } },
            { id: 'monitor_2', name: '長時間任務2', type: 'processing', dependencies: [], estimatedTime: 7000, requiredResources: { cpu: 15, memory: 384 } },
            { id: 'monitor_3', name: '長時間任務3', type: 'processing', dependencies: [], estimatedTime: 9000, requiredResources: { cpu: 25, memory: 640 } },
            { id: 'monitor_4', name: '輕量任務1', type: 'analysis', dependencies: [], estimatedTime: 2000, requiredResources: { cpu: 5, memory: 128 } },
            { id: 'monitor_5', name: '輕量任務2', type: 'analysis', dependencies: [], estimatedTime: 1500, requiredResources: { cpu: 3, memory: 96 } },
            { id: 'monitor_6', name: '集成任務', type: 'integration', dependencies: ['monitor_1', 'monitor_4'], estimatedTime: 3000, requiredResources: { cpu: 10, memory: 256 } }
        ];

        // 設置詳細監控
        let monitoringData = [];

        executor.on('monitoringUpdate', (data) => {
            monitoringData.push({
                timestamp: data.timestamp,
                activeExecutions: data.activeExecutions,
                resourceUsage: Object.fromEntries(
                    Object.entries(data.resourceStatus.pools).map(([type, pool]) =>
                        [type, Math.round(pool.utilization * 100)]
                    )
                ),
                agentUtilization: Math.round(
                    (data.agentStatus.summary.activeAgents / data.agentStatus.summary.totalAgents) * 100
                )
            });

            console.log(`  📈 [${new Date(data.timestamp).toLocaleTimeString()}] 活動執行: ${data.activeExecutions}, CPU: ${Math.round((data.resourceStatus.pools.cpu?.utilization || 0) * 100)}%, Memory: ${Math.round((data.resourceStatus.pools.memory?.utilization || 0) * 100)}%, Agent使用率: ${Math.round((data.agentStatus.summary.activeAgents / data.agentStatus.summary.totalAgents) * 100)}%`);
        });

        executor.on('adaptiveTuningPerformed', (data) => {
            console.log(`  🔧 [${new Date(data.timestamp).toLocaleTimeString()}] 自適應調整: 最優併發數=${data.adjustments.optimalConcurrency}`);
        });

        executor.on('performanceOptimized', (optimizations) => {
            console.log(`  ⚙️  [${new Date().toLocaleTimeString()}] 性能優化: ${optimizations.length} 項調整`);
            optimizations.forEach(opt => {
                console.log(`    - ${opt.type}: ${opt.reason}`);
            });
        });

        console.log(`📋 開始監控 ${longRunningTasks.length} 個長時間運行任務...`);

        const startTime = Date.now();

        const planId = await executor.createExecutionPlan(longRunningTasks, {
            strategy: 'adaptive',
            maxConcurrency: 6
        });

        const result = await executor.executePlan(planId);
        const executionTime = Date.now() - startTime;

        console.log(`\n📊 監控結果:`);
        console.log(`  總耗時: ${(executionTime / 1000).toFixed(2)}秒`);
        console.log(`  監控數據點: ${monitoringData.length} 個`);
        console.log(`  完成任務: ${Object.keys(result.results).length}/${longRunningTasks.length}`);

        // 分析監控數據
        if (monitoringData.length > 0) {
            const avgCpuUsage = monitoringData.reduce((sum, data) => sum + data.resourceUsage.cpu, 0) / monitoringData.length;
            const avgMemUsage = monitoringData.reduce((sum, data) => sum + data.resourceUsage.memory, 0) / monitoringData.length;
            const avgAgentUtil = monitoringData.reduce((sum, data) => sum + data.agentUtilization, 0) / monitoringData.length;

            console.log(`  📊 平均資源使用率: CPU=${avgCpuUsage.toFixed(1)}%, Memory=${avgMemUsage.toFixed(1)}%, Agent=${avgAgentUtil.toFixed(1)}%`);
        }

        return result;

    } finally {
        await executor.shutdown();
    }
}

/**
 * 主演示函數
 */
async function runAllDemos() {
    console.log('🚀 並行執行協調器完整演示');
    console.log('='.repeat(80));
    console.log('這個演示將展示並行執行協調器在不同場景下的應用和效果');
    console.log('='.repeat(80));

    const startTime = Date.now();

    try {
        // 場景1: 代碼分析項目
        await demoCodeAnalysisProject();
        await sleep(2000);

        // 場景2: 多模組開發
        await demoMultiModuleDevelopment();
        await sleep(2000);

        // 場景3: 執行策略對比
        await demoExecutionStrategies();
        await sleep(2000);

        // 場景4: 實時監控
        await demoRealTimeMonitoring();

        const totalTime = Date.now() - startTime;

        console.log('\n' + '='.repeat(80));
        console.log('🎉 並行執行協調器演示完成!');
        console.log(`⏱️  總演示時間: ${(totalTime / 1000).toFixed(2)}秒`);
        console.log('\n主要展示功能:');
        console.log('✅ 複雜依賴關係的智能解析和並行優化');
        console.log('✅ 多模組項目的協調開發和資源管理');
        console.log('✅ 不同執行策略的性能對比和最優選擇');
        console.log('✅ 實時監控、動態調整和性能調優');
        console.log('✅ 故障恢復和容錯處理機制');
        console.log('✅ CCPM+SuperClaude整合的完整工作流程');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ 演示過程中發生錯誤:', error);
        process.exit(1);
    }
}

// 輔助函數
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 如果直接運行此腳本
if (require.main === module) {
    runAllDemos().catch(console.error);
}

module.exports = {
    demoCodeAnalysisProject,
    demoMultiModuleDevelopment,
    demoExecutionStrategies,
    demoRealTimeMonitoring,
    runAllDemos
};