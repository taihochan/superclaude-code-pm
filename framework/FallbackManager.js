/**
 * FallbackManager - 多級降級策略管理器
 *
 * 功能：
 * - 多級降級策略定義和執行
 * - 優雅降級和功能縮減
 * - 降級條件監控和自動觸發
 * - 降級恢復和升級機制
 * - 降級狀態追踪和報告
 *
 * 用途：CCPM+SuperClaude整合的系統降級和容錯保障
 * 配合：ErrorHandler錯誤處理、CircuitBreaker熔斷、HealthMonitor監控
 */

import { EventEmitter } from 'events';

/**
 * 降級級別
 */
const DEGRADATION_LEVELS = {
    FULL: 'full',               // 完全功能
    HIGH: 'high',               // 高功能 (95-100%)
    MEDIUM: 'medium',           // 中等功能 (70-95%)
    LOW: 'low',                 // 低功能 (30-70%)
    MINIMAL: 'minimal',         // 最小功能 (10-30%)
    EMERGENCY: 'emergency'      // 緊急模式 (基本生存功能)
};

/**
 * 降級觸發條件
 */
const DEGRADATION_TRIGGERS = {
    ERROR_RATE: 'error_rate',           // 錯誤率
    RESPONSE_TIME: 'response_time',     // 響應時間
    RESOURCE_USAGE: 'resource_usage',   // 資源使用率
    DEPENDENCY_FAILURE: 'dependency',   // 依賴服務故障
    MANUAL: 'manual',                   // 手動觸發
    CIRCUIT_BREAK: 'circuit_break',     // 熔斷器觸發
    HEALTH_CHECK: 'health_check'        // 健康檢查失敗
};

/**
 * 降級策略類型
 */
const STRATEGY_TYPES = {
    FEATURE_TOGGLE: 'feature_toggle',   // 功能開關
    CACHE_FALLBACK: 'cache_fallback',   // 緩存降級
    SIMPLIFIED_LOGIC: 'simplified',     // 簡化邏輯
    STATIC_RESPONSE: 'static_response', // 靜態響應
    QUEUE_REJECTION: 'queue_rejection', // 請求拒絕
    LOAD_SHEDDING: 'load_shedding'     // 負載脫落
};

/**
 * 降級策略定義
 */
class DegradationStrategy {
    constructor(name, options = {}) {
        this.name = name;
        this.level = options.level || DEGRADATION_LEVELS.MEDIUM;
        this.type = options.type || STRATEGY_TYPES.FEATURE_TOGGLE;
        this.priority = options.priority || 0;

        // 觸發條件
        this.triggers = options.triggers || [];
        this.conditions = options.conditions || {};

        // 執行配置
        this.handler = options.handler || this._defaultHandler;
        this.rollbackHandler = options.rollbackHandler || this._defaultRollbackHandler;
        this.config = options.config || {};

        // 依賴關係
        this.dependencies = options.dependencies || [];
        this.affects = options.affects || [];

        // 恢復條件
        this.recoveryConditions = options.recoveryConditions || {};
        this.recoveryDelay = options.recoveryDelay || 30000; // 30秒

        // 狀態追踪
        this.active = false;
        this.activatedAt = null;
        this.activatedBy = null;
        this.activationCount = 0;
        this.successCount = 0;
        this.failureCount = 0;

        // 統計信息
        this.metrics = {
            totalActivations: 0,
            totalDuration: 0,
            averageDuration: 0,
            lastActivation: null,
            successRate: 0
        };
    }

    /**
     * 檢查是否應該激活
     * @param {Object} context 檢查上下文
     * @returns {Boolean} 是否應該激活
     */
    shouldActivate(context) {
        if (this.active) return false;

        // 檢查觸發條件
        for (const trigger of this.triggers) {
            if (this._evaluateTrigger(trigger, context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 檢查是否應該恢復
     * @param {Object} context 檢查上下文
     * @returns {Boolean} 是否應該恢復
     */
    shouldRecover(context) {
        if (!this.active) return false;

        // 檢查恢復延遲
        const now = Date.now();
        const activationTime = new Date(this.activatedAt).getTime();
        if (now - activationTime < this.recoveryDelay) {
            return false;
        }

        // 檢查恢復條件
        return this._evaluateRecoveryConditions(context);
    }

    /**
     * 激活降級策略
     * @param {Object} context 激活上下文
     * @returns {Promise<Object>} 激活結果
     */
    async activate(context = {}) {
        if (this.active) {
            return { success: false, reason: 'already_active' };
        }

        const startTime = Date.now();

        try {
            const result = await this.handler(context, this.config);

            if (result.success !== false) {
                this.active = true;
                this.activatedAt = new Date().toISOString();
                this.activatedBy = context.trigger || 'unknown';
                this.activationCount++;
                this.successCount++;

                this.metrics.totalActivations++;
                this.metrics.lastActivation = this.activatedAt;

                return {
                    success: true,
                    strategy: this.name,
                    level: this.level,
                    activatedAt: this.activatedAt,
                    result
                };
            } else {
                this.failureCount++;
                return result;
            }

        } catch (error) {
            this.failureCount++;
            return {
                success: false,
                error: error.message,
                strategy: this.name
            };

        } finally {
            const duration = Date.now() - startTime;
            this._updateMetrics(duration);
        }
    }

    /**
     * 恢復到正常狀態
     * @param {Object} context 恢復上下文
     * @returns {Promise<Object>} 恢復結果
     */
    async recover(context = {}) {
        if (!this.active) {
            return { success: false, reason: 'not_active' };
        }

        const startTime = Date.now();

        try {
            const result = await this.rollbackHandler(context, this.config);

            if (result.success !== false) {
                const activationDuration = startTime - new Date(this.activatedAt).getTime();
                this.active = false;
                this.activatedAt = null;
                this.activatedBy = null;

                this.metrics.totalDuration += activationDuration;
                this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.totalActivations;

                return {
                    success: true,
                    strategy: this.name,
                    level: this.level,
                    duration: activationDuration,
                    result
                };
            } else {
                return result;
            }

        } catch (error) {
            return {
                success: false,
                error: error.message,
                strategy: this.name
            };
        }
    }

    /**
     * 獲取策略狀態
     * @returns {Object} 策略狀態
     */
    getStatus() {
        return {
            name: this.name,
            level: this.level,
            type: this.type,
            active: this.active,
            activatedAt: this.activatedAt,
            activatedBy: this.activatedBy,
            activationCount: this.activationCount,
            successCount: this.successCount,
            failureCount: this.failureCount,
            successRate: this.activationCount > 0 ? this.successCount / this.activationCount : 0,
            metrics: { ...this.metrics }
        };
    }

    // ========== 私有方法 ==========

    /**
     * 評估觸發條件
     */
    _evaluateTrigger(trigger, context) {
        switch (trigger.type || trigger) {
            case DEGRADATION_TRIGGERS.ERROR_RATE:
                return context.errorRate >= (trigger.threshold || 0.1);

            case DEGRADATION_TRIGGERS.RESPONSE_TIME:
                return context.responseTime >= (trigger.threshold || 5000);

            case DEGRADATION_TRIGGERS.RESOURCE_USAGE:
                return context.resourceUsage >= (trigger.threshold || 0.8);

            case DEGRADATION_TRIGGERS.DEPENDENCY_FAILURE:
                return context.dependencyFailures && context.dependencyFailures.length > 0;

            case DEGRADATION_TRIGGERS.CIRCUIT_BREAK:
                return context.circuitOpen || false;

            case DEGRADATION_TRIGGERS.HEALTH_CHECK:
                return !context.healthy;

            case DEGRADATION_TRIGGERS.MANUAL:
                return context.manualTrigger === this.name;

            default:
                return false;
        }
    }

    /**
     * 評估恢復條件
     */
    _evaluateRecoveryConditions(context) {
        const conditions = this.recoveryConditions;

        if (Object.keys(conditions).length === 0) {
            // 默認恢復條件：所有觸發條件都不滿足
            return !this.triggers.some(trigger => this._evaluateTrigger(trigger, context));
        }

        // 檢查自定義恢復條件
        if (conditions.errorRate && context.errorRate >= conditions.errorRate) {
            return false;
        }

        if (conditions.responseTime && context.responseTime >= conditions.responseTime) {
            return false;
        }

        if (conditions.resourceUsage && context.resourceUsage >= conditions.resourceUsage) {
            return false;
        }

        if (conditions.dependencyHealth && !context.dependenciesHealthy) {
            return false;
        }

        return true;
    }

    /**
     * 默認處理器
     */
    async _defaultHandler(context, config) {
        return { success: true, action: 'feature_disabled', config };
    }

    /**
     * 默認回滾處理器
     */
    async _defaultRollbackHandler(context, config) {
        return { success: true, action: 'feature_enabled', config };
    }

    /**
     * 更新指標
     */
    _updateMetrics(duration) {
        if (this.metrics.totalActivations > 0) {
            this.metrics.successRate = this.successCount / this.activationCount;
        }
    }
}

/**
 * 降級計劃
 */
class DegradationPlan {
    constructor(name, options = {}) {
        this.name = name;
        this.description = options.description || '';
        this.strategies = new Map(); // level -> strategies[]
        this.currentLevel = DEGRADATION_LEVELS.FULL;
        this.targetLevel = DEGRADATION_LEVELS.FULL;

        // 級聯配置
        this.cascadeMode = options.cascadeMode || 'progressive'; // progressive, immediate, selective
        this.recoveryMode = options.recoveryMode || 'gradual'; // gradual, immediate

        // 狀態追踪
        this.activatedStrategies = new Set();
        this.degradationHistory = [];

        // 初始化降級級別
        this._initializeLevels();
    }

    /**
     * 添加降級策略
     * @param {DegradationStrategy} strategy 降級策略
     * @param {String} level 降級級別
     */
    addStrategy(strategy, level = DEGRADATION_LEVELS.MEDIUM) {
        if (!this.strategies.has(level)) {
            this.strategies.set(level, []);
        }

        this.strategies.get(level).push(strategy);

        // 按優先級排序
        this.strategies.get(level).sort((a, b) => b.priority - a.priority);
    }

    /**
     * 執行降級到指定級別
     * @param {String} targetLevel 目標降級級別
     * @param {Object} context 執行上下文
     * @returns {Promise<Object>} 執行結果
     */
    async degradeToLevel(targetLevel, context = {}) {
        if (!Object.values(DEGRADATION_LEVELS).includes(targetLevel)) {
            throw new Error(`未知的降級級別: ${targetLevel}`);
        }

        const currentLevel = this.currentLevel;
        this.targetLevel = targetLevel;

        const result = {
            success: true,
            plan: this.name,
            fromLevel: currentLevel,
            toLevel: targetLevel,
            activatedStrategies: [],
            failures: [],
            timestamp: new Date().toISOString()
        };

        try {
            // 獲取需要激活的策略
            const strategiesToActivate = this._getStrategiesToActivate(targetLevel);

            // 執行策略激活
            for (const strategy of strategiesToActivate) {
                try {
                    const activationResult = await strategy.activate({
                        ...context,
                        degradationLevel: targetLevel,
                        plan: this.name
                    });

                    if (activationResult.success) {
                        this.activatedStrategies.add(strategy.name);
                        result.activatedStrategies.push(strategy.name);
                    } else {
                        result.failures.push({
                            strategy: strategy.name,
                            error: activationResult.reason || activationResult.error
                        });
                    }

                } catch (error) {
                    result.failures.push({
                        strategy: strategy.name,
                        error: error.message
                    });
                }
            }

            // 更新當前級別
            this.currentLevel = targetLevel;

            // 記錄降級歷史
            this.degradationHistory.push({
                fromLevel: currentLevel,
                toLevel: targetLevel,
                timestamp: result.timestamp,
                strategiesActivated: result.activatedStrategies.length,
                failures: result.failures.length,
                trigger: context.trigger || 'unknown'
            });

            return result;

        } catch (error) {
            result.success = false;
            result.error = error.message;
            return result;
        }
    }

    /**
     * 恢復到更高級別
     * @param {String} targetLevel 目標恢復級別
     * @param {Object} context 恢復上下文
     * @returns {Promise<Object>} 恢復結果
     */
    async recoverToLevel(targetLevel, context = {}) {
        const currentLevel = this.currentLevel;

        // 檢查是否為有效的恢復
        if (this._getLevelPriority(targetLevel) <= this._getLevelPriority(currentLevel)) {
            return {
                success: false,
                reason: 'invalid_recovery_level',
                currentLevel,
                targetLevel
            };
        }

        this.targetLevel = targetLevel;

        const result = {
            success: true,
            plan: this.name,
            fromLevel: currentLevel,
            toLevel: targetLevel,
            recoveredStrategies: [],
            failures: [],
            timestamp: new Date().toISOString()
        };

        try {
            // 獲取需要恢復的策略
            const strategiesToRecover = this._getStrategiesToRecover(targetLevel);

            // 執行策略恢復
            for (const strategy of strategiesToRecover) {
                try {
                    const recoveryResult = await strategy.recover({
                        ...context,
                        recoveryLevel: targetLevel,
                        plan: this.name
                    });

                    if (recoveryResult.success) {
                        this.activatedStrategies.delete(strategy.name);
                        result.recoveredStrategies.push(strategy.name);
                    } else {
                        result.failures.push({
                            strategy: strategy.name,
                            error: recoveryResult.reason || recoveryResult.error
                        });
                    }

                } catch (error) {
                    result.failures.push({
                        strategy: strategy.name,
                        error: error.message
                    });
                }
            }

            // 更新當前級別
            this.currentLevel = targetLevel;

            // 記錄恢復歷史
            this.degradationHistory.push({
                fromLevel: currentLevel,
                toLevel: targetLevel,
                timestamp: result.timestamp,
                strategiesRecovered: result.recoveredStrategies.length,
                failures: result.failures.length,
                trigger: context.trigger || 'recovery'
            });

            return result;

        } catch (error) {
            result.success = false;
            result.error = error.message;
            return result;
        }
    }

    /**
     * 獲取計劃狀態
     * @returns {Object} 計劃狀態
     */
    getStatus() {
        const strategyStatuses = {};

        for (const [level, strategies] of this.strategies.entries()) {
            strategyStatuses[level] = strategies.map(s => s.getStatus());
        }

        return {
            name: this.name,
            currentLevel: this.currentLevel,
            targetLevel: this.targetLevel,
            activatedStrategies: Array.from(this.activatedStrategies),
            strategies: strategyStatuses,
            history: this.degradationHistory.slice(-20), // 最近20條記錄
            statistics: this._calculateStatistics()
        };
    }

    // ========== 私有方法 ==========

    /**
     * 初始化降級級別
     */
    _initializeLevels() {
        for (const level of Object.values(DEGRADATION_LEVELS)) {
            if (!this.strategies.has(level)) {
                this.strategies.set(level, []);
            }
        }
    }

    /**
     * 獲取需要激活的策略
     */
    _getStrategiesToActivate(targetLevel) {
        const strategies = [];
        const targetPriority = this._getLevelPriority(targetLevel);
        const currentPriority = this._getLevelPriority(this.currentLevel);

        // 收集所有需要激活的級別的策略
        for (const [level, levelStrategies] of this.strategies.entries()) {
            const levelPriority = this._getLevelPriority(level);

            if (levelPriority <= targetPriority && levelPriority < currentPriority) {
                strategies.push(...levelStrategies.filter(s => !s.active));
            }
        }

        // 按優先級排序
        strategies.sort((a, b) => b.priority - a.priority);

        return strategies;
    }

    /**
     * 獲取需要恢復的策略
     */
    _getStrategiesToRecover(targetLevel) {
        const strategies = [];
        const targetPriority = this._getLevelPriority(targetLevel);
        const currentPriority = this._getLevelPriority(this.currentLevel);

        // 收集所有需要恢復的級別的策略
        for (const [level, levelStrategies] of this.strategies.entries()) {
            const levelPriority = this._getLevelPriority(level);

            if (levelPriority < targetPriority && levelPriority <= currentPriority) {
                strategies.push(...levelStrategies.filter(s => s.active));
            }
        }

        // 按優先級逆序排序（先恢復高優先級）
        strategies.sort((a, b) => a.priority - b.priority);

        return strategies;
    }

    /**
     * 獲取級別優先級
     */
    _getLevelPriority(level) {
        const priorities = {
            [DEGRADATION_LEVELS.FULL]: 100,
            [DEGRADATION_LEVELS.HIGH]: 80,
            [DEGRADATION_LEVELS.MEDIUM]: 60,
            [DEGRADATION_LEVELS.LOW]: 40,
            [DEGRADATION_LEVELS.MINIMAL]: 20,
            [DEGRADATION_LEVELS.EMERGENCY]: 0
        };

        return priorities[level] || 50;
    }

    /**
     * 計算統計信息
     */
    _calculateStatistics() {
        const stats = {
            totalDegradations: 0,
            totalRecoveries: 0,
            averageDegradationDuration: 0,
            mostCommonLevel: null,
            levelDistribution: {}
        };

        // 統計歷史記錄
        let totalDuration = 0;
        const levelCounts = {};

        for (let i = 0; i < this.degradationHistory.length; i++) {
            const record = this.degradationHistory[i];
            const fromPriority = this._getLevelPriority(record.fromLevel);
            const toPriority = this._getLevelPriority(record.toLevel);

            if (toPriority < fromPriority) {
                stats.totalDegradations++;
            } else {
                stats.totalRecoveries++;
            }

            // 計算在該級別的持續時間
            const nextRecord = this.degradationHistory[i + 1];
            if (nextRecord) {
                const duration = new Date(nextRecord.timestamp).getTime() - new Date(record.timestamp).getTime();
                totalDuration += duration;
            }

            // 統計級別分佈
            levelCounts[record.toLevel] = (levelCounts[record.toLevel] || 0) + 1;
        }

        if (stats.totalDegradations > 0) {
            stats.averageDegradationDuration = totalDuration / stats.totalDegradations;
        }

        // 找出最常見的級別
        let maxCount = 0;
        for (const [level, count] of Object.entries(levelCounts)) {
            stats.levelDistribution[level] = count;
            if (count > maxCount) {
                maxCount = count;
                stats.mostCommonLevel = level;
            }
        }

        return stats;
    }
}

/**
 * 降級管理器主類
 */
class FallbackManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(1000);

        this.options = {
            // 自動降級配置
            enableAutoDegradation: options.enableAutoDegradation !== false,
            autoRecovery: options.autoRecovery !== false,
            monitoringInterval: options.monitoringInterval || 10000, // 10秒

            // 降級閾值
            defaultThresholds: {
                errorRate: 0.1,
                responseTime: 5000,
                resourceUsage: 0.8,
                ...options.defaultThresholds
            },

            // 恢復配置
            recoveryDelay: options.recoveryDelay || 30000,
            recoveryVerificationPeriod: options.recoveryVerificationPeriod || 60000,

            ...options
        };

        // 降級計劃
        this.plans = new Map();
        this.strategies = new Map();

        // 全局狀態
        this.globalDegradationLevel = DEGRADATION_LEVELS.FULL;
        this.monitoringActive = false;
        this.monitoringTimer = null;

        // 統計信息
        this.stats = {
            totalPlans: 0,
            totalStrategies: 0,
            activePlans: 0,
            activeStrategies: 0,
            totalDegradations: 0,
            totalRecoveries: 0,
            lastUpdate: new Date().toISOString()
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化降級管理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 啟動監控
            if (this.options.enableAutoDegradation) {
                this._startMonitoring();
            }

            this.initialized = true;
            this.emit('initialized');

            console.log('[FallbackManager] 降級管理器已初始化');

        } catch (error) {
            console.error('[FallbackManager] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 創建降級計劃
     * @param {String} name 計劃名稱
     * @param {Object} options 計劃選項
     * @returns {DegradationPlan} 降級計劃
     */
    createPlan(name, options = {}) {
        if (this.plans.has(name)) {
            return this.plans.get(name);
        }

        const plan = new DegradationPlan(name, options);
        this.plans.set(name, plan);
        this.stats.totalPlans++;

        this.emit('planCreated', name, options);
        return plan;
    }

    /**
     * 註冊降級策略
     * @param {String} name 策略名稱
     * @param {Object} options 策略選項
     * @returns {DegradationStrategy} 降級策略
     */
    registerStrategy(name, options = {}) {
        if (this.strategies.has(name)) {
            return this.strategies.get(name);
        }

        const strategy = new DegradationStrategy(name, options);
        this.strategies.set(name, strategy);
        this.stats.totalStrategies++;

        this.emit('strategyRegistered', name, options);
        return strategy;
    }

    /**
     * 執行降級
     * @param {String} planName 計劃名稱
     * @param {String} level 降級級別
     * @param {Object} context 執行上下文
     * @returns {Promise<Object>} 執行結果
     */
    async degrade(planName, level, context = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const plan = this.plans.get(planName);
        if (!plan) {
            throw new Error(`未找到降級計劃: ${planName}`);
        }

        try {
            const result = await plan.degradeToLevel(level, {
                ...context,
                manager: this,
                timestamp: new Date().toISOString()
            });

            if (result.success) {
                this.stats.totalDegradations++;
                this._updateGlobalLevel();

                this.emit('degradationExecuted', {
                    plan: planName,
                    level,
                    result
                });
            }

            return result;

        } catch (error) {
            this.emit('degradationFailed', {
                plan: planName,
                level,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 執行恢復
     * @param {String} planName 計劃名稱
     * @param {String} level 恢復級別
     * @param {Object} context 恢復上下文
     * @returns {Promise<Object>} 恢復結果
     */
    async recover(planName, level, context = {}) {
        const plan = this.plans.get(planName);
        if (!plan) {
            throw new Error(`未找到降級計劃: ${planName}`);
        }

        try {
            const result = await plan.recoverToLevel(level, {
                ...context,
                manager: this,
                timestamp: new Date().toISOString()
            });

            if (result.success) {
                this.stats.totalRecoveries++;
                this._updateGlobalLevel();

                this.emit('recoveryExecuted', {
                    plan: planName,
                    level,
                    result
                });
            }

            return result;

        } catch (error) {
            this.emit('recoveryFailed', {
                plan: planName,
                level,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 自動降級檢查
     * @param {Object} systemMetrics 系統指標
     * @returns {Promise<Array>} 執行結果列表
     */
    async checkAutoDegradation(systemMetrics = {}) {
        const results = [];

        for (const [planName, plan] of this.plans.entries()) {
            try {
                const planResult = await this._checkPlanDegradation(plan, systemMetrics);
                if (planResult) {
                    results.push(planResult);
                }
            } catch (error) {
                results.push({
                    plan: planName,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 獲取系統狀態
     * @returns {Object} 系統狀態
     */
    getSystemStatus() {
        this._updateStats();

        const status = {
            globalLevel: this.globalDegradationLevel,
            monitoring: this.monitoringActive,
            stats: { ...this.stats },
            plans: {},
            strategies: {},
            timestamp: new Date().toISOString()
        };

        // 獲取計劃狀態
        for (const [name, plan] of this.plans.entries()) {
            status.plans[name] = plan.getStatus();
        }

        // 獲取策略狀態
        for (const [name, strategy] of this.strategies.entries()) {
            status.strategies[name] = strategy.getStatus();
        }

        return status;
    }

    /**
     * 獲取健康報告
     * @returns {Object} 健康報告
     */
    getHealthReport() {
        const report = {
            overall: {
                healthy: this.globalDegradationLevel === DEGRADATION_LEVELS.FULL,
                degradationLevel: this.globalDegradationLevel,
                activePlans: this.stats.activePlans,
                activeStrategies: this.stats.activeStrategies
            },
            plans: {},
            degradationHistory: [],
            recommendations: []
        };

        // 收集計劃健康狀態
        for (const [name, plan] of this.plans.entries()) {
            const planStatus = plan.getStatus();
            report.plans[name] = {
                currentLevel: planStatus.currentLevel,
                activeStrategies: planStatus.activatedStrategies.length,
                healthy: planStatus.currentLevel === DEGRADATION_LEVELS.FULL
            };

            // 收集歷史
            report.degradationHistory = report.degradationHistory.concat(
                planStatus.history.map(h => ({
                    plan: name,
                    ...h
                }))
            );
        }

        // 生成建議
        report.recommendations = this._generateRecommendations();

        return report;
    }

    /**
     * 重置所有降級
     * @returns {Promise<Object>} 重置結果
     */
    async resetAll() {
        const results = {
            success: true,
            plans: [],
            failures: []
        };

        for (const [planName, plan] of this.plans.entries()) {
            try {
                const result = await plan.recoverToLevel(DEGRADATION_LEVELS.FULL, {
                    trigger: 'reset_all',
                    timestamp: new Date().toISOString()
                });

                results.plans.push({
                    name: planName,
                    success: result.success,
                    recoveredStrategies: result.recoveredStrategies
                });

                if (!result.success) {
                    results.failures.push(...(result.failures || []));
                }

            } catch (error) {
                results.failures.push({
                    plan: planName,
                    error: error.message
                });
                results.success = false;
            }
        }

        this._updateGlobalLevel();
        return results;
    }

    // ========== 私有方法 ==========

    /**
     * 啟動監控
     */
    _startMonitoring() {
        if (this.monitoringActive) return;

        this.monitoringActive = true;
        this.monitoringTimer = setInterval(async () => {
            try {
                await this._performMonitoringCheck();
            } catch (error) {
                this.emit('monitoringError', error);
            }
        }, this.options.monitoringInterval);

        this.emit('monitoringStarted');
    }

    /**
     * 停止監控
     */
    _stopMonitoring() {
        if (!this.monitoringActive) return;

        this.monitoringActive = false;
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        this.emit('monitoringStopped');
    }

    /**
     * 執行監控檢查
     */
    async _performMonitoringCheck() {
        // 這裡應該收集系統指標
        const systemMetrics = await this._collectSystemMetrics();

        // 執行自動降級檢查
        const results = await this.checkAutoDegradation(systemMetrics);

        if (results.length > 0) {
            this.emit('autoActionsExecuted', results);
        }
    }

    /**
     * 收集系統指標
     */
    async _collectSystemMetrics() {
        // 基本系統指標
        const metrics = {
            timestamp: new Date().toISOString(),
            errorRate: 0,
            responseTime: 0,
            resourceUsage: 0,
            dependenciesHealthy: true,
            circuitOpen: false,
            healthy: true
        };

        // 這裡應該從其他組件收集實際指標
        // 暫時返回模擬數據

        return metrics;
    }

    /**
     * 檢查計劃降級
     */
    async _checkPlanDegradation(plan, metrics) {
        const planStatus = plan.getStatus();
        const currentLevel = planStatus.currentLevel;

        // 檢查是否需要降級
        for (const [level, strategies] of plan.strategies.entries()) {
            if (this._getLevelPriority(level) < this._getLevelPriority(currentLevel)) {
                for (const strategy of strategies) {
                    if (strategy.shouldActivate(metrics)) {
                        return await plan.degradeToLevel(level, {
                            ...metrics,
                            trigger: 'auto_degradation',
                            strategy: strategy.name
                        });
                    }
                }
            }
        }

        // 檢查是否可以恢復
        if (currentLevel !== DEGRADATION_LEVELS.FULL) {
            for (const strategy of planStatus.activatedStrategies) {
                const strategyObj = this.strategies.get(strategy);
                if (strategyObj && strategyObj.shouldRecover(metrics)) {
                    // 嘗試恢復到更高級別
                    const higherLevel = this._getNextHigherLevel(currentLevel);
                    if (higherLevel) {
                        return await plan.recoverToLevel(higherLevel, {
                            ...metrics,
                            trigger: 'auto_recovery',
                            strategy: strategy
                        });
                    }
                }
            }
        }

        return null;
    }

    /**
     * 更新全局級別
     */
    _updateGlobalLevel() {
        let lowestLevel = DEGRADATION_LEVELS.FULL;
        let lowestPriority = 100;

        for (const plan of this.plans.values()) {
            const priority = this._getLevelPriority(plan.currentLevel);
            if (priority < lowestPriority) {
                lowestPriority = priority;
                lowestLevel = plan.currentLevel;
            }
        }

        if (this.globalDegradationLevel !== lowestLevel) {
            const oldLevel = this.globalDegradationLevel;
            this.globalDegradationLevel = lowestLevel;

            this.emit('globalLevelChanged', {
                from: oldLevel,
                to: lowestLevel,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 更新統計信息
     */
    _updateStats() {
        let activePlans = 0;
        let activeStrategies = 0;

        for (const plan of this.plans.values()) {
            if (plan.currentLevel !== DEGRADATION_LEVELS.FULL) {
                activePlans++;
            }
            activeStrategies += plan.activatedStrategies.size;
        }

        this.stats.activePlans = activePlans;
        this.stats.activeStrategies = activeStrategies;
        this.stats.lastUpdate = new Date().toISOString();
    }

    /**
     * 獲取級別優先級
     */
    _getLevelPriority(level) {
        const priorities = {
            [DEGRADATION_LEVELS.FULL]: 100,
            [DEGRADATION_LEVELS.HIGH]: 80,
            [DEGRADATION_LEVELS.MEDIUM]: 60,
            [DEGRADATION_LEVELS.LOW]: 40,
            [DEGRADATION_LEVELS.MINIMAL]: 20,
            [DEGRADATION_LEVELS.EMERGENCY]: 0
        };

        return priorities[level] || 50;
    }

    /**
     * 獲取下一個更高級別
     */
    _getNextHigherLevel(currentLevel) {
        const levels = [
            DEGRADATION_LEVELS.EMERGENCY,
            DEGRADATION_LEVELS.MINIMAL,
            DEGRADATION_LEVELS.LOW,
            DEGRADATION_LEVELS.MEDIUM,
            DEGRADATION_LEVELS.HIGH,
            DEGRADATION_LEVELS.FULL
        ];

        const currentIndex = levels.indexOf(currentLevel);
        if (currentIndex >= 0 && currentIndex < levels.length - 1) {
            return levels[currentIndex + 1];
        }

        return null;
    }

    /**
     * 生成建議
     */
    _generateRecommendations() {
        const recommendations = [];

        // 分析降級頻率
        let totalDegradations = 0;
        for (const plan of this.plans.values()) {
            const stats = plan.getStatus().statistics;
            totalDegradations += stats.totalDegradations;
        }

        if (totalDegradations > 10) {
            recommendations.push({
                type: 'frequent_degradations',
                message: '系統降級過於頻繁，建議檢查系統穩定性',
                priority: 'high'
            });
        }

        if (this.globalDegradationLevel !== DEGRADATION_LEVELS.FULL) {
            recommendations.push({
                type: 'degraded_state',
                message: '系統處於降級狀態，建議檢查恢復條件',
                priority: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * 清理資源
     */
    async dispose() {
        this._stopMonitoring();

        // 清理所有計劃和策略
        this.plans.clear();
        this.strategies.clear();

        this.removeAllListeners();
        console.log('[FallbackManager] 已清理資源');
    }
}

// 導出常數和類
FallbackManager.DEGRADATION_LEVELS = DEGRADATION_LEVELS;
FallbackManager.DEGRADATION_TRIGGERS = DEGRADATION_TRIGGERS;
FallbackManager.STRATEGY_TYPES = STRATEGY_TYPES;
FallbackManager.DegradationStrategy = DegradationStrategy;
FallbackManager.DegradationPlan = DegradationPlan;

export default FallbackManager;