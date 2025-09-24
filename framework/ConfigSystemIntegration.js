/**
 * 配置管理系統整合控制器 - CCPM+SuperClaude統一配置中心
 *
 * 功能特點：
 * - 整合所有8個配置管理組件的統一入口
 * - 提供簡化的API接口供外部系統使用
 * - 實現組件間的智能協調和依賴管理
 * - 支援一站式配置操作和管理
 * - 提供系統健康監控和診斷功能
 *
 * 性能要求：
 * - 初始化時間 < 100ms
 * - 配置載入時間 < 50ms (符合ConfigManager要求)
 * - 記憶體使用 < 50MB (正常運行狀態)
 * - 支援1000+併發配置請求
 *
 * @author Claude Code Framework
 * @version 1.0.0
 */

const EventEmitter = require('events');

// 導入所有配置管理組件
const ConfigManager = require('./ConfigManager');
const UserPreferences = require('./UserPreferences');
const TemplateManager = require('./TemplateManager');
const EnvironmentManager = require('./EnvironmentManager');
const ConfigHotReload = require('./ConfigHotReload');
const ConfigValidator = require('./ConfigValidator');
const ConfigImportExport = require('./ConfigImportExport');
const ConfigPerformanceOptimizer = require('./ConfigPerformanceOptimizer');

/**
 * 統一配置管理系統整合類
 * 提供所有配置管理功能的統一訪問點
 */
class ConfigSystemIntegration extends EventEmitter {
    constructor(options = {}) {
        super();

        // 系統配置
        this.options = {
            // 基本配置
            basePath: options.basePath || process.cwd() + '/.claude/configs',
            environment: options.environment || 'development',
            enableHotReload: options.enableHotReload !== false,
            enablePerformanceOptimization: options.enablePerformanceOptimization !== false,

            // 性能配置
            initTimeout: options.initTimeout || 100, // 100ms 初始化超時
            loadTimeout: options.loadTimeout || 50,  // 50ms 載入超時
            maxMemoryUsage: options.maxMemoryUsage || 50 * 1024 * 1024, // 50MB
            maxConcurrentRequests: options.maxConcurrentRequests || 1000,

            // 功能開關
            enableValidation: options.enableValidation !== false,
            enableBackup: options.enableBackup !== false,
            enableEncryption: options.enableEncryption || false,
            enableCompression: options.enableCompression !== false,

            // 調試配置
            debug: options.debug || false,
            logLevel: options.logLevel || 'info'
        };

        // 系統狀態
        this.state = {
            initialized: false,
            healthy: false,
            components: {},
            stats: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                memoryUsage: 0,
                lastHealthCheck: null
            }
        };

        // 初始化組件
        this.components = {};
        this.requestQueue = [];
        this.activeRequests = new Set();

        // 性能監控
        this.performanceMonitor = null;
        this.healthCheckInterval = null;

        this.log('ConfigSystemIntegration 已創建', { options: this.options });
    }

    /**
     * 系統初始化
     * 按照依賴順序初始化所有組件
     */
    async initialize() {
        const startTime = Date.now();

        try {
            this.log('開始系統初始化...');

            // 階段 1: 初始化基礎組件
            await this.initializeBaseComponents();

            // 階段 2: 初始化功能組件
            await this.initializeFunctionalComponents();

            // 階段 3: 啟動服務組件
            await this.startServiceComponents();

            // 階段 4: 建立組件間連接
            await this.establishComponentConnections();

            // 階段 5: 啟動系統監控
            await this.startSystemMonitoring();

            const initTime = Date.now() - startTime;

            // 檢查初始化時間要求
            if (initTime > this.options.initTimeout) {
                this.log(`警告: 初始化時間 ${initTime}ms 超過要求的 ${this.options.initTimeout}ms`, 'warn');
            }

            this.state.initialized = true;
            this.state.healthy = true;

            this.log('系統初始化完成', {
                initTime: `${initTime}ms`,
                components: Object.keys(this.components),
                memoryUsage: this.getMemoryUsage()
            });

            this.emit('initialized', { initTime, components: this.components });

            return true;

        } catch (error) {
            this.log('系統初始化失敗', 'error', { error: error.message });
            this.state.initialized = false;
            this.state.healthy = false;
            this.emit('initializationFailed', error);
            throw error;
        }
    }

    /**
     * 初始化基礎組件
     * 這些組件不依賴其他組件
     */
    async initializeBaseComponents() {
        this.log('初始化基礎組件...');

        // 1. ConfigPerformanceOptimizer - 性能優化組件
        if (this.options.enablePerformanceOptimization) {
            this.components.performanceOptimizer = new ConfigPerformanceOptimizer({
                cacheSize: 1000,
                maxMemory: this.options.maxMemoryUsage / 2, // 分配一半記憶體給緩存
                compressionEnabled: this.options.enableCompression,
                debug: this.options.debug
            });
            await this.components.performanceOptimizer.initialize();
        }

        // 2. ConfigValidator - 驗證組件
        if (this.options.enableValidation) {
            this.components.validator = new ConfigValidator({
                enableCache: true,
                cacheSize: 500,
                debug: this.options.debug
            });
            await this.components.validator.initialize();
        }

        this.log('基礎組件初始化完成');
    }

    /**
     * 初始化功能組件
     * 這些組件可能依賴基礎組件
     */
    async initializeFunctionalComponents() {
        this.log('初始化功能組件...');

        // 1. EnvironmentManager - 環境管理
        this.components.environmentManager = new EnvironmentManager({
            basePath: this.options.basePath + '/environments',
            currentEnvironment: this.options.environment,
            enableEncryption: this.options.enableEncryption,
            validator: this.components.validator,
            debug: this.options.debug
        });
        await this.components.environmentManager.initialize();

        // 2. ConfigManager - 核心配置管理
        this.components.configManager = new ConfigManager({
            basePath: this.options.basePath + '/configs',
            loadTimeout: this.options.loadTimeout,
            cacheEnabled: true,
            cacheSize: 1000,
            validator: this.components.validator,
            performanceOptimizer: this.components.performanceOptimizer,
            debug: this.options.debug
        });
        await this.components.configManager.initialize();

        // 3. UserPreferences - 用戶偏好管理
        this.components.userPreferences = new UserPreferences({
            basePath: this.options.basePath + '/preferences',
            configManager: this.components.configManager,
            validator: this.components.validator,
            debug: this.options.debug
        });
        await this.components.userPreferences.initialize();

        // 4. TemplateManager - 模板管理
        this.components.templateManager = new TemplateManager({
            basePath: this.options.basePath + '/templates',
            configManager: this.components.configManager,
            validator: this.components.validator,
            enableVersioning: true,
            debug: this.options.debug
        });
        await this.components.templateManager.initialize();

        // 5. ConfigImportExport - 導入導出管理
        if (this.options.enableBackup) {
            this.components.importExport = new ConfigImportExport({
                basePath: this.options.basePath + '/backups',
                configManager: this.components.configManager,
                validator: this.components.validator,
                enableEncryption: this.options.enableEncryption,
                debug: this.options.debug
            });
            await this.components.importExport.initialize();
        }

        this.log('功能組件初始化完成');
    }

    /**
     * 啟動服務組件
     * 這些組件提供實時服務功能
     */
    async startServiceComponents() {
        this.log('啟動服務組件...');

        // 1. ConfigHotReload - 熱更新服務
        if (this.options.enableHotReload) {
            this.components.hotReload = new ConfigHotReload({
                basePath: this.options.basePath,
                configManager: this.components.configManager,
                userPreferences: this.components.userPreferences,
                templateManager: this.components.templateManager,
                environmentManager: this.components.environmentManager,
                enableWebSocket: true,
                debug: this.options.debug
            });
            await this.components.hotReload.initialize();
            await this.components.hotReload.startWatching();
        }

        this.log('服務組件啟動完成');
    }

    /**
     * 建立組件間連接
     * 設置組件間的事件監聽和數據共享
     */
    async establishComponentConnections() {
        this.log('建立組件間連接...');

        // 配置管理器事件監聽
        if (this.components.configManager) {
            this.components.configManager.on('configChanged', (data) => {
                this.emit('configChanged', data);
                this.updateStats('configChanged');
            });

            this.components.configManager.on('error', (error) => {
                this.emit('error', error);
                this.updateStats('error');
            });
        }

        // 熱更新事件監聽
        if (this.components.hotReload) {
            this.components.hotReload.on('fileChanged', (data) => {
                this.emit('fileChanged', data);
                this.updateStats('fileChanged');
            });

            this.components.hotReload.on('conflictDetected', (data) => {
                this.emit('conflictDetected', data);
                this.updateStats('conflict');
            });
        }

        // 性能監控事件監聽
        if (this.components.performanceOptimizer) {
            this.components.performanceOptimizer.on('performanceAlert', (data) => {
                this.emit('performanceAlert', data);
                this.updateStats('performanceAlert');
            });
        }

        this.log('組件間連接建立完成');
    }

    /**
     * 啟動系統監控
     * 包括健康檢查、性能監控等
     */
    async startSystemMonitoring() {
        this.log('啟動系統監控...');

        // 健康檢查定時器
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // 每30秒檢查一次

        // 性能監控
        if (this.components.performanceOptimizer) {
            this.performanceMonitor = this.components.performanceOptimizer.createMonitor('system');
            this.performanceMonitor.start();
        }

        this.log('系統監控啟動完成');
    }

    /**
     * 統一配置獲取接口
     * 提供智能路由到適當的配置組件
     */
    async get(path, options = {}) {
        const startTime = Date.now();

        try {
            this.updateStats('request');

            // 解析路徑以確定配置類型
            const { type, actualPath } = this.parsePath(path);

            let result;

            switch (type) {
                case 'user':
                    result = await this.components.userPreferences?.get(actualPath, options.defaultValue, options);
                    break;
                case 'template':
                    result = await this.components.templateManager?.get(actualPath, options);
                    break;
                case 'env':
                    result = await this.components.environmentManager?.get(actualPath, options.defaultValue, options);
                    break;
                default:
                    result = await this.components.configManager?.get(actualPath, options.defaultValue, options);
                    break;
            }

            const responseTime = Date.now() - startTime;

            // 檢查響應時間要求
            if (responseTime > this.options.loadTimeout) {
                this.log(`警告: 配置載入時間 ${responseTime}ms 超過要求的 ${this.options.loadTimeout}ms`, 'warn');
            }

            this.updateStats('success', responseTime);

            return result;

        } catch (error) {
            this.updateStats('error');
            this.log('配置獲取失敗', 'error', { path, error: error.message });
            throw error;
        }
    }

    /**
     * 統一配置設置接口
     */
    async set(path, value, options = {}) {
        try {
            this.updateStats('request');

            const { type, actualPath } = this.parsePath(path);

            let result;

            switch (type) {
                case 'user':
                    result = await this.components.userPreferences?.set(actualPath, value, options);
                    break;
                case 'template':
                    result = await this.components.templateManager?.saveTemplate(actualPath, value, options);
                    break;
                case 'env':
                    result = await this.components.environmentManager?.set(actualPath, value, options);
                    break;
                default:
                    result = await this.components.configManager?.set(actualPath, value, options);
                    break;
            }

            this.updateStats('success');
            this.emit('configUpdated', { path, value, type });

            return result;

        } catch (error) {
            this.updateStats('error');
            this.log('配置設置失敗', 'error', { path, error: error.message });
            throw error;
        }
    }

    /**
     * 批量配置操作
     * 支援批量獲取和設置以提高性能
     */
    async batch(operations) {
        try {
            this.log('執行批量操作', { count: operations.length });

            const results = [];
            const promises = operations.map(async (op, index) => {
                try {
                    let result;

                    switch (op.action) {
                        case 'get':
                            result = await this.get(op.path, op.options);
                            break;
                        case 'set':
                            result = await this.set(op.path, op.value, op.options);
                            break;
                        default:
                            throw new Error(`不支援的操作類型: ${op.action}`);
                    }

                    return { index, success: true, result };

                } catch (error) {
                    return { index, success: false, error: error.message };
                }
            });

            const batchResults = await Promise.all(promises);

            // 按索引排序結果
            batchResults.sort((a, b) => a.index - b.index);

            this.log('批量操作完成', {
                total: operations.length,
                successful: batchResults.filter(r => r.success).length,
                failed: batchResults.filter(r => !r.success).length
            });

            return batchResults;

        } catch (error) {
            this.log('批量操作失敗', 'error', { error: error.message });
            throw error;
        }
    }

    /**
     * 配置驗證
     */
    async validate(config, schema, options = {}) {
        if (!this.components.validator) {
            throw new Error('配置驗證組件未啟用');
        }

        return await this.components.validator.validate(config, schema, options);
    }

    /**
     * 配置導出
     */
    async export(options = {}) {
        if (!this.components.importExport) {
            throw new Error('導入導出組件未啟用');
        }

        return await this.components.importExport.exportConfigs(options);
    }

    /**
     * 配置導入
     */
    async import(data, options = {}) {
        if (!this.components.importExport) {
            throw new Error('導入導出組件未啟用');
        }

        return await this.components.importExport.importConfigs(data, options);
    }

    /**
     * 獲取系統狀態
     */
    getStatus() {
        return {
            ...this.state,
            components: Object.keys(this.components).reduce((acc, key) => {
                const component = this.components[key];
                acc[key] = {
                    initialized: !!component,
                    healthy: component && typeof component.isHealthy === 'function'
                        ? component.isHealthy()
                        : true
                };
                return acc;
            }, {}),
            memoryUsage: this.getMemoryUsage(),
            uptime: Date.now() - (this.state.stats.lastHealthCheck || Date.now())
        };
    }

    /**
     * 系統健康檢查
     */
    async performHealthCheck() {
        try {
            const startTime = Date.now();
            const memoryUsage = this.getMemoryUsage();

            // 檢查記憶體使用量
            if (memoryUsage > this.options.maxMemoryUsage) {
                this.log(`記憶體使用量過高: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`, 'warn');
                this.emit('memoryWarning', { usage: memoryUsage, limit: this.options.maxMemoryUsage });
            }

            // 檢查組件健康狀態
            const componentHealth = {};
            for (const [name, component] of Object.entries(this.components)) {
                if (component && typeof component.isHealthy === 'function') {
                    componentHealth[name] = await component.isHealthy();
                } else {
                    componentHealth[name] = true; // 假設健康如果沒有健康檢查方法
                }
            }

            const allHealthy = Object.values(componentHealth).every(healthy => healthy);

            this.state.healthy = allHealthy;
            this.state.stats.memoryUsage = memoryUsage;
            this.state.stats.lastHealthCheck = Date.now();

            if (!allHealthy) {
                this.log('系統健康檢查發現問題', 'warn', { componentHealth });
                this.emit('healthCheckFailed', { componentHealth });
            }

            this.emit('healthCheck', {
                healthy: allHealthy,
                memoryUsage,
                componentHealth,
                checkTime: Date.now() - startTime
            });

        } catch (error) {
            this.log('健康檢查失敗', 'error', { error: error.message });
            this.state.healthy = false;
            this.emit('healthCheckError', error);
        }
    }

    /**
     * 關閉系統
     * 優雅地關閉所有組件和清理資源
     */
    async shutdown() {
        this.log('開始系統關閉...');

        try {
            // 停止監控
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
                this.performanceMonitor = null;
            }

            // 按相反順序關閉組件
            const shutdownOrder = [
                'hotReload',
                'importExport',
                'templateManager',
                'userPreferences',
                'configManager',
                'environmentManager',
                'validator',
                'performanceOptimizer'
            ];

            for (const componentName of shutdownOrder) {
                const component = this.components[componentName];
                if (component && typeof component.shutdown === 'function') {
                    try {
                        await component.shutdown();
                        this.log(`組件 ${componentName} 已關閉`);
                    } catch (error) {
                        this.log(`組件 ${componentName} 關閉失敗`, 'error', { error: error.message });
                    }
                }
            }

            this.state.initialized = false;
            this.state.healthy = false;

            this.log('系統關閉完成');
            this.emit('shutdown');

        } catch (error) {
            this.log('系統關閉過程中發生錯誤', 'error', { error: error.message });
            this.emit('shutdownError', error);
            throw error;
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 解析配置路徑，確定配置類型
     */
    parsePath(path) {
        if (path.startsWith('user:')) {
            return { type: 'user', actualPath: path.substring(5) };
        } else if (path.startsWith('template:')) {
            return { type: 'template', actualPath: path.substring(9) };
        } else if (path.startsWith('env:')) {
            return { type: 'env', actualPath: path.substring(4) };
        } else {
            return { type: 'config', actualPath: path };
        }
    }

    /**
     * 更新統計資料
     */
    updateStats(type, responseTime = 0) {
        this.state.stats.totalRequests++;

        switch (type) {
            case 'success':
                this.state.stats.successfulRequests++;
                if (responseTime > 0) {
                    // 更新平均響應時間
                    const total = this.state.stats.averageResponseTime * (this.state.stats.successfulRequests - 1) + responseTime;
                    this.state.stats.averageResponseTime = total / this.state.stats.successfulRequests;
                }
                break;
            case 'error':
                this.state.stats.failedRequests++;
                break;
        }
    }

    /**
     * 獲取記憶體使用量
     */
    getMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    /**
     * 日誌記錄
     */
    log(message, level = 'info', data = null) {
        if (!this.options.debug && level === 'debug') return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            component: 'ConfigSystemIntegration',
            message,
            data
        };

        if (this.options.debug || level === 'error' || level === 'warn') {
            console.log(`[${timestamp}] [${level.toUpperCase()}] [ConfigSystemIntegration] ${message}`, data || '');
        }

        this.emit('log', logEntry);
    }
}

module.exports = ConfigSystemIntegration;