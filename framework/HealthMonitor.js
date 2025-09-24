/**
 * HealthMonitor - 系統健康檢測和預警
 *
 * 功能：
 * - 多維度健康指標監控
 * - 實時健康狀態評估
 * - 預警和告警機制
 * - 健康趨勢分析和預測
 * - 健康報告和儀表板數據
 *
 * 用途：CCPM+SuperClaude整合的系統健康監控基礎設施
 * 配合：ErrorHandler錯誤監控、CircuitBreaker熔斷監控、FallbackManager降級監控
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * 健康狀態等級
 */
const HEALTH_LEVELS = {
    EXCELLENT: 'excellent',     // 優秀 (90-100%)
    GOOD: 'good',              // 良好 (70-89%)
    FAIR: 'fair',              // 一般 (50-69%)
    POOR: 'poor',              // 較差 (30-49%)
    CRITICAL: 'critical'       // 危險 (0-29%)
};

/**
 * 監控類別
 */
const MONITOR_CATEGORIES = {
    SYSTEM: 'system',           // 系統資源
    APPLICATION: 'application', // 應用程序
    NETWORK: 'network',         // 網路連接
    DATABASE: 'database',       // 資料庫
    EXTERNAL: 'external',       // 外部依賴
    SECURITY: 'security',       // 安全狀況
    PERFORMANCE: 'performance', // 性能指標
    BUSINESS: 'business'        // 業務指標
};

/**
 * 告警級別
 */
const ALERT_LEVELS = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

/**
 * 健康檢查項目
 */
class HealthCheck {
    constructor(name, options = {}) {
        this.name = name;
        this.category = options.category || MONITOR_CATEGORIES.SYSTEM;
        this.description = options.description || '';

        // 檢查配置
        this.enabled = options.enabled !== false;
        this.interval = options.interval || 30000; // 30秒
        this.timeout = options.timeout || 5000; // 5秒
        this.retries = options.retries || 2;

        // 閾值配置
        this.thresholds = {
            excellent: options.thresholds?.excellent || 90,
            good: options.thresholds?.good || 70,
            fair: options.thresholds?.fair || 50,
            poor: options.thresholds?.poor || 30,
            ...options.thresholds
        };

        // 權重和優先級
        this.weight = options.weight || 1.0;
        this.priority = options.priority || 0;

        // 檢查函數
        this.checkFunction = options.checkFunction || this._defaultCheck;
        this.recoveryFunction = options.recoveryFunction || null;

        // 狀態追蹤
        this.lastCheck = null;
        this.lastResult = null;
        this.consecutiveFailures = 0;
        this.isHealthy = true;
        this.currentScore = 100;

        // 歷史記錄
        this.history = [];
        this.maxHistory = options.maxHistory || 100;

        // 統計信息
        this.stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageScore: 100,
            averageResponseTime: 0,
            uptime: 100,
            lastSuccess: null,
            lastFailure: null
        };

        // 定時器
        this.timer = null;
    }

    /**
     * 開始健康檢查
     */
    start() {
        if (!this.enabled || this.timer) return;

        this.timer = setInterval(async () => {
            await this.performCheck();
        }, this.interval);

        // 立即執行一次檢查
        setImmediate(() => this.performCheck());
    }

    /**
     * 停止健康檢查
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 執行健康檢查
     * @returns {Promise<Object>} 檢查結果
     */
    async performCheck() {
        const startTime = Date.now();
        let attempt = 0;

        while (attempt <= this.retries) {
            try {
                // 設置超時
                const checkPromise = this.checkFunction();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('健康檢查超時')), this.timeout);
                });

                const result = await Promise.race([checkPromise, timeoutPromise]);
                const responseTime = Date.now() - startTime;

                // 處理成功結果
                const processedResult = await this._processResult(result, responseTime, true);
                this._updateStats(processedResult, responseTime, true);
                this._recordHistory(processedResult);

                return processedResult;

            } catch (error) {
                attempt++;

                if (attempt > this.retries) {
                    // 處理失敗結果
                    const responseTime = Date.now() - startTime;
                    const processedResult = await this._processResult(error, responseTime, false);
                    this._updateStats(processedResult, responseTime, false);
                    this._recordHistory(processedResult);

                    return processedResult;
                }

                // 重試前等待
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * 獲取當前狀態
     * @returns {Object} 健康檢查狀態
     */
    getStatus() {
        return {
            name: this.name,
            category: this.category,
            enabled: this.enabled,
            healthy: this.isHealthy,
            score: this.currentScore,
            level: this._scoreToLevel(this.currentScore),
            lastCheck: this.lastCheck,
            lastResult: this.lastResult,
            consecutiveFailures: this.consecutiveFailures,
            stats: { ...this.stats },
            history: this.history.slice(-10) // 最近10次記錄
        };
    }

    /**
     * 獲取健康趨勢
     * @param {Number} timeRange 時間範圍（毫秒）
     * @returns {Object} 趨勢數據
     */
    getTrend(timeRange = 3600000) { // 1小時
        const cutoff = Date.now() - timeRange;
        const relevantHistory = this.history.filter(h =>
            new Date(h.timestamp).getTime() >= cutoff
        );

        if (relevantHistory.length < 2) {
            return {
                trend: 'stable',
                direction: 0,
                confidence: 0,
                data: relevantHistory
            };
        }

        // 計算趨勢
        const scores = relevantHistory.map(h => h.score);
        const timePoints = relevantHistory.map(h => new Date(h.timestamp).getTime());

        const trend = this._calculateTrend(scores, timePoints);

        return {
            trend: trend.direction > 0.1 ? 'improving' :
                   trend.direction < -0.1 ? 'degrading' : 'stable',
            direction: trend.direction,
            confidence: trend.confidence,
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            data: relevantHistory
        };
    }

    // ========== 私有方法 ==========

    /**
     * 默認檢查函數
     */
    async _defaultCheck() {
        return {
            healthy: true,
            score: 100,
            message: '默認健康檢查通過',
            details: {}
        };
    }

    /**
     * 處理檢查結果
     */
    async _processResult(result, responseTime, success) {
        const timestamp = new Date().toISOString();

        let processedResult;

        if (success && result) {
            // 成功結果處理
            processedResult = {
                success: true,
                healthy: result.healthy !== false,
                score: Math.max(0, Math.min(100, result.score || 100)),
                message: result.message || '檢查成功',
                details: result.details || {},
                responseTime,
                timestamp,
                attempt: 1
            };

            this.consecutiveFailures = 0;

        } else {
            // 失敗結果處理
            processedResult = {
                success: false,
                healthy: false,
                score: 0,
                message: result instanceof Error ? result.message : '檢查失敗',
                details: {
                    error: result instanceof Error ? result.stack : String(result)
                },
                responseTime,
                timestamp,
                attempt: this.retries + 1
            };

            this.consecutiveFailures++;

            // 嘗試自動恢復
            if (this.recoveryFunction && this.consecutiveFailures >= 3) {
                try {
                    await this.recoveryFunction();
                    processedResult.recovery = { attempted: true, success: true };
                } catch (recoveryError) {
                    processedResult.recovery = {
                        attempted: true,
                        success: false,
                        error: recoveryError.message
                    };
                }
            }
        }

        this.lastCheck = timestamp;
        this.lastResult = processedResult;
        this.isHealthy = processedResult.healthy;
        this.currentScore = processedResult.score;

        return processedResult;
    }

    /**
     * 更新統計信息
     */
    _updateStats(result, responseTime, success) {
        this.stats.totalChecks++;

        if (success) {
            this.stats.successfulChecks++;
            this.stats.lastSuccess = result.timestamp;
        } else {
            this.stats.failedChecks++;
            this.stats.lastFailure = result.timestamp;
        }

        // 更新平均分數
        this.stats.averageScore = (
            (this.stats.averageScore * (this.stats.totalChecks - 1) + result.score) /
            this.stats.totalChecks
        );

        // 更新平均響應時間
        this.stats.averageResponseTime = (
            (this.stats.averageResponseTime * (this.stats.totalChecks - 1) + responseTime) /
            this.stats.totalChecks
        );

        // 更新可用性
        this.stats.uptime = (this.stats.successfulChecks / this.stats.totalChecks) * 100;
    }

    /**
     * 記錄歷史
     */
    _recordHistory(result) {
        this.history.push({
            timestamp: result.timestamp,
            score: result.score,
            healthy: result.healthy,
            responseTime: result.responseTime,
            success: result.success
        });

        // 限制歷史記錄大小
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    /**
     * 分數轉換為健康等級
     */
    _scoreToLevel(score) {
        if (score >= this.thresholds.excellent) return HEALTH_LEVELS.EXCELLENT;
        if (score >= this.thresholds.good) return HEALTH_LEVELS.GOOD;
        if (score >= this.thresholds.fair) return HEALTH_LEVELS.FAIR;
        if (score >= this.thresholds.poor) return HEALTH_LEVELS.POOR;
        return HEALTH_LEVELS.CRITICAL;
    }

    /**
     * 計算趨勢
     */
    _calculateTrend(values, timePoints) {
        if (values.length < 2) {
            return { direction: 0, confidence: 0 };
        }

        // 簡單線性回歸
        const n = values.length;
        const sumX = timePoints.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = timePoints.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumXX = timePoints.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        // 計算置信度（相關係數的平方）
        const meanX = sumX / n;
        const meanY = sumY / n;
        const ssXX = timePoints.reduce((sum, x) => sum + (x - meanX) * (x - meanX), 0);
        const ssYY = values.reduce((sum, y) => sum + (y - meanY) * (y - meanY), 0);
        const ssXY = timePoints.reduce((sum, x, i) => sum + (x - meanX) * (values[i] - meanY), 0);

        const confidence = ssXX && ssYY ? Math.pow(ssXY / Math.sqrt(ssXX * ssYY), 2) : 0;

        return {
            direction: slope,
            confidence: Math.max(0, Math.min(1, confidence))
        };
    }

    /**
     * 清理資源
     */
    dispose() {
        this.stop();
        this.history = [];
    }
}

/**
 * 健康監控器主類
 */
class HealthMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(1000);

        this.options = {
            // 監控配置
            enableMonitoring: options.enableMonitoring !== false,
            globalInterval: options.globalInterval || 30000, // 30秒
            reportInterval: options.reportInterval || 300000, // 5分鐘

            // 告警配置
            alertThresholds: {
                [ALERT_LEVELS.WARNING]: options.alertThresholds?.warning || 70,
                [ALERT_LEVELS.ERROR]: options.alertThresholds?.error || 50,
                [ALERT_LEVELS.CRITICAL]: options.alertThresholds?.critical || 30,
                ...options.alertThresholds
            },

            // 存儲配置
            enablePersistence: options.enablePersistence || false,
            dataRetention: options.dataRetention || 86400000, // 24小時
            reportPath: options.reportPath || path.join(process.cwd(), '.claude', 'data', 'health'),

            // 預測配置
            enablePrediction: options.enablePrediction || false,
            predictionWindow: options.predictionWindow || 3600000, // 1小時

            ...options
        };

        // 健康檢查項目
        this.healthChecks = new Map();

        // 系統狀態
        this.systemHealth = {
            overall: {
                healthy: true,
                score: 100,
                level: HEALTH_LEVELS.EXCELLENT
            },
            categories: {},
            lastUpdate: new Date().toISOString()
        };

        // 告警管理
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.maxAlertHistory = 1000;

        // 統計信息
        this.stats = {
            totalChecks: 0,
            activeChecks: 0,
            healthyChecks: 0,
            unhealthyChecks: 0,
            averageSystemScore: 100,
            systemUptime: 100,
            lastReport: null,
            startTime: new Date().toISOString()
        };

        // 定時器
        this.monitoringTimer = null;
        this.reportTimer = null;

        // 預測數據
        this.predictions = new Map();

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化健康監控器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 創建數據目錄
            if (this.options.enablePersistence) {
                await fs.mkdir(this.options.reportPath, { recursive: true });
            }

            // 註冊默認健康檢查
            this._registerDefaultHealthChecks();

            // 啟動監控
            if (this.options.enableMonitoring) {
                this._startMonitoring();
            }

            this.initialized = true;
            this.emit('initialized');

            console.log('[HealthMonitor] 健康監控器已初始化');

        } catch (error) {
            console.error('[HealthMonitor] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 註冊健康檢查
     * @param {String} name 檢查名稱
     * @param {Object} options 檢查選項
     * @returns {HealthCheck} 健康檢查實例
     */
    registerCheck(name, options = {}) {
        if (this.healthChecks.has(name)) {
            throw new Error(`健康檢查已存在: ${name}`);
        }

        const healthCheck = new HealthCheck(name, options);
        this.healthChecks.set(name, healthCheck);

        this.stats.totalChecks++;

        this.emit('checkRegistered', name, options);
        console.log(`[HealthMonitor] 已註冊健康檢查: ${name}`);

        return healthCheck;
    }

    /**
     * 移除健康檢查
     * @param {String} name 檢查名稱
     */
    unregisterCheck(name) {
        const healthCheck = this.healthChecks.get(name);
        if (healthCheck) {
            healthCheck.dispose();
            this.healthChecks.delete(name);
            this.stats.totalChecks--;

            this.emit('checkUnregistered', name);
        }
    }

    /**
     * 啟動所有健康檢查
     */
    startAllChecks() {
        for (const healthCheck of this.healthChecks.values()) {
            if (healthCheck.enabled) {
                healthCheck.start();
                this.stats.activeChecks++;
            }
        }

        this.emit('allChecksStarted');
    }

    /**
     * 停止所有健康檢查
     */
    stopAllChecks() {
        for (const healthCheck of this.healthChecks.values()) {
            healthCheck.stop();
        }

        this.stats.activeChecks = 0;
        this.emit('allChecksStopped');
    }

    /**
     * 執行單次完整健康檢查
     * @returns {Promise<Object>} 檢查結果
     */
    async performFullHealthCheck() {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const results = new Map();

        // 並行執行所有健康檢查
        const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, healthCheck]) => {
            if (healthCheck.enabled) {
                try {
                    const result = await healthCheck.performCheck();
                    results.set(name, result);
                    return { name, result, success: true };
                } catch (error) {
                    const errorResult = {
                        success: false,
                        healthy: false,
                        score: 0,
                        message: error.message,
                        timestamp: new Date().toISOString()
                    };
                    results.set(name, errorResult);
                    return { name, result: errorResult, success: false };
                }
            }
        });

        const checkResults = await Promise.allSettled(checkPromises);
        const duration = Date.now() - startTime;

        // 計算整體健康狀況
        const overallHealth = this._calculateOverallHealth(results);

        // 檢查告警條件
        await this._checkAlertConditions(overallHealth, results);

        // 更新系統狀態
        this._updateSystemHealth(overallHealth);

        const fullResult = {
            overall: overallHealth,
            checks: Object.fromEntries(results),
            duration,
            timestamp: new Date().toISOString()
        };

        this.emit('fullCheckCompleted', fullResult);

        return fullResult;
    }

    /**
     * 獲取系統健康狀況
     * @returns {Object} 健康狀況
     */
    getSystemHealth() {
        this._updateStats();

        return {
            ...this.systemHealth,
            stats: { ...this.stats },
            alerts: {
                active: Array.from(this.activeAlerts.values()),
                recent: this.alertHistory.slice(-10)
            }
        };
    }

    /**
     * 獲取詳細健康報告
     * @param {Object} options 報告選項
     * @returns {Object} 詳細報告
     */
    getDetailedReport(options = {}) {
        const includeHistory = options.includeHistory !== false;
        const includeTrends = options.includeTrends !== false;
        const timeRange = options.timeRange || 3600000; // 1小時

        const report = {
            summary: this.getSystemHealth(),
            checks: {},
            categories: {},
            timestamp: new Date().toISOString()
        };

        // 收集檢查詳情
        for (const [name, healthCheck] of this.healthChecks.entries()) {
            const status = healthCheck.getStatus();

            report.checks[name] = {
                ...status,
                trend: includeTrends ? healthCheck.getTrend(timeRange) : null
            };

            // 按類別分組
            const category = healthCheck.category;
            if (!report.categories[category]) {
                report.categories[category] = {
                    checks: [],
                    overallScore: 0,
                    healthyCount: 0,
                    totalCount: 0
                };
            }

            report.categories[category].checks.push(name);
            report.categories[category].overallScore += status.score;
            report.categories[category].totalCount++;
            if (status.healthy) {
                report.categories[category].healthyCount++;
            }
        }

        // 計算類別平均分數
        for (const category of Object.values(report.categories)) {
            if (category.totalCount > 0) {
                category.overallScore = category.overallScore / category.totalCount;
                category.healthyPercentage = (category.healthyCount / category.totalCount) * 100;
            }
        }

        return report;
    }

    /**
     * 獲取健康趨勢預測
     * @param {String} checkName 檢查名稱
     * @param {Number} predictAhead 預測時間窗口（毫秒）
     * @returns {Object} 預測結果
     */
    getHealthPrediction(checkName, predictAhead = 3600000) {
        const healthCheck = this.healthChecks.get(checkName);
        if (!healthCheck || !this.options.enablePrediction) {
            return null;
        }

        const cachedPrediction = this.predictions.get(checkName);
        if (cachedPrediction && Date.now() - cachedPrediction.timestamp < 300000) {
            return cachedPrediction.prediction;
        }

        // 簡單的預測算法（基於趨勢）
        const trend = healthCheck.getTrend();
        const currentScore = healthCheck.currentScore;

        const prediction = {
            currentScore,
            predictedScore: Math.max(0, Math.min(100, currentScore + (trend.direction * predictAhead / 3600000))),
            confidence: trend.confidence,
            trend: trend.trend,
            timeWindow: predictAhead,
            timestamp: new Date().toISOString()
        };

        // 快取預測結果
        this.predictions.set(checkName, {
            prediction,
            timestamp: Date.now()
        });

        return prediction;
    }

    /**
     * 導出健康報告
     * @param {String} format 導出格式（json, csv）
     * @param {Object} options 導出選項
     * @returns {Promise<String>} 報告內容
     */
    async exportReport(format = 'json', options = {}) {
        const report = this.getDetailedReport(options);

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(report, null, 2);

            case 'csv':
                return this._convertToCSV(report);

            default:
                throw new Error(`不支持的導出格式: ${format}`);
        }
    }

    /**
     * 保存健康報告
     * @param {Object} options 保存選項
     * @returns {Promise<String>} 保存路徑
     */
    async saveReport(options = {}) {
        if (!this.options.enablePersistence) {
            throw new Error('未啟用持久化存儲');
        }

        const format = options.format || 'json';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `health-report-${timestamp}.${format}`;
        const filepath = path.join(this.options.reportPath, filename);

        const reportContent = await this.exportReport(format, options);
        await fs.writeFile(filepath, reportContent, 'utf8');

        return filepath;
    }

    // ========== 私有方法 ==========

    /**
     * 註冊默認健康檢查
     */
    _registerDefaultHealthChecks() {
        // 系統內存檢查
        this.registerCheck('system_memory', {
            category: MONITOR_CATEGORIES.SYSTEM,
            description: '系統內存使用率檢查',
            checkFunction: async () => {
                const used = process.memoryUsage();
                const total = used.heapTotal;
                const usage = (used.heapUsed / total) * 100;

                return {
                    healthy: usage < 80,
                    score: Math.max(0, 100 - usage),
                    message: `內存使用率: ${usage.toFixed(2)}%`,
                    details: {
                        usage: usage.toFixed(2),
                        heapUsed: Math.round(used.heapUsed / 1024 / 1024),
                        heapTotal: Math.round(total / 1024 / 1024)
                    }
                };
            }
        });

        // 事件循環延遲檢查
        this.registerCheck('event_loop_lag', {
            category: MONITOR_CATEGORIES.PERFORMANCE,
            description: '事件循環延遲檢查',
            checkFunction: async () => {
                return new Promise(resolve => {
                    const start = process.hrtime.bigint();
                    setImmediate(() => {
                        const lag = Number(process.hrtime.bigint() - start) / 1000000; // 轉換為毫秒

                        resolve({
                            healthy: lag < 100,
                            score: Math.max(0, 100 - lag),
                            message: `事件循環延遲: ${lag.toFixed(2)}ms`,
                            details: { lag }
                        });
                    });
                });
            }
        });

        // 文件系統檢查
        this.registerCheck('filesystem_health', {
            category: MONITOR_CATEGORIES.SYSTEM,
            description: '文件系統健康檢查',
            checkFunction: async () => {
                try {
                    const testFile = path.join(process.cwd(), '.health-test');
                    await fs.writeFile(testFile, 'test', 'utf8');
                    await fs.readFile(testFile, 'utf8');
                    await fs.unlink(testFile);

                    return {
                        healthy: true,
                        score: 100,
                        message: '文件系統正常',
                        details: {}
                    };
                } catch (error) {
                    return {
                        healthy: false,
                        score: 0,
                        message: `文件系統錯誤: ${error.message}`,
                        details: { error: error.message }
                    };
                }
            }
        });
    }

    /**
     * 啟動監控
     */
    _startMonitoring() {
        if (this.monitoringTimer) return;

        // 啟動所有健康檢查
        this.startAllChecks();

        // 設置全局監控定時器
        this.monitoringTimer = setInterval(async () => {
            try {
                await this.performFullHealthCheck();
            } catch (error) {
                this.emit('monitoringError', error);
            }
        }, this.options.globalInterval);

        // 設置報告定時器
        if (this.options.enablePersistence) {
            this.reportTimer = setInterval(async () => {
                try {
                    const reportPath = await this.saveReport();
                    this.stats.lastReport = new Date().toISOString();
                    this.emit('reportSaved', reportPath);
                } catch (error) {
                    this.emit('reportError', error);
                }
            }, this.options.reportInterval);
        }

        this.emit('monitoringStarted');
    }

    /**
     * 停止監控
     */
    _stopMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = null;
        }

        this.stopAllChecks();
        this.emit('monitoringStopped');
    }

    /**
     * 計算整體健康狀況
     */
    _calculateOverallHealth(results) {
        let totalScore = 0;
        let totalWeight = 0;
        let healthyCount = 0;
        let totalCount = 0;

        for (const [name, result] of results.entries()) {
            const healthCheck = this.healthChecks.get(name);
            if (healthCheck) {
                const weight = healthCheck.weight;
                totalScore += result.score * weight;
                totalWeight += weight;

                if (result.healthy) {
                    healthyCount++;
                }
                totalCount++;
            }
        }

        const overallScore = totalWeight > 0 ? totalScore / totalWeight : 100;
        const overallHealthy = (healthyCount / Math.max(totalCount, 1)) >= 0.8; // 80%閾值

        return {
            healthy: overallHealthy,
            score: Math.round(overallScore),
            level: this._scoreToLevel(overallScore),
            healthyChecks: healthyCount,
            totalChecks: totalCount,
            healthyPercentage: totalCount > 0 ? (healthyCount / totalCount) * 100 : 100
        };
    }

    /**
     * 檢查告警條件
     */
    async _checkAlertConditions(overallHealth, results) {
        const score = overallHealth.score;
        let alertLevel = null;

        // 確定告警級別
        if (score <= this.options.alertThresholds[ALERT_LEVELS.CRITICAL]) {
            alertLevel = ALERT_LEVELS.CRITICAL;
        } else if (score <= this.options.alertThresholds[ALERT_LEVELS.ERROR]) {
            alertLevel = ALERT_LEVELS.ERROR;
        } else if (score <= this.options.alertThresholds[ALERT_LEVELS.WARNING]) {
            alertLevel = ALERT_LEVELS.WARNING;
        }

        if (alertLevel) {
            const alertId = `system_health_${alertLevel}`;

            if (!this.activeAlerts.has(alertId)) {
                const alert = {
                    id: alertId,
                    level: alertLevel,
                    message: `系統健康分數過低: ${score}`,
                    timestamp: new Date().toISOString(),
                    details: {
                        overallHealth,
                        failedChecks: Array.from(results.entries())
                            .filter(([_, result]) => !result.healthy)
                            .map(([name, result]) => ({ name, result }))
                    }
                };

                this.activeAlerts.set(alertId, alert);
                this.alertHistory.push(alert);

                // 限制告警歷史大小
                if (this.alertHistory.length > this.maxAlertHistory) {
                    this.alertHistory = this.alertHistory.slice(-this.maxAlertHistory);
                }

                this.emit('alert', alert);
            }
        } else {
            // 清除系統級告警
            const systemAlerts = Array.from(this.activeAlerts.keys())
                .filter(id => id.startsWith('system_health_'));

            for (const alertId of systemAlerts) {
                const alert = this.activeAlerts.get(alertId);
                this.activeAlerts.delete(alertId);
                this.emit('alertCleared', alert);
            }
        }
    }

    /**
     * 更新系統健康狀態
     */
    _updateSystemHealth(overallHealth) {
        this.systemHealth.overall = overallHealth;
        this.systemHealth.lastUpdate = new Date().toISOString();

        // 按類別計算健康狀況
        const categories = {};

        for (const [name, healthCheck] of this.healthChecks.entries()) {
            const category = healthCheck.category;

            if (!categories[category]) {
                categories[category] = {
                    totalScore: 0,
                    totalWeight: 0,
                    healthyCount: 0,
                    totalCount: 0
                };
            }

            const categoryData = categories[category];
            categoryData.totalScore += healthCheck.currentScore * healthCheck.weight;
            categoryData.totalWeight += healthCheck.weight;
            categoryData.totalCount++;

            if (healthCheck.isHealthy) {
                categoryData.healthyCount++;
            }
        }

        // 計算類別健康狀況
        for (const [categoryName, data] of Object.entries(categories)) {
            const score = data.totalWeight > 0 ? data.totalScore / data.totalWeight : 100;
            const healthyPercentage = data.totalCount > 0 ? (data.healthyCount / data.totalCount) * 100 : 100;

            this.systemHealth.categories[categoryName] = {
                healthy: healthyPercentage >= 80,
                score: Math.round(score),
                level: this._scoreToLevel(score),
                healthyChecks: data.healthyCount,
                totalChecks: data.totalCount,
                healthyPercentage
            };
        }
    }

    /**
     * 更新統計信息
     */
    _updateStats() {
        let healthyCount = 0;
        let unhealthyCount = 0;
        let activeCount = 0;

        for (const healthCheck of this.healthChecks.values()) {
            if (healthCheck.timer) {
                activeCount++;
            }

            if (healthCheck.isHealthy) {
                healthyCount++;
            } else {
                unhealthyCount++;
            }
        }

        this.stats.activeChecks = activeCount;
        this.stats.healthyChecks = healthyCount;
        this.stats.unhealthyChecks = unhealthyCount;
        this.stats.averageSystemScore = this.systemHealth.overall.score;
        this.stats.systemUptime = this.systemHealth.overall.healthyPercentage;

        // 計算運行時間
        const startTime = new Date(this.stats.startTime).getTime();
        const uptime = Date.now() - startTime;
        this.stats.uptimeMs = uptime;
    }

    /**
     * 分數轉換為健康等級
     */
    _scoreToLevel(score) {
        if (score >= 90) return HEALTH_LEVELS.EXCELLENT;
        if (score >= 70) return HEALTH_LEVELS.GOOD;
        if (score >= 50) return HEALTH_LEVELS.FAIR;
        if (score >= 30) return HEALTH_LEVELS.POOR;
        return HEALTH_LEVELS.CRITICAL;
    }

    /**
     * 轉換為CSV格式
     */
    _convertToCSV(report) {
        const lines = [];

        // 標題行
        lines.push('Check Name,Category,Healthy,Score,Level,Last Check,Message');

        // 數據行
        for (const [name, check] of Object.entries(report.checks)) {
            const line = [
                name,
                check.category,
                check.healthy,
                check.score,
                check.level,
                check.lastCheck || '',
                (check.lastResult?.message || '').replace(/,/g, ';')
            ].join(',');
            lines.push(line);
        }

        return lines.join('\n');
    }

    /**
     * 清理資源
     */
    async dispose() {
        this._stopMonitoring();

        // 清理所有健康檢查
        for (const healthCheck of this.healthChecks.values()) {
            healthCheck.dispose();
        }

        this.healthChecks.clear();
        this.activeAlerts.clear();
        this.predictions.clear();

        this.removeAllListeners();
        console.log('[HealthMonitor] 已清理資源');
    }
}

// 導出常數和類
HealthMonitor.HEALTH_LEVELS = HEALTH_LEVELS;
HealthMonitor.MONITOR_CATEGORIES = MONITOR_CATEGORIES;
HealthMonitor.ALERT_LEVELS = ALERT_LEVELS;
HealthMonitor.HealthCheck = HealthCheck;

module.exports = HealthMonitor;