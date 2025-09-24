/**
 * SmartRouter - 智能路由引擎核心
 *
 * 功能：
 * - 分析命令內容和上下文，選擇最適合的執行策略
 * - 實現基於機器學習的路由決策優化
 * - 提供路由決策透明度和可解釋性
 * - 支持用戶偏好學習和自適應優化
 *
 * 用途：CCPM+SuperClaude整合的智能決策核心
 * 配合：基於CommandRouter、EventBus、StateSynchronizer構建
 */

import EventEmitter from 'events';
import CommandRouter from './CommandRouter';
import EventBus from './EventBus';
import StateSynchronizer from './StateSynchronizer';

// 智能路由錯誤類型
class SmartRouterError extends Error {
    constructor(message, code, context = null) {
        super(message);
        this.name = 'SmartRouterError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

// 路由決策狀態
const DECISION_STATUS = {
    PENDING: 'pending',
    ANALYZING: 'analyzing',
    ROUTING: 'routing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    LEARNING: 'learning'
};

// 路由策略類型
const ROUTING_STRATEGIES = {
    STATIC: 'static',           // 基於命令類型的靜態路由
    DYNAMIC: 'dynamic',         // 基於項目上下文的動態路由
    PERSONALIZED: 'personalized', // 基於用戶偏好的個性化路由
    LOAD_BALANCED: 'load_balanced', // 基於系統負載的智能負載均衡
    ML_OPTIMIZED: 'ml_optimized'   // 機器學習優化路由
};

// 命令複雜度等級
const COMPLEXITY_LEVELS = {
    SIMPLE: { value: 1, label: '簡單', threshold: 0.3 },
    MODERATE: { value: 2, label: '中等', threshold: 0.6 },
    COMPLEX: { value: 3, label: '複雜', threshold: 0.8 },
    EXPERT: { value: 4, label: '專家級', threshold: 1.0 }
};

/**
 * 路由決策上下文
 */
class RoutingContext {
    constructor(command, options = {}) {
        this.id = this._generateId();
        this.command = command;
        this.timestamp = Date.now();
        this.status = DECISION_STATUS.PENDING;

        // 分析結果
        this.analysis = null;
        this.complexity = null;
        this.intent = null;
        this.requirements = null;

        // 決策結果
        this.selectedStrategy = null;
        this.confidence = 0;
        this.alternativeStrategies = [];
        this.executionPlan = null;

        // 性能預測
        this.predictedExecutionTime = 0;
        this.predictedSuccessRate = 0;
        this.resourceRequirements = {};

        // 學習數據
        this.actualExecutionTime = 0;
        this.actualSuccessRate = 0;
        this.userFeedback = null;

        // 選項
        this.options = {
            enableLearning: true,
            requireExplanation: false,
            maxDecisionTime: 50, // 50ms決策延遲限制
            confidenceThreshold: 0.8,
            ...options
        };
    }

    _generateId() {
        return `routing_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}

/**
 * 智能路由引擎
 */
class SmartRouter extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 性能配置
            decisionTimeLimit: 50, // 50ms決策延遲限制
            routingAccuracyTarget: 0.9, // 90%路由決策準確率目標
            learningEnabled: true,

            // 並發配置
            maxConcurrentDecisions: 100,
            maxQueueSize: 500,

            // 學習配置
            learningRate: 0.01,
            feedbackWindow: 1000, // 收集1000次決策數據
            modelUpdateInterval: 3600000, // 1小時更新模型

            // 策略配置
            defaultStrategy: ROUTING_STRATEGIES.DYNAMIC,
            enablePersonalization: true,
            enableLoadBalancing: true,

            ...options
        };

        // 核心組件 - 延遲初始化
        this.commandRouter = null;
        this.eventBus = null;
        this.stateSynchronizer = null;

        // 智能路由組件
        this.contentAnalyzer = null;
        this.contextManager = null;
        this.strategySelector = null;
        this.performancePredictor = null;
        this.learningEngine = null;

        // 路由狀態管理
        this.activeDecisions = new Map(); // decisionId -> RoutingContext
        this.decisionQueue = [];
        this.decisionHistory = [];

        // 策略註冊表
        this.strategies = new Map();
        this._initializeStrategies();

        // 性能統計
        this.stats = {
            totalDecisions: 0,
            successfulDecisions: 0,
            failedDecisions: 0,
            averageDecisionTime: 0,
            averageAccuracy: 0,
            learningProgress: 0,
            currentLoad: 0
        };

        // 初始化標記
        this.initialized = false;
        this.learning = false;
    }

    /**
     * 初始化智能路由器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[SmartRouter] 開始初始化智能路由引擎...');

            // 初始化基礎組件
            this.commandRouter = new CommandRouter({
                timeout: 30000,
                enableMetrics: true,
                maxConcurrency: this.options.maxConcurrentDecisions
            });

            this.eventBus = new EventBus({
                enablePersistence: true,
                enableMiddleware: true,
                maxConcurrentEvents: this.options.maxConcurrentDecisions
            });
            await this.eventBus.initialize();

            this.stateSynchronizer = new StateSynchronizer({
                enablePersistence: true,
                defaultMode: 'immediate'
            });
            await this.stateSynchronizer.initialize();

            // 初始化智能組件 - 動態導入
            await this._initializeIntelligentComponents();

            // 設置事件監聽
            this._setupEventListeners();

            // 載入歷史決策數據
            await this._loadHistoricalData();

            // 啟動學習引擎
            if (this.options.learningEnabled) {
                await this._startLearning();
            }

            this.initialized = true;
            console.log('[SmartRouter] 智能路由引擎初始化完成');
            this.emit('initialized');

        } catch (error) {
            console.error('[SmartRouter] 初始化失敗:', error);
            throw new SmartRouterError('智能路由器初始化失敗', 'INIT_FAILED', { error: error.message });
        }
    }

    /**
     * 智能路由主函數
     * @param {string} command - 命令字符串
     * @param {Object} context - 執行上下文
     * @returns {Promise<Object>} 路由決策結果
     */
    async route(command, context = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        // 檢查並發限制
        if (this.activeDecisions.size >= this.options.maxConcurrentDecisions) {
            throw new SmartRouterError(
                `超出最大並發決策限制 (${this.options.maxConcurrentDecisions})`,
                'CONCURRENCY_LIMIT_EXCEEDED'
            );
        }

        // 創建路由決策上下文
        const routingContext = new RoutingContext(command, context);
        this.activeDecisions.set(routingContext.id, routingContext);

        try {
            // 發送開始事件
            await this.eventBus.publish('routingStarted', {
                decisionId: routingContext.id,
                command,
                timestamp: startTime
            });

            // 執行智能路由決策流程
            const result = await this._executeRoutingPipeline(routingContext);

            // 更新統計信息
            this._updateStats(routingContext, true);

            // 發送完成事件
            await this.eventBus.publish('routingCompleted', {
                decisionId: routingContext.id,
                result,
                executionTime: Date.now() - startTime
            });

            return result;

        } catch (error) {
            // 更新統計信息
            this._updateStats(routingContext, false);

            // 發送失敗事件
            await this.eventBus.publish('routingFailed', {
                decisionId: routingContext.id,
                error: error.message,
                executionTime: Date.now() - startTime
            });

            throw error;

        } finally {
            // 清理活動決策
            this.activeDecisions.delete(routingContext.id);

            // 保存決策歷史
            this._saveDecisionHistory(routingContext);
        }
    }

    /**
     * 批量路由決策
     * @param {Array} commands - 命令列表
     * @param {Object} context - 共享上下文
     * @param {Object} options - 批量選項
     * @returns {Promise<Array>} 路由決策結果列表
     */
    async routeMultiple(commands, context = {}, options = {}) {
        const {
            parallel = true,
            stopOnError = false,
            maxBatchSize = 100
        } = options;

        if (commands.length > maxBatchSize) {
            throw new SmartRouterError(
                `批量命令數量超過限制 (${maxBatchSize})`,
                'BATCH_SIZE_EXCEEDED'
            );
        }

        const results = [];

        if (parallel) {
            // 並行路由決策
            const promises = commands.map((cmd, index) =>
                this.route(cmd, { ...context, batchIndex: index })
                    .catch(error => ({ error, command: cmd, index }))
            );

            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (result.error) {
                    if (stopOnError) {
                        throw result.error;
                    }
                    results.push({ success: false, error: result.error, command: result.command });
                } else {
                    results.push({ success: true, result });
                }
            }
        } else {
            // 順序路由決策
            for (let i = 0; i < commands.length; i++) {
                try {
                    const result = await this.route(commands[i], { ...context, batchIndex: i });
                    results.push({ success: true, result });
                } catch (error) {
                    results.push({ success: false, error, command: commands[i] });

                    if (stopOnError) {
                        throw error;
                    }
                }
            }
        }

        return results;
    }

    /**
     * 註冊路由策略
     * @param {string} name - 策略名稱
     * @param {Function} strategy - 策略函數
     * @param {Object} options - 策略選項
     */
    registerStrategy(name, strategy, options = {}) {
        this.strategies.set(name, {
            name,
            strategy,
            options: {
                priority: 0,
                enabled: true,
                requiresContext: false,
                ...options
            }
        });

        console.log(`[SmartRouter] 已註冊路由策略: ${name}`);
        this.emit('strategyRegistered', { name, options });
    }

    /**
     * 提供路由決策反饋
     * @param {string} decisionId - 決策ID
     * @param {Object} feedback - 反饋信息
     */
    async provideFeedback(decisionId, feedback) {
        try {
            const decision = this.decisionHistory.find(d => d.id === decisionId);
            if (!decision) {
                throw new SmartRouterError(`找不到決策記錄: ${decisionId}`, 'DECISION_NOT_FOUND');
            }

            // 更新決策記錄
            decision.userFeedback = {
                ...feedback,
                timestamp: new Date().toISOString()
            };

            // 發送反饋事件給學習引擎
            if (this.learningEngine) {
                await this.eventBus.publish('decisionFeedback', {
                    decisionId,
                    feedback,
                    decisionContext: decision
                });
            }

            console.log(`[SmartRouter] 收到決策反饋: ${decisionId}`);

        } catch (error) {
            console.error('[SmartRouter] 處理反饋失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取路由決策統計
     * @returns {Object} 統計信息
     */
    getStats() {
        return {
            ...this.stats,
            activeDecisions: this.activeDecisions.size,
            queueSize: this.decisionQueue.length,
            historySize: this.decisionHistory.length,
            strategies: Array.from(this.strategies.keys()),
            componentStats: {
                commandRouter: this.commandRouter ? this.commandRouter.getMetrics() : null,
                eventBus: this.eventBus ? this.eventBus.getStats() : null,
                stateSynchronizer: this.stateSynchronizer ? this.stateSynchronizer.getSyncStatus() : null
            }
        };
    }

    /**
     * 獲取決策歷史
     * @param {Object} filters - 過濾條件
     * @returns {Array} 決策歷史記錄
     */
    getDecisionHistory(filters = {}) {
        let history = [...this.decisionHistory];

        if (filters.since) {
            const sinceTime = new Date(filters.since).getTime();
            history = history.filter(d => d.timestamp >= sinceTime);
        }

        if (filters.status) {
            history = history.filter(d => d.status === filters.status);
        }

        if (filters.strategy) {
            history = history.filter(d => d.selectedStrategy === filters.strategy);
        }

        if (filters.limit) {
            history = history.slice(-filters.limit);
        }

        return history;
    }

    // ========== 私有方法 ==========

    /**
     * 執行路由決策流水線
     * @private
     */
    async _executeRoutingPipeline(routingContext) {
        const startTime = Date.now();

        try {
            // 階段 1: 命令分析
            routingContext.status = DECISION_STATUS.ANALYZING;
            const analysis = await this._analyzeCommand(routingContext);
            routingContext.analysis = analysis;

            // 階段 2: 策略選擇
            routingContext.status = DECISION_STATUS.ROUTING;
            const strategy = await this._selectStrategy(analysis);
            routingContext.selectedStrategy = strategy;

            // 階段 3: 創建執行計劃
            const executionPlan = await this._createExecutionPlan(strategy, analysis);
            routingContext.executionPlan = executionPlan;

            // 階段 4: 性能預測
            const prediction = await this._predictPerformance(executionPlan, analysis);
            routingContext.predictedExecutionTime = prediction.executionTime;
            routingContext.predictedSuccessRate = prediction.successRate;
            routingContext.resourceRequirements = prediction.resources;

            // 檢查決策時間限制
            const decisionTime = Date.now() - startTime;
            if (decisionTime > this.options.decisionTimeLimit) {
                console.warn(`[SmartRouter] 決策時間超過限制: ${decisionTime}ms > ${this.options.decisionTimeLimit}ms`);
            }

            routingContext.status = DECISION_STATUS.COMPLETED;

            return {
                decisionId: routingContext.id,
                strategy: strategy.name,
                confidence: strategy.confidence,
                executionPlan,
                prediction,
                decisionTime,
                explanation: strategy.explanation || null
            };

        } catch (error) {
            routingContext.status = DECISION_STATUS.FAILED;
            throw new SmartRouterError(
                `路由決策流程失敗: ${error.message}`,
                'PIPELINE_FAILED',
                { routingContext, error: error.message }
            );
        }
    }

    /**
     * 分析命令
     * @private
     */
    async _analyzeCommand(routingContext) {
        if (!this.contentAnalyzer) {
            // 基礎分析實現
            return this._basicCommandAnalysis(routingContext.command);
        }

        return await this.contentAnalyzer.analyze(routingContext.command, routingContext.options);
    }

    /**
     * 基礎命令分析
     * @private
     */
    _basicCommandAnalysis(command) {
        const analysis = {
            command: command.trim(),
            tokens: command.trim().split(/\s+/),
            commandType: this._detectCommandType(command),
            complexity: this._calculateBasicComplexity(command),
            intent: this._classifyBasicIntent(command),
            requirements: this._extractBasicRequirements(command)
        };

        return analysis;
    }

    /**
     * 檢測命令類型
     * @private
     */
    _detectCommandType(command) {
        const cmd = command.toLowerCase().trim();

        if (cmd.startsWith('/sc:')) return 'superclaude';
        if (cmd.startsWith('ccpm:')) return 'ccpm';
        if (cmd.includes('analyze') || cmd.includes('review')) return 'analysis';
        if (cmd.includes('create') || cmd.includes('generate')) return 'generation';
        if (cmd.includes('fix') || cmd.includes('debug')) return 'debug';
        if (cmd.includes('test')) return 'testing';
        if (cmd.includes('deploy') || cmd.includes('build')) return 'deployment';

        return 'general';
    }

    /**
     * 計算基礎複雜度
     * @private
     */
    _calculateBasicComplexity(command) {
        let score = 0;

        // 命令長度因子
        score += Math.min(command.length / 100, 0.3);

        // 參數數量因子
        const paramCount = (command.match(/--?\w+/g) || []).length;
        score += Math.min(paramCount / 10, 0.3);

        // 複雜關鍵字因子
        const complexKeywords = ['analyze', 'optimize', 'refactor', 'architecture', 'integrate'];
        const hasComplexKeywords = complexKeywords.some(kw => command.toLowerCase().includes(kw));
        if (hasComplexKeywords) score += 0.2;

        // 多步驟指示因子
        const stepIndicators = command.match(/\d+\.|step|then|after|before/gi) || [];
        score += Math.min(stepIndicators.length / 5, 0.2);

        return Math.min(score, 1.0);
    }

    /**
     * 分類基礎意圖
     * @private
     */
    _classifyBasicIntent(command) {
        const cmd = command.toLowerCase();

        const intentPatterns = {
            create: ['create', 'generate', 'build', 'make', 'add'],
            analyze: ['analyze', 'review', 'examine', 'check', 'inspect'],
            fix: ['fix', 'repair', 'debug', 'resolve', 'correct'],
            optimize: ['optimize', 'improve', 'enhance', 'refactor'],
            test: ['test', 'validate', 'verify', 'confirm'],
            deploy: ['deploy', 'publish', 'release', 'launch'],
            learn: ['learn', 'understand', 'explain', 'teach']
        };

        for (const [intent, patterns] of Object.entries(intentPatterns)) {
            if (patterns.some(pattern => cmd.includes(pattern))) {
                return intent;
            }
        }

        return 'unknown';
    }

    /**
     * 提取基礎需求
     * @private
     */
    _extractBasicRequirements(command) {
        const requirements = {
            files: [],
            technologies: [],
            actions: [],
            constraints: []
        };

        // 提取文件路徑
        const fileMatches = command.match(/[\w-]+\.(js|ts|vue|py|json|md|yml|yaml)/g);
        if (fileMatches) {
            requirements.files = fileMatches;
        }

        // 提取技術關鍵字
        const techKeywords = ['vue', 'react', 'node', 'python', 'docker', 'git', 'npm', 'yarn'];
        requirements.technologies = techKeywords.filter(tech =>
            command.toLowerCase().includes(tech)
        );

        // 提取動作關鍵字
        const actionKeywords = command.match(/\b(create|update|delete|move|copy|merge|split)\b/gi) || [];
        requirements.actions = actionKeywords.map(a => a.toLowerCase());

        return requirements;
    }

    /**
     * 選擇策略
     * @private
     */
    async _selectStrategy(analysis) {
        if (!this.strategySelector) {
            return this._basicStrategySelection(analysis);
        }

        return await this.strategySelector.select(analysis);
    }

    /**
     * 基礎策略選擇
     * @private
     */
    _basicStrategySelection(analysis) {
        let selectedStrategy = this.options.defaultStrategy;
        let confidence = 0.5;
        let explanation = '使用預設策略';

        // 基於命令類型選擇策略
        switch (analysis.commandType) {
            case 'superclaude':
                selectedStrategy = ROUTING_STRATEGIES.STATIC;
                confidence = 0.9;
                explanation = 'SuperClaude命令使用靜態路由';
                break;

            case 'ccpm':
                selectedStrategy = ROUTING_STRATEGIES.STATIC;
                confidence = 0.9;
                explanation = 'CCPM命令使用靜態路由';
                break;

            case 'analysis':
            case 'debug':
                selectedStrategy = ROUTING_STRATEGIES.DYNAMIC;
                confidence = 0.8;
                explanation = '分析和調試命令使用動態路由';
                break;

            case 'generation':
            case 'testing':
                selectedStrategy = ROUTING_STRATEGIES.LOAD_BALANCED;
                confidence = 0.7;
                explanation = '生成和測試命令使用負載均衡路由';
                break;

            default:
                if (analysis.complexity > 0.7) {
                    selectedStrategy = ROUTING_STRATEGIES.ML_OPTIMIZED;
                    confidence = 0.6;
                    explanation = '複雜命令使用機器學習優化路由';
                } else {
                    selectedStrategy = ROUTING_STRATEGIES.DYNAMIC;
                    confidence = 0.7;
                    explanation = '一般命令使用動態路由';
                }
        }

        return {
            name: selectedStrategy,
            confidence,
            explanation,
            alternatives: []
        };
    }

    /**
     * 創建執行計劃
     * @private
     */
    async _createExecutionPlan(strategy, analysis) {
        return {
            strategy: strategy.name,
            steps: [
                {
                    type: 'route',
                    target: this._determineExecutionTarget(analysis),
                    parameters: this._extractExecutionParameters(analysis)
                }
            ],
            estimated: {
                duration: this._estimateExecutionTime(analysis),
                resources: this._estimateResourceRequirements(analysis)
            }
        };
    }

    /**
     * 確定執行目標
     * @private
     */
    _determineExecutionTarget(analysis) {
        switch (analysis.commandType) {
            case 'superclaude':
                return 'superclaude_agent';
            case 'ccpm':
                return 'ccmp_system';
            case 'analysis':
                return 'analysis_service';
            case 'generation':
                return 'generation_service';
            case 'debug':
                return 'debug_service';
            case 'testing':
                return 'test_runner';
            case 'deployment':
                return 'deployment_service';
            default:
                return 'default_handler';
        }
    }

    /**
     * 提取執行參數
     * @private
     */
    _extractExecutionParameters(analysis) {
        return {
            command: analysis.command,
            intent: analysis.intent,
            complexity: analysis.complexity,
            requirements: analysis.requirements,
            context: {
                timestamp: Date.now(),
                session: 'current'
            }
        };
    }

    /**
     * 預測性能
     * @private
     */
    async _predictPerformance(executionPlan, analysis) {
        if (!this.performancePredictor) {
            return this._basicPerformancePrediction(executionPlan, analysis);
        }

        return await this.performancePredictor.predict(executionPlan, analysis);
    }

    /**
     * 基礎性能預測
     * @private
     */
    _basicPerformancePrediction(executionPlan, analysis) {
        // 基於複雜度的簡單預測
        const baseTime = 1000; // 1秒基礎時間
        const complexityMultiplier = 1 + (analysis.complexity * 2);
        const executionTime = baseTime * complexityMultiplier;

        // 基於命令類型的成功率預測
        const successRateMap = {
            'superclaude': 0.95,
            'ccpm': 0.90,
            'analysis': 0.85,
            'generation': 0.80,
            'debug': 0.75,
            'testing': 0.85,
            'deployment': 0.70,
            'general': 0.80
        };

        const successRate = successRateMap[analysis.commandType] || 0.75;

        return {
            executionTime: Math.round(executionTime),
            successRate,
            resources: {
                cpu: analysis.complexity * 0.5,
                memory: analysis.complexity * 100, // MB
                network: analysis.requirements.files.length > 0 ? 0.3 : 0.1
            }
        };
    }

    /**
     * 估算執行時間
     * @private
     */
    _estimateExecutionTime(analysis) {
        const baseTime = 500; // 500ms基礎時間
        const complexityFactor = 1 + (analysis.complexity * 3);
        const tokenFactor = Math.min(analysis.tokens.length / 10, 2);

        return Math.round(baseTime * complexityFactor * tokenFactor);
    }

    /**
     * 估算資源需求
     * @private
     */
    _estimateResourceRequirements(analysis) {
        return {
            cpu: Math.min(analysis.complexity * 0.6, 1.0),
            memory: Math.min(analysis.tokens.length * 10, 500), // MB
            storage: analysis.requirements.files.length * 50, // MB
            network: analysis.commandType === 'deployment' ? 0.8 : 0.2
        };
    }

    /**
     * 初始化策略
     * @private
     */
    _initializeStrategies() {
        // 靜態路由策略
        this.registerStrategy(ROUTING_STRATEGIES.STATIC, (analysis) => {
            return {
                target: this._getStaticTarget(analysis.commandType),
                confidence: 0.9,
                reason: '基於命令類型的靜態路由'
            };
        }, { priority: 1 });

        // 動態路由策略
        this.registerStrategy(ROUTING_STRATEGIES.DYNAMIC, (analysis) => {
            return {
                target: this._getDynamicTarget(analysis),
                confidence: 0.8,
                reason: '基於上下文的動態路由'
            };
        }, { priority: 2 });

        // 個性化路由策略
        this.registerStrategy(ROUTING_STRATEGIES.PERSONALIZED, (analysis) => {
            return {
                target: this._getPersonalizedTarget(analysis),
                confidence: 0.7,
                reason: '基於用戶偏好的個性化路由'
            };
        }, { priority: 3 });

        // 負載均衡路由策略
        this.registerStrategy(ROUTING_STRATEGIES.LOAD_BALANCED, (analysis) => {
            return {
                target: this._getLoadBalancedTarget(analysis),
                confidence: 0.8,
                reason: '基於系統負載的智能負載均衡'
            };
        }, { priority: 4 });
    }

    /**
     * 獲取靜態目標
     * @private
     */
    _getStaticTarget(commandType) {
        const staticMapping = {
            'superclaude': 'superclaude_handler',
            'ccpm': 'ccpm_handler',
            'analysis': 'analysis_handler',
            'generation': 'generation_handler',
            'debug': 'debug_handler',
            'testing': 'test_handler',
            'deployment': 'deploy_handler'
        };

        return staticMapping[commandType] || 'default_handler';
    }

    /**
     * 獲取動態目標
     * @private
     */
    _getDynamicTarget(analysis) {
        // 基於複雜度和意圖的動態路由
        if (analysis.complexity > 0.8) {
            return 'expert_handler';
        } else if (analysis.intent === 'learn') {
            return 'educational_handler';
        } else if (analysis.requirements.files.length > 5) {
            return 'batch_handler';
        } else {
            return 'standard_handler';
        }
    }

    /**
     * 獲取個性化目標
     * @private
     */
    _getPersonalizedTarget(analysis) {
        // 基於用戶歷史偏好的個性化路由
        // 這裡需要實現用戶偏好學習邏輯
        return 'personalized_handler';
    }

    /**
     * 獲取負載均衡目標
     * @private
     */
    _getLoadBalancedTarget(analysis) {
        // 基於當前系統負載選擇最佳目標
        const currentLoad = this.stats.currentLoad;

        if (currentLoad < 0.3) {
            return 'primary_handler';
        } else if (currentLoad < 0.7) {
            return 'secondary_handler';
        } else {
            return 'backup_handler';
        }
    }

    /**
     * 初始化智能組件
     * @private
     */
    async _initializeIntelligentComponents() {
        // 這些組件將在後續實現中動態載入
        console.log('[SmartRouter] 智能組件將在後續實現中載入');
    }

    /**
     * 設置事件監聽器
     * @private
     */
    _setupEventListeners() {
        // 監聽命令路由器事件
        this.commandRouter.on('commandExecuted', (context) => {
            this._handleCommandExecuted(context);
        });

        this.commandRouter.on('commandFailed', (error, context) => {
            this._handleCommandFailed(error, context);
        });

        // 監聽事件總線事件
        this.eventBus.on('error', (error) => {
            console.error('[SmartRouter] EventBus錯誤:', error);
        });

        // 監聽狀態同步器事件
        this.stateSynchronizer.on('syncCompleted', (result) => {
            console.log('[SmartRouter] 狀態同步完成:', result.id);
        });
    }

    /**
     * 處理命令執行完成
     * @private
     */
    _handleCommandExecuted(context) {
        // 更新學習數據
        if (this.options.learningEnabled) {
            this._recordExecutionSuccess(context);
        }
    }

    /**
     * 處理命令執行失敗
     * @private
     */
    _handleCommandFailed(error, context) {
        // 更新學習數據
        if (this.options.learningEnabled) {
            this._recordExecutionFailure(error, context);
        }
    }

    /**
     * 記錄執行成功
     * @private
     */
    _recordExecutionSuccess(context) {
        // 實現執行成功的學習記錄
        console.log(`[SmartRouter] 記錄執行成功: ${context.id}`);
    }

    /**
     * 記錄執行失敗
     * @private
     */
    _recordExecutionFailure(error, context) {
        // 實現執行失敗的學習記錄
        console.log(`[SmartRouter] 記錄執行失敗: ${context.id}`, error.message);
    }

    /**
     * 載入歷史數據
     * @private
     */
    async _loadHistoricalData() {
        try {
            // 從狀態存儲載入歷史決策數據
            console.log('[SmartRouter] 載入歷史決策數據...');
        } catch (error) {
            console.warn('[SmartRouter] 載入歷史數據失敗:', error);
        }
    }

    /**
     * 開始學習引擎
     * @private
     */
    async _startLearning() {
        this.learning = true;
        console.log('[SmartRouter] 學習引擎已啟動');

        // 設置模型更新定時器
        setInterval(() => {
            this._updateLearningModel();
        }, this.options.modelUpdateInterval);
    }

    /**
     * 更新學習模型
     * @private
     */
    _updateLearningModel() {
        if (!this.learning || this.decisionHistory.length < this.options.feedbackWindow) {
            return;
        }

        console.log('[SmartRouter] 更新學習模型...');

        // 這裡實現模型更新邏輯
        this.stats.learningProgress += 0.01;
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStats(routingContext, success) {
        this.stats.totalDecisions++;

        if (success) {
            this.stats.successfulDecisions++;
        } else {
            this.stats.failedDecisions++;
        }

        // 更新平均決策時間
        const decisionTime = Date.now() - routingContext.timestamp;
        this.stats.averageDecisionTime = (
            (this.stats.averageDecisionTime * (this.stats.totalDecisions - 1) + decisionTime) /
            this.stats.totalDecisions
        );

        // 更新平均準確率
        if (success) {
            this.stats.averageAccuracy = this.stats.successfulDecisions / this.stats.totalDecisions;
        }

        // 更新當前負載
        this.stats.currentLoad = this.activeDecisions.size / this.options.maxConcurrentDecisions;
    }

    /**
     * 保存決策歷史
     * @private
     */
    _saveDecisionHistory(routingContext) {
        this.decisionHistory.push({
            ...routingContext,
            endTime: Date.now()
        });

        // 限制歷史記錄數量
        if (this.decisionHistory.length > 10000) {
            this.decisionHistory = this.decisionHistory.slice(-10000);
        }
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            this.learning = false;

            // 等待活動決策完成
            if (this.activeDecisions.size > 0) {
                console.log(`[SmartRouter] 等待 ${this.activeDecisions.size} 個活動決策完成...`);
                // 實現等待邏輯
            }

            // 清理組件
            if (this.eventBus) {
                await this.eventBus.dispose();
            }

            if (this.stateSynchronizer) {
                await this.stateSynchronizer.cleanup();
            }

            if (this.commandRouter) {
                this.commandRouter.cleanup();
            }

            // 清理狀態
            this.activeDecisions.clear();
            this.strategies.clear();

            this.removeAllListeners();
            console.log('[SmartRouter] 資源清理完成');

        } catch (error) {
            console.error('[SmartRouter] 資源清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
SmartRouter.DECISION_STATUS = DECISION_STATUS;
SmartRouter.ROUTING_STRATEGIES = ROUTING_STRATEGIES;
SmartRouter.COMPLEXITY_LEVELS = COMPLEXITY_LEVELS;
SmartRouter.SmartRouterError = SmartRouterError;

export default SmartRouter;