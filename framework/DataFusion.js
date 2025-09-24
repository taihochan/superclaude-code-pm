/**
 * DataFusion - 智能數據融合引擎
 *
 * 功能：
 * - 多源異構數據的智能融合和標準化
 * - 語義分析和內容關聯性檢測
 * - 支持JSON、XML、Markdown、CSV等多種格式
 * - 實現加權融合和動態權重計算
 *
 * 頁面：核心融合層 / 數據處理引擎
 * 邏輯：基於語義理解進行數據融合，支持多格式轉換和智能合併
 * 需求：高準確率數據融合、格式標準化、關聯性分析
 * 用途：ResultIntegrator的核心數據處理組件
 * 配合：提供標準化融合結果供ConflictDetector和InsightGenerator使用
 */

const { EventEmitter } = require('events');

// 數據格式類型
const DATA_FORMATS = {
    JSON: 'json',
    XML: 'xml',
    MARKDOWN: 'markdown',
    CSV: 'csv',
    TEXT: 'text',
    HTML: 'html'
};

// 融合策略
const FUSION_STRATEGIES = {
    SEMANTIC: 'semantic',           // 基於語義的融合
    STRUCTURAL: 'structural',       // 基於結構的融合
    TEMPORAL: 'temporal',           // 基於時間的融合
    WEIGHTED: 'weighted',           // 加權融合
    CONSENSUS: 'consensus'          // 共識融合
};

// 語義類型
const SEMANTIC_TYPES = {
    TASK_RESULT: 'task_result',
    ANALYSIS_REPORT: 'analysis_report',
    CODE_REVIEW: 'code_review',
    PERFORMANCE_METRIC: 'performance_metric',
    ERROR_REPORT: 'error_report',
    USER_FEEDBACK: 'user_feedback',
    SYSTEM_STATUS: 'system_status'
};

/**
 * 數據解析器 - 統一數據格式解析
 */
class UniversalDataParser {
    constructor() {
        this.parsers = new Map([
            [DATA_FORMATS.JSON, this._parseJSON],
            [DATA_FORMATS.XML, this._parseXML],
            [DATA_FORMATS.MARKDOWN, this._parseMarkdown],
            [DATA_FORMATS.CSV, this._parseCSV],
            [DATA_FORMATS.TEXT, this._parseText],
            [DATA_FORMATS.HTML, this._parseHTML]
        ]);
    }

    /**
     * 解析數據
     */
    parse(data, format) {
        const parser = this.parsers.get(format);
        if (!parser) {
            throw new Error(`不支持的數據格式: ${format}`);
        }

        return parser.call(this, data);
    }

    /**
     * 自動檢測數據格式
     */
    detectFormat(data) {
        if (typeof data === 'object' && data !== null) {
            return DATA_FORMATS.JSON;
        }

        if (typeof data === 'string') {
            const trimmed = data.trim();

            // XML檢測
            if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
                return DATA_FORMATS.XML;
            }

            // JSON檢測
            try {
                JSON.parse(trimmed);
                return DATA_FORMATS.JSON;
            } catch (e) {}

            // Markdown檢測
            if (trimmed.includes('#') || trimmed.includes('```') || trimmed.includes('**')) {
                return DATA_FORMATS.MARKDOWN;
            }

            // CSV檢測
            if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
                return DATA_FORMATS.CSV;
            }

            // HTML檢測
            if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
                return DATA_FORMATS.HTML;
            }

            return DATA_FORMATS.TEXT;
        }

        throw new Error('無法檢測數據格式');
    }

    /**
     * 標準化數據結構
     */
    normalize(parsedData, format) {
        return {
            format,
            content: parsedData,
            structure: this._analyzeStructure(parsedData),
            metadata: this._extractMetadata(parsedData, format),
            semantics: this._extractSemantics(parsedData)
        };
    }

    // 格式解析器實現
    _parseJSON(data) {
        if (typeof data === 'object') {
            return data;
        }
        return JSON.parse(data);
    }

    _parseXML(data) {
        // 簡化XML解析（實際項目中可使用xml2js等庫）
        const xmlContent = {};
        const tagRegex = /<(\w+)>(.*?)<\/\1>/g;
        let match;

        while ((match = tagRegex.exec(data)) !== null) {
            xmlContent[match[1]] = match[2];
        }

        return xmlContent;
    }

    _parseMarkdown(data) {
        const sections = [];
        const lines = data.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.startsWith('#')) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.replace(/^#+\s*/, ''),
                    level: (line.match(/^#+/) || [''])[0].length,
                    content: []
                };
            } else if (currentSection) {
                currentSection.content.push(line);
            }
        }

        if (currentSection) {
            sections.push(currentSection);
        }

        return { sections };
    }

    _parseCSV(data) {
        const lines = data.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });

        return { headers, rows, rowCount: rows.length };
    }

    _parseText(data) {
        return {
            content: data,
            lines: data.split('\n'),
            wordCount: data.split(/\s+/).length,
            charCount: data.length
        };
    }

    _parseHTML(data) {
        // 簡化HTML解析
        const titleMatch = data.match(/<title>(.*?)<\/title>/i);
        const bodyMatch = data.match(/<body[^>]*>(.*?)<\/body>/is);

        return {
            title: titleMatch ? titleMatch[1] : null,
            body: bodyMatch ? bodyMatch[1] : data,
            hasScript: data.includes('<script'),
            hasStyle: data.includes('<style') || data.includes('<link')
        };
    }

    _analyzeStructure(data) {
        if (Array.isArray(data)) {
            return {
                type: 'array',
                length: data.length,
                elementTypes: [...new Set(data.map(item => typeof item))]
            };
        }

        if (typeof data === 'object' && data !== null) {
            return {
                type: 'object',
                keys: Object.keys(data),
                depth: this._calculateDepth(data),
                complexity: this._calculateComplexity(data)
            };
        }

        return {
            type: typeof data,
            length: typeof data === 'string' ? data.length : null
        };
    }

    _extractMetadata(data, format) {
        const metadata = {
            format,
            size: JSON.stringify(data).length,
            complexity: this._calculateComplexity(data),
            extractedAt: new Date().toISOString()
        };

        // 格式特定元數據
        switch (format) {
            case DATA_FORMATS.JSON:
                metadata.hasNestedObjects = this._hasNestedObjects(data);
                break;
            case DATA_FORMATS.CSV:
                metadata.columnCount = data.headers ? data.headers.length : 0;
                metadata.rowCount = data.rows ? data.rows.length : 0;
                break;
            case DATA_FORMATS.MARKDOWN:
                metadata.sectionCount = data.sections ? data.sections.length : 0;
                break;
        }

        return metadata;
    }

    _extractSemantics(data) {
        const semantics = {
            type: this._inferSemanticType(data),
            keywords: this._extractKeywords(data),
            entities: this._extractEntities(data),
            relationships: this._extractRelationships(data)
        };

        return semantics;
    }

    _calculateDepth(obj, currentDepth = 1) {
        if (typeof obj !== 'object' || obj === null) {
            return currentDepth;
        }

        let maxDepth = currentDepth;
        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, this._calculateDepth(value, currentDepth + 1));
            }
        }

        return maxDepth;
    }

    _calculateComplexity(data) {
        if (typeof data !== 'object' || data === null) {
            return 0;
        }

        let complexity = 0;
        const dataStr = JSON.stringify(data);

        complexity += dataStr.length / 1000; // 基於大小
        complexity += this._calculateDepth(data) * 2; // 基於深度
        complexity += Object.keys(data).length * 0.5; // 基於鍵數量

        return Math.round(complexity * 100) / 100;
    }

    _hasNestedObjects(obj) {
        if (typeof obj !== 'object' || obj === null) return false;

        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                return true;
            }
        }
        return false;
    }

    _inferSemanticType(data) {
        const dataStr = JSON.stringify(data).toLowerCase();

        // 基於關鍵詞的語義類型推斷
        if (dataStr.includes('error') || dataStr.includes('exception')) {
            return SEMANTIC_TYPES.ERROR_REPORT;
        }

        if (dataStr.includes('performance') || dataStr.includes('metric')) {
            return SEMANTIC_TYPES.PERFORMANCE_METRIC;
        }

        if (dataStr.includes('analysis') || dataStr.includes('report')) {
            return SEMANTIC_TYPES.ANALYSIS_REPORT;
        }

        if (dataStr.includes('code') || dataStr.includes('review')) {
            return SEMANTIC_TYPES.CODE_REVIEW;
        }

        if (dataStr.includes('task') || dataStr.includes('result')) {
            return SEMANTIC_TYPES.TASK_RESULT;
        }

        if (dataStr.includes('user') || dataStr.includes('feedback')) {
            return SEMANTIC_TYPES.USER_FEEDBACK;
        }

        if (dataStr.includes('status') || dataStr.includes('system')) {
            return SEMANTIC_TYPES.SYSTEM_STATUS;
        }

        return 'unknown';
    }

    _extractKeywords(data) {
        const dataStr = JSON.stringify(data).toLowerCase();
        const commonWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but']);

        const words = dataStr.match(/[a-z]+/g) || [];
        const wordFreq = {};

        words.forEach(word => {
            if (word.length > 3 && !commonWords.has(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });

        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    _extractEntities(data) {
        // 簡化實體提取
        const entities = {
            numbers: [],
            dates: [],
            urls: [],
            emails: []
        };

        const dataStr = JSON.stringify(data);

        // 提取數字
        const numbers = dataStr.match(/\d+\.?\d*/g);
        if (numbers) entities.numbers = [...new Set(numbers)];

        // 提取日期
        const dates = dataStr.match(/\d{4}-\d{2}-\d{2}/g);
        if (dates) entities.dates = [...new Set(dates)];

        // 提取URL
        const urls = dataStr.match(/https?:\/\/[^\s"]+/g);
        if (urls) entities.urls = [...new Set(urls)];

        // 提取郵箱
        const emails = dataStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emails) entities.emails = [...new Set(emails)];

        return entities;
    }

    _extractRelationships(data) {
        // 簡化關係提取
        const relationships = [];

        if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    relationships.push({
                        source: key,
                        target: typeof value,
                        type: 'contains'
                    });
                }
            });
        }

        return relationships;
    }
}

/**
 * 語義分析器
 */
class SemanticAnalyzer {
    constructor() {
        this.semanticCache = new Map();
    }

    /**
     * 分析語義簽名
     */
    async getSignature(resultItem) {
        const cacheKey = this._generateCacheKey(resultItem);

        if (this.semanticCache.has(cacheKey)) {
            return this.semanticCache.get(cacheKey);
        }

        const signature = await this._analyzeSemantics(resultItem);
        this.semanticCache.set(cacheKey, signature);

        return signature;
    }

    async _analyzeSemantics(resultItem) {
        const { data, metadata } = resultItem;

        // 基於內容的語義分析
        const contentSignature = this._analyzeContent(data);

        // 基於元數據的語義分析
        const metadataSignature = this._analyzeMetadata(metadata);

        // 組合語義簽名
        return {
            category: this._determineCategory(contentSignature, metadataSignature),
            confidence: this._calculateConfidence(contentSignature, metadataSignature),
            features: [...contentSignature.features, ...metadataSignature.features],
            embedding: this._generateEmbedding(contentSignature, metadataSignature)
        };
    }

    _analyzeContent(data) {
        const dataStr = JSON.stringify(data).toLowerCase();
        const features = [];

        // 特徵提取
        if (dataStr.includes('success') || dataStr.includes('completed')) {
            features.push('positive_outcome');
        }

        if (dataStr.includes('error') || dataStr.includes('failed')) {
            features.push('negative_outcome');
        }

        if (dataStr.includes('performance') || dataStr.includes('time')) {
            features.push('performance_related');
        }

        if (dataStr.includes('code') || dataStr.includes('function')) {
            features.push('code_related');
        }

        return {
            features,
            wordCount: dataStr.split(' ').length,
            complexity: this._calculateContentComplexity(data)
        };
    }

    _analyzeMetadata(metadata) {
        const features = [];

        // 基於來源的特徵
        switch (metadata.source) {
            case 'ccpm_task':
                features.push('project_management');
                break;
            case 'superclaude_agent':
                features.push('ai_analysis');
                break;
            case 'external_api':
                features.push('external_data');
                break;
        }

        // 基於類型的特徵
        if (metadata.type) {
            features.push(`type_${metadata.type}`);
        }

        // 基於優先級的特徵
        if (metadata.priority > 0.8) {
            features.push('high_priority');
        } else if (metadata.priority < 0.3) {
            features.push('low_priority');
        }

        return {
            features,
            source: metadata.source,
            priority: metadata.priority,
            confidence: metadata.confidence
        };
    }

    _determineCategory(contentSig, metadataSig) {
        const features = [...contentSig.features, ...metadataSig.features];

        // 分類邏輯
        if (features.includes('negative_outcome') || features.includes('error_related')) {
            return 'error_analysis';
        }

        if (features.includes('performance_related')) {
            return 'performance_analysis';
        }

        if (features.includes('code_related')) {
            return 'code_analysis';
        }

        if (features.includes('project_management')) {
            return 'project_status';
        }

        if (features.includes('ai_analysis')) {
            return 'ai_insight';
        }

        return 'general';
    }

    _calculateConfidence(contentSig, metadataSig) {
        let confidence = 0.5; // 基礎信心度

        // 基於特徵數量調整
        const totalFeatures = contentSig.features.length + metadataSig.features.length;
        confidence += Math.min(totalFeatures * 0.1, 0.3);

        // 基於元數據信心度調整
        confidence = (confidence + metadataSig.confidence) / 2;

        return Math.min(confidence, 1.0);
    }

    _calculateContentComplexity(data) {
        const dataStr = JSON.stringify(data);
        let complexity = 0;

        complexity += dataStr.length / 1000; // 基於長度
        complexity += (dataStr.match(/[{}]/g) || []).length * 0.1; // 基於結構複雜度
        complexity += (dataStr.match(/\d+/g) || []).length * 0.05; // 基於數字數量

        return Math.round(complexity * 100) / 100;
    }

    _generateEmbedding(contentSig, metadataSig) {
        // 簡化的向量嵌入生成
        const features = [...contentSig.features, ...metadataSig.features];
        const embedding = new Array(50).fill(0);

        features.forEach((feature, index) => {
            const hash = this._simpleHash(feature);
            embedding[hash % 50] += 1;
        });

        // 標準化
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
    }

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    _generateCacheKey(resultItem) {
        return `${resultItem.id}_${resultItem.metadata.timestamp}`;
    }
}

/**
 * 關聯性分析引擎
 */
class CorrelationEngine {
    constructor() {
        this.correlationThreshold = 0.7;
    }

    /**
     * 分析結果項目間的關聯性
     */
    async analyze(resultItems) {
        const correlations = [];

        for (let i = 0; i < resultItems.length; i++) {
            for (let j = i + 1; j < resultItems.length; j++) {
                const correlation = await this._calculateCorrelation(
                    resultItems[i],
                    resultItems[j]
                );

                if (correlation.strength >= this.correlationThreshold) {
                    correlations.push(correlation);
                }
            }
        }

        return correlations;
    }

    async _calculateCorrelation(item1, item2) {
        // 語義相似度
        const semanticSimilarity = this._calculateSemanticSimilarity(
            item1.semanticSignature,
            item2.semanticSignature
        );

        // 時間相關性
        const temporalCorrelation = this._calculateTemporalCorrelation(
            item1.metadata.timestamp,
            item2.metadata.timestamp
        );

        // 來源相關性
        const sourceCorrelation = this._calculateSourceCorrelation(
            item1.metadata.source,
            item2.metadata.source
        );

        // 內容相關性
        const contentCorrelation = this._calculateContentCorrelation(
            item1.data,
            item2.data
        );

        // 加權計算總相關性
        const weights = {
            semantic: 0.4,
            temporal: 0.2,
            source: 0.2,
            content: 0.2
        };

        const totalCorrelation =
            semanticSimilarity * weights.semantic +
            temporalCorrelation * weights.temporal +
            sourceCorrelation * weights.source +
            contentCorrelation * weights.content;

        return {
            item1Id: item1.id,
            item2Id: item2.id,
            strength: totalCorrelation,
            components: {
                semantic: semanticSimilarity,
                temporal: temporalCorrelation,
                source: sourceCorrelation,
                content: contentCorrelation
            },
            type: this._determineCorrelationType(semanticSimilarity, temporalCorrelation)
        };
    }

    _calculateSemanticSimilarity(sig1, sig2) {
        if (!sig1 || !sig2 || !sig1.embedding || !sig2.embedding) {
            return 0;
        }

        // 餘弦相似度計算
        const dotProduct = sig1.embedding.reduce((sum, val, i) =>
            sum + val * sig2.embedding[i], 0
        );

        const magnitude1 = Math.sqrt(sig1.embedding.reduce((sum, val) =>
            sum + val * val, 0
        ));

        const magnitude2 = Math.sqrt(sig2.embedding.reduce((sum, val) =>
            sum + val * val, 0
        ));

        if (magnitude1 === 0 || magnitude2 === 0) return 0;

        return dotProduct / (magnitude1 * magnitude2);
    }

    _calculateTemporalCorrelation(timestamp1, timestamp2) {
        const time1 = new Date(timestamp1).getTime();
        const time2 = new Date(timestamp2).getTime();
        const timeDiff = Math.abs(time1 - time2);

        // 時間差在5分鐘內視為高度相關
        const maxRelevantTime = 5 * 60 * 1000; // 5分鐘

        if (timeDiff > maxRelevantTime) return 0;

        return 1 - (timeDiff / maxRelevantTime);
    }

    _calculateSourceCorrelation(source1, source2) {
        if (source1 === source2) return 1.0;

        // 相關來源的相關性
        const relatedSources = {
            'ccmp_task': ['ccpm_project'],
            'superclaude_agent': ['external_api']
        };

        if (relatedSources[source1]?.includes(source2) ||
            relatedSources[source2]?.includes(source1)) {
            return 0.6;
        }

        return 0.1; // 基礎相關性
    }

    _calculateContentCorrelation(data1, data2) {
        const str1 = JSON.stringify(data1).toLowerCase();
        const str2 = JSON.stringify(data2).toLowerCase();

        // 簡化的內容相似度計算
        const words1 = str1.match(/[a-z]+/g) || [];
        const words2 = str2.match(/[a-z]+/g) || [];

        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = new Set([...words1, ...words2]).size;

        return totalWords > 0 ? commonWords.length / totalWords : 0;
    }

    _determineCorrelationType(semanticSim, temporalCorr) {
        if (semanticSim > 0.8 && temporalCorr > 0.8) {
            return 'strong_semantic_temporal';
        } else if (semanticSim > 0.8) {
            return 'semantic';
        } else if (temporalCorr > 0.8) {
            return 'temporal';
        } else {
            return 'weak';
        }
    }
}

/**
 * 動態權重系統
 */
class DynamicWeightingSystem {
    constructor() {
        this.baseWeights = {
            confidence: 0.3,
            reliability: 0.2,
            relevance: 0.2,
            recency: 0.15,
            consensus: 0.15
        };
    }

    /**
     * 計算動態權重
     */
    calculate(assessments) {
        const weights = { ...this.baseWeights };

        // 根據評估結果調整權重
        Object.entries(assessments).forEach(([key, value]) => {
            if (value < 0.3) {
                // 如果某個指標很低，降低其權重
                weights[key] *= 0.5;
            } else if (value > 0.8) {
                // 如果某個指標很高，提高其權重
                weights[key] *= 1.5;
            }
        });

        // 標準化權重
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        Object.keys(weights).forEach(key => {
            weights[key] /= totalWeight;
        });

        return weights;
    }
}

/**
 * 數據融合引擎主類
 */
class DataFusion extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            enableSemanticAnalysis: options.enableSemanticAnalysis !== false,
            enableCorrelationEngine: options.enableCorrelationEngine !== false,
            fusionStrategy: options.fusionStrategy || FUSION_STRATEGIES.WEIGHTED,
            qualityThreshold: options.qualityThreshold || 0.7,
            maxConcurrentFusions: options.maxConcurrentFusions || 5,
            ...options
        };

        // 核心組件
        this.dataParser = new UniversalDataParser();
        this.semanticAnalyzer = new SemanticAnalyzer();
        this.correlationEngine = new CorrelationEngine();
        this.weightingSystem = new DynamicWeightingSystem();

        // 融合統計
        this.stats = {
            totalFusions: 0,
            successfulFusions: 0,
            failedFusions: 0,
            averageFusionTime: 0,
            qualityScore: 0
        };

        this.initialized = false;
    }

    /**
     * 初始化融合引擎
     */
    async initialize() {
        try {
            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            throw new Error(`DataFusion初始化失敗: ${error.message}`);
        }
    }

    /**
     * 融合結果數據
     */
    async fuse(resultItems) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        try {
            // 階段1: 數據標準化
            const normalizedItems = await this._normalizeResults(resultItems);

            // 階段2: 語義分析
            const analyzedItems = this.options.enableSemanticAnalysis ?
                await this._analyzeSemantics(normalizedItems) : normalizedItems;

            // 階段3: 關聯性分析
            const correlations = this.options.enableCorrelationEngine ?
                await this._findCorrelations(analyzedItems) : [];

            // 階段4: 分組融合
            const groupedData = await this._groupBySemantics(analyzedItems, correlations);

            // 階段5: 執行融合
            const fusedData = await this._executeFusion(groupedData);

            // 階段6: 品質評估
            const qualityScore = await this._assessQuality(fusedData);

            // 更新統計
            const fusionTime = Date.now() - startTime;
            this._updateStats(fusionTime, qualityScore, true);

            this.emit('fusionCompleted', {
                inputCount: resultItems.length,
                outputGroups: Object.keys(fusedData).length,
                qualityScore,
                fusionTime
            });

            return {
                groups: fusedData,
                correlations,
                qualityScore,
                metadata: {
                    fusionTime,
                    strategy: this.options.fusionStrategy,
                    inputCount: resultItems.length
                }
            };

        } catch (error) {
            this._updateStats(Date.now() - startTime, 0, false);
            this.emit('fusionFailed', { error: error.message });
            throw error;
        }
    }

    /**
     * 獲取融合統計
     */
    getStats() {
        return { ...this.stats };
    }

    // 私有方法

    /**
     * 標準化結果數據
     * @private
     */
    async _normalizeResults(resultItems) {
        return resultItems.map(item => {
            // 檢測並解析數據格式
            const format = item.metadata.format || this.dataParser.detectFormat(item.data);
            const parsedData = this.dataParser.parse(item.data, format);
            const normalizedData = this.dataParser.normalize(parsedData, format);

            return {
                ...item,
                normalizedData,
                originalFormat: format
            };
        });
    }

    /**
     * 語義分析
     * @private
     */
    async _analyzeSemantics(normalizedItems) {
        const analyzedItems = [];

        for (const item of normalizedItems) {
            const semanticSignature = await this.semanticAnalyzer.getSignature(item);
            analyzedItems.push({
                ...item,
                semanticSignature
            });
        }

        return analyzedItems;
    }

    /**
     * 查找關聯性
     * @private
     */
    async _findCorrelations(analyzedItems) {
        return await this.correlationEngine.analyze(analyzedItems);
    }

    /**
     * 按語義分組
     * @private
     */
    async _groupBySemantics(items, correlations) {
        const groups = {};

        items.forEach(item => {
            const category = item.semanticSignature?.category || 'unknown';

            if (!groups[category]) {
                groups[category] = {
                    category,
                    items: [],
                    correlations: [],
                    confidence: 0
                };
            }

            groups[category].items.push(item);
        });

        // 添加關聯性信息
        correlations.forEach(correlation => {
            const item1 = items.find(item => item.id === correlation.item1Id);
            const item2 = items.find(item => item.id === correlation.item2Id);

            if (item1 && item2) {
                const category1 = item1.semanticSignature?.category || 'unknown';
                const category2 = item2.semanticSignature?.category || 'unknown';

                if (groups[category1]) {
                    groups[category1].correlations.push(correlation);
                }
                if (category1 !== category2 && groups[category2]) {
                    groups[category2].correlations.push(correlation);
                }
            }
        });

        // 計算分組信心度
        Object.values(groups).forEach(group => {
            if (group.items.length > 0) {
                group.confidence = group.items.reduce(
                    (sum, item) => sum + (item.semanticSignature?.confidence || 0),
                    0
                ) / group.items.length;
            }
        });

        return groups;
    }

    /**
     * 執行融合
     * @private
     */
    async _executeFusion(groupedData) {
        const fusedGroups = {};

        for (const [category, group] of Object.entries(groupedData)) {
            fusedGroups[category] = await this._fuseGroup(group);
        }

        return fusedGroups;
    }

    /**
     * 融合單個分組
     * @private
     */
    async _fuseGroup(group) {
        const { items } = group;

        if (items.length === 1) {
            return {
                ...group,
                fusedData: items[0].normalizedData.content,
                fusionStrategy: 'single_item',
                confidence: items[0].metadata.confidence
            };
        }

        // 根據策略執行融合
        switch (this.options.fusionStrategy) {
            case FUSION_STRATEGIES.WEIGHTED:
                return await this._weightedFusion(group);
            case FUSION_STRATEGIES.CONSENSUS:
                return await this._consensusFusion(group);
            case FUSION_STRATEGIES.SEMANTIC:
                return await this._semanticFusion(group);
            default:
                return await this._weightedFusion(group);
        }
    }

    /**
     * 加權融合
     * @private
     */
    async _weightedFusion(group) {
        const { items } = group;
        const weights = [];
        const data = [];

        items.forEach(item => {
            const weight = item.metadata.confidence *
                          (item.semanticSignature?.confidence || 1) *
                          (1 / (1 + item.errors.length)); // 錯誤懲罰

            weights.push(weight);
            data.push(item.normalizedData.content);
        });

        // 標準化權重
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);

        // 執行加權合併
        const fusedData = await this._mergeWithWeights(data, normalizedWeights);

        return {
            ...group,
            fusedData,
            fusionStrategy: FUSION_STRATEGIES.WEIGHTED,
            weights: normalizedWeights,
            confidence: totalWeight / items.length
        };
    }

    /**
     * 共識融合
     * @private
     */
    async _consensusFusion(group) {
        const { items } = group;
        const consensusData = {};

        // 對於每個數據字段，找到共識值
        items.forEach(item => {
            const content = item.normalizedData.content;
            this._extractFields(content).forEach(([field, value]) => {
                if (!consensusData[field]) {
                    consensusData[field] = [];
                }
                consensusData[field].push({
                    value,
                    confidence: item.metadata.confidence,
                    source: item.metadata.sourceId
                });
            });
        });

        // 計算共識
        const fusedData = {};
        Object.entries(consensusData).forEach(([field, values]) => {
            fusedData[field] = this._calculateConsensus(values);
        });

        return {
            ...group,
            fusedData,
            fusionStrategy: FUSION_STRATEGIES.CONSENSUS,
            confidence: this._calculateGroupConfidence(Object.values(consensusData))
        };
    }

    /**
     * 語義融合
     * @private
     */
    async _semanticFusion(group) {
        // 基於語義相似度的融合
        const { items } = group;
        const semanticClusters = this._clusterBySemantic(items);

        const fusedClusters = {};
        for (const [clusterId, clusterItems] of Object.entries(semanticClusters)) {
            fusedClusters[clusterId] = await this._mergeSemanticCluster(clusterItems);
        }

        return {
            ...group,
            fusedData: fusedClusters,
            fusionStrategy: FUSION_STRATEGIES.SEMANTIC,
            confidence: group.confidence
        };
    }

    /**
     * 品質評估
     * @private
     */
    async _assessQuality(fusedData) {
        let totalQuality = 0;
        let groupCount = 0;

        Object.values(fusedData).forEach(group => {
            const confidence = group.confidence || 0;
            const completeness = this._assessCompleteness(group);
            const consistency = this._assessConsistency(group);

            const groupQuality = (confidence + completeness + consistency) / 3;
            totalQuality += groupQuality;
            groupCount++;
        });

        return groupCount > 0 ? totalQuality / groupCount : 0;
    }

    /**
     * 更新統計
     * @private
     */
    _updateStats(fusionTime, qualityScore, success) {
        this.stats.totalFusions++;

        if (success) {
            this.stats.successfulFusions++;
        } else {
            this.stats.failedFusions++;
        }

        // 更新平均融合時間
        const currentAvg = this.stats.averageFusionTime;
        const total = this.stats.totalFusions;
        this.stats.averageFusionTime = (currentAvg * (total - 1) + fusionTime) / total;

        // 更新品質分數
        this.stats.qualityScore = (this.stats.qualityScore + qualityScore) / 2;
    }

    // 輔助方法

    _mergeWithWeights(data, weights) {
        // 簡化的加權合併實現
        const merged = {};

        data.forEach((item, index) => {
            const weight = weights[index];

            if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([key, value]) => {
                    if (!merged[key]) {
                        merged[key] = { weightedSum: 0, totalWeight: 0 };
                    }

                    if (typeof value === 'number') {
                        merged[key].weightedSum += value * weight;
                        merged[key].totalWeight += weight;
                    } else {
                        // 對於非數字值，保持原值（可以改進）
                        merged[key] = value;
                    }
                });
            }
        });

        // 計算加權平均
        Object.keys(merged).forEach(key => {
            if (merged[key].totalWeight && merged[key].totalWeight > 0) {
                merged[key] = merged[key].weightedSum / merged[key].totalWeight;
            }
        });

        return merged;
    }

    _extractFields(content) {
        if (typeof content === 'object' && content !== null) {
            return Object.entries(content);
        }
        return [];
    }

    _calculateConsensus(values) {
        // 簡化的共識計算
        if (values.length === 0) return null;

        // 對於數字值，計算加權平均
        const numericValues = values.filter(v => typeof v.value === 'number');
        if (numericValues.length > 0) {
            const weightedSum = numericValues.reduce((sum, v) => sum + v.value * v.confidence, 0);
            const totalWeight = numericValues.reduce((sum, v) => sum + v.confidence, 0);
            return totalWeight > 0 ? weightedSum / totalWeight : 0;
        }

        // 對於其他類型，選擇信心度最高的值
        return values.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        ).value;
    }

    _calculateGroupConfidence(fieldGroups) {
        if (fieldGroups.length === 0) return 0;

        const totalConfidence = fieldGroups.reduce((sum, group) => {
            const avgConfidence = group.reduce((s, item) => s + item.confidence, 0) / group.length;
            return sum + avgConfidence;
        }, 0);

        return totalConfidence / fieldGroups.length;
    }

    _clusterBySemantic(items) {
        // 簡化的語義聚類
        const clusters = { main: items };
        return clusters;
    }

    _mergeSemanticCluster(items) {
        // 語義聚類合併
        const merged = {
            items: items.map(item => item.normalizedData.content),
            count: items.length,
            confidence: items.reduce((sum, item) => sum + item.metadata.confidence, 0) / items.length
        };

        return merged;
    }

    _assessCompleteness(group) {
        // 評估數據完整性
        const items = group.items || [];
        if (items.length === 0) return 0;

        const completenessScores = items.map(item => {
            const data = item.normalizedData?.content || {};
            const fieldCount = Object.keys(data).length;
            return Math.min(fieldCount / 10, 1); // 假設10個字段為完整
        });

        return completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length;
    }

    _assessConsistency(group) {
        // 評估數據一致性
        const items = group.items || [];
        if (items.length <= 1) return 1;

        const correlations = group.correlations || [];
        const avgCorrelation = correlations.length > 0 ?
            correlations.reduce((sum, corr) => sum + corr.strength, 0) / correlations.length :
            0.5;

        return avgCorrelation;
    }

    /**
     * 清理資源
     */
    async dispose() {
        this.removeAllListeners();
    }
}

module.exports = { DataFusion, DATA_FORMATS, FUSION_STRATEGIES, SEMANTIC_TYPES };