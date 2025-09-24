/**
 * EnvironmentManager - 多環境配置管理系統
 *
 * 功能：
 * - 多環境配置管理（開發、測試、生產）
 * - 動態環境切換和熱重載
 * - 環境變量解析和注入
 * - 環境特定配置覆蓋機制
 * - 敏感數據加密和安全管理
 *
 * 用途：統一管理不同環境下的配置差異
 * 配合：ConfigManager進行環境配置的存儲和同步
 */

import { EventEmitter } from 'events';
import fs from 'fs'.promises;
import path from 'path';
import crypto from 'crypto';

import ConfigManager from './ConfigManager';
import EventBus from './EventBus';

/**
 * 環境類型
 */
const ENVIRONMENT_TYPES = {
    DEVELOPMENT: 'development',         // 開發環境
    TESTING: 'testing',                // 測試環境
    STAGING: 'staging',                // 預發布環境
    PRODUCTION: 'production',          // 生產環境
    LOCAL: 'local',                    // 本地環境
    PREVIEW: 'preview'                 // 預覽環境
};

/**
 * 配置優先級
 */
const CONFIG_PRIORITY = {
    RUNTIME: 6,                        // 運行時配置（最高）
    ENVIRONMENT_SPECIFIC: 5,           // 環境特定配置
    ENVIRONMENT_VARIABLES: 4,          // 環境變量
    LOCAL_CONFIG: 3,                   // 本地配置文件
    SHARED_CONFIG: 2,                  // 共享配置
    DEFAULT: 1                         // 預設配置（最低）
};

/**
 * 變量類型
 */
const VARIABLE_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    JSON: 'json',
    SECRET: 'secret',                  // 敏感數據
    FILE_PATH: 'file_path',
    URL: 'url',
    EMAIL: 'email'
};

/**
 * 加密方式
 */
const ENCRYPTION_METHODS = {
    AES256: 'aes-256-gcm',
    AES128: 'aes-128-gcm'
};

/**
 * 環境配置項目
 */
class EnvironmentConfig {
    constructor(environment, data = {}) {
        this.environment = environment;
        this.configs = new Map(); // key -> { value, type, priority, encrypted, metadata }
        this.metadata = {
            name: data.name || environment,
            description: data.description || '',
            version: data.version || '1.0.0',
            extends: data.extends || [], // 繼承的環境
            ...data.metadata
        };

        this.secrets = new Map(); // 敏感數據存儲
        this.loadedAt = Date.now();
        this.lastModified = Date.now();

        // 載入初始配置
        if (data.configs) {
            this._loadConfigs(data.configs);
        }
    }

    /**
     * 載入配置數據
     */
    _loadConfigs(configsData) {
        for (const [key, configItem] of Object.entries(configsData)) {
            this.set(key, configItem.value, {
                type: configItem.type,
                priority: configItem.priority,
                encrypted: configItem.encrypted,
                metadata: configItem.metadata
            });
        }
    }

    /**
     * 設置配置值
     */
    set(key, value, options = {}) {
        const configItem = {
            value,
            type: options.type || VARIABLE_TYPES.STRING,
            priority: options.priority || CONFIG_PRIORITY.ENVIRONMENT_SPECIFIC,
            encrypted: options.encrypted || false,
            metadata: {
                setAt: Date.now(),
                source: options.source || 'manual',
                ...options.metadata
            }
        };

        this.configs.set(key, configItem);
        this.lastModified = Date.now();

        return configItem;
    }

    /**
     * 獲取配置值
     */
    get(key, defaultValue = null) {
        const configItem = this.configs.get(key);
        if (!configItem) {
            return defaultValue;
        }

        return configItem.value;
    }

    /**
     * 檢查配置是否存在
     */
    has(key) {
        return this.configs.has(key);
    }

    /**
     * 獲取所有配置
     */
    getAll(includeMetadata = false) {
        const result = {};

        for (const [key, configItem] of this.configs) {
            if (includeMetadata) {
                result[key] = configItem;
            } else {
                result[key] = configItem.value;
            }
        }

        return result;
    }

    /**
     * 刪除配置
     */
    delete(key) {
        const existed = this.configs.has(key);
        this.configs.delete(key);

        if (existed) {
            this.lastModified = Date.now();
        }

        return existed;
    }

    /**
     * 合並其他環境配置
     */
    merge(otherConfig, options = {}) {
        for (const [key, configItem] of otherConfig.configs) {
            const existingItem = this.configs.get(key);

            // 根據優先級決定是否覆蓋
            if (!existingItem ||
                configItem.priority > existingItem.priority ||
                options.force) {

                this.configs.set(key, {
                    ...configItem,
                    metadata: {
                        ...configItem.metadata,
                        mergedFrom: otherConfig.environment,
                        mergedAt: Date.now()
                    }
                });
            }
        }

        this.lastModified = Date.now();
        return this;
    }

    /**
     * 序列化配置
     */
    serialize(includeSecrets = false) {
        const configs = {};

        for (const [key, configItem] of this.configs) {
            if (configItem.type === VARIABLE_TYPES.SECRET && !includeSecrets) {
                configs[key] = {
                    ...configItem,
                    value: '***HIDDEN***'
                };
            } else {
                configs[key] = configItem;
            }
        }

        return {
            environment: this.environment,
            metadata: this.metadata,
            configs,
            loadedAt: this.loadedAt,
            lastModified: this.lastModified
        };
    }

    /**
     * 克隆配置
     */
    clone(newEnvironment = null) {
        const serialized = this.serialize(true);
        serialized.environment = newEnvironment || `${this.environment}_copy`;

        return new EnvironmentConfig(serialized.environment, serialized);
    }

    /**
     * 驗證配置
     */
    validate() {
        const errors = [];

        for (const [key, configItem] of this.configs) {
            try {
                this._validateConfigItem(key, configItem);
            } catch (error) {
                errors.push({ key, error: error.message });
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 驗證單個配置項目
     */
    _validateConfigItem(key, configItem) {
        const { value, type } = configItem;

        switch (type) {
            case VARIABLE_TYPES.NUMBER:
                if (isNaN(Number(value))) {
                    throw new Error(`值必須是數字: ${key}`);
                }
                break;

            case VARIABLE_TYPES.BOOLEAN:
                if (typeof value !== 'boolean' &&
                    !['true', 'false', '0', '1'].includes(String(value).toLowerCase())) {
                    throw new Error(`值必須是布爾型: ${key}`);
                }
                break;

            case VARIABLE_TYPES.JSON:
                try {
                    JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
                } catch (error) {
                    throw new Error(`值必須是有效的JSON: ${key}`);
                }
                break;

            case VARIABLE_TYPES.URL:
                try {
                    new URL(value);
                } catch (error) {
                    throw new Error(`值必須是有效的URL: ${key}`);
                }
                break;

            case VARIABLE_TYPES.EMAIL:
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    throw new Error(`值必須是有效的郵件地址: ${key}`);
                }
                break;

            case VARIABLE_TYPES.FILE_PATH:
                if (typeof value !== 'string' || value.trim() === '') {
                    throw new Error(`值必須是有效的檔案路徑: ${key}`);
                }
                break;
        }
    }
}

/**
 * 環境變量解析器
 */
class EnvironmentVariableResolver {
    constructor(options = {}) {
        this.options = {
            enableInterpolation: options.enableInterpolation !== false,
            interpolationPattern: options.interpolationPattern || /\$\{([^}]+)\}/g,
            enableProcessEnv: options.enableProcessEnv !== false,
            enableDotNotation: options.enableDotNotation !== false,
            ...options
        };
    }

    /**
     * 解析環境變量
     */
    resolve(value, context = {}) {
        if (typeof value !== 'string') {
            return value;
        }

        let resolved = value;

        // 變量插值
        if (this.options.enableInterpolation) {
            resolved = this._resolveInterpolation(resolved, context);
        }

        // 類型轉換
        return this._convertType(resolved);
    }

    /**
     * 解析變量插值
     */
    _resolveInterpolation(value, context) {
        return value.replace(this.options.interpolationPattern, (match, expression) => {
            try {
                return this._evaluateExpression(expression.trim(), context);
            } catch (error) {
                console.warn(`[EnvironmentVariableResolver] 無法解析表達式: ${expression}`, error);
                return match; // 保持原值
            }
        });
    }

    /**
     * 評估表達式
     */
    _evaluateExpression(expression, context) {
        // 處理點符號
        if (this.options.enableDotNotation && expression.includes('.')) {
            return this._getNestedValue(context, expression);
        }

        // 處理 process.env
        if (this.options.enableProcessEnv && expression.startsWith('process.env.')) {
            const envKey = expression.replace('process.env.', '');
            return process.env[envKey] || '';
        }

        // 處理上下文變量
        if (context.hasOwnProperty(expression)) {
            return context[expression];
        }

        // 處理環境變量
        if (process.env.hasOwnProperty(expression)) {
            return process.env[expression];
        }

        throw new Error(`未找到變量: ${expression}`);
    }

    /**
     * 獲取嵌套值
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            if (current && typeof current === 'object') {
                return current[key];
            }
            return undefined;
        }, obj);
    }

    /**
     * 類型轉換
     */
    _convertType(value) {
        if (typeof value !== 'string') {
            return value;
        }

        // 布爾值
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;

        // 數字
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }

        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }

        // JSON
        if ((value.startsWith('{') && value.endsWith('}')) ||
            (value.startsWith('[') && value.endsWith(']'))) {
            try {
                return JSON.parse(value);
            } catch (error) {
                // 如果解析失敗，返回原字符串
            }
        }

        return value;
    }
}

/**
 * 加密工具
 */
class EncryptionUtil {
    constructor(options = {}) {
        this.algorithm = options.algorithm || ENCRYPTION_METHODS.AES256;
        this.key = options.key || this._generateKey();
        this.iv = options.iv || null;
    }

    /**
     * 加密數據
     */
    encrypt(plaintext) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.algorithm, this.key);
            cipher.setAAD(Buffer.alloc(0));

            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            throw new Error(`加密失敗: ${error.message}`);
        }
    }

    /**
     * 解密數據
     */
    decrypt(encryptedData) {
        try {
            const { encrypted, iv, authTag } = encryptedData;

            const decipher = crypto.createDecipher(this.algorithm, this.key);
            decipher.setAAD(Buffer.alloc(0));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`解密失敗: ${error.message}`);
        }
    }

    /**
     * 生成加密金鑰
     */
    _generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }
}

/**
 * 主環境管理器
 */
class EnvironmentManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 基礎配置
            configManager: options.configManager || null,
            eventBus: options.eventBus || null,
            environmentsDir: options.environmentsDir || path.join(process.cwd(), '.claude', 'environments'),

            // 當前環境
            defaultEnvironment: options.defaultEnvironment || ENVIRONMENT_TYPES.DEVELOPMENT,
            currentEnvironment: options.currentEnvironment || null,

            // 載入配置
            autoLoad: options.autoLoad !== false,
            watchChanges: options.watchChanges !== false,

            // 變量解析
            enableVariableResolution: options.enableVariableResolution !== false,
            resolverOptions: options.resolverOptions || {},

            // 加密配置
            enableEncryption: options.enableEncryption || false,
            encryptionOptions: options.encryptionOptions || {},

            // 環境繼承
            enableInheritance: options.enableInheritance !== false,
            maxInheritanceDepth: options.maxInheritanceDepth || 5,

            // 驗證配置
            enableValidation: options.enableValidation !== false,
            strictMode: options.strictMode || false,

            ...options
        };

        // 核心組件
        this.configManager = this.options.configManager;
        this.eventBus = this.options.eventBus;

        // 環境配置存儲
        this.environments = new Map(); // environment -> EnvironmentConfig
        this.mergedConfig = null; // 當前合併後的配置

        // 工具實例
        this.variableResolver = new EnvironmentVariableResolver(this.options.resolverOptions);
        this.encryptionUtil = this.options.enableEncryption
            ? new EncryptionUtil(this.options.encryptionOptions)
            : null;

        // 當前環境
        this.currentEnvironment = this.options.currentEnvironment || this.options.defaultEnvironment;

        // 監控器
        this.watchers = new Map();

        // 統計信息
        this.stats = {
            environmentsLoaded: 0,
            configsResolved: 0,
            encryptedSecrets: 0,
            variableInterpolations: 0
        };

        // 初始化標記
        this.initialized = false;
    }

    /**
     * 初始化環境管理器
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 確保環境目錄存在
            await this._ensureEnvironmentsDirectory();

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

            // 自動載入環境配置
            if (this.options.autoLoad) {
                await this._loadAllEnvironments();
            }

            // 設置當前環境
            await this._setupCurrentEnvironment();

            // 設置檔案監控
            if (this.options.watchChanges) {
                await this._setupFileWatching();
            }

            // 設置事件處理
            this._setupEventHandlers();

            this.initialized = true;
            console.log(`[EnvironmentManager] 已初始化 - 當前環境: ${this.currentEnvironment}`);
            this.emit('initialized', {
                currentEnvironment: this.currentEnvironment,
                environmentsCount: this.environments.size
            });

        } catch (error) {
            console.error('[EnvironmentManager] 初始化失敗:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 切換環境
     * @param {string} environment - 目標環境
     * @param {object} options - 選項
     */
    async switchEnvironment(environment, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            if (!Object.values(ENVIRONMENT_TYPES).includes(environment)) {
                throw new Error(`無效的環境類型: ${environment}`);
            }

            const oldEnvironment = this.currentEnvironment;

            // 載入環境配置（如果尚未載入）
            if (!this.environments.has(environment)) {
                await this._loadEnvironment(environment);
            }

            // 切換環境
            this.currentEnvironment = environment;

            // 重新構建合併配置
            await this._buildMergedConfig();

            // 持久化環境設置
            if (options.persist !== false) {
                await this._persistCurrentEnvironment();
            }

            // 發布事件
            await this.eventBus.publish('environment.switched', {
                oldEnvironment,
                newEnvironment: environment,
                configCount: this.mergedConfig ? this.mergedConfig.configs.size : 0
            });

            console.log(`[EnvironmentManager] 已切換環境: ${oldEnvironment} → ${environment}`);
            this.emit('environmentSwitched', {
                oldEnvironment,
                newEnvironment: environment,
                mergedConfig: this.mergedConfig
            });

            return this.mergedConfig;

        } catch (error) {
            console.error(`[EnvironmentManager] 切換環境失敗 [${environment}]:`, error);
            throw error;
        }
    }

    /**
     * 獲取配置值
     * @param {string} key - 配置鍵
     * @param {*} defaultValue - 預設值
     * @param {object} options - 選項
     */
    async get(key, defaultValue = null, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // 從合併配置中獲取
            if (this.mergedConfig && this.mergedConfig.has(key)) {
                let value = this.mergedConfig.get(key);

                // 變量解析
                if (this.options.enableVariableResolution && !options.raw) {
                    const context = this._buildVariableContext();
                    value = this.variableResolver.resolve(value, context);
                    this.stats.variableInterpolations++;
                }

                return value;
            }

            return defaultValue;

        } catch (error) {
            console.error(`[EnvironmentManager] 獲取配置失敗 [${key}]:`, error);
            return defaultValue;
        }
    }

    /**
     * 設置配置值
     * @param {string} key - 配置鍵
     * @param {*} value - 配置值
     * @param {object} options - 選項
     */
    async set(key, value, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const environment = options.environment || this.currentEnvironment;
            const configItem = {
                type: options.type || VARIABLE_TYPES.STRING,
                priority: options.priority || CONFIG_PRIORITY.RUNTIME,
                encrypted: options.encrypted || false,
                source: 'runtime'
            };

            // 獲取或創建環境配置
            let envConfig = this.environments.get(environment);
            if (!envConfig) {
                envConfig = new EnvironmentConfig(environment);
                this.environments.set(environment, envConfig);
            }

            // 處理敏感數據加密
            if (configItem.encrypted && this.encryptionUtil) {
                value = this.encryptionUtil.encrypt(value);
                this.stats.encryptedSecrets++;
            }

            // 設置配置值
            envConfig.set(key, value, configItem);

            // 重新構建合併配置
            if (environment === this.currentEnvironment) {
                await this._buildMergedConfig();
            }

            // 持久化環境配置
            await this._persistEnvironmentConfig(envConfig);

            // 發布事件
            await this.eventBus.publish('environment.config.changed', {
                environment,
                key,
                value: configItem.encrypted ? '***ENCRYPTED***' : value,
                type: configItem.type
            });

            console.log(`[EnvironmentManager] 配置已設置 [${key}] 環境: ${environment}`);
            this.emit('configChanged', { environment, key, value, options: configItem });

            return true;

        } catch (error) {
            console.error(`[EnvironmentManager] 設置配置失敗 [${key}]:`, error);
            throw error;
        }
    }

    /**
     * 獲取所有配置
     * @param {object} options - 選項
     */
    async getAll(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.mergedConfig) {
            return {};
        }

        const allConfigs = this.mergedConfig.getAll(options.includeMetadata);

        // 變量解析
        if (this.options.enableVariableResolution && !options.raw) {
            const context = this._buildVariableContext();
            const resolved = {};

            for (const [key, value] of Object.entries(allConfigs)) {
                try {
                    resolved[key] = options.includeMetadata && typeof value === 'object' && value.value !== undefined
                        ? { ...value, value: this.variableResolver.resolve(value.value, context) }
                        : this.variableResolver.resolve(value, context);
                } catch (error) {
                    console.warn(`[EnvironmentManager] 變量解析失敗 [${key}]:`, error);
                    resolved[key] = value;
                }
            }

            return resolved;
        }

        return allConfigs;
    }

    /**
     * 獲取環境列表
     */
    getEnvironments() {
        return Array.from(this.environments.keys());
    }

    /**
     * 獲取當前環境
     */
    getCurrentEnvironment() {
        return this.currentEnvironment;
    }

    /**
     * 獲取環境配置
     * @param {string} environment - 環境名稱
     */
    getEnvironmentConfig(environment) {
        return this.environments.get(environment);
    }

    /**
     * 創建新環境
     * @param {string} environment - 環境名稱
     * @param {object} config - 環境配置
     * @param {object} options - 選項
     */
    async createEnvironment(environment, config = {}, options = {}) {
        try {
            if (this.environments.has(environment)) {
                throw new Error(`環境已存在: ${environment}`);
            }

            // 創建環境配置
            const envConfig = new EnvironmentConfig(environment, config);

            // 驗證配置
            if (this.options.enableValidation) {
                const validation = envConfig.validate();
                if (!validation.isValid) {
                    throw new Error(`環境配置驗證失敗: ${validation.errors.map(e => e.error).join(', ')}`);
                }
            }

            // 存儲環境配置
            this.environments.set(environment, envConfig);
            this.stats.environmentsLoaded++;

            // 持久化
            await this._persistEnvironmentConfig(envConfig);

            // 發布事件
            await this.eventBus.publish('environment.created', {
                environment,
                configCount: envConfig.configs.size
            });

            console.log(`[EnvironmentManager] 環境已創建 [${environment}]`);
            this.emit('environmentCreated', { environment, config: envConfig });

            return envConfig;

        } catch (error) {
            console.error(`[EnvironmentManager] 創建環境失敗 [${environment}]:`, error);
            throw error;
        }
    }

    /**
     * 刪除環境
     * @param {string} environment - 環境名稱
     * @param {object} options - 選項
     */
    async deleteEnvironment(environment, options = {}) {
        try {
            if (!this.environments.has(environment)) {
                throw new Error(`環境不存在: ${environment}`);
            }

            if (environment === this.currentEnvironment && !options.force) {
                throw new Error('不能刪除當前使用中的環境');
            }

            // 移除環境配置
            const envConfig = this.environments.get(environment);
            this.environments.delete(environment);

            // 刪除持久化配置
            await this._deletePersistedEnvironmentConfig(environment);

            // 如果刪除的是當前環境，切換到預設環境
            if (environment === this.currentEnvironment) {
                await this.switchEnvironment(this.options.defaultEnvironment);
            }

            // 發布事件
            await this.eventBus.publish('environment.deleted', {
                environment,
                wasActive: environment === this.currentEnvironment
            });

            console.log(`[EnvironmentManager] 環境已刪除 [${environment}]`);
            this.emit('environmentDeleted', { environment, config: envConfig });

            return true;

        } catch (error) {
            console.error(`[EnvironmentManager] 刪除環境失敗 [${environment}]:`, error);
            throw error;
        }
    }

    /**
     * 重新載入環境配置
     * @param {string} environment - 環境名稱（可選）
     */
    async reload(environment = null) {
        try {
            if (environment) {
                // 重新載入指定環境
                await this._loadEnvironment(environment);

                if (environment === this.currentEnvironment) {
                    await this._buildMergedConfig();
                }
            } else {
                // 重新載入所有環境
                await this._loadAllEnvironments();
                await this._buildMergedConfig();
            }

            console.log(`[EnvironmentManager] 環境配置已重新載入: ${environment || '全部'}`);
            this.emit('environmentReloaded', { environment });

        } catch (error) {
            console.error(`[EnvironmentManager] 重新載入失敗 [${environment}]:`, error);
            throw error;
        }
    }

    /**
     * 驗證環境配置
     * @param {string} environment - 環境名稱（可選）
     */
    validate(environment = null) {
        const results = {};

        if (environment) {
            const envConfig = this.environments.get(environment);
            if (envConfig) {
                results[environment] = envConfig.validate();
            } else {
                results[environment] = { isValid: false, errors: ['環境不存在'] };
            }
        } else {
            for (const [env, envConfig] of this.environments) {
                results[env] = envConfig.validate();
            }
        }

        return results;
    }

    /**
     * 導出環境配置
     * @param {object} options - 選項
     */
    async export(options = {}) {
        const environments = options.environments || this.getEnvironments();
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            currentEnvironment: this.currentEnvironment,
            environments: {},
            metadata: {
                totalEnvironments: environments.length,
                ...options.metadata
            }
        };

        for (const env of environments) {
            const envConfig = this.environments.get(env);
            if (envConfig) {
                exportData.environments[env] = envConfig.serialize(options.includeSecrets);
            }
        }

        return exportData;
    }

    /**
     * 導入環境配置
     * @param {object} data - 導入數據
     * @param {object} options - 選項
     */
    async import(data, options = {}) {
        try {
            if (!data.environments || typeof data.environments !== 'object') {
                throw new Error('無效的環境配置導入格式');
            }

            const results = [];
            let importedCount = 0;

            for (const [env, envData] of Object.entries(data.environments)) {
                try {
                    // 檢查是否已存在
                    if (this.environments.has(env) && !options.overwrite) {
                        results.push({
                            environment: env,
                            success: false,
                            error: '環境已存在'
                        });
                        continue;
                    }

                    // 創建環境配置
                    const envConfig = new EnvironmentConfig(env, envData);

                    // 驗證配置
                    if (this.options.enableValidation) {
                        const validation = envConfig.validate();
                        if (!validation.isValid) {
                            throw new Error(`配置驗證失敗: ${validation.errors.map(e => e.error).join(', ')}`);
                        }
                    }

                    // 存儲環境配置
                    this.environments.set(env, envConfig);
                    await this._persistEnvironmentConfig(envConfig);

                    results.push({
                        environment: env,
                        success: true,
                        configCount: envConfig.configs.size
                    });
                    importedCount++;

                } catch (error) {
                    results.push({
                        environment: env,
                        success: false,
                        error: error.message
                    });
                }
            }

            // 重新構建當前環境配置
            if (this.environments.has(this.currentEnvironment)) {
                await this._buildMergedConfig();
            }

            this.emit('environmentsImported', {
                totalEnvironments: Object.keys(data.environments).length,
                importedCount,
                results
            });

            console.log(`[EnvironmentManager] 已導入 ${importedCount} 個環境配置`);
            return { success: true, importedCount, results };

        } catch (error) {
            console.error('[EnvironmentManager] 導入環境配置失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            ...this.stats,
            currentEnvironment: this.currentEnvironment,
            totalEnvironments: this.environments.size,
            totalConfigs: this.mergedConfig ? this.mergedConfig.configs.size : 0,
            encryptionEnabled: !!this.encryptionUtil,
            variableResolutionEnabled: this.options.enableVariableResolution
        };
    }

    // ========== 私有方法 ==========

    /**
     * 確保環境目錄存在
     */
    async _ensureEnvironmentsDirectory() {
        try {
            await fs.mkdir(this.options.environmentsDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * 載入所有環境配置
     */
    async _loadAllEnvironments() {
        try {
            // 從配置管理器載入
            if (this.configManager) {
                const configKeys = await this.configManager.keys();
                const envKeys = configKeys.filter(key => key.startsWith('env_'));

                for (const key of envKeys) {
                    const environment = key.replace('env_', '');
                    await this._loadEnvironment(environment);
                }
            }

            // 載入標準環境類型
            for (const env of Object.values(ENVIRONMENT_TYPES)) {
                if (!this.environments.has(env)) {
                    await this._loadEnvironment(env, false); // 不拋出錯誤
                }
            }

        } catch (error) {
            console.warn('[EnvironmentManager] 載入環境配置失敗:', error);
        }
    }

    /**
     * 載入單個環境配置
     */
    async _loadEnvironment(environment, throwOnError = true) {
        try {
            const configKey = `env_${environment}`;
            let envData = null;

            // 從配置管理器載入
            if (this.configManager) {
                envData = await this.configManager.get(configKey, null);
            }

            // 如果沒有配置數據，創建預設配置
            if (!envData) {
                envData = {
                    environment,
                    metadata: {
                        name: environment,
                        description: `${environment}環境配置`,
                        version: '1.0.0'
                    },
                    configs: {}
                };
            }

            const envConfig = new EnvironmentConfig(environment, envData);
            this.environments.set(environment, envConfig);
            this.stats.environmentsLoaded++;

            console.log(`[EnvironmentManager] 已載入環境 [${environment}]`);

        } catch (error) {
            if (throwOnError) {
                throw error;
            }
            console.warn(`[EnvironmentManager] 載入環境失敗 [${environment}]:`, error);
        }
    }

    /**
     * 設置當前環境
     */
    async _setupCurrentEnvironment() {
        // 載入保存的當前環境設置
        if (this.configManager) {
            const savedEnv = await this.configManager.get('current_environment');
            if (savedEnv && this.environments.has(savedEnv)) {
                this.currentEnvironment = savedEnv;
            }
        }

        // 確保當前環境已載入
        if (!this.environments.has(this.currentEnvironment)) {
            await this._loadEnvironment(this.currentEnvironment);
        }

        // 構建合併配置
        await this._buildMergedConfig();
    }

    /**
     * 構建合併配置
     */
    async _buildMergedConfig() {
        const currentEnvConfig = this.environments.get(this.currentEnvironment);
        if (!currentEnvConfig) {
            throw new Error(`當前環境配置不存在: ${this.currentEnvironment}`);
        }

        // 克隆當前環境配置作為基礎
        this.mergedConfig = currentEnvConfig.clone(`${this.currentEnvironment}_merged`);

        // 處理繼承
        if (this.options.enableInheritance && currentEnvConfig.metadata.extends) {
            await this._applyInheritance(this.mergedConfig, currentEnvConfig.metadata.extends);
        }

        // 應用環境變量覆蓋
        this._applyEnvironmentVariables(this.mergedConfig);

        // 處理加密配置
        if (this.encryptionUtil) {
            await this._decryptSecrets(this.mergedConfig);
        }

        this.stats.configsResolved = this.mergedConfig.configs.size;
    }

    /**
     * 應用環境繼承
     */
    async _applyInheritance(targetConfig, extendsList, depth = 0) {
        if (depth >= this.options.maxInheritanceDepth) {
            console.warn('[EnvironmentManager] 環境繼承深度超過限制');
            return;
        }

        for (const parentEnv of extendsList) {
            // 確保父環境已載入
            if (!this.environments.has(parentEnv)) {
                await this._loadEnvironment(parentEnv, false);
            }

            const parentConfig = this.environments.get(parentEnv);
            if (parentConfig) {
                // 遞歸處理父環境的繼承
                if (parentConfig.metadata.extends) {
                    await this._applyInheritance(targetConfig, parentConfig.metadata.extends, depth + 1);
                }

                // 合並父環境配置（低優先級）
                targetConfig.merge(parentConfig, { force: false });
            }
        }
    }

    /**
     * 應用環境變量覆蓋
     */
    _applyEnvironmentVariables(config) {
        // 從 process.env 中查找匹配的環境變量
        for (const [envKey, envValue] of Object.entries(process.env)) {
            // 檢查是否有對應的配置鍵
            const configKey = envKey.toLowerCase().replace(/_/g, '.');

            if (config.has(configKey)) {
                config.set(configKey, envValue, {
                    priority: CONFIG_PRIORITY.ENVIRONMENT_VARIABLES,
                    source: 'process.env'
                });
            }
        }
    }

    /**
     * 解密敏感配置
     */
    async _decryptSecrets(config) {
        for (const [key, configItem] of config.configs) {
            if (configItem.type === VARIABLE_TYPES.SECRET && configItem.encrypted) {
                try {
                    const decryptedValue = this.encryptionUtil.decrypt(configItem.value);
                    configItem.value = decryptedValue;
                    configItem.encrypted = false; // 標記為已解密
                } catch (error) {
                    console.error(`[EnvironmentManager] 解密失敗 [${key}]:`, error);
                }
            }
        }
    }

    /**
     * 構建變量解析上下文
     */
    _buildVariableContext() {
        const context = {};

        // 添加當前環境配置
        if (this.mergedConfig) {
            Object.assign(context, this.mergedConfig.getAll());
        }

        // 添加環境信息
        context.ENV = this.currentEnvironment;
        context.NODE_ENV = process.env.NODE_ENV || this.currentEnvironment;

        return context;
    }

    /**
     * 持久化當前環境設置
     */
    async _persistCurrentEnvironment() {
        if (this.configManager) {
            await this.configManager.set('current_environment', this.currentEnvironment, {
                source: 'environment_manager'
            });
        }
    }

    /**
     * 持久化環境配置
     */
    async _persistEnvironmentConfig(envConfig) {
        if (this.configManager) {
            const configKey = `env_${envConfig.environment}`;
            await this.configManager.set(configKey, envConfig.serialize(), {
                source: 'environment_manager'
            });
        }
    }

    /**
     * 刪除持久化環境配置
     */
    async _deletePersistedEnvironmentConfig(environment) {
        if (this.configManager) {
            const configKey = `env_${environment}`;
            await this.configManager.delete(configKey);
        }
    }

    /**
     * 設置檔案監控
     */
    async _setupFileWatching() {
        // 監控環境配置目錄
        try {
            const watcher = fs.watch(this.options.environmentsDir, { recursive: true });

            watcher.on('change', async (eventType, filename) => {
                if (filename && filename.endsWith('.json')) {
                    const environment = path.basename(filename, '.json');
                    console.log(`[EnvironmentManager] 檢測到環境配置變更: ${environment}`);

                    try {
                        await this.reload(environment);
                        this.emit('environmentConfigChanged', { environment, eventType, filename });
                    } catch (error) {
                        console.error(`[EnvironmentManager] 重新載入環境失敗 [${environment}]:`, error);
                    }
                }
            });

            this.watchers.set('environments', watcher);
        } catch (error) {
            console.warn('[EnvironmentManager] 無法設置檔案監控:', error);
        }
    }

    /**
     * 設置事件處理
     */
    _setupEventHandlers() {
        if (this.eventBus) {
            this.eventBus.subscribe('config.changed', (event) => {
                // 處理配置變更事件
                if (event.key.startsWith('env_') || event.key === 'current_environment') {
                    this.emit('externalConfigChange', event);
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
            this.environments.clear();
            this.mergedConfig = null;

            this.initialized = false;
            console.log('[EnvironmentManager] 清理完成');

        } catch (error) {
            console.error('[EnvironmentManager] 清理失敗:', error);
            throw error;
        }
    }
}

// 導出常數
EnvironmentManager.ENVIRONMENT_TYPES = ENVIRONMENT_TYPES;
EnvironmentManager.CONFIG_PRIORITY = CONFIG_PRIORITY;
EnvironmentManager.VARIABLE_TYPES = VARIABLE_TYPES;
EnvironmentManager.ENCRYPTION_METHODS = ENCRYPTION_METHODS;

export default EnvironmentManager;