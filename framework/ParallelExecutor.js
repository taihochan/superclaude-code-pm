/**
 * ParallelExecutor - 並行執行協調器
 *
 * 功能：
 * - 智能並行任務調度和執行協調
 * - 整合DependencyResolver、ResourceManager、AgentManager
 * - 支援多種執行策略和優化算法
 * - 實時執行監控和性能分析
 * - 提供故障恢復和執行重試機制
 *
 * 用途：CCPM+SuperClaude整合的核心並行執行引擎
 * 配合：統一協調所有基礎設施組件實現最優並行執行
 */

const { EventEmitter } = require('events');
const DependencyResolver = require('./DependencyResolver');
const ResourceManager = require('./ResourceManager');
const AgentManager = require('./AgentManager');
const EventBus = require('./EventBus');
const CommandRouter = require('./CommandRouter');
const StateSynchronizer = require('./StateSynchronizer');

/**
 * 執行狀態定義
 */
const EXECUTION_STATUS = {
    IDLE: 'idle',
    PLANNING: 'planning',
    EXECUTING: 'executing',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * 執行策略定義
 */
const EXECUTION_STRATEGIES = {
    AGGRESSIVE: 'aggressive',     // 激進式：最大並行度
    BALANCED: 'balanced',         // 平衡式：資源與速度平衡
    CONSERVATIVE: 'conservative', // 保守式：優先穩定性
    ADAPTIVE: 'adaptive'          // 自適應：根據實時情況調整
};

/**
 * 執行計劃類
 */
class ExecutionPlan {
    constructor(planId, tasks, options = {}) {
        this.id = planId;
        this.tasks = tasks;
        this.options = {
            strategy: EXECUTION_STRATEGIES.BALANCED,
            maxConcurrency: 15,
            priority: 0,
            timeout: 300000, // 5分鐘
            retryPolicy: {
                enabled: true,
                maxAttempts: 3,
                backoffMultiplier: 2
            },
            resourceLimits: {
                cpu: 1000,
                memory: 2048,
                network: 100
            },
            ...options
        };

        // 執行狀態
        this.status = EXECUTION_STATUS.IDLE;
        this.createTime = Date.now();
        this.startTime = null;
        this.endTime = null;

        // 依賴分析結果
        this.dependencyAnalysis = null;
        this.executionGraph = null;

        // 資源分配
        this.resourceAllocation = null;
        this.resourceAllocationId = null;

        // Agent分配
        this.agentAssignments = new Map(); // taskId -> agentId
        this.agentAllocations = new Set(); // allocated agent IDs

        // 執行進度
        this.progress = {
            totalTasks: tasks.length,
            completedTasks: 0,
            failedTasks: 0,
            runningTasks: 0,
            percentage: 0
        };

        // 執行結果
        this.results = new Map(); // taskId -> result
        this.errors = new Map(); // taskId -> error

        // 性能指標
        this.metrics = {
            planningTime: 0,
            executionTime: 0,
            resourceUtilization: {},
            parallelismEfficiency: 0,
            throughput: 0 // tasks per second
        };
    }

    /**
     * 更新進度
     */
    updateProgress() {
        this.progress.percentage = Math.round(
            (this.progress.completedTasks / this.progress.totalTasks) * 100
        );
    }

    /**
     * 獲取執行摘要
     */
    getSummary() {
        return {
            id: this.id,
            status: this.status,
            createTime: this.createTime,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.endTime ? this.endTime - this.startTime : null,
            progress: { ...this.progress },
            metrics: { ...this.metrics },
            options: { ...this.options }
        };
    }
}

/**
 * 執行上下文類
 */
class ExecutionContext {
    constructor(plan, components) {
        this.plan = plan;
        this.dependencyResolver = components.dependencyResolver;
        this.resourceManager = components.resourceManager;
        this.agentManager = components.agentManager;
        this.eventBus = components.eventBus;

        // 執行狀態追蹤
        this.activeExecutions = new Map(); // taskId -> execution info
        this.completedExecutions = new Map(); // taskId -> result
        this.failedExecutions = new Map(); // taskId -> error info

        // 併發控制
        this.concurrencyLimiter = new Map(); // resource type -> current usage
        this.executionQueue = []; // 等待執行的任務

        // 執行監控
        this.monitoringData = {
            startTime: null,
            checkpoints: [],
            resourceSnapshots: [],
            agentUtilization: new Map()
        };
    }

    /**
     * 開始執行監控
     */
    startMonitoring() {
        this.monitoringData.startTime = Date.now();
        this.monitoringData.checkpoints = [];
        this.monitoringData.resourceSnapshots = [];
    }

    /**
     * 添加檢查點
     */
    addCheckpoint(name, data = {}) {
        this.monitoringData.checkpoints.push({
            name,
            timestamp: Date.now(),
            data: { ...data }
        });
    }

    /**
     * 記錄資源快照
     */
    recordResourceSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            resources: this.resourceManager.getSystemStatus(),
            agents: this.agentManager.getAllAgentStatus()
        };

        this.monitoringData.resourceSnapshots.push(snapshot);

        // 限制快照數量
        if (this.monitoringData.resourceSnapshots.length > 100) {
            this.monitoringData.resourceSnapshots =
                this.monitoringData.resourceSnapshots.slice(-100);
        }
    }

    /**
     * 獲取執行統計
     */
    getExecutionStats() {
        const now = Date.now();
        const totalTime = this.monitoringData.startTime ?
            now - this.monitoringData.startTime : 0;

        return {
            totalExecutionTime: totalTime,
            activeExecutions: this.activeExecutions.size,
            completedExecutions: this.completedExecutions.size,
            failedExecutions: this.failedExecutions.size,
            successRate: this.completedExecutions.size > 0 ?
                (this.completedExecutions.size /
                 (this.completedExecutions.size + this.failedExecutions.size) * 100) : 0,
            checkpoints: this.monitoringData.checkpoints.length,
            resourceSnapshots: this.monitoringData.resourceSnapshots.length
        };
    }
}

/**
 * 並行執行協調器主類
 */
class ParallelExecutor extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 基本配置
            maxConcurrentPlans: 5,
            defaultStrategy: EXECUTION_STRATEGIES.BALANCED,
            enableResourceOptimization: true,
            enableAdaptiveScheduling: true,

            // 性能配置
            monitoringInterval: 2000,
            resourceSnapshotInterval: 10000,
            adaptiveAdjustmentInterval: 30000,

            // 錯誤處理配置
            enableAutoRecovery: true,
            maxRecoveryAttempts: 3,
            recoveryDelay: 5000,

            // 優化配置
            enablePerformanceTuning: true,
            performanceTuningInterval: 60000,

            ...options
        };

        // 核心組件
        this.dependencyResolver = null;
        this.resourceManager = null;
        this.agentManager = null;
        this.eventBus = null;
        this.commandRouter = null;
        this.stateSynchronizer = null;

        // 執行管理
        this.executionPlans = new Map(); // planId -> ExecutionPlan
        this.activeExecutions = new Map(); // planId -> ExecutionContext
        this.executionHistory = []; // 執行歷史記錄

        // 性能監控
        this.performanceMonitor = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            peakConcurrency: 0,
            resourceUtilizationHistory: []
        };

        // 自適應調優
        this.adaptiveSettings = {
            optimalConcurrency: 5,
            resourceAllocationStrategy: 'balanced',
            lastOptimization: null,
            optimizationResults: []
        };

        // 定時器
        this.monitoringTimer = null;
        this.adaptiveTimer = null;
        this.performanceTimer = null;

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化並行執行器
     */
    async initialize(components = {}) {
        try {
            console.log('[ParallelExecutor] 初始化並行執行協調器...');

            // 初始化核心組件
            await this._initializeComponents(components);

            // 設置事件處理器
            this._setupEventHandlers();

            // 開始監控和調優
            this._startMonitoring();
            this._startAdaptiveTuning();
            this._startPerformanceTuning();

            this.initialized = true;
            this.emit('initialized');

            console.log('[ParallelExecutor] 並行執行協調器已初始化');

        } catch (error) {
            console.error('[ParallelExecutor] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 創建執行計劃
     * @param {Array} tasks - 任務列表
     * @param {Object} options - 執行選項
     * @returns {string} - 計劃ID
     */
    async createExecutionPlan(tasks, options = {}) {
        if (!this.initialized) {
            throw new Error('ParallelExecutor尚未初始化');
        }

        if (this.executionPlans.size >= this.options.maxConcurrentPlans) {
            throw new Error(`超出最大並行計劃數限制: ${this.options.maxConcurrentPlans}`);
        }

        const planId = this._generatePlanId();

        try {
            console.log(`[ParallelExecutor] 創建執行計劃 ${planId}，包含 ${tasks.length} 個任務`);

            // 創建執行計劃
            const plan = new ExecutionPlan(planId, tasks, {
                strategy: options.strategy || this.options.defaultStrategy,
                maxConcurrency: options.maxConcurrency || this.adaptiveSettings.optimalConcurrency,
                ...options
            });

            this.executionPlans.set(planId, plan);
            this.emit('planCreated', plan.getSummary());

            return planId;

        } catch (error) {
            console.error(`[ParallelExecutor] 創建執行計劃失敗: ${planId}`, error);
            throw error;
        }
    }

    /**
     * 執行計劃
     * @param {string} planId - 計劃ID
     * @returns {Promise<Object>} - 執行結果
     */
    async executePlan(planId) {
        const plan = this.executionPlans.get(planId);
        if (!plan) {
            throw new Error(`執行計劃不存在: ${planId}`);
        }

        if (plan.status !== EXECUTION_STATUS.IDLE) {
            throw new Error(`執行計劃狀態不允許執行: ${plan.status}`);
        }

        const planStartTime = Date.now();

        try {
            console.log(`[ParallelExecutor] 開始執行計劃: ${planId}`);
            plan.status = EXECUTION_STATUS.PLANNING;
            plan.startTime = planStartTime;

            // 階段 1: 依賴分析
            console.log(`[ParallelExecutor] 階段 1: 分析任務依賴關係...`);
            const dependencyResult = await this.dependencyResolver.analyzeDependencies(
                plan.tasks, {
                    enableCriticalPathAnalysis: true,
                    enableResourceOptimization: this.options.enableResourceOptimization
                }
            );

            plan.dependencyAnalysis = dependencyResult;
            plan.executionGraph = dependencyResult.dag;

            // 階段 2: 資源規劃
            console.log(`[ParallelExecutor] 階段 2: 資源需求規劃...`);
            const executionPlan = this.dependencyResolver.getExecutionPlan(
                dependencyResult.id, {
                    strategy: plan.options.strategy
                }
            );

            // 階段 3: 資源分配
            console.log(`[ParallelExecutor] 階段 3: 分配系統資源...`);
            const resourceAllocation = await this.resourceManager.allocateResources(
                plan.options.resourceLimits, {
                    priority: plan.options.priority,
                    timeout: 30000
                }
            );

            plan.resourceAllocation = resourceAllocation;
            plan.resourceAllocationId = resourceAllocation.allocationId;

            // 階段 4: Agent準備
            console.log(`[ParallelExecutor] 階段 4: 準備執行Agent...`);
            await this._prepareAgentsForExecution(plan, executionPlan);

            // 記錄規劃時間
            plan.metrics.planningTime = Date.now() - planStartTime;
            plan.status = EXECUTION_STATUS.EXECUTING;

            // 階段 5: 並行執行
            console.log(`[ParallelExecutor] 階段 5: 開始並行執行任務...`);
            const executionResult = await this._executeParallelTasks(plan, executionPlan);

            // 階段 6: 清理和統計
            console.log(`[ParallelExecutor] 階段 6: 清理資源和生成統計...`);
            await this._cleanupExecution(plan);

            // 完成執行
            plan.endTime = Date.now();
            plan.metrics.executionTime = plan.endTime - (plan.startTime + plan.metrics.planningTime);
            plan.status = EXECUTION_STATUS.COMPLETED;

            // 更新性能監控
            this._updatePerformanceMetrics(plan);

            this.emit('planCompleted', plan.getSummary());
            console.log(`[ParallelExecutor] 執行計劃完成: ${planId}，耗時 ${plan.endTime - plan.startTime}ms`);

            return {
                success: true,
                planId,
                results: executionResult.results,
                metrics: plan.metrics,
                executionTime: plan.endTime - plan.startTime
            };

        } catch (error) {
            console.error(`[ParallelExecutor] 執行計劃失敗: ${planId}`, error);

            plan.status = EXECUTION_STATUS.FAILED;
            plan.endTime = Date.now();

            // 嘗試清理資源
            try {
                await this._cleanupExecution(plan);
            } catch (cleanupError) {
                console.error('[ParallelExecutor] 清理資源失敗:', cleanupError);
            }

            this.emit('planFailed', {
                planId,
                error: error.message,
                plan: plan.getSummary()
            });

            throw error;
        } finally {
            // 從活動執行中移除
            this.activeExecutions.delete(planId);

            // 添加到歷史記錄
            this.executionHistory.push({
                plan: plan.getSummary(),
                completedAt: Date.now()
            });

            // 限制歷史記錄數量
            if (this.executionHistory.length > 100) {
                this.executionHistory = this.executionHistory.slice(-100);
            }
        }
    }

    /**
     * 暫停執行計劃
     * @param {string} planId - 計劃ID
     */
    async pausePlan(planId) {
        const plan = this.executionPlans.get(planId);
        if (!plan || plan.status !== EXECUTION_STATUS.EXECUTING) {
            return false;
        }

        try {
            plan.status = EXECUTION_STATUS.PAUSED;

            const context = this.activeExecutions.get(planId);
            if (context) {
                // 暫停所有活動的Agent任務
                for (const [taskId, executionInfo] of context.activeExecutions) {
                    const agent = this.agentManager.agents.get(executionInfo.agentId);
                    if (agent) {
                        await agent.pause();
                    }
                }
            }

            this.emit('planPaused', planId);
            console.log(`[ParallelExecutor] 已暫停執行計劃: ${planId}`);
            return true;

        } catch (error) {
            console.error(`[ParallelExecutor] 暫停執行計劃失敗: ${planId}`, error);
            return false;
        }
    }

    /**
     * 恢復執行計劃
     * @param {string} planId - 計劃ID
     */
    async resumePlan(planId) {
        const plan = this.executionPlans.get(planId);
        if (!plan || plan.status !== EXECUTION_STATUS.PAUSED) {
            return false;
        }

        try {
            plan.status = EXECUTION_STATUS.EXECUTING;

            const context = this.activeExecutions.get(planId);
            if (context) {
                // 恢復所有暫停的Agent
                for (const [taskId, executionInfo] of context.activeExecutions) {
                    const agent = this.agentManager.agents.get(executionInfo.agentId);
                    if (agent) {
                        await agent.resume();
                    }
                }
            }

            this.emit('planResumed', planId);
            console.log(`[ParallelExecutor] 已恢復執行計劃: ${planId}`);
            return true;

        } catch (error) {
            console.error(`[ParallelExecutor] 恢復執行計劃失敗: ${planId}`, error);
            return false;
        }
    }

    /**
     * 取消執行計劃
     * @param {string} planId - 計劃ID
     * @param {boolean} force - 是否強制取消
     */
    async cancelPlan(planId, force = false) {
        const plan = this.executionPlans.get(planId);
        if (!plan) {
            return false;
        }

        try {
            console.log(`[ParallelExecutor] 取消執行計劃: ${planId}`);
            plan.status = EXECUTION_STATUS.CANCELLED;

            const context = this.activeExecutions.get(planId);
            if (context) {
                // 取消所有活動任務
                const cancelPromises = [];
                for (const [taskId, executionInfo] of context.activeExecutions) {
                    const agent = this.agentManager.agents.get(executionInfo.agentId);
                    if (agent) {
                        cancelPromises.push(agent.cancelTask(taskId));
                    }
                }

                if (force) {
                    await Promise.allSettled(cancelPromises);
                } else {
                    await Promise.all(cancelPromises);
                }
            }

            // 清理資源
            await this._cleanupExecution(plan);

            this.emit('planCancelled', planId);
            console.log(`[ParallelExecutor] 已取消執行計劃: ${planId}`);
            return true;

        } catch (error) {
            console.error(`[ParallelExecutor] 取消執行計劃失敗: ${planId}`, error);
            return false;
        }
    }

    /**
     * 獲取執行狀態
     * @param {string} planId - 計劃ID（可選）
     */
    getExecutionStatus(planId = null) {
        if (planId) {
            const plan = this.executionPlans.get(planId);
            if (!plan) {
                return null;
            }

            return {
                plan: plan.getSummary(),
                context: this.activeExecutions.get(planId)?.getExecutionStats() || null
            };
        }

        // 返回所有執行計劃狀態
        const allPlans = {};
        for (const [id, plan] of this.executionPlans) {
            allPlans[id] = plan.getSummary();
        }

        return {
            plans: allPlans,
            summary: {
                totalPlans: this.executionPlans.size,
                activePlans: Array.from(this.executionPlans.values())
                    .filter(p => p.status === EXECUTION_STATUS.EXECUTING).length,
                performanceMetrics: { ...this.performanceMonitor }
            }
        };
    }

    /**
     * 優化執行性能
     * @param {Object} options - 優化選項
     */
    async optimizePerformance(options = {}) {
        console.log('[ParallelExecutor] 開始性能優化...');

        const optimizations = [];

        try {
            // 1. 分析當前性能
            const currentMetrics = this._analyzeCurrentPerformance();

            // 2. 調整併發設置
            if (options.adjustConcurrency !== false) {
                const concurrencyOpt = await this._optimizeConcurrency(currentMetrics);
                if (concurrencyOpt) {
                    optimizations.push(concurrencyOpt);
                }
            }

            // 3. 優化資源分配策略
            if (options.optimizeResources !== false) {
                const resourceOpt = await this._optimizeResourceAllocation(currentMetrics);
                if (resourceOpt) {
                    optimizations.push(resourceOpt);
                }
            }

            // 4. 調整Agent配置
            if (options.tuneAgents !== false) {
                const agentOpt = await this._optimizeAgentConfiguration(currentMetrics);
                if (agentOpt) {
                    optimizations.push(agentOpt);
                }
            }

            // 5. 更新自適應設置
            this.adaptiveSettings.lastOptimization = Date.now();
            this.adaptiveSettings.optimizationResults.push({
                timestamp: Date.now(),
                optimizations,
                metrics: currentMetrics
            });

            this.emit('performanceOptimized', optimizations);
            console.log(`[ParallelExecutor] 性能優化完成，執行了 ${optimizations.length} 項優化`);

            return optimizations;

        } catch (error) {
            console.error('[ParallelExecutor] 性能優化失敗:', error);
            throw error;
        }
    }

    /**
     * 關閉並行執行器
     */
    async shutdown() {
        console.log('[ParallelExecutor] 正在關閉並行執行器...');

        try {
            // 停止定時器
            this._stopTimers();

            // 取消所有活動執行計劃
            const cancelPromises = Array.from(this.executionPlans.keys()).map(
                planId => this.cancelPlan(planId, true)
            );
            await Promise.allSettled(cancelPromises);

            // 關閉核心組件
            if (this.agentManager) {
                await this.agentManager.shutdown();
            }

            if (this.resourceManager) {
                await this.resourceManager.shutdown();
            }

            if (this.stateSynchronizer) {
                await this.stateSynchronizer.cleanup();
            }

            if (this.eventBus) {
                await this.eventBus.dispose();
            }

            this.initialized = false;
            this.emit('shutdown');
            console.log('[ParallelExecutor] 並行執行器已關閉');

        } catch (error) {
            console.error('[ParallelExecutor] 關閉失敗:', error);
            throw error;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 初始化核心組件
     * @private
     */
    async _initializeComponents(components) {
        // 初始化或使用提供的組件
        this.dependencyResolver = components.dependencyResolver || new DependencyResolver();
        this.resourceManager = components.resourceManager || new ResourceManager();
        this.agentManager = components.agentManager || new AgentManager();
        this.eventBus = components.eventBus || new EventBus();
        this.commandRouter = components.commandRouter;
        this.stateSynchronizer = components.stateSynchronizer;

        // 初始化所有組件
        await this.resourceManager.initialize();
        await this.agentManager.initialize();
        await this.eventBus.initialize();

        // 創建一些預設Agent
        for (let i = 0; i < 3; i++) {
            await this.agentManager.createAgent({
                type: 'generic',
                maxConcurrentTasks: 2
            });
        }

        console.log('[ParallelExecutor] 核心組件初始化完成');
    }

    /**
     * 設置事件處理器
     * @private
     */
    _setupEventHandlers() {
        // Agent Manager事件
        this.agentManager.on('agentTaskCompleted', (data) => {
            this._handleTaskCompletion(data);
        });

        this.agentManager.on('agentTaskFailed', (data) => {
            this._handleTaskFailure(data);
        });

        this.agentManager.on('agentError', (data) => {
            console.error(`[ParallelExecutor] Agent錯誤:`, data);
        });

        // Resource Manager事件
        this.resourceManager.on('criticalWarning', (warning) => {
            console.warn(`[ParallelExecutor] 資源警告:`, warning);
            this.emit('resourceWarning', warning);
        });
    }

    /**
     * 準備執行Agent
     * @private
     */
    async _prepareAgentsForExecution(plan, executionPlan) {
        const requiredAgents = Math.min(
            plan.options.maxConcurrency,
            executionPlan.parallelism.maxParallelism
        );

        const availableAgents = this.agentManager.getAllAgentStatus().summary.activeAgents;

        if (availableAgents < requiredAgents) {
            const createCount = requiredAgents - availableAgents;
            console.log(`[ParallelExecutor] 需要創建 ${createCount} 個額外Agent`);

            for (let i = 0; i < createCount; i++) {
                try {
                    await this.agentManager.createAgent({
                        type: 'generic',
                        maxConcurrentTasks: 2
                    });
                } catch (error) {
                    console.warn('[ParallelExecutor] 創建Agent失敗:', error);
                }
            }
        }
    }

    /**
     * 並行執行任務
     * @private
     */
    async _executeParallelTasks(plan, executionPlan) {
        const context = new ExecutionContext(plan, {
            dependencyResolver: this.dependencyResolver,
            resourceManager: this.resourceManager,
            agentManager: this.agentManager,
            eventBus: this.eventBus
        });

        this.activeExecutions.set(plan.id, context);
        context.startMonitoring();

        const results = new Map();
        const errors = new Map();

        try {
            // 按執行階段處理任務
            for (const phase of executionPlan.phases) {
                console.log(`[ParallelExecutor] 執行階段 ${phase.phase}：${phase.tasks.length} 個並行任務`);

                context.addCheckpoint(`phase_${phase.phase}_start`);

                // 並行執行該階段的所有任務
                const phasePromises = phase.tasks.map(async (taskId) => {
                    const task = plan.tasks.find(t => t.id === taskId);
                    if (!task) {
                        throw new Error(`任務不存在: ${taskId}`);
                    }

                    try {
                        // 記錄任務開始
                        context.activeExecutions.set(taskId, {
                            startTime: Date.now(),
                            agentId: null,
                            status: 'starting'
                        });

                        plan.progress.runningTasks++;

                        // 分配給Agent執行
                        const result = await this.agentManager.assignTask(task, {
                            planId: plan.id,
                            phase: phase.phase
                        });

                        // 記錄成功
                        context.completedExecutions.set(taskId, result);
                        results.set(taskId, result);

                        plan.progress.completedTasks++;
                        plan.progress.runningTasks--;
                        plan.updateProgress();

                        this.emit('taskCompleted', {
                            planId: plan.id,
                            taskId,
                            result,
                            progress: plan.progress
                        });

                        return result;

                    } catch (error) {
                        // 記錄失敗
                        context.failedExecutions.set(taskId, error);
                        errors.set(taskId, error);

                        plan.progress.failedTasks++;
                        plan.progress.runningTasks--;
                        plan.updateProgress();

                        this.emit('taskFailed', {
                            planId: plan.id,
                            taskId,
                            error: error.message,
                            progress: plan.progress
                        });

                        throw error;

                    } finally {
                        context.activeExecutions.delete(taskId);
                    }
                });

                // 等待階段完成
                const phaseResults = await Promise.allSettled(phasePromises);

                // 檢查階段結果
                const phaseFailures = phaseResults.filter(r => r.status === 'rejected');
                if (phaseFailures.length > 0 && !plan.options.continueOnError) {
                    throw new Error(`階段 ${phase.phase} 有 ${phaseFailures.length} 個任務失敗`);
                }

                context.addCheckpoint(`phase_${phase.phase}_complete`);
                context.recordResourceSnapshot();

                this.emit('phaseCompleted', {
                    planId: plan.id,
                    phase: phase.phase,
                    completedTasks: phaseResults.filter(r => r.status === 'fulfilled').length,
                    failedTasks: phaseFailures.length
                });
            }

            return { results, errors };

        } catch (error) {
            console.error(`[ParallelExecutor] 並行執行失敗: ${plan.id}`, error);
            throw error;
        }
    }

    /**
     * 清理執行資源
     * @private
     */
    async _cleanupExecution(plan) {
        try {
            // 釋放資源分配
            if (plan.resourceAllocationId) {
                await this.resourceManager.releaseResources(plan.resourceAllocationId);
            }

            // 清理依賴分析結果
            if (plan.dependencyAnalysis) {
                this.dependencyResolver.cleanup(plan.dependencyAnalysis.id);
            }

            console.log(`[ParallelExecutor] 已清理執行計劃資源: ${plan.id}`);

        } catch (error) {
            console.error(`[ParallelExecutor] 清理資源失敗: ${plan.id}`, error);
        }
    }

    /**
     * 處理任務完成
     * @private
     */
    _handleTaskCompletion(data) {
        this.emit('taskProgressUpdate', {
            type: 'completed',
            agentId: data.agentId,
            taskId: data.taskId,
            result: data.result
        });
    }

    /**
     * 處理任務失敗
     * @private
     */
    _handleTaskFailure(data) {
        this.emit('taskProgressUpdate', {
            type: 'failed',
            agentId: data.agentId,
            taskId: data.taskId,
            error: data.error
        });
    }

    /**
     * 更新性能指標
     * @private
     */
    _updatePerformanceMetrics(plan) {
        this.performanceMonitor.totalExecutions++;

        if (plan.status === EXECUTION_STATUS.COMPLETED) {
            this.performanceMonitor.successfulExecutions++;
        } else if (plan.status === EXECUTION_STATUS.FAILED) {
            this.performanceMonitor.failedExecutions++;
        }

        // 更新平均執行時間
        const executionTime = plan.endTime - plan.startTime;
        const totalExecs = this.performanceMonitor.totalExecutions;
        this.performanceMonitor.averageExecutionTime = (
            this.performanceMonitor.averageExecutionTime * (totalExecs - 1) + executionTime
        ) / totalExecs;

        // 更新峰值併發
        const currentConcurrency = this.activeExecutions.size;
        if (currentConcurrency > this.performanceMonitor.peakConcurrency) {
            this.performanceMonitor.peakConcurrency = currentConcurrency;
        }

        // 計算吞吐量
        if (executionTime > 0) {
            plan.metrics.throughput = (plan.progress.completedTasks / executionTime) * 1000; // tasks per second
        }
    }

    /**
     * 開始監控
     * @private
     */
    _startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            this._performMonitoring();
        }, this.options.monitoringInterval);

        console.log('[ParallelExecutor] 已開始執行監控');
    }

    /**
     * 開始自適應調優
     * @private
     */
    _startAdaptiveTuning() {
        if (!this.options.enableAdaptiveScheduling) return;

        this.adaptiveTimer = setInterval(() => {
            this._performAdaptiveTuning();
        }, this.options.adaptiveAdjustmentInterval);

        console.log('[ParallelExecutor] 已開始自適應調優');
    }

    /**
     * 開始性能調優
     * @private
     */
    _startPerformanceTuning() {
        if (!this.options.enablePerformanceTuning) return;

        this.performanceTimer = setInterval(() => {
            this.optimizePerformance().catch(console.error);
        }, this.options.performanceTuningInterval);

        console.log('[ParallelExecutor] 已開始自動性能調優');
    }

    /**
     * 執行監控
     * @private
     */
    _performMonitoring() {
        try {
            // 記錄資源使用情況
            const resourceStatus = this.resourceManager.getSystemStatus();
            const agentStatus = this.agentManager.getAllAgentStatus();

            this.performanceMonitor.resourceUtilizationHistory.push({
                timestamp: Date.now(),
                resources: resourceStatus.pools,
                agents: agentStatus.summary
            });

            // 限制歷史記錄數量
            if (this.performanceMonitor.resourceUtilizationHistory.length > 100) {
                this.performanceMonitor.resourceUtilizationHistory =
                    this.performanceMonitor.resourceUtilizationHistory.slice(-100);
            }

            // 檢查執行計劃狀態
            for (const [planId, plan] of this.executionPlans) {
                if (plan.status === EXECUTION_STATUS.EXECUTING) {
                    const context = this.activeExecutions.get(planId);
                    if (context) {
                        context.recordResourceSnapshot();
                    }
                }
            }

            this.emit('monitoringUpdate', {
                timestamp: Date.now(),
                activeExecutions: this.activeExecutions.size,
                resourceStatus,
                agentStatus
            });

        } catch (error) {
            console.error('[ParallelExecutor] 監控執行失敗:', error);
        }
    }

    /**
     * 執行自適應調優
     * @private
     */
    _performAdaptiveTuning() {
        try {
            const currentMetrics = this._analyzeCurrentPerformance();

            // 根據系統負載調整併發數
            const optimalConcurrency = this._calculateOptimalConcurrency(currentMetrics);
            if (optimalConcurrency !== this.adaptiveSettings.optimalConcurrency) {
                console.log(`[ParallelExecutor] 調整最優併發數: ${this.adaptiveSettings.optimalConcurrency} -> ${optimalConcurrency}`);
                this.adaptiveSettings.optimalConcurrency = optimalConcurrency;
            }

            // 調整Agent配置
            this._adjustAgentConfiguration(currentMetrics);

            this.emit('adaptiveTuningPerformed', {
                timestamp: Date.now(),
                adjustments: {
                    optimalConcurrency: this.adaptiveSettings.optimalConcurrency
                },
                metrics: currentMetrics
            });

        } catch (error) {
            console.error('[ParallelExecutor] 自適應調優失敗:', error);
        }
    }

    /**
     * 分析當前性能
     * @private
     */
    _analyzeCurrentPerformance() {
        const resourceStatus = this.resourceManager.getSystemStatus();
        const agentStatus = this.agentManager.getAllAgentStatus();

        return {
            resourceUtilization: Object.fromEntries(
                Object.entries(resourceStatus.pools).map(([type, pool]) =>
                    [type, pool.utilization]
                )
            ),
            agentUtilization: agentStatus.summary.activeAgents / agentStatus.summary.totalAgents,
            currentConcurrency: this.activeExecutions.size,
            averageExecutionTime: this.performanceMonitor.averageExecutionTime,
            successRate: this.performanceMonitor.totalExecutions > 0 ?
                this.performanceMonitor.successfulExecutions / this.performanceMonitor.totalExecutions : 0,
            timestamp: Date.now()
        };
    }

    /**
     * 計算最優併發數
     * @private
     */
    _calculateOptimalConcurrency(metrics) {
        // 基於資源利用率和執行效率計算最優併發數
        const avgResourceUtil = Object.values(metrics.resourceUtilization)
            .reduce((sum, util) => sum + util, 0) / Object.keys(metrics.resourceUtilization).length;

        if (avgResourceUtil > 0.9) {
            // 資源利用率過高，減少併發
            return Math.max(1, Math.floor(this.adaptiveSettings.optimalConcurrency * 0.8));
        } else if (avgResourceUtil < 0.5) {
            // 資源利用率較低，可以增加併發
            return Math.min(this.options.maxConcurrentPlans,
                Math.ceil(this.adaptiveSettings.optimalConcurrency * 1.2));
        }

        return this.adaptiveSettings.optimalConcurrency;
    }

    /**
     * 調整Agent配置
     * @private
     */
    _adjustAgentConfiguration(metrics) {
        // 根據性能指標調整Agent配置
        if (metrics.agentUtilization > 0.9) {
            // Agent使用率過高，考慮創建更多Agent
            this.agentManager.autoScale().catch(console.error);
        }
    }

    /**
     * 優化併發設置
     * @private
     */
    async _optimizeConcurrency(metrics) {
        const newConcurrency = this._calculateOptimalConcurrency(metrics);
        if (newConcurrency !== this.adaptiveSettings.optimalConcurrency) {
            this.adaptiveSettings.optimalConcurrency = newConcurrency;
            return {
                type: 'concurrency',
                oldValue: this.adaptiveSettings.optimalConcurrency,
                newValue: newConcurrency,
                reason: '基於資源利用率調整併發數'
            };
        }
        return null;
    }

    /**
     * 優化資源分配
     * @private
     */
    async _optimizeResourceAllocation(metrics) {
        // 分析資源使用模式並優化分配策略
        return await this.resourceManager.optimizeResourceAllocation();
    }

    /**
     * 優化Agent配置
     * @private
     */
    async _optimizeAgentConfiguration(metrics) {
        // 根據負載自動擴展Agent
        const targetAgentCount = Math.ceil(metrics.currentConcurrency * 1.5);
        await this.agentManager.autoScale(targetAgentCount);

        return {
            type: 'agent_scaling',
            targetCount: targetAgentCount,
            reason: '基於併發需求調整Agent數量'
        };
    }

    /**
     * 停止定時器
     * @private
     */
    _stopTimers() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.adaptiveTimer) {
            clearInterval(this.adaptiveTimer);
            this.adaptiveTimer = null;
        }

        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
            this.performanceTimer = null;
        }
    }

    /**
     * 生成計劃ID
     * @private
     */
    _generatePlanId() {
        return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
}

// 導出常數
ParallelExecutor.EXECUTION_STATUS = EXECUTION_STATUS;
ParallelExecutor.EXECUTION_STRATEGIES = EXECUTION_STRATEGIES;

module.exports = ParallelExecutor;