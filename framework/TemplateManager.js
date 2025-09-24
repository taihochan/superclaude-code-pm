/**
 * TemplateManager - 協作模板管理系統
 *
 * 功能：
 * - 管理CCPM+SuperClaude協作模板
 * - 模板版本控制和變更追蹤
 * - 動態模板編譯和渲染
 * - 模板依賴管理和解析
 * - 協作模板共享和權限控制
 *
 * 用途：統一管理所有協作模板和代碼生成模板
 * 配合：ConfigManager進行模板配置管理和持久化
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ConfigManager = require('./ConfigManager');
const EventBus = require('./EventBus');

/**
 * 模板類型
 */
const TEMPLATE_TYPES = {
    COMPONENT: 'component',             // 組件模板
    PAGE: 'page',                      // 頁面模板
    WORKFLOW: 'workflow',              // 工作流模板
    CONFIG: 'config',                  // 配置模板
    SCRIPT: 'script',                  // 腳本模板
    DOCUMENTATION: 'documentation',     // 文檔模板
    TEST: 'test',                      // 測試模板
    DEPLOYMENT: 'deployment'           // 部署模板
};

/**
 * 模板狀態
 */
const TEMPLATE_STATUS = {
    DRAFT: 'draft',                    // 草稿
    ACTIVE: 'active',                  // 活動
    DEPRECATED: 'deprecated',          // 已棄用
    ARCHIVED: 'archived'               // 已歸檔
};

/**
 * 模板引擎類型
 */
const TEMPLATE_ENGINES = {
    HANDLEBARS: 'handlebars',          // Handlebars模板
    MUSTACHE: 'mustache',              // Mustache模板
    EJS: 'ejs',                        // EJS模板
    LIQUID: 'liquid',                  // Liquid模板
    CUSTOM: 'custom'                   // 自定義引擎
};

/**
 * 模板權限
 */
const TEMPLATE_PERMISSIONS = {
    READ: 'read',                      // 讀取
    WRITE: 'write',                    // 編輯
    EXECUTE: 'execute',                // 執行
    SHARE: 'share',                    // 共享
    DELETE: 'delete'                   // 刪除
};

/**
 * 模板變量類型
 */
const VARIABLE_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
    DATE: 'date',
    FILE: 'file',
    REFERENCE: 'reference'             // 引用其他模板或配置
};

/**
 * 模板類
 */
class Template {
    constructor(data = {}) {
        this.id = data.id || this._generateId();
        this.name = data.name || '';
        this.description = data.description || '';
        this.type = data.type || TEMPLATE_TYPES.COMPONENT;
        this.status = data.status || TEMPLATE_STATUS.DRAFT;
        this.engine = data.engine || TEMPLATE_ENGINES.HANDLEBARS;

        // 模板內容
        this.content = data.content || '';
        this.partials = data.partials || {}; // 部分模板
        this.helpers = data.helpers || {};   // 幫助函數

        // 變量定義
        this.variables = data.variables || [];
        this.defaultValues = data.defaultValues || {};

        // 依賴關係
        this.dependencies = data.dependencies || [];
        this.requiredTemplates = data.requiredTemplates || [];

        // 元數據
        this.metadata = {
            author: data.metadata?.author || 'unknown',
            version: data.metadata?.version || '1.0.0',
            tags: data.metadata?.tags || [],
            category: data.metadata?.category || '',
            framework: data.metadata?.framework || '',
            language: data.metadata?.language || 'javascript',
            ...data.metadata
        };

        // 權限和共享
        this.permissions = data.permissions || {};
        this.isPublic = data.isPublic || false;
        this.sharedWith = data.sharedWith || [];

        // 時間戳
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || this.createdAt;
        this.lastUsed = data.lastUsed || null;

        // 使用統計
        this.stats = {
            usageCount: 0,
            successRate: 100,
            averageRenderTime: 0,
            errorCount: 0,
            ...data.stats
        };

        // 編譯緩存
        this.compiledTemplate = null;
        this.compiledAt = null;
    }

    /**
     * 生成模板ID
     */
    _generateId() {
        return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * 驗證模板
     */
    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('模板名稱不能為空');
        }

        if (!this.content || this.content.trim() === '') {
            errors.push('模板內容不能為空');
        }

        if (!Object.values(TEMPLATE_TYPES).includes(this.type)) {
            errors.push('無效的模板類型');
        }

        if (!Object.values(TEMPLATE_ENGINES).includes(this.engine)) {
            errors.push('無效的模板引擎');
        }

        // 驗證變量定義
        for (const variable of this.variables) {
            if (!variable.name || !variable.type) {
                errors.push(`變量定義不完整: ${variable.name || '未命名'}`);
            }

            if (!Object.values(VARIABLE_TYPES).includes(variable.type)) {
                errors.push(`無效的變量類型: ${variable.type}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 編譯模板
     */
    async compile(engine = null) {
        const templateEngine = engine || this.engine;

        try {
            switch (templateEngine) {
                case TEMPLATE_ENGINES.HANDLEBARS:
                    this.compiledTemplate = await this._compileHandlebars();
                    break;
                case TEMPLATE_ENGINES.MUSTACHE:
                    this.compiledTemplate = await this._compileMustache();
                    break;
                case TEMPLATE_ENGINES.EJS:
                    this.compiledTemplate = await this._compileEJS();
                    break;
                case TEMPLATE_ENGINES.LIQUID:
                    this.compiledTemplate = await this._compileLiquid();
                    break;
                case TEMPLATE_ENGINES.CUSTOM:
                    this.compiledTemplate = await this._compileCustom();
                    break;
                default:
                    throw new Error(`不支持的模板引擎: ${templateEngine}`);
            }

            this.compiledAt = Date.now();
            return this.compiledTemplate;

        } catch (error) {
            console.error(`[Template] 編譯失敗 [${this.id}]:`, error);
            throw error;
        }
    }

    /**
     * 渲染模板
     */
    async render(context = {}) {
        const startTime = Date.now();

        try {
            // 確保模板已編譯
            if (!this.compiledTemplate || this._isCompilationStale()) {
                await this.compile();
            }

            // 合並預設值和上下文
            const mergedContext = {
                ...this.defaultValues,
                ...context
            };

            // 驗證必需變量
            this._validateRequiredVariables(mergedContext);

            // 執行渲染
            let result;
            switch (this.engine) {
                case TEMPLATE_ENGINES.HANDLEBARS:
                    result = this.compiledTemplate(mergedContext);
                    break;
                case TEMPLATE_ENGINES.MUSTACHE:
                    result = this.compiledTemplate.render(mergedContext);
                    break;
                case TEMPLATE_ENGINES.EJS:
                    result = this.compiledTemplate(mergedContext);
                    break;
                case TEMPLATE_ENGINES.LIQUID:
                    result = await this.compiledTemplate.render(mergedContext);
                    break;
                case TEMPLATE_ENGINES.CUSTOM:
                    result = await this.compiledTemplate(mergedContext);
                    break;
                default:
                    throw new Error(`不支持的模板引擎: ${this.engine}`);
            }

            // 更新統計
            const renderTime = Date.now() - startTime;
            this._updateStats(true, renderTime);

            return result;

        } catch (error) {
            this._updateStats(false, Date.now() - startTime);
            throw error;
        }
    }

    /**
     * 克隆模板
     */
    clone(newName = null) {
        const cloned = new Template({
            ...this.serialize(),
            id: undefined, // 生成新ID
            name: newName || `${this.name} (副本)`,
            createdAt: undefined,
            updatedAt: undefined,
            stats: { usageCount: 0, successRate: 100, averageRenderTime: 0, errorCount: 0 }
        });

        return cloned;
    }

    /**
     * 序列化模板
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            status: this.status,
            engine: this.engine,
            content: this.content,
            partials: this.partials,
            helpers: this.helpers,
            variables: this.variables,
            defaultValues: this.defaultValues,
            dependencies: this.dependencies,
            requiredTemplates: this.requiredTemplates,
            metadata: this.metadata,
            permissions: this.permissions,
            isPublic: this.isPublic,
            sharedWith: this.sharedWith,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastUsed: this.lastUsed,
            stats: this.stats
        };
    }

    /**
     * 計算模板哈希
     */
    getHash() {
        const content = JSON.stringify({
            content: this.content,
            partials: this.partials,
            helpers: this.helpers,
            variables: this.variables,
            defaultValues: this.defaultValues
        });

        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    // ========== 私有編譯方法 ==========

    async _compileHandlebars() {
        // 模擬Handlebars編譯
        return (context) => {
            let result = this.content;

            // 簡單的變量替換
            result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const value = this._getNestedValue(context, key.trim());
                return value !== undefined ? value : match;
            });

            return result;
        };
    }

    async _compileMustache() {
        // 模擬Mustache編譯
        return {
            render: (context) => {
                let result = this.content;

                result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                    const value = this._getNestedValue(context, key.trim());
                    return value !== undefined ? value : '';
                });

                return result;
            }
        };
    }

    async _compileEJS() {
        // 模擬EJS編譯
        return (context) => {
            let result = this.content;

            // 簡單的EJS風格替換
            result = result.replace(/<%=\s*([^%]+)\s*%>/g, (match, expression) => {
                try {
                    const value = this._evaluateExpression(expression.trim(), context);
                    return value !== undefined ? value : match;
                } catch (error) {
                    return match;
                }
            });

            return result;
        };
    }

    async _compileLiquid() {
        // 模擬Liquid編譯
        return {
            render: async (context) => {
                let result = this.content;

                result = result.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
                    const value = this._getNestedValue(context, key.trim());
                    return value !== undefined ? value : '';
                });

                return result;
            }
        };
    }

    async _compileCustom() {
        // 自定義編譯邏輯
        return async (context) => {
            // 可以在這裡實現自定義模板語法
            return this.content;
        };
    }

    // ========== 私有輔助方法 ==========

    _isCompilationStale() {
        if (!this.compiledAt) return true;

        // 檢查是否需要重新編譯（例如：內容已更改）
        const maxAge = 5 * 60 * 1000; // 5分鐘
        return Date.now() - this.compiledAt > maxAge;
    }

    _validateRequiredVariables(context) {
        const requiredVars = this.variables.filter(v => v.required);

        for (const variable of requiredVars) {
            const value = this._getNestedValue(context, variable.name);
            if (value === undefined || value === null || value === '') {
                throw new Error(`必需變量缺失: ${variable.name}`);
            }
        }
    }

    _getNestedValue(obj, key) {
        return key.split('.').reduce((current, k) =>
            current && current[k] !== undefined ? current[k] : undefined, obj
        );
    }

    _evaluateExpression(expression, context) {
        // 簡化的表達式求值
        try {
            const func = new Function('context', `with(context) { return ${expression}; }`);
            return func(context);
        } catch (error) {
            return undefined;
        }
    }

    _updateStats(success, renderTime) {
        this.stats.usageCount++;
        this.lastUsed = new Date().toISOString();

        if (success) {
            // 更新平均渲染時間
            const totalTime = this.stats.averageRenderTime * (this.stats.usageCount - 1) + renderTime;
            this.stats.averageRenderTime = Math.round(totalTime / this.stats.usageCount);
        } else {
            this.stats.errorCount++;
        }

        // 更新成功率
        const successCount = this.stats.usageCount - this.stats.errorCount;
        this.stats.successRate = Math.round((successCount / this.stats.usageCount) * 100);
    }
}

/**
 * 主模板管理器
 */
class TemplateManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 基礎配置
            configManager: options.configManager || null,
            eventBus: options.eventBus || null,
            templatesDir: options.templatesDir || path.join(process.cwd(), '.claude', 'templates'),

            // 緩存配置
            enableCaching: options.enableCaching !== false,
            cacheSize: options.cacheSize || 500,
            compiledCacheTTL: options.compiledCacheTTL || 300000, // 5分鐘

            // 權限配置
            enablePermissions: options.enablePermissions || false,
            defaultPermissions: options.defaultPermissions || [
                TEMPLATE_PERMISSIONS.READ,
                TEMPLATE_PERMISSIONS.EXECUTE
            ],

            // 版本控制
            enableVersioning: options.enableVersioning || true,
            maxVersions: options.maxVersions || 10,

            // 依賴管理
            enableDependencyTracking: options.enableDependencyTracking || true,
            maxDependencyDepth: options.maxDependencyDepth || 10,

            ...options
        };

        // 核心組件
        this.configManager = this.options.configManager;
        this.eventBus = this.options.eventBus;

        // 模板存儲
        this.templates = new Map(); // id -> Template
        this.templatesByName = new Map(); // name -> Template
        this.templatesByType = new Map(); // type -> Set<Template>
        this.templatesByStatus = new Map(); // status -> Set<Template>

        // 編譯緩存
        this.compiledCache = new Map(); // templateId -> { compiled, timestamp }

        // 版本歷史
        this.versionHistory = new Map(); // templateId -> Array<Template>

        // 依賴圖
        this.dependencyGraph = new Map(); // templateId -> Set<dependencyId>
        this.reverseDependencyGraph = new Map(); // templateId -> Set<dependentId>

        // 統計信息
        this.stats = {
            totalTemplates: 0,
            templatesByType: {},
            totalRenders: 0,
            averageRenderTime: 0,
            cacheHitRate: 0,
            errorRate: 0
        };

        // 監控器
        this.watchers = new Map();

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化模板管理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 確保模板目錄存在
            await this._ensureTemplatesDirectory();

            // 初始化ConfigManager
            if (!this.configManager) {
                this.configManager = new ConfigManager();
                await this.configManager.initialize();
            }

            // 初始化EventBus
            if (!this.eventBus) {
                this.eventBus = new EventBus();
                await this.eventBus.initialize();
            }

            // 初始化類型映射
            this._initializeTypeMappings();

            // 加載現有模板
            await this._loadTemplates();

            // 構建依賴圖
            if (this.options.enableDependencyTracking) {
                this._buildDependencyGraph();
            }

            // 設置事件處理
            this._setupEventHandlers();

            this.initialized = true;
            console.log(`[TemplateManager] 已初始化 - 載入 ${this.templates.size} 個模板`);
            this.emit('initialized', { templateCount: this.templates.size });

        } catch (error) {
            console.error('[TemplateManager] 初始化失敗:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 創建模板
     * @param {object} templateData - 模板數據
     */
    async create(templateData) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // 驗證模板數據
            if (!templateData.name) {
                throw new Error('模板名稱是必需的');
            }

            // 檢查名稱衝突
            if (this.templatesByName.has(templateData.name)) {
                throw new Error(`模板名稱已存在: ${templateData.name}`);
            }

            // 創建模板實例
            const template = new Template(templateData);

            // 驗證模板
            const validation = template.validate();
            if (!validation.isValid) {
                throw new Error(`模板驗證失敗: ${validation.errors.join(', ')}`);
            }

            // 存儲模板
            await this._storeTemplate(template);

            // 保存到配置
            await this._persistTemplate(template);

            // 更新依賴圖
            if (this.options.enableDependencyTracking) {
                this._updateDependencyGraph(template);
            }

            // 發布事件
            await this.eventBus.publish('template.created', {
                templateId: template.id,
                templateName: template.name,
                templateType: template.type
            });

            console.log(`[TemplateManager] 模板已創建 [${template.name}] ID: ${template.id}`);
            this.emit('templateCreated', template);

            return template;

        } catch (error) {
            console.error('[TemplateManager] 創建模板失敗:', error);
            this.emit('templateError', error);
            throw error;
        }
    }

    /**
     * 獲取模板
     * @param {string} idOrName - 模板ID或名稱
     */
    get(idOrName) {
        return this.templates.get(idOrName) || this.templatesByName.get(idOrName);
    }

    /**
     * 獲取多個模板
     * @param {object} filters - 過濾條件
     */
    getMany(filters = {}) {
        let results = Array.from(this.templates.values());

        // 按類型過濾
        if (filters.type) {
            results = results.filter(t => t.type === filters.type);
        }

        // 按狀態過濾
        if (filters.status) {
            results = results.filter(t => t.status === filters.status);
        }

        // 按標籤過濾
        if (filters.tags && filters.tags.length > 0) {
            results = results.filter(t =>
                filters.tags.some(tag => t.metadata.tags.includes(tag))
            );
        }

        // 按作者過濾
        if (filters.author) {
            results = results.filter(t => t.metadata.author === filters.author);
        }

        // 按框架過濾
        if (filters.framework) {
            results = results.filter(t => t.metadata.framework === filters.framework);
        }

        // 搜索關鍵詞
        if (filters.search) {
            const search = filters.search.toLowerCase();
            results = results.filter(t =>
                t.name.toLowerCase().includes(search) ||
                t.description.toLowerCase().includes(search) ||
                t.metadata.tags.some(tag => tag.toLowerCase().includes(search))
            );
        }

        // 排序
        if (filters.sortBy) {
            results.sort((a, b) => {
                switch (filters.sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'created':
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    case 'updated':
                        return new Date(b.updatedAt) - new Date(a.updatedAt);
                    case 'used':
                        return (b.lastUsed || 0) - (a.lastUsed || 0);
                    case 'popularity':
                        return b.stats.usageCount - a.stats.usageCount;
                    default:
                        return 0;
                }
            });
        }

        // 限制結果數量
        if (filters.limit) {
            results = results.slice(0, filters.limit);
        }

        return results;
    }

    /**
     * 更新模板
     * @param {string} idOrName - 模板ID或名稱
     * @param {object} updates - 更新數據
     * @param {object} options - 選項
     */
    async update(idOrName, updates, options = {}) {
        try {
            const template = this.get(idOrName);
            if (!template) {
                throw new Error(`模板不存在: ${idOrName}`);
            }

            // 檢查權限
            if (this.options.enablePermissions && !this._hasPermission(template, TEMPLATE_PERMISSIONS.WRITE)) {
                throw new Error('沒有編輯權限');
            }

            // 創建版本備份
            if (this.options.enableVersioning) {
                this._createVersion(template);
            }

            // 獲取舊值用於事件
            const oldValues = {
                content: template.content,
                status: template.status,
                version: template.metadata.version
            };

            // 應用更新
            Object.assign(template, updates);
            template.updatedAt = new Date().toISOString();

            // 更新版本號
            if (updates.content || updates.variables || updates.partials) {
                template.metadata.version = this._incrementVersion(template.metadata.version);
            }

            // 清理編譯緩存
            this.compiledCache.delete(template.id);
            template.compiledTemplate = null;

            // 驗證更新後的模板
            const validation = template.validate();
            if (!validation.isValid) {
                throw new Error(`模板驗證失敗: ${validation.errors.join(', ')}`);
            }

            // 持久化更新
            await this._persistTemplate(template);

            // 更新依賴圖
            if (this.options.enableDependencyTracking &&
                (updates.dependencies || updates.requiredTemplates)) {
                this._updateDependencyGraph(template);
            }

            // 發布事件
            await this.eventBus.publish('template.updated', {
                templateId: template.id,
                templateName: template.name,
                oldValues,
                newValues: updates
            });

            console.log(`[TemplateManager] 模板已更新 [${template.name}] 版本: ${template.metadata.version}`);
            this.emit('templateUpdated', { template, oldValues });

            return template;

        } catch (error) {
            console.error(`[TemplateManager] 更新模板失敗 [${idOrName}]:`, error);
            throw error;
        }
    }

    /**
     * 刪除模板
     * @param {string} idOrName - 模板ID或名稱
     * @param {object} options - 選項
     */
    async delete(idOrName, options = {}) {
        try {
            const template = this.get(idOrName);
            if (!template) {
                throw new Error(`模板不存在: ${idOrName}`);
            }

            // 檢查權限
            if (this.options.enablePermissions && !this._hasPermission(template, TEMPLATE_PERMISSIONS.DELETE)) {
                throw new Error('沒有刪除權限');
            }

            // 檢查依賴關係
            if (this.options.enableDependencyTracking && !options.force) {
                const dependents = this.reverseDependencyGraph.get(template.id);
                if (dependents && dependents.size > 0) {
                    const dependentNames = Array.from(dependents)
                        .map(id => this.templates.get(id)?.name)
                        .filter(Boolean);

                    throw new Error(`模板被其他模板依賴，無法刪除: ${dependentNames.join(', ')}`);
                }
            }

            // 從存儲中移除
            this._removeTemplate(template);

            // 刪除配置
            await this._deletePersistedTemplate(template);

            // 清理依賴圖
            if (this.options.enableDependencyTracking) {
                this._removeFromDependencyGraph(template);
            }

            // 發布事件
            await this.eventBus.publish('template.deleted', {
                templateId: template.id,
                templateName: template.name,
                templateType: template.type
            });

            console.log(`[TemplateManager] 模板已刪除 [${template.name}]`);
            this.emit('templateDeleted', template);

            return true;

        } catch (error) {
            console.error(`[TemplateManager] 刪除模板失敗 [${idOrName}]:`, error);
            throw error;
        }
    }

    /**
     * 渲染模板
     * @param {string} idOrName - 模板ID或名稱
     * @param {object} context - 渲染上下文
     * @param {object} options - 選項
     */
    async render(idOrName, context = {}, options = {}) {
        const startTime = Date.now();

        try {
            const template = this.get(idOrName);
            if (!template) {
                throw new Error(`模板不存在: ${idOrName}`);
            }

            // 檢查權限
            if (this.options.enablePermissions && !this._hasPermission(template, TEMPLATE_PERMISSIONS.EXECUTE)) {
                throw new Error('沒有執行權限');
            }

            // 檢查模板狀態
            if (template.status === TEMPLATE_STATUS.DEPRECATED && !options.allowDeprecated) {
                console.warn(`[TemplateManager] 使用已棄用的模板: ${template.name}`);
            }

            if (template.status === TEMPLATE_STATUS.ARCHIVED) {
                throw new Error(`模板已歸檔，無法使用: ${template.name}`);
            }

            // 解析依賴
            const resolvedContext = await this._resolveDependencies(template, context);

            // 渲染模板
            const result = await template.render(resolvedContext);

            const renderTime = Date.now() - startTime;
            this.stats.totalRenders++;
            this.stats.averageRenderTime = (
                this.stats.averageRenderTime * (this.stats.totalRenders - 1) + renderTime
            ) / this.stats.totalRenders;

            // 發布事件
            await this.eventBus.publish('template.rendered', {
                templateId: template.id,
                templateName: template.name,
                renderTime,
                contextSize: Object.keys(resolvedContext).length
            });

            console.log(`[TemplateManager] 模板已渲染 [${template.name}] - 耗時: ${renderTime}ms`);
            this.emit('templateRendered', { template, renderTime, result });

            return result;

        } catch (error) {
            const renderTime = Date.now() - startTime;
            this.stats.errorRate = (this.stats.errorRate * this.stats.totalRenders + 1) / (this.stats.totalRenders + 1);

            console.error(`[TemplateManager] 渲染模板失敗 [${idOrName}]:`, error);
            this.emit('templateRenderError', { template: idOrName, error });
            throw error;
        }
    }

    /**
     * 批量渲染模板
     * @param {Array} renderTasks - 渲染任務數組 [{ template, context, options }]
     */
    async renderMany(renderTasks) {
        const results = [];
        const errors = [];

        // 並行渲染
        const promises = renderTasks.map(async (task, index) => {
            try {
                const result = await this.render(task.template, task.context, task.options);
                results[index] = { success: true, result };
            } catch (error) {
                results[index] = { success: false, error: error.message };
                errors.push({ index, error });
            }
        });

        await Promise.all(promises);

        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            errorCount: errors.length
        };
    }

    /**
     * 獲取模板版本歷史
     * @param {string} idOrName - 模板ID或名稱
     */
    getVersionHistory(idOrName) {
        const template = this.get(idOrName);
        if (!template) {
            throw new Error(`模板不存在: ${idOrName}`);
        }

        const history = this.versionHistory.get(template.id) || [];
        return history.map(t => ({
            version: t.metadata.version,
            updatedAt: t.updatedAt,
            changes: this._compareTemplates(history[history.indexOf(t) - 1], t)
        }));
    }

    /**
     * 恢復到指定版本
     * @param {string} idOrName - 模板ID或名稱
     * @param {string} version - 版本號
     */
    async revertToVersion(idOrName, version) {
        const template = this.get(idOrName);
        if (!template) {
            throw new Error(`模板不存在: ${idOrName}`);
        }

        const history = this.versionHistory.get(template.id) || [];
        const targetVersion = history.find(t => t.metadata.version === version);

        if (!targetVersion) {
            throw new Error(`版本不存在: ${version}`);
        }

        // 創建當前版本的備份
        this._createVersion(template);

        // 恢復到目標版本
        const restoredData = targetVersion.serialize();
        restoredData.id = template.id; // 保持ID不變
        restoredData.updatedAt = new Date().toISOString();

        const restoredTemplate = new Template(restoredData);
        this.templates.set(template.id, restoredTemplate);

        // 持久化
        await this._persistTemplate(restoredTemplate);

        console.log(`[TemplateManager] 模板已恢復到版本 [${template.name}] 版本: ${version}`);
        this.emit('templateReverted', { template: restoredTemplate, targetVersion: version });

        return restoredTemplate;
    }

    /**
     * 導出模板
     * @param {object} options - 選項
     */
    async export(options = {}) {
        const filters = options.filters || {};
        const templates = this.getMany(filters);

        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            templates: templates.map(t => t.serialize()),
            metadata: {
                totalTemplates: templates.length,
                exportedBy: options.userId || 'system',
                ...options.metadata
            }
        };

        if (options.includeDependencies) {
            exportData.dependencyGraph = Object.fromEntries(this.dependencyGraph);
        }

        if (options.includeStats) {
            exportData.stats = this.getStats();
        }

        return exportData;
    }

    /**
     * 導入模板
     * @param {object} data - 導入數據
     * @param {object} options - 選項
     */
    async import(data, options = {}) {
        try {
            if (!data.templates || !Array.isArray(data.templates)) {
                throw new Error('無效的模板導入格式');
            }

            const results = [];
            let importedCount = 0;

            for (const templateData of data.templates) {
                try {
                    // 檢查是否已存在
                    const existingTemplate = this.get(templateData.name);
                    if (existingTemplate && !options.overwrite) {
                        results.push({
                            name: templateData.name,
                            success: false,
                            error: '模板已存在'
                        });
                        continue;
                    }

                    // 創建或更新模板
                    let template;
                    if (existingTemplate && options.overwrite) {
                        template = await this.update(existingTemplate.id, templateData, {
                            reason: '導入覆蓋'
                        });
                    } else {
                        template = await this.create(templateData);
                    }

                    results.push({
                        name: template.name,
                        success: true,
                        templateId: template.id
                    });
                    importedCount++;

                } catch (error) {
                    results.push({
                        name: templateData.name,
                        success: false,
                        error: error.message
                    });
                }
            }

            // 重建依賴圖
            if (this.options.enableDependencyTracking) {
                this._buildDependencyGraph();
            }

            this.emit('templatesImported', {
                totalTemplates: data.templates.length,
                importedCount,
                results
            });

            console.log(`[TemplateManager] 已導入 ${importedCount} 個模板`);
            return { success: true, importedCount, results };

        } catch (error) {
            console.error('[TemplateManager] 導入模板失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        // 更新按類型統計
        this.stats.templatesByType = {};
        for (const template of this.templates.values()) {
            this.stats.templatesByType[template.type] =
                (this.stats.templatesByType[template.type] || 0) + 1;
        }

        this.stats.totalTemplates = this.templates.size;

        return {
            ...this.stats,
            cacheSize: this.compiledCache.size,
            dependencyNodes: this.dependencyGraph.size,
            versionHistorySize: Array.from(this.versionHistory.values())
                .reduce((sum, versions) => sum + versions.length, 0)
        };
    }

    // ========== 私有方法 ==========

    /**
     * 確保模板目錄存在
     */
    async _ensureTemplatesDirectory() {
        try {
            await fs.mkdir(this.options.templatesDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * 初始化類型映射
     */
    _initializeTypeMappings() {
        for (const type of Object.values(TEMPLATE_TYPES)) {
            this.templatesByType.set(type, new Set());
        }

        for (const status of Object.values(TEMPLATE_STATUS)) {
            this.templatesByStatus.set(status, new Set());
        }
    }

    /**
     * 載入模板
     */
    async _loadTemplates() {
        try {
            const configKeys = await this.configManager.keys();
            const templateKeys = configKeys.filter(key => key.startsWith('template_'));

            for (const key of templateKeys) {
                try {
                    const templateData = await this.configManager.get(key);
                    if (templateData) {
                        const template = new Template(templateData);
                        this._storeTemplate(template, false); // 不持久化，因為已經存在
                    }
                } catch (error) {
                    console.warn(`[TemplateManager] 載入模板失敗 [${key}]:`, error);
                }
            }
        } catch (error) {
            console.warn('[TemplateManager] 載入模板失敗:', error);
        }
    }

    /**
     * 存儲模板到內存
     */
    _storeTemplate(template, shouldPersist = true) {
        // 主存儲
        this.templates.set(template.id, template);
        this.templatesByName.set(template.name, template);

        // 類型索引
        const typeSet = this.templatesByType.get(template.type);
        if (typeSet) {
            typeSet.add(template);
        }

        // 狀態索引
        const statusSet = this.templatesByStatus.get(template.status);
        if (statusSet) {
            statusSet.add(template);
        }
    }

    /**
     * 從內存中移除模板
     */
    _removeTemplate(template) {
        // 主存儲
        this.templates.delete(template.id);
        this.templatesByName.delete(template.name);

        // 類型索引
        const typeSet = this.templatesByType.get(template.type);
        if (typeSet) {
            typeSet.delete(template);
        }

        // 狀態索引
        const statusSet = this.templatesByStatus.get(template.status);
        if (statusSet) {
            statusSet.delete(template);
        }

        // 清理緩存
        this.compiledCache.delete(template.id);
        this.versionHistory.delete(template.id);
    }

    /**
     * 持久化模板
     */
    async _persistTemplate(template) {
        if (this.configManager) {
            const configKey = `template_${template.id}`;
            await this.configManager.set(configKey, template.serialize(), {
                source: 'template_manager'
            });
        }
    }

    /**
     * 刪除持久化模板
     */
    async _deletePersistedTemplate(template) {
        if (this.configManager) {
            const configKey = `template_${template.id}`;
            await this.configManager.delete(configKey);
        }
    }

    /**
     * 構建依賴圖
     */
    _buildDependencyGraph() {
        this.dependencyGraph.clear();
        this.reverseDependencyGraph.clear();

        for (const template of this.templates.values()) {
            this._updateDependencyGraph(template);
        }
    }

    /**
     * 更新依賴圖
     */
    _updateDependencyGraph(template) {
        const deps = new Set([
            ...template.dependencies,
            ...template.requiredTemplates
        ]);

        this.dependencyGraph.set(template.id, deps);

        // 更新反向依賴圖
        for (const depId of deps) {
            if (!this.reverseDependencyGraph.has(depId)) {
                this.reverseDependencyGraph.set(depId, new Set());
            }
            this.reverseDependencyGraph.get(depId).add(template.id);
        }
    }

    /**
     * 從依賴圖中移除模板
     */
    _removeFromDependencyGraph(template) {
        const deps = this.dependencyGraph.get(template.id) || new Set();

        // 從反向依賴圖中移除
        for (const depId of deps) {
            const reverseDeps = this.reverseDependencyGraph.get(depId);
            if (reverseDeps) {
                reverseDeps.delete(template.id);
                if (reverseDeps.size === 0) {
                    this.reverseDependencyGraph.delete(depId);
                }
            }
        }

        this.dependencyGraph.delete(template.id);
        this.reverseDependencyGraph.delete(template.id);
    }

    /**
     * 解析模板依賴
     */
    async _resolveDependencies(template, context) {
        const resolvedContext = { ...context };

        // 解析模板依賴
        for (const depTemplateId of template.requiredTemplates) {
            const depTemplate = this.templates.get(depTemplateId);
            if (depTemplate) {
                const depResult = await depTemplate.render(resolvedContext);
                resolvedContext[`_template_${depTemplate.name}`] = depResult;
            }
        }

        // 解析配置依賴
        for (const depConfig of template.dependencies) {
            if (this.configManager && depConfig.startsWith('config:')) {
                const configKey = depConfig.replace('config:', '');
                const configValue = await this.configManager.get(configKey);
                if (configValue !== null) {
                    resolvedContext[`_config_${configKey}`] = configValue;
                }
            }
        }

        return resolvedContext;
    }

    /**
     * 創建模板版本
     */
    _createVersion(template) {
        if (!this.versionHistory.has(template.id)) {
            this.versionHistory.set(template.id, []);
        }

        const versions = this.versionHistory.get(template.id);
        const versionCopy = new Template(template.serialize());

        versions.push(versionCopy);

        // 限制版本數量
        if (versions.length > this.options.maxVersions) {
            versions.shift();
        }
    }

    /**
     * 增量版本號
     */
    _incrementVersion(version) {
        const parts = version.split('.');
        const patch = parseInt(parts[2] || '0') + 1;
        return `${parts[0]}.${parts[1]}.${patch}`;
    }

    /**
     * 比較模板差異
     */
    _compareTemplates(oldTemplate, newTemplate) {
        if (!oldTemplate) return ['初始版本'];

        const changes = [];

        if (oldTemplate.content !== newTemplate.content) {
            changes.push('內容修改');
        }

        if (JSON.stringify(oldTemplate.variables) !== JSON.stringify(newTemplate.variables)) {
            changes.push('變量定義修改');
        }

        if (JSON.stringify(oldTemplate.partials) !== JSON.stringify(newTemplate.partials)) {
            changes.push('部分模板修改');
        }

        return changes.length > 0 ? changes : ['次要修改'];
    }

    /**
     * 檢查權限
     */
    _hasPermission(template, permission) {
        if (!this.options.enablePermissions) {
            return true;
        }

        return template.permissions[permission] === true ||
               this.options.defaultPermissions.includes(permission);
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        if (this.eventBus) {
            this.eventBus.subscribe('config.changed', (event) => {
                // 處理配置變更，可能影響模板
                if (event.key.startsWith('template_')) {
                    this.emit('templateConfigChanged', event);
                }
            });
        }
    }

    /**
     * 清理資源
     */
    async cleanup() {
        try {
            // 清理監控器
            for (const watcher of this.watchers.values()) {
                if (watcher.close) {
                    watcher.close();
                }
            }
            this.watchers.clear();

            // 清理數據
            this.templates.clear();
            this.templatesByName.clear();
            this.templatesByType.clear();
            this.templatesByStatus.clear();
            this.compiledCache.clear();
            this.versionHistory.clear();
            this.dependencyGraph.clear();
            this.reverseDependencyGraph.clear();

            this.initialized = false;
            console.log('[TemplateManager] 清理完成');

        } catch (error) {
            console.error('[TemplateManager] 清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
TemplateManager.TEMPLATE_TYPES = TEMPLATE_TYPES;
TemplateManager.TEMPLATE_STATUS = TEMPLATE_STATUS;
TemplateManager.TEMPLATE_ENGINES = TEMPLATE_ENGINES;
TemplateManager.TEMPLATE_PERMISSIONS = TEMPLATE_PERMISSIONS;
TemplateManager.VARIABLE_TYPES = VARIABLE_TYPES;

module.exports = TemplateManager;