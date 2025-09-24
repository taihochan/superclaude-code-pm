/**
 * CommandCompletion - 智能命令自動補全系統
 *
 * 功能：
 * - 實時命令自動補全和智能提示
 * - 基於上下文的智能建議
 * - 參數類型檢查和自動完成
 * - 支援模糊匹配和語義搜索
 * - 學習用戶習慣的個性化補全
 *
 * 用途：提升整合命令接口的用戶體驗
 * 配合：與IntegratedCommandInterface緊密整合
 */

import EventEmitter from 'eventemitter3';

// 補全類型
export const COMPLETION_TYPE = {
    COMMAND: 'command',
    PARAMETER: 'parameter',
    VALUE: 'value',
    FLAG: 'flag',
    SUGGESTION: 'suggestion'
};

// 匹配策略
export const MATCH_STRATEGY = {
    PREFIX: 'prefix',           // 前綴匹配
    FUZZY: 'fuzzy',            // 模糊匹配
    SEMANTIC: 'semantic',       // 語義匹配
    SUBSTRING: 'substring',     // 子字符串匹配
    PHONETIC: 'phonetic'       // 語音相似匹配
};

// 建議優先級
export const SUGGESTION_PRIORITY = {
    EXACT: 100,
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40,
    MINIMAL: 20
};

/**
 * 補全建議項目
 */
class CompletionItem {
    constructor(text, type, options = {}) {
        this.text = text;
        this.type = type;
        this.label = options.label || text;
        this.description = options.description || '';
        this.detail = options.detail || '';
        this.priority = options.priority || SUGGESTION_PRIORITY.MEDIUM;
        this.insertText = options.insertText || text;
        this.filterText = options.filterText || text;
        this.sortText = options.sortText || text;
        this.documentation = options.documentation || '';
        this.example = options.example || '';

        // 額外屬性
        this.category = options.category || 'general';
        this.tags = options.tags || [];
        this.deprecated = options.deprecated || false;
        this.experimental = options.experimental || false;

        // 使用統計
        this.usageCount = 0;
        this.lastUsed = null;
        this.userRating = 0;
    }

    /**
     * 更新使用統計
     */
    updateUsage() {
        this.usageCount++;
        this.lastUsed = Date.now();
    }

    /**
     * 計算匹配分數
     * @param {string} query - 查詢字符串
     * @param {string} strategy - 匹配策略
     * @returns {number} 匹配分數 (0-1)
     */
    calculateScore(query, strategy = MATCH_STRATEGY.PREFIX) {
        if (!query) return this.priority / 100;

        const text = this.filterText.toLowerCase();
        const q = query.toLowerCase();

        let score = 0;

        switch (strategy) {
            case MATCH_STRATEGY.PREFIX:
                score = text.startsWith(q) ? 1 : 0;
                break;

            case MATCH_STRATEGY.SUBSTRING:
                score = text.includes(q) ? 0.8 : 0;
                break;

            case MATCH_STRATEGY.FUZZY:
                score = this._calculateFuzzyScore(text, q);
                break;

            case MATCH_STRATEGY.SEMANTIC:
                score = this._calculateSemanticScore(text, q);
                break;

            case MATCH_STRATEGY.PHONETIC:
                score = this._calculatePhoneticScore(text, q);
                break;

            default:
                score = text.startsWith(q) ? 1 : (text.includes(q) ? 0.5 : 0);
        }

        // 結合優先級和使用頻率
        const priorityWeight = this.priority / 100 * 0.3;
        const usageWeight = Math.min(this.usageCount / 100, 1) * 0.2;
        const recentlyUsedWeight = this.lastUsed &&
            (Date.now() - this.lastUsed < 24 * 60 * 60 * 1000) ? 0.1 : 0;

        return (score * 0.4) + priorityWeight + usageWeight + recentlyUsedWeight;
    }

    /**
     * 計算模糊匹配分數
     * @private
     */
    _calculateFuzzyScore(text, query) {
        if (text === query) return 1;
        if (text.startsWith(query)) return 0.9;

        let score = 0;
        let queryIndex = 0;

        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                score += 1 / text.length;
                queryIndex++;
            }
        }

        return queryIndex === query.length ? score : 0;
    }

    /**
     * 計算語義匹配分數
     * @private
     */
    _calculateSemanticScore(text, query) {
        // 簡化的語義匹配 - 基於關鍵詞
        const textWords = text.split(/[\s-_]/);
        const queryWords = query.split(/[\s-_]/);

        let matches = 0;
        for (const qWord of queryWords) {
            if (textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))) {
                matches++;
            }
        }

        return matches / queryWords.length;
    }

    /**
     * 計算語音相似匹配分數
     * @private
     */
    _calculatePhoneticScore(text, query) {
        // 簡化的語音匹配 - 基於編輯距離
        return 1 - this._calculateEditDistance(text, query) / Math.max(text.length, query.length);
    }

    /**
     * 計算編輯距離
     * @private
     */
    _calculateEditDistance(a, b) {
        const matrix = Array(a.length + 1).fill(null).map(() =>
            Array(b.length + 1).fill(0)
        );

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    }
}

/**
 * 命令上下文分析器
 */
class ContextAnalyzer {
    constructor() {
        this.patterns = new Map();
        this._initializePatterns();
    }

    /**
     * 分析輸入上下文
     * @param {string} input - 用戶輸入
     * @returns {Object} 上下文分析結果
     */
    analyze(input) {
        const trimmed = input.trim();

        return {
            input: trimmed,
            cursorPosition: input.length,
            isCommand: trimmed.startsWith('/integrated:'),
            commandPrefix: this._extractCommandPrefix(trimmed),
            currentToken: this._getCurrentToken(trimmed),
            previousTokens: this._getPreviousTokens(trimmed),
            expectingParameter: this._isExpectingParameter(trimmed),
            expectingValue: this._isExpectingValue(trimmed),
            context: this._inferContext(trimmed),
            stage: this._determineCompletionStage(trimmed)
        };
    }

    /**
     * 提取命令前綴
     * @private
     */
    _extractCommandPrefix(input) {
        if (!input.startsWith('/integrated:')) return '';

        const parts = input.substring(12).split(/\s+/);
        return parts[0] || '';
    }

    /**
     * 獲取當前令牌
     * @private
     */
    _getCurrentToken(input) {
        const parts = input.split(/\s+/);
        const lastPart = parts[parts.length - 1];

        if (input.endsWith(' ')) return '';
        return lastPart || '';
    }

    /**
     * 獲取前面的令牌
     * @private
     */
    _getPreviousTokens(input) {
        const parts = input.trim().split(/\s+/);
        return parts.slice(0, -1);
    }

    /**
     * 是否期待參數
     * @private
     */
    _isExpectingParameter(input) {
        const lastToken = this._getCurrentToken(input);
        return input.endsWith(' ') && !lastToken.startsWith('-');
    }

    /**
     * 是否期待值
     * @private
     */
    _isExpectingValue(input) {
        const previousTokens = this._getPreviousTokens(input);
        const lastToken = previousTokens[previousTokens.length - 1];
        return lastToken && lastToken.startsWith('--');
    }

    /**
     * 推斷上下文
     * @private
     */
    _inferContext(input) {
        if (input.includes('status')) return 'status';
        if (input.includes('analyze')) return 'analysis';
        if (input.includes('workflow')) return 'workflow';
        if (input.includes('help')) return 'help';
        return 'general';
    }

    /**
     * 確定補全階段
     * @private
     */
    _determineCompletionStage(input) {
        if (!input.startsWith('/integrated:')) return 'prefix';

        const withoutPrefix = input.substring(12);
        const parts = withoutPrefix.split(/\s+/);

        if (parts.length === 1 && !withoutPrefix.includes(' ')) {
            return 'command';
        } else if (withoutPrefix.endsWith(' ') || parts.length > 1) {
            return 'parameters';
        }

        return 'command';
    }

    /**
     * 初始化模式
     * @private
     */
    _initializePatterns() {
        this.patterns.set('command_start', /^\/integrated:/);
        this.patterns.set('parameter_flag', /--[a-zA-Z][a-zA-Z0-9-]*$/);
        this.patterns.set('short_flag', /-[a-zA-Z]$/);
        this.patterns.set('value_expected', /--[a-zA-Z][a-zA-Z0-9-]*\s+$/);
    }
}

/**
 * 智能建議生成器
 */
class SuggestionGenerator {
    constructor(commandRegistry) {
        this.commandRegistry = commandRegistry;
        this.contextPatterns = new Map();
        this.valueProviders = new Map();
        this._initializeValueProviders();
    }

    /**
     * 生成命令建議
     * @param {Object} context - 上下文分析結果
     * @returns {Array<CompletionItem>} 建議列表
     */
    generateSuggestions(context) {
        const suggestions = [];

        switch (context.stage) {
            case 'prefix':
                suggestions.push(...this._generatePrefixSuggestions(context));
                break;
            case 'command':
                suggestions.push(...this._generateCommandSuggestions(context));
                break;
            case 'parameters':
                suggestions.push(...this._generateParameterSuggestions(context));
                break;
        }

        return this._rankAndFilterSuggestions(suggestions, context);
    }

    /**
     * 生成前綴建議
     * @private
     */
    _generatePrefixSuggestions(context) {
        return [
            new CompletionItem('/integrated:', COMPLETION_TYPE.COMMAND, {
                label: '/integrated:',
                description: '整合命令前綴',
                priority: SUGGESTION_PRIORITY.EXACT,
                insertText: '/integrated:',
                documentation: 'CCPM+SuperClaude整合命令系統的命令前綴'
            })
        ];
    }

    /**
     * 生成命令建議
     * @private
     */
    _generateCommandSuggestions(context) {
        const suggestions = [];
        const query = context.commandPrefix.toLowerCase();

        for (const [commandName, commandDef] of this.commandRegistry) {
            if (!query || commandName.toLowerCase().includes(query)) {
                suggestions.push(new CompletionItem(
                    commandName,
                    COMPLETION_TYPE.COMMAND,
                    {
                        label: commandName,
                        description: commandDef.description,
                        detail: `類別: ${commandDef.category}`,
                        priority: this._getCommandPriority(commandName),
                        insertText: commandName,
                        documentation: this._buildCommandDocumentation(commandDef),
                        example: commandDef.examples?.[0] || '',
                        category: commandDef.category,
                        tags: [commandDef.type, commandDef.category]
                    }
                ));
            }
        }

        return suggestions;
    }

    /**
     * 生成參數建議
     * @private
     */
    _generateParameterSuggestions(context) {
        const suggestions = [];
        const commandName = context.commandPrefix;
        const commandDef = this.commandRegistry.get(commandName);

        if (!commandDef) return suggestions;

        const currentToken = context.currentToken.toLowerCase();

        // 生成參數建議
        if (commandDef.parameters) {
            for (const param of commandDef.parameters) {
                const paramName = `--${param.name}`;
                if (!currentToken || paramName.toLowerCase().includes(currentToken)) {
                    suggestions.push(new CompletionItem(
                        paramName,
                        COMPLETION_TYPE.PARAMETER,
                        {
                            label: paramName,
                            description: param.description,
                            detail: `類型: ${param.type || 'string'}${param.required ? ' (必需)' : ''}`,
                            priority: param.required ? SUGGESTION_PRIORITY.HIGH : SUGGESTION_PRIORITY.MEDIUM,
                            insertText: `${paramName} `,
                            documentation: this._buildParameterDocumentation(param)
                        }
                    ));
                }
            }
        }

        // 生成標誌建議
        if (commandDef.flags) {
            for (const flag of commandDef.flags) {
                const flagName = `--${flag.name}`;
                if (!currentToken || flagName.toLowerCase().includes(currentToken)) {
                    suggestions.push(new CompletionItem(
                        flagName,
                        COMPLETION_TYPE.FLAG,
                        {
                            label: flagName,
                            description: flag.description,
                            priority: SUGGESTION_PRIORITY.MEDIUM,
                            insertText: `${flagName} `,
                            documentation: flag.description
                        }
                    ));
                }
            }
        }

        // 生成值建議
        if (context.expectingValue) {
            const paramName = context.previousTokens[context.previousTokens.length - 1]?.substring(2);
            const param = commandDef.parameters?.find(p => p.name === paramName);

            if (param) {
                suggestions.push(...this._generateValueSuggestions(param, currentToken));
            }
        }

        return suggestions;
    }

    /**
     * 生成值建議
     * @private
     */
    _generateValueSuggestions(parameter, query) {
        const suggestions = [];
        const provider = this.valueProviders.get(parameter.type);

        if (provider) {
            const values = provider(parameter, query);
            for (const value of values) {
                suggestions.push(new CompletionItem(
                    value.value,
                    COMPLETION_TYPE.VALUE,
                    {
                        label: value.label || value.value,
                        description: value.description || '',
                        priority: value.priority || SUGGESTION_PRIORITY.MEDIUM,
                        insertText: value.insertText || value.value
                    }
                ));
            }
        }

        // 添加枚舉值
        if (parameter.enum) {
            for (const enumValue of parameter.enum) {
                if (!query || enumValue.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.push(new CompletionItem(
                        enumValue,
                        COMPLETION_TYPE.VALUE,
                        {
                            label: enumValue,
                            description: `有效的${parameter.name}值`,
                            priority: SUGGESTION_PRIORITY.HIGH,
                            insertText: enumValue
                        }
                    ));
                }
            }
        }

        return suggestions;
    }

    /**
     * 排序和過濾建議
     * @private
     */
    _rankAndFilterSuggestions(suggestions, context) {
        const query = context.currentToken;
        const strategy = this._selectMatchStrategy(context);

        // 計算分數並排序
        const scored = suggestions.map(item => ({
            item,
            score: item.calculateScore(query, strategy)
        })).filter(s => s.score > 0);

        scored.sort((a, b) => {
            if (Math.abs(a.score - b.score) < 0.01) {
                // 分數相近時按優先級排序
                return b.item.priority - a.item.priority;
            }
            return b.score - a.score;
        });

        return scored.map(s => s.item).slice(0, 50); // 限制結果數量
    }

    /**
     * 選擇匹配策略
     * @private
     */
    _selectMatchStrategy(context) {
        if (context.currentToken.length <= 2) {
            return MATCH_STRATEGY.PREFIX;
        } else if (context.currentToken.length <= 5) {
            return MATCH_STRATEGY.SUBSTRING;
        } else {
            return MATCH_STRATEGY.FUZZY;
        }
    }

    /**
     * 獲取命令優先級
     * @private
     */
    _getCommandPriority(commandName) {
        const highPriorityCommands = ['status', 'help', 'config'];
        const mediumPriorityCommands = ['analyze', 'workflow', 'monitor'];

        if (highPriorityCommands.includes(commandName)) {
            return SUGGESTION_PRIORITY.HIGH;
        } else if (mediumPriorityCommands.includes(commandName)) {
            return SUGGESTION_PRIORITY.MEDIUM;
        } else {
            return SUGGESTION_PRIORITY.LOW;
        }
    }

    /**
     * 構建命令文檔
     * @private
     */
    _buildCommandDocumentation(commandDef) {
        let doc = `**${commandDef.description}**\n\n`;

        if (commandDef.parameters?.length) {
            doc += '**參數:**\n';
            commandDef.parameters.forEach(param => {
                doc += `- \`--${param.name}\`: ${param.description}\n`;
            });
            doc += '\n';
        }

        if (commandDef.flags?.length) {
            doc += '**標誌:**\n';
            commandDef.flags.forEach(flag => {
                doc += `- \`--${flag.name}\`: ${flag.description}\n`;
            });
            doc += '\n';
        }

        if (commandDef.examples?.length) {
            doc += '**示例:**\n';
            commandDef.examples.forEach(example => {
                doc += `\`${example}\`\n`;
            });
        }

        return doc;
    }

    /**
     * 構建參數文檔
     * @private
     */
    _buildParameterDocumentation(parameter) {
        let doc = parameter.description;

        if (parameter.type) {
            doc += `\n\n**類型:** ${parameter.type}`;
        }

        if (parameter.required) {
            doc += '\n\n**必需參數**';
        }

        if (parameter.default !== undefined) {
            doc += `\n\n**預設值:** ${parameter.default}`;
        }

        if (parameter.enum) {
            doc += `\n\n**可用值:** ${parameter.enum.join(', ')}`;
        }

        return doc;
    }

    /**
     * 初始化值提供者
     * @private
     */
    _initializeValueProviders() {
        // 布爾值提供者
        this.valueProviders.set('boolean', () => [
            { value: 'true', label: 'true', description: '真值' },
            { value: 'false', label: 'false', description: '假值' }
        ]);

        // 數字範圍提供者
        this.valueProviders.set('number', (param, query) => {
            const suggestions = [];

            if (param.min !== undefined && param.max !== undefined) {
                // 提供範圍內的常用值
                const range = param.max - param.min;
                const step = Math.max(1, Math.floor(range / 10));

                for (let i = param.min; i <= param.max; i += step) {
                    suggestions.push({
                        value: i.toString(),
                        label: i.toString(),
                        description: `範圍: ${param.min} - ${param.max}`
                    });
                }
            }

            return suggestions;
        });

        // 組件名稱提供者
        this.valueProviders.set('component', () => [
            { value: 'commandRouter', label: 'commandRouter', description: '命令路由器' },
            { value: 'smartRouter', label: 'smartRouter', description: '智能路由器' },
            { value: 'parallelExecutor', label: 'parallelExecutor', description: '並行執行器' },
            { value: 'eventBus', label: 'eventBus', description: '事件總線' },
            { value: 'stateSynchronizer', label: 'stateSynchronizer', description: '狀態同步器' }
        ]);

        // 類別提供者
        this.valueProviders.set('category', () => [
            { value: 'system', label: 'system', description: '系統類別' },
            { value: 'analysis', label: 'analysis', description: '分析類別' },
            { value: 'workflow', label: 'workflow', description: '工作流類別' },
            { value: 'help', label: 'help', description: '幫助類別' },
            { value: 'monitoring', label: 'monitoring', description: '監控類別' }
        ]);
    }
}

/**
 * 命令自動補全系統主類
 */
export class CommandCompletion extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            maxSuggestions: 50,
            minQueryLength: 0,
            enableFuzzyMatching: true,
            enableSemanticSearch: false,
            enableLearning: true,
            debounceDelay: 100,
            cacheTimeout: 5000,
            ...options
        };

        // 核心組件
        this.commandRegistry = options.commandRegistry || new Map();
        this.contextAnalyzer = new ContextAnalyzer();
        this.suggestionGenerator = new SuggestionGenerator(this.commandRegistry);

        // 緩存和學習
        this.suggestionCache = new Map();
        this.usageStats = new Map();
        this.learningData = new Map();

        // 節流器
        this.debounceTimer = null;

        // 初始化狀態
        this.initialized = false;
    }

    /**
     * 初始化命令補全系統
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[CommandCompletion] 初始化命令補全系統...');

            // 載入學習數據
            await this._loadLearningData();

            // 預熱緩存
            if (this.options.enablePrewarming) {
                await this._prewarmCache();
            }

            this.initialized = true;
            console.log('[CommandCompletion] 命令補全系統初始化完成');
            this.emit('initialized');

        } catch (error) {
            console.error('[CommandCompletion] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取命令補全建議
     * @param {string} input - 用戶輸入
     * @param {Object} options - 選項
     * @returns {Promise<Array<CompletionItem>>} 補全建議列表
     */
    async getCompletions(input, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        // 清除之前的節流器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        return new Promise((resolve) => {
            this.debounceTimer = setTimeout(async () => {
                try {
                    const result = await this._performCompletion(input, options);
                    resolve(result);
                } catch (error) {
                    console.error('[CommandCompletion] 補全失敗:', error);
                    resolve([]);
                }
            }, this.options.debounceDelay);
        });
    }

    /**
     * 記錄用戶選擇
     * @param {CompletionItem} item - 選擇的項目
     * @param {string} originalInput - 原始輸入
     */
    recordSelection(item, originalInput) {
        if (!this.options.enableLearning) return;

        try {
            // 更新項目使用統計
            item.updateUsage();

            // 記錄全局使用統計
            const key = `${item.type}:${item.text}`;
            const stats = this.usageStats.get(key) || { count: 0, lastUsed: null };
            stats.count++;
            stats.lastUsed = Date.now();
            this.usageStats.set(key, stats);

            // 記錄學習數據
            this.learningData.set(originalInput.trim(), {
                selectedItem: item,
                timestamp: Date.now(),
                context: this.contextAnalyzer.analyze(originalInput)
            });

            // 發送選擇事件
            this.emit('itemSelected', { item, originalInput, timestamp: Date.now() });

            // 定期保存學習數據
            this._scheduleLearningDataSave();

        } catch (error) {
            console.error('[CommandCompletion] 記錄選擇失敗:', error);
        }
    }

    /**
     * 更新命令註冊表
     * @param {Map} commandRegistry - 新的命令註冊表
     */
    updateCommandRegistry(commandRegistry) {
        this.commandRegistry = commandRegistry;
        this.suggestionGenerator = new SuggestionGenerator(commandRegistry);

        // 清空緩存
        this.suggestionCache.clear();

        console.log('[CommandCompletion] 命令註冊表已更新');
        this.emit('commandRegistryUpdated', { size: commandRegistry.size });
    }

    /**
     * 獲取補全統計信息
     * @returns {Object} 統計信息
     */
    getStatistics() {
        return {
            totalQueries: this.suggestionCache.size,
            totalSelections: Array.from(this.usageStats.values())
                .reduce((sum, stats) => sum + stats.count, 0),
            mostUsedItems: this._getMostUsedItems(10),
            recentSelections: this._getRecentSelections(10),
            cacheHitRate: this._calculateCacheHitRate(),
            averageResponseTime: this._getAverageResponseTime()
        };
    }

    /**
     * 清理過期數據
     */
    cleanup() {
        const now = Date.now();
        const expiredThreshold = now - this.options.cacheTimeout;

        // 清理過期緩存
        for (const [key, entry] of this.suggestionCache.entries()) {
            if (entry.timestamp < expiredThreshold) {
                this.suggestionCache.delete(key);
            }
        }

        // 清理過期學習數據
        const learningExpiredThreshold = now - (30 * 24 * 60 * 60 * 1000); // 30天
        for (const [key, entry] of this.learningData.entries()) {
            if (entry.timestamp < learningExpiredThreshold) {
                this.learningData.delete(key);
            }
        }

        console.log('[CommandCompletion] 清理完成');
    }

    // ========== 私有方法 ==========

    /**
     * 執行補全
     * @private
     */
    async _performCompletion(input, options) {
        const startTime = Date.now();

        // 檢查緩存
        const cacheKey = this._generateCacheKey(input, options);
        const cached = this.suggestionCache.get(cacheKey);

        if (cached && (startTime - cached.timestamp) < this.options.cacheTimeout) {
            return cached.suggestions;
        }

        // 分析上下文
        const context = this.contextAnalyzer.analyze(input);

        // 生成建議
        const suggestions = this.suggestionGenerator.generateSuggestions(context);

        // 應用個性化學習
        if (this.options.enableLearning) {
            this._applyPersonalization(suggestions, context);
        }

        // 限制數量
        const limitedSuggestions = suggestions.slice(0, this.options.maxSuggestions);

        // 存入緩存
        this.suggestionCache.set(cacheKey, {
            suggestions: limitedSuggestions,
            timestamp: startTime
        });

        // 記錄性能
        this._recordPerformance(startTime);

        // 發送完成事件
        this.emit('completionGenerated', {
            input,
            suggestionsCount: limitedSuggestions.length,
            responseTime: Date.now() - startTime
        });

        return limitedSuggestions;
    }

    /**
     * 應用個性化學習
     * @private
     */
    _applyPersonalization(suggestions, context) {
        // 基於歷史選擇調整優先級
        for (const suggestion of suggestions) {
            const key = `${suggestion.type}:${suggestion.text}`;
            const stats = this.usageStats.get(key);

            if (stats) {
                // 根據使用頻率調整優先級
                const usageBoost = Math.min(stats.count * 5, 50);
                suggestion.priority += usageBoost;

                // 最近使用的項目獲得額外加權
                const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天
                if (stats.lastUsed && stats.lastUsed > recentThreshold) {
                    suggestion.priority += 20;
                }
            }
        }

        // 基於相似上下文的學習
        for (const [learnedInput, learnedData] of this.learningData.entries()) {
            if (this._isContextSimilar(context, learnedData.context)) {
                const matchedSuggestion = suggestions.find(s =>
                    s.text === learnedData.selectedItem.text
                );
                if (matchedSuggestion) {
                    matchedSuggestion.priority += 30;
                }
            }
        }
    }

    /**
     * 判斷上下文相似性
     * @private
     */
    _isContextSimilar(context1, context2) {
        if (!context1 || !context2) return false;

        return context1.stage === context2.stage &&
               context1.context === context2.context &&
               context1.commandPrefix === context2.commandPrefix;
    }

    /**
     * 生成緩存鍵
     * @private
     */
    _generateCacheKey(input, options) {
        const normalizedInput = input.trim().toLowerCase();
        const optionsHash = JSON.stringify(options);
        return `${normalizedInput}:${optionsHash}`;
    }

    /**
     * 載入學習數據
     * @private
     */
    async _loadLearningData() {
        try {
            // 從持久存儲載入學習數據
            // 這裡可以接入實際的存儲系統
            console.log('[CommandCompletion] 學習數據載入完成');
        } catch (error) {
            console.warn('[CommandCompletion] 載入學習數據失敗:', error);
        }
    }

    /**
     * 預熱緩存
     * @private
     */
    async _prewarmCache() {
        const commonInputs = [
            '/integrated:',
            '/integrated:status',
            '/integrated:help',
            '/integrated:analyze',
            '/integrated:workflow'
        ];

        for (const input of commonInputs) {
            await this._performCompletion(input, {});
        }

        console.log('[CommandCompletion] 緩存預熱完成');
    }

    /**
     * 獲取最常用項目
     * @private
     */
    _getMostUsedItems(limit) {
        return Array.from(this.usageStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .map(([key, stats]) => ({ key, ...stats }));
    }

    /**
     * 獲取最近選擇
     * @private
     */
    _getRecentSelections(limit) {
        return Array.from(this.learningData.entries())
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .slice(0, limit)
            .map(([input, data]) => ({ input, ...data }));
    }

    /**
     * 計算緩存命中率
     * @private
     */
    _calculateCacheHitRate() {
        // 簡化實現，實際應該追蹤命中和未命中次數
        return 0.85;
    }

    /**
     * 獲取平均響應時間
     * @private
     */
    _getAverageResponseTime() {
        // 簡化實現，實際應該維護響應時間統計
        return 25; // ms
    }

    /**
     * 記錄性能
     * @private
     */
    _recordPerformance(startTime) {
        const responseTime = Date.now() - startTime;

        // 發送性能事件
        this.emit('performance', {
            responseTime,
            timestamp: Date.now()
        });
    }

    /**
     * 安排學習數據保存
     * @private
     */
    _scheduleLearningDataSave() {
        if (this.saveTimeout) return;

        this.saveTimeout = setTimeout(async () => {
            try {
                await this._saveLearningData();
            } catch (error) {
                console.error('[CommandCompletion] 保存學習數據失敗:', error);
            } finally {
                this.saveTimeout = null;
            }
        }, 30000); // 30秒後保存
    }

    /**
     * 保存學習數據
     * @private
     */
    async _saveLearningData() {
        // 實現持久存儲邏輯
        console.log('[CommandCompletion] 學習數據已保存');
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            // 清除定時器
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }

            // 保存學習數據
            await this._saveLearningData();

            // 清理緩存
            this.suggestionCache.clear();
            this.usageStats.clear();
            this.learningData.clear();

            this.removeAllListeners();
            console.log('[CommandCompletion] 資源清理完成');

        } catch (error) {
            console.error('[CommandCompletion] 資源清理失敗:', error);
            throw error;
        }
    }
}

export default CommandCompletion;