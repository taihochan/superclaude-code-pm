/**
 * ReliabilityManager - 錯誤處理和降級系統整合管理器
 *
 * 功能：
 * - 統一管理ErrorHandler、CircuitBreaker、FallbackManager、HealthMonitor
 * - 與EventBus和StateSynchronizer深度整合
 * - 提供統一的可靠性保證API
 * - 實現系統可用性>99.9%和故障恢復<30秒
 * - 錯誤處理策略協調和自動恢復
 *
 * 用途：CCPM+SuperClaude整合的核心可靠性保證系統
 * 配合：EventBus事件通信、StateSynchronizer狀態恢復
 */

const { EventEmitter } = require('events');
const ErrorHandler = require('./ErrorHandler');
const CircuitBreaker = require('./CircuitBreaker');
const FallbackManager = require('./FallbackManager');
const HealthMonitor = require('./HealthMonitor');

/**
 * 可靠性等級
 */
const RELIABILITY_LEVELS = {
    HIGH: 'high',           // 高可靠性 (99.9%+)
    MEDIUM: 'medium',       // 中等可靠性 (99.5-99.9%)
    LOW: 'low',            // 低可靠性 (95-99.5%)
    CRITICAL: 'critical'   // 危急狀態 (<95%)
};

/**
 * 系統模式
 */
const SYSTEM_MODES = {
    NORMAL: 'normal',           // 正常運行
    DEGRADED: 'degraded',      // 降級運行
    EMERGENCY: 'emergency',     // 緊急模式
    MAINTENANCE: 'maintenance'  // 維護模式
};

/**
 * 恢復策略
 */
const RECOVERY_STRATEGIES = {
    IMMEDIATE: 'immediate',     // 立即恢復
    GRADUAL: 'gradual',        // 漸進恢復
    MANUAL: 'manual',          // 手動恢復
    SCHEDULED: 'scheduled'     // 計劃恢復
};

/**
 * 可靠性管理器主類
 */
class ReliabilityManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.setMaxListeners(1000);

        this.options = {
            // 可靠性目標
            targetAvailability: options.targetAvailability || 0.999, // 99.9%
            maxRecoveryTime: options.maxRecoveryTime || 30000, // 30秒

            // 系統配置
            systemMode: options.systemMode || SYSTEM_MODES.NORMAL,
            reliabilityLevel: options.reliabilityLevel || RELIABILITY_LEVELS.HIGH,
            recoveryStrategy: options.recoveryStrategy || RECOVERY_STRATEGIES.GRADUAL,

            // 整合配置
            enableEventBusIntegration: options.enableEventBusIntegration !== false,
            enableStateSyncIntegration: options.enableStateSyncIntegration !== false,
            enableAutoRecovery: options.enableAutoRecovery !== false,

            // 監控配置
            monitoringInterval: options.monitoringInterval || 10000, // 10秒
            healthCheckInterval: options.healthCheckInterval || 30000, // 30秒
            reportInterval: options.reportInterval || 300000, // 5分鐘

            ...options
        };

        // 核心組件
        this.errorHandler = null;
        this.circuitBreaker = null;
        this.fallbackManager = null;
        this.healthMonitor = null;

        // 外部整合
        this.eventBus = null;
        this.stateSynchronizer = null;

        // 系統狀態
        this.systemStatus = {
            mode: this.options.systemMode,
            reliabilityLevel: this.options.reliabilityLevel,
            availability: 1.0,
            isHealthy: true,
            lastIncident: null,
            recoveryInProgress: false,
            startTime: new Date().toISOString()
        };

        // 可靠性指標
        this.reliabilityMetrics = {
            uptime: 0,
            downtime: 0,
            totalIncidents: 0,
            resolvedIncidents: 0,
            averageRecoveryTime: 0,
            currentAvailability: 1.0,
            reliabilityScore: 100,
            lastCalculation: new Date().toISOString()
        };

        // 恢復管理
        this.activeIncidents = new Map();
        this.recoveryProcedures = new Map();
        this.incidentHistory = [];

        // 監控定時器
        this.monitoringTimer = null;
        this.metricsTimer = null;

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化可靠性管理器
     * @param {Object} integrations 外部整合組件
     * @returns {Promise<void>}
     */
    async initialize(integrations = {}) {
        if (this.initialized) return;

        try {
            console.log('[ReliabilityManager] 開始初始化可靠性管理器...');

            // 設置外部整合
            this.eventBus = integrations.eventBus;
            this.stateSynchronizer = integrations.stateSynchronizer;

            // 初始化核心組件
            await this._initializeCoreComponents();

            // 設置組件間的整合
            await this._setupComponentIntegration();

            // 設置外部系統整合
            if (this.options.enableEventBusIntegration && this.eventBus) {
                await this._setupEventBusIntegration();
            }

            if (this.options.enableStateSyncIntegration && this.stateSynchronizer) {
                await this._setupStateSyncIntegration();
            }

            // 註冊默認恢復策略
            this._registerDefaultRecoveryProcedures();

            // 啟動監控
            this._startReliabilityMonitoring();

            this.initialized = true;
            this.systemStatus.isHealthy = true;

            this.emit('initialized', {
                components: ['ErrorHandler', 'CircuitBreaker', 'FallbackManager', 'HealthMonitor'],
                integrations: {
                    eventBus: !!this.eventBus,
                    stateSynchronizer: !!this.stateSynchronizer
                },
                targets: {
                    availability: this.options.targetAvailability,
                    recoveryTime: this.options.maxRecoveryTime
                }
            });

            console.log('[ReliabilityManager] 可靠性管理器初始化完成');

        } catch (error) {
            console.error('[ReliabilityManager] 初始化失敗:', error);
            this.systemStatus.isHealthy = false;
            throw error;
        }
    }

    /**
     * 處理系統錯誤
     * @param {Error|Object} error 錯誤對象
     * @param {Object} context 錯誤上下文
     * @returns {Promise<Object>} 處理結果
     */
    async handleError(error, context = {}) {
        const startTime = Date.now();

        try {
            // 通過ErrorHandler處理錯誤
            const errorResult = await this.errorHandler.handle(error, {
                ...context,
                timestamp: new Date().toISOString(),
                systemMode: this.systemStatus.mode
            });

            // 檢查是否需要觸發熔斷
            const shouldTriggerCircuitBreaker = this._shouldTriggerCircuitBreaker(error, errorResult);
            if (shouldTriggerCircuitBreaker) {
                const circuitName = context.component || context.service || 'default';
                const circuit = this.circuitBreaker.getCircuit(circuitName);

                if (circuit.state === CircuitBreaker.CIRCUIT_STATES.CLOSED) {
                    circuit.trip(`錯誤觸發: ${error.message}`);

                    // 觸發降級
                    await this._triggerDegradation(error, context);
                }
            }

            // 更新可靠性指標
            this._updateReliabilityMetrics(errorResult, Date.now() - startTime);

            // 檢查是否需要啟動恢復程序
            if (this.options.enableAutoRecovery) {
                await this._checkAutoRecovery(error, errorResult, context);
            }

            return {
                success: errorResult.success,
                error: errorResult.error,
                recovery: errorResult.recovery,
                circuitBroken: shouldTriggerCircuitBreaker,
                reliabilityImpact: this._assessReliabilityImpact(error, errorResult),
                timestamp: new Date().toISOString()
            };

        } catch (handlingError) {
            console.error('[ReliabilityManager] 錯誤處理失敗:', handlingError);

            // 緊急處理
            return await this._emergencyErrorHandling(error, handlingError, context);
        }
    }

    /**
     * 執行被保護的操作
     * @param {String} operationName 操作名稱
     * @param {Function} operation 操作函數
     * @param {Object} options 選項
     * @returns {Promise<any>} 操作結果
     */
    async executeProtected(operationName, operation, options = {}) {
        const startTime = Date.now();

        try {
            // 通過熔斷器執行
            const result = await this.circuitBreaker.execute(
                operationName,
                operation,
                {
                    context: {
                        operationName,
                        timestamp: new Date().toISOString(),
                        ...options.context
                    },
                    circuitConfig: options.circuitConfig
                }
            );

            // 記錄成功操作
            this._recordOperationSuccess(operationName, Date.now() - startTime);

            return result;

        } catch (error) {
            // 記錄失敗操作
            this._recordOperationFailure(operationName, error, Date.now() - startTime);

            // 嘗試降級處理
            if (options.enableFallback !== false) {
                const fallbackResult = await this._attemptFallback(operationName, error, options);
                if (fallbackResult.success) {
                    return fallbackResult.result;
                }
            }

            // 重新拋出錯誤以便上層處理
            throw error;
        }
    }

    /**
     * 觸發系統降級
     * @param {String} level 降級級別
     * @param {Object} context 降級上下文
     * @returns {Promise<Object>} 降級結果
     */
    async degradeSystem(level, context = {}) {
        try {
            const degradationResult = await this.fallbackManager.degrade(
                'system_degradation_plan',
                level,
                {
                    ...context,
                    trigger: 'manual_degradation',
                    timestamp: new Date().toISOString(),
                    systemMode: this.systemStatus.mode
                }
            );

            if (degradationResult.success) {
                this.systemStatus.mode = SYSTEM_MODES.DEGRADED;
                this.systemStatus.reliabilityLevel = this._getLevelFromDegradation(level);

                // 通知外部系統
                if (this.eventBus) {
                    await this.eventBus.publish('system.degraded', {
                        level,
                        result: degradationResult,
                        timestamp: new Date().toISOString()
                    });
                }

                this.emit('systemDegraded', {
                    level,
                    result: degradationResult,
                    newMode: this.systemStatus.mode
                });
            }

            return degradationResult;

        } catch (error) {
            console.error('[ReliabilityManager] 系統降級失敗:', error);
            throw error;
        }
    }

    /**
     * 恢復系統到正常狀態
     * @param {Object} options 恢復選項
     * @returns {Promise<Object>} 恢復結果
     */
    async recoverSystem(options = {}) {
        const recoveryId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.systemStatus.recoveryInProgress = true;

            const recoveryResult = {
                id: recoveryId,
                startTime: new Date().toISOString(),
                success: true,
                steps: [],
                errors: []
            };

            // 步驟1: 恢復降級策略
            try {
                const fallbackResult = await this.fallbackManager.resetAll();
                recoveryResult.steps.push({
                    step: 'fallback_recovery',
                    success: fallbackResult.success,
                    result: fallbackResult
                });
            } catch (error) {
                recoveryResult.errors.push({
                    step: 'fallback_recovery',
                    error: error.message
                });
            }

            // 步驟2: 重置熔斷器
            try {
                this.circuitBreaker.resetAll();
                recoveryResult.steps.push({
                    step: 'circuit_breaker_reset',
                    success: true
                });
            } catch (error) {
                recoveryResult.errors.push({
                    step: 'circuit_breaker_reset',
                    error: error.message
                });
            }

            // 步驟3: 清理錯誤歷史
            try {
                await this.errorHandler.clearHistory({ olderThan: 300000 }); // 5分鐘前的錯誤
                recoveryResult.steps.push({
                    step: 'error_history_cleanup',
                    success: true
                });
            } catch (error) {
                recoveryResult.errors.push({
                    step: 'error_history_cleanup',
                    error: error.message
                });
            }

            // 步驟4: 執行健康檢查
            try {
                const healthResult = await this.healthMonitor.performFullHealthCheck();
                const isHealthy = healthResult.overall.healthy;

                recoveryResult.steps.push({
                    step: 'health_check',
                    success: isHealthy,
                    result: healthResult
                });

                if (isHealthy) {
                    this.systemStatus.mode = SYSTEM_MODES.NORMAL;
                    this.systemStatus.reliabilityLevel = RELIABILITY_LEVELS.HIGH;
                    this.systemStatus.isHealthy = true;
                }

            } catch (error) {
                recoveryResult.errors.push({
                    step: 'health_check',
                    error: error.message
                });
            }

            // 步驟5: 同步狀態
            if (this.stateSynchronizer) {
                try {
                    const syncResult = await this.stateSynchronizer.forceSync({
                        trigger: 'system_recovery',
                        recoveryId
                    });

                    recoveryResult.steps.push({
                        step: 'state_synchronization',
                        success: syncResult.successful > 0,
                        result: syncResult
                    });

                } catch (error) {
                    recoveryResult.errors.push({
                        step: 'state_synchronization',
                        error: error.message
                    });
                }
            }

            recoveryResult.endTime = new Date().toISOString();
            recoveryResult.duration = Date.now() - new Date(recoveryResult.startTime).getTime();
            recoveryResult.success = recoveryResult.errors.length === 0;

            // 更新恢復指標
            this._updateRecoveryMetrics(recoveryResult);

            // 通知系統恢復完成
            if (this.eventBus) {
                await this.eventBus.publish('system.recovered', recoveryResult);
            }

            this.emit('systemRecovered', recoveryResult);

            return recoveryResult;

        } catch (error) {
            console.error('[ReliabilityManager] 系統恢復失敗:', error);
            throw error;

        } finally {
            this.systemStatus.recoveryInProgress = false;
        }
    }

    /**
     * 獲取系統可靠性報告
     * @param {Object} options 報告選項
     * @returns {Object} 可靠性報告
     */
    getReliabilityReport(options = {}) {
        this._calculateReliabilityMetrics();

        return {
            summary: {
                availability: this.reliabilityMetrics.currentAvailability,
                reliabilityScore: this.reliabilityMetrics.reliabilityScore,
                systemMode: this.systemStatus.mode,
                reliabilityLevel: this.systemStatus.reliabilityLevel,
                isHealthy: this.systemStatus.isHealthy,
                recoveryInProgress: this.systemStatus.recoveryInProgress
            },
            metrics: { ...this.reliabilityMetrics },
            status: { ...this.systemStatus },
            components: {
                errorHandler: this.errorHandler ? this.errorHandler.getStats() : null,
                circuitBreaker: this.circuitBreaker ? this.circuitBreaker.getStats() : null,
                fallbackManager: this.fallbackManager ? this.fallbackManager.getSystemStatus() : null,
                healthMonitor: this.healthMonitor ? this.healthMonitor.getSystemHealth() : null
            },
            incidents: {
                active: Array.from(this.activeIncidents.values()),
                recent: this.incidentHistory.slice(-10)
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 獲取系統健康狀況
     * @returns {Object} 健康狀況
     */
    getSystemHealth() {
        if (!this.healthMonitor) {
            return {
                healthy: this.systemStatus.isHealthy,
                score: this.systemStatus.isHealthy ? 100 : 0,
                components: {}
            };
        }

        const health = this.healthMonitor.getSystemHealth();

        return {
            ...health,
            reliability: {
                availability: this.reliabilityMetrics.currentAvailability,
                score: this.reliabilityMetrics.reliabilityScore,
                level: this.systemStatus.reliabilityLevel,
                mode: this.systemStatus.mode
            }
        };
    }

    // ========== 私有方法 ==========

    /**
     * 初始化核心組件
     */
    async _initializeCoreComponents() {
        console.log('[ReliabilityManager] 初始化核心組件...');

        // 初始化ErrorHandler
        this.errorHandler = new ErrorHandler({
            enableDeduplication: true,
            enableAggregation: true,
            autoRecovery: this.options.enableAutoRecovery,
            alertThresholds: {
                critical: 1,
                high: 3,
                medium: 10,
                low: 50
            }
        });
        await this.errorHandler.initialize();

        // 初始化CircuitBreaker
        this.circuitBreaker = new CircuitBreaker({
            defaultConfig: {
                failureThreshold: 0.5,
                responseTimeThreshold: 5000,
                minimumRequests: 10,
                recoveryTimeout: 30000,
                halfOpenRequests: 3
            },
            maxCircuits: 100,
            enableMetrics: true,
            enableEvents: true
        });
        await this.circuitBreaker.initialize();

        // 初始化FallbackManager
        this.fallbackManager = new FallbackManager({
            enableAutoDegradation: true,
            autoRecovery: this.options.enableAutoRecovery,
            monitoringInterval: 10000,
            defaultThresholds: {
                errorRate: 0.1,
                responseTime: 5000,
                resourceUsage: 0.8
            }
        });
        await this.fallbackManager.initialize();

        // 初始化HealthMonitor
        this.healthMonitor = new HealthMonitor({
            enableMonitoring: true,
            globalInterval: this.options.healthCheckInterval,
            reportInterval: this.options.reportInterval,
            alertThresholds: {
                warning: 70,
                error: 50,
                critical: 30
            },
            enablePersistence: true
        });
        await this.healthMonitor.initialize();
    }

    /**
     * 設置組件間整合
     */
    async _setupComponentIntegration() {
        console.log('[ReliabilityManager] 設置組件間整合...');

        // ErrorHandler與HealthMonitor整合
        this.errorHandler.on('error', (error, recovery) => {
            // 錯誤事件觸發健康檢查更新
            this.healthMonitor.emit('errorOccurred', {
                error,
                recovery,
                timestamp: new Date().toISOString()
            });
        });

        // CircuitBreaker與FallbackManager整合
        this.circuitBreaker.on('circuitStateChanged', async (name, change) => {
            if (change.to === CircuitBreaker.CIRCUIT_STATES.OPEN) {
                // 熔斷器開啟時觸發降級
                await this._triggerDegradation(
                    new Error(`熔斷器開啟: ${name}`),
                    { component: name, trigger: 'circuit_break' }
                );
            }
        });

        // HealthMonitor與FallbackManager整合
        this.healthMonitor.on('alert', async (alert) => {
            if (alert.level === HealthMonitor.ALERT_LEVELS.CRITICAL) {
                // 嚴重健康告警觸發系統降級
                await this._triggerDegradation(
                    new Error(`健康告警: ${alert.message}`),
                    { trigger: 'health_alert', alert }
                );
            }
        });

        // 設置跨組件恢復策略
        this.fallbackManager.on('degradationExecuted', (event) => {
            this._recordIncident({
                type: 'degradation',
                details: event,
                timestamp: new Date().toISOString()
            });
        });

        this.fallbackManager.on('recoveryExecuted', (event) => {
            this._resolveIncident({
                type: 'recovery',
                details: event,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * 設置EventBus整合
     */
    async _setupEventBusIntegration() {
        console.log('[ReliabilityManager] 設置EventBus整合...');

        // 監聽系統事件
        this.eventBus.subscribe('system.error', async (event) => {
            await this.handleError(event.data.error, event.data.context);
        });

        this.eventBus.subscribe('system.degradation_request', async (event) => {
            await this.degradeSystem(event.data.level, event.data.context);
        });

        this.eventBus.subscribe('system.recovery_request', async (event) => {
            await this.recoverSystem(event.data.options);
        });

        // 發布可靠性事件
        this.on('systemDegraded', async (data) => {
            await this.eventBus.publish('reliability.system_degraded', data);
        });

        this.on('systemRecovered', async (data) => {
            await this.eventBus.publish('reliability.system_recovered', data);
        });

        this.on('incidentResolved', async (data) => {
            await this.eventBus.publish('reliability.incident_resolved', data);
        });
    }

    /**
     * 設置StateSynchronizer整合
     */
    async _setupStateSyncIntegration() {
        console.log('[ReliabilityManager] 設置StateSynchronizer整合...');

        // 監聽同步事件
        this.stateSynchronizer.on('syncFailed', async (result) => {
            await this.handleError(
                new Error(`狀態同步失敗: ${result.error}`),
                { component: 'StateSynchronizer', operation: 'sync' }
            );
        });

        this.stateSynchronizer.on('conflictsDetected', async (conflicts) => {
            // 狀態衝突可能需要降級處理
            if (conflicts.length > 5) {
                await this._triggerDegradation(
                    new Error(`檢測到大量狀態衝突: ${conflicts.length}`),
                    { trigger: 'state_conflicts', conflicts }
                );
            }
        });

        // 在系統恢復時執行狀態同步
        this.on('systemRecovered', async () => {
            try {
                await this.stateSynchronizer.forceSync({
                    trigger: 'post_recovery'
                });
            } catch (error) {
                console.error('[ReliabilityManager] 恢復後狀態同步失敗:', error);
            }
        });
    }

    /**
     * 註冊默認恢復程序
     */
    _registerDefaultRecoveryProcedures() {
        // 網路錯誤恢復程序
        this.recoveryProcedures.set('network_error', async (context) => {
            return {
                success: true,
                actions: ['retry_with_backoff', 'check_connectivity'],
                recoveryTime: 5000
            };
        });

        // 資源耗盡恢復程序
        this.recoveryProcedures.set('resource_exhaustion', async (context) => {
            return {
                success: true,
                actions: ['garbage_collect', 'reduce_load', 'scale_resources'],
                recoveryTime: 10000
            };
        });

        // 依賴服務故障恢復程序
        this.recoveryProcedures.set('dependency_failure', async (context) => {
            return {
                success: true,
                actions: ['enable_fallback', 'cache_responses', 'notify_admin'],
                recoveryTime: 15000
            };
        });
    }

    /**
     * 啟動可靠性監控
     */
    _startReliabilityMonitoring() {
        // 主監控循環
        this.monitoringTimer = setInterval(async () => {
            try {
                await this._performReliabilityCheck();
            } catch (error) {
                console.error('[ReliabilityManager] 可靠性檢查失敗:', error);
            }
        }, this.options.monitoringInterval);

        // 指標計算循環
        this.metricsTimer = setInterval(() => {
            this._calculateReliabilityMetrics();
        }, 60000); // 每分鐘計算一次

        console.log('[ReliabilityManager] 可靠性監控已啟動');
    }

    /**
     * 停止可靠性監控
     */
    _stopReliabilityMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }

        console.log('[ReliabilityManager] 可靠性監控已停止');
    }

    /**
     * 執行可靠性檢查
     */
    async _performReliabilityCheck() {
        // 檢查系統健康狀況
        const health = this.getSystemHealth();

        // 檢查可用性目標
        if (this.reliabilityMetrics.currentAvailability < this.options.targetAvailability) {
            console.warn(`[ReliabilityManager] 可用性低於目標: ${this.reliabilityMetrics.currentAvailability} < ${this.options.targetAvailability}`);

            // 觸發自動恢復
            if (this.options.enableAutoRecovery && !this.systemStatus.recoveryInProgress) {
                await this.recoverSystem({ trigger: 'availability_threshold' });
            }
        }

        // 檢查活動事件
        const hasActiveIncidents = this.activeIncidents.size > 0;
        const hasCircuitBreakersOpen = this.circuitBreaker.getStats().global.openCircuits > 0;
        const hasSystemDegraded = this.systemStatus.mode !== SYSTEM_MODES.NORMAL;

        // 更新系統健康狀態
        this.systemStatus.isHealthy = health.overall.healthy && !hasActiveIncidents && !hasCircuitBreakersOpen;

        // 發出健康狀態事件
        this.emit('reliabilityCheck', {
            health,
            hasActiveIncidents,
            hasCircuitBreakersOpen,
            hasSystemDegraded,
            isHealthy: this.systemStatus.isHealthy,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 計算可靠性指標
     */
    _calculateReliabilityMetrics() {
        const now = Date.now();
        const startTime = new Date(this.systemStatus.startTime).getTime();
        const totalTime = now - startTime;

        if (totalTime <= 0) return;

        // 計算運行時間和停機時間
        this.reliabilityMetrics.uptime = totalTime - this.reliabilityMetrics.downtime;

        // 計算可用性
        this.reliabilityMetrics.currentAvailability = this.reliabilityMetrics.uptime / totalTime;

        // 計算可靠性分數 (綜合指標)
        const availabilityScore = this.reliabilityMetrics.currentAvailability * 100;
        const healthScore = this.systemStatus.isHealthy ? 100 : 0;
        const incidentScore = Math.max(0, 100 - (this.activeIncidents.size * 10));

        this.reliabilityMetrics.reliabilityScore = Math.round(
            (availabilityScore * 0.5 + healthScore * 0.3 + incidentScore * 0.2)
        );

        // 計算平均恢復時間
        if (this.reliabilityMetrics.resolvedIncidents > 0) {
            // 這裡應該基於實際的事件恢復時間計算
            // 簡化實現
        }

        this.reliabilityMetrics.lastCalculation = new Date().toISOString();
    }

    /**
     * 檢查是否應該觸發熔斷器
     */
    _shouldTriggerCircuitBreaker(error, errorResult) {
        // 根據錯誤類型和嚴重性決定
        if (error.severity === ErrorHandler.ERROR_SEVERITY.CRITICAL) {
            return true;
        }

        if (error.category === ErrorHandler.ERROR_CATEGORIES.NETWORK && !errorResult.recovery?.success) {
            return true;
        }

        return false;
    }

    /**
     * 觸發降級
     */
    async _triggerDegradation(error, context) {
        try {
            // 確保降級計劃存在
            const planName = 'system_degradation_plan';
            let plan = this.fallbackManager.plans.get(planName);

            if (!plan) {
                plan = this.fallbackManager.createPlan(planName, {
                    description: '系統自動降級計劃',
                    cascadeMode: 'progressive',
                    recoveryMode: 'gradual'
                });

                // 添加默認降級策略
                this._addDefaultDegradationStrategies(plan);
            }

            // 根據錯誤嚴重性選擇降級級別
            const degradationLevel = this._selectDegradationLevel(error, context);

            // 執行降級
            const result = await this.fallbackManager.degrade(planName, degradationLevel, {
                ...context,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            if (result.success) {
                console.log(`[ReliabilityManager] 已觸發降級到級別: ${degradationLevel}`);
                this.systemStatus.mode = SYSTEM_MODES.DEGRADED;
            }

            return result;

        } catch (degError) {
            console.error('[ReliabilityManager] 觸發降級失敗:', degError);
            throw degError;
        }
    }

    /**
     * 添加默認降級策略
     */
    _addDefaultDegradationStrategies(plan) {
        // 輕度降級策略
        const lightDegradation = this.fallbackManager.registerStrategy('light_degradation', {
            level: FallbackManager.DEGRADATION_LEVELS.HIGH,
            type: FallbackManager.STRATEGY_TYPES.FEATURE_TOGGLE,
            triggers: [
                { type: FallbackManager.DEGRADATION_TRIGGERS.ERROR_RATE, threshold: 0.05 }
            ],
            handler: async (context, config) => {
                // 禁用非關鍵功能
                return {
                    success: true,
                    action: 'disable_non_critical_features',
                    features: ['advanced_analytics', 'optional_notifications']
                };
            }
        });

        // 中度降級策略
        const mediumDegradation = this.fallbackManager.registerStrategy('medium_degradation', {
            level: FallbackManager.DEGRADATION_LEVELS.MEDIUM,
            type: FallbackManager.STRATEGY_TYPES.SIMPLIFIED_LOGIC,
            triggers: [
                { type: FallbackManager.DEGRADATION_TRIGGERS.ERROR_RATE, threshold: 0.1 },
                { type: FallbackManager.DEGRADATION_TRIGGERS.RESPONSE_TIME, threshold: 5000 }
            ],
            handler: async (context, config) => {
                // 簡化業務邏輯
                return {
                    success: true,
                    action: 'simplify_business_logic',
                    changes: ['disable_complex_calculations', 'use_cached_data']
                };
            }
        });

        // 重度降級策略
        const heavyDegradation = this.fallbackManager.registerStrategy('heavy_degradation', {
            level: FallbackManager.DEGRADATION_LEVELS.LOW,
            type: FallbackManager.STRATEGY_TYPES.STATIC_RESPONSE,
            triggers: [
                { type: FallbackManager.DEGRADATION_TRIGGERS.ERROR_RATE, threshold: 0.2 },
                { type: FallbackManager.DEGRADATION_TRIGGERS.DEPENDENCY_FAILURE }
            ],
            handler: async (context, config) => {
                // 使用靜態響應
                return {
                    success: true,
                    action: 'enable_static_responses',
                    mode: 'cached_only'
                };
            }
        });

        plan.addStrategy(lightDegradation, FallbackManager.DEGRADATION_LEVELS.HIGH);
        plan.addStrategy(mediumDegradation, FallbackManager.DEGRADATION_LEVELS.MEDIUM);
        plan.addStrategy(heavyDegradation, FallbackManager.DEGRADATION_LEVELS.LOW);
    }

    /**
     * 選擇降級級別
     */
    _selectDegradationLevel(error, context) {
        if (error.severity === ErrorHandler.ERROR_SEVERITY.CRITICAL) {
            return FallbackManager.DEGRADATION_LEVELS.LOW;
        }

        if (error.severity === ErrorHandler.ERROR_SEVERITY.HIGH) {
            return FallbackManager.DEGRADATION_LEVELS.MEDIUM;
        }

        if (context.trigger === 'circuit_break') {
            return FallbackManager.DEGRADATION_LEVELS.MEDIUM;
        }

        return FallbackManager.DEGRADATION_LEVELS.HIGH;
    }

    /**
     * 嘗試降級處理
     */
    async _attemptFallback(operationName, error, options) {
        try {
            // 查找適用的降級策略
            const strategy = this._findFallbackStrategy(operationName, error);

            if (strategy) {
                const result = await strategy.activate({
                    operationName,
                    error,
                    ...options.context
                });

                return {
                    success: result.success,
                    result: result.result || options.defaultResult,
                    strategy: strategy.name
                };
            }

            return { success: false, reason: 'no_fallback_strategy' };

        } catch (fallbackError) {
            console.error(`[ReliabilityManager] 降級處理失敗 [${operationName}]:`, fallbackError);
            return {
                success: false,
                error: fallbackError.message
            };
        }
    }

    /**
     * 查找降級策略
     */
    _findFallbackStrategy(operationName, error) {
        // 簡化實現：返回通用降級策略
        const strategies = this.fallbackManager.strategies;

        for (const [name, strategy] of strategies.entries()) {
            if (strategy.shouldActivate({ error, operationName })) {
                return strategy;
            }
        }

        return null;
    }

    /**
     * 檢查自動恢復
     */
    async _checkAutoRecovery(error, errorResult, context) {
        // 如果錯誤已恢復，檢查是否可以啟動系統恢復
        if (errorResult.recovery?.success && this.systemStatus.mode !== SYSTEM_MODES.NORMAL) {
            const shouldRecover = await this._shouldAttemptSystemRecovery();

            if (shouldRecover) {
                setTimeout(async () => {
                    try {
                        await this.recoverSystem({ trigger: 'auto_recovery' });
                    } catch (recoveryError) {
                        console.error('[ReliabilityManager] 自動恢復失敗:', recoveryError);
                    }
                }, 5000); // 5秒延遲
            }
        }
    }

    /**
     * 檢查是否應該嘗試系統恢復
     */
    async _shouldAttemptSystemRecovery() {
        // 檢查健康狀況
        const health = this.getSystemHealth();
        if (!health.overall.healthy) return false;

        // 檢查熔斷器狀態
        const cbStats = this.circuitBreaker.getStats();
        if (cbStats.global.openCircuits > 0) return false;

        // 檢查活動事件
        if (this.activeIncidents.size > 0) return false;

        return true;
    }

    /**
     * 記錄操作成功
     */
    _recordOperationSuccess(operationName, responseTime) {
        // 這裡可以添加操作成功的統計邏輯
    }

    /**
     * 記錄操作失敗
     */
    _recordOperationFailure(operationName, error, responseTime) {
        // 這裡可以添加操作失敗的統計邏輯
        console.warn(`[ReliabilityManager] 操作失敗 [${operationName}]: ${error.message} (${responseTime}ms)`);
    }

    /**
     * 緊急錯誤處理
     */
    async _emergencyErrorHandling(originalError, handlingError, context) {
        console.error('[ReliabilityManager] 進入緊急錯誤處理模式');

        // 切換到緊急模式
        this.systemStatus.mode = SYSTEM_MODES.EMERGENCY;
        this.systemStatus.isHealthy = false;

        // 記錄嚴重事件
        this._recordIncident({
            type: 'emergency',
            originalError: originalError.message,
            handlingError: handlingError.message,
            context,
            timestamp: new Date().toISOString()
        });

        // 通知外部系統
        if (this.eventBus) {
            try {
                await this.eventBus.publish('system.emergency', {
                    originalError,
                    handlingError,
                    context,
                    timestamp: new Date().toISOString()
                });
            } catch (notifyError) {
                console.error('[ReliabilityManager] 緊急通知失敗:', notifyError);
            }
        }

        return {
            success: false,
            emergency: true,
            originalError,
            handlingError,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 評估可靠性影響
     */
    _assessReliabilityImpact(error, errorResult) {
        let impact = 'low';

        if (error.severity === ErrorHandler.ERROR_SEVERITY.CRITICAL) {
            impact = 'critical';
        } else if (error.severity === ErrorHandler.ERROR_SEVERITY.HIGH) {
            impact = 'high';
        } else if (error.category === ErrorHandler.ERROR_CATEGORIES.SYSTEM) {
            impact = 'medium';
        }

        return {
            level: impact,
            availabilityImpact: this._estimateAvailabilityImpact(error),
            recoveryTimeEstimate: this._estimateRecoveryTime(error, errorResult),
            businessImpact: this._estimateBusinessImpact(error)
        };
    }

    /**
     * 估算可用性影響
     */
    _estimateAvailabilityImpact(error) {
        switch (error.severity) {
            case ErrorHandler.ERROR_SEVERITY.CRITICAL:
                return 0.1; // 10%影響
            case ErrorHandler.ERROR_SEVERITY.HIGH:
                return 0.05; // 5%影響
            case ErrorHandler.ERROR_SEVERITY.MEDIUM:
                return 0.01; // 1%影響
            default:
                return 0.001; // 0.1%影響
        }
    }

    /**
     * 估算恢復時間
     */
    _estimateRecoveryTime(error, errorResult) {
        if (errorResult.recovery?.success) {
            return errorResult.recovery.recoveryTime || 5000;
        }

        switch (error.category) {
            case ErrorHandler.ERROR_CATEGORIES.NETWORK:
                return 10000; // 10秒
            case ErrorHandler.ERROR_CATEGORIES.SYSTEM:
                return 30000; // 30秒
            case ErrorHandler.ERROR_CATEGORIES.INTEGRATION:
                return 60000; // 1分鐘
            default:
                return 15000; // 15秒
        }
    }

    /**
     * 估算業務影響
     */
    _estimateBusinessImpact(error) {
        return {
            userExperience: error.severity === ErrorHandler.ERROR_SEVERITY.CRITICAL ? 'severe' : 'moderate',
            functionality: error.category === ErrorHandler.ERROR_CATEGORIES.BUSINESS ? 'critical' : 'minor',
            dataIntegrity: error.category === ErrorHandler.ERROR_CATEGORIES.SYSTEM ? 'at_risk' : 'safe'
        };
    }

    /**
     * 更新可靠性指標
     */
    _updateReliabilityMetrics(errorResult, processingTime) {
        // 更新處理時間統計
        if (errorResult.success) {
            // 成功處理的統計
        } else {
            // 處理失敗的統計
            this.reliabilityMetrics.totalIncidents++;
        }
    }

    /**
     * 更新恢復指標
     */
    _updateRecoveryMetrics(recoveryResult) {
        if (recoveryResult.success) {
            this.reliabilityMetrics.resolvedIncidents++;

            // 更新平均恢復時間
            const recoveryTime = recoveryResult.duration;
            const totalRecovered = this.reliabilityMetrics.resolvedIncidents;

            this.reliabilityMetrics.averageRecoveryTime = (
                (this.reliabilityMetrics.averageRecoveryTime * (totalRecovered - 1) + recoveryTime) /
                totalRecovered
            );
        }
    }

    /**
     * 記錄事件
     */
    _recordIncident(incident) {
        const incidentId = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const incidentRecord = {
            id: incidentId,
            ...incident,
            status: 'active',
            startTime: incident.timestamp
        };

        this.activeIncidents.set(incidentId, incidentRecord);
        this.incidentHistory.push(incidentRecord);

        // 限制歷史記錄大小
        if (this.incidentHistory.length > 1000) {
            this.incidentHistory = this.incidentHistory.slice(-1000);
        }

        this.emit('incidentRecorded', incidentRecord);
    }

    /**
     * 解決事件
     */
    _resolveIncident(resolution) {
        // 查找相關事件並標記為已解決
        const activeIncidents = Array.from(this.activeIncidents.values());

        for (const incident of activeIncidents) {
            if (this._isRelatedIncident(incident, resolution)) {
                incident.status = 'resolved';
                incident.endTime = resolution.timestamp;
                incident.resolution = resolution;

                this.activeIncidents.delete(incident.id);
                this.emit('incidentResolved', incident);
                break;
            }
        }
    }

    /**
     * 檢查是否為相關事件
     */
    _isRelatedIncident(incident, resolution) {
        // 簡化實現：檢查類型匹配
        return incident.type === 'degradation' && resolution.type === 'recovery';
    }

    /**
     * 從降級級別獲取可靠性級別
     */
    _getLevelFromDegradation(degradationLevel) {
        switch (degradationLevel) {
            case FallbackManager.DEGRADATION_LEVELS.HIGH:
                return RELIABILITY_LEVELS.HIGH;
            case FallbackManager.DEGRADATION_LEVELS.MEDIUM:
                return RELIABILITY_LEVELS.MEDIUM;
            case FallbackManager.DEGRADATION_LEVELS.LOW:
            case FallbackManager.DEGRADATION_LEVELS.MINIMAL:
                return RELIABILITY_LEVELS.LOW;
            case FallbackManager.DEGRADATION_LEVELS.EMERGENCY:
                return RELIABILITY_LEVELS.CRITICAL;
            default:
                return RELIABILITY_LEVELS.MEDIUM;
        }
    }

    /**
     * 清理資源
     */
    async dispose() {
        console.log('[ReliabilityManager] 開始清理資源...');

        // 停止監控
        this._stopReliabilityMonitoring();

        // 清理核心組件
        if (this.errorHandler) {
            await this.errorHandler.dispose();
        }

        if (this.circuitBreaker) {
            await this.circuitBreaker.dispose();
        }

        if (this.fallbackManager) {
            await this.fallbackManager.dispose();
        }

        if (this.healthMonitor) {
            await this.healthMonitor.dispose();
        }

        // 清空數據
        this.activeIncidents.clear();
        this.recoveryProcedures.clear();
        this.incidentHistory = [];

        // 移除事件監聽器
        this.removeAllListeners();

        console.log('[ReliabilityManager] 資源清理完成');
    }
}

// 導出常數和類
ReliabilityManager.RELIABILITY_LEVELS = RELIABILITY_LEVELS;
ReliabilityManager.SYSTEM_MODES = SYSTEM_MODES;
ReliabilityManager.RECOVERY_STRATEGIES = RECOVERY_STRATEGIES;

module.exports = ReliabilityManager;