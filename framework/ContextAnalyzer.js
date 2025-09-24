/**
 * ContextAnalyzer - 上下文分析器
 *
 * 功能：
 * - 深度分析命令內容（語意、意圖、複雜度）
 * - 分析環境上下文（歷史記錄、系統狀態、模式）
 * - 智能特徵提取和模式識別
 * - 提供決策支持的上下文洞察
 *
 * 用途：SmartRouter的核心分析組件
 * 配合：為DecisionEngine提供深度分析結果
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs'.promises;

// 分析狀態
const ANALYSIS_STATUS = {
    PENDING: 'pending',
    ANALYZING: 'analyzing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// 上下文類型
const CONTEXT_TYPES = {
    COMMAND: 'command',           // 命令上下文
    PROJECT: 'project',           // 項目上下文
    SESSION: 'session',           // 會話上下文
    HISTORICAL: 'historical',     // 歷史上下文
    ENVIRONMENTAL: 'environmental', // 環境上下文
    USER: 'user'                 // 用戶上下文
};

// 意圖分類
const INTENT_CATEGORIES = {
    CREATE: { value: 'create', keywords: ['create', 'generate', 'build', 'make', 'add', 'new'], priority: 1 },
    ANALYZE: { value: 'analyze', keywords: ['analyze', 'review', 'examine', 'check', 'inspect', 'audit'], priority: 2 },
    MODIFY: { value: 'modify', keywords: ['update', 'modify', 'change', 'edit', 'alter', 'refactor'], priority: 3 },
    FIX: { value: 'fix', keywords: ['fix', 'repair', 'debug', 'resolve', 'correct', 'solve'], priority: 4 },
    OPTIMIZE: { value: 'optimize', keywords: ['optimize', 'improve', 'enhance', 'boost', 'accelerate'], priority: 5 },
    TEST: { value: 'test', keywords: ['test', 'validate', 'verify', 'confirm', 'check'], priority: 6 },
    DEPLOY: { value: 'deploy', keywords: ['deploy', 'publish', 'release', 'launch', 'distribute'], priority: 7 },
    LEARN: { value: 'learn', keywords: ['learn', 'understand', 'explain', 'teach', 'show'], priority: 8 },
    DELETE: { value: 'delete', keywords: ['delete', 'remove', 'clean', 'clear', 'purge'], priority: 9 }
};

// 複雜度指標
const COMPLEXITY_INDICATORS = {
    LEXICAL: {
        LONG_WORDS: { threshold: 8, weight: 0.1 },
        TECHNICAL_TERMS: { patterns: /\b(async|await|promise|callback|middleware|api|database|algorithm|architecture)\b/gi, weight: 0.15 },
        FORMAL_LANGUAGE: { patterns: /\b(shall|must|should|requirements|specifications)\b/gi, weight: 0.05 }
    },
    SYNTACTIC: {
        NESTED_STRUCTURES: { patterns: /\(.*\(.*\).*\)/g, weight: 0.1 },
        MULTIPLE_CLAUSES: { patterns: /[,;].*[,;]/g, weight: 0.08 },
        CONDITIONAL_LOGIC: { patterns: /\b(if|when|where|unless|while|until)\b/gi, weight: 0.12 }
    },
    SEMANTIC: {
        MULTI_STEP: { patterns: /\b(then|next|after|before|step|phase)\b/gi, weight: 0.15 },
        CROSS_DOMAIN: { patterns: /\b(integrate|coordinate|synchronize|combine|merge)\b/gi, weight: 0.12 },
        ABSTRACT_CONCEPTS: { patterns: /\b(strategy|pattern|paradigm|architecture|framework)\b/gi, weight: 0.1 }
    },
    COMPUTATIONAL: {
        MULTIPLE_OPERATIONS: { patterns: /\b(and|also|plus|additionally|furthermore)\b/gi, weight: 0.1 },
        RESOURCE_INTENSIVE: { patterns: /\b(optimize|process|analyze|compute|calculate)\b/gi, weight: 0.08 },
        CONCURRENT_TASKS: { patterns: /\b(parallel|concurrent|simultaneous|batch)\b/gi, weight: 0.12 }
    }
};

/**
 * 分析結果類
 */
class AnalysisResult {
    constructor(command, contextType = CONTEXT_TYPES.COMMAND) {
        this.id = this._generateId();
        this.command = command;
        this.contextType = contextType;
        this.timestamp = Date.now();
        this.status = ANALYSIS_STATUS.PENDING;

        // 基礎分析
        this.tokens = [];
        this.commandType = null;
        this.intent = null;
        this.complexity = {
            overall: 0,
            lexical: 0,
            syntactic: 0,
            semantic: 0,
            computational: 0
        };

        // 語意分析
        this.semantics = {
            entities: [],
            relations: [],
            topics: [],
            sentiment: { score: 0, label: 'neutral' },
            keyPhrases: []
        };

        // 上下文分析
        this.context = {
            project: null,
            session: null,
            historical: null,
            environmental: null,
            user: null
        };

        // 模式識別
        this.patterns = {
            identified: [],
            confidence: 0,
            recommendations: []
        };

        // 需求分析
        this.requirements = {
            files: [],
            technologies: [],
            actions: [],
            dependencies: [],
            constraints: []
        };

        // 分析元數據
        this.analysisTime = 0;
        this.confidence = 0;
        this.insights = [];
    }

    _generateId() {
        return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 添加洞察
     * @param {string} type - 洞察類型
     * @param {string} description - 描述
     * @param {number} confidence - 置信度
     */
    addInsight(type, description, confidence = 0.5) {
        this.insights.push({
            type,
            description,
            confidence,
            timestamp: Date.now()
        });
    }

    /**
     * 獲取分析摘要
     * @returns {Object} 分析摘要
     */
    getSummary() {
        return {
            id: this.id,
            command: this.command.substring(0, 100) + (this.command.length > 100 ? '...' : ''),
            commandType: this.commandType,
            intent: this.intent,
            complexity: this.complexity.overall,
            confidence: this.confidence,
            analysisTime: this.analysisTime,
            insightsCount: this.insights.length,
            status: this.status
        };
    }
}

/**
 * 上下文分析器
 */
class ContextAnalyzer extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 分析配置
            maxAnalysisTime: 5000, // 5秒分析超時
            enableDeepAnalysis: true,
            enableSemanticAnalysis: true,
            enablePatternRecognition: true,

            // 快取配置
            enableCaching: true,
            cacheSize: 1000,
            cacheTTL: 3600000, // 1小時

            // NLP配置
            enableNLP: true,
            sentimentAnalysis: true,
            entityExtraction: true,
            topicModeling: true,

            // 上下文配置
            projectContextPath: '.claude',
            sessionContextSize: 100,
            historicalContextSize: 1000,

            ...options
        };

        // 分析組件
        this.nlpProcessor = null;
        this.intentClassifier = null;
        this.complexityAnalyzer = null;
        this.patternRecognizer = null;

        // 快取系統
        this.analysisCache = new Map();
        this.contextCache = new Map();

        // 上下文存儲
        this.projectContext = null;
        this.sessionHistory = [];
        this.historicalPatterns = new Map();

        // 統計信息
        this.stats = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            averageAnalysisTime: 0,
            cacheHitRate: 0,
            patternMatchRate: 0
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化上下文分析器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[ContextAnalyzer] 初始化上下文分析器...');

            // 初始化NLP組件
            await this._initializeNLPComponents();

            // 載入項目上下文
            await this._loadProjectContext();

            // 載入歷史模式
            await this._loadHistoricalPatterns();

            // 設置快取清理定時器
            this._setupCacheCleanup();

            this.initialized = true;
            console.log('[ContextAnalyzer] 上下文分析器初始化完成');
            this.emit('initialized');

        } catch (error) {
            console.error('[ContextAnalyzer] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 分析命令和上下文
     * @param {string} command - 命令字符串
     * @param {Object} context - 額外上下文信息
     * @returns {Promise<AnalysisResult>} 分析結果
     */
    async analyze(command, context = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        // 檢查快取
        const cacheKey = this._generateCacheKey(command, context);
        if (this.options.enableCaching && this.analysisCache.has(cacheKey)) {
            const cached = this.analysisCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.options.cacheTTL) {
                console.log('[ContextAnalyzer] 快取命中');
                this._updateCacheHitRate(true);
                return cached.result;
            } else {
                this.analysisCache.delete(cacheKey);
            }
        }

        this._updateCacheHitRate(false);

        // 創建分析結果
        const result = new AnalysisResult(command, context.type);
        result.status = ANALYSIS_STATUS.ANALYZING;

        try {
            // 發送分析開始事件
            this.emit('analysisStarted', {
                id: result.id,
                command: command.substring(0, 50) + '...'
            });

            // 執行分析流水線
            await this._executeAnalysisPipeline(result, context);

            // 計算總體置信度
            result.confidence = this._calculateOverallConfidence(result);

            // 生成洞察
            await this._generateInsights(result);

            result.status = ANALYSIS_STATUS.COMPLETED;
            result.analysisTime = Date.now() - startTime;

            // 更新統計
            this._updateStats(result, true);

            // 快取結果
            if (this.options.enableCaching) {
                this.analysisCache.set(cacheKey, {
                    timestamp: Date.now(),
                    result: result
                });
            }

            // 更新會話歷史
            this._updateSessionHistory(result);

            this.emit('analysisCompleted', result.getSummary());
            return result;

        } catch (error) {
            result.status = ANALYSIS_STATUS.FAILED;
            result.analysisTime = Date.now() - startTime;

            this._updateStats(result, false);

            console.error('[ContextAnalyzer] 分析失敗:', error);
            this.emit('analysisFailed', { id: result.id, error: error.message });

            throw error;
        }
    }

    /**
     * 批量分析
     * @param {Array} commands - 命令列表
     * @param {Object} context - 共享上下文
     * @returns {Promise<Array>} 分析結果列表
     */
    async analyzeMultiple(commands, context = {}) {
        const results = [];

        for (const command of commands) {
            try {
                const result = await this.analyze(command, context);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error, command });
            }
        }

        return results;
    }

    /**
     * 獲取項目上下文
     * @returns {Object} 項目上下文
     */
    getProjectContext() {
        return this.projectContext;
    }

    /**
     * 獲取會話歷史
     * @param {number} limit - 限制數量
     * @returns {Array} 會話歷史
     */
    getSessionHistory(limit = 10) {
        return this.sessionHistory.slice(-limit);
    }

    /**
     * 獲取歷史模式
     * @param {string} type - 模式類型
     * @returns {Array} 歷史模式
     */
    getHistoricalPatterns(type = null) {
        if (type) {
            return this.historicalPatterns.get(type) || [];
        }
        return Array.from(this.historicalPatterns.values()).flat();
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.analysisCache.size,
            sessionHistorySize: this.sessionHistory.length,
            patternsCount: Array.from(this.historicalPatterns.values()).reduce((sum, arr) => sum + arr.length, 0)
        };
    }

    /**
     * 清理快取
     */
    clearCache() {
        const oldSize = this.analysisCache.size;
        this.analysisCache.clear();
        this.contextCache.clear();

        console.log(`[ContextAnalyzer] 已清理快取 (${oldSize} 項目)`);
        this.emit('cacheCleared', { clearedItems: oldSize });
    }

    // ========== 私有方法 ==========

    /**
     * 執行分析流水線
     * @private
     */
    async _executeAnalysisPipeline(result, context) {
        // 階段 1: 基礎分析
        await this._performBasicAnalysis(result);

        // 階段 2: 語意分析
        if (this.options.enableSemanticAnalysis) {
            await this._performSemanticAnalysis(result);
        }

        // 階段 3: 上下文分析
        await this._performContextAnalysis(result, context);

        // 階段 4: 模式識別
        if (this.options.enablePatternRecognition) {
            await this._performPatternRecognition(result);
        }

        // 階段 5: 需求分析
        await this._performRequirementsAnalysis(result);
    }

    /**
     * 執行基礎分析
     * @private
     */
    async _performBasicAnalysis(result) {
        const command = result.command.trim();

        // Token化
        result.tokens = this._tokenize(command);

        // 檢測命令類型
        result.commandType = this._detectCommandType(command);

        // 分類意圖
        result.intent = this._classifyIntent(command);

        // 計算複雜度
        result.complexity = this._calculateComplexity(command);

        console.log(`[ContextAnalyzer] 基礎分析完成 - 類型: ${result.commandType}, 意圖: ${result.intent}, 複雜度: ${result.complexity.overall.toFixed(3)}`);
    }

    /**
     * Token化
     * @private
     */
    _tokenize(command) {
        // 基礎Token化 - 分割單詞並清理
        return command
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1)
            .filter(token => !this._isStopWord(token));
    }

    /**
     * 檢查停用詞
     * @private
     */
    _isStopWord(word) {
        const stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'were', 'will', 'with', 'this', 'can', 'should'
        ]);
        return stopWords.has(word);
    }

    /**
     * 檢測命令類型
     * @private
     */
    _detectCommandType(command) {
        const cmd = command.toLowerCase().trim();

        // SuperClaude命令
        if (cmd.startsWith('/sc:')) {
            const scCommand = cmd.substring(4);
            if (scCommand.includes('analyze')) return 'sc_analyze';
            if (scCommand.includes('implement')) return 'sc_implement';
            if (scCommand.includes('improve')) return 'sc_improve';
            if (scCommand.includes('test')) return 'sc_test';
            return 'superclaude';
        }

        // CCPM命令
        if (cmd.startsWith('ccpm:')) return 'ccpm';

        // 基於關鍵字的類型檢測
        const typeKeywords = {
            analysis: ['analyze', 'review', 'examine', 'check', 'inspect', 'audit'],
            generation: ['create', 'generate', 'build', 'make', 'produce', 'construct'],
            modification: ['update', 'modify', 'change', 'edit', 'alter', 'refactor'],
            debugging: ['fix', 'debug', 'resolve', 'repair', 'solve', 'troubleshoot'],
            optimization: ['optimize', 'improve', 'enhance', 'boost', 'accelerate'],
            testing: ['test', 'validate', 'verify', 'check', 'confirm'],
            deployment: ['deploy', 'publish', 'release', 'launch', 'distribute'],
            learning: ['learn', 'understand', 'explain', 'teach', 'demonstrate'],
            maintenance: ['clean', 'maintain', 'update', 'backup', 'archive']
        };

        for (const [type, keywords] of Object.entries(typeKeywords)) {
            if (keywords.some(keyword => cmd.includes(keyword))) {
                return type;
            }
        }

        return 'general';
    }

    /**
     * 分類意圖
     * @private
     */
    _classifyIntent(command) {
        const cmd = command.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;

        for (const [intentType, config] of Object.entries(INTENT_CATEGORIES)) {
            let score = 0;

            // 關鍵字匹配
            for (const keyword of config.keywords) {
                if (cmd.includes(keyword)) {
                    score += 1 / config.priority; // 優先級越高，權重越大
                }
            }

            // 位置權重 - 開頭的關鍵字權重更高
            for (const keyword of config.keywords) {
                const index = cmd.indexOf(keyword);
                if (index !== -1) {
                    const positionWeight = Math.max(0.5, 1 - (index / cmd.length));
                    score += positionWeight * 0.5;
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = config.value;
            }
        }

        return bestMatch || 'unknown';
    }

    /**
     * 計算複雜度
     * @private
     */
    _calculateComplexity(command) {
        const complexity = {
            overall: 0,
            lexical: 0,
            syntactic: 0,
            semantic: 0,
            computational: 0
        };

        // 詞彙複雜度
        complexity.lexical = this._calculateLexicalComplexity(command);

        // 語法複雜度
        complexity.syntactic = this._calculateSyntacticComplexity(command);

        // 語意複雜度
        complexity.semantic = this._calculateSemanticComplexity(command);

        // 計算複雜度
        complexity.computational = this._calculateComputationalComplexity(command);

        // 計算總體複雜度
        complexity.overall = (
            complexity.lexical * 0.2 +
            complexity.syntactic * 0.2 +
            complexity.semantic * 0.3 +
            complexity.computational * 0.3
        );

        return complexity;
    }

    /**
     * 計算詞彙複雜度
     * @private
     */
    _calculateLexicalComplexity(command) {
        let score = 0;
        const indicators = COMPLEXITY_INDICATORS.LEXICAL;

        // 長單詞
        const words = command.split(/\s+/);
        const longWords = words.filter(word => word.length > indicators.LONG_WORDS.threshold);
        score += (longWords.length / words.length) * indicators.LONG_WORDS.weight;

        // 技術術語
        const techMatches = (command.match(indicators.TECHNICAL_TERMS.patterns) || []).length;
        score += Math.min(techMatches / 5, 1) * indicators.TECHNICAL_TERMS.weight;

        // 正式語言
        const formalMatches = (command.match(indicators.FORMAL_LANGUAGE.patterns) || []).length;
        score += Math.min(formalMatches / 3, 1) * indicators.FORMAL_LANGUAGE.weight;

        return Math.min(score, 1);
    }

    /**
     * 計算語法複雜度
     * @private
     */
    _calculateSyntacticComplexity(command) {
        let score = 0;
        const indicators = COMPLEXITY_INDICATORS.SYNTACTIC;

        // 嵌套結構
        const nestedMatches = (command.match(indicators.NESTED_STRUCTURES.patterns) || []).length;
        score += Math.min(nestedMatches / 2, 1) * indicators.NESTED_STRUCTURES.weight;

        // 多重子句
        const clauseMatches = (command.match(indicators.MULTIPLE_CLAUSES.patterns) || []).length;
        score += Math.min(clauseMatches / 3, 1) * indicators.MULTIPLE_CLAUSES.weight;

        // 條件邏輯
        const conditionalMatches = (command.match(indicators.CONDITIONAL_LOGIC.patterns) || []).length;
        score += Math.min(conditionalMatches / 2, 1) * indicators.CONDITIONAL_LOGIC.weight;

        return Math.min(score, 1);
    }

    /**
     * 計算語意複雜度
     * @private
     */
    _calculateSemanticComplexity(command) {
        let score = 0;
        const indicators = COMPLEXITY_INDICATORS.SEMANTIC;

        // 多步驟指令
        const stepMatches = (command.match(indicators.MULTI_STEP.patterns) || []).length;
        score += Math.min(stepMatches / 3, 1) * indicators.MULTI_STEP.weight;

        // 跨領域概念
        const domainMatches = (command.match(indicators.CROSS_DOMAIN.patterns) || []).length;
        score += Math.min(domainMatches / 2, 1) * indicators.CROSS_DOMAIN.weight;

        // 抽象概念
        const abstractMatches = (command.match(indicators.ABSTRACT_CONCEPTS.patterns) || []).length;
        score += Math.min(abstractMatches / 2, 1) * indicators.ABSTRACT_CONCEPTS.weight;

        return Math.min(score, 1);
    }

    /**
     * 計算計算複雜度
     * @private
     */
    _calculateComputationalComplexity(command) {
        let score = 0;
        const indicators = COMPLEXITY_INDICATORS.COMPUTATIONAL;

        // 多重操作
        const operationMatches = (command.match(indicators.MULTIPLE_OPERATIONS.patterns) || []).length;
        score += Math.min(operationMatches / 4, 1) * indicators.MULTIPLE_OPERATIONS.weight;

        // 資源密集型任務
        const resourceMatches = (command.match(indicators.RESOURCE_INTENSIVE.patterns) || []).length;
        score += Math.min(resourceMatches / 2, 1) * indicators.RESOURCE_INTENSIVE.weight;

        // 並發任務
        const concurrentMatches = (command.match(indicators.CONCURRENT_TASKS.patterns) || []).length;
        score += Math.min(concurrentMatches / 1, 1) * indicators.CONCURRENT_TASKS.weight;

        return Math.min(score, 1);
    }

    /**
     * 執行語意分析
     * @private
     */
    async _performSemanticAnalysis(result) {
        const command = result.command;

        // 實體提取
        result.semantics.entities = this._extractEntities(command);

        // 關係提取
        result.semantics.relations = this._extractRelations(command, result.semantics.entities);

        // 主題建模
        result.semantics.topics = this._extractTopics(command, result.tokens);

        // 情感分析
        result.semantics.sentiment = this._analyzeSentiment(command);

        // 關鍵短語提取
        result.semantics.keyPhrases = this._extractKeyPhrases(command, result.tokens);

        console.log(`[ContextAnalyzer] 語意分析完成 - 實體: ${result.semantics.entities.length}, 主題: ${result.semantics.topics.length}`);
    }

    /**
     * 提取實體
     * @private
     */
    _extractEntities(command) {
        const entities = [];

        // 文件路徑實體
        const fileMatches = command.match(/[\w-]+\.(js|ts|vue|py|json|md|yml|yaml|txt|html|css|scss)/g);
        if (fileMatches) {
            entities.push(...fileMatches.map(file => ({
                type: 'FILE',
                value: file,
                start: command.indexOf(file),
                end: command.indexOf(file) + file.length
            })));
        }

        // 目錄路徑實體
        const dirMatches = command.match(/[\w-]+\/[\w-\/]*/g);
        if (dirMatches) {
            entities.push(...dirMatches.map(dir => ({
                type: 'DIRECTORY',
                value: dir,
                start: command.indexOf(dir),
                end: command.indexOf(dir) + dir.length
            })));
        }

        // 技術實體
        const techTerms = [
            'vue', 'react', 'angular', 'node', 'python', 'javascript', 'typescript',
            'docker', 'kubernetes', 'git', 'npm', 'yarn', 'webpack', 'vite',
            'api', 'rest', 'graphql', 'websocket', 'database', 'sql', 'mongodb',
            'redis', 'nginx', 'apache', 'aws', 'azure', 'gcp'
        ];

        for (const term of techTerms) {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            const matches = command.match(regex);
            if (matches) {
                for (const match of matches) {
                    const start = command.toLowerCase().indexOf(match.toLowerCase());
                    entities.push({
                        type: 'TECHNOLOGY',
                        value: match,
                        start,
                        end: start + match.length
                    });
                }
            }
        }

        return entities;
    }

    /**
     * 提取關係
     * @private
     */
    _extractRelations(command, entities) {
        const relations = [];

        // 簡單的關係提取 - 基於動詞和介詞
        const relationPatterns = [
            { pattern: /(\w+)\s+(in|on|at|from|to)\s+(\w+)/gi, type: 'LOCATION' },
            { pattern: /(\w+)\s+(uses?|depends?\s+on|requires?)\s+(\w+)/gi, type: 'DEPENDENCY' },
            { pattern: /(\w+)\s+(creates?|generates?|builds?)\s+(\w+)/gi, type: 'CREATION' },
            { pattern: /(\w+)\s+(modifies?|updates?|changes?)\s+(\w+)/gi, type: 'MODIFICATION' }
        ];

        for (const { pattern, type } of relationPatterns) {
            let match;
            while ((match = pattern.exec(command)) !== null) {
                relations.push({
                    type,
                    source: match[1],
                    relation: match[2],
                    target: match[3],
                    confidence: 0.7
                });
            }
        }

        return relations;
    }

    /**
     * 提取主題
     * @private
     */
    _extractTopics(command, tokens) {
        const topics = [];

        // 基於關鍵字聚類的簡單主題提取
        const topicClusters = {
            development: ['code', 'develop', 'program', 'implement', 'build', 'create'],
            testing: ['test', 'verify', 'validate', 'check', 'confirm'],
            deployment: ['deploy', 'release', 'publish', 'launch', 'production'],
            maintenance: ['fix', 'debug', 'repair', 'optimize', 'clean', 'maintain'],
            documentation: ['document', 'write', 'explain', 'describe', 'readme'],
            analysis: ['analyze', 'review', 'examine', 'inspect', 'audit']
        };

        for (const [topic, keywords] of Object.entries(topicClusters)) {
            const matchCount = keywords.filter(keyword => tokens.includes(keyword)).length;
            if (matchCount > 0) {
                topics.push({
                    name: topic,
                    confidence: Math.min(matchCount / keywords.length, 1),
                    keywords: keywords.filter(keyword => tokens.includes(keyword))
                });
            }
        }

        return topics.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 分析情感
     * @private
     */
    _analyzeSentiment(command) {
        // 簡單的情感分析 - 基於情感詞典
        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'awesome', 'amazing', 'best', 'improve', 'optimize'];
        const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'broken', 'error', 'fail', 'problem', 'issue', 'bug'];
        const neutralWords = ['analyze', 'check', 'review', 'create', 'update', 'modify'];

        const words = command.toLowerCase().split(/\s+/);

        let positiveScore = positiveWords.filter(word => words.includes(word)).length;
        let negativeScore = negativeWords.filter(word => words.includes(word)).length;
        let neutralScore = neutralWords.filter(word => words.includes(word)).length;

        const totalScore = positiveScore + negativeScore + neutralScore;

        if (totalScore === 0) {
            return { score: 0, label: 'neutral' };
        }

        const score = (positiveScore - negativeScore) / totalScore;

        let label;
        if (score > 0.2) label = 'positive';
        else if (score < -0.2) label = 'negative';
        else label = 'neutral';

        return { score, label };
    }

    /**
     * 提取關鍵短語
     * @private
     */
    _extractKeyPhrases(command, tokens) {
        const phrases = [];

        // 提取2-3詞的短語
        for (let i = 0; i < tokens.length - 1; i++) {
            const phrase2 = `${tokens[i]} ${tokens[i + 1]}`;
            if (this._isSignificantPhrase(phrase2)) {
                phrases.push({
                    text: phrase2,
                    type: 'BIGRAM',
                    significance: this._calculatePhraseSignificance(phrase2)
                });
            }

            if (i < tokens.length - 2) {
                const phrase3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
                if (this._isSignificantPhrase(phrase3)) {
                    phrases.push({
                        text: phrase3,
                        type: 'TRIGRAM',
                        significance: this._calculatePhraseSignificance(phrase3)
                    });
                }
            }
        }

        return phrases
            .sort((a, b) => b.significance - a.significance)
            .slice(0, 10); // 取前10個最重要的短語
    }

    /**
     * 檢查短語是否重要
     * @private
     */
    _isSignificantPhrase(phrase) {
        // 過濾掉常見的無意義組合
        const insignificantPatterns = [
            /^(the|a|an)\s/,
            /\s(is|are|was|were|be|been)$/,
            /^(in|on|at|by|for|with)$/
        ];

        return !insignificantPatterns.some(pattern => pattern.test(phrase));
    }

    /**
     * 計算短語重要性
     * @private
     */
    _calculatePhraseSignificance(phrase) {
        let significance = 0.5;

        // 技術短語提升重要性
        const technicalKeywords = [
            'machine learning', 'artificial intelligence', 'data analysis',
            'web development', 'software engineering', 'system design',
            'code review', 'unit test', 'integration test'
        ];

        if (technicalKeywords.some(keyword => phrase.includes(keyword))) {
            significance += 0.3;
        }

        // 動作短語提升重要性
        const actionKeywords = ['create', 'implement', 'analyze', 'optimize', 'deploy'];
        if (actionKeywords.some(keyword => phrase.includes(keyword))) {
            significance += 0.2;
        }

        return Math.min(significance, 1);
    }

    /**
     * 執行上下文分析
     * @private
     */
    async _performContextAnalysis(result, context) {
        // 項目上下文
        result.context.project = await this._analyzeProjectContext();

        // 會話上下文
        result.context.session = this._analyzeSessionContext();

        // 歷史上下文
        result.context.historical = this._analyzeHistoricalContext(result);

        // 環境上下文
        result.context.environmental = await this._analyzeEnvironmentalContext();

        // 用戶上下文
        result.context.user = this._analyzeUserContext(context);

        console.log('[ContextAnalyzer] 上下文分析完成');
    }

    /**
     * 分析項目上下文
     * @private
     */
    async _analyzeProjectContext() {
        if (!this.projectContext) {
            return null;
        }

        return {
            type: this.projectContext.type || 'unknown',
            technologies: this.projectContext.technologies || [],
            structure: this.projectContext.structure || {},
            config: this.projectContext.config || {},
            lastUpdate: this.projectContext.lastUpdate || null
        };
    }

    /**
     * 分析會話上下文
     * @private
     */
    _analyzeSessionContext() {
        const recentHistory = this.sessionHistory.slice(-this.options.sessionContextSize);

        if (recentHistory.length === 0) {
            return null;
        }

        // 分析最近的命令模式
        const recentCommands = recentHistory.map(h => h.commandType);
        const commandFreq = this._calculateFrequency(recentCommands);

        const recentIntents = recentHistory.map(h => h.intent);
        const intentFreq = this._calculateFrequency(recentIntents);

        return {
            recentCommands: recentHistory.slice(-5),
            dominantCommandType: this._getMostFrequent(commandFreq),
            dominantIntent: this._getMostFrequent(intentFreq),
            sessionLength: recentHistory.length,
            averageComplexity: recentHistory.reduce((sum, h) => sum + h.complexity.overall, 0) / recentHistory.length
        };
    }

    /**
     * 分析歷史上下文
     * @private
     */
    _analyzeHistoricalContext(result) {
        // 查找相似的歷史命令
        const similarCommands = this._findSimilarHistoricalCommands(result);

        // 查找相關模式
        const relatedPatterns = this._findRelatedPatterns(result);

        return {
            similarCommands: similarCommands.slice(0, 5),
            relatedPatterns: relatedPatterns.slice(0, 3),
            historicalSuccess: this._calculateHistoricalSuccessRate(result),
            commonFailures: this._identifyCommonFailures(result)
        };
    }

    /**
     * 分析環境上下文
     * @private
     */
    async _analyzeEnvironmentalContext() {
        try {
            const environment = {
                platform: process.platform,
                nodeVersion: process.version,
                workingDirectory: process.cwd(),
                timestamp: Date.now(),
                systemLoad: this._getSystemLoad()
            };

            return environment;
        } catch (error) {
            console.warn('[ContextAnalyzer] 環境上下文分析失敗:', error);
            return null;
        }
    }

    /**
     * 分析用戶上下文
     * @private
     */
    _analyzeUserContext(context) {
        return {
            sessionId: context.sessionId || 'unknown',
            userPreferences: context.preferences || {},
            expertise: context.expertise || 'unknown',
            previousInteractions: context.history || []
        };
    }

    /**
     * 執行模式識別
     * @private
     */
    async _performPatternRecognition(result) {
        const patterns = [];

        // 命令模式識別
        const commandPattern = this._recognizeCommandPattern(result);
        if (commandPattern) {
            patterns.push(commandPattern);
        }

        // 工作流程模式識別
        const workflowPattern = this._recognizeWorkflowPattern(result);
        if (workflowPattern) {
            patterns.push(workflowPattern);
        }

        // 複雜度模式識別
        const complexityPattern = this._recognizeComplexityPattern(result);
        if (complexityPattern) {
            patterns.push(complexityPattern);
        }

        result.patterns.identified = patterns;
        result.patterns.confidence = patterns.length > 0 ?
            patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0;

        // 生成推薦
        result.patterns.recommendations = this._generatePatternRecommendations(patterns);

        console.log(`[ContextAnalyzer] 模式識別完成 - 識別 ${patterns.length} 個模式`);
    }

    /**
     * 識別命令模式
     * @private
     */
    _recognizeCommandPattern(result) {
        // 檢查是否符合已知命令模式
        const knownPatterns = [
            {
                name: 'CRUD_OPERATION',
                criteria: { intents: ['create', 'analyze', 'modify', 'delete'] },
                confidence: result.intent && ['create', 'analyze', 'modify', 'delete'].includes(result.intent) ? 0.8 : 0
            },
            {
                name: 'DEVELOPMENT_CYCLE',
                criteria: { types: ['generation', 'testing', 'debugging', 'deployment'] },
                confidence: result.commandType && ['generation', 'testing', 'debugging', 'deployment'].includes(result.commandType) ? 0.7 : 0
            },
            {
                name: 'MAINTENANCE_TASK',
                criteria: { intents: ['fix', 'optimize'], complexity: { min: 0.3, max: 0.8 } },
                confidence: (result.intent === 'fix' || result.intent === 'optimize') &&
                          result.complexity.overall >= 0.3 && result.complexity.overall <= 0.8 ? 0.9 : 0
            }
        ];

        const matchedPattern = knownPatterns.find(p => p.confidence > 0.5);
        if (matchedPattern) {
            return {
                name: matchedPattern.name,
                type: 'COMMAND_PATTERN',
                confidence: matchedPattern.confidence,
                description: `命令符合 ${matchedPattern.name} 模式`
            };
        }

        return null;
    }

    /**
     * 識別工作流程模式
     * @private
     */
    _recognizeWorkflowPattern(result) {
        // 基於會話歷史識別工作流程
        const sessionContext = result.context.session;
        if (!sessionContext || sessionContext.recentCommands.length < 3) {
            return null;
        }

        const recentTypes = sessionContext.recentCommands.map(cmd => cmd.commandType);

        // 檢查開發工作流程
        if (this._isSequence(recentTypes, ['generation', 'testing', 'debugging'])) {
            return {
                name: 'DEVELOPMENT_WORKFLOW',
                type: 'WORKFLOW_PATTERN',
                confidence: 0.85,
                description: '符合開發工作流程模式：生成 → 測試 → 調試'
            };
        }

        // 檢查分析工作流程
        if (this._isSequence(recentTypes, ['analysis', 'optimization'])) {
            return {
                name: 'OPTIMIZATION_WORKFLOW',
                type: 'WORKFLOW_PATTERN',
                confidence: 0.8,
                description: '符合優化工作流程模式：分析 → 優化'
            };
        }

        return null;
    }

    /**
     * 識別複雜度模式
     * @private
     */
    _recognizeComplexityPattern(result) {
        const complexity = result.complexity.overall;

        if (complexity > 0.8) {
            return {
                name: 'HIGH_COMPLEXITY_TASK',
                type: 'COMPLEXITY_PATTERN',
                confidence: 0.9,
                description: '高複雜度任務，建議分解為子任務'
            };
        }

        if (complexity < 0.3) {
            return {
                name: 'SIMPLE_TASK',
                type: 'COMPLEXITY_PATTERN',
                confidence: 0.8,
                description: '簡單任務，可快速處理'
            };
        }

        return null;
    }

    /**
     * 檢查序列模式
     * @private
     */
    _isSequence(array, pattern) {
        if (array.length < pattern.length) return false;

        for (let i = 0; i <= array.length - pattern.length; i++) {
            let matches = true;
            for (let j = 0; j < pattern.length; j++) {
                if (array[i + j] !== pattern[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }

        return false;
    }

    /**
     * 生成模式推薦
     * @private
     */
    _generatePatternRecommendations(patterns) {
        const recommendations = [];

        for (const pattern of patterns) {
            switch (pattern.name) {
                case 'HIGH_COMPLEXITY_TASK':
                    recommendations.push({
                        type: 'DECOMPOSITION',
                        message: '建議將複雜任務分解為多個子任務',
                        priority: 'high'
                    });
                    break;

                case 'DEVELOPMENT_WORKFLOW':
                    recommendations.push({
                        type: 'AUTOMATION',
                        message: '考慮設置自動化測試流程',
                        priority: 'medium'
                    });
                    break;

                case 'MAINTENANCE_TASK':
                    recommendations.push({
                        type: 'MONITORING',
                        message: '建議設置持續監控以預防類似問題',
                        priority: 'medium'
                    });
                    break;
            }
        }

        return recommendations;
    }

    /**
     * 執行需求分析
     * @private
     */
    async _performRequirementsAnalysis(result) {
        const command = result.command;

        // 提取文件需求
        result.requirements.files = this._extractFileRequirements(command);

        // 提取技術需求
        result.requirements.technologies = this._extractTechnologyRequirements(command, result);

        // 提取動作需求
        result.requirements.actions = this._extractActionRequirements(command, result);

        // 提取依賴需求
        result.requirements.dependencies = this._extractDependencyRequirements(command, result);

        // 提取約束條件
        result.requirements.constraints = this._extractConstraints(command, result);

        console.log(`[ContextAnalyzer] 需求分析完成 - 文件: ${result.requirements.files.length}, 技術: ${result.requirements.technologies.length}`);
    }

    /**
     * 提取文件需求
     * @private
     */
    _extractFileRequirements(command) {
        const files = [];

        // 明確的文件路徑
        const fileMatches = command.match(/[\w-\.\/]+\.(js|ts|vue|py|json|md|yml|yaml|txt|html|css|scss|php|java|cpp|c|go|rs|rb|swift|kt|dart)/gi);
        if (fileMatches) {
            files.push(...fileMatches.map(file => ({ path: file, type: 'explicit' })));
        }

        // 文件類型推斷
        const typeInferences = [
            { patterns: /\b(component|vue|react)\b/gi, extensions: ['.vue', '.jsx', '.tsx'] },
            { patterns: /\b(script|js|javascript)\b/gi, extensions: ['.js', '.mjs'] },
            { patterns: /\b(style|css|sass|scss)\b/gi, extensions: ['.css', '.scss', '.sass'] },
            { patterns: /\b(config|configuration)\b/gi, extensions: ['.json', '.yaml', '.yml', '.config.js'] },
            { patterns: /\b(test|spec)\b/gi, extensions: ['.test.js', '.spec.js', '.test.ts'] }
        ];

        for (const { patterns, extensions } of typeInferences) {
            if (patterns.test(command)) {
                files.push(...extensions.map(ext => ({ path: `*${ext}`, type: 'inferred' })));
            }
        }

        return files;
    }

    /**
     * 提取技術需求
     * @private
     */
    _extractTechnologyRequirements(command, result) {
        const technologies = [];

        // 從實體中提取技術
        const techEntities = result.semantics.entities.filter(e => e.type === 'TECHNOLOGY');
        technologies.push(...techEntities.map(e => ({ name: e.value, source: 'entity' })));

        // 基於上下文推斷技術需求
        if (result.context.project && result.context.project.technologies) {
            technologies.push(...result.context.project.technologies.map(tech => ({ name: tech, source: 'project' })));
        }

        // 去重
        const uniqueTechnologies = [];
        const seen = new Set();
        for (const tech of technologies) {
            if (!seen.has(tech.name.toLowerCase())) {
                seen.add(tech.name.toLowerCase());
                uniqueTechnologies.push(tech);
            }
        }

        return uniqueTechnologies;
    }

    /**
     * 提取動作需求
     * @private
     */
    _extractActionRequirements(command, result) {
        const actions = [];

        // 基於意圖映射動作
        const intentActions = {
            create: ['generate', 'build', 'initialize'],
            analyze: ['scan', 'examine', 'evaluate'],
            modify: ['update', 'change', 'refactor'],
            fix: ['repair', 'debug', 'resolve'],
            optimize: ['improve', 'enhance', 'accelerate'],
            test: ['validate', 'verify', 'check'],
            deploy: ['publish', 'release', 'launch']
        };

        if (result.intent && intentActions[result.intent]) {
            actions.push(...intentActions[result.intent].map(action => ({ name: action, source: 'intent' })));
        }

        // 從命令直接提取動作
        const actionVerbs = command.match(/\b(create|generate|build|analyze|examine|update|modify|fix|debug|test|deploy|publish)\b/gi);
        if (actionVerbs) {
            actions.push(...actionVerbs.map(verb => ({ name: verb.toLowerCase(), source: 'explicit' })));
        }

        return actions;
    }

    /**
     * 提取依賴需求
     * @private
     */
    _extractDependencyRequirements(command, result) {
        const dependencies = [];

        // 基於技術需求推斷依賴
        for (const tech of result.requirements.technologies) {
            const techDeps = this._getTechnologyDependencies(tech.name);
            dependencies.push(...techDeps.map(dep => ({ name: dep, source: 'technology' })));
        }

        // 從關係中提取依賴
        for (const relation of result.semantics.relations) {
            if (relation.type === 'DEPENDENCY') {
                dependencies.push({ name: relation.target, source: 'relation' });
            }
        }

        return dependencies;
    }

    /**
     * 獲取技術依賴
     * @private
     */
    _getTechnologyDependencies(technology) {
        const dependencies = {
            vue: ['node', 'npm', 'webpack'],
            react: ['node', 'npm', 'babel'],
            angular: ['node', 'npm', 'typescript'],
            python: ['pip'],
            docker: ['container-runtime'],
            kubernetes: ['docker', 'container-orchestration']
        };

        return dependencies[technology.toLowerCase()] || [];
    }

    /**
     * 提取約束條件
     * @private
     */
    _extractConstraints(command, result) {
        const constraints = [];

        // 性能約束
        const performanceKeywords = ['fast', 'quick', 'slow', 'performance', 'efficient', 'optimize'];
        if (performanceKeywords.some(keyword => command.toLowerCase().includes(keyword))) {
            constraints.push({ type: 'performance', description: '性能相關約束' });
        }

        // 時間約束
        const timeKeywords = ['urgent', 'asap', 'deadline', 'quickly', 'immediately'];
        if (timeKeywords.some(keyword => command.toLowerCase().includes(keyword))) {
            constraints.push({ type: 'time', description: '時間緊迫約束' });
        }

        // 資源約束
        const resourceKeywords = ['memory', 'cpu', 'disk', 'bandwidth', 'cost', 'budget'];
        if (resourceKeywords.some(keyword => command.toLowerCase().includes(keyword))) {
            constraints.push({ type: 'resource', description: '資源限制約束' });
        }

        // 品質約束
        const qualityKeywords = ['quality', 'robust', 'reliable', 'stable', 'secure'];
        if (qualityKeywords.some(keyword => command.toLowerCase().includes(keyword))) {
            constraints.push({ type: 'quality', description: '品質要求約束' });
        }

        return constraints;
    }

    /**
     * 生成洞察
     * @private
     */
    async _generateInsights(result) {
        // 複雜度洞察
        if (result.complexity.overall > 0.8) {
            result.addInsight('complexity', '任務複雜度很高，建議分解為子任務', 0.9);
        } else if (result.complexity.overall < 0.2) {
            result.addInsight('complexity', '任務相對簡單，可以快速完成', 0.8);
        }

        // 意圖洞察
        if (result.intent === 'fix' && result.complexity.overall > 0.6) {
            result.addInsight('intent', '複雜的修復任務，建議先進行詳細分析', 0.8);
        }

        // 上下文洞察
        if (result.context.session && result.context.session.dominantIntent === result.intent) {
            result.addInsight('context', `與最近的會話模式一致 (${result.intent})`, 0.7);
        }

        // 模式洞察
        if (result.patterns.identified.length > 0) {
            const pattern = result.patterns.identified[0];
            result.addInsight('pattern', `識別到 ${pattern.name} 模式`, pattern.confidence);
        }

        // 需求洞察
        if (result.requirements.technologies.length > 3) {
            result.addInsight('requirements', '涉及多種技術棧，需要跨領域知識', 0.7);
        }
    }

    /**
     * 計算總體置信度
     * @private
     */
    _calculateOverallConfidence(result) {
        let confidence = 0.5; // 基礎置信度

        // 基於分析完整度
        const analysisCompleteness = [
            result.tokens.length > 0,
            result.commandType !== null,
            result.intent !== null,
            result.complexity.overall > 0,
            result.semantics.entities.length > 0
        ].filter(Boolean).length / 5;

        confidence += analysisCompleteness * 0.3;

        // 基於模式匹配
        if (result.patterns.identified.length > 0) {
            confidence += result.patterns.confidence * 0.2;
        }

        // 基於上下文豐富度
        const contextRichness = Object.values(result.context).filter(ctx => ctx !== null).length / 5;
        confidence += contextRichness * 0.2;

        return Math.min(confidence, 1);
    }

    /**
     * 計算頻率
     * @private
     */
    _calculateFrequency(array) {
        const freq = {};
        for (const item of array) {
            freq[item] = (freq[item] || 0) + 1;
        }
        return freq;
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
     * 查找相似歷史命令
     * @private
     */
    _findSimilarHistoricalCommands(result) {
        // 這裡應該實現基於相似度的歷史命令查找
        // 簡化實現：返回空數組
        return [];
    }

    /**
     * 查找相關模式
     * @private
     */
    _findRelatedPatterns(result) {
        // 這裡應該實現模式匹配邏輯
        // 簡化實現：返回空數組
        return [];
    }

    /**
     * 計算歷史成功率
     * @private
     */
    _calculateHistoricalSuccessRate(result) {
        // 這裡應該基於歷史數據計算成功率
        // 簡化實現：返回預設值
        return 0.8;
    }

    /**
     * 識別常見失敗
     * @private
     */
    _identifyCommonFailures(result) {
        // 這裡應該識別常見失敗模式
        // 簡化實現：返回空數組
        return [];
    }

    /**
     * 獲取系統負載
     * @private
     */
    _getSystemLoad() {
        // 簡化的系統負載計算
        return {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            timestamp: Date.now()
        };
    }

    /**
     * 更新會話歷史
     * @private
     */
    _updateSessionHistory(result) {
        this.sessionHistory.push({
            id: result.id,
            commandType: result.commandType,
            intent: result.intent,
            complexity: result.complexity,
            timestamp: result.timestamp
        });

        // 限制會話歷史大小
        if (this.sessionHistory.length > this.options.sessionContextSize) {
            this.sessionHistory = this.sessionHistory.slice(-this.options.sessionContextSize);
        }
    }

    /**
     * 生成快取鍵
     * @private
     */
    _generateCacheKey(command, context) {
        const keyParts = [
            command.trim(),
            JSON.stringify(context),
            Date.now().toString().slice(0, -5) // 5分鐘精度
        ];

        import crypto from 'crypto';
        return crypto.createHash('md5').update(keyParts.join('|')).digest('hex');
    }

    /**
     * 更新快取命中率
     * @private
     */
    _updateCacheHitRate(hit) {
        const total = this.stats.totalAnalyses || 1;
        const currentHits = this.stats.cacheHitRate * total;

        if (hit) {
            this.stats.cacheHitRate = (currentHits + 1) / (total + 1);
        } else {
            this.stats.cacheHitRate = currentHits / (total + 1);
        }
    }

    /**
     * 更新統計信息
     * @private
     */
    _updateStats(result, success) {
        this.stats.totalAnalyses++;

        if (success) {
            this.stats.successfulAnalyses++;
        } else {
            this.stats.failedAnalyses++;
        }

        // 更新平均分析時間
        this.stats.averageAnalysisTime = (
            (this.stats.averageAnalysisTime * (this.stats.totalAnalyses - 1) + result.analysisTime) /
            this.stats.totalAnalyses
        );

        // 更新模式匹配率
        if (result.patterns && result.patterns.identified.length > 0) {
            this.stats.patternMatchRate = (
                (this.stats.patternMatchRate * (this.stats.totalAnalyses - 1) + 1) /
                this.stats.totalAnalyses
            );
        }
    }

    /**
     * 初始化NLP組件
     * @private
     */
    async _initializeNLPComponents() {
        // 這裡可以初始化更高級的NLP組件
        console.log('[ContextAnalyzer] NLP組件初始化完成');
    }

    /**
     * 載入項目上下文
     * @private
     */
    async _loadProjectContext() {
        try {
            const contextPath = path.join(process.cwd(), this.options.projectContextPath);

            // 嘗試讀取項目配置
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            try {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                this.projectContext = {
                    type: 'nodejs',
                    technologies: Object.keys({
                        ...packageJson.dependencies,
                        ...packageJson.devDependencies
                    }),
                    config: {
                        name: packageJson.name,
                        version: packageJson.version,
                        scripts: packageJson.scripts
                    },
                    lastUpdate: new Date().toISOString()
                };
            } catch (error) {
                // 如果沒有package.json，設置基本項目上下文
                this.projectContext = {
                    type: 'general',
                    technologies: [],
                    config: {},
                    lastUpdate: new Date().toISOString()
                };
            }

            console.log('[ContextAnalyzer] 項目上下文載入完成');

        } catch (error) {
            console.warn('[ContextAnalyzer] 載入項目上下文失敗:', error);
            this.projectContext = null;
        }
    }

    /**
     * 載入歷史模式
     * @private
     */
    async _loadHistoricalPatterns() {
        try {
            // 這裡可以從持久存儲載入歷史模式
            console.log('[ContextAnalyzer] 歷史模式載入完成');
        } catch (error) {
            console.warn('[ContextAnalyzer] 載入歷史模式失敗:', error);
        }
    }

    /**
     * 設置快取清理
     * @private
     */
    _setupCacheCleanup() {
        // 每小時清理過期快取
        setInterval(() => {
            const now = Date.now();
            const expired = [];

            for (const [key, value] of this.analysisCache.entries()) {
                if (now - value.timestamp > this.options.cacheTTL) {
                    expired.push(key);
                }
            }

            for (const key of expired) {
                this.analysisCache.delete(key);
            }

            if (expired.length > 0) {
                console.log(`[ContextAnalyzer] 清理 ${expired.length} 個過期快取項目`);
            }
        }, 3600000); // 1小時
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            // 清理快取
            this.analysisCache.clear();
            this.contextCache.clear();

            // 清理歷史
            this.sessionHistory.length = 0;
            this.historicalPatterns.clear();

            // 移除事件監聽器
            this.removeAllListeners();

            console.log('[ContextAnalyzer] 資源清理完成');

        } catch (error) {
            console.error('[ContextAnalyzer] 資源清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
ContextAnalyzer.ANALYSIS_STATUS = ANALYSIS_STATUS;
ContextAnalyzer.CONTEXT_TYPES = CONTEXT_TYPES;
ContextAnalyzer.INTENT_CATEGORIES = INTENT_CATEGORIES;
ContextAnalyzer.COMPLEXITY_INDICATORS = COMPLEXITY_INDICATORS;

export default ContextAnalyzer;