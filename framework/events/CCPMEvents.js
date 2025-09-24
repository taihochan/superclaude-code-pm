/**
 * CCPMEvents - CCPM專用事件定義
 *
 * 功能：
 * - 定義CCPM系統特有的事件類型
 * - 項目管理和代碼生成事件
 * - 模板處理和構建事件
 *
 * 用途：CCPM系統內部事件和與SuperClaude的整合事件
 */

/**
 * CCPM事件類型常數
 */
const CCPM_EVENT_TYPES = {
    // 項目生命周期事件
    PROJECT_INITIALIZED: 'CCPM_PROJECT_INITIALIZED',
    PROJECT_LOADED: 'CCPM_PROJECT_LOADED',
    PROJECT_SAVED: 'CCPM_PROJECT_SAVED',
    PROJECT_CLOSED: 'CCPM_PROJECT_CLOSED',
    PROJECT_ARCHIVED: 'CCPM_PROJECT_ARCHIVED',

    // 代碼生成事件
    CODE_GENERATION_STARTED: 'CCPM_CODE_GENERATION_STARTED',
    CODE_GENERATION_COMPLETED: 'CCPM_CODE_GENERATION_COMPLETED',
    CODE_GENERATION_FAILED: 'CCPM_CODE_GENERATION_FAILED',
    CODE_GENERATED: 'CCPM_CODE_GENERATED',

    // 模板事件
    TEMPLATE_LOADED: 'CCPM_TEMPLATE_LOADED',
    TEMPLATE_PROCESSED: 'CCPM_TEMPLATE_PROCESSED',
    TEMPLATE_ERROR: 'CCPM_TEMPLATE_ERROR',
    TEMPLATE_CACHED: 'CCPM_TEMPLATE_CACHED',

    // 變數和參數事件
    VARIABLES_RESOLVED: 'CCPM_VARIABLES_RESOLVED',
    VARIABLES_VALIDATION_FAILED: 'CCPM_VARIABLES_VALIDATION_FAILED',
    PARAMETERS_UPDATED: 'CCPM_PARAMETERS_UPDATED',

    // 文件操作事件
    FILE_CREATED: 'CCPM_FILE_CREATED',
    FILE_UPDATED: 'CCPM_FILE_UPDATED',
    FILE_DELETED: 'CCPM_FILE_DELETED',
    FILE_VALIDATION_FAILED: 'CCMP_FILE_VALIDATION_FAILED',

    // 構建和部署事件
    BUILD_STARTED: 'CCPM_BUILD_STARTED',
    BUILD_COMPLETED: 'CCPM_BUILD_COMPLETED',
    BUILD_FAILED: 'CCPM_BUILD_FAILED',
    DEPLOYMENT_STARTED: 'CCPM_DEPLOYMENT_STARTED',
    DEPLOYMENT_COMPLETED: 'CCPM_DEPLOYMENT_COMPLETED',
    DEPLOYMENT_FAILED: 'CCPM_DEPLOYMENT_FAILED',

    // 依賴管理事件
    DEPENDENCY_RESOLVED: 'CCPM_DEPENDENCY_RESOLVED',
    DEPENDENCY_CONFLICT: 'CCPM_DEPENDENCY_CONFLICT',
    DEPENDENCY_UPDATED: 'CCPM_DEPENDENCY_UPDATED',

    // 工作流事件
    WORKFLOW_STARTED: 'CCPM_WORKFLOW_STARTED',
    WORKFLOW_STEP_COMPLETED: 'CCPM_WORKFLOW_STEP_COMPLETED',
    WORKFLOW_COMPLETED: 'CCPM_WORKFLOW_COMPLETED',
    WORKFLOW_FAILED: 'CCPM_WORKFLOW_FAILED',

    // 外部整合事件
    SUPERCLAUDE_INTEGRATION_REQUESTED: 'CCPM_SUPERCLAUDE_INTEGRATION_REQUESTED',
    SUPERCLAUDE_RESPONSE_RECEIVED: 'CCPM_SUPERCLAUDE_RESPONSE_RECEIVED',
    EXTERNAL_TOOL_INVOKED: 'CCPM_EXTERNAL_TOOL_INVOKED'
};

/**
 * 項目狀態類型
 */
const PROJECT_STATUS = {
    INITIALIZING: 'initializing',
    ACTIVE: 'active',
    BUILDING: 'building',
    DEPLOYING: 'deploying',
    COMPLETED: 'completed',
    ERROR: 'error',
    ARCHIVED: 'archived'
};

/**
 * 代碼生成狀態
 */
const GENERATION_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * CCPM事件工廠
 */
class CCPMEventFactory {
    /**
     * 創建項目初始化事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createProjectInitializedEvent({
        projectPath,
        projectName,
        config = {},
        templates = [],
        source = 'ccpm'
    }) {
        return {
            type: CCPM_EVENT_TYPES.PROJECT_INITIALIZED,
            timestamp: new Date().toISOString(),
            data: {
                projectPath,
                projectName,
                config,
                templates,
                projectId: this._generateProjectId(projectPath),
                version: '1.0.0'
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建代碼生成事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createCodeGeneratedEvent({
        files = [],
        template,
        variables = {},
        outputPath = '',
        generationTime = 0,
        source = 'ccpm'
    }) {
        return {
            type: CCPM_EVENT_TYPES.CODE_GENERATED,
            timestamp: new Date().toISOString(),
            data: {
                files: files.map(file => ({
                    path: file.path || file,
                    size: file.size || 0,
                    type: file.type || 'unknown'
                })),
                template: {
                    name: template.name || template,
                    version: template.version || '1.0.0',
                    path: template.path || ''
                },
                variables,
                outputPath,
                generationTime,
                generationId: this._generateId(),
                stats: {
                    filesCreated: files.length,
                    totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
                }
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建模板處理事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createTemplateProcessedEvent({
        templateName,
        templatePath,
        variables = {},
        outputFiles = [],
        processingTime = 0,
        source = 'ccpm'
    }) {
        return {
            type: CCPM_EVENT_TYPES.TEMPLATE_PROCESSED,
            timestamp: new Date().toISOString(),
            data: {
                template: {
                    name: templateName,
                    path: templatePath,
                    hash: this._generateHash(templatePath)
                },
                variables,
                outputFiles,
                processingTime,
                processId: this._generateId()
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建構建事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createBuildEvent({
        eventType,
        projectPath,
        buildConfig = {},
        artifacts = [],
        buildTime = 0,
        exitCode = 0,
        logs = [],
        source = 'ccpm'
    }) {
        const priority = eventType === CCPM_EVENT_TYPES.BUILD_FAILED ? 2 : 1;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                projectPath,
                buildConfig,
                artifacts,
                buildTime,
                exitCode,
                logs: logs.slice(-100), // 保留最後100行日誌
                buildId: this._generateId(),
                environment: process.env.NODE_ENV || 'development'
            },
            source,
            priority
        };
    }

    /**
     * 創建工作流事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createWorkflowEvent({
        eventType,
        workflowName,
        workflowId,
        stepName = '',
        stepIndex = 0,
        totalSteps = 0,
        parameters = {},
        result = null,
        duration = 0,
        source = 'ccpm'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                workflow: {
                    name: workflowName,
                    id: workflowId,
                    version: '1.0.0'
                },
                step: {
                    name: stepName,
                    index: stepIndex,
                    total: totalSteps,
                    progress: totalSteps > 0 ? (stepIndex / totalSteps * 100).toFixed(2) : 0
                },
                parameters,
                result,
                duration
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建依賴管理事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createDependencyEvent({
        eventType,
        packageName,
        version = '',
        resolvedVersion = '',
        dependencies = [],
        conflicts = [],
        source = 'ccpm'
    }) {
        const priority = eventType === CCPM_EVENT_TYPES.DEPENDENCY_CONFLICT ? 2 : 1;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                package: {
                    name: packageName,
                    requestedVersion: version,
                    resolvedVersion,
                    type: 'dependency'
                },
                dependencies,
                conflicts,
                resolutionId: this._generateId()
            },
            source,
            priority
        };
    }

    /**
     * 創建SuperClaude整合事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createSuperClaudeIntegrationEvent({
        eventType,
        requestType,
        requestData = {},
        responseData = null,
        integrationId,
        duration = 0,
        success = true,
        source = 'ccpm'
    }) {
        const priority = success ? 1 : 2;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                integration: {
                    id: integrationId,
                    type: requestType,
                    version: '1.0.0'
                },
                request: requestData,
                response: responseData,
                duration,
                success,
                context: {
                    ccpmVersion: require('../../package.json')?.version || '1.0.0',
                    nodeVersion: process.version
                }
            },
            source,
            priority
        };
    }

    /**
     * 生成項目ID
     * @private
     */
    static _generateProjectId(projectPath) {
        const path = require('path');
        const projectName = path.basename(projectPath);
        const timestamp = Date.now();
        return `${projectName}_${timestamp}`;
    }

    /**
     * 生成文件哈希
     * @private
     */
    static _generateHash(filePath) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
    }

    /**
     * 生成唯一ID
     * @private
     */
    static _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}

/**
 * CCPM事件驗證器
 */
class CCPMEventValidator {
    /**
     * 驗證CCPM事件結構
     * @param {Object} event - 事件對象
     * @returns {Object} 驗證結果
     */
    static validate(event) {
        const errors = [];

        // 基本結構檢查
        if (!event || typeof event !== 'object') {
            return { valid: false, errors: ['事件必須是對象'] };
        }

        // 事件類型檢查
        if (!event.type || !Object.values(CCPM_EVENT_TYPES).includes(event.type)) {
            errors.push('無效的CCPM事件類型');
        }

        // 特定事件驗證
        if (errors.length === 0) {
            const typeSpecificErrors = this._validateEventTypeSpecific(event);
            errors.push(...typeSpecificErrors);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 事件類型特定驗證
     * @private
     */
    static _validateEventTypeSpecific(event) {
        const errors = [];

        switch (event.type) {
            case CCPM_EVENT_TYPES.PROJECT_INITIALIZED:
                if (!event.data.projectPath || !event.data.projectName) {
                    errors.push('項目事件必須包含projectPath和projectName');
                }
                break;

            case CCPM_EVENT_TYPES.CODE_GENERATED:
                if (!event.data.files || !Array.isArray(event.data.files)) {
                    errors.push('代碼生成事件必須包含files數組');
                }
                if (!event.data.template) {
                    errors.push('代碼生成事件必須包含template信息');
                }
                break;

            case CCPM_EVENT_TYPES.TEMPLATE_PROCESSED:
                if (!event.data.template || !event.data.template.name) {
                    errors.push('模板事件必須包含模板名稱');
                }
                break;

            case CCPM_EVENT_TYPES.BUILD_STARTED:
            case CCPM_EVENT_TYPES.BUILD_COMPLETED:
            case CCPM_EVENT_TYPES.BUILD_FAILED:
                if (!event.data.projectPath) {
                    errors.push('構建事件必須包含projectPath');
                }
                break;

            case CCPM_EVENT_TYPES.WORKFLOW_STARTED:
            case CCPM_EVENT_TYPES.WORKFLOW_COMPLETED:
            case CCPM_EVENT_TYPES.WORKFLOW_FAILED:
                if (!event.data.workflow || !event.data.workflow.name) {
                    errors.push('工作流事件必須包含工作流名稱');
                }
                break;
        }

        return errors;
    }
}

/**
 * CCPM事件工具函數
 */
const CCPMEventUtils = {
    /**
     * 檢查是否為項目相關事件
     */
    isProjectEvent(event) {
        return [
            CCPM_EVENT_TYPES.PROJECT_INITIALIZED,
            CCPM_EVENT_TYPES.PROJECT_LOADED,
            CCMP_EVENT_TYPES.PROJECT_SAVED,
            CCPM_EVENT_TYPES.PROJECT_CLOSED
        ].includes(event.type);
    },

    /**
     * 檢查是否為代碼生成事件
     */
    isCodeGenerationEvent(event) {
        return [
            CCPM_EVENT_TYPES.CODE_GENERATION_STARTED,
            CCPM_EVENT_TYPES.CODE_GENERATION_COMPLETED,
            CCPM_EVENT_TYPES.CODE_GENERATED
        ].includes(event.type);
    },

    /**
     * 檢查是否為構建相關事件
     */
    isBuildEvent(event) {
        return [
            CCPM_EVENT_TYPES.BUILD_STARTED,
            CCPM_EVENT_TYPES.BUILD_COMPLETED,
            CCPM_EVENT_TYPES.BUILD_FAILED
        ].includes(event.type);
    },

    /**
     * 獲取項目ID
     */
    getProjectId(event) {
        return event.data?.projectId ||
               event.data?.project?.id ||
               this._extractProjectIdFromPath(event.data?.projectPath);
    },

    /**
     * 獲取事件性能指標
     */
    getPerformanceMetrics(event) {
        const metrics = {};

        if (event.data?.generationTime) {
            metrics.generationTime = event.data.generationTime;
        }

        if (event.data?.buildTime) {
            metrics.buildTime = event.data.buildTime;
        }

        if (event.data?.processingTime) {
            metrics.processingTime = event.data.processingTime;
        }

        if (event.data?.duration) {
            metrics.duration = event.data.duration;
        }

        return metrics;
    },

    /**
     * 從路徑提取項目ID
     * @private
     */
    _extractProjectIdFromPath(projectPath) {
        if (!projectPath) return null;

        const path = require('path');
        return path.basename(projectPath);
    }
};

module.exports = {
    CCPM_EVENT_TYPES,
    PROJECT_STATUS,
    GENERATION_STATUS,
    CCPMEventFactory,
    CCPMEventValidator,
    CCPMEventUtils
};