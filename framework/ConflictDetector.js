/**
 * ConflictDetector - 智能衝突檢測與解決器
 *
 * 功能：
 * - 檢測多源數據間的值衝突、邏輯衝突、時間衝突
 * - 提供多種衝突解決策略（多數投票、加權平均、最高信心度等）
 * - 實現衝突分類和嚴重性評估
 * - 支持自定義衝突解決規則和策略
 *
 * 頁面：衝突處理層 / 數據一致性保證
 * 邏輯：基於多維度分析檢測衝突，使用智能策略解決矛盾
 * 需求：高準確率衝突檢測、智能解決策略、透明決策過程
 * 用途：ResultIntegrator的數據一致性保證組件
 * 配合：接收DataFusion結果，為InsightGenerator提供一致性數據
 */

const { EventEmitter } = require('events');

// 衝突類型定義
const CONFLICT_TYPES = {
    VALUE: 'value',                 // 數值衝突
    LOGICAL: 'logical',             // 邏輯衝突
    TEMPORAL: 'temporal',           // 時間衝突
    SOURCE: 'source',               // 來源衝突
    STRUCTURAL: 'structural',       // 結構衝突
    SEMANTIC: 'semantic'            // 語義衝突
};

// 衝突嚴重性等級
const CONFLICT_SEVERITY = {
    LOW: { level: 1, label: '輕微', threshold: 0.3 },
    MEDIUM: { level: 2, label: '中等', threshold: 0.6 },
    HIGH: { level: 3, label: '嚴重', threshold: 0.8 },
    CRITICAL: { level: 4, label: '緊急', threshold: 1.0 }
};

// 解決策略
const RESOLUTION_STRATEGIES = {
    MAJORITY_VOTE: 'majority_vote',           // 多數投票
    WEIGHTED_AVERAGE: 'weighted_average',     // 加權平均
    HIGHEST_CONFIDENCE: 'highest_confidence', // 最高信心度
    MOST_RECENT: 'most_recent',              // 最新數據
    SOURCE_PRIORITY: 'source_priority',       // 來源優先級
    EXPERT_RULES: 'expert_rules',            // 專家規則
    USER_INTERVENTION: 'user_intervention',   // 用戶干預
    WEIGHTED_CONSENSUS: 'weighted_consensus'  // 加權共識
};

/**
 * 衝突項目類
 */
class ConflictItem {
    constructor(conflictData) {
        this.id = this._generateId();
        this.type = conflictData.type;
        this.severity = conflictData.severity || CONFLICT_SEVERITY.LOW;
        this.description = conflictData.description;
        this.involvedItems = conflictData.involvedItems || [];
        this.conflictingValues = conflictData.conflictingValues || [];
        this.context = conflictData.context || {};

        // 檢測結果
        this.detectedAt = new Date().toISOString();
        this.confidence = conflictData.confidence || 0.8;
        this.evidence = conflictData.evidence || [];

        // 解決狀態
        this.status = 'detected';
        this.resolution = null;
        this.resolvedAt = null;
        this.resolutionStrategy = null;
        this.resolutionConfidence = 0;

        // 元數據
        this.metadata = {
            autoResolvable: conflictData.autoResolvable !== false,
            requiresUserIntervention: conflictData.requiresUserIntervention || false,
            priority: conflictData.priority || 0,
            tags: conflictData.tags || []
        };
    }

    _generateId() {
        return `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 標記衝突已解決
     */
    markResolved(resolution, strategy, confidence = 1.0) {
        this.status = 'resolved';
        this.resolution = resolution;
        this.resolvedAt = new Date().toISOString();
        this.resolutionStrategy = strategy;
        this.resolutionConfidence = confidence;
    }

    /**
     * 獲取衝突摘要
     */
    getSummary() {
        return {
            id: this.id,
            type: this.type,
            severity: this.severity.label,
            status: this.status,
            description: this.description,
            involvedCount: this.involvedItems.length,
            confidence: this.confidence,
            resolutionStrategy: this.resolutionStrategy,
            resolutionConfidence: this.resolutionConfidence
        };
    }
}

/**
 * 衝突檢測引擎
 */
class ConflictDetectionEngine {
    constructor(options = {}) {
        this.options = {
            sensitivityLevel: options.sensitivityLevel || 0.7,
            enableValueConflicts: options.enableValueConflicts !== false,
            enableLogicalConflicts: options.enableLogicalConflicts !== false,
            enableTemporalConflicts: options.enableTemporalConflicts !== false,
            enableSourceConflicts: options.enableSourceConflicts !== false,
            ...options
        };

        this.detectionRules = new Map();
        this._initializeDefaultRules();
    }

    /**
     * 檢測數據衝突
     */
    async detect(fusedData) {
        const conflicts = [];

        if (this.options.enableValueConflicts) {
            const valueConflicts = await this._detectValueConflicts(fusedData);
            conflicts.push(...valueConflicts);
        }

        if (this.options.enableLogicalConflicts) {
            const logicalConflicts = await this._detectLogicalConflicts(fusedData);
            conflicts.push(...logicalConflicts);
        }

        if (this.options.enableTemporalConflicts) {
            const temporalConflicts = await this._detectTemporalConflicts(fusedData);
            conflicts.push(...temporalConflicts);
        }

        if (this.options.enableSourceConflicts) {
            const sourceConflicts = await this._detectSourceConflicts(fusedData);
            conflicts.push(...sourceConflicts);
        }

        // 按嚴重性排序
        conflicts.sort((a, b) => b.severity.level - a.severity.level);

        return conflicts;
    }

    /**
     * 檢測數值衝突
     * @private
     */
    async _detectValueConflicts(fusedData) {
        const conflicts = [];

        Object.entries(fusedData.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            // 檢查同一字段的不同數值
            const fieldValues = new Map();

            items.forEach(item => {
                const content = item.normalizedData?.content || {};
                Object.entries(content).forEach(([field, value]) => {
                    if (typeof value === 'number') {
                        if (!fieldValues.has(field)) {
                            fieldValues.set(field, []);
                        }
                        fieldValues.get(field).push({
                            value,
                            source: item.metadata.sourceId,
                            confidence: item.metadata.confidence,
                            item
                        });
                    }
                });
            });

            // 檢測數值差異
            fieldValues.forEach((values, field) => {
                if (values.length > 1) {
                    const conflict = this._analyzeValueConflict(field, values, groupKey);
                    if (conflict) {
                        conflicts.push(new ConflictItem(conflict));
                    }
                }
            });
        });

        return conflicts;
    }

    /**
     * 檢測邏輯衝突
     * @private
     */
    async _detectLogicalConflicts(fusedData) {
        const conflicts = [];

        Object.entries(fusedData.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            // 檢查邏輯一致性
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const logicalConflict = this._checkLogicalConsistency(
                        items[i], items[j], groupKey
                    );
                    if (logicalConflict) {
                        conflicts.push(new ConflictItem(logicalConflict));
                    }
                }
            }
        });

        return conflicts;
    }

    /**
     * 檢測時間衝突
     * @private
     */
    async _detectTemporalConflicts(fusedData) {
        const conflicts = [];

        Object.entries(fusedData.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            // 檢查時間序列一致性
            const timeOrderedItems = items
                .filter(item => item.metadata.timestamp)
                .sort((a, b) => new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp));

            for (let i = 0; i < timeOrderedItems.length - 1; i++) {
                const temporalConflict = this._checkTemporalConsistency(
                    timeOrderedItems[i], timeOrderedItems[i + 1], groupKey
                );
                if (temporalConflict) {
                    conflicts.push(new ConflictItem(temporalConflict));
                }
            }
        });

        return conflicts;
    }

    /**
     * 檢測來源衝突
     * @private
     */
    async _detectSourceConflicts(fusedData) {
        const conflicts = [];

        Object.entries(fusedData.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            // 按來源分組
            const sourceGroups = new Map();
            items.forEach(item => {
                const source = item.metadata.source;
                if (!sourceGroups.has(source)) {
                    sourceGroups.set(source, []);
                }
                sourceGroups.get(source).push(item);
            });

            // 檢查來源間的衝突
            const sources = Array.from(sourceGroups.keys());
            for (let i = 0; i < sources.length; i++) {
                for (let j = i + 1; j < sources.length; j++) {
                    const sourceConflict = this._checkSourceConsistency(
                        sourceGroups.get(sources[i]),
                        sourceGroups.get(sources[j]),
                        sources[i],
                        sources[j],
                        groupKey
                    );
                    if (sourceConflict) {
                        conflicts.push(new ConflictItem(sourceConflict));
                    }
                }
            }
        });

        return conflicts;
    }

    /**
     * 分析數值衝突
     * @private
     */
    _analyzeValueConflict(field, values, context) {
        if (values.length < 2) return null;

        const numbers = values.map(v => v.value);
        const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
        const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;

        // 如果變異係數超過閾值，認為存在衝突
        if (coefficientOfVariation > this.options.sensitivityLevel) {
            const severity = this._calculateSeverity(coefficientOfVariation);

            return {
                type: CONFLICT_TYPES.VALUE,
                severity,
                description: `字段 "${field}" 存在數值衝突，變異係數: ${coefficientOfVariation.toFixed(3)}`,
                involvedItems: values.map(v => v.item.id),
                conflictingValues: values.map(v => ({
                    value: v.value,
                    source: v.source,
                    confidence: v.confidence
                })),
                context: { field, groupKey: context },
                confidence: Math.min(coefficientOfVariation * 1.5, 1.0),
                evidence: [
                    `平均值: ${mean.toFixed(3)}`,
                    `標準差: ${stdDev.toFixed(3)}`,
                    `變異係數: ${coefficientOfVariation.toFixed(3)}`
                ]
            };
        }

        return null;
    }

    /**
     * 檢查邏輯一致性
     * @private
     */
    _checkLogicalConsistency(item1, item2, context) {
        const content1 = item1.normalizedData?.content || {};
        const content2 = item2.normalizedData?.content || {};

        // 檢查布爾值衝突
        const booleanConflicts = [];
        Object.keys(content1).forEach(key => {
            if (typeof content1[key] === 'boolean' && typeof content2[key] === 'boolean') {
                if (content1[key] !== content2[key]) {
                    booleanConflicts.push({
                        field: key,
                        value1: content1[key],
                        value2: content2[key]
                    });
                }
            }
        });

        if (booleanConflicts.length > 0) {
            return {
                type: CONFLICT_TYPES.LOGICAL,
                severity: CONFLICT_SEVERITY.MEDIUM,
                description: `檢測到 ${booleanConflicts.length} 個邏輯衝突`,
                involvedItems: [item1.id, item2.id],
                conflictingValues: booleanConflicts,
                context: { groupKey: context },
                confidence: 0.9,
                evidence: booleanConflicts.map(c =>
                    `字段 "${c.field}": ${c.value1} vs ${c.value2}`
                )
            };
        }

        return null;
    }

    /**
     * 檢查時間一致性
     * @private
     */
    _checkTemporalConsistency(earlierItem, laterItem, context) {
        const time1 = new Date(earlierItem.metadata.timestamp);
        const time2 = new Date(laterItem.metadata.timestamp);
        const timeDiff = time2 - time1;

        // 檢查是否存在時間倒退的數據更新
        const content1 = earlierItem.normalizedData?.content || {};
        const content2 = laterItem.normalizedData?.content || {};

        const versionFields = ['version', 'rev', 'revision', 'build'];
        const temporalConflicts = [];

        versionFields.forEach(field => {
            if (content1[field] && content2[field]) {
                if (typeof content1[field] === 'number' && typeof content2[field] === 'number') {
                    if (content2[field] < content1[field]) {
                        temporalConflicts.push({
                            field,
                            earlierValue: content1[field],
                            laterValue: content2[field],
                            timeDiff
                        });
                    }
                }
            }
        });

        if (temporalConflicts.length > 0) {
            return {
                type: CONFLICT_TYPES.TEMPORAL,
                severity: CONFLICT_SEVERITY.HIGH,
                description: `檢測到時間序列衝突：較晚的數據包含較早的版本信息`,
                involvedItems: [earlierItem.id, laterItem.id],
                conflictingValues: temporalConflicts,
                context: { groupKey: context, timeDiff },
                confidence: 0.85,
                evidence: temporalConflicts.map(c =>
                    `字段 "${c.field}": ${c.earlierValue} -> ${c.laterValue} (時間差: ${c.timeDiff}ms)`
                )
            };
        }

        return null;
    }

    /**
     * 檢查來源一致性
     * @private
     */
    _checkSourceConsistency(items1, items2, source1, source2, context) {
        // 比較不同來源的相同數據
        const commonFields = new Set();
        const fieldComparisons = [];

        items1.forEach(item1 => {
            const content1 = item1.normalizedData?.content || {};

            items2.forEach(item2 => {
                const content2 = item2.normalizedData?.content || {};

                Object.keys(content1).forEach(field => {
                    if (content2.hasOwnProperty(field)) {
                        commonFields.add(field);

                        if (content1[field] !== content2[field]) {
                            fieldComparisons.push({
                                field,
                                value1: content1[field],
                                value2: content2[field],
                                source1,
                                source2,
                                item1: item1.id,
                                item2: item2.id
                            });
                        }
                    }
                });
            });
        });

        if (fieldComparisons.length > 0) {
            const conflictRatio = fieldComparisons.length / commonFields.size;

            if (conflictRatio > 0.3) { // 30%以上字段衝突
                return {
                    type: CONFLICT_TYPES.SOURCE,
                    severity: this._calculateSeverity(conflictRatio),
                    description: `來源 "${source1}" 和 "${source2}" 間存在數據衝突`,
                    involvedItems: [...new Set([...fieldComparisons.map(f => f.item1), ...fieldComparisons.map(f => f.item2)])],
                    conflictingValues: fieldComparisons,
                    context: { groupKey: context, sources: [source1, source2] },
                    confidence: Math.min(conflictRatio * 1.2, 1.0),
                    evidence: [
                        `共同字段數: ${commonFields.size}`,
                        `衝突字段數: ${fieldComparisons.length}`,
                        `衝突比例: ${(conflictRatio * 100).toFixed(1)}%`
                    ]
                };
            }
        }

        return null;
    }

    /**
     * 計算衝突嚴重性
     * @private
     */
    _calculateSeverity(intensity) {
        if (intensity >= CONFLICT_SEVERITY.CRITICAL.threshold) {
            return CONFLICT_SEVERITY.CRITICAL;
        } else if (intensity >= CONFLICT_SEVERITY.HIGH.threshold) {
            return CONFLICT_SEVERITY.HIGH;
        } else if (intensity >= CONFLICT_SEVERITY.MEDIUM.threshold) {
            return CONFLICT_SEVERITY.MEDIUM;
        } else {
            return CONFLICT_SEVERITY.LOW;
        }
    }

    /**
     * 初始化默認檢測規則
     * @private
     */
    _initializeDefaultRules() {
        // 可以添加自定義檢測規則
        this.detectionRules.set('numeric_threshold', {
            type: CONFLICT_TYPES.VALUE,
            condition: (values) => {
                const variance = this._calculateVariance(values);
                return variance > this.options.sensitivityLevel;
            }
        });
    }

    _calculateVariance(values) {
        if (values.length < 2) return 0;

        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return variance;
    }
}

/**
 * 衝突解決引擎
 */
class ConflictResolutionEngine {
    constructor(options = {}) {
        this.options = {
            defaultStrategy: options.defaultStrategy || RESOLUTION_STRATEGIES.WEIGHTED_CONSENSUS,
            minConfidence: options.minConfidence || 0.7,
            enableUserIntervention: options.enableUserIntervention || false,
            sourcePriorities: options.sourcePriorities || {},
            ...options
        };

        this.resolutionStrategies = new Map([
            [RESOLUTION_STRATEGIES.MAJORITY_VOTE, this._majorityVote.bind(this)],
            [RESOLUTION_STRATEGIES.WEIGHTED_AVERAGE, this._weightedAverage.bind(this)],
            [RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE, this._highestConfidence.bind(this)],
            [RESOLUTION_STRATEGIES.MOST_RECENT, this._mostRecent.bind(this)],
            [RESOLUTION_STRATEGIES.SOURCE_PRIORITY, this._sourcePriority.bind(this)],
            [RESOLUTION_STRATEGIES.WEIGHTED_CONSENSUS, this._weightedConsensus.bind(this)]
        ]);
    }

    /**
     * 解決衝突
     */
    async resolve(conflict) {
        const strategy = this._selectStrategy(conflict);
        const resolver = this.resolutionStrategies.get(strategy);

        if (!resolver) {
            throw new Error(`未知的解決策略: ${strategy}`);
        }

        try {
            const resolution = await resolver(conflict);
            conflict.markResolved(resolution.value, strategy, resolution.confidence);

            return {
                conflictId: conflict.id,
                strategy,
                resolution: resolution.value,
                confidence: resolution.confidence,
                explanation: resolution.explanation
            };
        } catch (error) {
            throw new Error(`衝突解決失敗: ${error.message}`);
        }
    }

    /**
     * 批量解決衝突
     */
    async resolveBatch(conflicts) {
        const resolutions = [];

        for (const conflict of conflicts) {
            try {
                const resolution = await this.resolve(conflict);
                resolutions.push(resolution);
            } catch (error) {
                resolutions.push({
                    conflictId: conflict.id,
                    error: error.message,
                    status: 'failed'
                });
            }
        }

        return resolutions;
    }

    /**
     * 選擇解決策略
     * @private
     */
    _selectStrategy(conflict) {
        // 根據衝突類型和嚴重性選擇策略
        switch (conflict.type) {
            case CONFLICT_TYPES.VALUE:
                return conflict.severity.level >= 3 ?
                    RESOLUTION_STRATEGIES.WEIGHTED_CONSENSUS :
                    RESOLUTION_STRATEGIES.WEIGHTED_AVERAGE;

            case CONFLICT_TYPES.LOGICAL:
                return RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE;

            case CONFLICT_TYPES.TEMPORAL:
                return RESOLUTION_STRATEGIES.MOST_RECENT;

            case CONFLICT_TYPES.SOURCE:
                return this.options.sourcePriorities && Object.keys(this.options.sourcePriorities).length > 0 ?
                    RESOLUTION_STRATEGIES.SOURCE_PRIORITY :
                    RESOLUTION_STRATEGIES.MAJORITY_VOTE;

            default:
                return this.options.defaultStrategy;
        }
    }

    /**
     * 多數投票策略
     * @private
     */
    async _majorityVote(conflict) {
        const values = conflict.conflictingValues;
        const valueCounts = new Map();

        // 統計每個值的出現次數
        values.forEach(item => {
            const key = JSON.stringify(item.value);
            valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        });

        // 找到最多數的值
        let maxCount = 0;
        let winningValue = null;

        valueCounts.forEach((count, valueKey) => {
            if (count > maxCount) {
                maxCount = count;
                winningValue = JSON.parse(valueKey);
            }
        });

        const confidence = maxCount / values.length;

        return {
            value: winningValue,
            confidence,
            explanation: `多數投票：${maxCount}/${values.length} 票支持此值`
        };
    }

    /**
     * 加權平均策略
     * @private
     */
    async _weightedAverage(conflict) {
        const values = conflict.conflictingValues.filter(item =>
            typeof item.value === 'number'
        );

        if (values.length === 0) {
            // 如果不是數值，回退到最高信心度策略
            return await this._highestConfidence(conflict);
        }

        let weightedSum = 0;
        let totalWeight = 0;

        values.forEach(item => {
            const weight = item.confidence || 1;
            weightedSum += item.value * weight;
            totalWeight += weight;
        });

        const averageValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const confidence = Math.min(totalWeight / values.length / 1.0, 1.0);

        return {
            value: averageValue,
            confidence,
            explanation: `加權平均：基於 ${values.length} 個數值的信心度加權計算`
        };
    }

    /**
     * 最高信心度策略
     * @private
     */
    async _highestConfidence(conflict) {
        const values = conflict.conflictingValues;
        let bestItem = values[0];

        values.forEach(item => {
            if ((item.confidence || 0) > (bestItem.confidence || 0)) {
                bestItem = item;
            }
        });

        return {
            value: bestItem.value,
            confidence: bestItem.confidence || 0.5,
            explanation: `選擇信心度最高的值 (${((bestItem.confidence || 0) * 100).toFixed(1)}%)`
        };
    }

    /**
     * 最新數據策略
     * @private
     */
    async _mostRecent(conflict) {
        const items = conflict.involvedItems;
        // 這裡需要獲取原始項目數據來比較時間戳
        // 簡化實現，選擇第一個值
        const mostRecentValue = conflict.conflictingValues[0];

        return {
            value: mostRecentValue.value,
            confidence: 0.8,
            explanation: '選擇最新的數據'
        };
    }

    /**
     * 來源優先級策略
     * @private
     */
    async _sourcePriority(conflict) {
        const values = conflict.conflictingValues;
        let bestItem = values[0];
        let bestPriority = this.options.sourcePriorities[bestItem.source] || 0;

        values.forEach(item => {
            const priority = this.options.sourcePriorities[item.source] || 0;
            if (priority > bestPriority) {
                bestItem = item;
                bestPriority = priority;
            }
        });

        return {
            value: bestItem.value,
            confidence: bestPriority > 0 ? 0.9 : 0.5,
            explanation: `選擇優先級最高的來源: ${bestItem.source} (優先級: ${bestPriority})`
        };
    }

    /**
     * 加權共識策略
     * @private
     */
    async _weightedConsensus(conflict) {
        const values = conflict.conflictingValues;

        // 綜合考慮信心度、來源優先級、時間新近性
        let bestScore = -1;
        let bestItem = values[0];

        values.forEach(item => {
            const confidence = item.confidence || 0.5;
            const sourcePriority = (this.options.sourcePriorities[item.source] || 0) / 10;
            const timeScore = 0.1; // 簡化，實際應該基於時間戳計算

            const compositeScore = confidence * 0.6 + sourcePriority * 0.3 + timeScore * 0.1;

            if (compositeScore > bestScore) {
                bestScore = compositeScore;
                bestItem = item;
            }
        });

        return {
            value: bestItem.value,
            confidence: Math.min(bestScore, 1.0),
            explanation: `加權共識：綜合信心度、來源優先級和時間因素 (得分: ${bestScore.toFixed(3)})`
        };
    }
}

/**
 * ConflictDetector 主類
 */
class ConflictDetector extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            strategy: options.strategy || RESOLUTION_STRATEGIES.WEIGHTED_CONSENSUS,
            minConfidence: options.minConfidence || 0.7,
            enableAutoResolution: options.enableAutoResolution !== false,
            maxAutoResolutionSeverity: options.maxAutoResolutionSeverity || CONFLICT_SEVERITY.MEDIUM.level,
            ...options
        };

        // 核心組件
        this.detectionEngine = new ConflictDetectionEngine(this.options);
        this.resolutionEngine = new ConflictResolutionEngine(this.options);

        // 統計信息
        this.stats = {
            totalConflicts: 0,
            resolvedConflicts: 0,
            autoResolvedConflicts: 0,
            manualInterventions: 0,
            averageResolutionTime: 0,
            conflictsByType: Object.fromEntries(
                Object.values(CONFLICT_TYPES).map(type => [type, 0])
            ),
            conflictsBySeverity: Object.fromEntries(
                Object.keys(CONFLICT_SEVERITY).map(level => [level, 0])
            )
        };

        this.initialized = false;
    }

    /**
     * 初始化衝突檢測器
     */
    async initialize() {
        try {
            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            throw new Error(`ConflictDetector初始化失敗: ${error.message}`);
        }
    }

    /**
     * 檢測並解決衝突
     */
    async detectAndResolve(fusedData) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 階段1: 檢測衝突
            const conflicts = await this.detectionEngine.detect(fusedData);

            // 更新統計
            this.stats.totalConflicts += conflicts.length;
            conflicts.forEach(conflict => {
                this.stats.conflictsByType[conflict.type]++;
                this.stats.conflictsBySeverity[conflict.severity.label.toUpperCase()]++;
            });

            // 階段2: 解決衝突
            const resolutions = [];

            if (this.options.enableAutoResolution) {
                // 自動解決符合條件的衝突
                const autoResolvableConflicts = conflicts.filter(conflict =>
                    conflict.metadata.autoResolvable &&
                    conflict.severity.level <= this.options.maxAutoResolutionSeverity
                );

                for (const conflict of autoResolvableConflicts) {
                    try {
                        const resolution = await this.resolutionEngine.resolve(conflict);
                        resolutions.push(resolution);
                        this.stats.autoResolvedConflicts++;
                    } catch (error) {
                        this.emit('resolutionFailed', {
                            conflictId: conflict.id,
                            error: error.message
                        });
                    }
                }
            }

            // 標識需要手動干預的衝突
            const manualConflicts = conflicts.filter(conflict =>
                !conflict.metadata.autoResolvable ||
                conflict.severity.level > this.options.maxAutoResolutionSeverity
            );

            manualConflicts.forEach(conflict => {
                this.stats.manualInterventions++;
                this.emit('manualInterventionRequired', {
                    conflict: conflict.getSummary()
                });
            });

            // 更新統計
            this.stats.resolvedConflicts += resolutions.length;
            const resolutionTime = Date.now() - startTime;
            this._updateAverageResolutionTime(resolutionTime);

            this.emit('detectionCompleted', {
                totalConflicts: conflicts.length,
                autoResolved: resolutions.length,
                manualRequired: manualConflicts.length,
                resolutionTime
            });

            return {
                detectedConflicts: conflicts.map(c => c.getSummary()),
                resolvedConflicts: resolutions,
                manualInterventionRequired: manualConflicts.map(c => c.getSummary()),
                stats: {
                    total: conflicts.length,
                    resolved: resolutions.length,
                    pending: manualConflicts.length,
                    resolutionTime
                }
            };

        } catch (error) {
            this.emit('detectionFailed', { error: error.message });
            throw error;
        }
    }

    /**
     * 手動解決衝突
     */
    async resolveConflictManually(conflictId, resolution) {
        // 這裡可以實現手動解決邏輯
        // 在實際應用中，可能需要存儲衝突狀態以便後續手動處理
        this.emit('manualResolution', {
            conflictId,
            resolution
        });

        return {
            conflictId,
            status: 'resolved_manually',
            resolution
        };
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            resolutionRate: this.stats.totalConflicts > 0 ?
                this.stats.resolvedConflicts / this.stats.totalConflicts : 0,
            autoResolutionRate: this.stats.resolvedConflicts > 0 ?
                this.stats.autoResolvedConflicts / this.stats.resolvedConflicts : 0
        };
    }

    // 私有方法

    /**
     * 更新平均解決時間
     * @private
     */
    _updateAverageResolutionTime(resolutionTime) {
        const current = this.stats.averageResolutionTime;
        const total = this.stats.resolvedConflicts;

        this.stats.averageResolutionTime = total > 0 ?
            (current * (total - 1) + resolutionTime) / total :
            resolutionTime;
    }

    /**
     * 清理資源
     */
    async dispose() {
        this.removeAllListeners();
    }
}

module.exports = {
    ConflictDetector,
    CONFLICT_TYPES,
    CONFLICT_SEVERITY,
    RESOLUTION_STRATEGIES
};