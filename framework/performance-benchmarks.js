/**
 * 性能基準測試系統
 *
 * 功能：
 * - 系統性能基準測試和驗證
 * - 20%性能提升目標驗證
 * - 資源使用率優化評估
 * - 響應時間和吞吐量測試
 * - 記憶體和CPU使用優化驗證
 *
 * 用途：Epic整合的性能質量保證
 * 配合：與test-epic-integration.js協同進行完整性能評估
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import EventEmitter from 'eventemitter3';
import { Worker } from 'worker_threads';
import os from 'os';

// 性能測試類型定義
export const BENCHMARK_TYPES = {
    THROUGHPUT: 'throughput',           // 吞吐量測試
    LATENCY: 'latency',                // 延遲測試
    MEMORY: 'memory',                  // 記憶體使用測試
    CPU: 'cpu',                       // CPU使用測試
    CONCURRENCY: 'concurrency',       // 並發測試
    SCALABILITY: 'scalability',       // 可擴展性測試
    STRESS: 'stress'                  // 壓力測試
};

// 性能等級定義
export const PERFORMANCE_LEVELS = {
    EXCELLENT: 'excellent',    // 優秀 (>30%改善)
    GOOD: 'good',             // 良好 (20-30%改善)
    ACCEPTABLE: 'acceptable', // 可接受 (10-20%改善)
    WARNING: 'warning',       // 警告 (0-10%改善)
    POOR: 'poor',            // 差 (<0%改善)
    CRITICAL: 'critical'      // 嚴重 (<-10%退步)
};

// 基準目標定義
export const PERFORMANCE_TARGETS = {
    // 20%性能提升目標
    OVERALL_IMPROVEMENT: 20,

    // 具體指標目標
    COMMAND_THROUGHPUT: 1200,         // 每秒命令處理數 (基準: 1000)
    AVERAGE_LATENCY: 8,               // 平均延遲毫秒 (基準: 10ms)
    MEMORY_EFFICIENCY: 20,            // 記憶體效率提升% (基準: 100MB)
    CPU_UTILIZATION: 0.75,            // CPU使用率上限
    CONCURRENT_CONNECTIONS: 20,        // 並發連接數 (基準: 15)
    ERROR_RATE: 0.001,               // 錯誤率上限 0.1%
    RESPONSE_TIME_P95: 25,           // 95%響應時間毫秒 (基準: 30ms)
    RESOURCE_UTILIZATION: 0.85       // 資源利用率目標
};

/**
 * 性能基準測試執行器
 */
export class PerformanceBenchmarkRunner extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            warmupIterations: 100,      // 預熱迭代次數
            benchmarkIterations: 1000,  // 基準測試迭代次數
            sampleSize: 50,            // 樣本大小
            timeout: 300000,           // 5分鐘超時
            parallelWorkers: os.cpus().length, // 並行Worker數量
            enableProfiling: true,     // 啟用性能分析
            detailedMetrics: true,     // 詳細指標記錄
            memorySnapshots: true,     // 記憶體快照
            ...options
        };

        // 基準測試數據
        this.baselines = new Map();
        this.results = new Map();
        this.metrics = new Map();

        // 性能觀察者
        this.performanceObserver = null;
        this.memoryMonitor = null;

        // 測試狀態
        this.isRunning = false;
        this.currentBenchmark = null;

        // 初始化基準數據
        this._initializeBaselines();
        this._setupPerformanceMonitoring();
    }

    /**
     * 執行完整性能基準測試
     */
    async runFullBenchmarkSuite(components) {
        if (this.isRunning) {
            throw new Error('性能測試已在運行中');
        }

        this.isRunning = true;
        const startTime = performance.now();

        try {
            this.emit('benchmarkSuiteStarted');

            // 預熱系統
            await this._warmupSystem(components);

            // 基準測試套件
            const benchmarks = [
                'commandThroughputBenchmark',
                'latencyBenchmark',
                'memoryEfficiencyBenchmark',
                'cpuUtilizationBenchmark',
                'concurrencyBenchmark',
                'scalabilityBenchmark',
                'stressTestBenchmark',
                'resourceOptimizationBenchmark'
            ];

            const results = new Map();

            for (const benchmarkName of benchmarks) {
                this.currentBenchmark = benchmarkName;
                this.emit('benchmarkStarted', benchmarkName);

                const result = await this._runBenchmark(benchmarkName, components);
                results.set(benchmarkName, result);

                this.emit('benchmarkCompleted', benchmarkName, result);

                // 清理垃圾回收
                if (global.gc) {
                    global.gc();
                }

                // 短暫休息避免系統過載
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const endTime = performance.now();
            const totalDuration = endTime - startTime;

            // 生成綜合性能報告
            const performanceReport = await this._generatePerformanceReport(results, totalDuration);

            this.emit('benchmarkSuiteCompleted', performanceReport);
            return performanceReport;

        } finally {
            this.isRunning = false;
            this.currentBenchmark = null;
        }
    }

    /**
     * 命令吞吐量基準測試
     */
    async _runCommandThroughputBenchmark(components) {
        const commands = [
            '/integrated:status',
            '/integrated:analyze simple',
            '/integrated:workflow basic',
            '/sc:help',
            '/test:performance'
        ];

        const startTime = performance.now();
        const results = [];

        // 執行基準測試
        for (let i = 0; i < this.options.benchmarkIterations; i++) {
            const command = commands[i % commands.length];
            const cmdStart = performance.now();

            try {
                await components.commandRouter.route(command);
                const cmdEnd = performance.now();
                results.push({
                    duration: cmdEnd - cmdStart,
                    success: true,
                    command
                });
            } catch (error) {
                const cmdEnd = performance.now();
                results.push({
                    duration: cmdEnd - cmdStart,
                    success: false,
                    command,
                    error: error.message
                });
            }
        }

        const endTime = performance.now();
        const totalDuration = endTime - startTime;

        // 計算統計數據
        const successfulCommands = results.filter(r => r.success);
        const throughput = (successfulCommands.length / totalDuration) * 1000; // commands per second
        const averageLatency = successfulCommands.reduce((sum, r) => sum + r.duration, 0) / successfulCommands.length;
        const errorRate = (results.length - successfulCommands.length) / results.length;

        const baseline = this.baselines.get('commandThroughput');
        const improvement = ((throughput - baseline.throughput) / baseline.throughput) * 100;

        return {
            type: BENCHMARK_TYPES.THROUGHPUT,
            metrics: {
                throughput: Math.round(throughput),
                averageLatency: Math.round(averageLatency * 100) / 100,
                errorRate: Math.round(errorRate * 10000) / 100, // percentage
                totalCommands: results.length,
                successfulCommands: successfulCommands.length
            },
            baseline: baseline,
            improvement: Math.round(improvement * 100) / 100,
            performanceLevel: this._getPerformanceLevel(improvement),
            targetAchieved: throughput >= PERFORMANCE_TARGETS.COMMAND_THROUGHPUT
        };
    }

    /**
     * 延遲基準測試
     */
    async _runLatencyBenchmark(components) {
        const latencies = [];
        const commands = ['/integrated:status', '/sc:help'];

        for (let i = 0; i < this.options.sampleSize; i++) {
            const command = commands[i % commands.length];

            // 多次測量取平均
            const measurements = [];
            for (let j = 0; j < 10; j++) {
                const start = performance.now();
                await components.commandRouter.route(command);
                const end = performance.now();
                measurements.push(end - start);
            }

            const avgLatency = measurements.reduce((a, b) => a + b) / measurements.length;
            latencies.push(avgLatency);
        }

        // 統計計算
        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];
        const average = latencies.reduce((a, b) => a + b) / latencies.length;

        const baseline = this.baselines.get('latency');
        const improvement = ((baseline.average - average) / baseline.average) * 100;

        return {
            type: BENCHMARK_TYPES.LATENCY,
            metrics: {
                average: Math.round(average * 100) / 100,
                p50: Math.round(p50 * 100) / 100,
                p95: Math.round(p95 * 100) / 100,
                p99: Math.round(p99 * 100) / 100,
                min: Math.round(latencies[0] * 100) / 100,
                max: Math.round(latencies[latencies.length - 1] * 100) / 100
            },
            baseline: baseline,
            improvement: Math.round(improvement * 100) / 100,
            performanceLevel: this._getPerformanceLevel(improvement),
            targetAchieved: average <= PERFORMANCE_TARGETS.AVERAGE_LATENCY && p95 <= PERFORMANCE_TARGETS.RESPONSE_TIME_P95
        };
    }

    /**
     * 記憶體效率基準測試
     */
    async _runMemoryEfficiencyBenchmark(components) {
        const initialMemory = process.memoryUsage();
        const memorySnapshots = [initialMemory];

        // 執行記憶體密集操作
        const operations = 100;
        for (let i = 0; i < operations; i++) {
            // 並行執行多個命令
            const promises = [];
            for (let j = 0; j < 10; j++) {
                promises.push(components.commandRouter.route(`/test:memory-${i}-${j}`));
            }
            await Promise.all(promises);

            // 記錄記憶體使用
            if (i % 10 === 0) {
                memorySnapshots.push(process.memoryUsage());
            }
        }

        // 強制垃圾回收
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage();
        memorySnapshots.push(finalMemory);

        // 計算記憶體指標
        const peakHeapUsed = Math.max(...memorySnapshots.map(s => s.heapUsed));
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryEfficiency = (memoryGrowth / operations) / 1024 / 1024; // MB per operation

        const baseline = this.baselines.get('memoryEfficiency');
        const improvement = ((baseline.efficiency - memoryEfficiency) / baseline.efficiency) * 100;

        return {
            type: BENCHMARK_TYPES.MEMORY,
            metrics: {
                initialHeapMB: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100,
                finalHeapMB: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100,
                peakHeapMB: Math.round(peakHeapUsed / 1024 / 1024 * 100) / 100,
                memoryGrowthMB: Math.round(memoryGrowth / 1024 / 1024 * 100) / 100,
                efficiencyMBPerOp: Math.round(memoryEfficiency * 1000) / 1000
            },
            baseline: baseline,
            improvement: Math.round(improvement * 100) / 100,
            performanceLevel: this._getPerformanceLevel(improvement),
            targetAchieved: improvement >= PERFORMANCE_TARGETS.MEMORY_EFFICIENCY
        };
    }

    /**
     * 並發性能基準測試
     */
    async _runConcurrencyBenchmark(components) {
        const concurrencyLevels = [1, 5, 10, 15, 20, 25, 30];
        const results = [];

        for (const concurrency of concurrencyLevels) {
            const startTime = performance.now();
            const promises = [];

            // 創建並發請求
            for (let i = 0; i < concurrency; i++) {
                promises.push(
                    components.commandRouter.route(`/test:concurrent-${i}`)
                        .catch(error => ({ error: error.message, index: i }))
                );
            }

            const responses = await Promise.allSettled(promises);
            const endTime = performance.now();

            const successful = responses.filter(r => r.status === 'fulfilled' && !r.value.error).length;
            const failed = responses.length - successful;
            const duration = endTime - startTime;
            const throughput = (successful / duration) * 1000;

            results.push({
                concurrency,
                successful,
                failed,
                duration,
                throughput,
                successRate: successful / responses.length
            });
        }

        // 找到最佳並發級別
        const optimalResult = results.reduce((best, current) =>
            current.throughput > best.throughput ? current : best
        );

        const baseline = this.baselines.get('concurrency');
        const improvement = ((optimalResult.throughput - baseline.throughput) / baseline.throughput) * 100;

        return {
            type: BENCHMARK_TYPES.CONCURRENCY,
            metrics: {
                optimalConcurrency: optimalResult.concurrency,
                maxThroughput: Math.round(optimalResult.throughput),
                bestSuccessRate: Math.round(optimalResult.successRate * 10000) / 100,
                allResults: results
            },
            baseline: baseline,
            improvement: Math.round(improvement * 100) / 100,
            performanceLevel: this._getPerformanceLevel(improvement),
            targetAchieved: optimalResult.concurrency >= PERFORMANCE_TARGETS.CONCURRENT_CONNECTIONS
        };
    }

    /**
     * 壓力測試基準
     */
    async _runStressTestBenchmark(components) {
        const stressDuration = 60000; // 1分鐘壓力測試
        const startTime = performance.now();
        const results = [];
        const memorySnapshots = [];

        let iteration = 0;

        // 啟動記憶體監控
        const memoryMonitor = setInterval(() => {
            memorySnapshots.push({
                timestamp: performance.now(),
                memory: process.memoryUsage()
            });
        }, 5000);

        try {
            while (performance.now() - startTime < stressDuration) {
                const batchStart = performance.now();

                // 批量並發請求
                const batchPromises = [];
                for (let i = 0; i < 20; i++) {
                    batchPromises.push(
                        components.commandRouter.route(`/stress:test-${iteration}-${i}`)
                            .catch(error => ({ error: error.message }))
                    );
                }

                const batchResults = await Promise.allSettled(batchPromises);
                const batchEnd = performance.now();

                const batchSuccess = batchResults.filter(r =>
                    r.status === 'fulfilled' && !r.value.error
                ).length;

                results.push({
                    iteration,
                    duration: batchEnd - batchStart,
                    successful: batchSuccess,
                    total: batchPromises.length,
                    timestamp: batchStart
                });

                iteration++;
            }
        } finally {
            clearInterval(memoryMonitor);
        }

        const totalDuration = performance.now() - startTime;
        const totalRequests = results.reduce((sum, r) => sum + r.total, 0);
        const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
        const overallThroughput = (totalSuccessful / totalDuration) * 1000;
        const errorRate = (totalRequests - totalSuccessful) / totalRequests;

        // 記憶體穩定性分析
        const memoryGrowth = memorySnapshots.length > 1 ?
            memorySnapshots[memorySnapshots.length - 1].memory.heapUsed - memorySnapshots[0].memory.heapUsed : 0;

        return {
            type: BENCHMARK_TYPES.STRESS,
            metrics: {
                duration: Math.round(totalDuration),
                totalRequests,
                totalSuccessful,
                overallThroughput: Math.round(overallThroughput),
                errorRate: Math.round(errorRate * 10000) / 100,
                memoryGrowthMB: Math.round(memoryGrowth / 1024 / 1024 * 100) / 100,
                iterations: iteration
            },
            stability: {
                memoryStable: memoryGrowth < 100 * 1024 * 1024, // <100MB growth
                errorRateAcceptable: errorRate < PERFORMANCE_TARGETS.ERROR_RATE,
                throughputConsistent: this._analyzeThroughputConsistency(results)
            },
            performanceLevel: this._getStressTestPerformanceLevel(overallThroughput, errorRate, memoryGrowth),
            targetAchieved: errorRate < PERFORMANCE_TARGETS.ERROR_RATE && overallThroughput > PERFORMANCE_TARGETS.COMMAND_THROUGHPUT * 0.8
        };
    }

    /**
     * 生成綜合性能報告
     */
    async _generatePerformanceReport(results, totalDuration) {
        const report = {
            timestamp: new Date().toISOString(),
            duration: Math.round(totalDuration),
            epic: 'CCPM+SuperClaude整合',
            version: '1.0.0',

            // 整體性能摘要
            overallPerformance: await this._calculateOverallPerformance(results),

            // 目標達成情況
            targetAchievement: await this._assessTargetAchievement(results),

            // 詳細基準測試結果
            benchmarkResults: Array.from(results.entries()).map(([name, result]) => ({
                name,
                ...result
            })),

            // 性能改進分析
            improvementAnalysis: await this._analyzePerformanceImprovements(results),

            // 資源使用分析
            resourceAnalysis: await this._analyzeResourceUsage(results),

            // 瓶頸識別
            bottlenecks: await this._identifyBottlenecks(results),

            // 優化建議
            optimizationRecommendations: await this._generateOptimizationRecommendations(results),

            // 品質評級
            qualityRating: await this._calculateQualityRating(results)
        };

        return report;
    }

    /**
     * 計算整體性能
     */
    async _calculateOverallPerformance(results) {
        const improvements = [];
        let targetsAchieved = 0;
        let totalTargets = 0;

        for (const [name, result] of results) {
            if (result.improvement !== undefined) {
                improvements.push(result.improvement);
            }
            if (result.targetAchieved !== undefined) {
                totalTargets++;
                if (result.targetAchieved) {
                    targetsAchieved++;
                }
            }
        }

        const averageImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
        const targetAchievementRate = totalTargets > 0 ? (targetsAchieved / totalTargets) * 100 : 0;

        return {
            averageImprovement: Math.round(averageImprovement * 100) / 100,
            targetAchievementRate: Math.round(targetAchievementRate * 100) / 100,
            performanceLevel: this._getPerformanceLevel(averageImprovement),
            overallTargetAchieved: averageImprovement >= PERFORMANCE_TARGETS.OVERALL_IMPROVEMENT,
            summary: `系統整體性能提升 ${Math.round(averageImprovement * 100) / 100}%，達成 ${Math.round(targetAchievementRate)}% 的性能目標`
        };
    }

    /**
     * 初始化基準數據
     */
    _initializeBaselines() {
        this.baselines.set('commandThroughput', {
            throughput: 1000,
            latency: 10,
            errorRate: 0.01
        });

        this.baselines.set('latency', {
            average: 10,
            p95: 30,
            p99: 50
        });

        this.baselines.set('memoryEfficiency', {
            efficiency: 1.0, // MB per operation
            growth: 50      // MB total growth
        });

        this.baselines.set('concurrency', {
            throughput: 800,
            optimalLevel: 15
        });
    }

    /**
     * 設置性能監控
     */
    _setupPerformanceMonitoring() {
        if (this.options.enableProfiling) {
            this.performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                for (const entry of entries) {
                    this.emit('performanceEntry', entry);
                }
            });

            this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
        }
    }

    /**
     * 獲取性能等級
     */
    _getPerformanceLevel(improvement) {
        if (improvement >= 30) return PERFORMANCE_LEVELS.EXCELLENT;
        if (improvement >= 20) return PERFORMANCE_LEVELS.GOOD;
        if (improvement >= 10) return PERFORMANCE_LEVELS.ACCEPTABLE;
        if (improvement >= 0) return PERFORMANCE_LEVELS.WARNING;
        if (improvement >= -10) return PERFORMANCE_LEVELS.POOR;
        return PERFORMANCE_LEVELS.CRITICAL;
    }

    /**
     * 系統預熱
     */
    async _warmupSystem(components) {
        this.emit('warmupStarted');

        for (let i = 0; i < this.options.warmupIterations; i++) {
            await components.commandRouter.route('/test:warmup');
        }

        // 垃圾回收
        if (global.gc) {
            global.gc();
        }

        this.emit('warmupCompleted');
    }

    /**
     * 執行基準測試
     */
    async _runBenchmark(benchmarkName, components) {
        const methodName = `_run${benchmarkName.charAt(0).toUpperCase() + benchmarkName.slice(1)}`;

        if (typeof this[methodName] === 'function') {
            return await this[methodName](components);
        }

        throw new Error(`未找到基準測試方法: ${methodName}`);
    }
}

// 導出便利函數
export const runPerformanceBenchmarks = async (components, options = {}) => {
    const runner = new PerformanceBenchmarkRunner(options);
    return await runner.runFullBenchmarkSuite(components);
};

export default PerformanceBenchmarkRunner;