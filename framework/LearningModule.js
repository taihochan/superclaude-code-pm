/**
 * LearningModule - 機器學習路由優化模塊
 *
 * 功能：
 * - 基於執行結果的自適應學習
 * - 路由決策性能追蹤和優化
 * - 預測模型訓練和更新
 * - 用戶偏好學習和個性化
 *
 * 用途：SmartRouter的學習大腦
 * 配合：與DecisionEngine、ContextAnalyzer協同工作
 */

import EventEmitter from 'events';
import fs from 'fs'.promises;
import path from 'path';

// 學習狀態
const LEARNING_STATUS = {
    IDLE: 'idle',                    // 空閒
    COLLECTING: 'collecting',        // 收集數據
    TRAINING: 'training',            // 訓練模型
    EVALUATING: 'evaluating',        // 評估模型
    UPDATING: 'updating',            // 更新模型
    ERROR: 'error'                   // 錯誤
};

// 模型類型
const MODEL_TYPES = {
    DECISION_TREE: 'decision_tree',           // 決策樹
    NAIVE_BAYES: 'naive_bayes',              // 貝葉斯分類器
    LINEAR_REGRESSION: 'linear_regression',   // 線性迴歸
    NEURAL_NETWORK: 'neural_network',        // 神經網路
    REINFORCEMENT: 'reinforcement'           // 強化學習
};

// 反饋類型
const FEEDBACK_TYPES = {
    EXECUTION_SUCCESS: 'execution_success',   // 執行成功
    EXECUTION_FAILURE: 'execution_failure',  // 執行失敗
    USER_RATING: 'user_rating',              // 用戶評分
    PERFORMANCE_METRIC: 'performance_metric', // 性能指標
    MANUAL_CORRECTION: 'manual_correction'    // 手動校正
};

// 學習策略
const LEARNING_STRATEGIES = {
    INCREMENTAL: 'incremental',      // 增量學習
    BATCH: 'batch',                 // 批量學習
    ONLINE: 'online',               // 在線學習
    TRANSFER: 'transfer',           // 遷移學習
    ENSEMBLE: 'ensemble'            // 集成學習
};

/**
 * 學習樣本類
 */
class LearningSample {
    constructor(input, output, context = {}) {
        this.id = this._generateId();
        this.input = input;              // 輸入特徵
        this.output = output;            // 期望輸出
        this.context = context;          // 上下文信息
        this.timestamp = Date.now();
        this.weight = 1.0;              // 樣本權重
        this.quality = null;            // 樣本質量評分
        this.source = 'unknown';        // 樣本來源
    }

    _generateId() {
        return `sample_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 設置樣本權重
     * @param {number} weight - 權重值 (0-1)
     */
    setWeight(weight) {
        this.weight = Math.min(Math.max(weight, 0), 1);
    }

    /**
     * 評估樣本質量
     * @returns {number} 質量分數 (0-1)
     */
    evaluateQuality() {
        let quality = 0.5;

        // 基於上下文豐富度
        const contextKeys = Object.keys(this.context).length;
        quality += Math.min(contextKeys / 10, 0.2);

        // 基於時間新鮮度
        const age = Date.now() - this.timestamp;
        const dayInMs = 24 * 60 * 60 * 1000;
        const freshness = Math.max(0, 1 - (age / (30 * dayInMs))); // 30天衰減
        quality += freshness * 0.3;

        this.quality = Math.min(quality, 1);
        return this.quality;
    }
}

/**
 * 簡單決策樹模型
 */
class SimpleDecisionTree {
    constructor(options = {}) {
        this.maxDepth = options.maxDepth || 5;
        this.minSamples = options.minSamples || 5;
        this.tree = null;
        this.trained = false;
    }

    /**
     * 訓練模型
     * @param {Array} samples - 訓練樣本
     */
    train(samples) {
        if (samples.length < this.minSamples) {
            throw new Error(`樣本數量不足：${samples.length} < ${this.minSamples}`);
        }

        this.tree = this._buildTree(samples, 0);
        this.trained = true;
    }

    /**
     * 預測
     * @param {Object} input - 輸入特徵
     * @returns {Object} 預測結果
     */
    predict(input) {
        if (!this.trained) {
            throw new Error('模型尚未訓練');
        }

        return this._traverse(this.tree, input);
    }

    /**
     * 構建決策樹
     * @private
     */
    _buildTree(samples, depth) {
        // 停止條件
        if (depth >= this.maxDepth || samples.length < this.minSamples) {
            return this._createLeaf(samples);
        }

        // 找到最佳分割
        const bestSplit = this._findBestSplit(samples);
        if (!bestSplit) {
            return this._createLeaf(samples);
        }

        // 分割數據
        const { leftSamples, rightSamples } = this._splitSamples(samples, bestSplit);

        return {
            type: 'internal',
            feature: bestSplit.feature,
            threshold: bestSplit.threshold,
            left: this._buildTree(leftSamples, depth + 1),
            right: this._buildTree(rightSamples, depth + 1),
            samples: samples.length
        };
    }

    /**
     * 創建葉節點
     * @private
     */
    _createLeaf(samples) {
        // 計算類別分佈
        const classCounts = {};
        for (const sample of samples) {
            const label = sample.output.strategy || 'unknown';
            classCounts[label] = (classCounts[label] || 0) + sample.weight;
        }

        // 找到多數類
        let majorityClass = 'unknown';
        let maxCount = 0;
        for (const [cls, count] of Object.entries(classCounts)) {
            if (count > maxCount) {
                maxCount = count;
                majorityClass = cls;
            }
        }

        return {
            type: 'leaf',
            prediction: majorityClass,
            confidence: maxCount / samples.length,
            samples: samples.length,
            distribution: classCounts
        };
    }

    /**
     * 找到最佳分割
     * @private
     */
    _findBestSplit(samples) {
        let bestSplit = null;
        let bestGain = -1;

        // 獲取所有特徵
        const features = this._getFeatures(samples);

        for (const feature of features) {
            // 獲取特徵值
            const values = samples.map(s => this._getFeatureValue(s.input, feature))
                                  .filter(v => v !== undefined)
                                  .sort((a, b) => a - b);

            if (values.length < 2) continue;

            // 嘗試不同閾值
            for (let i = 0; i < values.length - 1; i++) {
                const threshold = (values[i] + values[i + 1]) / 2;
                const gain = this._calculateInformationGain(samples, feature, threshold);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { feature, threshold, gain };
                }
            }
        }

        return bestSplit;
    }

    /**
     * 獲取特徵列表
     * @private
     */
    _getFeatures(samples) {
        const features = new Set();
        for (const sample of samples) {
            this._extractFeatures(sample.input, '', features);
        }
        return Array.from(features);
    }

    /**
     * 提取特徵
     * @private
     */
    _extractFeatures(obj, prefix, features) {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'number') {
                features.add(fullKey);
            } else if (typeof value === 'object' && value !== null) {
                this._extractFeatures(value, fullKey, features);
            }
        }
    }

    /**
     * 獲取特徵值
     * @private
     */
    _getFeatureValue(input, feature) {
        const keys = feature.split('.');
        let value = input;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        return typeof value === 'number' ? value : undefined;
    }

    /**
     * 計算信息增益
     * @private
     */
    _calculateInformationGain(samples, feature, threshold) {
        const { leftSamples, rightSamples } = this._splitSamples(samples, { feature, threshold });

        if (leftSamples.length === 0 || rightSamples.length === 0) {
            return 0;
        }

        const totalEntropy = this._calculateEntropy(samples);
        const leftWeight = leftSamples.length / samples.length;
        const rightWeight = rightSamples.length / samples.length;

        const weightedEntropy = leftWeight * this._calculateEntropy(leftSamples) +
                               rightWeight * this._calculateEntropy(rightSamples);

        return totalEntropy - weightedEntropy;
    }

    /**
     * 分割樣本
     * @private
     */
    _splitSamples(samples, split) {
        const leftSamples = [];
        const rightSamples = [];

        for (const sample of samples) {
            const value = this._getFeatureValue(sample.input, split.feature);
            if (value !== undefined) {
                if (value <= split.threshold) {
                    leftSamples.push(sample);
                } else {
                    rightSamples.push(sample);
                }
            }
        }

        return { leftSamples, rightSamples };
    }

    /**
     * 計算熵
     * @private
     */
    _calculateEntropy(samples) {
        if (samples.length === 0) return 0;

        const classCounts = {};
        let totalWeight = 0;

        for (const sample of samples) {
            const label = sample.output.strategy || 'unknown';
            classCounts[label] = (classCounts[label] || 0) + sample.weight;
            totalWeight += sample.weight;
        }

        let entropy = 0;
        for (const count of Object.values(classCounts)) {
            if (count > 0) {
                const probability = count / totalWeight;
                entropy -= probability * Math.log2(probability);
            }
        }

        return entropy;
    }

    /**
     * 遍歷樹進行預測
     * @private
     */
    _traverse(node, input) {
        if (node.type === 'leaf') {
            return {
                prediction: node.prediction,
                confidence: node.confidence,
                distribution: node.distribution
            };
        }

        const value = this._getFeatureValue(input, node.feature);
        if (value === undefined) {
            // 缺失特徵，返回左子樹結果
            return this._traverse(node.left, input);
        }

        if (value <= node.threshold) {
            return this._traverse(node.left, input);
        } else {
            return this._traverse(node.right, input);
        }
    }

    /**
     * 獲取模型信息
     * @returns {Object} 模型信息
     */
    getInfo() {
        return {
            type: MODEL_TYPES.DECISION_TREE,
            trained: this.trained,
            maxDepth: this.maxDepth,
            minSamples: this.minSamples,
            treeSize: this._getTreeSize(this.tree)
        };
    }

    /**
     * 獲取樹大小
     * @private
     */
    _getTreeSize(node) {
        if (!node) return 0;
        if (node.type === 'leaf') return 1;
        return 1 + this._getTreeSize(node.left) + this._getTreeSize(node.right);
    }
}

/**
 * 學習模塊
 */
class LearningModule extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 學習配置
            strategy: LEARNING_STRATEGIES.INCREMENTAL,
            modelType: MODEL_TYPES.DECISION_TREE,
            learningRate: 0.01,

            // 數據配置
            maxSamples: 10000,
            minSamples: 50,
            sampleWindow: 1000,
            qualityThreshold: 0.5,

            // 更新配置
            updateInterval: 3600000, // 1小時
            evaluationInterval: 1800000, // 30分鐘
            retrainThreshold: 0.1, // 準確率下降10%時重訓

            // 存儲配置
            dataDir: path.join(process.cwd(), '.claude', 'data', 'learning'),
            backupInterval: 86400000, // 1天
            maxBackups: 30,

            ...options
        };

        this.status = LEARNING_STATUS.IDLE;

        // 數據存儲
        this.trainingSamples = [];
        this.testingSamples = [];
        this.feedbackHistory = [];

        // 模型管理
        this.currentModel = null;
        this.modelHistory = [];
        this.modelPerformance = {
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0,
            lastEvaluation: null
        };

        // 學習統計
        this.stats = {
            totalSamples: 0,
            trainedModels: 0,
            predictions: 0,
            correctPredictions: 0,
            averageConfidence: 0,
            learningProgress: 0,
            lastUpdate: null
        };

        // 用戶偏好學習
        this.userPreferences = new Map();
        this.preferencePatterns = new Map();

        // 初始化標記
        this.initialized = false;
        this.learning = false;
    }

    /**
     * 初始化學習模塊
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[LearningModule] 初始化學習模塊...');

            // 創建數據目錄
            await this._ensureDataDirectory();

            // 載入歷史數據
            await this._loadHistoricalData();

            // 初始化模型
            await this._initializeModel();

            // 設置定時更新
            this._setupTimers();

            this.initialized = true;
            console.log('[LearningModule] 學習模塊初始化完成');
            this.emit('initialized');

        } catch (error) {
            console.error('[LearningModule] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 從執行結果學習
     * @param {Object} routingDecision - 路由決策
     * @param {Object} executionResult - 執行結果
     * @param {Object} context - 上下文信息
     */
    async learnFromExecution(routingDecision, executionResult, context = {}) {
        try {
            // 創建學習樣本
            const sample = this._createSample(routingDecision, executionResult, context);

            // 評估樣本質量
            const quality = sample.evaluateQuality();
            if (quality < this.options.qualityThreshold) {
                console.warn(`[LearningModule] 樣本質量過低: ${quality.toFixed(3)}`);
                return;
            }

            // 添加到訓練集
            this._addTrainingSample(sample);

            // 更新統計
            this.stats.totalSamples++;

            // 觸發增量學習
            if (this.options.strategy === LEARNING_STRATEGIES.INCREMENTAL) {
                await this._performIncrementalLearning(sample);
            }

            console.log(`[LearningModule] 學習樣本已添加: 質量=${quality.toFixed(3)}`);
            this.emit('sampleAdded', { sample, quality });

        } catch (error) {
            console.error('[LearningModule] 執行結果學習失敗:', error);
        }
    }

    /**
     * 處理用戶反饋
     * @param {string} decisionId - 決策ID
     * @param {Object} feedback - 反饋信息
     */
    async processFeedback(decisionId, feedback) {
        try {
            const feedbackRecord = {
                id: this._generateId(),
                decisionId,
                feedback,
                timestamp: Date.now(),
                processed: false
            };

            this.feedbackHistory.push(feedbackRecord);

            // 處理不同類型的反饋
            await this._processFeedbackByType(feedbackRecord);

            // 更新用戶偏好
            if (feedback.userPreferences) {
                this._updateUserPreferences(feedback.userPreferences, feedback.userId);
            }

            feedbackRecord.processed = true;

            console.log(`[LearningModule] 處理反饋完成: ${decisionId}`);
            this.emit('feedbackProcessed', feedbackRecord);

        } catch (error) {
            console.error('[LearningModule] 處理反饋失敗:', error);
        }
    }

    /**
     * 預測路由決策
     * @param {Object} analysis - 分析結果
     * @param {Object} context - 上下文
     * @returns {Promise<Object>} 預測結果
     */
    async predict(analysis, context = {}) {
        if (!this.currentModel || !this.currentModel.trained) {
            return this._getDefaultPrediction();
        }

        try {
            // 提取特徵
            const features = this._extractFeatures(analysis, context);

            // 模型預測
            const prediction = this.currentModel.predict(features);

            // 增強預測結果
            const enhancedPrediction = await this._enhancePrediction(prediction, analysis, context);

            // 更新統計
            this.stats.predictions++;
            this.stats.averageConfidence = (
                (this.stats.averageConfidence * (this.stats.predictions - 1) + prediction.confidence) /
                this.stats.predictions
            );

            console.log(`[LearningModule] 預測完成: ${prediction.prediction} (置信度: ${prediction.confidence.toFixed(3)})`);
            return enhancedPrediction;

        } catch (error) {
            console.error('[LearningModule] 預測失敗:', error);
            return this._getDefaultPrediction();
        }
    }

    /**
     * 訓練模型
     * @param {boolean} force - 強制重新訓練
     */
    async trainModel(force = false) {
        if (this.status === LEARNING_STATUS.TRAINING) {
            console.warn('[LearningModule] 模型正在訓練中');
            return;
        }

        if (!force && this.trainingSamples.length < this.options.minSamples) {
            console.warn(`[LearningModule] 訓練樣本不足: ${this.trainingSamples.length} < ${this.options.minSamples}`);
            return;
        }

        this.status = LEARNING_STATUS.TRAINING;
        const startTime = Date.now();

        try {
            console.log(`[LearningModule] 開始模型訓練 (${this.trainingSamples.length} 個樣本)...`);
            this.emit('trainingStarted');

            // 準備訓練數據
            const { trainingSet, testingSet } = this._prepareTrainingData();

            // 創建新模型
            const newModel = this._createModel();

            // 訓練模型
            await newModel.train(trainingSet);

            // 評估模型
            const performance = await this._evaluateModel(newModel, testingSet);

            // 決定是否使用新模型
            if (this._shouldUpdateModel(performance)) {
                this._updateCurrentModel(newModel, performance);
                this.stats.trainedModels++;
            }

            const trainingTime = Date.now() - startTime;
            console.log(`[LearningModule] 模型訓練完成 (耗時: ${trainingTime}ms)`);

            this.status = LEARNING_STATUS.IDLE;
            this.stats.lastUpdate = new Date().toISOString();

            this.emit('trainingCompleted', { performance, trainingTime });

        } catch (error) {
            this.status = LEARNING_STATUS.ERROR;
            console.error('[LearningModule] 模型訓練失敗:', error);
            this.emit('trainingFailed', error);
        }
    }

    /**
     * 評估模型性能
     * @returns {Promise<Object>} 評估結果
     */
    async evaluateModel() {
        if (!this.currentModel || !this.currentModel.trained) {
            return { error: '模型尚未訓練' };
        }

        this.status = LEARNING_STATUS.EVALUATING;

        try {
            console.log('[LearningModule] 開始模型評估...');

            // 準備測試數據
            const testSet = this.testingSamples.length > 0 ?
                          this.testingSamples :
                          this.trainingSamples.slice(-Math.min(100, Math.floor(this.trainingSamples.length * 0.2)));

            const performance = await this._evaluateModel(this.currentModel, testSet);

            this.modelPerformance = {
                ...performance,
                lastEvaluation: new Date().toISOString()
            };

            this.status = LEARNING_STATUS.IDLE;
            console.log(`[LearningModule] 模型評估完成: 準確率=${performance.accuracy.toFixed(3)}`);

            this.emit('evaluationCompleted', performance);
            return performance;

        } catch (error) {
            this.status = LEARNING_STATUS.ERROR;
            console.error('[LearningModule] 模型評估失敗:', error);
            return { error: error.message };
        }
    }

    /**
     * 獲取學習統計
     * @returns {Object} 學習統計信息
     */
    getStats() {
        return {
            ...this.stats,
            status: this.status,
            modelInfo: this.currentModel ? this.currentModel.getInfo() : null,
            performance: this.modelPerformance,
            sampleCounts: {
                training: this.trainingSamples.length,
                testing: this.testingSamples.length,
                feedback: this.feedbackHistory.length
            },
            userPreferences: {
                users: this.userPreferences.size,
                patterns: this.preferencePatterns.size
            }
        };
    }

    /**
     * 獲取用戶偏好
     * @param {string} userId - 用戶ID
     * @returns {Object} 用戶偏好
     */
    getUserPreferences(userId) {
        return this.userPreferences.get(userId) || null;
    }

    /**
     * 重置學習狀態
     * @param {boolean} keepModels - 保留已訓練模型
     */
    async resetLearning(keepModels = false) {
        try {
            console.log('[LearningModule] 重置學習狀態...');

            // 清理數據
            this.trainingSamples = [];
            this.testingSamples = [];
            this.feedbackHistory = [];

            // 重置統計
            this.stats = {
                totalSamples: 0,
                trainedModels: keepModels ? this.stats.trainedModels : 0,
                predictions: 0,
                correctPredictions: 0,
                averageConfidence: 0,
                learningProgress: 0,
                lastUpdate: null
            };

            if (!keepModels) {
                this.currentModel = null;
                this.modelHistory = [];
                this.modelPerformance = {
                    accuracy: 0,
                    precision: 0,
                    recall: 0,
                    f1Score: 0,
                    lastEvaluation: null
                };
            }

            // 清理用戶偏好
            this.userPreferences.clear();
            this.preferencePatterns.clear();

            this.status = LEARNING_STATUS.IDLE;
            console.log('[LearningModule] 學習狀態重置完成');
            this.emit('learningReset');

        } catch (error) {
            console.error('[LearningModule] 重置學習狀態失敗:', error);
            throw error;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 創建學習樣本
     * @private
     */
    _createSample(routingDecision, executionResult, context) {
        // 輸入特徵
        const input = {
            // 命令特徵
            commandType: routingDecision.analysis?.commandType || 'unknown',
            intent: routingDecision.analysis?.intent || 'unknown',
            complexity: routingDecision.analysis?.complexity?.overall || 0.5,
            tokensCount: routingDecision.analysis?.tokens?.length || 0,

            // 上下文特徵
            sessionLength: context.sessionLength || 0,
            recentCommands: context.recentCommands?.length || 0,
            systemLoad: context.systemLoad || 0.5,
            timeOfDay: new Date().getHours() / 24,
            dayOfWeek: new Date().getDay() / 7,

            // 語意特徵
            entitiesCount: routingDecision.analysis?.semantics?.entities?.length || 0,
            topicsCount: routingDecision.analysis?.semantics?.topics?.length || 0,
            sentiment: routingDecision.analysis?.semantics?.sentiment?.score || 0,

            // 需求特徵
            filesCount: routingDecision.analysis?.requirements?.files?.length || 0,
            technologiesCount: routingDecision.analysis?.requirements?.technologies?.length || 0,
            actionsCount: routingDecision.analysis?.requirements?.actions?.length || 0
        };

        // 期望輸出
        const output = {
            strategy: routingDecision.strategy,
            success: executionResult.success,
            executionTime: executionResult.executionTime || 0,
            resourceUsage: executionResult.resourceUsage || 0
        };

        // 創建樣本
        const sample = new LearningSample(input, output, {
            decisionId: routingDecision.decisionId,
            userId: context.userId,
            sessionId: context.sessionId,
            confidence: routingDecision.confidence || 0.5
        });

        // 設置樣本來源和權重
        sample.source = FEEDBACK_TYPES.EXECUTION_SUCCESS;
        if (executionResult.success) {
            sample.setWeight(Math.min(routingDecision.confidence * 1.2, 1.0));
        } else {
            sample.setWeight(Math.max(routingDecision.confidence * 0.5, 0.1));
        }

        return sample;
    }

    /**
     * 添加訓練樣本
     * @private
     */
    _addTrainingSample(sample) {
        this.trainingSamples.push(sample);

        // 限制樣本數量
        if (this.trainingSamples.length > this.options.maxSamples) {
            // 移除最舊的低質量樣本
            this.trainingSamples.sort((a, b) => {
                const scoreA = a.quality + (a.timestamp / Date.now()) * 0.1;
                const scoreB = b.quality + (b.timestamp / Date.now()) * 0.1;
                return scoreA - scoreB;
            });

            const removeCount = this.trainingSamples.length - this.options.maxSamples;
            this.trainingSamples.splice(0, removeCount);
        }
    }

    /**
     * 執行增量學習
     * @private
     */
    async _performIncrementalLearning(sample) {
        // 簡化的增量學習 - 當累積一定數量樣本時重新訓練
        if (this.trainingSamples.length % 50 === 0) {
            await this.trainModel();
        }
    }

    /**
     * 根據類型處理反饋
     * @private
     */
    async _processFeedbackByType(feedbackRecord) {
        const { feedback } = feedbackRecord;

        switch (feedback.type) {
            case FEEDBACK_TYPES.USER_RATING:
                await this._processUserRating(feedbackRecord);
                break;

            case FEEDBACK_TYPES.MANUAL_CORRECTION:
                await this._processManualCorrection(feedbackRecord);
                break;

            case FEEDBACK_TYPES.PERFORMANCE_METRIC:
                await this._processPerformanceMetric(feedbackRecord);
                break;

            default:
                console.warn(`[LearningModule] 未知反饋類型: ${feedback.type}`);
        }
    }

    /**
     * 處理用戶評分反饋
     * @private
     */
    async _processUserRating(feedbackRecord) {
        const { feedback } = feedbackRecord;

        // 根據評分調整對應樣本的權重
        const rating = feedback.rating; // 假設是1-5的評分
        const weight = (rating - 1) / 4; // 轉換為0-1的權重

        // 找到對應的樣本並調整權重
        const relatedSample = this.trainingSamples.find(s =>
            s.context.decisionId === feedbackRecord.decisionId
        );

        if (relatedSample) {
            relatedSample.setWeight(weight);
            console.log(`[LearningModule] 根據用戶評分調整樣本權重: ${weight.toFixed(3)}`);
        }
    }

    /**
     * 處理手動校正反饋
     * @private
     */
    async _processManualCorrection(feedbackRecord) {
        const { feedback } = feedbackRecord;

        // 創建新的校正樣本
        if (feedback.correctStrategy) {
            const originalSample = this.trainingSamples.find(s =>
                s.context.decisionId === feedbackRecord.decisionId
            );

            if (originalSample) {
                const correctedSample = new LearningSample(
                    originalSample.input,
                    { ...originalSample.output, strategy: feedback.correctStrategy },
                    originalSample.context
                );

                correctedSample.source = FEEDBACK_TYPES.MANUAL_CORRECTION;
                correctedSample.setWeight(1.0); // 手動校正權重最高

                this._addTrainingSample(correctedSample);
                console.log('[LearningModule] 添加手動校正樣本');
            }
        }
    }

    /**
     * 處理性能指標反饋
     * @private
     */
    async _processPerformanceMetric(feedbackRecord) {
        const { feedback } = feedbackRecord;

        // 更新預測準確性統計
        if (feedback.actualOutcome !== undefined && feedback.predictedOutcome !== undefined) {
            if (feedback.actualOutcome === feedback.predictedOutcome) {
                this.stats.correctPredictions++;
            }
        }

        // 檢查是否需要重新訓練
        const accuracy = this.stats.predictions > 0 ?
                        this.stats.correctPredictions / this.stats.predictions : 0;

        if (this.modelPerformance.accuracy - accuracy > this.options.retrainThreshold) {
            console.log('[LearningModule] 性能下降，觸發模型重訓');
            await this.trainModel();
        }
    }

    /**
     * 更新用戶偏好
     * @private
     */
    _updateUserPreferences(preferences, userId) {
        if (!userId) return;

        const existing = this.userPreferences.get(userId) || {
            strategies: {},
            complexity: { preferred: 0.5, range: [0, 1] },
            domains: {},
            updateCount: 0
        };

        // 更新策略偏好
        if (preferences.preferredStrategy) {
            existing.strategies[preferences.preferredStrategy] =
                (existing.strategies[preferences.preferredStrategy] || 0) + 1;
        }

        // 更新複雜度偏好
        if (preferences.complexityPreference !== undefined) {
            const alpha = 0.1; // 學習率
            existing.complexity.preferred =
                existing.complexity.preferred * (1 - alpha) +
                preferences.complexityPreference * alpha;
        }

        existing.updateCount++;
        existing.lastUpdate = Date.now();

        this.userPreferences.set(userId, existing);

        // 更新偏好模式
        this._updatePreferencePatterns(userId, existing);
    }

    /**
     * 更新偏好模式
     * @private
     */
    _updatePreferencePatterns(userId, preferences) {
        // 識別用戶偏好模式
        const pattern = {
            dominantStrategy: this._getMostFrequent(preferences.strategies),
            complexityRange: preferences.complexity.range,
            consistencyScore: this._calculatePreferenceConsistency(preferences)
        };

        this.preferencePatterns.set(userId, pattern);
    }

    /**
     * 獲取最頻繁項目
     * @private
     */
    _getMostFrequent(frequency) {
        let maxCount = 0;
        let mostFrequent = null;

        for (const [item, count] of Object.entries(frequency)) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = item;
            }
        }

        return mostFrequent;
    }

    /**
     * 計算偏好一致性
     * @private
     */
    _calculatePreferenceConsistency(preferences) {
        const strategyCounts = Object.values(preferences.strategies);
        if (strategyCounts.length === 0) return 0;

        const total = strategyCounts.reduce((sum, count) => sum + count, 0);
        const maxCount = Math.max(...strategyCounts);

        return maxCount / total;
    }

    /**
     * 提取特徵
     * @private
     */
    _extractFeatures(analysis, context) {
        return {
            // 命令特徵
            commandType: analysis.commandType || 'unknown',
            intent: analysis.intent || 'unknown',
            complexity: analysis.complexity?.overall || 0.5,
            tokensCount: analysis.tokens?.length || 0,

            // 上下文特徵
            sessionLength: context.sessionLength || 0,
            recentCommands: context.recentCommands?.length || 0,
            systemLoad: context.systemLoad || 0.5,
            timeOfDay: new Date().getHours() / 24,

            // 語意特徵
            entitiesCount: analysis.semantics?.entities?.length || 0,
            topicsCount: analysis.semantics?.topics?.length || 0,
            sentiment: analysis.semantics?.sentiment?.score || 0,

            // 需求特徵
            filesCount: analysis.requirements?.files?.length || 0,
            technologiesCount: analysis.requirements?.technologies?.length || 0
        };
    }

    /**
     * 增強預測結果
     * @private
     */
    async _enhancePrediction(prediction, analysis, context) {
        // 基於用戶偏好調整預測
        if (context.userId && this.userPreferences.has(context.userId)) {
            const userPref = this.userPreferences.get(context.userId);

            // 如果預測結果與用戶偏好不符，降低置信度
            if (userPref.strategies[prediction.prediction]) {
                prediction.confidence *= 1.1; // 提高置信度
            } else {
                prediction.confidence *= 0.9; // 降低置信度
            }

            prediction.confidence = Math.min(prediction.confidence, 1.0);
        }

        // 添加解釋信息
        prediction.explanation = this._generatePredictionExplanation(prediction, analysis);

        return prediction;
    }

    /**
     * 生成預測解釋
     * @private
     */
    _generatePredictionExplanation(prediction, analysis) {
        const reasons = [];

        if (prediction.confidence > 0.8) {
            reasons.push('模型對此預測非常有信心');
        } else if (prediction.confidence < 0.5) {
            reasons.push('模型對此預測信心不足');
        }

        if (analysis.complexity?.overall > 0.7) {
            reasons.push('任務複雜度較高');
        }

        if (analysis.intent) {
            reasons.push(`基於命令意圖：${analysis.intent}`);
        }

        return reasons.join('；');
    }

    /**
     * 獲取預設預測
     * @private
     */
    _getDefaultPrediction() {
        return {
            prediction: 'dynamic', // 預設使用動態路由
            confidence: 0.5,
            explanation: '使用預設路由策略'
        };
    }

    /**
     * 準備訓練數據
     * @private
     */
    _prepareTrainingData() {
        const shuffled = [...this.trainingSamples].sort(() => Math.random() - 0.5);
        const splitPoint = Math.floor(shuffled.length * 0.8);

        return {
            trainingSet: shuffled.slice(0, splitPoint),
            testingSet: shuffled.slice(splitPoint)
        };
    }

    /**
     * 創建模型
     * @private
     */
    _createModel() {
        switch (this.options.modelType) {
            case MODEL_TYPES.DECISION_TREE:
                return new SimpleDecisionTree({
                    maxDepth: 10,
                    minSamples: Math.max(5, Math.floor(this.trainingSamples.length / 100))
                });

            default:
                return new SimpleDecisionTree();
        }
    }

    /**
     * 評估模型
     * @private
     */
    async _evaluateModel(model, testSet) {
        if (testSet.length === 0) {
            return {
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1Score: 0,
                samples: 0
            };
        }

        let correct = 0;
        const predictions = {};
        const actuals = {};

        for (const sample of testSet) {
            const prediction = model.predict(sample.input);
            const actual = sample.output.strategy;

            if (prediction.prediction === actual) {
                correct++;
            }

            // 統計混淆矩陣
            predictions[prediction.prediction] = (predictions[prediction.prediction] || 0) + 1;
            actuals[actual] = (actuals[actual] || 0) + 1;
        }

        const accuracy = correct / testSet.length;

        // 簡化的精確率和召回率計算
        const precision = accuracy; // 簡化
        const recall = accuracy;    // 簡化
        const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

        return {
            accuracy,
            precision,
            recall,
            f1Score,
            samples: testSet.length
        };
    }

    /**
     * 決定是否更新模型
     * @private
     */
    _shouldUpdateModel(newPerformance) {
        if (!this.currentModel || !this.currentModel.trained) {
            return true;
        }

        // 新模型準確率必須高於當前模型
        return newPerformance.accuracy > this.modelPerformance.accuracy + 0.01;
    }

    /**
     * 更新當前模型
     * @private
     */
    _updateCurrentModel(newModel, performance) {
        // 備份當前模型
        if (this.currentModel) {
            this.modelHistory.push({
                model: this.currentModel,
                performance: this.modelPerformance,
                timestamp: Date.now()
            });

            // 限制歷史模型數量
            if (this.modelHistory.length > 10) {
                this.modelHistory.shift();
            }
        }

        // 更新當前模型
        this.currentModel = newModel;
        this.modelPerformance = performance;

        console.log(`[LearningModule] 模型已更新，準確率: ${performance.accuracy.toFixed(3)}`);
    }

    /**
     * 確保數據目錄存在
     * @private
     */
    async _ensureDataDirectory() {
        try {
            await fs.mkdir(this.options.dataDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * 載入歷史數據
     * @private
     */
    async _loadHistoricalData() {
        try {
            const samplesFile = path.join(this.options.dataDir, 'samples.json');
            const data = await fs.readFile(samplesFile, 'utf8');
            const parsed = JSON.parse(data);

            // 重建學習樣本
            this.trainingSamples = parsed.samples.map(s => {
                const sample = new LearningSample(s.input, s.output, s.context);
                sample.weight = s.weight;
                sample.quality = s.quality;
                sample.source = s.source;
                sample.timestamp = s.timestamp;
                return sample;
            });

            console.log(`[LearningModule] 載入 ${this.trainingSamples.length} 個歷史樣本`);

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[LearningModule] 載入歷史數據失敗:', error);
            }
        }
    }

    /**
     * 初始化模型
     * @private
     */
    async _initializeModel() {
        if (this.trainingSamples.length >= this.options.minSamples) {
            console.log('[LearningModule] 基於歷史數據初始化模型...');
            await this.trainModel();
        } else {
            console.log('[LearningModule] 歷史數據不足，跳過模型初始化');
        }
    }

    /**
     * 設置定時器
     * @private
     */
    _setupTimers() {
        // 定期模型更新
        setInterval(async () => {
            if (this.trainingSamples.length >= this.options.minSamples) {
                await this.trainModel();
            }
        }, this.options.updateInterval);

        // 定期模型評估
        setInterval(async () => {
            if (this.currentModel && this.currentModel.trained) {
                await this.evaluateModel();
            }
        }, this.options.evaluationInterval);

        // 定期數據備份
        setInterval(async () => {
            await this._backupData();
        }, this.options.backupInterval);
    }

    /**
     * 備份數據
     * @private
     */
    async _backupData() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                samples: this.trainingSamples.map(s => ({
                    input: s.input,
                    output: s.output,
                    context: s.context,
                    weight: s.weight,
                    quality: s.quality,
                    source: s.source,
                    timestamp: s.timestamp
                })),
                stats: this.stats,
                userPreferences: Object.fromEntries(this.userPreferences),
                preferencePatterns: Object.fromEntries(this.preferencePatterns)
            };

            const backupFile = path.join(this.options.dataDir, `backup_${Date.now()}.json`);
            await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));

            // 清理舊備份
            await this._cleanupOldBackups();

            console.log(`[LearningModule] 數據備份完成: ${backupFile}`);

        } catch (error) {
            console.error('[LearningModule] 數據備份失敗:', error);
        }
    }

    /**
     * 清理舊備份
     * @private
     */
    async _cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.options.dataDir);
            const backupFiles = files
                .filter(f => f.startsWith('backup_'))
                .map(f => ({
                    name: f,
                    path: path.join(this.options.dataDir, f),
                    time: parseInt(f.match(/backup_(\d+)\.json$/)?.[1] || '0')
                }))
                .sort((a, b) => b.time - a.time);

            // 保留最新的備份
            const toDelete = backupFiles.slice(this.options.maxBackups);
            for (const backup of toDelete) {
                await fs.unlink(backup.path);
            }

            if (toDelete.length > 0) {
                console.log(`[LearningModule] 清理 ${toDelete.length} 個舊備份`);
            }

        } catch (error) {
            console.warn('[LearningModule] 清理舊備份失敗:', error);
        }
    }

    /**
     * 生成ID
     * @private
     */
    _generateId() {
        return `learning_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            this.learning = false;

            // 保存當前數據
            await this._backupData();

            // 清理內存
            this.trainingSamples.length = 0;
            this.testingSamples.length = 0;
            this.feedbackHistory.length = 0;
            this.modelHistory.length = 0;
            this.userPreferences.clear();
            this.preferencePatterns.clear();

            // 移除事件監聽器
            this.removeAllListeners();

            console.log('[LearningModule] 資源清理完成');

        } catch (error) {
            console.error('[LearningModule] 資源清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
LearningModule.LEARNING_STATUS = LEARNING_STATUS;
LearningModule.MODEL_TYPES = MODEL_TYPES;
LearningModule.FEEDBACK_TYPES = FEEDBACK_TYPES;
LearningModule.LEARNING_STRATEGIES = LEARNING_STRATEGIES;

export default LearningModule;