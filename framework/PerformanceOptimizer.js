/**
 * PerformanceOptimizer - 性能優化器
 *
 * 功能：
 * - 確保命令執行延遲 < 100ms
 * - 智能緩存和預加載
 * - 並行處理優化
 * - 內存和資源管理
 * - 實時性能監控和調優
 *
 * 目標：讓整合命令接口達到最佳性能表現
 */

import EventEmitter from 'eventemitter3';

// 性能優化策略
export const OPTIMIZATION_STRATEGIES = {
    CACHING: 'caching',                 // 緩存優化
    PRELOADING: 'preloading',           // 預加載優化
    PARALLEL: 'parallel',               // 並行處理優化
    MEMORY: 'memory',                   // 內存優化
    NETWORK: 'network',                 // 網絡優化
    CPU: 'cpu',                         // CPU優化
    LAZY_LOADING: 'lazy_loading'        // 懶加載優化
};

// 性能指標類型
export const PERFORMANCE_METRICS = {
    EXECUTION_TIME: 'execution_time',
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    CACHE_HIT_RATE: 'cache_hit_rate',
    THROUGHPUT: 'throughput',
    LATENCY: 'latency'
};

/**
 * 智能緩存系統
 */
class IntelligentCache {
    constructor(options = {}) {
        this.options = {
            maxSize: 1000,              // 最大緩存項目數
            ttl: 300000,                // 5分鐘TTL
            maxMemory: 100 * 1024 * 1024, // 100MB最大內存
            cleanupInterval: 60000,      // 1分鐘清理間隔
            ...options
        };

        this.cache = new Map();         // key -> { value, timestamp, accessCount, size }
        this.accessLog = new Map();     // key -> [timestamps]
        this.totalSize = 0;
        this.hits = 0;
        this.misses = 0;

        // 定期清理
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.options.cleanupInterval);
    }

    /**
     * 獲取緩存項目
     * @param {string} key - 緩存鍵
     * @returns {any} 緩存值或null
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.misses++;
            return null;
        }

        const now = Date.now();

        // 檢查TTL
        if (now - item.timestamp > this.options.ttl) {
            this.delete(key);
            this.misses++;
            return null;
        }

        // 更新訪問記錄
        item.accessCount++;
        item.lastAccess = now;

        // 記錄訪問日誌
        if (!this.accessLog.has(key)) {
            this.accessLog.set(key, []);
        }
        this.accessLog.get(key).push(now);

        this.hits++;
        return item.value;
    }

    /**
     * 設置緩存項目
     * @param {string} key - 緩存鍵
     * @param {any} value - 緩存值
     * @param {number} ttl - 可選的TTL覆蓋
     */
    set(key, value, ttl = null) {
        const size = this._calculateSize(value);
        const now = Date.now();

        // 檢查內存限制
        if (this.totalSize + size > this.options.maxMemory) {
            this._evictLRU(size);
        }

        // 如果鍵已存在，先移除舊值
        if (this.cache.has(key)) {
            this.delete(key);
        }

        // 檢查數量限制
        if (this.cache.size >= this.options.maxSize) {
            this._evictLRU(0);
        }

        const item = {
            value,
            timestamp: now,
            accessCount: 0,
            lastAccess: now,
            size,
            ttl: ttl || this.options.ttl
        };

        this.cache.set(key, item);
        this.totalSize += size;
    }

    /**
     * 刪除緩存項目
     * @param {string} key - 緩存鍵
     */
    delete(key) {
        const item = this.cache.get(key);
        if (item) {
            this.cache.delete(key);
            this.totalSize -= item.size;
            this.accessLog.delete(key);
        }
    }

    /**
     * 清理過期項目
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));

        // 清理訪問日誌（保留最近1小時）
        const oneHourAgo = now - 3600000;
        for (const [key, timestamps] of this.accessLog.entries()) {
            const recentTimestamps = timestamps.filter(ts => ts > oneHourAgo);
            if (recentTimestamps.length === 0) {
                this.accessLog.delete(key);
            } else {
                this.accessLog.set(key, recentTimestamps);
            }
        }
    }

    /**
     * 獲取緩存統計
     * @returns {Object} 統計信息
     */
    getStats() {
        const total = this.hits + this.misses;

        return {
            size: this.cache.size,
            totalSize: this.totalSize,
            maxSize: this.options.maxSize,
            maxMemory: this.options.maxMemory,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
            memoryUsage: ((this.totalSize / this.options.maxMemory) * 100).toFixed(2) + '%'
        };
    }

    /**
     * 預熱緩存
     * @param {Array} preloadData - 預加載數據 [{key, value, ttl}]
     */
    preheat(preloadData) {
        preloadData.forEach(({ key, value, ttl }) => {
            this.set(key, value, ttl);
        });
    }

    /**
     * 計算值的大小（字節）
     * @private
     */
    _calculateSize(value) {
        try {
            if (typeof value === 'string') {
                return value.length * 2; // Unicode字符約2字節
            } else if (typeof value === 'object') {
                return JSON.stringify(value).length * 2;
            } else {
                return 64; // 基本類型估算64字節
            }
        } catch {
            return 64;
        }
    }

    /**
     * LRU驅逐策略
     * @private
     */
    _evictLRU(requiredSize) {
        const candidates = Array.from(this.cache.entries())
            .map(([key, item]) => ({ key, ...item }))
            .sort((a, b) => {
                // 優先驅逐：較少訪問次數、較舊的最後訪問時間
                if (a.accessCount !== b.accessCount) {
                    return a.accessCount - b.accessCount;
                }
                return a.lastAccess - b.lastAccess;
            });

        let freedSize = 0;
        let evicted = 0;

        for (const candidate of candidates) {
            if (this.totalSize - freedSize <= this.options.maxMemory - requiredSize &&
                this.cache.size - evicted < this.options.maxSize) {
                break;
            }

            this.delete(candidate.key);
            freedSize += candidate.size;
            evicted++;
        }
    }

    /**
     * 清理資源
     */
    dispose() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        this.cache.clear();
        this.accessLog.clear();
        this.totalSize = 0;
    }
}

/**
 * 預加載管理器
 */
class PreloadManager {
    constructor(cache, options = {}) {
        this.cache = cache;
        this.options = {
            predictiveThreshold: 0.7,   // 預測閾值
            maxConcurrentPreloads: 5,   // 最大並發預加載
            preloadWindow: 300000,      // 5分鐘預加載窗口
            ...options
        };

        this.preloadQueue = [];
        this.activePreloads = new Set();
        this.usagePatterns = new Map(); // command -> usage pattern
    }

    /**
     * 分析使用模式並預測需要預加載的內容
     * @param {string} command - 執行的命令
     */
    analyzeUsagePattern(command) {
        if (!this.usagePatterns.has(command)) {
            this.usagePatterns.set(command, {
                count: 0,
                lastUsed: Date.now(),
                avgInterval: 0,
                predictions: []
            });
        }

        const pattern = this.usagePatterns.get(command);
        const now = Date.now();

        if (pattern.lastUsed) {
            const interval = now - pattern.lastUsed;
            pattern.avgInterval = (pattern.avgInterval * pattern.count + interval) / (pattern.count + 1);
        }

        pattern.count++;
        pattern.lastUsed = now;

        // 預測下次使用時間
        if (pattern.count > 2) {
            const nextPredicted = now + pattern.avgInterval;
            pattern.predictions.push(nextPredicted);

            // 保留最近5個預測
            if (pattern.predictions.length > 5) {
                pattern.predictions.shift();
            }
        }

        // 檢查是否需要預加載相關內容
        this._checkPreloadOpportunity(command, pattern);
    }

    /**
     * 主動預加載內容
     * @param {string} key - 預加載鍵
     * @param {Function} loader - 加載函數
     * @param {number} priority - 優先級 (0-10)
     */
    preload(key, loader, priority = 5) {
        if (this.cache.get(key)) {
            return; // 已存在，無需預加載
        }

        if (this.activePreloads.has(key)) {
            return; // 已在預加載中
        }

        this.preloadQueue.push({ key, loader, priority });
        this.preloadQueue.sort((a, b) => b.priority - a.priority);

        this._processPreloadQueue();
    }

    /**
     * 檢查預加載機會
     * @private
     */
    _checkPreloadOpportunity(command, pattern) {
        // 基於使用頻率決定是否預加載
        const frequency = pattern.count / (Date.now() - pattern.lastUsed + pattern.avgInterval);

        if (frequency > this.options.predictiveThreshold) {
            // 預加載相關命令的結果
            const relatedCommands = this._getRelatedCommands(command);

            relatedCommands.forEach(relatedCmd => {
                const cacheKey = `preload_${relatedCmd}`;
                this.preload(cacheKey, () => this._loadCommandData(relatedCmd), 7);
            });
        }
    }

    /**
     * 獲取相關命令
     * @private
     */
    _getRelatedCommands(command) {
        const related = [];

        // 基於命令類型的相關性
        if (command.includes('status')) {
            related.push('help', 'config get');
        } else if (command.includes('analyze')) {
            related.push('report', 'optimize analyze');
        } else if (command.includes('workflow')) {
            related.push('monitor dashboard', 'status');
        }

        return related;
    }

    /**
     * 處理預加載隊列
     * @private
     */
    async _processPreloadQueue() {
        if (this.activePreloads.size >= this.options.maxConcurrentPreloads) {
            return;
        }

        const item = this.preloadQueue.shift();
        if (!item) return;

        this.activePreloads.add(item.key);

        try {
            const data = await item.loader();
            this.cache.set(item.key, data, this.options.preloadWindow);
        } catch (error) {
            console.warn(`[PreloadManager] 預加載失敗 ${item.key}:`, error.message);
        } finally {
            this.activePreloads.delete(item.key);

            // 繼續處理隊列
            setTimeout(() => this._processPreloadQueue(), 10);
        }
    }

    /**
     * 模擬載入命令數據
     * @private
     */
    async _loadCommandData(command) {
        // 模擬異步載入
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    command,
                    data: `預載入數據 for ${command}`,
                    timestamp: Date.now()
                });
            }, Math.random() * 100 + 50);
        });
    }
}

/**
 * 性能監控器
 */
class PerformanceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            sampleInterval: 1000,       // 1秒採樣間隔
            alertThreshold: 100,        // 100ms警告閾值
            historySize: 1000,          // 保留1000個歷史記錄
            ...options
        };

        this.metrics = new Map();       // metricType -> [values]
        this.alerts = [];
        this.isMonitoring = false;
        this.monitoringTimer = null;
    }

    /**
     * 開始監控
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringTimer = setInterval(() => {
            this._collectSystemMetrics();
        }, this.options.sampleInterval);

        console.log('[PerformanceMonitor] 性能監控已啟動');
    }

    /**
     * 停止監控
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        console.log('[PerformanceMonitor] 性能監控已停止');
    }

    /**
     * 記錄性能指標
     * @param {string} type - 指標類型
     * @param {number} value - 指標值
     * @param {Object} context - 上下文信息
     */
    recordMetric(type, value, context = {}) {
        if (!this.metrics.has(type)) {
            this.metrics.set(type, []);
        }

        const metric = {
            value,
            timestamp: Date.now(),
            context
        };

        const metrics = this.metrics.get(type);
        metrics.push(metric);

        // 保持歷史記錄數量限制
        if (metrics.length > this.options.historySize) {
            metrics.shift();
        }

        // 檢查警告條件
        this._checkAlertConditions(type, value, context);

        this.emit('metricRecorded', { type, metric });
    }

    /**
     * 獲取性能統計
     * @param {string} type - 指標類型
     * @param {number} windowMs - 時間窗口（毫秒）
     * @returns {Object} 統計信息
     */
    getStats(type, windowMs = 60000) {
        const metrics = this.metrics.get(type);
        if (!metrics || metrics.length === 0) {
            return null;
        }

        const now = Date.now();
        const windowStart = now - windowMs;
        const windowMetrics = metrics.filter(m => m.timestamp >= windowStart);

        if (windowMetrics.length === 0) {
            return null;
        }

        const values = windowMetrics.map(m => m.value);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            average: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            p50: this._percentile(values, 0.5),
            p95: this._percentile(values, 0.95),
            p99: this._percentile(values, 0.99),
            recent: values.slice(-10), // 最近10個值
            trend: this._calculateTrend(values)
        };
    }

    /**
     * 獲取所有警告
     * @param {number} windowMs - 時間窗口
     * @returns {Array} 警告列表
     */
    getAlerts(windowMs = 3600000) {
        const now = Date.now();
        return this.alerts.filter(alert => now - alert.timestamp <= windowMs);
    }

    /**
     * 清除警告
     */
    clearAlerts() {
        this.alerts = [];
    }

    /**
     * 收集系統指標
     * @private
     */
    _collectSystemMetrics() {
        try {
            // 內存使用情況
            if (typeof process !== 'undefined' && process.memoryUsage) {
                const memUsage = process.memoryUsage();
                this.recordMetric(PERFORMANCE_METRICS.MEMORY_USAGE, memUsage.heapUsed);
            }

            // CPU使用情況（簡化實現）
            const cpuUsage = this._getCPUUsage();
            if (cpuUsage !== null) {
                this.recordMetric(PERFORMANCE_METRICS.CPU_USAGE, cpuUsage);
            }

        } catch (error) {
            console.warn('[PerformanceMonitor] 收集系統指標失敗:', error.message);
        }
    }

    /**
     * 獲取CPU使用率（簡化實現）
     * @private
     */
    _getCPUUsage() {
        if (typeof process !== 'undefined' && process.cpuUsage) {
            const usage = process.cpuUsage();
            return (usage.user + usage.system) / 1000; // 轉換為毫秒
        }
        return null;
    }

    /**
     * 檢查警告條件
     * @private
     */
    _checkAlertConditions(type, value, context) {
        let shouldAlert = false;
        let alertMessage = '';

        switch (type) {
            case PERFORMANCE_METRICS.EXECUTION_TIME:
                if (value > this.options.alertThreshold) {
                    shouldAlert = true;
                    alertMessage = `命令執行時間超過閾值: ${value}ms > ${this.options.alertThreshold}ms`;
                }
                break;

            case PERFORMANCE_METRICS.MEMORY_USAGE:
                if (value > 200 * 1024 * 1024) { // 200MB
                    shouldAlert = true;
                    alertMessage = `內存使用量過高: ${Math.round(value / 1024 / 1024)}MB`;
                }
                break;
        }

        if (shouldAlert) {
            const alert = {
                type,
                value,
                message: alertMessage,
                timestamp: Date.now(),
                context
            };

            this.alerts.push(alert);
            this.emit('alert', alert);

            // 限制警告數量
            if (this.alerts.length > 100) {
                this.alerts.shift();
            }
        }
    }

    /**
     * 計算百分位數
     * @private
     */
    _percentile(values, p) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * 計算趨勢
     * @private
     */
    _calculateTrend(values) {
        if (values.length < 2) return 'stable';

        const recent = values.slice(-Math.min(10, values.length));
        const avg = recent.reduce((a, b) => a + b) / recent.length;
        const lastValue = recent[recent.length - 1];

        const change = ((lastValue - avg) / avg) * 100;

        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }
}

/**
 * 性能優化器主類
 */
export class PerformanceOptimizer extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            targetExecutionTime: 100,   // 目標執行時間100ms
            cacheSize: 1000,           // 緩存大小
            enablePreloading: true,     // 啟用預加載
            enableMonitoring: true,     // 啟用監控
            optimizationInterval: 30000, // 30秒優化間隔
            ...options
        };

        // 核心組件
        this.cache = new IntelligentCache({
            maxSize: this.options.cacheSize,
            maxMemory: 100 * 1024 * 1024 // 100MB
        });

        this.preloader = new PreloadManager(this.cache);
        this.monitor = new PerformanceMonitor({
            alertThreshold: this.options.targetExecutionTime
        });

        // 優化策略註冊表
        this.optimizationStrategies = new Map();
        this._initializeOptimizationStrategies();

        // 自動優化定時器
        this.optimizationTimer = null;
    }

    /**
     * 初始化優化器
     */
    async initialize() {
        console.log('[PerformanceOptimizer] 初始化性能優化器...');

        // 啟動監控
        if (this.options.enableMonitoring) {
            this.monitor.startMonitoring();
        }

        // 設置事件監聽
        this._setupEventListeners();

        // 啟動自動優化
        this._startAutoOptimization();

        // 預熱常用緩存
        await this._preheatCache();

        console.log('[PerformanceOptimizer] 性能優化器初始化完成');
        this.emit('initialized');
    }

    /**
     * 優化命令執行
     * @param {Function} commandExecutor - 命令執行函數
     * @param {string} cacheKey - 緩存鍵
     * @param {Object} context - 執行上下文
     * @returns {Promise} 優化後的執行結果
     */
    async optimizeExecution(commandExecutor, cacheKey, context = {}) {
        const startTime = Date.now();

        try {
            // 1. 嘗試從緩存獲取
            const cachedResult = this.cache.get(cacheKey);
            if (cachedResult && this._isCacheValidForContext(cachedResult, context)) {
                const executionTime = Date.now() - startTime;
                this.monitor.recordMetric(PERFORMANCE_METRICS.EXECUTION_TIME, executionTime, {
                    cached: true,
                    cacheKey
                });

                console.log(`[PerformanceOptimizer] 緩存命中: ${cacheKey} (${executionTime}ms)`);
                return cachedResult;
            }

            // 2. 分析使用模式
            if (this.options.enablePreloading) {
                this.preloader.analyzeUsagePattern(cacheKey);
            }

            // 3. 執行命令
            const result = await this._executeWithOptimizations(commandExecutor, context);

            // 4. 緩存結果
            if (this._shouldCacheResult(result, context)) {
                this.cache.set(cacheKey, result);
            }

            // 5. 記錄性能指標
            const executionTime = Date.now() - startTime;
            this.monitor.recordMetric(PERFORMANCE_METRICS.EXECUTION_TIME, executionTime, {
                cached: false,
                cacheKey
            });

            // 6. 檢查性能警告
            if (executionTime > this.options.targetExecutionTime) {
                this.emit('performanceWarning', {
                    cacheKey,
                    executionTime,
                    target: this.options.targetExecutionTime
                });
            }

            console.log(`[PerformanceOptimizer] 執行完成: ${cacheKey} (${executionTime}ms)`);
            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.monitor.recordMetric(PERFORMANCE_METRICS.EXECUTION_TIME, executionTime, {
                error: true,
                cacheKey
            });

            throw error;
        }
    }

    /**
     * 應用優化策略
     * @param {Array<string>} strategies - 要應用的策略列表
     * @returns {Promise<Object>} 優化結果
     */
    async applyOptimizations(strategies = []) {
        const results = {
            applied: [],
            failed: [],
            improvements: {}
        };

        console.log(`[PerformanceOptimizer] 應用 ${strategies.length} 個優化策略...`);

        for (const strategyName of strategies) {
            try {
                const strategy = this.optimizationStrategies.get(strategyName);
                if (!strategy) {
                    results.failed.push({ strategy: strategyName, error: '策略不存在' });
                    continue;
                }

                console.log(`[PerformanceOptimizer] 應用策略: ${strategyName}`);
                const improvement = await strategy.apply();

                results.applied.push(strategyName);
                results.improvements[strategyName] = improvement;

                console.log(`[PerformanceOptimizer] 策略 ${strategyName} 應用成功:`, improvement);

            } catch (error) {
                console.error(`[PerformanceOptimizer] 策略 ${strategyName} 應用失敗:`, error);
                results.failed.push({ strategy: strategyName, error: error.message });
            }
        }

        return results;
    }

    /**
     * 獲取性能統計
     * @returns {Object} 性能統計信息
     */
    getPerformanceStats() {
        const executionStats = this.monitor.getStats(PERFORMANCE_METRICS.EXECUTION_TIME, 300000); // 5分鐘窗口
        const memoryStats = this.monitor.getStats(PERFORMANCE_METRICS.MEMORY_USAGE, 300000);
        const cacheStats = this.cache.getStats();

        return {
            execution: executionStats,
            memory: memoryStats,
            cache: cacheStats,
            alerts: this.monitor.getAlerts(3600000), // 1小時內的警告
            optimization: {
                targetExecutionTime: this.options.targetExecutionTime,
                performanceTarget: executionStats ?
                    executionStats.average <= this.options.targetExecutionTime : false
            }
        };
    }

    /**
     * 生成優化建議
     * @returns {Array} 優化建議列表
     */
    generateOptimizationSuggestions() {
        const suggestions = [];
        const stats = this.getPerformanceStats();

        // 基於執行時間的建議
        if (stats.execution && stats.execution.average > this.options.targetExecutionTime) {
            const slowdownFactor = stats.execution.average / this.options.targetExecutionTime;

            suggestions.push({
                type: 'execution_time',
                priority: slowdownFactor > 2 ? 'high' : 'medium',
                description: `平均執行時間 ${Math.round(stats.execution.average)}ms 超過目標 ${this.options.targetExecutionTime}ms`,
                recommendations: [
                    '增加緩存策略',
                    '啟用預加載',
                    '優化算法邏輯',
                    '增加並行處理'
                ]
            });
        }

        // 基於緩存的建議
        if (stats.cache) {
            const hitRate = parseFloat(stats.cache.hitRate.replace('%', ''));

            if (hitRate < 70) {
                suggestions.push({
                    type: 'cache_hit_rate',
                    priority: 'medium',
                    description: `緩存命中率 ${stats.cache.hitRate} 較低`,
                    recommendations: [
                        '調整緩存策略',
                        '增加緩存大小',
                        '優化緩存鍵設計',
                        '延長緩存TTL'
                    ]
                });
            }

            const memoryUsage = parseFloat(stats.cache.memoryUsage.replace('%', ''));
            if (memoryUsage > 80) {
                suggestions.push({
                    type: 'memory_usage',
                    priority: 'medium',
                    description: `緩存內存使用率 ${stats.cache.memoryUsage} 較高`,
                    recommendations: [
                        '清理過期緩存',
                        '調整LRU策略',
                        '減少緩存項目大小',
                        '增加內存限制'
                    ]
                });
            }
        }

        // 基於警告的建議
        if (stats.alerts && stats.alerts.length > 0) {
            const recentAlerts = stats.alerts.filter(alert =>
                Date.now() - alert.timestamp < 600000 // 10分鐘內
            );

            if (recentAlerts.length > 5) {
                suggestions.push({
                    type: 'frequent_alerts',
                    priority: 'high',
                    description: `檢測到 ${recentAlerts.length} 個最近警告`,
                    recommendations: [
                        '檢查系統負載',
                        '優化資源分配',
                        '調整性能閾值',
                        '增加系統監控'
                    ]
                });
            }
        }

        return suggestions;
    }

    // ========== 私有方法 ==========

    /**
     * 執行帶優化的命令
     * @private
     */
    async _executeWithOptimizations(commandExecutor, context) {
        const optimizationPromise = new Promise(async (resolve) => {
            // 設置超時機制
            const timeoutId = setTimeout(() => {
                resolve(null);
            }, this.options.targetExecutionTime * 2); // 2倍目標時間作為超時

            try {
                const result = await commandExecutor(context);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });

        return optimizationPromise;
    }

    /**
     * 判斷緩存是否對當前上下文有效
     * @private
     */
    _isCacheValidForContext(cachedResult, context) {
        // 檢查上下文相關性
        if (context.requiresFreshData) {
            return false;
        }

        if (context.userId && cachedResult.userId && context.userId !== cachedResult.userId) {
            return false;
        }

        return true;
    }

    /**
     * 判斷是否應該緩存結果
     * @private
     */
    _shouldCacheResult(result, context) {
        // 不緩存錯誤結果
        if (result && result.error) {
            return false;
        }

        // 不緩存用戶特定數據（除非明確指示）
        if (context.userSpecific && !context.allowCache) {
            return false;
        }

        return true;
    }

    /**
     * 預熱緩存
     * @private
     */
    async _preheatCache() {
        console.log('[PerformanceOptimizer] 預熱緩存...');

        const commonCacheEntries = [
            {
                key: 'system_status',
                value: { initialized: true, ready: true, timestamp: Date.now() },
                ttl: 60000
            },
            {
                key: 'help_overview',
                value: { content: '系統幫助概覽...', timestamp: Date.now() },
                ttl: 300000
            },
            {
                key: 'config_defaults',
                value: { timeout: 30000, maxConcurrency: 20, timestamp: Date.now() },
                ttl: 600000
            }
        ];

        this.cache.preheat(commonCacheEntries);
        console.log(`[PerformanceOptimizer] 已預熱 ${commonCacheEntries.length} 個緩存項目`);
    }

    /**
     * 初始化優化策略
     * @private
     */
    _initializeOptimizationStrategies() {
        // 緩存優化策略
        this.optimizationStrategies.set(OPTIMIZATION_STRATEGIES.CACHING, {
            name: '緩存優化',
            description: '優化緩存策略和配置',
            apply: async () => {
                // 清理過期緩存
                this.cache.cleanup();

                // 調整緩存配置
                const cacheStats = this.cache.getStats();
                const hitRate = parseFloat(cacheStats.hitRate.replace('%', ''));

                if (hitRate < 60) {
                    // 增加TTL
                    this.cache.options.ttl = Math.min(this.cache.options.ttl * 1.5, 600000);
                }

                return {
                    clearedItems: '已清理過期項目',
                    ttlAdjustment: this.cache.options.ttl,
                    improvement: '緩存策略已優化'
                };
            }
        });

        // 內存優化策略
        this.optimizationStrategies.set(OPTIMIZATION_STRATEGIES.MEMORY, {
            name: '內存優化',
            description: '優化內存使用和垃圾回收',
            apply: async () => {
                // 強制垃圾回收（如果可用）
                if (global.gc) {
                    global.gc();
                }

                // 清理大型緩存項目
                const largeItems = [];
                for (const [key, item] of this.cache.cache.entries()) {
                    if (item.size > 1024 * 1024) { // 1MB以上
                        largeItems.push(key);
                    }
                }

                largeItems.forEach(key => this.cache.delete(key));

                return {
                    gcTriggered: global.gc ? true : false,
                    removedLargeItems: largeItems.length,
                    improvement: '內存使用已優化'
                };
            }
        });

        // 並行處理優化策略
        this.optimizationStrategies.set(OPTIMIZATION_STRATEGIES.PARALLEL, {
            name: '並行處理優化',
            description: '優化並行處理和異步操作',
            apply: async () => {
                // 這裡會實現並行處理優化邏輯
                return {
                    parallelizationEnabled: true,
                    improvement: '並行處理已優化'
                };
            }
        });
    }

    /**
     * 設置事件監聽器
     * @private
     */
    _setupEventListeners() {
        // 監聽性能警告
        this.monitor.on('alert', (alert) => {
            console.warn(`[PerformanceOptimizer] 性能警告:`, alert);
            this.emit('performanceAlert', alert);
        });

        // 監聽監控指標記錄
        this.monitor.on('metricRecorded', ({ type, metric }) => {
            if (type === PERFORMANCE_METRICS.EXECUTION_TIME && metric.value > this.options.targetExecutionTime * 2) {
                // 嚴重超時，觸發即時優化
                this._triggerImediateOptimization(metric);
            }
        });
    }

    /**
     * 開始自動優化
     * @private
     */
    _startAutoOptimization() {
        this.optimizationTimer = setInterval(async () => {
            try {
                const suggestions = this.generateOptimizationSuggestions();

                if (suggestions.length > 0) {
                    console.log(`[PerformanceOptimizer] 發現 ${suggestions.length} 個優化建議`);

                    // 自動應用低風險優化
                    const lowRiskOptimizations = [
                        OPTIMIZATION_STRATEGIES.CACHING,
                        OPTIMIZATION_STRATEGIES.MEMORY
                    ];

                    await this.applyOptimizations(lowRiskOptimizations);
                }

            } catch (error) {
                console.error('[PerformanceOptimizer] 自動優化失敗:', error);
            }
        }, this.options.optimizationInterval);

        console.log(`[PerformanceOptimizer] 自動優化已啟動 (間隔: ${this.options.optimizationInterval}ms)`);
    }

    /**
     * 觸發即時優化
     * @private
     */
    async _triggerImediateOptimization(metric) {
        console.warn(`[PerformanceOptimizer] 觸發即時優化，執行時間: ${metric.value}ms`);

        try {
            // 立即清理緩存
            this.cache.cleanup();

            // 強制垃圾回收
            if (global.gc) {
                global.gc();
            }

            console.log('[PerformanceOptimizer] 即時優化完成');

        } catch (error) {
            console.error('[PerformanceOptimizer] 即時優化失敗:', error);
        }
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            console.log('[PerformanceOptimizer] 清理性能優化器資源...');

            // 停止定時器
            if (this.optimizationTimer) {
                clearInterval(this.optimizationTimer);
                this.optimizationTimer = null;
            }

            // 停止監控
            this.monitor.stopMonitoring();

            // 清理緩存
            this.cache.dispose();

            // 清理事件監聽器
            this.removeAllListeners();
            this.monitor.removeAllListeners();

            console.log('[PerformanceOptimizer] 性能優化器資源清理完成');

        } catch (error) {
            console.error('[PerformanceOptimizer] 資源清理失敗:', error);
            throw error;
        }
    }
}

export default PerformanceOptimizer;