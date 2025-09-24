/**
 * DecisionEngine - 多維度策略評估和選擇引擎
 *
 * 功能：
 * - 策略候選生成和過濾
 * - 多維度評估（效率、準確性、可靠性、速度、資源使用）
 * - 動態評分算法和權重調整
 * - 最優策略選擇和替代方案
 *
 * 用途：SmartRouter的核心決策組件
 * 配合：與ContextAnalyzer、LearningModule協同工作
 */

const EventEmitter = require('events');

// 評估維度
const EVALUATION_DIMENSIONS = {
    EFFICIENCY: 'efficiency',           // 效率
    ACCURACY: 'accuracy',              // 準確性
    RELIABILITY: 'reliability',        // 可靠性
    SPEED: 'speed',                    // 速度
    RESOURCE_USAGE: 'resource_usage',  // 資源使用
    COST: 'cost',                      // 成本
    RISK: 'risk',                      // 風險
    COMPATIBILITY: 'compatibility'      // 相容性
};

// 策略評估結果狀態
const EVALUATION_STATUS = {
    PENDING: 'pending',
    EVALUATING: 'evaluating',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// 決策置信度等級
const CONFIDENCE_LEVELS = {
    VERY_LOW: { value: 0.0, label: '極低', threshold: 0.2 },
    LOW: { value: 0.2, label: '低', threshold: 0.4 },
    MEDIUM: { value: 0.4, label: '中等', threshold: 0.6 },
    HIGH: { value: 0.6, label: '高', threshold: 0.8 },
    VERY_HIGH: { value: 0.8, label: '極高', threshold: 1.0 }
};

/**
 * 策略評估結果
 */
class StrategyEvaluation {
    constructor(strategy, analysis) {
        this.id = this._generateId();
        this.strategy = strategy;
        this.analysis = analysis;
        this.status = EVALUATION_STATUS.PENDING;
        this.timestamp = Date.now();

        // 評估分數
        this.scores = new Map(); // dimension -> score
        this.weightedScore = 0;
        this.confidence = 0;

        // 詳細評估
        this.performance = null;
        this.risk = null;
        this.compatibility = null;
        this.resourceRequirements = null;

        // 預測結果
        this.predictedOutcome = null;
        this.alternativeStrategies = [];

        // 評估元數據
        this.evaluationTime = 0;
        this.evaluator = 'DecisionEngine';
    }

    _generateId() {
        return `eval_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 設置評估分數
     * @param {string} dimension - 評估維度
     * @param {number} score - 分數 (0-1)
     */
    setScore(dimension, score) {
        this.scores.set(dimension, Math.min(Math.max(score, 0), 1));
    }

    /**
     * 獲取評估分數
     * @param {string} dimension - 評估維度
     * @returns {number} 分數
     */
    getScore(dimension) {
        return this.scores.get(dimension) || 0;
    }

    /**
     * 計算加權總分
     * @param {Object} weights - 維度權重
     * @returns {number} 加權總分
     */
    calculateWeightedScore(weights) {
        let totalScore = 0;
        let totalWeight = 0;

        for (const [dimension, score] of this.scores.entries()) {
            const weight = weights[dimension] || 0;
            totalScore += score * weight;
            totalWeight += weight;
        }

        this.weightedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        return this.weightedScore;
    }

    /**
     * 獲取評估摘要
     * @returns {Object} 評估摘要
     */
    getSummary() {
        return {
            id: this.id,
            strategy: this.strategy.name,
            weightedScore: this.weightedScore,
            confidence: this.confidence,
            status: this.status,
            evaluationTime: this.evaluationTime,
            scores: Object.fromEntries(this.scores),
            recommendationLevel: this._getRecommendationLevel()
        };
    }

    /**
     * 獲取推薦等級
     * @private
     */
    _getRecommendationLevel() {
        if (this.weightedScore >= 0.8) return 'STRONGLY_RECOMMENDED';
        if (this.weightedScore >= 0.6) return 'RECOMMENDED';
        if (this.weightedScore >= 0.4) return 'ACCEPTABLE';
        if (this.weightedScore >= 0.2) return 'NOT_RECOMMENDED';
        return 'STRONGLY_NOT_RECOMMENDED';
    }
}

/**
 * 決策引擎
 */
class DecisionEngine extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 評估配置
            maxCandidateStrategies: 10,
            evaluationTimeout: 1000, // 1秒評估超時
            confidenceThreshold: 0.6,

            // 權重配置
            defaultWeights: {
                [EVALUATION_DIMENSIONS.EFFICIENCY]: 0.25,
                [EVALUATION_DIMENSIONS.ACCURACY]: 0.20,
                [EVALUATION_DIMENSIONS.RELIABILITY]: 0.20,
                [EVALUATION_DIMENSIONS.SPEED]: 0.15,
                [EVALUATION_DIMENSIONS.RESOURCE_USAGE]: 0.10,
                [EVALUATION_DIMENSIONS.COST]: 0.05,
                [EVALUATION_DIMENSIONS.RISK]: 0.03,
                [EVALUATION_DIMENSIONS.COMPATIBILITY]: 0.02
            },

            // 動態權重調整
            enableAdaptiveWeights: true,
            weightLearningRate: 0.01,

            // 評估優化
            enableParallelEvaluation: true,
            enableCaching: true,
            cacheSize: 1000,

            ...options
        };

        // 策略存儲
        this.strategies = new Map(); // strategyName -> strategyDefinition
        this.evaluators = new Map(); // dimension -> evaluatorFunction

        // 評估快取
        this.evaluationCache = new Map(); // cacheKey -> StrategyEvaluation
        this.cacheHits = 0;
        this.cacheMisses = 0;

        // 權重管理
        this.currentWeights = { ...this.options.defaultWeights };
        this.weightHistory = [];

        // 統計信息
        this.stats = {
            totalEvaluations: 0,
            successfulEvaluations: 0,
            failedEvaluations: 0,
            averageEvaluationTime: 0,
            cacheHitRate: 0,
            bestStrategy: null,
            worstStrategy: null
        };

        // 初始化評估器
        this._initializeEvaluators();
    }

    /**
     * 初始化決策引擎
     */
    async initialize() {
        try {
            console.log('[DecisionEngine] 初始化決策引擎...');

            // 載入歷史評估數據
            await this._loadHistoricalEvaluations();

            // 載入權重配置
            await this._loadWeightConfiguration();

            console.log('[DecisionEngine] 決策引擎初始化完成');
            this.emit('initialized');

        } catch (error) {
            console.error('[DecisionEngine] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 選擇最優策略
     * @param {Object} analysis - 命令分析結果
     * @param {Array} candidateStrategies - 候選策略列表
     * @param {Object} options - 選擇選項
     * @returns {Promise<Object>} 選擇結果
     */
    async selectStrategy(analysis, candidateStrategies = null, options = {}) {
        const startTime = Date.now();

        try {
            // 生成候選策略
            const candidates = candidateStrategies || await this._generateCandidateStrategies(analysis);

            if (candidates.length === 0) {
                throw new Error('沒有可用的候選策略');
            }

            // 限制候選數量
            const limitedCandidates = candidates.slice(0, this.options.maxCandidateStrategies);

            // 並行評估策略
            const evaluations = await this._evaluateStrategies(limitedCandidates, analysis, options);

            // 選擇最優策略
            const selectedEvaluation = await this._selectOptimalStrategy(evaluations, options);

            // 生成決策解釋
            const explanation = this._generateExplanation(selectedEvaluation, evaluations);

            // 更新統計信息
            this._updateStats(selectedEvaluation, Date.now() - startTime);

            // 記錄決策歷史
            this._recordDecision(selectedEvaluation, analysis, evaluations);

            const result = {
                strategy: selectedEvaluation.strategy,
                evaluation: selectedEvaluation.getSummary(),
                confidence: selectedEvaluation.confidence,
                alternatives: evaluations
                    .filter(e => e.id !== selectedEvaluation.id)
                    .sort((a, b) => b.weightedScore - a.weightedScore)
                    .slice(0, 3)
                    .map(e => e.getSummary()),
                explanation,
                decisionTime: Date.now() - startTime
            };

            this.emit('strategySelected', result);
            return result;

        } catch (error) {
            console.error('[DecisionEngine] 策略選擇失敗:', error);
            this.stats.failedEvaluations++;
            throw error;
        }
    }

    /**
     * 註冊策略
     * @param {string} name - 策略名稱
     * @param {Object} definition - 策略定義
     */
    registerStrategy(name, definition) {
        this.strategies.set(name, {
            name,
            ...definition,
            registeredAt: new Date().toISOString()
        });

        console.log(`[DecisionEngine] 已註冊策略: ${name}`);
        this.emit('strategyRegistered', { name, definition });
    }

    /**
     * 註冊評估器
     * @param {string} dimension - 評估維度
     * @param {Function} evaluator - 評估函數
     */
    registerEvaluator(dimension, evaluator) {
        this.evaluators.set(dimension, evaluator);
        console.log(`[DecisionEngine] 已註冊評估器: ${dimension}`);
    }

    /**
     * 更新權重配置
     * @param {Object} newWeights - 新的權重配置
     */
    updateWeights(newWeights) {
        const oldWeights = { ...this.currentWeights };

        // 更新權重
        Object.assign(this.currentWeights, newWeights);

        // 正規化權重
        this._normalizeWeights();

        // 記錄權重歷史
        this.weightHistory.push({
            timestamp: Date.now(),
            oldWeights,
            newWeights: { ...this.currentWeights },
            reason: 'manual_update'
        });

        console.log('[DecisionEngine] 權重配置已更新');
        this.emit('weightsUpdated', { oldWeights, newWeights: this.currentWeights });
    }

    /**
     * 學習權重調整
     * @param {Object} feedback - 反饋信息
     */
    async learnFromFeedback(feedback) {
        if (!this.options.enableAdaptiveWeights) {
            return;
        }

        try {
            // 基於反饋調整權重
            const adjustment = this._calculateWeightAdjustment(feedback);

            // 應用學習率
            const learningRate = this.options.weightLearningRate;
            for (const [dimension, delta] of Object.entries(adjustment)) {
                if (this.currentWeights[dimension] !== undefined) {
                    this.currentWeights[dimension] += delta * learningRate;
                }
            }

            // 正規化權重
            this._normalizeWeights();

            // 記錄學習歷史
            this.weightHistory.push({
                timestamp: Date.now(),
                adjustment,
                newWeights: { ...this.currentWeights },
                reason: 'feedback_learning',
                feedback
            });

            console.log('[DecisionEngine] 權重已基於反饋調整');
            this.emit('weightsLearned', { adjustment, newWeights: this.currentWeights });

        } catch (error) {
            console.error('[DecisionEngine] 權重學習失敗:', error);
        }
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        return {
            ...this.stats,
            currentWeights: { ...this.currentWeights },
            strategiesRegistered: this.strategies.size,
            evaluatorsRegistered: this.evaluators.size,
            cacheSize: this.evaluationCache.size,
            cacheHitRate: this.stats.totalEvaluations > 0
                ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * 清理評估快取
     */
    clearCache() {
        const oldSize = this.evaluationCache.size;
        this.evaluationCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;

        console.log(`[DecisionEngine] 已清理評估快取 (${oldSize} 項目)`);
        this.emit('cacheCleared', { clearedItems: oldSize });
    }

    // ========== 私有方法 ==========

    /**
     * 生成候選策略
     * @private
     */
    async _generateCandidateStrategies(analysis) {
        const candidates = [];

        // 基於命令類型匹配策略
        for (const [name, strategy] of this.strategies.entries()) {
            if (this._isStrategyApplicable(strategy, analysis)) {
                candidates.push(strategy);
            }
        }

        // 如果沒有匹配的策略，添加預設策略
        if (candidates.length === 0) {
            candidates.push(this._getDefaultStrategy(analysis));
        }

        return candidates;
    }

    /**
     * 檢查策略是否適用
     * @private
     */
    _isStrategyApplicable(strategy, analysis) {
        // 檢查命令類型匹配
        if (strategy.applicableTypes &&
            !strategy.applicableTypes.includes(analysis.commandType)) {
            return false;
        }

        // 檢查複雜度要求
        if (strategy.minComplexity && analysis.complexity < strategy.minComplexity) {
            return false;
        }

        if (strategy.maxComplexity && analysis.complexity > strategy.maxComplexity) {
            return false;
        }

        // 檢查必要條件
        if (strategy.requirements) {
            for (const requirement of strategy.requirements) {
                if (!this._checkRequirement(requirement, analysis)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 檢查需求條件
     * @private
     */
    _checkRequirement(requirement, analysis) {
        switch (requirement.type) {
            case 'has_files':
                return analysis.requirements.files.length > 0;
            case 'has_technology':
                return analysis.requirements.technologies.includes(requirement.value);
            case 'intent_matches':
                return analysis.intent === requirement.value;
            case 'min_tokens':
                return analysis.tokens.length >= requirement.value;
            default:
                return true;
        }
    }

    /**
     * 獲取預設策略
     * @private
     */
    _getDefaultStrategy(analysis) {
        return {
            name: 'default',
            type: 'fallback',
            description: '預設回退策略',
            applicableTypes: ['*'],
            priority: 0,
            handler: 'default_handler'
        };
    }

    /**
     * 評估策略列表
     * @private
     */
    async _evaluateStrategies(strategies, analysis, options) {
        const evaluations = [];

        if (this.options.enableParallelEvaluation) {
            // 並行評估
            const promises = strategies.map(strategy =>
                this._evaluateStrategy(strategy, analysis, options)
            );
            const results = await Promise.allSettled(promises);

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    evaluations.push(result.value);
                } else {
                    console.warn('[DecisionEngine] 策略評估失敗:', result.reason);
                }
            }
        } else {
            // 序列評估
            for (const strategy of strategies) {
                try {
                    const evaluation = await this._evaluateStrategy(strategy, analysis, options);
                    evaluations.push(evaluation);
                } catch (error) {
                    console.warn(`[DecisionEngine] 評估策略失敗 [${strategy.name}]:`, error);
                }
            }
        }

        return evaluations;
    }

    /**
     * 評估單個策略
     * @private
     */
    async _evaluateStrategy(strategy, analysis, options) {
        const startTime = Date.now();

        // 檢查快取
        const cacheKey = this._generateCacheKey(strategy, analysis);
        if (this.options.enableCaching && this.evaluationCache.has(cacheKey)) {
            this.cacheHits++;
            const cached = this.evaluationCache.get(cacheKey);
            console.log(`[DecisionEngine] 快取命中: ${strategy.name}`);
            return cached;
        }

        this.cacheMisses++;

        // 創建評估結果
        const evaluation = new StrategyEvaluation(strategy, analysis);
        evaluation.status = EVALUATION_STATUS.EVALUATING;

        try {
            // 執行各維度評估
            await this._performDimensionEvaluations(evaluation, analysis, options);

            // 計算加權總分
            evaluation.calculateWeightedScore(this.currentWeights);

            // 計算置信度
            evaluation.confidence = this._calculateConfidence(evaluation, analysis);

            // 預測性能
            evaluation.performance = await this._predictPerformance(evaluation, analysis);

            // 評估風險
            evaluation.risk = await this._assessRisk(evaluation, analysis);

            // 檢查相容性
            evaluation.compatibility = await this._checkCompatibility(evaluation, analysis);

            evaluation.status = EVALUATION_STATUS.COMPLETED;
            evaluation.evaluationTime = Date.now() - startTime;

            // 快取結果
            if (this.options.enableCaching) {
                this._cacheEvaluation(cacheKey, evaluation);
            }

            return evaluation;

        } catch (error) {
            evaluation.status = EVALUATION_STATUS.FAILED;
            evaluation.evaluationTime = Date.now() - startTime;
            throw error;
        }
    }

    /**
     * 執行各維度評估
     * @private
     */
    async _performDimensionEvaluations(evaluation, analysis, options) {
        const evaluationPromises = [];

        for (const [dimension, evaluator] of this.evaluators.entries()) {
            evaluationPromises.push(
                this._evaluateDimension(evaluation, dimension, evaluator, analysis, options)
            );
        }

        await Promise.all(evaluationPromises);
    }

    /**
     * 評估單個維度
     * @private
     */
    async _evaluateDimension(evaluation, dimension, evaluator, analysis, options) {
        try {
            const score = await evaluator(evaluation.strategy, analysis, options);
            evaluation.setScore(dimension, score);
        } catch (error) {
            console.warn(`[DecisionEngine] 維度評估失敗 [${dimension}]:`, error);
            evaluation.setScore(dimension, 0.5); // 預設中等分數
        }
    }

    /**
     * 選擇最優策略
     * @private
     */
    async _selectOptimalStrategy(evaluations, options) {
        if (evaluations.length === 0) {
            throw new Error('沒有可用的評估結果');
        }

        // 按加權分數排序
        evaluations.sort((a, b) => b.weightedScore - a.weightedScore);

        const topEvaluation = evaluations[0];

        // 檢查置信度閾值
        if (topEvaluation.confidence < this.options.confidenceThreshold) {
            console.warn(`[DecisionEngine] 最佳策略置信度較低: ${topEvaluation.confidence}`);
        }

        // 檢查分數閾值
        if (options.minScore && topEvaluation.weightedScore < options.minScore) {
            throw new Error(`最佳策略分數過低: ${topEvaluation.weightedScore} < ${options.minScore}`);
        }

        return topEvaluation;
    }

    /**
     * 生成決策解釋
     * @private
     */
    _generateExplanation(selectedEvaluation, allEvaluations) {
        const explanation = {
            selected: {
                strategy: selectedEvaluation.strategy.name,
                score: selectedEvaluation.weightedScore.toFixed(3),
                confidence: selectedEvaluation.confidence.toFixed(3),
                strengths: this._getStrategyStrengths(selectedEvaluation),
                weaknesses: this._getStrategyWeaknesses(selectedEvaluation)
            },
            comparison: this._generateComparison(selectedEvaluation, allEvaluations),
            reasoning: this._generateReasoningText(selectedEvaluation)
        };

        return explanation;
    }

    /**
     * 獲取策略優勢
     * @private
     */
    _getStrategyStrengths(evaluation) {
        const strengths = [];

        for (const [dimension, score] of evaluation.scores.entries()) {
            if (score > 0.7) {
                strengths.push({
                    dimension,
                    score: score.toFixed(3),
                    description: this._getDimensionDescription(dimension, 'strength')
                });
            }
        }

        return strengths.sort((a, b) => b.score - a.score);
    }

    /**
     * 獲取策略劣勢
     * @private
     */
    _getStrategyWeaknesses(evaluation) {
        const weaknesses = [];

        for (const [dimension, score] of evaluation.scores.entries()) {
            if (score < 0.4) {
                weaknesses.push({
                    dimension,
                    score: score.toFixed(3),
                    description: this._getDimensionDescription(dimension, 'weakness')
                });
            }
        }

        return weaknesses.sort((a, b) => a.score - b.score);
    }

    /**
     * 生成比較信息
     * @private
     */
    _generateComparison(selected, allEvaluations) {
        if (allEvaluations.length < 2) {
            return null;
        }

        const others = allEvaluations.filter(e => e.id !== selected.id);
        const secondBest = others[0];

        return {
            advantage: (selected.weightedScore - secondBest.weightedScore).toFixed(3),
            alternativeCount: others.length,
            significantAdvantage: selected.weightedScore - secondBest.weightedScore > 0.1
        };
    }

    /**
     * 生成推理文本
     * @private
     */
    _generateReasoningText(evaluation) {
        const parts = [];

        parts.push(`選擇 ${evaluation.strategy.name} 策略`);
        parts.push(`總體評分：${evaluation.weightedScore.toFixed(3)}`);
        parts.push(`置信度：${evaluation.confidence.toFixed(3)}`);

        const topDimensions = Array.from(evaluation.scores.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        parts.push(`主要優勢：${topDimensions.map(([dim, score]) =>
            `${dim}(${score.toFixed(2)})`
        ).join(', ')}`);

        return parts.join('，');
    }

    /**
     * 獲取維度描述
     * @private
     */
    _getDimensionDescription(dimension, type) {
        const descriptions = {
            efficiency: {
                strength: '執行效率高，資源利用率佳',
                weakness: '執行效率不足，可能浪費資源'
            },
            accuracy: {
                strength: '準確性高，結果可靠',
                weakness: '準確性不足，結果可能有誤'
            },
            reliability: {
                strength: '可靠性強，穩定性佳',
                weakness: '可靠性不足，可能出現故障'
            },
            speed: {
                strength: '執行速度快，響應及時',
                weakness: '執行速度慢，響應延遲'
            },
            resource_usage: {
                strength: '資源消耗低，成本控制佳',
                weakness: '資源消耗高，成本偏高'
            }
        };

        return descriptions[dimension]?.[type] || `${dimension} ${type === 'strength' ? '表現優異' : '需要改善'}`;
    }

    /**
     * 計算置信度
     * @private
     */
    _calculateConfidence(evaluation, analysis) {
        let confidence = 0.5; // 基準置信度

        // 基於分數的置信度調整
        confidence += (evaluation.weightedScore - 0.5) * 0.5;

        // 基於評估覆蓋度的調整
        const coverageRatio = evaluation.scores.size / this.evaluators.size;
        confidence *= coverageRatio;

        // 基於策略匹配度的調整
        const matchScore = this._calculateStrategyMatch(evaluation.strategy, analysis);
        confidence += matchScore * 0.2;

        return Math.min(Math.max(confidence, 0), 1);
    }

    /**
     * 計算策略匹配度
     * @private
     */
    _calculateStrategyMatch(strategy, analysis) {
        let matchScore = 0;

        // 檢查命令類型匹配
        if (strategy.applicableTypes?.includes(analysis.commandType)) {
            matchScore += 0.3;
        }

        // 檢查複雜度匹配
        if (strategy.targetComplexity) {
            const complexityDiff = Math.abs(strategy.targetComplexity - analysis.complexity);
            matchScore += (1 - complexityDiff) * 0.2;
        }

        // 檢查意圖匹配
        if (strategy.supportedIntents?.includes(analysis.intent)) {
            matchScore += 0.2;
        }

        return Math.min(matchScore, 1);
    }

    /**
     * 預測性能
     * @private
     */
    async _predictPerformance(evaluation, analysis) {
        // 基於歷史數據和當前評估預測性能
        const baseTime = 1000; // 基礎執行時間
        const speedScore = evaluation.getScore(EVALUATION_DIMENSIONS.SPEED);
        const complexityFactor = 1 + analysis.complexity;

        const predictedTime = baseTime * complexityFactor * (2 - speedScore);
        const successRate = evaluation.getScore(EVALUATION_DIMENSIONS.RELIABILITY);

        return {
            estimatedDuration: Math.round(predictedTime),
            successProbability: successRate,
            resourceUsage: evaluation.getScore(EVALUATION_DIMENSIONS.RESOURCE_USAGE)
        };
    }

    /**
     * 評估風險
     * @private
     */
    async _assessRisk(evaluation, analysis) {
        const riskFactors = {
            complexity: analysis.complexity > 0.7 ? 0.3 : 0.1,
            reliability: 1 - evaluation.getScore(EVALUATION_DIMENSIONS.RELIABILITY),
            novelty: evaluation.strategy.isNew ? 0.2 : 0.05,
            dependencies: (analysis.requirements.files.length > 5) ? 0.15 : 0.05
        };

        const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);

        return {
            level: totalRisk > 0.5 ? 'high' : totalRisk > 0.3 ? 'medium' : 'low',
            score: Math.min(totalRisk, 1),
            factors: riskFactors
        };
    }

    /**
     * 檢查相容性
     * @private
     */
    async _checkCompatibility(evaluation, analysis) {
        const compatibility = {
            commandType: this._checkCommandTypeCompatibility(evaluation.strategy, analysis),
            environment: this._checkEnvironmentCompatibility(evaluation.strategy, analysis),
            dependencies: this._checkDependencyCompatibility(evaluation.strategy, analysis),
            overall: 0
        };

        compatibility.overall = (
            compatibility.commandType +
            compatibility.environment +
            compatibility.dependencies
        ) / 3;

        return compatibility;
    }

    /**
     * 檢查命令類型相容性
     * @private
     */
    _checkCommandTypeCompatibility(strategy, analysis) {
        if (strategy.applicableTypes?.includes(analysis.commandType) ||
            strategy.applicableTypes?.includes('*')) {
            return 1.0;
        }
        return 0.5; // 部分相容
    }

    /**
     * 檢查環境相容性
     * @private
     */
    _checkEnvironmentCompatibility(strategy, analysis) {
        // 檢查所需技術棧
        if (strategy.requiredTechnologies) {
            const availableTech = analysis.requirements.technologies;
            const missingTech = strategy.requiredTechnologies.filter(
                tech => !availableTech.includes(tech)
            );
            return 1 - (missingTech.length / strategy.requiredTechnologies.length);
        }
        return 1.0; // 無特殊要求
    }

    /**
     * 檢查依賴相容性
     * @private
     */
    _checkDependencyCompatibility(strategy, analysis) {
        // 檢查檔案依賴
        if (strategy.requiredFiles) {
            const availableFiles = analysis.requirements.files;
            const missingFiles = strategy.requiredFiles.filter(
                file => !availableFiles.some(af => af.includes(file))
            );
            return 1 - (missingFiles.length / strategy.requiredFiles.length);
        }
        return 1.0; // 無檔案依賴
    }

    /**
     * 初始化評估器
     * @private
     */
    _initializeEvaluators() {
        // 效率評估器
        this.registerEvaluator(EVALUATION_DIMENSIONS.EFFICIENCY, (strategy, analysis) => {
            let score = 0.5;

            // 基於策略類型調整
            if (strategy.type === 'optimized') score += 0.3;
            if (strategy.type === 'simple') score += 0.2;

            // 基於複雜度調整
            score += (1 - analysis.complexity) * 0.2;

            return Math.min(score, 1);
        });

        // 準確性評估器
        this.registerEvaluator(EVALUATION_DIMENSIONS.ACCURACY, (strategy, analysis) => {
            let score = 0.6;

            // 基於策略成熟度
            if (strategy.maturity === 'stable') score += 0.3;
            if (strategy.maturity === 'experimental') score -= 0.2;

            // 基於測試覆蓋率
            if (strategy.testCoverage) {
                score += strategy.testCoverage * 0.2;
            }

            return Math.min(score, 1);
        });

        // 可靠性評估器
        this.registerEvaluator(EVALUATION_DIMENSIONS.RELIABILITY, (strategy, analysis) => {
            let score = 0.5;

            // 基於歷史成功率
            if (strategy.historicalSuccessRate) {
                score = strategy.historicalSuccessRate;
            }

            // 基於錯誤處理能力
            if (strategy.hasErrorHandling) score += 0.2;
            if (strategy.hasRetryMechanism) score += 0.1;

            return Math.min(score, 1);
        });

        // 速度評估器
        this.registerEvaluator(EVALUATION_DIMENSIONS.SPEED, (strategy, analysis) => {
            let score = 0.5;

            // 基於策略類型
            if (strategy.type === 'fast') score += 0.4;
            if (strategy.type === 'thorough') score -= 0.2;

            // 基於複雜度
            score -= analysis.complexity * 0.3;

            return Math.max(score, 0);
        });

        // 資源使用評估器
        this.registerEvaluator(EVALUATION_DIMENSIONS.RESOURCE_USAGE, (strategy, analysis) => {
            let score = 0.6;

            // 基於策略資源需求
            if (strategy.resourceIntensive) score -= 0.4;
            if (strategy.lightweight) score += 0.3;

            // 基於分析結果調整
            if (analysis.requirements.files.length > 10) score -= 0.2;

            return Math.max(score, 0);
        });
    }

    /**
     * 生成快取鍵
     * @private
     */
    _generateCacheKey(strategy, analysis) {
        const keyParts = [
            strategy.name,
            analysis.commandType,
            Math.round(analysis.complexity * 10) / 10, // 精度到小數點後1位
            analysis.intent,
            JSON.stringify(analysis.requirements)
        ];

        return keyParts.join('|');
    }

    /**
     * 快取評估結果
     * @private
     */
    _cacheEvaluation(cacheKey, evaluation) {
        // 實現LRU快取
        if (this.evaluationCache.size >= this.options.cacheSize) {
            const firstKey = this.evaluationCache.keys().next().value;
            this.evaluationCache.delete(firstKey);
        }

        this.evaluationCache.set(cacheKey, evaluation);
    }

    /**
     * 計算權重調整
     * @private
     */
    _calculateWeightAdjustment(feedback) {
        const adjustment = {};

        // 基於用戶反饋調整權重
        if (feedback.satisfaction) {
            const satisfactionScore = feedback.satisfaction; // 0-1

            // 提高表現好的維度權重
            if (feedback.performanceAspects) {
                for (const aspect of feedback.performanceAspects.good) {
                    adjustment[aspect] = satisfactionScore * 0.1;
                }

                // 降低表現差的維度權重
                for (const aspect of feedback.performanceAspects.poor) {
                    adjustment[aspect] = -satisfactionScore * 0.1;
                }
            }
        }

        return adjustment;
    }

    /**
     * 正規化權重
     * @private
     */
    _normalizeWeights() {
        const totalWeight = Object.values(this.currentWeights).reduce((sum, weight) => sum + weight, 0);

        if (totalWeight > 0) {
            for (const dimension in this.currentWeights) {
                this.currentWeights[dimension] /= totalWeight;
            }
        }
    }

    /**
     * 記錄決策歷史
     * @private
     */
    _recordDecision(selectedEvaluation, analysis, allEvaluations) {
        const decisionRecord = {
            timestamp: Date.now(),
            selectedStrategy: selectedEvaluation.strategy.name,
            selectedScore: selectedEvaluation.weightedScore,
            confidence: selectedEvaluation.confidence,
            analysisHash: this._hashAnalysis(analysis),
            alternatives: allEvaluations.length - 1,
            weights: { ...this.currentWeights }
        };

        // 這裡可以保存到持久存儲
        console.log('[DecisionEngine] 記錄決策歷史:', decisionRecord);
    }

    /**
     * 產生分析哈希
     * @private
     */
    _hashAnalysis(analysis) {
        const crypto = require('crypto');
        const analysisString = JSON.stringify(analysis);
        return crypto.createHash('md5').update(analysisString).digest('hex').substring(0, 8);
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStats(evaluation, evaluationTime) {
        this.stats.totalEvaluations++;
        this.stats.successfulEvaluations++;

        // 更新平均評估時間
        this.stats.averageEvaluationTime = (
            (this.stats.averageEvaluationTime * (this.stats.totalEvaluations - 1) + evaluationTime) /
            this.stats.totalEvaluations
        );

        // 更新最佳/最差策略
        if (!this.stats.bestStrategy || evaluation.weightedScore > this.stats.bestStrategy.score) {
            this.stats.bestStrategy = {
                name: evaluation.strategy.name,
                score: evaluation.weightedScore,
                timestamp: Date.now()
            };
        }

        if (!this.stats.worstStrategy || evaluation.weightedScore < this.stats.worstStrategy.score) {
            this.stats.worstStrategy = {
                name: evaluation.strategy.name,
                score: evaluation.weightedScore,
                timestamp: Date.now()
            };
        }

        // 更新快取命中率
        const totalCacheRequests = this.cacheHits + this.cacheMisses;
        this.stats.cacheHitRate = totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) : 0;
    }

    /**
     * 載入歷史評估數據
     * @private
     */
    async _loadHistoricalEvaluations() {
        try {
            // 從持久存儲載入歷史評估數據
            console.log('[DecisionEngine] 載入歷史評估數據...');
        } catch (error) {
            console.warn('[DecisionEngine] 載入歷史評估數據失敗:', error);
        }
    }

    /**
     * 載入權重配置
     * @private
     */
    async _loadWeightConfiguration() {
        try {
            // 從配置文件載入權重設定
            console.log('[DecisionEngine] 載入權重配置...');
        } catch (error) {
            console.warn('[DecisionEngine] 載入權重配置失敗:', error);
        }
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            // 清理快取
            this.evaluationCache.clear();
            this.strategies.clear();
            this.evaluators.clear();

            // 移除所有事件監聽器
            this.removeAllListeners();

            console.log('[DecisionEngine] 資源清理完成');

        } catch (error) {
            console.error('[DecisionEngine] 資源清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
DecisionEngine.EVALUATION_DIMENSIONS = EVALUATION_DIMENSIONS;
DecisionEngine.EVALUATION_STATUS = EVALUATION_STATUS;
DecisionEngine.CONFIDENCE_LEVELS = CONFIDENCE_LEVELS;

module.exports = DecisionEngine;