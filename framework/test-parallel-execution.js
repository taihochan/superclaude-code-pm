/**
 * 並行執行協調器測試和驗證系統
 *
 * 功能：
 * - 全面測試ParallelExecutor的各項功能
 * - 驗證與基礎設施組件的整合
 * - 性能基準測試和負載測試
 * - 故障恢復和容錯測試
 * - 實際應用場景模擬
 */

const ParallelExecutor = require('./ParallelExecutor');
const DependencyResolver = require('./DependencyResolver');
const ResourceManager = require('./ResourceManager');
const AgentManager = require('./AgentManager');
const EventBus = require('./EventBus');

/**
 * 測試工具類
 */
class TestUtils {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateTestTasks(count, options = {}) {
        const tasks = [];
        const {
            hasInterdependencies = true,
            taskTypes = ['analysis', 'implementation', 'testing'],
            complexity = 'medium'
        } = options;

        for (let i = 0; i < count; i++) {
            const task = {
                id: `task_${i + 1}`,
                type: taskTypes[i % taskTypes.length],
                name: `測試任務 ${i + 1}`,
                priority: Math.floor(Math.random() * 10),
                estimatedTime: complexity === 'simple' ?
                    1000 + Math.random() * 2000 : // 1-3秒
                    complexity === 'complex' ?
                    5000 + Math.random() * 10000 : // 5-15秒
                    2000 + Math.random() * 4000, // 2-6秒 (medium)

                requiredResources: {
                    cpu: Math.ceil(Math.random() * 5),
                    memory: Math.ceil(Math.random() * 512),
                    network: Math.ceil(Math.random() * 10)
                },

                inputs: [],
                outputs: [`output_${i + 1}`],

                // 模擬任務執行函數
                execute: async function() {
                    await TestUtils.sleep(this.estimatedTime);
                    return {
                        taskId: this.id,
                        success: true,
                        executionTime: this.estimatedTime,
                        result: `任務 ${this.name} 執行完成`,
                        timestamp: new Date().toISOString()
                    };
                }
            };

            // 添加依賴關係
            if (hasInterdependencies && i > 0) {
                // 前一個任務的輸出作為當前任務的輸入
                if (Math.random() > 0.3) { // 70%概率有依賴
                    const depIndex = Math.floor(Math.random() * i);
                    task.dependencies = [`task_${depIndex + 1}`];
                    task.inputs = [`output_${depIndex + 1}`];
                }
            }

            tasks.push(task);
        }

        return tasks;
    }

    static createPerformanceCounter() {
        return {
            start: Date.now(),
            checkpoints: new Map(),

            checkpoint(name) {
                this.checkpoints.set(name, Date.now() - this.start);
            },

            getResults() {
                return {
                    totalTime: Date.now() - this.start,
                    checkpoints: Object.fromEntries(this.checkpoints)
                };
            }
        };
    }

    static async measureMemoryUsage() {
        if (global.gc) {
            global.gc();
        }

        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        };
    }
}

/**
 * 測試執行器類
 */
class ParallelExecutionTester {
    constructor() {
        this.parallelExecutor = null;
        this.testResults = new Map();
        this.testStartTime = null;
    }

    /**
     * 初始化測試環境
     */
    async initialize() {
        console.log('🚀 初始化並行執行測試環境...');

        try {
            // 創建並行執行器
            this.parallelExecutor = new ParallelExecutor({
                maxConcurrentPlans: 3,
                enableResourceOptimization: true,
                enableAdaptiveScheduling: true,
                monitoringInterval: 1000
            });

            // 初始化並行執行器
            await this.parallelExecutor.initialize();

            console.log('✅ 測試環境初始化完成');
            return true;

        } catch (error) {
            console.error('❌ 測試環境初始化失敗:', error);
            return false;
        }
    }

    /**
     * 基本功能測試
     */
    async testBasicFunctionality() {
        console.log('\n📋 開始基本功能測試...');
        const testName = 'basic_functionality';
        const perf = TestUtils.createPerformanceCounter();

        try {
            // 生成簡單測試任務
            const tasks = TestUtils.generateTestTasks(5, {
                hasInterdependencies: true,
                complexity: 'simple'
            });

            perf.checkpoint('tasks_generated');

            // 創建執行計劃
            const planId = await this.parallelExecutor.createExecutionPlan(tasks, {
                strategy: 'balanced',
                maxConcurrency: 3
            });

            perf.checkpoint('plan_created');
            console.log(`  計劃已創建: ${planId}`);

            // 執行計劃
            const result = await this.parallelExecutor.executePlan(planId);

            perf.checkpoint('plan_executed');

            // 驗證結果
            const success = result.success &&
                           Object.keys(result.results).length === tasks.length;

            this.testResults.set(testName, {
                success,
                tasks: tasks.length,
                executionTime: result.executionTime,
                performance: perf.getResults(),
                details: success ? '所有任務成功執行' : '存在執行失敗'
            });

            console.log(`  ✅ 基本功能測試${success ? '通過' : '失敗'}`);
            console.log(`  📊 執行時間: ${result.executionTime}ms`);
            console.log(`  📈 完成任務: ${Object.keys(result.results).length}/${tasks.length}`);

            return success;

        } catch (error) {
            console.error('  ❌ 基本功能測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 依賴解析測試
     */
    async testDependencyResolution() {
        console.log('\n🔗 開始依賴解析測試...');
        const testName = 'dependency_resolution';
        const perf = TestUtils.createPerformanceCounter();

        try {
            // 生成有複雜依賴關係的任務
            const tasks = [
                { id: 'setup', name: '環境設置', type: 'setup', dependencies: [], outputs: ['env'] },
                { id: 'analysis_1', name: '需求分析', type: 'analysis', dependencies: ['setup'], inputs: ['env'], outputs: ['requirements'] },
                { id: 'analysis_2', name: '技術分析', type: 'analysis', dependencies: ['setup'], inputs: ['env'], outputs: ['tech_spec'] },
                { id: 'design', name: '系統設計', type: 'design', dependencies: ['analysis_1', 'analysis_2'], inputs: ['requirements', 'tech_spec'], outputs: ['design'] },
                { id: 'impl_1', name: '前端實現', type: 'implementation', dependencies: ['design'], inputs: ['design'], outputs: ['frontend'] },
                { id: 'impl_2', name: '後端實現', type: 'implementation', dependencies: ['design'], inputs: ['design'], outputs: ['backend'] },
                { id: 'integration', name: '系統集成', type: 'integration', dependencies: ['impl_1', 'impl_2'], inputs: ['frontend', 'backend'], outputs: ['system'] },
                { id: 'testing', name: '集成測試', type: 'testing', dependencies: ['integration'], inputs: ['system'], outputs: ['test_report'] }
            ].map(task => ({
                ...task,
                estimatedTime: 2000 + Math.random() * 3000,
                requiredResources: { cpu: 2, memory: 256, network: 5 }
            }));

            perf.checkpoint('complex_tasks_generated');

            // 創建並執行計劃
            const planId = await this.parallelExecutor.createExecutionPlan(tasks, {
                strategy: 'balanced',
                maxConcurrency: 4
            });

            const result = await this.parallelExecutor.executePlan(planId);

            perf.checkpoint('complex_plan_executed');

            // 驗證依賴順序正確
            const executionOrder = [];
            for (const [taskId, taskResult] of Object.entries(result.results)) {
                executionOrder.push({
                    taskId,
                    completionTime: new Date(taskResult.timestamp).getTime()
                });
            }

            // 按完成時間排序
            executionOrder.sort((a, b) => a.completionTime - b.completionTime);

            // 驗證依賴順序
            let dependencyOrderCorrect = true;
            const completed = new Set();

            for (const item of executionOrder) {
                const task = tasks.find(t => t.id === item.taskId);

                // 檢查所有依賴是否已完成
                for (const depId of task.dependencies || []) {
                    if (!completed.has(depId)) {
                        dependencyOrderCorrect = false;
                        console.log(`  ⚠️  依賴順序錯誤: ${task.id} 在 ${depId} 完成前執行`);
                        break;
                    }
                }

                completed.add(item.taskId);
            }

            const success = result.success && dependencyOrderCorrect;

            this.testResults.set(testName, {
                success,
                tasksCount: tasks.length,
                executionOrder: executionOrder.map(item => item.taskId),
                dependencyOrderCorrect,
                executionTime: result.executionTime,
                performance: perf.getResults()
            });

            console.log(`  ✅ 依賴解析測試${success ? '通過' : '失敗'}`);
            console.log(`  📋 執行順序: ${executionOrder.map(i => i.taskId).join(' → ')}`);
            console.log(`  🎯 依賴順序${dependencyOrderCorrect ? '正確' : '錯誤'}`);

            return success;

        } catch (error) {
            console.error('  ❌ 依賴解析測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 並發性能測試
     */
    async testConcurrencyPerformance() {
        console.log('\n⚡ 開始並發性能測試...');
        const testName = 'concurrency_performance';
        const perf = TestUtils.createPerformanceCounter();

        try {
            const taskCounts = [5, 10, 20];
            const performanceResults = [];

            for (const taskCount of taskCounts) {
                console.log(`  🔄 測試 ${taskCount} 個並發任務...`);

                // 生成獨立任務（無依賴，可完全並行）
                const tasks = TestUtils.generateTestTasks(taskCount, {
                    hasInterdependencies: false,
                    complexity: 'medium'
                });

                const startTime = Date.now();

                // 順序執行基準測試
                const sequentialStart = Date.now();
                for (const task of tasks.slice(0, 3)) { // 只測試前3個作為基準
                    await TestUtils.sleep(task.estimatedTime);
                }
                const sequentialTime = Date.now() - sequentialStart;
                const estimatedSequentialTotal = (sequentialTime / 3) * taskCount;

                // 並行執行
                const planId = await this.parallelExecutor.createExecutionPlan(tasks, {
                    strategy: 'aggressive',
                    maxConcurrency: Math.min(10, taskCount)
                });

                const result = await this.parallelExecutor.executePlan(planId);
                const parallelTime = Date.now() - startTime;

                // 計算性能提升
                const speedup = estimatedSequentialTotal / parallelTime;
                const efficiency = speedup / Math.min(10, taskCount); // 基於最大並發數

                performanceResults.push({
                    taskCount,
                    parallelTime,
                    estimatedSequentialTime: estimatedSequentialTotal,
                    speedup: Math.round(speedup * 100) / 100,
                    efficiency: Math.round(efficiency * 100),
                    completedTasks: Object.keys(result.results).length
                });

                console.log(`    ⏱️  並行時間: ${parallelTime}ms`);
                console.log(`    📈 速度提升: ${speedup.toFixed(2)}x`);
                console.log(`    💯 並行效率: ${(efficiency * 100).toFixed(1)}%`);
            }

            // 評估整體性能
            const avgSpeedup = performanceResults.reduce((sum, r) => sum + r.speedup, 0) / performanceResults.length;
            const avgEfficiency = performanceResults.reduce((sum, r) => sum + r.efficiency, 0) / performanceResults.length;

            const success = avgSpeedup > 2.0 && avgEfficiency > 60; // 至少2倍速度提升，60%效率

            perf.checkpoint('concurrency_tests_complete');

            this.testResults.set(testName, {
                success,
                averageSpeedup: Math.round(avgSpeedup * 100) / 100,
                averageEfficiency: Math.round(avgEfficiency),
                performanceResults,
                performance: perf.getResults()
            });

            console.log(`  ✅ 並發性能測試${success ? '通過' : '失敗'}`);
            console.log(`  📊 平均速度提升: ${avgSpeedup.toFixed(2)}x`);
            console.log(`  📊 平均並行效率: ${avgEfficiency.toFixed(1)}%`);

            return success;

        } catch (error) {
            console.error('  ❌ 並發性能測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 資源管理測試
     */
    async testResourceManagement() {
        console.log('\n💾 開始資源管理測試...');
        const testName = 'resource_management';
        const perf = TestUtils.createPerformanceCounter();

        try {
            // 生成資源密集型任務
            const heavyTasks = TestUtils.generateTestTasks(8, {
                hasInterdependencies: false,
                complexity: 'simple'
            }).map(task => ({
                ...task,
                requiredResources: {
                    cpu: 50, // 高CPU需求
                    memory: 256,
                    network: 20
                }
            }));

            perf.checkpoint('heavy_tasks_generated');

            // 測試資源限制
            const planId = await this.parallelExecutor.createExecutionPlan(heavyTasks, {
                strategy: 'conservative',
                resourceLimits: {
                    cpu: 200, // 限制總CPU
                    memory: 1024,
                    network: 100
                }
            });

            const resourceStatusBefore = this.parallelExecutor.resourceManager.getSystemStatus();
            console.log('  📊 執行前資源狀態:');
            Object.entries(resourceStatusBefore.pools).forEach(([type, pool]) => {
                console.log(`    ${type}: ${(pool.utilization * 100).toFixed(1)}% 使用率`);
            });

            const result = await this.parallelExecutor.executePlan(planId);

            const resourceStatusAfter = this.parallelExecutor.resourceManager.getSystemStatus();

            perf.checkpoint('resource_test_complete');

            // 驗證資源管理
            const resourceUsageValid = Object.values(resourceStatusBefore.pools).every(
                pool => pool.utilization <= 1.0 // 沒有超出100%使用率
            );

            const success = result.success && resourceUsageValid;

            this.testResults.set(testName, {
                success,
                resourceUsageValid,
                completedTasks: Object.keys(result.results).length,
                totalTasks: heavyTasks.length,
                executionTime: result.executionTime,
                resourceStatusBefore,
                resourceStatusAfter,
                performance: perf.getResults()
            });

            console.log(`  ✅ 資源管理測試${success ? '通過' : '失敗'}`);
            console.log(`  🎯 資源使用${resourceUsageValid ? '合規' : '超限'}`);
            console.log(`  📈 完成任務: ${Object.keys(result.results).length}/${heavyTasks.length}`);

            return success;

        } catch (error) {
            console.error('  ❌ 資源管理測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 故障恢復測試
     */
    async testFailureRecovery() {
        console.log('\n🛡️ 開始故障恢復測試...');
        const testName = 'failure_recovery';
        const perf = TestUtils.createPerformanceCounter();

        try {
            // 生成包含會失敗任務的測試集
            const tasks = TestUtils.generateTestTasks(6, {
                hasInterdependencies: true,
                complexity: 'simple'
            });

            // 設置第3個任務會失敗
            tasks[2].willFail = true;
            const originalExecute = tasks[2].execute;
            tasks[2].execute = async function() {
                await TestUtils.sleep(1000);
                throw new Error('模擬任務失敗');
            };

            perf.checkpoint('failing_tasks_prepared');

            // 創建執行計劃並啟用重試
            const planId = await this.parallelExecutor.createExecutionPlan(tasks, {
                strategy: 'balanced',
                retryPolicy: {
                    enabled: true,
                    maxAttempts: 2,
                    backoffMultiplier: 1.5
                },
                continueOnError: true // 繼續執行其他任務
            });

            // 設置錯誤處理器
            let errorsCaught = 0;
            this.parallelExecutor.on('taskFailed', (data) => {
                if (data.taskId === tasks[2].id) {
                    errorsCaught++;
                    console.log(`  🚨 捕獲任務失敗事件 (第${errorsCaught}次): ${data.taskId}`);
                }
            });

            const result = await this.parallelExecutor.executePlan(planId);

            perf.checkpoint('failure_recovery_complete');

            // 分析結果
            const completedTasks = Object.keys(result.results).length;
            const expectedCompleted = tasks.length - 1; // 除了失敗的任務
            const recoverySuccessful = completedTasks >= expectedCompleted - 2; // 允許一些相關任務失敗

            // 檢查是否嘗試了重試
            const retryAttempted = errorsCaught > 1;

            const success = recoverySuccessful && retryAttempted;

            this.testResults.set(testName, {
                success,
                totalTasks: tasks.length,
                completedTasks,
                failedTasks: tasks.length - completedTasks,
                retryAttempted,
                errorsCaught,
                recoverySuccessful,
                performance: perf.getResults()
            });

            console.log(`  ✅ 故障恢復測試${success ? '通過' : '失敗'}`);
            console.log(`  🔄 重試機制${retryAttempted ? '正常' : '未觸發'}`);
            console.log(`  📊 完成任務: ${completedTasks}/${tasks.length}`);
            console.log(`  🛡️ 恢復${recoverySuccessful ? '成功' : '失敗'}`);

            return success;

        } catch (error) {
            console.error('  ❌ 故障恢復測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 執行控制測試
     */
    async testExecutionControl() {
        console.log('\n🎮 開始執行控制測試...');
        const testName = 'execution_control';
        const perf = TestUtils.createPerformanceCounter();

        try {
            // 生成長時間運行的任務
            const longRunningTasks = TestUtils.generateTestTasks(4, {
                hasInterdependencies: false,
                complexity: 'simple'
            }).map(task => ({
                ...task,
                estimatedTime: 3000 // 3秒運行時間
            }));

            perf.checkpoint('long_tasks_generated');

            // 創建執行計劃
            const planId = await this.parallelExecutor.createExecutionPlan(longRunningTasks, {
                strategy: 'balanced'
            });

            console.log(`  🚀 開始執行計劃: ${planId}`);

            // 異步執行計劃
            const executionPromise = this.parallelExecutor.executePlan(planId);

            // 等待1秒後暫停
            await TestUtils.sleep(1000);
            console.log('  ⏸️  暫停執行計劃...');
            const pauseSuccess = await this.parallelExecutor.pausePlan(planId);

            await TestUtils.sleep(500);

            // 恢復執行
            console.log('  ▶️  恢復執行計劃...');
            const resumeSuccess = await this.parallelExecutor.resumePlan(planId);

            // 等待執行完成
            const result = await executionPromise;

            perf.checkpoint('control_test_complete');

            const success = pauseSuccess && resumeSuccess && result.success;

            this.testResults.set(testName, {
                success,
                pauseSuccess,
                resumeSuccess,
                executionSuccess: result.success,
                totalTasks: longRunningTasks.length,
                completedTasks: Object.keys(result.results).length,
                executionTime: result.executionTime,
                performance: perf.getResults()
            });

            console.log(`  ✅ 執行控制測試${success ? '通過' : '失敗'}`);
            console.log(`  ⏸️  暫停操作${pauseSuccess ? '成功' : '失敗'}`);
            console.log(`  ▶️  恢復操作${resumeSuccess ? '成功' : '失敗'}`);

            return success;

        } catch (error) {
            console.error('  ❌ 執行控制測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 載入測試
     */
    async testLoadHandling() {
        console.log('\n📈 開始載入測試...');
        const testName = 'load_handling';
        const perf = TestUtils.createPerformanceCounter();

        try {
            const initialMemory = await TestUtils.measureMemoryUsage();
            console.log(`  🧠 初始記憶體使用: ${initialMemory.heapUsed}MB`);

            // 創建多個並發執行計劃
            const planPromises = [];
            const planIds = [];

            for (let i = 0; i < 3; i++) {
                const tasks = TestUtils.generateTestTasks(8, {
                    hasInterdependencies: true,
                    complexity: 'simple'
                });

                const planId = await this.parallelExecutor.createExecutionPlan(tasks, {
                    strategy: 'adaptive',
                    maxConcurrency: 5
                });

                planIds.push(planId);
                planPromises.push(this.parallelExecutor.executePlan(planId));

                console.log(`  📋 創建執行計劃 ${i + 1}: ${planId} (${tasks.length} 任務)`);
            }

            perf.checkpoint('load_plans_created');

            // 監控系統狀態
            const statusMonitor = setInterval(() => {
                const status = this.parallelExecutor.getExecutionStatus();
                console.log(`    📊 活動計劃: ${status.summary.activePlans}/${status.summary.totalPlans}`);
            }, 2000);

            // 等待所有計劃完成
            const results = await Promise.allSettled(planPromises);

            clearInterval(statusMonitor);

            const finalMemory = await TestUtils.measureMemoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            perf.checkpoint('load_test_complete');

            // 分析結果
            const successfulPlans = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const totalTasks = results
                .filter(r => r.status === 'fulfilled')
                .reduce((sum, r) => sum + Object.keys(r.value.results || {}).length, 0);

            const success = successfulPlans === planIds.length && memoryIncrease < 100; // 記憶體增長小於100MB

            this.testResults.set(testName, {
                success,
                totalPlans: planIds.length,
                successfulPlans,
                totalTasksCompleted: totalTasks,
                memoryIncrease,
                initialMemory,
                finalMemory,
                performance: perf.getResults()
            });

            console.log(`  ✅ 載入測試${success ? '通過' : '失敗'}`);
            console.log(`  📊 成功計劃: ${successfulPlans}/${planIds.length}`);
            console.log(`  🧠 記憶體增長: ${memoryIncrease}MB`);
            console.log(`  ✨ 完成任務總數: ${totalTasks}`);

            return success;

        } catch (error) {
            console.error('  ❌ 載入測試失敗:', error.message);
            this.testResults.set(testName, {
                success: false,
                error: error.message,
                performance: perf.getResults()
            });
            return false;
        }
    }

    /**
     * 運行所有測試
     */
    async runAllTests() {
        console.log('🧪 開始並行執行協調器全面測試...\n');
        this.testStartTime = Date.now();

        const tests = [
            'testBasicFunctionality',
            'testDependencyResolution',
            'testConcurrencyPerformance',
            'testResourceManagement',
            'testFailureRecovery',
            'testExecutionControl',
            'testLoadHandling'
        ];

        const results = {
            passed: 0,
            failed: 0,
            details: {}
        };

        for (const testMethod of tests) {
            try {
                const success = await this[testMethod]();
                if (success) {
                    results.passed++;
                } else {
                    results.failed++;
                }
                results.details[testMethod] = success;
            } catch (error) {
                console.error(`❌ 測試 ${testMethod} 執行失敗:`, error.message);
                results.failed++;
                results.details[testMethod] = false;
            }

            // 測試間隔
            await TestUtils.sleep(1000);
        }

        // 生成測試報告
        await this.generateTestReport(results);

        return results;
    }

    /**
     * 生成測試報告
     */
    async generateTestReport(testSummary) {
        const totalTime = Date.now() - this.testStartTime;
        const finalMemory = await TestUtils.measureMemoryUsage();

        console.log('\n' + '='.repeat(80));
        console.log('📊 並行執行協調器測試報告');
        console.log('='.repeat(80));

        console.log(`\n🎯 測試概要:`);
        console.log(`  總測試數: ${testSummary.passed + testSummary.failed}`);
        console.log(`  通過測試: ${testSummary.passed}`);
        console.log(`  失敗測試: ${testSummary.failed}`);
        console.log(`  成功率: ${((testSummary.passed / (testSummary.passed + testSummary.failed)) * 100).toFixed(1)}%`);
        console.log(`  總測試時間: ${(totalTime / 1000).toFixed(2)}秒`);

        console.log(`\n🧠 系統資源:`);
        console.log(`  最終記憶體使用: ${finalMemory.heapUsed}MB`);
        console.log(`  堆記憶體總量: ${finalMemory.heapTotal}MB`);

        console.log(`\n📋 詳細結果:`);
        for (const [testName, testResult] of this.testResults) {
            const status = testResult.success ? '✅ 通過' : '❌ 失敗';
            console.log(`  ${testName}: ${status}`);

            if (testResult.error) {
                console.log(`    錯誤: ${testResult.error}`);
            }

            if (testResult.performance) {
                console.log(`    執行時間: ${testResult.performance.totalTime}ms`);
            }

            // 顯示關鍵指標
            if (testName === 'concurrency_performance' && testResult.success) {
                console.log(`    平均速度提升: ${testResult.averageSpeedup}x`);
                console.log(`    平均並行效率: ${testResult.averageEfficiency}%`);
            }

            if (testName === 'load_handling' && testResult.success) {
                console.log(`    處理計劃: ${testResult.successfulPlans}/${testResult.totalPlans}`);
                console.log(`    記憶體增長: ${testResult.memoryIncrease}MB`);
            }
        }

        console.log('\n' + '='.repeat(80));

        if (testSummary.failed === 0) {
            console.log('🎉 所有測試通過！並行執行協調器功能正常。');
        } else {
            console.log(`⚠️  有 ${testSummary.failed} 個測試失敗，需要進一步檢查。`);
        }

        console.log('='.repeat(80) + '\n');
    }

    /**
     * 清理測試環境
     */
    async cleanup() {
        console.log('🧹 清理測試環境...');

        try {
            if (this.parallelExecutor) {
                await this.parallelExecutor.shutdown();
            }
            console.log('✅ 測試環境清理完成');
        } catch (error) {
            console.error('❌ 測試環境清理失敗:', error);
        }
    }
}

/**
 * 主測試執行函數
 */
async function runParallelExecutionTests() {
    const tester = new ParallelExecutionTester();

    try {
        // 初始化測試環境
        const initialized = await tester.initialize();
        if (!initialized) {
            console.error('❌ 無法初始化測試環境，退出測試');
            return;
        }

        // 運行所有測試
        const results = await tester.runAllTests();

        // 退出代碼
        process.exitCode = results.failed > 0 ? 1 : 0;

    } catch (error) {
        console.error('❌ 測試執行出現嚴重錯誤:', error);
        process.exitCode = 1;
    } finally {
        // 清理資源
        await tester.cleanup();
    }
}

// 如果直接運行此腳本
if (require.main === module) {
    runParallelExecutionTests().catch(console.error);
}

module.exports = {
    ParallelExecutionTester,
    TestUtils,
    runParallelExecutionTests
};