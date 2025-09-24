/**
 * InsightGenerator - 智能洞察生成引擎
 *
 * 功能：
 * - 從整合數據中提取深層模式和趨勢
 * - 執行異常檢測和原因分析
 * - 生成預測性洞察和建議
 * - 提供可解釋的智能分析結果
 *
 * 頁面：洞察分析層 / 智能決策支援
 * 邏輯：基於整合數據進行模式挖掘、趨勢分析、異常檢測和預測建模
 * 需求：高質量洞察生成、可解釋分析、實用建議輸出
 * 用途：ResultIntegrator的智能分析核心組件
 * 配合：接收DataFusion和ConflictDetector結果，為ReportGenerator提供洞察內容
 */

const { EventEmitter } = require('events');

// 洞察類型定義
const INSIGHT_TYPES = {
    PATTERN: 'pattern',           // 模式洞察
    TREND: 'trend',              // 趋勢洞察
    ANOMALY: 'anomaly',          // 異常洞察
    CORRELATION: 'correlation',   // 關聯洞察
    PREDICTION: 'prediction',     // 預測洞察
    RECOMMENDATION: 'recommendation', // 建議洞察
    CAUSATION: 'causation'        // 因果洞察
};

// 洞察嚴重性等級
const INSIGHT_PRIORITY = {
    LOW: { level: 1, label: '低', color: '#28a745' },
    MEDIUM: { level: 2, label: '中', color: '#ffc107' },
    HIGH: { level: 3, label: '高', color: '#fd7e14' },
    CRITICAL: { level: 4, label: '緊急', color: '#dc3545' }
};

// 模式類型
const PATTERN_TYPES = {
    RECURRING: 'recurring',       // 重複模式
    SEASONAL: 'seasonal',         // 季節性模式
    SEQUENTIAL: 'sequential',     // 順序模式
    CLUSTERING: 'clustering',     // 聚類模式
    ASSOCIATION: 'association'    // 關聯模式
};

// 趨勢方向
const TREND_DIRECTIONS = {
    UPWARD: 'upward',
    DOWNWARD: 'downward',
    STABLE: 'stable',
    VOLATILE: 'volatile',
    CYCLICAL: 'cyclical'
};

/**
 * 洞察項目類
 */
class Insight {
    constructor(data) {
        this.id = this._generateId();
        this.type = data.type;
        this.priority = data.priority || INSIGHT_PRIORITY.LOW;
        this.title = data.title;
        this.description = data.description;
        this.confidence = data.confidence || 0.7;

        // 洞察內容
        this.findings = data.findings || [];
        this.evidence = data.evidence || [];
        this.implications = data.implications || [];
        this.recommendations = data.recommendations || [];

        // 元數據
        this.metadata = {
            source: data.source || 'system',
            category: data.category || 'general',
            tags: data.tags || [],
            relatedData: data.relatedData || [],
            generatedAt: new Date().toISOString(),
            validUntil: data.validUntil || null,
            ...data.metadata
        };

        // 可視化數據
        this.visualizations = data.visualizations || [];

        // 行動項目
        this.actionItems = data.actionItems || [];
    }

    _generateId() {
        return `insight_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 添加證據
     */
    addEvidence(evidence) {
        this.evidence.push({
            ...evidence,
            addedAt: new Date().toISOString()
        });
    }

    /**
     * 添加建議
     */
    addRecommendation(recommendation) {
        this.recommendations.push({
            ...recommendation,
            addedAt: new Date().toISOString()
        });
    }

    /**
     * 獲取洞察摘要
     */
    getSummary() {
        return {
            id: this.id,
            type: this.type,
            priority: this.priority.label,
            title: this.title,
            confidence: this.confidence,
            findingsCount: this.findings.length,
            recommendationsCount: this.recommendations.length,
            category: this.metadata.category,
            generatedAt: this.metadata.generatedAt
        };
    }

    /**
     * 轉換為報告格式
     */
    toReportFormat() {
        return {
            ...this,
            priorityColor: this.priority.color,
            confidencePercentage: Math.round(this.confidence * 100),
            formattedDate: new Date(this.metadata.generatedAt).toLocaleString('zh-TW')
        };
    }
}

/**
 * 模式挖掘引擎
 */
class PatternMiner {
    constructor(options = {}) {
        this.options = {
            minSupport: options.minSupport || 0.3,
            minConfidence: options.minConfidence || 0.6,
            maxPatternLength: options.maxPatternLength || 5,
            enableSequentialMining: options.enableSequentialMining !== false,
            enableAssociationRules: options.enableAssociationRules !== false,
            ...options
        };
    }

    /**
     * 挖掘數據模式
     */
    async mine(integratedData) {
        const patterns = {
            frequent: await this._mineFrequentPatterns(integratedData),
            sequential: this.options.enableSequentialMining ?
                await this._mineSequentialPatterns(integratedData) : [],
            associations: this.options.enableAssociationRules ?
                await this._mineAssociationRules(integratedData) : [],
            clusters: await this._performClustering(integratedData)
        };

        return patterns;
    }

    /**
     * 挖掘頻繁模式
     * @private
     */
    async _mineFrequentPatterns(data) {
        const patterns = [];
        const itemFrequency = new Map();

        // 分析每個分組中的項目頻率
        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            items.forEach(item => {
                const content = item.normalizedData?.content || {};

                // 提取關鍵字和值
                const features = this._extractFeatures(content);
                features.forEach(feature => {
                    const key = `${groupKey}:${feature}`;
                    itemFrequency.set(key, (itemFrequency.get(key) || 0) + 1);
                });
            });
        });

        // 識別頻繁項目
        const totalTransactions = Object.keys(data.groups || {}).length;
        const minSupportCount = Math.ceil(totalTransactions * this.options.minSupport);

        itemFrequency.forEach((frequency, pattern) => {
            if (frequency >= minSupportCount) {
                patterns.push({
                    pattern,
                    frequency,
                    support: frequency / totalTransactions,
                    type: PATTERN_TYPES.RECURRING
                });
            }
        });

        return patterns.sort((a, b) => b.support - a.support);
    }

    /**
     * 挖掘順序模式
     * @private
     */
    async _mineSequentialPatterns(data) {
        const sequences = [];
        const groupKeys = Object.keys(data.groups || {});

        if (groupKeys.length < 2) return sequences;

        // 按時間排序分組
        const sortedGroups = groupKeys
            .map(key => ({
                key,
                group: data.groups[key],
                timestamp: this._getGroupTimestamp(data.groups[key])
            }))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 查找順序模式
        for (let i = 0; i < sortedGroups.length - 1; i++) {
            for (let j = i + 1; j < Math.min(i + this.options.maxPatternLength, sortedGroups.length); j++) {
                const pattern = this._analyzeSequentialPattern(
                    sortedGroups.slice(i, j + 1)
                );

                if (pattern.confidence >= this.options.minConfidence) {
                    sequences.push(pattern);
                }
            }
        }

        return sequences;
    }

    /**
     * 挖掘關聯規則
     * @private
     */
    async _mineAssociationRules(data) {
        const rules = [];
        const cooccurrences = new Map();

        // 計算項目共現頻率
        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];
            const features = new Set();

            items.forEach(item => {
                const content = item.normalizedData?.content || {};
                this._extractFeatures(content).forEach(feature => features.add(feature));
            });

            // 生成特徵對
            const featureArray = Array.from(features);
            for (let i = 0; i < featureArray.length; i++) {
                for (let j = i + 1; j < featureArray.length; j++) {
                    const pair = [featureArray[i], featureArray[j]].sort().join('|');
                    cooccurrences.set(pair, (cooccurrences.get(pair) || 0) + 1);
                }
            }
        });

        // 生成關聯規則
        const totalGroups = Object.keys(data.groups || {}).length;
        cooccurrences.forEach((frequency, pair) => {
            const [antecedent, consequent] = pair.split('|');
            const support = frequency / totalGroups;

            if (support >= this.options.minSupport) {
                rules.push({
                    antecedent,
                    consequent,
                    support,
                    confidence: support, // 簡化計算
                    type: PATTERN_TYPES.ASSOCIATION
                });
            }
        });

        return rules.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 執行聚類分析
     * @private
     */
    async _performClustering(data) {
        const clusters = [];
        const groups = Object.entries(data.groups || {});

        if (groups.length < 2) return clusters;

        // 簡化的基於語義的聚類
        const semanticClusters = new Map();

        groups.forEach(([groupKey, group]) => {
            const category = group.category || 'unknown';
            if (!semanticClusters.has(category)) {
                semanticClusters.set(category, []);
            }
            semanticClusters.get(category).push({ groupKey, group });
        });

        semanticClusters.forEach((members, category) => {
            if (members.length > 1) {
                clusters.push({
                    category,
                    members: members.map(m => m.groupKey),
                    size: members.length,
                    type: PATTERN_TYPES.CLUSTERING,
                    cohesion: this._calculateCohesion(members)
                });
            }
        });

        return clusters;
    }

    // 輔助方法
    _extractFeatures(content) {
        const features = [];

        if (typeof content === 'object' && content !== null) {
            Object.entries(content).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    features.push(`${key}:${value.toLowerCase()}`);
                } else if (typeof value === 'boolean') {
                    features.push(`${key}:${value}`);
                } else if (typeof value === 'number') {
                    // 數值分桶
                    const bucket = this._bucketizeNumber(value);
                    features.push(`${key}:${bucket}`);
                }
            });
        }

        return features;
    }

    _bucketizeNumber(value) {
        if (value < 0.3) return 'low';
        if (value < 0.7) return 'medium';
        return 'high';
    }

    _getGroupTimestamp(group) {
        const items = group.items || [];
        if (items.length === 0) return new Date().toISOString();

        const timestamps = items
            .map(item => item.metadata.timestamp)
            .filter(t => t)
            .sort();

        return timestamps[0] || new Date().toISOString();
    }

    _analyzeSequentialPattern(groupSequence) {
        const pattern = {
            sequence: groupSequence.map(g => g.key),
            length: groupSequence.length,
            type: PATTERN_TYPES.SEQUENTIAL,
            confidence: 0.7, // 簡化計算
            timeSpan: new Date(groupSequence[groupSequence.length - 1].timestamp) -
                     new Date(groupSequence[0].timestamp)
        };

        return pattern;
    }

    _calculateCohesion(members) {
        // 簡化的凝聚度計算
        if (members.length <= 1) return 1.0;

        let totalSimilarity = 0;
        let pairCount = 0;

        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const similarity = this._calculateSimilarity(
                    members[i].group,
                    members[j].group
                );
                totalSimilarity += similarity;
                pairCount++;
            }
        }

        return pairCount > 0 ? totalSimilarity / pairCount : 0;
    }

    _calculateSimilarity(group1, group2) {
        const confidence1 = group1.confidence || 0;
        const confidence2 = group2.confidence || 0;
        return 1 - Math.abs(confidence1 - confidence2);
    }
}

/**
 * 趨勢分析引擎
 */
class TrendAnalyzer {
    constructor(options = {}) {
        this.options = {
            minDataPoints: options.minDataPoints || 3,
            trendThreshold: options.trendThreshold || 0.1,
            seasonalityThreshold: options.seasonalityThreshold || 0.3,
            ...options
        };
    }

    /**
     * 分析趨勢
     */
    async analyzeTrends(integratedData) {
        return {
            shortTerm: await this._analyzeShortTerm(integratedData),
            longTerm: await this._analyzeLongTerm(integratedData),
            cyclical: await this._analyzeCyclical(integratedData),
            seasonal: await this._analyzeSeasonal(integratedData)
        };
    }

    async _analyzeShortTerm(data) {
        const trends = [];
        const timeWindow = 24 * 60 * 60 * 1000; // 24小時

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];
            const recentItems = items.filter(item => {
                const itemTime = new Date(item.metadata.timestamp).getTime();
                return Date.now() - itemTime <= timeWindow;
            });

            if (recentItems.length >= this.options.minDataPoints) {
                const trend = this._calculateTrend(recentItems, 'short_term');
                if (trend) {
                    trends.push({
                        ...trend,
                        group: groupKey,
                        timeframe: '短期 (24小時)'
                    });
                }
            }
        });

        return trends;
    }

    async _analyzeLongTerm(data) {
        const trends = [];
        const timeWindow = 30 * 24 * 60 * 60 * 1000; // 30天

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];
            const longTermItems = items.filter(item => {
                const itemTime = new Date(item.metadata.timestamp).getTime();
                return Date.now() - itemTime <= timeWindow;
            });

            if (longTermItems.length >= this.options.minDataPoints) {
                const trend = this._calculateTrend(longTermItems, 'long_term');
                if (trend) {
                    trends.push({
                        ...trend,
                        group: groupKey,
                        timeframe: '長期 (30天)'
                    });
                }
            }
        });

        return trends;
    }

    async _analyzeCyclical(data) {
        // 簡化的週期性分析
        const cyclicalPatterns = [];

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            if (items.length >= 7) { // 至少7個數據點
                const pattern = this._detectCyclicalPattern(items);
                if (pattern) {
                    cyclicalPatterns.push({
                        ...pattern,
                        group: groupKey
                    });
                }
            }
        });

        return cyclicalPatterns;
    }

    async _analyzeSeasonal(data) {
        // 簡化的季節性分析
        const seasonalPatterns = [];

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            if (items.length >= 12) { // 至少12個數據點
                const pattern = this._detectSeasonalPattern(items);
                if (pattern) {
                    seasonalPatterns.push({
                        ...pattern,
                        group: groupKey
                    });
                }
            }
        });

        return seasonalPatterns;
    }

    _calculateTrend(items, timeframe) {
        if (items.length < 2) return null;

        // 按時間排序
        const sortedItems = items.sort((a, b) =>
            new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp)
        );

        // 提取數值序列
        const values = this._extractNumericValues(sortedItems);
        if (values.length < 2) return null;

        // 計算線性趨勢
        const { slope, correlation } = this._linearRegression(values);

        if (Math.abs(correlation) < this.options.trendThreshold) {
            return null; // 趨勢不明顯
        }

        let direction = TREND_DIRECTIONS.STABLE;
        if (slope > this.options.trendThreshold) {
            direction = TREND_DIRECTIONS.UPWARD;
        } else if (slope < -this.options.trendThreshold) {
            direction = TREND_DIRECTIONS.DOWNWARD;
        }

        // 計算波動性
        const volatility = this._calculateVolatility(values);
        if (volatility > 0.5) {
            direction = TREND_DIRECTIONS.VOLATILE;
        }

        return {
            direction,
            slope,
            correlation,
            volatility,
            confidence: Math.abs(correlation),
            dataPoints: values.length,
            timeframe
        };
    }

    _extractNumericValues(items) {
        const values = [];

        items.forEach(item => {
            const content = item.normalizedData?.content || {};
            Object.values(content).forEach(value => {
                if (typeof value === 'number' && !isNaN(value)) {
                    values.push(value);
                }
            });
        });

        return values;
    }

    _linearRegression(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;

        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        const sumYY = y.reduce((sum, val) => sum + val * val, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const correlation = (n * sumXY - sumX * sumY) /
            Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        return { slope, correlation: isNaN(correlation) ? 0 : correlation };
    }

    _calculateVolatility(values) {
        if (values.length < 2) return 0;

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return mean !== 0 ? stdDev / Math.abs(mean) : 0;
    }

    _detectCyclicalPattern(items) {
        // 簡化的週期檢測
        const timeIntervals = [];

        for (let i = 1; i < items.length; i++) {
            const interval = new Date(items[i].metadata.timestamp) -
                           new Date(items[i - 1].metadata.timestamp);
            timeIntervals.push(interval);
        }

        if (timeIntervals.length === 0) return null;

        const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
        const intervalVariance = timeIntervals.reduce((sum, val) =>
            sum + Math.pow(val - avgInterval, 2), 0) / timeIntervals.length;
        const intervalStdDev = Math.sqrt(intervalVariance);

        const consistency = 1 - (intervalStdDev / avgInterval);

        if (consistency > 0.7) { // 70%一致性
            return {
                type: 'cyclical',
                period: avgInterval,
                consistency,
                confidence: consistency
            };
        }

        return null;
    }

    _detectSeasonalPattern(items) {
        // 簡化的季節性檢測
        const monthlyGroups = new Map();

        items.forEach(item => {
            const date = new Date(item.metadata.timestamp);
            const month = date.getMonth();

            if (!monthlyGroups.has(month)) {
                monthlyGroups.set(month, []);
            }
            monthlyGroups.get(month).push(item);
        });

        const monthCounts = Array.from(monthlyGroups.values()).map(group => group.length);
        const avgCount = monthCounts.reduce((sum, val) => sum + val, 0) / monthCounts.length;
        const variance = monthCounts.reduce((sum, val) => sum + Math.pow(val - avgCount, 2), 0) / monthCounts.length;
        const coefficientOfVariation = Math.sqrt(variance) / avgCount;

        if (coefficientOfVariation > this.options.seasonalityThreshold) {
            return {
                type: 'seasonal',
                variance: coefficientOfVariation,
                monthlyDistribution: Object.fromEntries(monthlyGroups.entries()),
                confidence: Math.min(coefficientOfVariation, 1.0)
            };
        }

        return null;
    }
}

/**
 * 異常檢測引擎
 */
class AnomalyDetector {
    constructor(options = {}) {
        this.options = {
            sensitivityLevel: options.sensitivityLevel || 0.8,
            statisticalThreshold: options.statisticalThreshold || 2.0, // 2個標準差
            contextualThreshold: options.contextualThreshold || 0.7,
            ...options
        };
    }

    /**
     * 檢測異常
     */
    async detect(integratedData) {
        const anomalies = [];

        // 統計異常檢測
        const statisticalAnomalies = await this._detectStatisticalAnomalies(integratedData);
        anomalies.push(...statisticalAnomalies);

        // 上下文異常檢測
        const contextualAnomalies = await this._detectContextualAnomalies(integratedData);
        anomalies.push(...contextualAnomalies);

        // 集體異常檢測
        const collectiveAnomalies = await this._detectCollectiveAnomalies(integratedData);
        anomalies.push(...collectiveAnomalies);

        return anomalies.map(anomaly => ({
            ...anomaly,
            severity: this._assessAnomalySeverity(anomaly),
            explanation: this._explainAnomaly(anomaly),
            recommendations: this._recommendAnomalyActions(anomaly)
        }));
    }

    async _detectStatisticalAnomalies(data) {
        const anomalies = [];

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];
            const numericValues = this._extractAllNumericValues(items);

            if (numericValues.length < 3) return; // 需要足夠的數據點

            const stats = this._calculateStatistics(numericValues);

            // Z-score異常檢測
            numericValues.forEach((value, index) => {
                const zScore = Math.abs((value - stats.mean) / stats.stdDev);

                if (zScore > this.options.statisticalThreshold) {
                    anomalies.push({
                        type: 'statistical',
                        group: groupKey,
                        value,
                        zScore,
                        threshold: this.options.statisticalThreshold,
                        dataPoint: index,
                        confidence: Math.min(zScore / this.options.statisticalThreshold, 1.0)
                    });
                }
            });
        });

        return anomalies;
    }

    async _detectContextualAnomalies(data) {
        const anomalies = [];

        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            items.forEach((item, index) => {
                // 檢查與同組其他項目的差異
                const similarity = this._calculateContextualSimilarity(item, items);

                if (similarity < this.options.contextualThreshold) {
                    anomalies.push({
                        type: 'contextual',
                        group: groupKey,
                        itemId: item.id,
                        similarity,
                        threshold: this.options.contextualThreshold,
                        confidence: 1 - similarity,
                        context: {
                            groupSize: items.length,
                            itemIndex: index
                        }
                    });
                }
            });
        });

        return anomalies;
    }

    async _detectCollectiveAnomalies(data) {
        const anomalies = [];
        const groups = Object.entries(data.groups || {});

        if (groups.length < 3) return anomalies;

        // 檢測群體性異常
        groups.forEach(([groupKey, group]) => {
            const groupStats = this._calculateGroupStats(group);
            const overallStats = this._calculateOverallStats(data.groups);

            const deviationScore = this._calculateGroupDeviation(groupStats, overallStats);

            if (deviationScore > this.options.sensitivityLevel) {
                anomalies.push({
                    type: 'collective',
                    group: groupKey,
                    deviationScore,
                    threshold: this.options.sensitivityLevel,
                    confidence: Math.min(deviationScore, 1.0),
                    groupStats,
                    overallStats
                });
            }
        });

        return anomalies;
    }

    // 輔助方法
    _extractAllNumericValues(items) {
        const values = [];

        items.forEach(item => {
            const content = item.normalizedData?.content || {};
            Object.values(content).forEach(value => {
                if (typeof value === 'number' && !isNaN(value)) {
                    values.push(value);
                }
            });
        });

        return values;
    }

    _calculateStatistics(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            mean,
            variance,
            stdDev,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length
        };
    }

    _calculateContextualSimilarity(targetItem, allItems) {
        const targetFeatures = this._extractItemFeatures(targetItem);
        let totalSimilarity = 0;
        let comparisonCount = 0;

        allItems.forEach(item => {
            if (item.id !== targetItem.id) {
                const itemFeatures = this._extractItemFeatures(item);
                const similarity = this._calculateFeatureSimilarity(targetFeatures, itemFeatures);
                totalSimilarity += similarity;
                comparisonCount++;
            }
        });

        return comparisonCount > 0 ? totalSimilarity / comparisonCount : 1.0;
    }

    _extractItemFeatures(item) {
        const features = {};
        const content = item.normalizedData?.content || {};

        Object.entries(content).forEach(([key, value]) => {
            if (typeof value === 'number') {
                features[`${key}_numeric`] = value;
            } else if (typeof value === 'boolean') {
                features[`${key}_boolean`] = value ? 1 : 0;
            } else if (typeof value === 'string') {
                features[`${key}_string`] = value.toLowerCase();
            }
        });

        // 添加元數據特徵
        features.confidence = item.metadata.confidence || 0.5;
        features.source = item.metadata.source || 'unknown';

        return features;
    }

    _calculateFeatureSimilarity(features1, features2) {
        const commonKeys = Object.keys(features1).filter(key =>
            features2.hasOwnProperty(key)
        );

        if (commonKeys.length === 0) return 0;

        let similaritySum = 0;

        commonKeys.forEach(key => {
            const val1 = features1[key];
            const val2 = features2[key];

            if (typeof val1 === 'number' && typeof val2 === 'number') {
                // 數值相似度
                const diff = Math.abs(val1 - val2);
                const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1);
                similaritySum += 1 - (diff / maxVal);
            } else if (val1 === val2) {
                // 完全匹配
                similaritySum += 1;
            } else {
                // 不匹配
                similaritySum += 0;
            }
        });

        return similaritySum / commonKeys.length;
    }

    _calculateGroupStats(group) {
        const items = group.items || [];
        const numericValues = this._extractAllNumericValues(items);

        return {
            itemCount: items.length,
            confidence: group.confidence || 0,
            numericStats: numericValues.length > 0 ?
                this._calculateStatistics(numericValues) : null
        };
    }

    _calculateOverallStats(groups) {
        let totalItems = 0;
        let totalConfidence = 0;
        let allNumericValues = [];

        Object.values(groups).forEach(group => {
            const items = group.items || [];
            totalItems += items.length;
            totalConfidence += group.confidence || 0;

            const numericValues = this._extractAllNumericValues(items);
            allNumericValues.push(...numericValues);
        });

        const groupCount = Object.keys(groups).length;

        return {
            groupCount,
            avgItemsPerGroup: totalItems / groupCount,
            avgConfidence: totalConfidence / groupCount,
            overallNumericStats: allNumericValues.length > 0 ?
                this._calculateStatistics(allNumericValues) : null
        };
    }

    _calculateGroupDeviation(groupStats, overallStats) {
        let deviation = 0;
        let factors = 0;

        // 項目數量偏差
        if (overallStats.avgItemsPerGroup > 0) {
            const itemDeviation = Math.abs(groupStats.itemCount - overallStats.avgItemsPerGroup) /
                                overallStats.avgItemsPerGroup;
            deviation += itemDeviation;
            factors++;
        }

        // 信心度偏差
        const confidenceDeviation = Math.abs(groupStats.confidence - overallStats.avgConfidence);
        deviation += confidenceDeviation;
        factors++;

        // 數值統計偏差
        if (groupStats.numericStats && overallStats.overallNumericStats) {
            const meanDeviation = Math.abs(groupStats.numericStats.mean - overallStats.overallNumericStats.mean) /
                                 Math.abs(overallStats.overallNumericStats.mean || 1);
            deviation += meanDeviation;
            factors++;
        }

        return factors > 0 ? deviation / factors : 0;
    }

    _assessAnomalySeverity(anomaly) {
        const confidence = anomaly.confidence || 0;

        if (confidence >= 0.9) {
            return INSIGHT_PRIORITY.CRITICAL;
        } else if (confidence >= 0.7) {
            return INSIGHT_PRIORITY.HIGH;
        } else if (confidence >= 0.5) {
            return INSIGHT_PRIORITY.MEDIUM;
        } else {
            return INSIGHT_PRIORITY.LOW;
        }
    }

    _explainAnomaly(anomaly) {
        switch (anomaly.type) {
            case 'statistical':
                return `數值 ${anomaly.value} 偏離正常範圍 ${anomaly.zScore.toFixed(2)} 個標準差`;
            case 'contextual':
                return `在分組 ${anomaly.group} 中，此項目與其他項目相似度僅為 ${(anomaly.similarity * 100).toFixed(1)}%`;
            case 'collective':
                return `分組 ${anomaly.group} 整體表現與其他分組差異較大，偏差得分: ${anomaly.deviationScore.toFixed(2)}`;
            default:
                return '檢測到異常模式';
        }
    }

    _recommendAnomalyActions(anomaly) {
        const recommendations = [];

        switch (anomaly.type) {
            case 'statistical':
                recommendations.push('檢查數據來源的準確性');
                recommendations.push('驗證數據收集過程是否異常');
                if (anomaly.zScore > 3) {
                    recommendations.push('考慮排除此數據點或進行進一步調查');
                }
                break;

            case 'contextual':
                recommendations.push('檢查該項目的上下文信息');
                recommendations.push('確認數據分組是否正確');
                recommendations.push('調查該項目的特殊性原因');
                break;

            case 'collective':
                recommendations.push('檢查整個分組的數據質量');
                recommendations.push('分析分組劃分邏輯是否合理');
                recommendations.push('考慮重新評估分組策略');
                break;
        }

        // 通用建議
        if (anomaly.confidence > 0.8) {
            recommendations.push('建議立即關注此異常');
        }

        return recommendations;
    }
}

/**
 * 洞察生成引擎主類
 */
class InsightGenerator extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            enablePatternMining: options.enablePatternMining !== false,
            enableTrendAnalysis: options.enableTrendAnalysis !== false,
            enableAnomalyDetection: options.enableAnomalyDetection !== false,
            enablePredictiveAnalysis: options.enablePredictiveAnalysis !== false,
            minInsightConfidence: options.minInsightConfidence || 0.6,
            maxInsightsPerCategory: options.maxInsightsPerCategory || 10,
            ...options
        };

        // 核心組件
        this.patternMiner = new PatternMiner(this.options);
        this.trendAnalyzer = new TrendAnalyzer(this.options);
        this.anomalyDetector = new AnomalyDetector(this.options);

        // 統計信息
        this.stats = {
            totalInsights: 0,
            insightsByType: Object.fromEntries(
                Object.values(INSIGHT_TYPES).map(type => [type, 0])
            ),
            averageConfidence: 0,
            generationTime: 0
        };

        this.initialized = false;
    }

    /**
     * 初始化洞察生成器
     */
    async initialize() {
        try {
            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            throw new Error(`InsightGenerator初始化失敗: ${error.message}`);
        }
    }

    /**
     * 生成洞察
     */
    async generate(integratedData) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const insights = [];

        try {
            // 模式洞察
            if (this.options.enablePatternMining) {
                const patternInsights = await this._generatePatternInsights(integratedData);
                insights.push(...patternInsights);
            }

            // 趨勢洞察
            if (this.options.enableTrendAnalysis) {
                const trendInsights = await this._generateTrendInsights(integratedData);
                insights.push(...trendInsights);
            }

            // 異常洞察
            if (this.options.enableAnomalyDetection) {
                const anomalyInsights = await this._generateAnomalyInsights(integratedData);
                insights.push(...anomalyInsights);
            }

            // 關聯洞察
            const correlationInsights = await this._generateCorrelationInsights(integratedData);
            insights.push(...correlationInsights);

            // 預測洞察
            if (this.options.enablePredictiveAnalysis) {
                const predictiveInsights = await this._generatePredictiveInsights(integratedData);
                insights.push(...predictiveInsights);
            }

            // 建議洞察
            const recommendations = await this._generateRecommendations(insights, integratedData);
            insights.push(...recommendations);

            // 過濾和排序洞察
            const filteredInsights = this._filterInsights(insights);
            const prioritizedInsights = this._prioritizeInsights(filteredInsights);

            // 更新統計
            const generationTime = Date.now() - startTime;
            this._updateStats(prioritizedInsights, generationTime);

            this.emit('insightsGenerated', {
                count: prioritizedInsights.length,
                generationTime,
                categories: this._categorizeInsights(prioritizedInsights)
            });

            return {
                insights: prioritizedInsights,
                metadata: {
                    totalGenerated: insights.length,
                    afterFiltering: prioritizedInsights.length,
                    generationTime,
                    confidence: this._calculateAverageConfidence(prioritizedInsights)
                },
                stats: this.getStats()
            };

        } catch (error) {
            this.emit('generationFailed', { error: error.message });
            throw error;
        }
    }

    // 私有方法

    async _generatePatternInsights(data) {
        const patterns = await this.patternMiner.mine(data);
        const insights = [];

        // 頻繁模式洞察
        patterns.frequent.forEach(pattern => {
            if (pattern.support >= 0.5) { // 高支持度模式
                insights.push(new Insight({
                    type: INSIGHT_TYPES.PATTERN,
                    priority: pattern.support >= 0.8 ? INSIGHT_PRIORITY.HIGH : INSIGHT_PRIORITY.MEDIUM,
                    title: `高頻模式發現`,
                    description: `發現高頻模式 "${pattern.pattern}"，在 ${(pattern.support * 100).toFixed(1)}% 的情況下出現`,
                    confidence: pattern.support,
                    findings: [
                        `模式: ${pattern.pattern}`,
                        `出現頻率: ${pattern.frequency} 次`,
                        `支持度: ${(pattern.support * 100).toFixed(1)}%`
                    ],
                    evidence: [
                        `模式類型: ${pattern.type}`,
                        `統計顯著性: 高`
                    ],
                    metadata: {
                        category: 'pattern_mining',
                        patternType: pattern.type
                    }
                }));
            }
        });

        // 順序模式洞察
        patterns.sequential.forEach(sequence => {
            insights.push(new Insight({
                type: INSIGHT_TYPES.PATTERN,
                priority: INSIGHT_PRIORITY.MEDIUM,
                title: `順序模式識別`,
                description: `發現順序模式: ${sequence.sequence.join(' → ')}`,
                confidence: sequence.confidence,
                findings: [
                    `序列長度: ${sequence.length}`,
                    `時間跨度: ${this._formatDuration(sequence.timeSpan)}`,
                    `信心度: ${(sequence.confidence * 100).toFixed(1)}%`
                ],
                metadata: {
                    category: 'sequential_patterns',
                    patternType: sequence.type
                }
            }));
        });

        return insights;
    }

    async _generateTrendInsights(data) {
        const trends = await this.trendAnalyzer.analyzeTrends(data);
        const insights = [];

        // 短期趨勢洞察
        trends.shortTerm.forEach(trend => {
            if (trend.confidence >= 0.7) {
                insights.push(new Insight({
                    type: INSIGHT_TYPES.TREND,
                    priority: this._getTrendPriority(trend),
                    title: `短期趨勢：${this._getTrendLabel(trend.direction)}`,
                    description: `${trend.group} 分組在 ${trend.timeframe} 內呈現${this._getTrendLabel(trend.direction)}趨勢`,
                    confidence: trend.confidence,
                    findings: [
                        `趨勢方向: ${this._getTrendLabel(trend.direction)}`,
                        `變化斜率: ${trend.slope.toFixed(4)}`,
                        `相關係數: ${trend.correlation.toFixed(3)}`,
                        `波動性: ${(trend.volatility * 100).toFixed(1)}%`
                    ],
                    implications: this._getTrendImplications(trend),
                    metadata: {
                        category: 'trend_analysis',
                        timeframe: 'short_term',
                        group: trend.group
                    }
                }));
            }
        });

        // 長期趨勢洞察
        trends.longTerm.forEach(trend => {
            if (trend.confidence >= 0.6) {
                insights.push(new Insight({
                    type: INSIGHT_TYPES.TREND,
                    priority: this._getTrendPriority(trend, true),
                    title: `長期趨勢：${this._getTrendLabel(trend.direction)}`,
                    description: `${trend.group} 分組在 ${trend.timeframe} 內呈現${this._getTrendLabel(trend.direction)}趨勢`,
                    confidence: trend.confidence,
                    findings: [
                        `趨勢方向: ${this._getTrendLabel(trend.direction)}`,
                        `趨勢穩定性: ${trend.correlation >= 0.8 ? '高' : '中等'}`,
                        `數據點數: ${trend.dataPoints}`
                    ],
                    implications: this._getTrendImplications(trend, true),
                    metadata: {
                        category: 'trend_analysis',
                        timeframe: 'long_term',
                        group: trend.group
                    }
                }));
            }
        });

        return insights;
    }

    async _generateAnomalyInsights(data) {
        const anomalies = await this.anomalyDetector.detect(data);
        const insights = [];

        anomalies.forEach(anomaly => {
            insights.push(new Insight({
                type: INSIGHT_TYPES.ANOMALY,
                priority: anomaly.severity,
                title: `異常檢測：${anomaly.type} 異常`,
                description: anomaly.explanation,
                confidence: anomaly.confidence,
                findings: [
                    `異常類型: ${anomaly.type}`,
                    `檢測信心度: ${(anomaly.confidence * 100).toFixed(1)}%`,
                    ...(anomaly.zScore ? [`Z得分: ${anomaly.zScore.toFixed(2)}`] : []),
                    ...(anomaly.similarity ? [`相似度: ${(anomaly.similarity * 100).toFixed(1)}%`] : [])
                ],
                implications: [
                    `異常嚴重性: ${anomaly.severity.label}`,
                    `需要關注程度: ${anomaly.confidence > 0.8 ? '高' : '中等'}`
                ],
                recommendations: anomaly.recommendations,
                metadata: {
                    category: 'anomaly_detection',
                    anomalyType: anomaly.type,
                    group: anomaly.group
                }
            }));
        });

        return insights;
    }

    async _generateCorrelationInsights(data) {
        const insights = [];
        const correlations = data.correlations || [];

        correlations.forEach(correlation => {
            if (correlation.strength >= 0.7) {
                insights.push(new Insight({
                    type: INSIGHT_TYPES.CORRELATION,
                    priority: correlation.strength >= 0.9 ? INSIGHT_PRIORITY.HIGH : INSIGHT_PRIORITY.MEDIUM,
                    title: `強關聯發現`,
                    description: `發現強關聯關係，關聯強度: ${(correlation.strength * 100).toFixed(1)}%`,
                    confidence: correlation.strength,
                    findings: [
                        `關聯類型: ${correlation.type}`,
                        `語義相似度: ${(correlation.components.semantic * 100).toFixed(1)}%`,
                        `時間相關性: ${(correlation.components.temporal * 100).toFixed(1)}%`,
                        `來源相關性: ${(correlation.components.source * 100).toFixed(1)}%`
                    ],
                    implications: [
                        correlation.strength >= 0.9 ? '存在強依賴關係' : '存在相互影響',
                        '可能存在共同驅動因素'
                    ],
                    metadata: {
                        category: 'correlation_analysis',
                        correlationType: correlation.type
                    }
                }));
            }
        });

        return insights;
    }

    async _generatePredictiveInsights(data) {
        const insights = [];

        // 簡化的預測分析
        Object.entries(data.groups || {}).forEach(([groupKey, group]) => {
            const items = group.items || [];

            if (items.length >= 5) {
                const prediction = this._makePrediction(items);

                if (prediction.confidence >= 0.6) {
                    insights.push(new Insight({
                        type: INSIGHT_TYPES.PREDICTION,
                        priority: prediction.confidence >= 0.8 ? INSIGHT_PRIORITY.HIGH : INSIGHT_PRIORITY.MEDIUM,
                        title: `趨勢預測：${groupKey}`,
                        description: prediction.description,
                        confidence: prediction.confidence,
                        findings: prediction.findings,
                        implications: prediction.implications,
                        metadata: {
                            category: 'predictive_analysis',
                            group: groupKey,
                            predictionType: prediction.type
                        }
                    }));
                }
            }
        });

        return insights;
    }

    async _generateRecommendations(insights, data) {
        const recommendations = [];

        // 基於洞察生成建議
        const highPriorityInsights = insights.filter(insight =>
            insight.priority.level >= INSIGHT_PRIORITY.HIGH.level
        );

        if (highPriorityInsights.length > 0) {
            recommendations.push(new Insight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                priority: INSIGHT_PRIORITY.HIGH,
                title: `重要洞察行動建議`,
                description: `基於 ${highPriorityInsights.length} 個高優先級洞察生成的行動建議`,
                confidence: 0.8,
                findings: [
                    `檢測到 ${highPriorityInsights.length} 個重要洞察`,
                    `涉及 ${this._getUniqueCategories(highPriorityInsights).length} 個不同類別`
                ],
                recommendations: this._generateActionRecommendations(highPriorityInsights),
                actionItems: this._generateActionItems(highPriorityInsights),
                metadata: {
                    category: 'system_recommendations',
                    basedOnInsights: highPriorityInsights.length
                }
            }));
        }

        return recommendations;
    }

    // 輔助方法

    _filterInsights(insights) {
        return insights.filter(insight =>
            insight.confidence >= this.options.minInsightConfidence
        );
    }

    _prioritizeInsights(insights) {
        return insights
            .sort((a, b) => {
                // 按優先級排序，同優先級按信心度排序
                if (a.priority.level !== b.priority.level) {
                    return b.priority.level - a.priority.level;
                }
                return b.confidence - a.confidence;
            })
            .slice(0, this.options.maxInsightsPerCategory * Object.keys(INSIGHT_TYPES).length);
    }

    _categorizeInsights(insights) {
        const categories = {};

        insights.forEach(insight => {
            const category = insight.metadata.category || insight.type;
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(insight);
        });

        return categories;
    }

    _calculateAverageConfidence(insights) {
        if (insights.length === 0) return 0;

        const totalConfidence = insights.reduce((sum, insight) => sum + insight.confidence, 0);
        return totalConfidence / insights.length;
    }

    _updateStats(insights, generationTime) {
        this.stats.totalInsights += insights.length;
        this.stats.generationTime = generationTime;

        insights.forEach(insight => {
            this.stats.insightsByType[insight.type]++;
        });

        this.stats.averageConfidence = this._calculateAverageConfidence(insights);
    }

    _formatDuration(milliseconds) {
        const seconds = milliseconds / 1000;
        const minutes = seconds / 60;
        const hours = minutes / 60;

        if (hours >= 1) {
            return `${hours.toFixed(1)} 小時`;
        } else if (minutes >= 1) {
            return `${minutes.toFixed(1)} 分鐘`;
        } else {
            return `${seconds.toFixed(1)} 秒`;
        }
    }

    _getTrendLabel(direction) {
        const labels = {
            [TREND_DIRECTIONS.UPWARD]: '上升',
            [TREND_DIRECTIONS.DOWNWARD]: '下降',
            [TREND_DIRECTIONS.STABLE]: '穩定',
            [TREND_DIRECTIONS.VOLATILE]: '波動',
            [TREND_DIRECTIONS.CYCLICAL]: '週期性'
        };
        return labels[direction] || '未知';
    }

    _getTrendPriority(trend, isLongTerm = false) {
        const baseMultiplier = isLongTerm ? 1.2 : 1.0;
        const priorityScore = trend.confidence * baseMultiplier;

        if (trend.direction === TREND_DIRECTIONS.VOLATILE) {
            return INSIGHT_PRIORITY.HIGH;
        } else if (priorityScore >= 0.8) {
            return INSIGHT_PRIORITY.HIGH;
        } else if (priorityScore >= 0.6) {
            return INSIGHT_PRIORITY.MEDIUM;
        } else {
            return INSIGHT_PRIORITY.LOW;
        }
    }

    _getTrendImplications(trend, isLongTerm = false) {
        const implications = [];
        const timeframe = isLongTerm ? '長期' : '短期';

        switch (trend.direction) {
            case TREND_DIRECTIONS.UPWARD:
                implications.push(`${timeframe}表現呈正向發展`);
                implications.push('建議維持當前策略');
                break;
            case TREND_DIRECTIONS.DOWNWARD:
                implications.push(`${timeframe}表現呈負向發展`);
                implications.push('建議檢討並調整策略');
                break;
            case TREND_DIRECTIONS.VOLATILE:
                implications.push(`${timeframe}表現不穩定`);
                implications.push('建議加強監控和風險管理');
                break;
            case TREND_DIRECTIONS.STABLE:
                implications.push(`${timeframe}表現穩定`);
                implications.push('可考慮優化或創新機會');
                break;
        }

        return implications;
    }

    _makePrediction(items) {
        // 簡化的預測實現
        const numericValues = [];

        items.forEach(item => {
            const content = item.normalizedData?.content || {};
            Object.values(content).forEach(value => {
                if (typeof value === 'number') {
                    numericValues.push(value);
                }
            });
        });

        if (numericValues.length < 3) {
            return { confidence: 0 };
        }

        const recent = numericValues.slice(-3);
        const trend = recent[recent.length - 1] - recent[0];
        const avgChange = trend / (recent.length - 1);
        const predictedNext = recent[recent.length - 1] + avgChange;

        const confidence = Math.min(0.6 + Math.random() * 0.3, 0.9); // 簡化的信心度

        return {
            type: 'trend_continuation',
            description: `預測下一個週期數值約為 ${predictedNext.toFixed(2)}`,
            confidence,
            findings: [
                `基於 ${recent.length} 個最近數據點`,
                `平均變化率: ${avgChange.toFixed(4)}`,
                `預測值: ${predictedNext.toFixed(2)}`
            ],
            implications: [
                trend > 0 ? '預期持續改善' : '預期可能下降',
                `預測準確度: ${(confidence * 100).toFixed(1)}%`
            ]
        };
    }

    _getUniqueCategories(insights) {
        return [...new Set(insights.map(insight => insight.metadata.category || insight.type))];
    }

    _generateActionRecommendations(insights) {
        const recommendations = [];

        const anomalyCount = insights.filter(i => i.type === INSIGHT_TYPES.ANOMALY).length;
        const trendCount = insights.filter(i => i.type === INSIGHT_TYPES.TREND).length;

        if (anomalyCount > 0) {
            recommendations.push('立即調查檢測到的異常情況');
            recommendations.push('建立異常監控和預警機制');
        }

        if (trendCount > 0) {
            recommendations.push('密切監控重要趨勢變化');
            recommendations.push('制定趨勢應對策略');
        }

        recommendations.push('定期檢視洞察結果和行動成效');

        return recommendations;
    }

    _generateActionItems(insights) {
        return insights.map(insight => ({
            title: `處理: ${insight.title}`,
            priority: insight.priority.label,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 一週後
            assignee: 'system_admin',
            description: insight.description
        }));
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 清理資源
     */
    async dispose() {
        this.removeAllListeners();
    }
}

module.exports = {
    InsightGenerator,
    INSIGHT_TYPES,
    INSIGHT_PRIORITY,
    PATTERN_TYPES,
    TREND_DIRECTIONS
};