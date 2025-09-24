/**
 * SuperClaudeEvents - SuperClaude專用事件定義
 *
 * 功能：
 * - 定義SuperClaude框架特有的事件類型
 * - 工作流、分析、代理相關事件
 * - MCP服務器和工具整合事件
 *
 * 用途：SuperClaude系統內部事件和與CCPM的整合事件
 */

/**
 * SuperClaude事件類型常數
 */
const SUPERCLAUDE_EVENT_TYPES = {
    // 工作流事件
    WORKFLOW_STARTED: 'SC_WORKFLOW_STARTED',
    WORKFLOW_STEP_EXECUTED: 'SC_WORKFLOW_STEP_EXECUTED',
    WORKFLOW_COMPLETED: 'SC_WORKFLOW_COMPLETED',
    WORKFLOW_FAILED: 'SC_WORKFLOW_FAILED',
    WORKFLOW_PAUSED: 'SC_WORKFLOW_PAUSED',
    WORKFLOW_RESUMED: 'SC_WORKFLOW_RESUMED',

    // 分析事件
    ANALYSIS_STARTED: 'SC_ANALYSIS_STARTED',
    ANALYSIS_COMPLETED: 'SC_ANALYSIS_COMPLETED',
    ANALYSIS_FAILED: 'SC_ANALYSIS_FAILED',
    CODE_ANALYSIS_COMPLETED: 'SC_CODE_ANALYSIS_COMPLETED',
    ARCHITECTURE_ANALYSIS_COMPLETED: 'SC_ARCHITECTURE_ANALYSIS_COMPLETED',

    // 代理系統事件
    AGENT_SPAWNED: 'SC_AGENT_SPAWNED',
    AGENT_COMPLETED: 'SC_AGENT_COMPLETED',
    AGENT_FAILED: 'SC_AGENT_FAILED',
    AGENT_COMMUNICATION: 'SC_AGENT_COMMUNICATION',
    SUB_AGENT_DELEGATED: 'SC_SUB_AGENT_DELEGATED',

    // MCP服務器事件
    MCP_SERVER_CONNECTED: 'SC_MCP_SERVER_CONNECTED',
    MCP_SERVER_DISCONNECTED: 'SC_MCP_SERVER_DISCONNECTED',
    MCP_TOOL_INVOKED: 'SC_MCP_TOOL_INVOKED',
    MCP_TOOL_COMPLETED: 'SC_MCP_TOOL_COMPLETED',
    MCP_TOOL_FAILED: 'SC_MCP_TOOL_FAILED',

    // 任務管理事件
    TASK_CREATED: 'SC_TASK_CREATED',
    TASK_STARTED: 'SC_TASK_STARTED',
    TASK_COMPLETED: 'SC_TASK_COMPLETED',
    TASK_FAILED: 'SC_TASK_FAILED',
    TASK_PROGRESS_UPDATED: 'SC_TASK_PROGRESS_UPDATED',

    // 上下文管理事件
    CONTEXT_LOADED: 'SC_CONTEXT_LOADED',
    CONTEXT_SAVED: 'SC_CONTEXT_SAVED',
    CONTEXT_SHARED: 'SC_CONTEXT_SHARED',
    CONTEXT_SYNCHRONIZED: 'SC_CONTEXT_SYNCHRONIZED',

    // 智能協調事件
    COMMAND_ROUTED: 'SC_COMMAND_ROUTED',
    COMMAND_ORCHESTRATED: 'SC_COMMAND_ORCHESTRATED',
    DECISION_MADE: 'SC_DECISION_MADE',
    STRATEGY_SELECTED: 'SC_STRATEGY_SELECTED',

    // 學習和適應事件
    PATTERN_LEARNED: 'SC_PATTERN_LEARNED',
    MODEL_UPDATED: 'SC_MODEL_UPDATED',
    FEEDBACK_RECEIVED: 'SC_FEEDBACK_RECEIVED',
    OPTIMIZATION_APPLIED: 'SC_OPTIMIZATION_APPLIED',

    // 外部整合事件
    CCPM_INTEGRATION_REQUESTED: 'SC_CCPM_INTEGRATION_REQUESTED',
    CCPM_RESPONSE_RECEIVED: 'SC_CCPM_RESPONSE_RECEIVED',
    EXTERNAL_API_CALLED: 'SC_EXTERNAL_API_CALLED',

    // 性能監控事件
    PERFORMANCE_METRICS_COLLECTED: 'SC_PERFORMANCE_METRICS_COLLECTED',
    RESOURCE_USAGE_UPDATED: 'SC_RESOURCE_USAGE_UPDATED',
    BOTTLENECK_DETECTED: 'SC_BOTTLENECK_DETECTED'
};

/**
 * 工作流狀態
 */
const WORKFLOW_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * 分析類型
 */
const ANALYSIS_TYPES = {
    CODE_REVIEW: 'code_review',
    ARCHITECTURE: 'architecture',
    PERFORMANCE: 'performance',
    SECURITY: 'security',
    QUALITY: 'quality',
    DEPENDENCY: 'dependency',
    TECHNICAL_DEBT: 'technical_debt'
};

/**
 * MCP服務器類型
 */
const MCP_SERVER_TYPES = {
    SEQUENTIAL: 'sequential-thinking',
    CONTEXT7: 'context7',
    MAGIC: 'magic',
    PLAYWRIGHT: 'playwright',
    MORPHLLM: 'morphllm',
    SERENA: 'serena'
};

/**
 * SuperClaude事件工廠
 */
class SuperClaudeEventFactory {
    /**
     * 創建工作流事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createWorkflowEvent({
        eventType,
        workflowId,
        workflowType,
        stepName = '',
        stepIndex = 0,
        totalSteps = 0,
        parameters = {},
        result = null,
        duration = 0,
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                workflow: {
                    id: workflowId,
                    type: workflowType,
                    version: '1.0.0'
                },
                step: {
                    name: stepName,
                    index: stepIndex,
                    total: totalSteps,
                    progress: totalSteps > 0 ? ((stepIndex + 1) / totalSteps * 100).toFixed(2) : 0
                },
                parameters,
                result,
                duration,
                context: this._getExecutionContext()
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建分析完成事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createAnalysisCompletedEvent({
        analysisType,
        target,
        results = {},
        metrics = {},
        recommendations = [],
        duration = 0,
        source = 'superclaude'
    }) {
        return {
            type: SUPERCLAUDE_EVENT_TYPES.ANALYSIS_COMPLETED,
            timestamp: new Date().toISOString(),
            data: {
                analysis: {
                    type: analysisType,
                    target,
                    id: this._generateId(),
                    version: '1.0.0'
                },
                results,
                metrics,
                recommendations,
                duration,
                summary: this._generateAnalysisSummary(analysisType, results, metrics)
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建代理事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createAgentEvent({
        eventType,
        agentId,
        agentType,
        task = null,
        parentAgentId = null,
        communicationData = null,
        result = null,
        duration = 0,
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                agent: {
                    id: agentId,
                    type: agentType,
                    parentId: parentAgentId,
                    level: parentAgentId ? 'sub-agent' : 'primary-agent'
                },
                task,
                communication: communicationData,
                result,
                duration,
                hierarchy: this._buildAgentHierarchy(agentId, parentAgentId)
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建MCP工具事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createMCPToolEvent({
        eventType,
        serverType,
        toolName,
        parameters = {},
        result = null,
        duration = 0,
        success = true,
        source = 'superclaude'
    }) {
        const priority = success ? 1 : 2;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                mcp: {
                    serverType,
                    toolName,
                    version: '1.0.0',
                    invocationId: this._generateId()
                },
                parameters,
                result,
                duration,
                success,
                performance: {
                    responseTime: duration,
                    throughput: result ? this._calculateThroughput(result, duration) : 0
                }
            },
            source,
            priority
        };
    }

    /**
     * 創建任務事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createTaskEvent({
        eventType,
        taskId,
        taskType,
        description = '',
        progress = 0,
        result = null,
        assignedAgent = null,
        dependencies = [],
        duration = 0,
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                task: {
                    id: taskId,
                    type: taskType,
                    description,
                    progress,
                    status: this._deriveTaskStatus(eventType),
                    assignedAgent,
                    dependencies,
                    estimatedDuration: duration,
                    createdAt: new Date().toISOString()
                },
                result,
                actualDuration: duration
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建上下文事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createContextEvent({
        eventType,
        contextId,
        contextType = 'session',
        data = {},
        size = 0,
        sharing = null,
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                context: {
                    id: contextId,
                    type: contextType,
                    size,
                    version: '1.0.0'
                },
                contextData: data,
                sharing,
                metadata: {
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    accessCount: 1
                }
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建智能協調事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createOrchestrationEvent({
        eventType,
        commandId,
        originalCommand,
        routedTo = '',
        decision = null,
        strategy = null,
        confidence = 0,
        alternatives = [],
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                command: {
                    id: commandId,
                    original: originalCommand,
                    routedTo
                },
                decision,
                strategy,
                confidence,
                alternatives,
                reasoning: this._generateReasoningExplanation(decision, strategy, confidence)
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建學習事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createLearningEvent({
        eventType,
        patternType,
        pattern = {},
        confidence = 0,
        applicability = {},
        source = 'superclaude'
    }) {
        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                learning: {
                    patternType,
                    pattern,
                    confidence,
                    applicability,
                    learnedAt: new Date().toISOString(),
                    id: this._generateId()
                },
                validation: {
                    crossValidated: false,
                    accuracy: confidence,
                    sampleSize: 0
                }
            },
            source,
            priority: 1
        };
    }

    /**
     * 創建性能監控事件
     * @param {Object} params - 參數對象
     * @returns {Object} 事件對象
     */
    static createPerformanceEvent({
        eventType,
        component,
        metrics = {},
        thresholds = {},
        alerts = [],
        source = 'superclaude'
    }) {
        const priority = alerts.length > 0 ? 2 : 1;

        return {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
                component,
                metrics,
                thresholds,
                alerts,
                analysis: this._analyzePerformanceMetrics(metrics, thresholds),
                recommendations: this._generatePerformanceRecommendations(metrics, alerts)
            },
            source,
            priority
        };
    }

    // 私有方法

    static _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    static _getExecutionContext() {
        return {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    static _generateAnalysisSummary(type, results, metrics) {
        return {
            type,
            resultCount: Object.keys(results).length,
            metricCount: Object.keys(metrics).length,
            status: 'completed'
        };
    }

    static _buildAgentHierarchy(agentId, parentId) {
        return {
            current: agentId,
            parent: parentId,
            depth: parentId ? 1 : 0
        };
    }

    static _calculateThroughput(result, duration) {
        if (!result || !duration) return 0;

        const dataSize = JSON.stringify(result).length;
        return dataSize / (duration / 1000); // bytes per second
    }

    static _deriveTaskStatus(eventType) {
        switch (eventType) {
            case SUPERCLAUDE_EVENT_TYPES.TASK_CREATED: return 'created';
            case SUPERCLAUDE_EVENT_TYPES.TASK_STARTED: return 'running';
            case SUPERCLAUDE_EVENT_TYPES.TASK_COMPLETED: return 'completed';
            case SUPERCLAUDE_EVENT_TYPES.TASK_FAILED: return 'failed';
            default: return 'unknown';
        }
    }

    static _generateReasoningExplanation(decision, strategy, confidence) {
        return {
            summary: `Decision made with ${confidence}% confidence`,
            factors: ['pattern_matching', 'historical_data', 'heuristics'],
            reasoning: 'AI-driven decision making process'
        };
    }

    static _analyzePerformanceMetrics(metrics, thresholds) {
        const analysis = {};

        Object.keys(metrics).forEach(key => {
            const value = metrics[key];
            const threshold = thresholds[key];

            if (threshold) {
                analysis[key] = {
                    value,
                    threshold,
                    status: value <= threshold ? 'ok' : 'exceeded',
                    ratio: threshold > 0 ? (value / threshold).toFixed(2) : 0
                };
            }
        });

        return analysis;
    }

    static _generatePerformanceRecommendations(metrics, alerts) {
        const recommendations = [];

        alerts.forEach(alert => {
            recommendations.push({
                type: 'optimization',
                priority: alert.severity || 'medium',
                action: `Optimize ${alert.component} performance`,
                expectedImpact: 'medium'
            });
        });

        return recommendations;
    }
}

/**
 * SuperClaude事件驗證器
 */
class SuperClaudeEventValidator {
    static validate(event) {
        const errors = [];

        if (!event || typeof event !== 'object') {
            return { valid: false, errors: ['事件必須是對象'] };
        }

        if (!event.type || !Object.values(SUPERCLAUDE_EVENT_TYPES).includes(event.type)) {
            errors.push('無效的SuperClaude事件類型');
        }

        const typeSpecificErrors = this._validateEventTypeSpecific(event);
        errors.push(...typeSpecificErrors);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static _validateEventTypeSpecific(event) {
        const errors = [];

        switch (event.type) {
            case SUPERCLAUDE_EVENT_TYPES.WORKFLOW_STARTED:
            case SUPERCLAUDE_EVENT_TYPES.WORKFLOW_COMPLETED:
                if (!event.data.workflow || !event.data.workflow.id) {
                    errors.push('工作流事件必須包含workflow.id');
                }
                break;

            case SUPERCLAUDE_EVENT_TYPES.ANALYSIS_COMPLETED:
                if (!event.data.analysis || !event.data.analysis.type) {
                    errors.push('分析事件必須包含analysis.type');
                }
                break;

            case SUPERCLAUDE_EVENT_TYPES.AGENT_SPAWNED:
            case SUPERCLAUDE_EVENT_TYPES.AGENT_COMPLETED:
                if (!event.data.agent || !event.data.agent.id) {
                    errors.push('代理事件必須包含agent.id');
                }
                break;

            case SUPERCLAUDE_EVENT_TYPES.MCP_TOOL_INVOKED:
                if (!event.data.mcp || !event.data.mcp.toolName) {
                    errors.push('MCP工具事件必須包含toolName');
                }
                break;
        }

        return errors;
    }
}

/**
 * SuperClaude事件工具函數
 */
const SuperClaudeEventUtils = {
    isWorkflowEvent(event) {
        return [
            SUPERCLAUDE_EVENT_TYPES.WORKFLOW_STARTED,
            SUPERCLAUDE_EVENT_TYPES.WORKFLOW_STEP_EXECUTED,
            SUPERCLAUDE_EVENT_TYPES.WORKFLOW_COMPLETED,
            SUPERCLAUDE_EVENT_TYPES.WORKFLOW_FAILED
        ].includes(event.type);
    },

    isAnalysisEvent(event) {
        return [
            SUPERCLAUDE_EVENT_TYPES.ANALYSIS_STARTED,
            SUPERCLAUDE_EVENT_TYPES.ANALYSIS_COMPLETED,
            SUPERCLAUDE_EVENT_TYPES.CODE_ANALYSIS_COMPLETED,
            SUPERCLAUDE_EVENT_TYPES.ARCHITECTURE_ANALYSIS_COMPLETED
        ].includes(event.type);
    },

    isMCPEvent(event) {
        return [
            SUPERCLAUDE_EVENT_TYPES.MCP_SERVER_CONNECTED,
            SUPERCLAUDE_EVENT_TYPES.MCP_TOOL_INVOKED,
            SUPERCLAUDE_EVENT_TYPES.MCP_TOOL_COMPLETED
        ].includes(event.type);
    },

    getWorkflowProgress(event) {
        if (!this.isWorkflowEvent(event) || !event.data.step) {
            return 0;
        }

        return parseFloat(event.data.step.progress) || 0;
    },

    extractPerformanceMetrics(event) {
        const metrics = {};

        if (event.data?.duration) {
            metrics.duration = event.data.duration;
        }

        if (event.data?.performance) {
            Object.assign(metrics, event.data.performance);
        }

        if (event.data?.metrics) {
            Object.assign(metrics, event.data.metrics);
        }

        return metrics;
    }
};

module.exports = {
    SUPERCLAUDE_EVENT_TYPES,
    WORKFLOW_STATUS,
    ANALYSIS_TYPES,
    MCP_SERVER_TYPES,
    SuperClaudeEventFactory,
    SuperClaudeEventValidator,
    SuperClaudeEventUtils
};