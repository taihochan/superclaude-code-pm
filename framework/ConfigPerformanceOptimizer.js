/**
 * ConfigPerformanceOptimizer - 配置系統性能優化器
 *
 * 功能：
 * - 智能緩存策略和LRU內存管理
 * - 配置預載和懶加載機制
 * - 數據壓縮和序列化優化
 * - 並行處理和批量操作優化
 * - 性能監控和瓶頸分析
 *
 * 用途：確保配置系統在高負載下的高性能表現
 * 配合：ConfigManager及所有配置相關組件
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * 緩存策略
 */
const CACHE_STRATEGIES = {
    LRU: 'lru',                    // 最近最少使用
    LFU: 'lfu',                    // 最少使用頻率
    TTL: 'ttl',                    // 時間到期
    ADAPTIVE: 'adaptive'           // 自適應策略
};

/**
 * 壓縮算法
 */
const COMPRESSION_ALGORITHMS = {
    GZIP: 'gzip',
    DEFLATE: 'deflate',
    BROTLI: 'brotli'
};

/**
 * 性能指標類型
 */
const METRIC_TYPES = {
    CACHE_HIT_RATE: 'cache_hit_rate',
    MEMORY_USAGE: 'memory_usage',
    RESPONSE_TIME: 'response_time',
    THROUGHPUT: 'throughput',
    ERROR_RATE: 'error_rate',
    CPU_USAGE: 'cpu_usage'
};

/**
 * LRU緩存節點
 */
class LRUNode {
    constructor(key, value, size = 0) {
        this.key = key;
        this.value = value;
        this.size = size;
        this.accessCount = 1;
        this.lastAccessed = Date.now();
        this.createdAt = Date.now();
        this.prev = null;
        this.next = null;
    }

    updateAccess() {
        this.accessCount++;
        this.lastAccessed = Date.now();
    }

    getAge() {
        return Date.now() - this.createdAt;
    }

    getIdleTime() {
        return Date.now() - this.lastAccessed;
    }
}

/**
 * 高性能LRU緩存
 */
class HighPerformanceCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB
        this.ttl = options.ttl || 0; // 0表示不過期
        this.strategy = options.strategy || CACHE_STRATEGIES.LRU;

        // 雙向鏈表
        this.head = new LRUNode('HEAD', null);
        this.tail = new LRUNode('TAIL', null);
        this.head.next = this.tail;
        this.tail.prev = this.head;

        // 快速查找
        this.cache = new Map(); // key -> LRUNode
        this.sizeMap = new Map(); // key -> size

        // 統計信息
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            memoryUsed: 0,
            totalRequests: 0
        };

        // 清理定時器
        this.cleanupTimer = null;
        this._startCleanupTimer();
    }

    /**
     * 獲取值
     */
    get(key) {
        const node = this.cache.get(key);
        this.stats.totalRequests++;

        if (!node) {
            this.stats.misses++;
            return null;
        }

        // 檢查TTL
        if (this.ttl > 0 && node.getAge() > this.ttl) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        // 更新訪問信息
        node.updateAccess();
        this.stats.hits++;

        // 移動到頭部
        if (this.strategy === CACHE_STRATEGIES.LRU) {
            this._moveToHead(node);
        }

        return node.value;
    }

    /**
     * 設置值
     */
    set(key, value, options = {}) {
        const size = options.size || this._calculateSize(value);
        const existingNode = this.cache.get(key);

        if (existingNode) {
            // 更新現有節點
            const oldSize = existingNode.size;
            existingNode.value = value;
            existingNode.size = size;
            existingNode.updateAccess();

            this.stats.memoryUsed = this.stats.memoryUsed - oldSize + size;
            this.sizeMap.set(key, size);

            if (this.strategy === CACHE_STRATEGIES.LRU) {
                this._moveToHead(existingNode);
            }
        } else {
            // 創建新節點
            const newNode = new LRUNode(key, value, size);
            this.cache.set(key, newNode);
            this.sizeMap.set(key, size);
            this.stats.memoryUsed += size;

            if (this.strategy === CACHE_STRATEGIES.LRU) {
                this._addToHead(newNode);
            }
        }

        // 清理過期和超限項目
        this._cleanup();
    }

    /**
     * 刪除值
     */
    delete(key) {
        const node = this.cache.get(key);
        if (!node) return false;

        this.cache.delete(key);
        this.sizeMap.delete(key);
        this.stats.memoryUsed -= node.size;

        if (this.strategy === CACHE_STRATEGIES.LRU) {
            this._removeNode(node);
        }

        return true;
    }

    /**
     * 清空緩存
     */
    clear() {
        this.cache.clear();
        this.sizeMap.clear();
        this.stats.memoryUsed = 0;
        this.stats.evictions = 0;

        // 重置鏈表
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    /**
     * 檢查是否存在
     */
    has(key) {
        const node = this.cache.get(key);
        if (!node) return false;

        // 檢查TTL
        if (this.ttl > 0 && node.getAge() > this.ttl) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 獲取緩存大小
     */
    size() {
        return this.cache.size;
    }

    /**
     * 獲取內存使用量
     */
    getMemoryUsage() {
        return this.stats.memoryUsed;
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        const hitRate = this.stats.totalRequests > 0
            ? (this.stats.hits / this.stats.totalRequests) * 100
            : 0;

        return {
            ...this.stats,
            hitRate: hitRate.toFixed(2),
            size: this.cache.size,
            memoryUsagePercent: ((this.stats.memoryUsed / this.maxMemory) * 100).toFixed(2)
        };
    }

    /**
     * 預熱緩存
     */
    async warmup(dataLoader, keys = []) {
        const startTime = Date.now();
        let loadedCount = 0;

        for (const key of keys) {
            try {
                const value = await dataLoader(key);
                if (value !== null && value !== undefined) {
                    this.set(key, value);
                    loadedCount++;
                }
            } catch (error) {
                console.warn(`[HighPerformanceCache] 預熱失敗 [${key}]:`, error);
            }
        }

        const warmupTime = Date.now() - startTime;
        console.log(`[HighPerformanceCache] 預熱完成 - 載入: ${loadedCount}/${keys.length}, 耗時: ${warmupTime}ms`);

        return { loadedCount, totalKeys: keys.length, warmupTime };
    }

    // ========== 私有方法 ==========

    _calculateSize(value) {
        if (typeof value === 'string') {
            return Buffer.byteLength(value, 'utf8');
        }
        return Buffer.byteLength(JSON.stringify(value), 'utf8');
    }

    _moveToHead(node) {
        this._removeNode(node);
        this._addToHead(node);
    }

    _addToHead(node) {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
    }

    _removeNode(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    _removeTail() {
        const lastNode = this.tail.prev;
        if (lastNode !== this.head) {
            this._removeNode(lastNode);
            return lastNode;
        }
        return null;
    }

    _cleanup() {
        // 大小限制清理
        while (this.cache.size > this.maxSize) {
            const removedNode = this._removeTail();
            if (removedNode) {
                this.cache.delete(removedNode.key);
                this.sizeMap.delete(removedNode.key);
                this.stats.memoryUsed -= removedNode.size;
                this.stats.evictions++;
            } else {
                break;
            }
        }

        // 內存限制清理
        while (this.stats.memoryUsed > this.maxMemory) {
            const removedNode = this._removeTail();
            if (removedNode) {
                this.cache.delete(removedNode.key);
                this.sizeMap.delete(removedNode.key);
                this.stats.memoryUsed -= removedNode.size;
                this.stats.evictions++;
            } else {
                break;
            }
        }
    }

    _startCleanupTimer() {
        if (this.ttl <= 0) return;

        this.cleanupTimer = setInterval(() => {
            this._cleanupExpired();
        }, Math.max(this.ttl / 10, 1000)); // 至少每秒檢查一次
    }

    _cleanupExpired() {
        const now = Date.now();
        const keysToRemove = [];

        for (const [key, node] of this.cache) {
            if (now - node.createdAt > this.ttl) {
                keysToRemove.push(key);
            }
        }

        for (const key of keysToRemove) {
            this.delete(key);
        }
    }

    dispose() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }
}

/**
 * 數據壓縮器
 */
class DataCompressor {
    constructor(options = {}) {
        this.algorithm = options.algorithm || COMPRESSION_ALGORITHMS.GZIP;
        this.level = options.level || 6; // 壓縮級別 1-9
        this.minSize = options.minSize || 1024; // 最小壓縮大小
    }

    /**
     * 壓縮數據
     */
    compress(data) {
        if (!data) return data;

        const serialized = typeof data === 'string' ? data : JSON.stringify(data);
        const size = Buffer.byteLength(serialized, 'utf8');

        // 小數據不壓縮
        if (size < this.minSize) {
            return {
                data: serialized,
                compressed: false,
                originalSize: size,
                compressedSize: size,
                ratio: 1.0
            };
        }

        try {
            const compressed = this._performCompression(serialized);
            const compressedSize = Buffer.byteLength(compressed, 'utf8');

            return {
                data: compressed,
                compressed: true,
                algorithm: this.algorithm,
                originalSize: size,
                compressedSize,
                ratio: compressedSize / size
            };

        } catch (error) {
            console.warn('[DataCompressor] 壓縮失敗:', error);
            return {
                data: serialized,
                compressed: false,
                originalSize: size,
                compressedSize: size,
                ratio: 1.0
            };
        }
    }

    /**
     * 解壓數據
     */
    decompress(compressedData) {
        if (!compressedData || !compressedData.compressed) {
            return compressedData?.data || compressedData;
        }

        try {
            const decompressed = this._performDecompression(compressedData.data, compressedData.algorithm);
            return decompressed;

        } catch (error) {
            console.error('[DataCompressor] 解壓失敗:', error);
            throw error;
        }
    }

    _performCompression(data) {
        // 實際應用中應使用zlib或其他壓縮庫
        // 這裡使用簡化的base64編碼作為示例
        return Buffer.from(data).toString('base64');
    }

    _performDecompression(data, algorithm) {
        // 實際應用中應使用對應的解壓算法
        return Buffer.from(data, 'base64').toString('utf8');
    }
}

/**
 * 批量操作優化器
 */
class BatchOptimizer {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 50;
        this.batchTimeout = options.batchTimeout || 100;
        this.maxConcurrency = options.maxConcurrency || 10;

        this.pendingOperations = [];
        this.batchTimer = null;
        this.activeBatches = 0;
    }

    /**
     * 添加操作到批次
     */
    async addOperation(operation, context = {}) {
        return new Promise((resolve, reject) => {
            this.pendingOperations.push({
                operation,
                context,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // 檢查是否需要立即執行
            if (this.pendingOperations.length >= this.batchSize) {
                this._executeBatch();
            } else if (!this.batchTimer) {
                this._scheduleBatch();
            }
        });
    }

    /**
     * 強制執行所有待處理的批次
     */
    async flush() {
        if (this.pendingOperations.length > 0) {
            await this._executeBatch();
        }

        // 等待所有活動批次完成
        while (this.activeBatches > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    _scheduleBatch() {
        this.batchTimer = setTimeout(() => {
            this._executeBatch();
        }, this.batchTimeout);
    }

    async _executeBatch() {
        if (this.pendingOperations.length === 0) return;

        // 檢查並發限制
        if (this.activeBatches >= this.maxConcurrency) {
            // 等待有空閒
            setTimeout(() => this._executeBatch(), 10);
            return;
        }

        const batch = this.pendingOperations.splice(0, this.batchSize);

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        this.activeBatches++;

        try {
            // 並行執行批次中的操作
            const results = await Promise.allSettled(
                batch.map(item => item.operation(item.context))
            );

            // 處理結果
            results.forEach((result, index) => {
                const batchItem = batch[index];

                if (result.status === 'fulfilled') {
                    batchItem.resolve(result.value);
                } else {
                    batchItem.reject(result.reason);
                }
            });

        } catch (error) {
            // 批次執行失敗，拒絕所有操作
            batch.forEach(item => item.reject(error));

        } finally {
            this.activeBatches--;

            // 如果還有待處理的操作，繼續執行
            if (this.pendingOperations.length > 0 && !this.batchTimer) {
                this._scheduleBatch();
            }
        }
    }
}

/**
 * 性能監控器
 */
class PerformanceMonitor {
    constructor(options = {}) {
        this.sampleInterval = options.sampleInterval || 1000; // 1秒
        this.historySize = options.historySize || 300; // 5分鐘歷史
        this.enableCPUMonitoring = options.enableCPUMonitoring || false;

        this.metrics = new Map(); // metricType -> [values]
        this.realTimeMetrics = new Map(); // metricType -> current value
        this.monitoringTimer = null;

        this._startMonitoring();
    }

    /**
     * 記錄指標
     */
    recordMetric(type, value, timestamp = Date.now()) {
        if (!this.metrics.has(type)) {
            this.metrics.set(type, []);
        }

        const history = this.metrics.get(type);
        history.push({ value, timestamp });

        // 限制歷史大小
        if (history.length > this.historySize) {
            history.shift();
        }

        this.realTimeMetrics.set(type, value);
    }

    /**
     * 獲取指標統計
     */
    getMetricStats(type, duration = 60000) { // 預設1分鐘
        const history = this.metrics.get(type) || [];
        const cutoffTime = Date.now() - duration;
        const recentValues = history
            .filter(item => item.timestamp >= cutoffTime)
            .map(item => item.value);

        if (recentValues.length === 0) {
            return null;
        }

        const sum = recentValues.reduce((a, b) => a + b, 0);
        const avg = sum / recentValues.length;
        const min = Math.min(...recentValues);
        const max = Math.max(...recentValues);

        // 計算百分位數
        const sorted = recentValues.sort((a, b) => a - b);
        const p50 = this._percentile(sorted, 50);
        const p95 = this._percentile(sorted, 95);
        const p99 = this._percentile(sorted, 99);

        return {
            current: this.realTimeMetrics.get(type),
            count: recentValues.length,
            avg: Number(avg.toFixed(2)),
            min,
            max,
            p50,
            p95,
            p99
        };
    }

    /**
     * 獲取所有指標概覽
     */
    getOverview() {
        const overview = {};

        for (const type of this.metrics.keys()) {
            overview[type] = this.getMetricStats(type);
        }

        return overview;
    }

    /**
     * 檢測性能異常
     */
    detectAnomalies(options = {}) {
        const thresholds = {
            cacheHitRate: options.minCacheHitRate || 80, // 80%
            responseTime: options.maxResponseTime || 1000, // 1秒
            errorRate: options.maxErrorRate || 5, // 5%
            memoryUsage: options.maxMemoryUsage || 80, // 80%
            ...options.thresholds
        };

        const anomalies = [];

        for (const [type, threshold] of Object.entries(thresholds)) {
            const stats = this.getMetricStats(type);
            if (!stats) continue;

            let isAnomaly = false;
            let message = '';

            switch (type) {
                case 'cache_hit_rate':
                    if (stats.avg < threshold) {
                        isAnomaly = true;
                        message = `緩存命中率過低: ${stats.avg}% < ${threshold}%`;
                    }
                    break;

                case 'response_time':
                    if (stats.p95 > threshold) {
                        isAnomaly = true;
                        message = `響應時間過慢: P95=${stats.p95}ms > ${threshold}ms`;
                    }
                    break;

                case 'error_rate':
                    if (stats.avg > threshold) {
                        isAnomaly = true;
                        message = `錯誤率過高: ${stats.avg}% > ${threshold}%`;
                    }
                    break;

                case 'memory_usage':
                    if (stats.current > threshold) {
                        isAnomaly = true;
                        message = `內存使用率過高: ${stats.current}% > ${threshold}%`;
                    }
                    break;
            }

            if (isAnomaly) {
                anomalies.push({
                    type,
                    message,
                    threshold,
                    current: stats.current,
                    stats,
                    timestamp: Date.now()
                });
            }
        }

        return anomalies;
    }

    _startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            // 記錄系統指標
            if (this.enableCPUMonitoring) {
                this._recordSystemMetrics();
            }
        }, this.sampleInterval);
    }

    _recordSystemMetrics() {
        try {
            // 內存使用率
            const memoryUsage = process.memoryUsage();
            const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
            this.recordMetric(METRIC_TYPES.MEMORY_USAGE, memoryPercent);

            // CPU使用率 - 需要額外的CPU監控庫
            // this.recordMetric(METRIC_TYPES.CPU_USAGE, cpuUsage);

        } catch (error) {
            console.warn('[PerformanceMonitor] 系統指標記錄失敗:', error);
        }
    }

    _percentile(sortedValues, percentile) {
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
        if (lower === upper) return sortedValues[lower];

        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    dispose() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }
        this.metrics.clear();
        this.realTimeMetrics.clear();
    }
}

/**
 * 主性能優化器
 */
class ConfigPerformanceOptimizer extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 緩存配置
            cacheEnabled: options.cacheEnabled !== false,
            cacheOptions: options.cacheOptions || {},

            // 壓縮配置
            compressionEnabled: options.compressionEnabled || false,
            compressionOptions: options.compressionOptions || {},

            // 批量處理配置
            batchingEnabled: options.batchingEnabled !== false,
            batchOptions: options.batchOptions || {},

            // 性能監控配置
            monitoringEnabled: options.monitoringEnabled !== false,
            monitoringOptions: options.monitoringOptions || {},

            // 預載配置
            preloadEnabled: options.preloadEnabled || false,
            preloadKeys: options.preloadKeys || [],

            ...options
        };

        // 核心組件
        this.cache = this.options.cacheEnabled
            ? new HighPerformanceCache(this.options.cacheOptions)
            : null;

        this.compressor = this.options.compressionEnabled
            ? new DataCompressor(this.options.compressionOptions)
            : null;

        this.batchOptimizer = this.options.batchingEnabled
            ? new BatchOptimizer(this.options.batchOptions)
            : null;

        this.performanceMonitor = this.options.monitoringEnabled
            ? new PerformanceMonitor(this.options.monitoringOptions)
            : null;

        // 性能統計
        this.stats = {
            totalOperations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            compressionSavings: 0,
            batchedOperations: 0,
            averageResponseTime: 0
        };

        // 預載完成標記
        this.preloadCompleted = false;
    }

    /**
     * 初始化優化器
     */
    async initialize(configManager = null) {
        try {
            this.configManager = configManager;

            // 預載關鍵配置
            if (this.options.preloadEnabled && configManager && this.options.preloadKeys.length > 0) {
                await this._preloadConfigs();
            }

            // 開始性能監控
            if (this.performanceMonitor) {
                this._startPerformanceMonitoring();
            }

            console.log('[ConfigPerformanceOptimizer] 已初始化');
            this.emit('initialized');

        } catch (error) {
            console.error('[ConfigPerformanceOptimizer] 初始化失敗:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 優化配置獲取
     */
    async optimizedGet(key, loader, options = {}) {
        const startTime = Date.now();
        this.stats.totalOperations++;

        try {
            // 嘗試從緩存獲取
            if (this.cache && options.useCache !== false) {
                const cachedValue = this.cache.get(key);
                if (cachedValue !== null) {
                    this.stats.cacheHits++;
                    const responseTime = Date.now() - startTime;
                    this._recordMetrics(responseTime, true, false);
                    return this._decompress(cachedValue);
                }
            }

            // 從數據源加載
            let value;
            if (this.batchOptimizer && options.allowBatching !== false) {
                value = await this.batchOptimizer.addOperation(
                    async () => await loader(key),
                    { key, options }
                );
            } else {
                value = await loader(key);
            }

            // 壓縮並緩存
            if (this.cache && value !== null && value !== undefined) {
                const compressedValue = this._compress(value);
                this.cache.set(key, compressedValue, {
                    size: this._calculateSize(compressedValue),
                    ...options.cacheOptions
                });
            }

            this.stats.cacheMisses++;
            const responseTime = Date.now() - startTime;
            this._recordMetrics(responseTime, false, false);

            return value;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this._recordMetrics(responseTime, false, true);
            throw error;
        }
    }

    /**
     * 優化配置設置
     */
    async optimizedSet(key, value, setter, options = {}) {
        const startTime = Date.now();
        this.stats.totalOperations++;

        try {
            // 執行設置操作
            let result;
            if (this.batchOptimizer && options.allowBatching !== false) {
                this.stats.batchedOperations++;
                result = await this.batchOptimizer.addOperation(
                    async () => await setter(key, value),
                    { key, value, options }
                );
            } else {
                result = await setter(key, value);
            }

            // 更新緩存
            if (this.cache && options.updateCache !== false) {
                const compressedValue = this._compress(value);
                this.cache.set(key, compressedValue, {
                    size: this._calculateSize(compressedValue),
                    ...options.cacheOptions
                });
            }

            const responseTime = Date.now() - startTime;
            this._recordMetrics(responseTime, false, false);

            return result;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this._recordMetrics(responseTime, false, true);
            throw error;
        }
    }

    /**
     * 批量優化操作
     */
    async optimizedBatch(operations, options = {}) {
        const startTime = Date.now();

        try {
            const results = [];

            // 並行執行操作
            const promises = operations.map(async (operation) => {
                if (operation.type === 'get') {
                    return await this.optimizedGet(
                        operation.key,
                        operation.loader,
                        operation.options
                    );
                } else if (operation.type === 'set') {
                    return await this.optimizedSet(
                        operation.key,
                        operation.value,
                        operation.setter,
                        operation.options
                    );
                }
            });

            const responses = await Promise.allSettled(promises);

            // 處理結果
            for (let i = 0; i < operations.length; i++) {
                const response = responses[i];
                results.push({
                    operation: operations[i],
                    success: response.status === 'fulfilled',
                    result: response.status === 'fulfilled' ? response.value : null,
                    error: response.status === 'rejected' ? response.reason : null
                });
            }

            const batchTime = Date.now() - startTime;
            this.emit('batchCompleted', {
                totalOperations: operations.length,
                successfulOperations: results.filter(r => r.success).length,
                batchTime
            });

            return results;

        } catch (error) {
            console.error('[ConfigPerformanceOptimizer] 批量操作失敗:', error);
            throw error;
        }
    }

    /**
     * 預熱緩存
     */
    async warmupCache(keys, loader) {
        if (!this.cache) {
            console.warn('[ConfigPerformanceOptimizer] 緩存未啟用，跳過預熱');
            return;
        }

        try {
            const warmupResult = await this.cache.warmup(loader, keys);

            this.emit('cacheWarmedUp', {
                totalKeys: warmupResult.totalKeys,
                loadedKeys: warmupResult.loadedCount,
                warmupTime: warmupResult.warmupTime
            });

            return warmupResult;

        } catch (error) {
            console.error('[ConfigPerformanceOptimizer] 緩存預熱失敗:', error);
            throw error;
        }
    }

    /**
     * 使緩存無效
     */
    invalidateCache(key = null) {
        if (!this.cache) return false;

        if (key) {
            return this.cache.delete(key);
        } else {
            this.cache.clear();
            this.emit('cacheCleared');
            return true;
        }
    }

    /**
     * 獲取性能統計
     */
    getPerformanceStats() {
        const cacheStats = this.cache ? this.cache.getStats() : {};
        const monitoringStats = this.performanceMonitor
            ? this.performanceMonitor.getOverview()
            : {};

        return {
            ...this.stats,
            cache: cacheStats,
            monitoring: monitoringStats,
            preloadCompleted: this.preloadCompleted
        };
    }

    /**
     * 檢測性能問題
     */
    detectPerformanceIssues(options = {}) {
        if (!this.performanceMonitor) {
            return [];
        }

        return this.performanceMonitor.detectAnomalies(options);
    }

    /**
     * 獲取優化建議
     */
    getOptimizationSuggestions() {
        const stats = this.getPerformanceStats();
        const suggestions = [];

        // 緩存命中率建議
        if (stats.cache.hitRate < 70) {
            suggestions.push({
                type: 'cache',
                priority: 'high',
                message: '緩存命中率較低，考慮增加緩存大小或調整TTL',
                details: `當前命中率: ${stats.cache.hitRate}%`
            });
        }

        // 內存使用建議
        if (stats.cache.memoryUsagePercent > 80) {
            suggestions.push({
                type: 'memory',
                priority: 'medium',
                message: '內存使用率較高，考慮啟用壓縮或減少緩存大小',
                details: `內存使用率: ${stats.cache.memoryUsagePercent}%`
            });
        }

        // 壓縮建議
        if (!this.compressor && stats.cache.size > 500) {
            suggestions.push({
                type: 'compression',
                priority: 'low',
                message: '建議啟用數據壓縮以節省內存',
                details: `緩存項目數: ${stats.cache.size}`
            });
        }

        return suggestions;
    }

    // ========== 私有方法 ==========

    /**
     * 預載配置
     */
    async _preloadConfigs() {
        if (!this.configManager) {
            console.warn('[ConfigPerformanceOptimizer] ConfigManager未設置，跳過預載');
            return;
        }

        try {
            const loader = async (key) => {
                return await this.configManager.get(key);
            };

            await this.warmupCache(this.options.preloadKeys, loader);
            this.preloadCompleted = true;

            console.log(`[ConfigPerformanceOptimizer] 預載完成 - ${this.options.preloadKeys.length} 個配置`);

        } catch (error) {
            console.error('[ConfigPerformanceOptimizer] 預載失敗:', error);
        }
    }

    /**
     * 壓縮數據
     */
    _compress(data) {
        if (!this.compressor) return data;

        const result = this.compressor.compress(data);
        if (result.compressed && result.ratio < 0.8) { // 壓縮比小於80%才使用
            this.stats.compressionSavings += result.originalSize - result.compressedSize;
            return result;
        }

        return data; // 不值得壓縮
    }

    /**
     * 解壓數據
     */
    _decompress(data) {
        if (!this.compressor) return data;
        return this.compressor.decompress(data);
    }

    /**
     * 計算數據大小
     */
    _calculateSize(data) {
        if (data && data.compressedSize) {
            return data.compressedSize;
        }

        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return Buffer.byteLength(str, 'utf8');
    }

    /**
     * 記錄性能指標
     */
    _recordMetrics(responseTime, cacheHit, hasError) {
        // 更新平均響應時間
        this.stats.averageResponseTime = (
            this.stats.averageResponseTime * (this.stats.totalOperations - 1) + responseTime
        ) / this.stats.totalOperations;

        // 記錄到監控器
        if (this.performanceMonitor) {
            this.performanceMonitor.recordMetric(METRIC_TYPES.RESPONSE_TIME, responseTime);

            const hitRate = (this.stats.cacheHits / this.stats.totalOperations) * 100;
            this.performanceMonitor.recordMetric(METRIC_TYPES.CACHE_HIT_RATE, hitRate);

            if (hasError) {
                const errorRate = (1 / this.stats.totalOperations) * 100;
                this.performanceMonitor.recordMetric(METRIC_TYPES.ERROR_RATE, errorRate);
            }
        }
    }

    /**
     * 開始性能監控
     */
    _startPerformanceMonitoring() {
        // 定期檢查性能問題
        setInterval(() => {
            const issues = this.detectPerformanceIssues();
            if (issues.length > 0) {
                this.emit('performanceIssues', issues);
            }
        }, 30000); // 30秒檢查一次
    }

    /**
     * 清理資源
     */
    dispose() {
        if (this.cache) {
            this.cache.dispose();
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.dispose();
        }

        console.log('[ConfigPerformanceOptimizer] 已清理資源');
    }
}

// 導出常數
ConfigPerformanceOptimizer.CACHE_STRATEGIES = CACHE_STRATEGIES;
ConfigPerformanceOptimizer.COMPRESSION_ALGORITHMS = COMPRESSION_ALGORITHMS;
ConfigPerformanceOptimizer.METRIC_TYPES = METRIC_TYPES;

module.exports = ConfigPerformanceOptimizer;