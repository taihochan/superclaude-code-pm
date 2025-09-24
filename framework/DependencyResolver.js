/**
 * DependencyResolver - 依賴關係解析器
 *
 * 功能：
 * - 分析任務間的依賴關係並構建執行DAG
 * - 計算關鍵路徑和執行順序優化
 * - 檢測循環依賴和死鎖情況
 * - 支持動態依賴調整和重新排程
 * - 提供依賴圖可視化和分析工具
 *
 * 用途：為並行執行協調器提供智能的任務調度支持
 * 配合：與AgentManager和ResourceManager協作實現最優執行策略
 */

import { EventEmitter } from 'events';

/**
 * 任務節點類
 */
class TaskNode {
    constructor(id, task, options = {}) {
        this.id = id;
        this.task = task;
        this.options = {
            priority: 0,
            estimatedTime: 1000, // 預估執行時間（毫秒）
            requiredResources: { cpu: 1, memory: 256 }, // 資源需求
            retryable: true,
            timeout: 30000,
            ...options
        };

        this.dependencies = new Set(); // 依賴的任務ID
        this.dependents = new Set(); // 依賴此任務的任務ID
        this.status = 'pending'; // pending, ready, running, completed, failed
        this.startTime = null;
        this.endTime = null;
        this.result = null;
        this.error = null;
        this.retryCount = 0;

        // 執行路徑分析
        this.depth = 0; // 在DAG中的深度
        this.isOnCriticalPath = false; // 是否在關鍵路徑上
        this.earliestStart = 0; // 最早開始時間
        this.latestStart = 0; // 最晚開始時間
        this.slack = 0; // 時間裕度
    }

    /**
     * 添加依賴
     */
    addDependency(taskId) {
        this.dependencies.add(taskId);
    }

    /**
     * 移除依賴
     */
    removeDependency(taskId) {
        this.dependencies.delete(taskId);
    }

    /**
     * 添加依賴者
     */
    addDependent(taskId) {
        this.dependents.add(taskId);
    }

    /**
     * 移除依賴者
     */
    removeDependent(taskId) {
        this.dependents.delete(taskId);
    }

    /**
     * 檢查是否就緒
     */
    isReady(completedTasks) {
        return Array.from(this.dependencies).every(depId =>
            completedTasks.has(depId)
        );
    }

    /**
     * 計算預估完成時間
     */
    getEstimatedCompletionTime() {
        return this.startTime ?
            this.startTime + this.options.estimatedTime :
            this.options.estimatedTime;
    }

    /**
     * 獲取節點狀態摘要
     */
    getSummary() {
        return {
            id: this.id,
            status: this.status,
            priority: this.options.priority,
            dependencies: Array.from(this.dependencies),
            dependents: Array.from(this.dependents),
            estimatedTime: this.options.estimatedTime,
            isOnCriticalPath: this.isOnCriticalPath,
            slack: this.slack,
            depth: this.depth
        };
    }
}

/**
 * 有向無環圖 (DAG) 類
 */
class DAG {
    constructor() {
        this.nodes = new Map(); // taskId -> TaskNode
        this.edges = new Map(); // fromId -> Set<toId>
        this.reverseEdges = new Map(); // toId -> Set<fromId>
        this.topologicalOrder = [];
        this.criticalPath = [];
        this.totalExecutionTime = 0;
    }

    /**
     * 添加節點
     */
    addNode(taskNode) {
        this.nodes.set(taskNode.id, taskNode);

        if (!this.edges.has(taskNode.id)) {
            this.edges.set(taskNode.id, new Set());
        }
        if (!this.reverseEdges.has(taskNode.id)) {
            this.reverseEdges.set(taskNode.id, new Set());
        }
    }

    /**
     * 移除節點
     */
    removeNode(taskId) {
        const node = this.nodes.get(taskId);
        if (!node) return false;

        // 移除所有相關的邊
        this.edges.get(taskId)?.forEach(toId => {
            this.reverseEdges.get(toId)?.delete(taskId);
            this.nodes.get(toId)?.removeDependent(taskId);
        });

        this.reverseEdges.get(taskId)?.forEach(fromId => {
            this.edges.get(fromId)?.delete(taskId);
            this.nodes.get(fromId)?.addDependent(taskId);
        });

        // 移除節點
        this.nodes.delete(taskId);
        this.edges.delete(taskId);
        this.reverseEdges.delete(taskId);

        return true;
    }

    /**
     * 添加邊（依賴關係）
     */
    addEdge(fromId, toId) {
        // 檢查是否會形成循環
        if (this.wouldCreateCycle(fromId, toId)) {
            throw new Error(`添加依賴 ${fromId} -> ${toId} 會形成循環依賴`);
        }

        // 添加邊
        this.edges.get(fromId)?.add(toId);
        this.reverseEdges.get(toId)?.add(fromId);

        // 更新節點依賴關係
        this.nodes.get(fromId)?.addDependent(toId);
        this.nodes.get(toId)?.addDependency(fromId);
    }

    /**
     * 移除邊
     */
    removeEdge(fromId, toId) {
        this.edges.get(fromId)?.delete(toId);
        this.reverseEdges.get(toId)?.delete(fromId);

        this.nodes.get(fromId)?.removeDependent(toId);
        this.nodes.get(toId)?.removeDependency(fromId);
    }

    /**
     * 檢查是否會形成循環
     */
    wouldCreateCycle(fromId, toId) {
        if (fromId === toId) return true;

        const visited = new Set();
        const stack = [toId];

        while (stack.length > 0) {
            const currentId = stack.pop();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            if (currentId === fromId) return true;

            const outgoing = this.edges.get(currentId);
            if (outgoing) {
                stack.push(...outgoing);
            }
        }

        return false;
    }

    /**
     * 拓撲排序
     */
    topologicalSort() {
        const inDegree = new Map();
        const queue = [];
        const result = [];

        // 計算入度
        for (const [nodeId] of this.nodes) {
            inDegree.set(nodeId, this.reverseEdges.get(nodeId)?.size || 0);
            if (inDegree.get(nodeId) === 0) {
                queue.push(nodeId);
            }
        }

        // Kahn算法
        while (queue.length > 0) {
            const currentId = queue.shift();
            result.push(currentId);

            const outgoing = this.edges.get(currentId);
            if (outgoing) {
                for (const neighborId of outgoing) {
                    const newInDegree = inDegree.get(neighborId) - 1;
                    inDegree.set(neighborId, newInDegree);

                    if (newInDegree === 0) {
                        queue.push(neighborId);
                    }
                }
            }
        }

        // 檢查是否有循環
        if (result.length !== this.nodes.size) {
            throw new Error('圖中存在循環依賴');
        }

        this.topologicalOrder = result;
        return result;
    }

    /**
     * 計算關鍵路徑
     */
    calculateCriticalPath() {
        // 先進行拓撲排序
        this.topologicalSort();

        // 正向傳播計算最早開始時間
        for (const taskId of this.topologicalOrder) {
            const node = this.nodes.get(taskId);
            let maxPrereqTime = 0;

            for (const depId of node.dependencies) {
                const depNode = this.nodes.get(depId);
                const completionTime = depNode.earliestStart + depNode.options.estimatedTime;
                maxPrereqTime = Math.max(maxPrereqTime, completionTime);
            }

            node.earliestStart = maxPrereqTime;
        }

        // 找到項目總時間
        this.totalExecutionTime = Math.max(
            ...Array.from(this.nodes.values()).map(node =>
                node.earliestStart + node.options.estimatedTime
            )
        );

        // 反向傳播計算最晚開始時間
        const reverseOrder = [...this.topologicalOrder].reverse();

        for (const taskId of reverseOrder) {
            const node = this.nodes.get(taskId);

            if (node.dependents.size === 0) {
                // 末尾節點
                node.latestStart = this.totalExecutionTime - node.options.estimatedTime;
            } else {
                let minSuccessorStart = Infinity;

                for (const depId of node.dependents) {
                    const depNode = this.nodes.get(depId);
                    minSuccessorStart = Math.min(minSuccessorStart, depNode.latestStart);
                }

                node.latestStart = minSuccessorStart - node.options.estimatedTime;
            }

            // 計算裕度
            node.slack = node.latestStart - node.earliestStart;

            // 標記關鍵路徑
            node.isOnCriticalPath = node.slack === 0;
        }

        // 構建關鍵路徑
        this.criticalPath = this.topologicalOrder.filter(taskId =>
            this.nodes.get(taskId).isOnCriticalPath
        );

        return this.criticalPath;
    }

    /**
     * 獲取就緒的任務
     */
    getReadyTasks(completedTasks = new Set()) {
        const readyTasks = [];

        for (const [taskId, node] of this.nodes) {
            if (node.status === 'pending' && node.isReady(completedTasks)) {
                node.status = 'ready';
                readyTasks.push(node);
            }
        }

        // 按優先級排序（優先級高的先執行）
        readyTasks.sort((a, b) => {
            // 關鍵路徑任務優先
            if (a.isOnCriticalPath && !b.isOnCriticalPath) return -1;
            if (!a.isOnCriticalPath && b.isOnCriticalPath) return 1;

            // 然後按優先級
            if (a.options.priority !== b.options.priority) {
                return b.options.priority - a.options.priority;
            }

            // 最後按裕度（裕度小的先執行）
            return a.slack - b.slack;
        });

        return readyTasks;
    }

    /**
     * 計算節點深度
     */
    calculateDepths() {
        const depths = new Map();

        const calculateDepth = (nodeId) => {
            if (depths.has(nodeId)) {
                return depths.get(nodeId);
            }

            const dependencies = this.reverseEdges.get(nodeId) || new Set();
            if (dependencies.size === 0) {
                depths.set(nodeId, 0);
                return 0;
            }

            let maxDepth = 0;
            for (const depId of dependencies) {
                const depDepth = calculateDepth(depId);
                maxDepth = Math.max(maxDepth, depDepth + 1);
            }

            depths.set(nodeId, maxDepth);
            return maxDepth;
        };

        // 計算所有節點的深度
        for (const [nodeId, node] of this.nodes) {
            node.depth = calculateDepth(nodeId);
        }
    }

    /**
     * 獲取圖狀態摘要
     */
    getSummary() {
        return {
            totalNodes: this.nodes.size,
            totalEdges: Array.from(this.edges.values()).reduce((sum, set) => sum + set.size, 0),
            topologicalOrder: this.topologicalOrder,
            criticalPath: this.criticalPath,
            totalExecutionTime: this.totalExecutionTime,
            nodes: Array.from(this.nodes.values()).map(node => node.getSummary())
        };
    }
}

/**
 * 依賴關係解析器主類
 */
class DependencyResolver extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // 分析配置
            enableCriticalPathAnalysis: true,
            enableResourceOptimization: true,
            enableDeadlockDetection: true,

            // 性能配置
            maxTasksPerBatch: 100,
            analysisTimeout: 10000,

            // 依賴策略配置
            autoResolveDependencies: true,
            dependencyResolutionTimeout: 5000,
            maxCircularDependencyDetectionDepth: 50,

            ...options
        };

        this.dags = new Map(); // executionId -> DAG
        this.taskRegistry = new Map(); // taskId -> task definition

        // 分析結果緩存
        this.analysisCache = new Map();

        // 統計信息
        this.stats = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            circularDependenciesDetected: 0,
            criticalPathsCalculated: 0,
            averageAnalysisTime: 0
        };
    }

    /**
     * 分析任務依賴關係
     * @param {Array} tasks - 任務列表
     * @param {Object} options - 分析選項
     * @returns {Object} - 分析結果
     */
    async analyzeDependencies(tasks, options = {}) {
        const startTime = Date.now();
        const analysisId = this._generateAnalysisId();

        try {
            console.log(`[DependencyResolver] 開始分析 ${tasks.length} 個任務的依賴關係`);

            // 創建DAG
            const dag = await this._buildDAG(tasks, options);
            this.dags.set(analysisId, dag);

            // 執行分析流程
            const analysis = await this._performDependencyAnalysis(dag, options);

            // 更新統計
            const analysisTime = Date.now() - startTime;
            this._updateAnalysisStats(analysis, analysisTime);

            const result = {
                id: analysisId,
                success: true,
                dag,
                analysis,
                analysisTime,
                timestamp: new Date().toISOString()
            };

            this.emit('analysisCompleted', result);
            return result;

        } catch (error) {
            console.error(`[DependencyResolver] 依賴分析失敗:`, error);

            const result = {
                id: analysisId,
                success: false,
                error: error.message,
                analysisTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            this.emit('analysisFailed', result);
            throw error;
        }
    }

    /**
     * 獲取執行計劃
     * @param {string} analysisId - 分析ID
     * @param {Object} options - 執行選項
     * @returns {Object} - 執行計劃
     */
    getExecutionPlan(analysisId, options = {}) {
        const dag = this.dags.get(analysisId);
        if (!dag) {
            throw new Error(`分析結果不存在: ${analysisId}`);
        }

        const plan = {
            id: analysisId,
            totalTasks: dag.nodes.size,
            estimatedTotalTime: dag.totalExecutionTime,
            criticalPath: dag.criticalPath,

            // 執行階段
            phases: this._calculateExecutionPhases(dag),

            // 資源需求
            resourceRequirements: this._calculateResourceRequirements(dag),

            // 並行度分析
            parallelism: this._analyzeParallelism(dag),

            // 風險評估
            risks: this._assessExecutionRisks(dag)
        };

        return plan;
    }

    /**
     * 動態調整依賴關係
     * @param {string} analysisId - 分析ID
     * @param {Object} adjustments - 調整指令
     * @returns {Object} - 調整結果
     */
    async adjustDependencies(analysisId, adjustments) {
        const dag = this.dags.get(analysisId);
        if (!dag) {
            throw new Error(`分析結果不存在: ${analysisId}`);
        }

        const changes = [];

        try {
            // 處理添加依賴
            if (adjustments.addDependencies) {
                for (const { from, to } of adjustments.addDependencies) {
                    dag.addEdge(from, to);
                    changes.push({ type: 'add', from, to });
                }
            }

            // 處理移除依賴
            if (adjustments.removeDependencies) {
                for (const { from, to } of adjustments.removeDependencies) {
                    dag.removeEdge(from, to);
                    changes.push({ type: 'remove', from, to });
                }
            }

            // 處理任務更新
            if (adjustments.updateTasks) {
                for (const { taskId, updates } of adjustments.updateTasks) {
                    const node = dag.nodes.get(taskId);
                    if (node) {
                        Object.assign(node.options, updates);
                        changes.push({ type: 'update', taskId, updates });
                    }
                }
            }

            // 重新計算關鍵路徑
            if (changes.length > 0) {
                dag.calculateCriticalPath();

                this.emit('dependenciesAdjusted', {
                    analysisId,
                    changes,
                    newCriticalPath: dag.criticalPath
                });
            }

            return {
                success: true,
                changes,
                criticalPath: dag.criticalPath,
                totalExecutionTime: dag.totalExecutionTime
            };

        } catch (error) {
            console.error('[DependencyResolver] 調整依賴關係失敗:', error);
            throw error;
        }
    }

    /**
     * 檢測死鎖情況
     * @param {string} analysisId - 分析ID
     * @param {Set} runningTasks - 正在執行的任務
     * @returns {Object} - 檢測結果
     */
    detectDeadlock(analysisId, runningTasks = new Set()) {
        const dag = this.dags.get(analysisId);
        if (!dag) {
            throw new Error(`分析結果不存在: ${analysisId}`);
        }

        const deadlocks = [];
        const visited = new Set();

        // 檢測等待循環
        for (const taskId of runningTasks) {
            const node = dag.nodes.get(taskId);
            if (!node || visited.has(taskId)) continue;

            const cycle = this._detectWaitingCycle(dag, taskId, new Set(), new Set());
            if (cycle.length > 0) {
                deadlocks.push({
                    type: 'waiting_cycle',
                    tasks: cycle,
                    description: `任務等待循環: ${cycle.join(' -> ')}`
                });
            }
        }

        // 檢測資源死鎖
        const resourceDeadlocks = this._detectResourceDeadlocks(dag, runningTasks);
        deadlocks.push(...resourceDeadlocks);

        return {
            hasDeadlock: deadlocks.length > 0,
            deadlocks,
            recommendations: this._generateDeadlockResolutions(deadlocks)
        };
    }

    /**
     * 獲取依賴統計
     */
    getDependencyStats() {
        return {
            ...this.stats,
            activeAnalyses: this.dags.size,
            cacheSize: this.analysisCache.size
        };
    }

    /**
     * 清理分析結果
     * @param {string} analysisId - 分析ID（可選）
     */
    cleanup(analysisId = null) {
        if (analysisId) {
            this.dags.delete(analysisId);
            this.analysisCache.delete(analysisId);
        } else {
            this.dags.clear();
            this.analysisCache.clear();
        }
    }

    // ========== 私有方法 ==========

    /**
     * 構建DAG
     * @private
     */
    async _buildDAG(tasks, options) {
        const dag = new DAG();

        // 第一階段：添加所有節點
        for (const task of tasks) {
            const taskNode = new TaskNode(
                task.id,
                task,
                {
                    priority: task.priority || 0,
                    estimatedTime: task.estimatedTime || 1000,
                    requiredResources: task.requiredResources || { cpu: 1, memory: 256 },
                    ...task.options
                }
            );

            dag.addNode(taskNode);
            this.taskRegistry.set(task.id, task);
        }

        // 第二階段：添加依賴關係
        for (const task of tasks) {
            if (task.dependencies) {
                for (const depId of task.dependencies) {
                    if (!dag.nodes.has(depId)) {
                        throw new Error(`依賴任務不存在: ${depId}`);
                    }
                    dag.addEdge(depId, task.id);
                }
            }
        }

        // 第三階段：自動推導依賴關係
        if (this.options.autoResolveDependencies) {
            await this._autoResolveDependencies(dag, tasks);
        }

        return dag;
    }

    /**
     * 執行依賴分析
     * @private
     */
    async _performDependencyAnalysis(dag, options) {
        const analysis = {};

        // 拓撲排序
        try {
            analysis.topologicalOrder = dag.topologicalSort();
            analysis.hasCycles = false;
        } catch (error) {
            analysis.hasCycles = true;
            analysis.cycleError = error.message;
            throw error;
        }

        // 計算關鍵路徑
        if (this.options.enableCriticalPathAnalysis) {
            analysis.criticalPath = dag.calculateCriticalPath();
            analysis.totalExecutionTime = dag.totalExecutionTime;
            this.stats.criticalPathsCalculated++;
        }

        // 計算節點深度
        dag.calculateDepths();

        // 分析並行度
        analysis.maxParallelism = this._calculateMaxParallelism(dag);
        analysis.averageParallelism = this._calculateAverageParallelism(dag);

        // 資源分析
        if (this.options.enableResourceOptimization) {
            analysis.resourceProfile = this._analyzeResourceProfile(dag);
        }

        // 風險評估
        analysis.risks = this._assessDependencyRisks(dag);

        return analysis;
    }

    /**
     * 自動解析依賴關係
     * @private
     */
    async _autoResolveDependencies(dag, tasks) {
        // 基於任務類型推導依賴
        const tasksByType = new Map();

        for (const task of tasks) {
            const type = task.type || 'generic';
            if (!tasksByType.has(type)) {
                tasksByType.set(type, []);
            }
            tasksByType.get(type).push(task);
        }

        // 應用類型依賴規則
        await this._applyTypeDependencyRules(dag, tasksByType);

        // 基於輸入輸出推導依賴
        await this._resolveInputOutputDependencies(dag, tasks);
    }

    /**
     * 應用類型依賴規則
     * @private
     */
    async _applyTypeDependencyRules(dag, tasksByType) {
        // 內置依賴規則
        const dependencyRules = [
            {
                from: 'analysis',
                to: 'implementation',
                description: '分析任務必須在實現任務前完成'
            },
            {
                from: 'setup',
                to: '*',
                description: '設置任務必須最先執行'
            },
            {
                from: 'implementation',
                to: 'testing',
                description: '實現任務必須在測試任務前完成'
            },
            {
                from: 'testing',
                to: 'deployment',
                description: '測試任務必須在部署任務前完成'
            }
        ];

        for (const rule of dependencyRules) {
            const fromTasks = tasksByType.get(rule.from) || [];
            const toTasks = rule.to === '*' ?
                Array.from(tasksByType.values()).flat() :
                tasksByType.get(rule.to) || [];

            for (const fromTask of fromTasks) {
                for (const toTask of toTasks) {
                    if (fromTask.id !== toTask.id) {
                        try {
                            dag.addEdge(fromTask.id, toTask.id);
                        } catch (error) {
                            // 忽略循環依賴錯誤，由後續檢查處理
                        }
                    }
                }
            }
        }
    }

    /**
     * 解析輸入輸出依賴
     * @private
     */
    async _resolveInputOutputDependencies(dag, tasks) {
        const outputMap = new Map(); // output -> producing task

        // 構建輸出映射
        for (const task of tasks) {
            if (task.outputs) {
                for (const output of task.outputs) {
                    outputMap.set(output, task.id);
                }
            }
        }

        // 添加輸入依賴
        for (const task of tasks) {
            if (task.inputs) {
                for (const input of task.inputs) {
                    const producingTaskId = outputMap.get(input);
                    if (producingTaskId && producingTaskId !== task.id) {
                        try {
                            dag.addEdge(producingTaskId, task.id);
                        } catch (error) {
                            // 記錄循環依賴但不中斷處理
                            console.warn(`檢測到循環依賴: ${producingTaskId} -> ${task.id}`);
                        }
                    }
                }
            }
        }
    }

    /**
     * 計算執行階段
     * @private
     */
    _calculateExecutionPhases(dag) {
        const phases = [];
        const visited = new Set();
        const currentPhase = [];

        // 按深度分組任務
        const tasksByDepth = new Map();

        for (const [taskId, node] of dag.nodes) {
            const depth = node.depth;
            if (!tasksByDepth.has(depth)) {
                tasksByDepth.set(depth, []);
            }
            tasksByDepth.get(depth).push(node);
        }

        // 創建執行階段
        const maxDepth = Math.max(...tasksByDepth.keys());
        for (let depth = 0; depth <= maxDepth; depth++) {
            const tasks = tasksByDepth.get(depth) || [];
            if (tasks.length > 0) {
                phases.push({
                    phase: depth,
                    tasks: tasks.map(node => node.id),
                    estimatedTime: Math.max(...tasks.map(node => node.options.estimatedTime)),
                    parallelTasks: tasks.length,
                    criticalTasks: tasks.filter(node => node.isOnCriticalPath).map(node => node.id)
                });
            }
        }

        return phases;
    }

    /**
     * 計算資源需求
     * @private
     */
    _calculateResourceRequirements(dag) {
        const resources = { cpu: 0, memory: 0, network: 0, storage: 0 };
        const peakResources = { cpu: 0, memory: 0, network: 0, storage: 0 };

        // 計算總資源需求
        for (const [taskId, node] of dag.nodes) {
            const req = node.options.requiredResources || {};
            resources.cpu += req.cpu || 1;
            resources.memory += req.memory || 256;
            resources.network += req.network || 0;
            resources.storage += req.storage || 0;
        }

        // 計算峰值資源需求（同一階段並行任務）
        const phases = this._calculateExecutionPhases(dag);

        for (const phase of phases) {
            let phaseCpu = 0, phaseMemory = 0, phaseNetwork = 0, phaseStorage = 0;

            for (const taskId of phase.tasks) {
                const node = dag.nodes.get(taskId);
                const req = node.options.requiredResources || {};
                phaseCpu += req.cpu || 1;
                phaseMemory += req.memory || 256;
                phaseNetwork += req.network || 0;
                phaseStorage += req.storage || 0;
            }

            peakResources.cpu = Math.max(peakResources.cpu, phaseCpu);
            peakResources.memory = Math.max(peakResources.memory, phaseMemory);
            peakResources.network = Math.max(peakResources.network, phaseNetwork);
            peakResources.storage = Math.max(peakResources.storage, phaseStorage);
        }

        return { total: resources, peak: peakResources };
    }

    /**
     * 分析並行度
     * @private
     */
    _analyzeParallelism(dag) {
        const phases = this._calculateExecutionPhases(dag);
        const parallelismData = phases.map(phase => ({
            phase: phase.phase,
            parallelTasks: phase.parallelTasks,
            estimatedTime: phase.estimatedTime
        }));

        return {
            maxParallelism: Math.max(...phases.map(p => p.parallelTasks)),
            averageParallelism: phases.reduce((sum, p) => sum + p.parallelTasks, 0) / phases.length,
            phases: parallelismData,
            efficiency: this._calculateParallelismEfficiency(phases)
        };
    }

    /**
     * 評估執行風險
     * @private
     */
    _assessExecutionRisks(dag) {
        const risks = [];

        // 檢查長關鍵路徑
        if (dag.criticalPath.length > dag.nodes.size * 0.5) {
            risks.push({
                type: 'long_critical_path',
                severity: 'high',
                description: '關鍵路徑過長，執行時間風險高',
                affectedTasks: dag.criticalPath
            });
        }

        // 檢查單點故障
        const bottlenecks = this._identifyBottlenecks(dag);
        for (const bottleneck of bottlenecks) {
            risks.push({
                type: 'bottleneck',
                severity: 'medium',
                description: `任務 ${bottleneck} 是瓶頸點`,
                affectedTasks: [bottleneck]
            });
        }

        // 檢查資源衝突
        const resourceConflicts = this._detectResourceConflicts(dag);
        risks.push(...resourceConflicts);

        return risks;
    }

    /**
     * 檢測等待循環
     * @private
     */
    _detectWaitingCycle(dag, startTaskId, visited, recursionStack) {
        if (recursionStack.has(startTaskId)) {
            // 找到循環
            const cycle = Array.from(recursionStack);
            const startIndex = cycle.indexOf(startTaskId);
            return cycle.slice(startIndex);
        }

        if (visited.has(startTaskId)) {
            return [];
        }

        visited.add(startTaskId);
        recursionStack.add(startTaskId);

        const node = dag.nodes.get(startTaskId);
        if (node) {
            for (const depId of node.dependencies) {
                const cycle = this._detectWaitingCycle(dag, depId, visited, recursionStack);
                if (cycle.length > 0) {
                    return cycle;
                }
            }
        }

        recursionStack.delete(startTaskId);
        return [];
    }

    /**
     * 檢測資源死鎖
     * @private
     */
    _detectResourceDeadlocks(dag, runningTasks) {
        // 簡化的資源死鎖檢測
        // 實際實現需要更複雜的資源分配圖分析
        return [];
    }

    /**
     * 生成死鎖解決方案
     * @private
     */
    _generateDeadlockResolutions(deadlocks) {
        const resolutions = [];

        for (const deadlock of deadlocks) {
            switch (deadlock.type) {
                case 'waiting_cycle':
                    resolutions.push({
                        type: 'break_dependency',
                        description: '移除循環依賴中的一個邊',
                        action: `移除依賴: ${deadlock.tasks[0]} -> ${deadlock.tasks[1]}`
                    });
                    break;

                case 'resource_conflict':
                    resolutions.push({
                        type: 'resource_reallocation',
                        description: '重新分配資源或調整執行順序',
                        action: '增加資源池或序列化衝突任務'
                    });
                    break;
            }
        }

        return resolutions;
    }

    /**
     * 識別瓶頸點
     * @private
     */
    _identifyBottlenecks(dag) {
        const bottlenecks = [];

        for (const [taskId, node] of dag.nodes) {
            // 檢查是否有大量依賴者
            if (node.dependents.size > dag.nodes.size * 0.2) {
                bottlenecks.push(taskId);
            }
        }

        return bottlenecks;
    }

    /**
     * 檢測資源衝突
     * @private
     */
    _detectResourceConflicts(dag) {
        // 簡化實現，實際需要分析同時執行的任務資源需求
        return [];
    }

    /**
     * 計算並行度效率
     * @private
     */
    _calculateParallelismEfficiency(phases) {
        const totalTasks = phases.reduce((sum, p) => sum + p.parallelTasks, 0);
        const idealParallel = totalTasks / phases.length;
        const actualMax = Math.max(...phases.map(p => p.parallelTasks));

        return Math.min(1, idealParallel / actualMax);
    }

    /**
     * 計算最大並行度
     * @private
     */
    _calculateMaxParallelism(dag) {
        const tasksByDepth = new Map();

        for (const [taskId, node] of dag.nodes) {
            const depth = node.depth;
            if (!tasksByDepth.has(depth)) {
                tasksByDepth.set(depth, 0);
            }
            tasksByDepth.set(depth, tasksByDepth.get(depth) + 1);
        }

        return Math.max(...tasksByDepth.values());
    }

    /**
     * 計算平均並行度
     * @private
     */
    _calculateAverageParallelism(dag) {
        const tasksByDepth = new Map();

        for (const [taskId, node] of dag.nodes) {
            const depth = node.depth;
            if (!tasksByDepth.has(depth)) {
                tasksByDepth.set(depth, 0);
            }
            tasksByDepth.set(depth, tasksByDepth.get(depth) + 1);
        }

        const depths = Array.from(tasksByDepth.values());
        return depths.reduce((sum, count) => sum + count, 0) / depths.length;
    }

    /**
     * 分析資源配置文件
     * @private
     */
    _analyzeResourceProfile(dag) {
        const phases = this._calculateExecutionPhases(dag);
        const profile = {
            phases: [],
            peakUsage: { cpu: 0, memory: 0, network: 0, storage: 0 },
            averageUsage: { cpu: 0, memory: 0, network: 0, storage: 0 }
        };

        for (const phase of phases) {
            const phaseResources = { cpu: 0, memory: 0, network: 0, storage: 0 };

            for (const taskId of phase.tasks) {
                const node = dag.nodes.get(taskId);
                const req = node.options.requiredResources || {};
                phaseResources.cpu += req.cpu || 1;
                phaseResources.memory += req.memory || 256;
                phaseResources.network += req.network || 0;
                phaseResources.storage += req.storage || 0;
            }

            profile.phases.push({
                phase: phase.phase,
                resources: phaseResources,
                duration: phase.estimatedTime
            });

            // 更新峰值
            profile.peakUsage.cpu = Math.max(profile.peakUsage.cpu, phaseResources.cpu);
            profile.peakUsage.memory = Math.max(profile.peakUsage.memory, phaseResources.memory);
            profile.peakUsage.network = Math.max(profile.peakUsage.network, phaseResources.network);
            profile.peakUsage.storage = Math.max(profile.peakUsage.storage, phaseResources.storage);
        }

        // 計算平均使用量
        const totalPhases = profile.phases.length;
        if (totalPhases > 0) {
            profile.averageUsage.cpu = profile.phases.reduce((sum, p) => sum + p.resources.cpu, 0) / totalPhases;
            profile.averageUsage.memory = profile.phases.reduce((sum, p) => sum + p.resources.memory, 0) / totalPhases;
            profile.averageUsage.network = profile.phases.reduce((sum, p) => sum + p.resources.network, 0) / totalPhases;
            profile.averageUsage.storage = profile.phases.reduce((sum, p) => sum + p.resources.storage, 0) / totalPhases;
        }

        return profile;
    }

    /**
     * 評估依賴風險
     * @private
     */
    _assessDependencyRisks(dag) {
        const risks = [];

        // 檢查深度過深
        const maxDepth = Math.max(...Array.from(dag.nodes.values()).map(n => n.depth));
        if (maxDepth > 10) {
            risks.push({
                type: 'deep_dependency_chain',
                severity: 'medium',
                description: '依賴鏈過深，可能影響執行靈活性'
            });
        }

        return risks;
    }

    /**
     * 更新分析統計
     * @private
     */
    _updateAnalysisStats(analysis, analysisTime) {
        this.stats.totalAnalyses++;

        if (!analysis.hasCycles) {
            this.stats.successfulAnalyses++;
        } else {
            this.stats.circularDependenciesDetected++;
        }

        // 更新平均分析時間
        this.stats.averageAnalysisTime = (
            this.stats.averageAnalysisTime * (this.stats.totalAnalyses - 1) + analysisTime
        ) / this.stats.totalAnalyses;
    }

    /**
     * 生成分析ID
     * @private
     */
    _generateAnalysisId() {
        return `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export default DependencyResolver;