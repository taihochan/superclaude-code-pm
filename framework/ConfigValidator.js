/**
 * ConfigValidator - 配置驗證和JSON Schema支持系統
 *
 * 功能：
 * - JSON Schema配置驗證
 * - 自定義驗證規則和函數
 * - 配置類型檢查和轉換
 * - 驗證錯誤報告和修復建議
 * - 動態Schema生成和管理
 *
 * 用途：確保配置數據的完整性、類型安全和業務邏輯正確性
 * 配合：ConfigManager進行配置驗證和錯誤處理
 */

const { EventEmitter } = require('events');

/**
 * 驗證規則類型
 */
const VALIDATION_TYPES = {
    SCHEMA: 'schema',                  // JSON Schema驗證
    CUSTOM: 'custom',                  // 自定義驗證函數
    REGEX: 'regex',                    // 正則表達式驗證
    ENUM: 'enum',                      // 枚舉值驗證
    RANGE: 'range',                    // 數值範圍驗證
    LENGTH: 'length',                  // 長度驗證
    FORMAT: 'format'                   // 格式驗證
};

/**
 * 驗證嚴格程度
 */
const VALIDATION_LEVELS = {
    STRICT: 'strict',                  // 嚴格模式：任何錯誤都拋出異常
    WARN: 'warn',                      // 警告模式：記錄警告但繼續執行
    LENIENT: 'lenient'                 // 寬鬆模式：只驗證關鍵字段
};

/**
 * 預定義的格式驗證器
 */
const FORMAT_VALIDATORS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/.+/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    date: /^\d{4}-\d{2}-\d{2}$/,
    datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    semver: /^\d+\.\d+\.\d+(-[\w\-\.]+)?(\+[\w\-\.]+)?$/
};

/**
 * 驗證結果類
 */
class ValidationResult {
    constructor(isValid = true) {
        this.isValid = isValid;
        this.errors = [];
        this.warnings = [];
        this.suggestions = [];
        this.metadata = {
            validatedAt: Date.now(),
            validationTime: 0
        };
    }

    /**
     * 添加錯誤
     */
    addError(path, message, code = null, details = {}) {
        this.isValid = false;
        this.errors.push({
            path,
            message,
            code,
            details,
            timestamp: Date.now()
        });
        return this;
    }

    /**
     * 添加警告
     */
    addWarning(path, message, code = null, details = {}) {
        this.warnings.push({
            path,
            message,
            code,
            details,
            timestamp: Date.now()
        });
        return this;
    }

    /**
     * 添加建議
     */
    addSuggestion(path, suggestion, autoFix = null) {
        this.suggestions.push({
            path,
            suggestion,
            autoFix,
            timestamp: Date.now()
        });
        return this;
    }

    /**
     * 獲取錯誤摘要
     */
    getErrorSummary() {
        return {
            totalErrors: this.errors.length,
            totalWarnings: this.warnings.length,
            totalSuggestions: this.suggestions.length,
            isValid: this.isValid,
            errorPaths: this.errors.map(e => e.path),
            warningPaths: this.warnings.map(w => w.path)
        };
    }

    /**
     * 序列化結果
     */
    serialize() {
        return {
            isValid: this.isValid,
            errors: this.errors,
            warnings: this.warnings,
            suggestions: this.suggestions,
            metadata: this.metadata,
            summary: this.getErrorSummary()
        };
    }
}

/**
 * 驗證規則類
 */
class ValidationRule {
    constructor(name, config = {}) {
        this.name = name;
        this.type = config.type || VALIDATION_TYPES.CUSTOM;
        this.required = config.required || false;
        this.description = config.description || '';
        this.enabled = config.enabled !== false;

        // 根據類型設置配置
        switch (this.type) {
            case VALIDATION_TYPES.SCHEMA:
                this.schema = config.schema || {};
                break;

            case VALIDATION_TYPES.CUSTOM:
                this.validator = config.validator;
                break;

            case VALIDATION_TYPES.REGEX:
                this.pattern = new RegExp(config.pattern, config.flags || '');
                break;

            case VALIDATION_TYPES.ENUM:
                this.allowedValues = config.allowedValues || [];
                break;

            case VALIDATION_TYPES.RANGE:
                this.min = config.min;
                this.max = config.max;
                break;

            case VALIDATION_TYPES.LENGTH:
                this.minLength = config.minLength;
                this.maxLength = config.maxLength;
                break;

            case VALIDATION_TYPES.FORMAT:
                this.format = config.format;
                this.customPattern = config.customPattern;
                break;
        }

        this.metadata = {
            createdAt: Date.now(),
            ...config.metadata
        };
    }

    /**
     * 驗證值
     */
    async validate(value, path = '', context = {}) {
        if (!this.enabled) {
            return new ValidationResult(true);
        }

        const result = new ValidationResult();
        const startTime = Date.now();

        try {
            switch (this.type) {
                case VALIDATION_TYPES.SCHEMA:
                    await this._validateSchema(value, path, result, context);
                    break;

                case VALIDATION_TYPES.CUSTOM:
                    await this._validateCustom(value, path, result, context);
                    break;

                case VALIDATION_TYPES.REGEX:
                    this._validateRegex(value, path, result);
                    break;

                case VALIDATION_TYPES.ENUM:
                    this._validateEnum(value, path, result);
                    break;

                case VALIDATION_TYPES.RANGE:
                    this._validateRange(value, path, result);
                    break;

                case VALIDATION_TYPES.LENGTH:
                    this._validateLength(value, path, result);
                    break;

                case VALIDATION_TYPES.FORMAT:
                    this._validateFormat(value, path, result);
                    break;
            }

            result.metadata.validationTime = Date.now() - startTime;
            return result;

        } catch (error) {
            result.addError(path, `驗證規則執行失敗: ${error.message}`, 'RULE_ERROR');
            result.metadata.validationTime = Date.now() - startTime;
            return result;
        }
    }

    // ========== 私有驗證方法 ==========

    /**
     * JSON Schema驗證
     */
    async _validateSchema(value, path, result, context) {
        try {
            // 簡化的JSON Schema驗證實現
            // 實際應用中應該使用專門的JSON Schema庫如ajv
            const errors = this._performSchemaValidation(value, this.schema, path);

            for (const error of errors) {
                result.addError(error.path, error.message, 'SCHEMA_ERROR', error.details);
            }
        } catch (error) {
            result.addError(path, `Schema驗證失敗: ${error.message}`, 'SCHEMA_ERROR');
        }
    }

    /**
     * 執行簡化的Schema驗證
     */
    _performSchemaValidation(value, schema, basePath = '') {
        const errors = [];

        // 類型驗證
        if (schema.type && typeof value !== schema.type) {
            errors.push({
                path: basePath,
                message: `期望類型 ${schema.type}，實際類型 ${typeof value}`,
                details: { expected: schema.type, actual: typeof value }
            });
        }

        // 必需屬性驗證
        if (schema.required && Array.isArray(schema.required)) {
            for (const requiredProp of schema.required) {
                if (value && typeof value === 'object' && !(requiredProp in value)) {
                    errors.push({
                        path: `${basePath}.${requiredProp}`,
                        message: `缺少必需屬性: ${requiredProp}`,
                        details: { property: requiredProp }
                    });
                }
            }
        }

        // 屬性驗證
        if (schema.properties && value && typeof value === 'object') {
            for (const [prop, propSchema] of Object.entries(schema.properties)) {
                if (prop in value) {
                    const propPath = basePath ? `${basePath}.${prop}` : prop;
                    const propErrors = this._performSchemaValidation(value[prop], propSchema, propPath);
                    errors.push(...propErrors);
                }
            }
        }

        // 數組驗證
        if (schema.items && Array.isArray(value)) {
            value.forEach((item, index) => {
                const itemPath = `${basePath}[${index}]`;
                const itemErrors = this._performSchemaValidation(item, schema.items, itemPath);
                errors.push(...itemErrors);
            });
        }

        // 最小/最大值驗證
        if (typeof value === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push({
                    path: basePath,
                    message: `值 ${value} 小於最小值 ${schema.minimum}`,
                    details: { value, minimum: schema.minimum }
                });
            }

            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push({
                    path: basePath,
                    message: `值 ${value} 大於最大值 ${schema.maximum}`,
                    details: { value, maximum: schema.maximum }
                });
            }
        }

        // 字符串長度驗證
        if (typeof value === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push({
                    path: basePath,
                    message: `字符串長度 ${value.length} 小於最小長度 ${schema.minLength}`,
                    details: { length: value.length, minLength: schema.minLength }
                });
            }

            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push({
                    path: basePath,
                    message: `字符串長度 ${value.length} 大於最大長度 ${schema.maxLength}`,
                    details: { length: value.length, maxLength: schema.maxLength }
                });
            }

            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push({
                    path: basePath,
                    message: `字符串不符合模式: ${schema.pattern}`,
                    details: { value, pattern: schema.pattern }
                });
            }
        }

        // 枚舉值驗證
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
                path: basePath,
                message: `值必須是以下之一: ${schema.enum.join(', ')}`,
                details: { value, allowedValues: schema.enum }
            });
        }

        return errors;
    }

    /**
     * 自定義函數驗證
     */
    async _validateCustom(value, path, result, context) {
        if (typeof this.validator !== 'function') {
            result.addError(path, '自定義驗證器不是函數', 'VALIDATOR_ERROR');
            return;
        }

        try {
            const validationResult = await this.validator(value, path, context);

            if (validationResult === false) {
                result.addError(path, '自定義驗證失敗', 'CUSTOM_ERROR');
            } else if (typeof validationResult === 'string') {
                result.addError(path, validationResult, 'CUSTOM_ERROR');
            } else if (validationResult && typeof validationResult === 'object') {
                if (validationResult.valid === false) {
                    result.addError(path, validationResult.message || '自定義驗證失敗', 'CUSTOM_ERROR', validationResult.details);
                }
                if (validationResult.warnings) {
                    for (const warning of validationResult.warnings) {
                        result.addWarning(path, warning, 'CUSTOM_WARNING');
                    }
                }
                if (validationResult.suggestions) {
                    for (const suggestion of validationResult.suggestions) {
                        result.addSuggestion(path, suggestion.message, suggestion.autoFix);
                    }
                }
            }
        } catch (error) {
            result.addError(path, `自定義驗證器執行失敗: ${error.message}`, 'VALIDATOR_ERROR');
        }
    }

    /**
     * 正則表達式驗證
     */
    _validateRegex(value, path, result) {
        if (typeof value !== 'string') {
            result.addError(path, '正則表達式驗證只適用於字符串', 'TYPE_ERROR');
            return;
        }

        if (!this.pattern.test(value)) {
            result.addError(path, `值不符合正則表達式模式: ${this.pattern}`, 'PATTERN_ERROR');
        }
    }

    /**
     * 枚舉值驗證
     */
    _validateEnum(value, path, result) {
        if (!this.allowedValues.includes(value)) {
            result.addError(path, `值必須是以下之一: ${this.allowedValues.join(', ')}`, 'ENUM_ERROR');
            result.addSuggestion(path, `建議值: ${this.allowedValues[0]}`, { value: this.allowedValues[0] });
        }
    }

    /**
     * 範圍驗證
     */
    _validateRange(value, path, result) {
        const numValue = Number(value);

        if (isNaN(numValue)) {
            result.addError(path, '範圍驗證需要數值', 'TYPE_ERROR');
            return;
        }

        if (this.min !== undefined && numValue < this.min) {
            result.addError(path, `值 ${numValue} 小於最小值 ${this.min}`, 'RANGE_ERROR');
            result.addSuggestion(path, `建議設置為 ${this.min}`, { value: this.min });
        }

        if (this.max !== undefined && numValue > this.max) {
            result.addError(path, `值 ${numValue} 大於最大值 ${this.max}`, 'RANGE_ERROR');
            result.addSuggestion(path, `建議設置為 ${this.max}`, { value: this.max });
        }
    }

    /**
     * 長度驗證
     */
    _validateLength(value, path, result) {
        let length;

        if (typeof value === 'string' || Array.isArray(value)) {
            length = value.length;
        } else if (value && typeof value === 'object') {
            length = Object.keys(value).length;
        } else {
            result.addError(path, '長度驗證不適用於此類型', 'TYPE_ERROR');
            return;
        }

        if (this.minLength !== undefined && length < this.minLength) {
            result.addError(path, `長度 ${length} 小於最小長度 ${this.minLength}`, 'LENGTH_ERROR');
        }

        if (this.maxLength !== undefined && length > this.maxLength) {
            result.addError(path, `長度 ${length} 大於最大長度 ${this.maxLength}`, 'LENGTH_ERROR');
        }
    }

    /**
     * 格式驗證
     */
    _validateFormat(value, path, result) {
        if (typeof value !== 'string') {
            result.addError(path, '格式驗證只適用於字符串', 'TYPE_ERROR');
            return;
        }

        let pattern = this.customPattern;

        if (!pattern && FORMAT_VALIDATORS[this.format]) {
            pattern = FORMAT_VALIDATORS[this.format];
        }

        if (!pattern) {
            result.addError(path, `未知的格式: ${this.format}`, 'FORMAT_ERROR');
            return;
        }

        if (!pattern.test(value)) {
            result.addError(path, `值不符合 ${this.format} 格式`, 'FORMAT_ERROR');

            // 提供修復建議
            switch (this.format) {
                case 'email':
                    result.addSuggestion(path, '郵件格式應該是: user@domain.com');
                    break;
                case 'url':
                    result.addSuggestion(path, 'URL格式應該是: https://example.com');
                    break;
                case 'date':
                    result.addSuggestion(path, '日期格式應該是: YYYY-MM-DD');
                    break;
            }
        }
    }
}

/**
 * Schema管理器
 */
class SchemaManager {
    constructor() {
        this.schemas = new Map(); // name -> schema
        this.compiled = new Map(); // name -> compiled schema
    }

    /**
     * 註冊Schema
     */
    register(name, schema) {
        this.schemas.set(name, schema);
        this.compiled.delete(name); // 清除編譯緩存
        return this;
    }

    /**
     * 獲取Schema
     */
    get(name) {
        return this.schemas.get(name);
    }

    /**
     * 編譯Schema
     */
    compile(name) {
        if (this.compiled.has(name)) {
            return this.compiled.get(name);
        }

        const schema = this.schemas.get(name);
        if (!schema) {
            throw new Error(`Schema不存在: ${name}`);
        }

        // 這裡應該使用專業的JSON Schema編譯器
        // 暫時返回原始schema
        const compiled = schema;
        this.compiled.set(name, compiled);

        return compiled;
    }

    /**
     * 生成Schema
     */
    generateFromData(data, options = {}) {
        return this._inferSchema(data, options);
    }

    /**
     * 推斷Schema結構
     */
    _inferSchema(data, options = {}) {
        const schema = {
            type: this._inferType(data),
            ...options.baseSchema
        };

        switch (schema.type) {
            case 'object':
                schema.properties = {};
                schema.required = [];

                for (const [key, value] of Object.entries(data)) {
                    schema.properties[key] = this._inferSchema(value, options);

                    if (options.markAllRequired || (value !== null && value !== undefined)) {
                        schema.required.push(key);
                    }
                }
                break;

            case 'array':
                if (data.length > 0) {
                    schema.items = this._inferSchema(data[0], options);
                }
                break;

            case 'string':
                if (options.inferFormats) {
                    const format = this._inferStringFormat(data);
                    if (format) {
                        schema.format = format;
                    }
                }
                break;

            case 'number':
                if (Number.isInteger(data)) {
                    schema.type = 'integer';
                }
                break;
        }

        return schema;
    }

    /**
     * 推斷數據類型
     */
    _inferType(data) {
        if (data === null) return 'null';
        if (Array.isArray(data)) return 'array';
        return typeof data;
    }

    /**
     * 推斷字符串格式
     */
    _inferStringFormat(str) {
        for (const [format, pattern] of Object.entries(FORMAT_VALIDATORS)) {
            if (pattern.test(str)) {
                return format;
            }
        }
        return null;
    }
}

/**
 * 主配置驗證器
 */
class ConfigValidator extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 驗證配置
            defaultLevel: options.defaultLevel || VALIDATION_LEVELS.WARN,
            stopOnFirstError: options.stopOnFirstError || false,
            enableSuggestions: options.enableSuggestions !== false,
            enableWarnings: options.enableWarnings !== false,

            // 性能配置
            maxValidationTime: options.maxValidationTime || 5000, // 5秒
            cacheResults: options.cacheResults !== false,
            cacheSize: options.cacheSize || 1000,

            // Schema配置
            enableSchemaInference: options.enableSchemaInference !== false,
            autoRegisterSchemas: options.autoRegisterSchemas !== false,

            ...options
        };

        // 組件
        this.schemaManager = new SchemaManager();
        this.validationRules = new Map(); // path -> ValidationRule[]
        this.globalRules = []; // 全局驗證規則

        // 緩存
        this.resultCache = new Map(); // hash -> ValidationResult
        this.schemaCache = new Map(); // data -> schema

        // 統計信息
        this.stats = {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            averageValidationTime: 0,
            cacheHitRate: 0
        };

        // 初始化預設規則
        this._initializeDefaultRules();
    }

    /**
     * 驗證配置
     * @param {*} data - 要驗證的數據
     * @param {string|object} schema - Schema名稱或Schema對象
     * @param {object} options - 驗證選項
     */
    async validate(data, schema = null, options = {}) {
        const startTime = Date.now();
        const validationId = this._generateValidationId();

        try {
            const opts = {
                ...this.options,
                ...options,
                level: options.level || this.options.defaultLevel
            };

            // 檢查緩存
            if (opts.cacheResults && !opts.skipCache) {
                const cacheKey = this._generateCacheKey(data, schema, opts);
                const cachedResult = this.resultCache.get(cacheKey);

                if (cachedResult) {
                    this.stats.cacheHitRate = (this.stats.cacheHitRate * this.stats.totalValidations + 1) / (this.stats.totalValidations + 1);
                    return cachedResult;
                }
            }

            const result = new ValidationResult();

            // 獲取或推斷Schema
            let validationSchema = null;
            if (typeof schema === 'string') {
                validationSchema = this.schemaManager.get(schema);
            } else if (schema && typeof schema === 'object') {
                validationSchema = schema;
            } else if (this.options.enableSchemaInference) {
                validationSchema = this._getInferredSchema(data, opts);
            }

            // Schema驗證
            if (validationSchema) {
                await this._validateWithSchema(data, validationSchema, result, opts);
            }

            // 路徑特定驗證規則
            await this._validateWithPathRules(data, result, opts);

            // 全局驗證規則
            await this._validateWithGlobalRules(data, result, opts);

            // 自定義驗證邏輯
            if (opts.customValidators) {
                await this._validateWithCustomValidators(data, opts.customValidators, result, opts);
            }

            // 更新統計
            const validationTime = Date.now() - startTime;
            this._updateStats(result.isValid, validationTime);

            // 緩存結果
            if (opts.cacheResults) {
                const cacheKey = this._generateCacheKey(data, schema, opts);
                this._cacheResult(cacheKey, result);
            }

            result.metadata.validationTime = validationTime;
            result.metadata.validationId = validationId;

            // 發送事件
            this.emit('validationCompleted', {
                validationId,
                isValid: result.isValid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                validationTime
            });

            return result;

        } catch (error) {
            this.stats.failedValidations++;

            const result = new ValidationResult(false);
            result.addError('', `驗證過程失敗: ${error.message}`, 'VALIDATION_ERROR');
            result.metadata.validationTime = Date.now() - startTime;
            result.metadata.validationId = validationId;

            this.emit('validationError', { validationId, error });
            return result;
        }
    }

    /**
     * 添加驗證規則
     * @param {string} path - 配置路徑（支援萬用字符）
     * @param {ValidationRule|object} rule - 驗證規則
     */
    addRule(path, rule) {
        const validationRule = rule instanceof ValidationRule
            ? rule
            : new ValidationRule(`rule_${Date.now()}`, rule);

        if (path === '*' || path === '') {
            this.globalRules.push(validationRule);
        } else {
            if (!this.validationRules.has(path)) {
                this.validationRules.set(path, []);
            }
            this.validationRules.get(path).push(validationRule);
        }

        this.emit('ruleAdded', { path, rule: validationRule });
        return this;
    }

    /**
     * 移除驗證規則
     * @param {string} path - 配置路徑
     * @param {string} ruleName - 規則名稱
     */
    removeRule(path, ruleName = null) {
        if (path === '*' || path === '') {
            if (ruleName) {
                this.globalRules = this.globalRules.filter(rule => rule.name !== ruleName);
            } else {
                this.globalRules = [];
            }
        } else {
            const rules = this.validationRules.get(path);
            if (rules) {
                if (ruleName) {
                    const filtered = rules.filter(rule => rule.name !== ruleName);
                    this.validationRules.set(path, filtered);
                } else {
                    this.validationRules.delete(path);
                }
            }
        }

        this.emit('ruleRemoved', { path, ruleName });
        return this;
    }

    /**
     * 註冊Schema
     * @param {string} name - Schema名稱
     * @param {object} schema - JSON Schema
     */
    registerSchema(name, schema) {
        this.schemaManager.register(name, schema);
        this.emit('schemaRegistered', { name, schema });
        return this;
    }

    /**
     * 生成Schema
     * @param {*} data - 樣本數據
     * @param {object} options - 生成選項
     */
    generateSchema(data, options = {}) {
        return this.schemaManager.generateFromData(data, options);
    }

    /**
     * 批量驗證
     * @param {Array} items - 要驗證的項目 [{ data, schema, options }]
     */
    async validateBatch(items) {
        const results = [];

        // 並行驗證
        const promises = items.map(async (item, index) => {
            try {
                const result = await this.validate(item.data, item.schema, item.options);
                return { index, success: true, result };
            } catch (error) {
                return { index, success: false, error: error.message };
            }
        });

        const responses = await Promise.all(promises);

        // 整理結果
        for (const response of responses) {
            results[response.index] = response.success
                ? response.result
                : new ValidationResult(false).addError('', response.error, 'BATCH_ERROR');
        }

        const summary = {
            total: items.length,
            successful: results.filter(r => r.isValid).length,
            failed: results.filter(r => !r.isValid).length,
            results
        };

        this.emit('batchValidationCompleted', summary);
        return summary;
    }

    /**
     * 獲取驗證統計
     */
    getStats() {
        return {
            ...this.stats,
            totalRules: this.globalRules.length + Array.from(this.validationRules.values()).reduce((sum, rules) => sum + rules.length, 0),
            registeredSchemas: this.schemaManager.schemas.size,
            cacheSize: this.resultCache.size
        };
    }

    /**
     * 清理緩存
     */
    clearCache() {
        this.resultCache.clear();
        this.schemaCache.clear();
        this.emit('cacheCleared');
    }

    // ========== 私有方法 ==========

    /**
     * 初始化預設驗證規則
     */
    _initializeDefaultRules() {
        // 通用類型驗證
        this.addRule('*', {
            name: 'no_undefined',
            type: VALIDATION_TYPES.CUSTOM,
            validator: (value, path) => {
                if (value === undefined) {
                    return { valid: false, message: '配置值不能為undefined' };
                }
                return true;
            }
        });

        // 數字類型驗證
        this.addRule('*.port', {
            name: 'valid_port',
            type: VALIDATION_TYPES.RANGE,
            min: 1,
            max: 65535
        });

        // 郵件格式驗證
        this.addRule('*.email', {
            name: 'valid_email',
            type: VALIDATION_TYPES.FORMAT,
            format: 'email'
        });

        // URL格式驗證
        this.addRule('*.url', {
            name: 'valid_url',
            type: VALIDATION_TYPES.FORMAT,
            format: 'url'
        });
    }

    /**
     * 使用Schema驗證
     */
    async _validateWithSchema(data, schema, result, options) {
        const schemaRule = new ValidationRule('schema_validation', {
            type: VALIDATION_TYPES.SCHEMA,
            schema
        });

        const schemaResult = await schemaRule.validate(data, '', { options });
        this._mergeResults(result, schemaResult);
    }

    /**
     * 使用路徑規則驗證
     */
    async _validateWithPathRules(data, result, options) {
        for (const [path, rules] of this.validationRules) {
            const matchingPaths = this._findMatchingPaths(data, path);

            for (const matchingPath of matchingPaths) {
                const value = this._getValueByPath(data, matchingPath);

                for (const rule of rules) {
                    if (options.stopOnFirstError && !result.isValid) break;

                    const ruleResult = await rule.validate(value, matchingPath, { data, options });
                    this._mergeResults(result, ruleResult);
                }
            }
        }
    }

    /**
     * 使用全局規則驗證
     */
    async _validateWithGlobalRules(data, result, options) {
        for (const rule of this.globalRules) {
            if (options.stopOnFirstError && !result.isValid) break;

            const ruleResult = await rule.validate(data, '', { data, options });
            this._mergeResults(result, ruleResult);
        }
    }

    /**
     * 使用自定義驗證器驗證
     */
    async _validateWithCustomValidators(data, validators, result, options) {
        for (const validator of validators) {
            try {
                const validatorResult = await validator(data, options);

                if (validatorResult === false) {
                    result.addError('', '自定義驗證失敗', 'CUSTOM_ERROR');
                } else if (typeof validatorResult === 'string') {
                    result.addError('', validatorResult, 'CUSTOM_ERROR');
                } else if (validatorResult && typeof validatorResult === 'object') {
                    this._mergeResults(result, validatorResult);
                }
            } catch (error) {
                result.addError('', `自定義驗證器執行失敗: ${error.message}`, 'VALIDATOR_ERROR');
            }
        }
    }

    /**
     * 獲取推斷的Schema
     */
    _getInferredSchema(data, options) {
        const cacheKey = this._generateDataHash(data);

        if (this.schemaCache.has(cacheKey)) {
            return this.schemaCache.get(cacheKey);
        }

        const schema = this.schemaManager.generateFromData(data, {
            inferFormats: true,
            markAllRequired: false,
            ...options.schemaOptions
        });

        this.schemaCache.set(cacheKey, schema);
        return schema;
    }

    /**
     * 查找匹配路徑
     */
    _findMatchingPaths(data, pattern) {
        const paths = [];
        this._traverseObject(data, '', (path, value) => {
            if (this._matchPattern(path, pattern)) {
                paths.push(path);
            }
        });
        return paths;
    }

    /**
     * 遍歷對象
     */
    _traverseObject(obj, basePath, callback) {
        if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = basePath ? `${basePath}.${key}` : key;
                callback(currentPath, value);

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    this._traverseObject(value, currentPath, callback);
                }
            }
        } else {
            callback(basePath, obj);
        }
    }

    /**
     * 模式匹配
     */
    _matchPattern(path, pattern) {
        // 簡單的萬用字符匹配
        if (pattern === '*') return true;
        if (pattern === path) return true;

        if (pattern.includes('*')) {
            const regex = new RegExp(
                pattern.replace(/\*/g, '.*').replace(/\./g, '\\.')
            );
            return regex.test(path);
        }

        return false;
    }

    /**
     * 根據路徑獲取值
     */
    _getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : undefined;
        }, obj);
    }

    /**
     * 合併驗證結果
     */
    _mergeResults(target, source) {
        target.errors.push(...source.errors);
        target.warnings.push(...source.warnings);
        target.suggestions.push(...source.suggestions);

        if (!source.isValid) {
            target.isValid = false;
        }
    }

    /**
     * 更新統計信息
     */
    _updateStats(isValid, validationTime) {
        this.stats.totalValidations++;

        if (isValid) {
            this.stats.successfulValidations++;
        } else {
            this.stats.failedValidations++;
        }

        this.stats.averageValidationTime = (
            this.stats.averageValidationTime * (this.stats.totalValidations - 1) + validationTime
        ) / this.stats.totalValidations;
    }

    /**
     * 生成緩存鍵
     */
    _generateCacheKey(data, schema, options) {
        const dataHash = this._generateDataHash(data);
        const schemaHash = this._generateDataHash(schema);
        const optionsHash = this._generateDataHash(options);

        return `${dataHash}_${schemaHash}_${optionsHash}`;
    }

    /**
     * 緩存結果
     */
    _cacheResult(key, result) {
        // 實現LRU緩存策略
        if (this.resultCache.size >= this.options.cacheSize) {
            const firstKey = this.resultCache.keys().next().value;
            this.resultCache.delete(firstKey);
        }

        this.resultCache.set(key, result);
    }

    /**
     * 生成數據哈希
     */
    _generateDataHash(data) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').substring(0, 8);
    }

    /**
     * 生成驗證ID
     */
    _generateValidationId() {
        return `val_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// 導出常數
ConfigValidator.VALIDATION_TYPES = VALIDATION_TYPES;
ConfigValidator.VALIDATION_LEVELS = VALIDATION_LEVELS;
ConfigValidator.FORMAT_VALIDATORS = FORMAT_VALIDATORS;

module.exports = ConfigValidator;