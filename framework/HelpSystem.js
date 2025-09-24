/**
 * HelpSystem - 智能幫助文檔系統
 *
 * 功能：
 * - 完整的命令幫助文檔和使用指南
 * - 互動式幫助和智能問答
 * - 多語言支持和本地化
 * - 示例代碼和最佳實踐展示
 * - 搜索和導航功能
 *
 * 用途：提供完整的用戶支持和學習資源
 * 配合：與IntegratedCommandInterface和所有子系統整合
 */

import EventEmitter from 'eventemitter3';

// 幫助內容類型
export const HELP_CONTENT_TYPE = {
    OVERVIEW: 'overview',               // 系統概覽
    COMMAND: 'command',                 // 命令幫助
    TUTORIAL: 'tutorial',               // 教程指南
    EXAMPLE: 'example',                 // 示例代碼
    FAQ: 'faq',                         // 常見問題
    TROUBLESHOOTING: 'troubleshooting', // 故障排除
    REFERENCE: 'reference',             // 參考手冊
    CHANGELOG: 'changelog'              // 更新日誌
};

// 幫助級別
export const HELP_LEVEL = {
    BEGINNER: 'beginner',               // 初學者
    INTERMEDIATE: 'intermediate',       // 中級用戶
    ADVANCED: 'advanced',               // 高級用戶
    EXPERT: 'expert'                    // 專家級
};

// 顯示格式
export const DISPLAY_FORMAT = {
    TEXT: 'text',                       // 純文本
    MARKDOWN: 'markdown',               // Markdown格式
    HTML: 'html',                       // HTML格式
    INTERACTIVE: 'interactive',         // 互動式
    JSON: 'json'                        // JSON格式
};

/**
 * 幫助內容項目
 */
class HelpContent {
    constructor(id, type, options = {}) {
        this.id = id;
        this.type = type;
        this.title = options.title || id;
        this.summary = options.summary || '';
        this.content = options.content || '';
        this.level = options.level || HELP_LEVEL.BEGINNER;
        this.category = options.category || 'general';
        this.tags = options.tags || [];
        this.lastUpdated = options.lastUpdated || Date.now();
        this.version = options.version || '1.0.0';

        // 結構化內容
        this.sections = options.sections || [];
        this.examples = options.examples || [];
        this.relatedTopics = options.relatedTopics || [];
        this.prerequisites = options.prerequisites || [];

        // 多語言支持
        this.language = options.language || 'zh-TW';
        this.translations = options.translations || {};

        // 互動元素
        this.interactive = options.interactive || false;
        this.searchable = options.searchable !== false;

        // 統計信息
        this.viewCount = 0;
        this.rating = 0;
        this.feedback = [];
    }

    /**
     * 渲染內容
     * @param {string} format - 顯示格式
     * @param {Object} options - 渲染選項
     * @returns {string} 渲染後的內容
     */
    render(format = DISPLAY_FORMAT.TEXT, options = {}) {
        const {
            includeExamples = true,
            includeRelated = true,
            maxWidth = 80,
            theme = 'default'
        } = options;

        switch (format) {
            case DISPLAY_FORMAT.TEXT:
                return this._renderText(includeExamples, includeRelated, maxWidth);

            case DISPLAY_FORMAT.MARKDOWN:
                return this._renderMarkdown(includeExamples, includeRelated);

            case DISPLAY_FORMAT.HTML:
                return this._renderHTML(includeExamples, includeRelated, theme);

            case DISPLAY_FORMAT.INTERACTIVE:
                return this._renderInteractive(options);

            case DISPLAY_FORMAT.JSON:
                return this._renderJSON();

            default:
                return this._renderText(includeExamples, includeRelated, maxWidth);
        }
    }

    /**
     * 渲染純文本格式
     * @private
     */
    _renderText(includeExamples, includeRelated, maxWidth) {
        let output = '';

        // 標題
        output += `${'='.repeat(maxWidth)}\n`;
        output += this._centerText(this.title.toUpperCase(), maxWidth) + '\n';
        output += `${'='.repeat(maxWidth)}\n\n`;

        // 摘要
        if (this.summary) {
            output += this._wrapText(this.summary, maxWidth) + '\n\n';
        }

        // 主要內容
        if (this.content) {
            output += this._wrapText(this.content, maxWidth) + '\n\n';
        }

        // 章節
        this.sections.forEach((section, index) => {
            output += `${index + 1}. ${section.title}\n`;
            output += `${'-'.repeat(section.title.length + 4)}\n`;
            output += this._wrapText(section.content, maxWidth) + '\n\n';
        });

        // 示例
        if (includeExamples && this.examples.length > 0) {
            output += '📝 示例:\n';
            output += `${'─'.repeat(maxWidth)}\n`;

            this.examples.forEach((example, index) => {
                output += `示例 ${index + 1}: ${example.title}\n`;
                output += `${example.code}\n\n`;
                if (example.explanation) {
                    output += this._wrapText(example.explanation, maxWidth) + '\n';
                }
                output += '\n';
            });
        }

        // 相關主題
        if (includeRelated && this.relatedTopics.length > 0) {
            output += '🔗 相關主題:\n';
            output += `${'─'.repeat(maxWidth)}\n`;
            this.relatedTopics.forEach(topic => {
                output += `- ${topic}\n`;
            });
            output += '\n';
        }

        return output;
    }

    /**
     * 渲染Markdown格式
     * @private
     */
    _renderMarkdown(includeExamples, includeRelated) {
        let output = '';

        // 標題
        output += `# ${this.title}\n\n`;

        // 摘要
        if (this.summary) {
            output += `*${this.summary}*\n\n`;
        }

        // 主要內容
        if (this.content) {
            output += `${this.content}\n\n`;
        }

        // 章節
        this.sections.forEach(section => {
            output += `## ${section.title}\n\n`;
            output += `${section.content}\n\n`;
        });

        // 示例
        if (includeExamples && this.examples.length > 0) {
            output += '## 📝 示例\n\n';

            this.examples.forEach((example, index) => {
                output += `### 示例 ${index + 1}: ${example.title}\n\n`;
                output += `\`\`\`${example.language || 'bash'}\n`;
                output += `${example.code}\n`;
                output += '```\n\n';
                if (example.explanation) {
                    output += `${example.explanation}\n\n`;
                }
            });
        }

        // 相關主題
        if (includeRelated && this.relatedTopics.length > 0) {
            output += '## 🔗 相關主題\n\n';
            this.relatedTopics.forEach(topic => {
                output += `- [${topic}](#${topic.toLowerCase().replace(/\s+/g, '-')})\n`;
            });
            output += '\n';
        }

        return output;
    }

    /**
     * 渲染HTML格式
     * @private
     */
    _renderHTML(includeExamples, includeRelated, theme) {
        const className = `help-content theme-${theme}`;

        let html = `<div class="${className}">`;

        // 標題
        html += `<h1>${this._escapeHTML(this.title)}</h1>`;

        // 摘要
        if (this.summary) {
            html += `<p class="summary"><em>${this._escapeHTML(this.summary)}</em></p>`;
        }

        // 主要內容
        if (this.content) {
            html += `<div class="content">${this._escapeHTML(this.content)}</div>`;
        }

        // 章節
        this.sections.forEach(section => {
            html += `<h2>${this._escapeHTML(section.title)}</h2>`;
            html += `<p>${this._escapeHTML(section.content)}</p>`;
        });

        // 示例
        if (includeExamples && this.examples.length > 0) {
            html += '<h2>📝 示例</h2>';

            this.examples.forEach((example, index) => {
                html += `<h3>示例 ${index + 1}: ${this._escapeHTML(example.title)}</h3>`;
                html += `<pre><code class="language-${example.language || 'bash'}">`;
                html += this._escapeHTML(example.code);
                html += '</code></pre>';
                if (example.explanation) {
                    html += `<p>${this._escapeHTML(example.explanation)}</p>`;
                }
            });
        }

        // 相關主題
        if (includeRelated && this.relatedTopics.length > 0) {
            html += '<h2>🔗 相關主題</h2><ul>';
            this.relatedTopics.forEach(topic => {
                html += `<li><a href="#${topic.toLowerCase()}">${this._escapeHTML(topic)}</a></li>`;
            });
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 渲染互動式格式
     * @private
     */
    _renderInteractive(options) {
        return {
            type: 'interactive',
            title: this.title,
            content: this.content,
            sections: this.sections,
            examples: this.examples,
            relatedTopics: this.relatedTopics,
            actions: this._generateInteractiveActions(options)
        };
    }

    /**
     * 渲染JSON格式
     * @private
     */
    _renderJSON() {
        return JSON.stringify({
            id: this.id,
            type: this.type,
            title: this.title,
            summary: this.summary,
            content: this.content,
            level: this.level,
            category: this.category,
            tags: this.tags,
            sections: this.sections,
            examples: this.examples,
            relatedTopics: this.relatedTopics,
            lastUpdated: this.lastUpdated,
            version: this.version
        }, null, 2);
    }

    /**
     * 生成互動式操作
     * @private
     */
    _generateInteractiveActions(options) {
        const actions = [];

        if (this.examples.length > 0) {
            actions.push({
                type: 'run_example',
                label: '運行示例',
                examples: this.examples.map(e => ({ title: e.title, code: e.code }))
            });
        }

        if (this.relatedTopics.length > 0) {
            actions.push({
                type: 'view_related',
                label: '查看相關主題',
                topics: this.relatedTopics
            });
        }

        return actions;
    }

    // 工具方法
    _centerText(text, width) {
        const padding = Math.max(0, Math.floor((width - text.length) / 2));
        return ' '.repeat(padding) + text;
    }

    _wrapText(text, width) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            if (currentLine.length + word.length + 1 <= width) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.join('\n');
    }

    _escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * 記錄查看
     */
    recordView() {
        this.viewCount++;
    }

    /**
     * 添加反饋
     * @param {Object} feedback - 反饋信息
     */
    addFeedback(feedback) {
        this.feedback.push({
            ...feedback,
            timestamp: Date.now()
        });

        // 更新評分
        if (feedback.rating) {
            const totalRating = this.feedback
                .filter(f => f.rating)
                .reduce((sum, f) => sum + f.rating, 0);
            const ratingCount = this.feedback.filter(f => f.rating).length;
            this.rating = totalRating / ratingCount;
        }
    }
}

/**
 * 幫助搜索引擎
 */
class HelpSearchEngine {
    constructor() {
        this.index = new Map(); // keyword -> Set<contentId>
        this.contents = new Map(); // contentId -> HelpContent
    }

    /**
     * 添加內容到搜索索引
     * @param {HelpContent} content - 幫助內容
     */
    addContent(content) {
        this.contents.set(content.id, content);

        if (!content.searchable) return;

        // 索引標題
        this._indexText(content.title, content.id);

        // 索引摘要
        if (content.summary) {
            this._indexText(content.summary, content.id);
        }

        // 索引內容
        if (content.content) {
            this._indexText(content.content, content.id);
        }

        // 索引標籤
        content.tags.forEach(tag => {
            this._addToIndex(tag.toLowerCase(), content.id);
        });

        // 索引章節
        content.sections.forEach(section => {
            this._indexText(section.title, content.id);
            this._indexText(section.content, content.id);
        });
    }

    /**
     * 移除內容
     * @param {string} contentId - 內容ID
     */
    removeContent(contentId) {
        this.contents.delete(contentId);

        // 從索引中移除
        for (const [keyword, ids] of this.index.entries()) {
            ids.delete(contentId);
            if (ids.size === 0) {
                this.index.delete(keyword);
            }
        }
    }

    /**
     * 搜索內容
     * @param {string} query - 搜索查詢
     * @param {Object} options - 搜索選項
     * @returns {Array<Object>} 搜索結果
     */
    search(query, options = {}) {
        const {
            type = null,
            category = null,
            level = null,
            limit = 20,
            fuzzy = true
        } = options;

        if (!query.trim()) {
            return this._getAllContents(options);
        }

        const keywords = this._extractKeywords(query);
        const matches = new Map(); // contentId -> score

        // 搜索匹配
        keywords.forEach(keyword => {
            // 精確匹配
            const exactIds = this.index.get(keyword.toLowerCase());
            if (exactIds) {
                exactIds.forEach(id => {
                    const score = matches.get(id) || 0;
                    matches.set(id, score + 10);
                });
            }

            // 模糊匹配
            if (fuzzy) {
                for (const [indexKeyword, ids] of this.index.entries()) {
                    if (indexKeyword.includes(keyword.toLowerCase()) ||
                        keyword.toLowerCase().includes(indexKeyword)) {
                        ids.forEach(id => {
                            const score = matches.get(id) || 0;
                            matches.set(id, score + 5);
                        });
                    }
                }
            }
        });

        // 獲取匹配的內容
        let results = Array.from(matches.entries())
            .map(([id, score]) => {
                const content = this.contents.get(id);
                return content ? { content, score } : null;
            })
            .filter(result => result !== null);

        // 應用過濾器
        results = results.filter(({ content }) => {
            if (type && content.type !== type) return false;
            if (category && content.category !== category) return false;
            if (level && content.level !== level) return false;
            return true;
        });

        // 排序並限制結果
        results.sort((a, b) => {
            // 首先按分數排序
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            // 然後按查看次數排序
            return b.content.viewCount - a.content.viewCount;
        });

        return results.slice(0, limit).map(r => r.content);
    }

    /**
     * 獲取建議內容
     * @param {string} contentId - 當前內容ID
     * @param {number} limit - 限制數量
     * @returns {Array<HelpContent>} 建議內容
     */
    getSuggestions(contentId, limit = 5) {
        const currentContent = this.contents.get(contentId);
        if (!currentContent) return [];

        const suggestions = [];

        // 基於相關主題的建議
        currentContent.relatedTopics.forEach(topic => {
            const related = this.search(topic, { limit: 2 });
            suggestions.push(...related);
        });

        // 基於標籤的建議
        currentContent.tags.forEach(tag => {
            const tagged = Array.from(this.contents.values())
                .filter(content =>
                    content.id !== contentId &&
                    content.tags.includes(tag)
                )
                .slice(0, 2);
            suggestions.push(...tagged);
        });

        // 基於類別的建議
        const categoryContent = Array.from(this.contents.values())
            .filter(content =>
                content.id !== contentId &&
                content.category === currentContent.category
            )
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, 2);
        suggestions.push(...categoryContent);

        // 去重並限制數量
        const unique = suggestions.filter((content, index, arr) =>
            arr.findIndex(c => c.id === content.id) === index
        );

        return unique.slice(0, limit);
    }

    /**
     * 獲取熱門內容
     * @param {number} limit - 限制數量
     * @returns {Array<HelpContent>} 熱門內容
     */
    getPopularContent(limit = 10) {
        return Array.from(this.contents.values())
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, limit);
    }

    // 私有方法
    _indexText(text, contentId) {
        const keywords = this._extractKeywords(text);
        keywords.forEach(keyword => {
            this._addToIndex(keyword.toLowerCase(), contentId);
        });
    }

    _extractKeywords(text) {
        return text.toLowerCase()
            .split(/[^\w\u4e00-\u9fff]+/)
            .filter(word => word.length > 1);
    }

    _addToIndex(keyword, contentId) {
        if (!this.index.has(keyword)) {
            this.index.set(keyword, new Set());
        }
        this.index.get(keyword).add(contentId);
    }

    _getAllContents(options) {
        let contents = Array.from(this.contents.values());

        // 應用過濾器
        if (options.type) {
            contents = contents.filter(c => c.type === options.type);
        }
        if (options.category) {
            contents = contents.filter(c => c.category === options.category);
        }
        if (options.level) {
            contents = contents.filter(c => c.level === options.level);
        }

        // 排序並限制
        contents.sort((a, b) => b.viewCount - a.viewCount);
        return contents.slice(0, options.limit || 20);
    }
}

/**
 * 智能幫助系統主類
 */
export class HelpSystem extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            language: 'zh-TW',              // 默認語言
            enableSearch: true,             // 啟用搜索
            enableInteractive: true,        // 啟用互動模式
            enableFeedback: true,           // 啟用反饋系統
            cacheTimeout: 300000,           // 5分鐘緩存超時
            maxCacheSize: 1000,             // 最大緩存大小
            defaultFormat: DISPLAY_FORMAT.TEXT,
            ...options
        };

        // 核心組件
        this.commandRegistry = options.commandRegistry || new Map();
        this.searchEngine = new HelpSearchEngine();
        this.contentCache = new Map();

        // 內容存儲
        this.helpContents = new Map(); // contentId -> HelpContent

        // 統計信息
        this.stats = {
            totalViews: 0,
            totalSearches: 0,
            popularTopics: [],
            userFeedback: []
        };

        // 初始化狀態
        this.initialized = false;
    }

    /**
     * 初始化幫助系統
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[HelpSystem] 初始化幫助系統...');

            // 載入默認幫助內容
            await this._loadDefaultContent();

            // 生成命令幫助
            this._generateCommandHelp();

            // 建立搜索索引
            this._buildSearchIndex();

            this.initialized = true;
            console.log(`[HelpSystem] 幫助系統初始化完成，載入 ${this.helpContents.size} 個主題`);
            this.emit('initialized', { contentCount: this.helpContents.size });

        } catch (error) {
            console.error('[HelpSystem] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取總體幫助
     * @param {Object} options - 顯示選項
     * @returns {string} 總體幫助內容
     */
    async getOverallHelp(options = {}) {
        const format = options.format || this.options.defaultFormat;

        const overviewContent = new HelpContent('overview', HELP_CONTENT_TYPE.OVERVIEW, {
            title: 'CCPM+SuperClaude 整合命令系統',
            summary: '歡迎使用智能整合命令系統！這是一個強大的命令行工具，結合了CCPM和SuperClaude的優勢。',
            content: `
本系統提供統一的命令接口，讓您能夠：

• 執行智能分析和工作流程
• 監控系統狀態和性能
• 配置和優化系統設置
• 獲得完整的幫助和支持

所有命令都以 /integrated: 開頭，後跟具體的命令名稱和參數。
`,
            sections: [
                {
                    title: '快速開始',
                    content: `
1. 查看系統狀態: /integrated:status
2. 獲取命令幫助: /integrated:help
3. 執行系統分析: /integrated:analyze
4. 啟動工作流程: /integrated:workflow
5. 監控系統運行: /integrated:monitor
`
                },
                {
                    title: '命令分類',
                    content: `
• 系統管理: status, config, monitor, optimize
• 分析工具: analyze, debug, test
• 工作流程: workflow, report
• 幫助支持: help

使用 /integrated:help <類別> 查看特定類別的命令。
`
                }
            ],
            examples: [
                {
                    title: '檢查系統狀態',
                    code: '/integrated:status --verbose',
                    explanation: '顯示詳細的系統狀態信息'
                },
                {
                    title: '獲取命令幫助',
                    code: '/integrated:help status',
                    explanation: '查看 status 命令的詳細幫助'
                },
                {
                    title: '執行系統分析',
                    code: '/integrated:analyze --type=performance',
                    explanation: '執行性能分析'
                }
            ],
            relatedTopics: [
                '命令語法',
                '參數說明',
                '最佳實踐',
                '常見問題'
            ]
        });

        overviewContent.recordView();
        this.stats.totalViews++;

        return overviewContent.render(format, options);
    }

    /**
     * 獲取命令幫助
     * @param {string} commandName - 命令名稱
     * @param {Object} options - 顯示選項
     * @returns {string} 命令幫助內容
     */
    async getCommandHelp(commandName, options = {}) {
        const format = options.format || this.options.defaultFormat;

        // 從緩存獲取
        const cacheKey = `command_${commandName}_${format}`;
        if (this.contentCache.has(cacheKey)) {
            const cached = this.contentCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.options.cacheTimeout) {
                return cached.content;
            }
        }

        // 查找命令定義
        const commandDef = this.commandRegistry.get(commandName);
        if (!commandDef) {
            return this._generateUnknownCommandHelp(commandName, format);
        }

        // 生成命令幫助內容
        const helpContent = this._generateCommandHelpContent(commandDef);
        const rendered = helpContent.render(format, options);

        // 緩存結果
        this.contentCache.set(cacheKey, {
            content: rendered,
            timestamp: Date.now()
        });

        // 記錄查看
        helpContent.recordView();
        this.stats.totalViews++;

        return rendered;
    }

    /**
     * 獲取類別幫助
     * @param {string} category - 類別名稱
     * @param {Object} options - 顯示選項
     * @returns {string} 類別幫助內容
     */
    async getCategoryHelp(category, options = {}) {
        const format = options.format || this.options.defaultFormat;

        // 獲取類別下的所有命令
        const categoryCommands = Array.from(this.commandRegistry.values())
            .filter(cmd => cmd.category === category);

        if (categoryCommands.length === 0) {
            return this._generateUnknownCategoryHelp(category, format);
        }

        const categoryContent = new HelpContent(`category_${category}`, HELP_CONTENT_TYPE.REFERENCE, {
            title: `${category} 類別命令`,
            summary: `${category} 類別下的所有可用命令和功能說明`,
            content: `本類別包含 ${categoryCommands.length} 個命令，涵蓋了${this._getCategoryDescription(category)}的功能。`,
            sections: [
                {
                    title: '可用命令',
                    content: categoryCommands.map(cmd =>
                        `• ${cmd.name}: ${cmd.description}`
                    ).join('\n')
                },
                {
                    title: '使用說明',
                    content: '使用 /integrated:help <命令名> 查看具體命令的詳細幫助。'
                }
            ],
            examples: categoryCommands.slice(0, 3).map(cmd => ({
                title: `使用 ${cmd.name} 命令`,
                code: cmd.examples?.[0] || `/integrated:${cmd.name}`,
                explanation: cmd.description
            })),
            category: category
        });

        categoryContent.recordView();
        this.stats.totalViews++;

        return categoryContent.render(format, options);
    }

    /**
     * 搜索幫助內容
     * @param {string} query - 搜索查詢
     * @param {Object} options - 搜索選項
     * @returns {Array<Object>} 搜索結果
     */
    async searchHelp(query, options = {}) {
        if (!this.options.enableSearch) {
            throw new Error('搜索功能未啟用');
        }

        this.stats.totalSearches++;

        const results = this.searchEngine.search(query, options);

        // 記錄搜索統計
        this._recordSearchStats(query, results.length);

        return results.map(content => ({
            id: content.id,
            title: content.title,
            summary: content.summary,
            type: content.type,
            category: content.category,
            score: content.viewCount,
            preview: this._generatePreview(content, query)
        }));
    }

    /**
     * 獲取內容建議
     * @param {string} contentId - 當前內容ID
     * @param {number} limit - 建議數量
     * @returns {Array<Object>} 建議內容
     */
    async getSuggestions(contentId, limit = 5) {
        const suggestions = this.searchEngine.getSuggestions(contentId, limit);

        return suggestions.map(content => ({
            id: content.id,
            title: content.title,
            summary: content.summary,
            type: content.type,
            category: content.category
        }));
    }

    /**
     * 獲取熱門內容
     * @param {number} limit - 限制數量
     * @returns {Array<Object>} 熱門內容列表
     */
    getPopularContent(limit = 10) {
        const popular = this.searchEngine.getPopularContent(limit);

        return popular.map(content => ({
            id: content.id,
            title: content.title,
            summary: content.summary,
            type: content.type,
            category: content.category,
            viewCount: content.viewCount,
            rating: content.rating
        }));
    }

    /**
     * 添加用戶反饋
     * @param {string} contentId - 內容ID
     * @param {Object} feedback - 反饋信息
     */
    addFeedback(contentId, feedback) {
        if (!this.options.enableFeedback) return;

        const content = this.helpContents.get(contentId);
        if (content) {
            content.addFeedback(feedback);
            this.stats.userFeedback.push({
                contentId,
                feedback,
                timestamp: Date.now()
            });

            this.emit('feedbackReceived', { contentId, feedback });
        }
    }

    /**
     * 獲取統計信息
     * @returns {Object} 統計信息
     */
    getStatistics() {
        const popularContent = this.getPopularContent(5);

        return {
            ...this.stats,
            totalContent: this.helpContents.size,
            cacheSize: this.contentCache.size,
            averageRating: this._calculateAverageRating(),
            popularContent: popularContent.map(c => ({ title: c.title, views: c.viewCount }))
        };
    }

    // ========== 私有方法 ==========

    /**
     * 載入默認幫助內容
     * @private
     */
    async _loadDefaultContent() {
        // 系統概覽
        const systemOverview = new HelpContent('system_overview', HELP_CONTENT_TYPE.OVERVIEW, {
            title: '系統架構概覽',
            summary: 'CCPM+SuperClaude整合系統的架構和組件說明',
            content: '了解系統的核心組件、架構設計和工作原理。',
            sections: [
                {
                    title: '核心組件',
                    content: `
• CommandRouter: 統一命令路由系統
• SmartRouter: 智能路由引擎
• ParallelExecutor: 並行執行協調器
• EventBus: 事件驅動通信系統
• StateSynchronizer: 狀態同步機制
`
                },
                {
                    title: '系統特性',
                    content: `
• 智能命令路由和執行
• 實時狀態監控和同步
• 並行任務處理和優化
• 完整的錯誤處理和恢復
• 可擴展的插件架構
`
                }
            ],
            category: 'system',
            level: HELP_LEVEL.INTERMEDIATE
        });

        // 命令語法指南
        const syntaxGuide = new HelpContent('command_syntax', HELP_CONTENT_TYPE.TUTORIAL, {
            title: '命令語法指南',
            summary: '學習如何正確使用整合命令的語法格式',
            content: '掌握命令語法是有效使用系統的基礎。',
            sections: [
                {
                    title: '基本語法',
                    content: '/integrated:<命令> [參數] [標誌]'
                },
                {
                    title: '參數類型',
                    content: `
• 必需參數: --name <值>
• 可選參數: [--option <值>]
• 布爾標誌: --verbose
• 短標誌: -v
`
                },
                {
                    title: '特殊字符',
                    content: `
• 空格: 使用引號包圍 "帶空格的值"
• 轉義: 使用反斜線 \\
• 管道: 支持命令組合
`
                }
            ],
            examples: [
                {
                    title: '基本命令',
                    code: '/integrated:status',
                    explanation: '最簡單的命令格式'
                },
                {
                    title: '帶參數命令',
                    code: '/integrated:analyze --type=performance --depth=5',
                    explanation: '指定參數的命令格式'
                },
                {
                    title: '帶標誌命令',
                    code: '/integrated:status --verbose --json',
                    explanation: '使用多個標誌的命令格式'
                }
            ],
            category: 'guide',
            level: HELP_LEVEL.BEGINNER
        });

        // 常見問題
        const faq = new HelpContent('faq', HELP_CONTENT_TYPE.FAQ, {
            title: '常見問題解答',
            summary: '最常見的問題和解決方案',
            content: '收集用戶最常遇到的問題和相應的解決方法。',
            sections: [
                {
                    title: 'Q: 系統未響應怎麼辦？',
                    content: 'A: 檢查系統狀態 (/integrated:status)，重新初始化或聯繫管理員。'
                },
                {
                    title: 'Q: 命令執行失敗如何處理？',
                    content: 'A: 查看錯誤信息，檢查參數格式，使用 --help 獲取幫助。'
                },
                {
                    title: 'Q: 如何提升執行性能？',
                    content: 'A: 使用 /integrated:optimize 進行系統優化，避免並發過多命令。'
                }
            ],
            category: 'support',
            level: HELP_LEVEL.BEGINNER
        });

        // 添加到系統
        [systemOverview, syntaxGuide, faq].forEach(content => {
            this.helpContents.set(content.id, content);
        });
    }

    /**
     * 生成命令幫助
     * @private
     */
    _generateCommandHelp() {
        for (const [commandName, commandDef] of this.commandRegistry) {
            const helpContent = this._generateCommandHelpContent(commandDef);
            this.helpContents.set(`command_${commandName}`, helpContent);
        }
    }

    /**
     * 生成命令幫助內容
     * @private
     */
    _generateCommandHelpContent(commandDef) {
        return new HelpContent(`command_${commandDef.name}`, HELP_CONTENT_TYPE.COMMAND, {
            title: `/integrated:${commandDef.name}`,
            summary: commandDef.description,
            content: `${commandDef.description}\n\n類別: ${commandDef.category}`,
            sections: this._generateCommandSections(commandDef),
            examples: (commandDef.examples || []).map(example => ({
                title: '使用示例',
                code: example,
                explanation: '執行此命令的示例'
            })),
            category: commandDef.category,
            level: this._determineCommandLevel(commandDef),
            tags: [commandDef.type, commandDef.category, 'command']
        });
    }

    /**
     * 生成命令章節
     * @private
     */
    _generateCommandSections(commandDef) {
        const sections = [];

        // 語法章節
        const syntax = this._generateCommandSyntax(commandDef);
        sections.push({
            title: '語法',
            content: syntax
        });

        // 參數章節
        if (commandDef.parameters && commandDef.parameters.length > 0) {
            const paramContent = commandDef.parameters.map(param =>
                `--${param.name} ${param.type || 'string'}: ${param.description}${param.required ? ' (必需)' : ''}`
            ).join('\n');

            sections.push({
                title: '參數',
                content: paramContent
            });
        }

        // 標誌章節
        if (commandDef.flags && commandDef.flags.length > 0) {
            const flagContent = commandDef.flags.map(flag =>
                `--${flag.name}: ${flag.description}`
            ).join('\n');

            sections.push({
                title: '標誌',
                content: flagContent
            });
        }

        return sections;
    }

    /**
     * 生成命令語法
     * @private
     */
    _generateCommandSyntax(commandDef) {
        let syntax = `/integrated:${commandDef.name}`;

        if (commandDef.parameters) {
            commandDef.parameters.forEach(param => {
                if (param.required) {
                    syntax += ` --${param.name} <${param.type || 'value'}>`;
                } else {
                    syntax += ` [--${param.name} <${param.type || 'value'}>]`;
                }
            });
        }

        if (commandDef.flags) {
            commandDef.flags.forEach(flag => {
                syntax += ` [--${flag.name}]`;
            });
        }

        return syntax;
    }

    /**
     * 確定命令級別
     * @private
     */
    _determineCommandLevel(commandDef) {
        if (commandDef.category === 'help' || commandDef.name === 'status') {
            return HELP_LEVEL.BEGINNER;
        } else if (commandDef.category === 'system' || commandDef.category === 'monitoring') {
            return HELP_LEVEL.INTERMEDIATE;
        } else {
            return HELP_LEVEL.ADVANCED;
        }
    }

    /**
     * 建立搜索索引
     * @private
     */
    _buildSearchIndex() {
        for (const content of this.helpContents.values()) {
            this.searchEngine.addContent(content);
        }
    }

    /**
     * 生成未知命令幫助
     * @private
     */
    _generateUnknownCommandHelp(commandName, format) {
        const content = `找不到命令 '${commandName}' 的幫助。

可用命令:
${Array.from(this.commandRegistry.keys()).map(cmd => `• ${cmd}`).join('\n')}

使用 /integrated:help 查看完整的命令列表。
使用 /integrated:help <命令名> 查看特定命令的幫助。`;

        return format === DISPLAY_FORMAT.MARKDOWN ?
            `# 未知命令\n\n${content}` : content;
    }

    /**
     * 生成未知類別幫助
     * @private
     */
    _generateUnknownCategoryHelp(category, format) {
        const availableCategories = [...new Set(
            Array.from(this.commandRegistry.values()).map(cmd => cmd.category)
        )];

        const content = `找不到類別 '${category}'。

可用類別:
${availableCategories.map(cat => `• ${cat}`).join('\n')}

使用 /integrated:help <類別名> 查看類別下的命令。`;

        return format === DISPLAY_FORMAT.MARKDOWN ?
            `# 未知類別\n\n${content}` : content;
    }

    /**
     * 獲取類別描述
     * @private
     */
    _getCategoryDescription(category) {
        const descriptions = {
            'system': '系統管理和狀態監控',
            'analysis': '數據分析和處理',
            'workflow': '工作流程和自動化',
            'help': '幫助和支持',
            'monitoring': '監控和診斷',
            'config': '配置和設置'
        };

        return descriptions[category] || '相關功能';
    }

    /**
     * 生成內容預覽
     * @private
     */
    _generatePreview(content, query) {
        const text = content.content || content.summary;
        if (!text || !query) return text.substring(0, 200);

        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(queryLower);

        if (index === -1) {
            return text.substring(0, 200);
        }

        // 生成包含查詢詞的預覽
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 50);

        let preview = text.substring(start, end);
        if (start > 0) preview = '...' + preview;
        if (end < text.length) preview = preview + '...';

        return preview;
    }

    /**
     * 記錄搜索統計
     * @private
     */
    _recordSearchStats(query, resultCount) {
        // 更新熱門搜索主題
        const existingTopic = this.stats.popularTopics.find(t => t.query === query);
        if (existingTopic) {
            existingTopic.count++;
        } else {
            this.stats.popularTopics.push({ query, count: 1 });
        }

        // 保持熱門主題列表大小
        this.stats.popularTopics.sort((a, b) => b.count - a.count);
        if (this.stats.popularTopics.length > 100) {
            this.stats.popularTopics = this.stats.popularTopics.slice(0, 100);
        }
    }

    /**
     * 計算平均評分
     * @private
     */
    _calculateAverageRating() {
        const allRatings = Array.from(this.helpContents.values())
            .map(content => content.rating)
            .filter(rating => rating > 0);

        return allRatings.length > 0 ?
            allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length : 0;
    }

    /**
     * 清理緩存
     */
    cleanup() {
        const now = Date.now();
        const expired = [];

        for (const [key, cached] of this.contentCache.entries()) {
            if (now - cached.timestamp > this.options.cacheTimeout) {
                expired.push(key);
            }
        }

        expired.forEach(key => this.contentCache.delete(key));

        // 限制緩存大小
        if (this.contentCache.size > this.options.maxCacheSize) {
            const entries = Array.from(this.contentCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toDelete = entries.slice(0, this.contentCache.size - this.options.maxCacheSize);
            toDelete.forEach(([key]) => this.contentCache.delete(key));
        }

        console.log('[HelpSystem] 緩存清理完成');
    }

    /**
     * 清理資源
     */
    async dispose() {
        try {
            // 清理緩存
            this.contentCache.clear();
            this.helpContents.clear();

            this.removeAllListeners();
            console.log('[HelpSystem] 資源清理完成');

        } catch (error) {
            console.error('[HelpSystem] 資源清理失敗:', error);
            throw error;
        }
    }
}

export default HelpSystem;