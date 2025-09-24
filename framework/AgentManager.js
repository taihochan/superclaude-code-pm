/**
 * AgentManager - Agent生命週期管理器
 *
 * 功能：
 * - 管理多個Agent實例的創建、啟動、停止、重啟
 * - Agent狀態監控和健康檢查
 * - Agent間通信和協調機制
 * - 支持Agent負載均衡和故障轉移
 * - 提供Agent性能統計和診斷工具
 *
 * 用途：為並行執行協調器提供Agent實例管理和協調支持
 * 配合：與ResourceManager和DependencyResolver協作實現最優Agent調度
 */

const { EventEmitter } = require('events');
const { Worker } = require('worker_threads');
const EventBus = require('./EventBus');

/**
 * Agent狀態定義
 */
const AGENT_STATUS = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    RUNNING: 'running',
    BUSY: 'busy',
    IDLE: 'idle',
    PAUSED: 'paused',
    STOPPING: 'stopping',
    STOPPED: 'stopped',
    ERROR: 'error',
    CRASHED: 'crashed'
};

/**
 * Agent類型定義
 */
const AGENT_TYPES = {
    CCPM: 'ccpm',
    SUPERCLAUDE: 'superclaude',
    ANALYSIS: 'analysis',
    IMPLEMENTATION: 'implementation',
    TESTING: 'testing',
    INTEGRATION: 'integration',
    GENERIC: 'generic'
};

/**
 * Agent實例類
 */
class AgentInstance extends EventEmitter {
    constructor(id, config, options = {}) {
        super();

        this.id = id;
        this.type = config.type || AGENT_TYPES.GENERIC;
        this.config = {
            maxConcurrentTasks: 3,
            heartbeatInterval: 5000,
            healthCheckInterval: 30000,
            maxIdleTime: 300000, // 5分鐘
            maxMemoryUsage: 512 * 1024 * 1024, // 512MB
            enableProfiling: false,
            ...config
        };

        this.options = {
            autoRestart: true,
            restartDelay: 2000,
            maxRestartAttempts: 3,
            ...options
        };

        // Agent狀態
        this.status = AGENT_STATUS.INITIALIZING;
        this.lastStatusChange = Date.now();
        this.startTime = null;
        this.lastActivity = null;
        this.restartCount = 0;

        // 任務管理
        this.activeTasks = new Map(); // taskId -> task info
        this.completedTasks = new Map(); // taskId -> result
        this.taskQueue = []; // 待執行任務佇列
        this.maxConcurrentTasks = this.config.maxConcurrentTasks;

        // 資源使用
        this.resourceUsage = {
            cpu: 0,
            memory: 0,
            handles: 0
        };

        // 性能統計
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            averageTaskTime: 0,
            uptime: 0,
            errorCount: 0,
            lastError: null
        };

        // Worker線程（如果使用）
        this.worker = null;
        this.workerScript = options.workerScript || null;

        // 定時器
        this.heartbeatTimer = null;
        this.healthCheckTimer = null;
        this.idleTimer = null;

        // 初始化
        this._initialize();
    }

    /**
     * 啟動Agent
     */
    async start() {
        try {
            console.log(`[Agent:${this.id}] 正在啟動...`);
            this._updateStatus(AGENT_STATUS.READY);

            // 啟動Worker線程（如果配置了）
            if (this.workerScript) {
                await this._startWorker();
            }

            // 開始心跳和健康檢查
            this._startHeartbeat();
            this._startHealthCheck();

            this.startTime = Date.now();
            this.lastActivity = Date.now();

            this.emit('started');
            console.log(`[Agent:${this.id}] 已啟動成功`);

            return true;

        } catch (error) {
            console.error(`[Agent:${this.id}] 啟動失敗:`, error);
            this._updateStatus(AGENT_STATUS.ERROR);
            this.stats.errorCount++;
            this.stats.lastError = error.message;
            throw error;
        }
    }

    /**
     * 停止Agent
     */
    async stop(force = false) {
        try {
            console.log(`[Agent:${this.id}] 正在停止...`);
            this._updateStatus(AGENT_STATUS.STOPPING);

            // 停止接受新任務
            this.taskQueue.length = 0;

            // 等待當前任務完成或強制終止
            if (!force && this.activeTasks.size > 0) {
                console.log(`[Agent:${this.id}] 等待 ${this.activeTasks.size} 個任務完成...`);
                await this._waitForTasksCompletion(30000); // 30秒超時
            }

            // 強制取消剩餘任務
            if (force || this.activeTasks.size > 0) {
                await this._cancelAllTasks();
            }

            // 停止Worker線程
            if (this.worker) {
                await this._stopWorker();
            }

            // 清理定時器
            this._stopTimers();

            this._updateStatus(AGENT_STATUS.STOPPED);
            this.emit('stopped');
            console.log(`[Agent:${this.id}] 已停止`);

            return true;

        } catch (error) {
            console.error(`[Agent:${this.id}] 停止失敗:`, error);
            this._updateStatus(AGENT_STATUS.ERROR);
            throw error;
        }
    }

    /**
     * 暫停Agent
     */
    async pause() {
        if (this.status === AGENT_STATUS.RUNNING || this.status === AGENT_STATUS.IDLE) {
            this._updateStatus(AGENT_STATUS.PAUSED);
            this.emit('paused');
            console.log(`[Agent:${this.id}] 已暫停`);
            return true;
        }
        return false;
    }

    /**
     * 恢復Agent
     */
    async resume() {
        if (this.status === AGENT_STATUS.PAUSED) {
            this._updateStatus(AGENT_STATUS.READY);
            this.emit('resumed');
            console.log(`[Agent:${this.id}] 已恢復`);
            return true;
        }
        return false;
    }

    /**
     * 重啟Agent
     */
    async restart() {
        try {
            console.log(`[Agent:${this.id}] 正在重啟...`);

            await this.stop(true);

            // 等待重啟延遲
            await new Promise(resolve => setTimeout(resolve, this.options.restartDelay));

            this.restartCount++;
            await this.start();

            this.emit('restarted');
            console.log(`[Agent:${this.id}] 已重啟成功 (第 ${this.restartCount} 次)`);

            return true;

        } catch (error) {
            console.error(`[Agent:${this.id}] 重啟失敗:`, error);

            // 檢查是否超過最大重啟次數
            if (this.restartCount >= this.options.maxRestartAttempts) {
                console.error(`[Agent:${this.id}] 超過最大重啟次數，停止嘗試`);
                this._updateStatus(AGENT_STATUS.CRASHED);
                this.emit('crashed');
                return false;
            }

            throw error;
        }
    }

    /**
     * 執行任務
     * @param {Object} task - 任務對象
     * @returns {Promise<Object>} - 任務執行結果
     */
    async executeTask(task) {
        if (this.status !== AGENT_STATUS.READY && this.status !== AGENT_STATUS.IDLE) {
            throw new Error(`Agent狀態不允許執行任務: ${this.status}`);
        }

        if (this.activeTasks.size >= this.maxConcurrentTasks) {
            // 加入任務佇列
            return new Promise((resolve, reject) => {
                this.taskQueue.push({
                    task,
                    resolve,
                    reject,
                    timestamp: Date.now()
                });
            });
        }

        return await this._executeTaskImmediately(task);
    }

    /**
     * 取消任務
     * @param {string} taskId - 任務ID
     * @returns {boolean} - 是否成功取消
     */
    async cancelTask(taskId) {
        // 檢查活動任務
        const activeTask = this.activeTasks.get(taskId);
        if (activeTask) {
            try {
                if (activeTask.controller) {
                    activeTask.controller.abort();
                }

                this.activeTasks.delete(taskId);
                this.emit('taskCancelled', taskId);
                console.log(`[Agent:${this.id}] 已取消任務: ${taskId}`);

                // 處理佇列中的下一個任務
                await this._processTaskQueue();

                return true;

            } catch (error) {
                console.error(`[Agent:${this.id}] 取消任務失敗: ${taskId}`, error);
                return false;
            }
        }

        // 檢查佇列中的任務
        const queueIndex = this.taskQueue.findIndex(item => item.task.id === taskId);
        if (queueIndex !== -1) {
            const queueItem = this.taskQueue.splice(queueIndex, 1)[0];
            queueItem.reject(new Error('任務已被取消'));
            return true;
        }

        return false;
    }

    /**
     * 獲取Agent狀態
     */
    getStatus() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            lastStatusChange: this.lastStatusChange,
            startTime: this.startTime,
            lastActivity: this.lastActivity,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            restartCount: this.restartCount,

            // 任務狀態
            activeTasks: this.activeTasks.size,
            queuedTasks: this.taskQueue.length,
            completedTasksCount: this.completedTasks.size,

            // 資源使用
            resourceUsage: { ...this.resourceUsage },

            // 性能統計
            stats: { ...this.stats },

            // 配置
            config: { ...this.config }
        };
    }

    /**
     * 獲取健康狀態
     */
    getHealthStatus() {
        const now = Date.now();
        const uptime = this.startTime ? now - this.startTime : 0;
        const idleTime = this.lastActivity ? now - this.lastActivity : 0;

        const health = {
            healthy: true,
            issues: [],
            score: 100, // 健康分數 (0-100)
            checks: {
                status: this.status === AGENT_STATUS.READY || this.status === AGENT_STATUS.IDLE,
                uptime: uptime > 10000, // 至少運行10秒
                memory: this.resourceUsage.memory < this.config.maxMemoryUsage,
                errors: this.stats.errorCount < 10,
                responsiveness: idleTime < this.config.maxIdleTime
            }
        };

        // 評估健康狀態
        let score = 100;

        if (!health.checks.status) {
            health.issues.push('Agent狀態異常');
            score -= 30;
        }

        if (!health.checks.uptime) {
            health.issues.push('運行時間過短');
            score -= 10;
        }

        if (!health.checks.memory) {
            health.issues.push('記憶體使用過高');
            score -= 25;
        }

        if (!health.checks.errors) {
            health.issues.push('錯誤次數過多');
            score -= 20;
        }

        if (!health.checks.responsiveness) {
            health.issues.push('Agent無響應時間過長');
            score -= 15;
        }

        health.score = Math.max(0, score);
        health.healthy = health.score >= 70;

        return health;
    }

    // ========== 私有方法 ==========

    /**
     * 初始化Agent
     * @private
     */
    _initialize() {
        // 設置錯誤處理
        this.on('error', (error) => {
            console.error(`[Agent:${this.id}] 發生錯誤:`, error);
            this.stats.errorCount++;
            this.stats.lastError = error.message;

            // 如果啟用自動重啟
            if (this.options.autoRestart && this.restartCount < this.options.maxRestartAttempts) {
                setTimeout(() => {
                    this.restart().catch(console.error);
                }, this.options.restartDelay);
            }
        });
    }

    /**
     * 啟動Worker線程
     * @private
     */
    async _startWorker() {
        if (!this.workerScript) return;

        try {
            this.worker = new Worker(this.workerScript, {
                workerData: {
                    agentId: this.id,
                    agentType: this.type,
                    config: this.config
                }
            });

            this.worker.on('message', this._handleWorkerMessage.bind(this));
            this.worker.on('error', this._handleWorkerError.bind(this));
            this.worker.on('exit', this._handleWorkerExit.bind(this));

            console.log(`[Agent:${this.id}] Worker線程已啟動`);

        } catch (error) {
            console.error(`[Agent:${this.id}] 啟動Worker線程失敗:`, error);
            throw error;
        }
    }

    /**
     * 停止Worker線程
     * @private
     */
    async _stopWorker() {
        if (!this.worker) return;

        try {
            await this.worker.terminate();
            this.worker = null;
            console.log(`[Agent:${this.id}] Worker線程已停止`);
        } catch (error) {
            console.error(`[Agent:${this.id}] 停止Worker線程失敗:`, error);
        }
    }

    /**
     * 開始心跳
     * @private
     */
    _startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.emit('heartbeat', {
                agentId: this.id,
                status: this.status,
                timestamp: Date.now(),
                activeTasks: this.activeTasks.size
            });
        }, this.config.heartbeatInterval);
    }

    /**
     * 開始健康檢查
     * @private
     */
    _startHealthCheck() {
        this.healthCheckTimer = setInterval(() => {
            this._performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * 執行健康檢查
     * @private
     */
    _performHealthCheck() {
        try {
            const health = this.getHealthStatus();

            if (!health.healthy) {
                console.warn(`[Agent:${this.id}] 健康檢查失敗:`, health.issues);
                this.emit('healthIssue', health);

                // 如果健康分數很低，考慮重啟
                if (health.score < 30 && this.options.autoRestart) {
                    console.log(`[Agent:${this.id}] 健康分數過低 (${health.score})，準備重啟`);
                    this.restart().catch(console.error);
                }
            }

            this.emit('healthCheck', health);

        } catch (error) {
            console.error(`[Agent:${this.id}] 健康檢查失敗:`, error);
        }
    }

    /**
     * 停止定時器
     * @private
     */
    _stopTimers() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    /**
     * 立即執行任務
     * @private
     */
    async _executeTaskImmediately(task) {
        const taskId = task.id || this._generateTaskId();
        const startTime = Date.now();

        try {
            this._updateStatus(AGENT_STATUS.RUNNING);
            this.lastActivity = Date.now();

            // 創建任務控制器
            const controller = new AbortController();

            const taskInfo = {
                id: taskId,
                task,
                startTime,
                controller,
                status: 'running'
            };

            this.activeTasks.set(taskId, taskInfo);
            this.stats.totalTasks++;

            this.emit('taskStarted', taskId, task);

            // 執行任務
            let result;
            if (this.worker) {
                result = await this._executeTaskInWorker(task, controller.signal);
            } else {
                result = await this._executeTaskInProcess(task, controller.signal);
            }

            // 任務完成
            const executionTime = Date.now() - startTime;
            this._updateTaskStats(executionTime, true);

            taskInfo.status = 'completed';
            taskInfo.endTime = Date.now();
            taskInfo.result = result;

            this.completedTasks.set(taskId, taskInfo);
            this.activeTasks.delete(taskId);

            this.emit('taskCompleted', taskId, result);

            // 處理佇列中的下一個任務
            await this._processTaskQueue();

            // 更新狀態
            this._updateAgentStatus();

            return result;

        } catch (error) {
            // 任務失敗
            const executionTime = Date.now() - startTime;
            this._updateTaskStats(executionTime, false);

            const taskInfo = this.activeTasks.get(taskId);
            if (taskInfo) {
                taskInfo.status = 'failed';
                taskInfo.endTime = Date.now();
                taskInfo.error = error.message;
                this.activeTasks.delete(taskId);
            }

            this.emit('taskFailed', taskId, error);

            // 處理佇列中的下一個任務
            await this._processTaskQueue();

            // 更新狀態
            this._updateAgentStatus();

            throw error;
        }
    }

    /**
     * 在Worker中執行任務
     * @private
     */
    async _executeTaskInWorker(task, signal) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('任務執行超時'));
            }, 60000); // 60秒超時

            const messageHandler = (message) => {
                if (message.taskId === task.id) {
                    clearTimeout(timeoutId);
                    this.worker.off('message', messageHandler);

                    if (message.type === 'taskComplete') {
                        resolve(message.result);
                    } else if (message.type === 'taskError') {
                        reject(new Error(message.error));
                    }
                }
            };

            this.worker.on('message', messageHandler);

            // 檢查中止信號
            signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                this.worker.off('message', messageHandler);
                reject(new Error('任務已被取消'));
            });

            // 發送任務給Worker
            this.worker.postMessage({
                type: 'executeTask',
                task
            });
        });
    }

    /**
     * 在當前進程中執行任務
     * @private
     */
    async _executeTaskInProcess(task, signal) {
        // 這裡應該根據任務類型和Agent類型來決定具體的執行邏輯
        // 目前提供一個基本的模擬實現

        // 檢查中止信號
        if (signal.aborted) {
            throw new Error('任務已被取消');
        }

        // 模擬任務執行
        const executionTime = Math.random() * 5000 + 1000; // 1-6秒

        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(resolve, executionTime);

            signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new Error('任務已被取消'));
            });
        });

        // 模擬任務結果
        return {
            taskId: task.id,
            success: true,
            executionTime,
            result: `任務 ${task.id} 由 ${this.id} 完成`,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 處理任務佇列
     * @private
     */
    async _processTaskQueue() {
        while (this.taskQueue.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
            const queueItem = this.taskQueue.shift();

            try {
                const result = await this._executeTaskImmediately(queueItem.task);
                queueItem.resolve(result);
            } catch (error) {
                queueItem.reject(error);
            }
        }
    }

    /**
     * 取消所有任務
     * @private
     */
    async _cancelAllTasks() {
        const taskIds = Array.from(this.activeTasks.keys());

        for (const taskId of taskIds) {
            await this.cancelTask(taskId);
        }

        // 清空佇列
        while (this.taskQueue.length > 0) {
            const queueItem = this.taskQueue.shift();
            queueItem.reject(new Error('Agent正在停止'));
        }
    }

    /**
     * 等待任務完成
     * @private
     */
    async _waitForTasksCompletion(timeout) {
        return new Promise((resolve) => {
            const checkInterval = 500;
            let elapsed = 0;

            const checker = setInterval(() => {
                if (this.activeTasks.size === 0 || elapsed >= timeout) {
                    clearInterval(checker);
                    resolve();
                }
                elapsed += checkInterval;
            }, checkInterval);
        });
    }

    /**
     * 更新狀態
     * @private
     */
    _updateStatus(newStatus) {
        if (this.status !== newStatus) {
            const oldStatus = this.status;
            this.status = newStatus;
            this.lastStatusChange = Date.now();

            this.emit('statusChanged', {
                agentId: this.id,
                oldStatus,
                newStatus,
                timestamp: this.lastStatusChange
            });
        }
    }

    /**
     * 更新Agent狀態
     * @private
     */
    _updateAgentStatus() {
        if (this.activeTasks.size === 0) {
            this._updateStatus(AGENT_STATUS.IDLE);

            // 設置空閒超時
            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
            }

            this.idleTimer = setTimeout(() => {
                if (this.activeTasks.size === 0) {
                    this.emit('idleTimeout', this.id);
                }
            }, this.config.maxIdleTime);
        } else {
            this._updateStatus(AGENT_STATUS.BUSY);

            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
        }
    }

    /**
     * 更新任務統計
     * @private
     */
    _updateTaskStats(executionTime, success) {
        if (success) {
            this.stats.completedTasks++;

            // 更新平均執行時間
            const completedTasks = this.stats.completedTasks;
            this.stats.averageTaskTime = (
                this.stats.averageTaskTime * (completedTasks - 1) + executionTime
            ) / completedTasks;
        } else {
            this.stats.failedTasks++;
        }
    }

    /**
     * 處理Worker消息
     * @private
     */
    _handleWorkerMessage(message) {
        switch (message.type) {
            case 'resourceUsage':
                this.resourceUsage = message.data;
                break;
            case 'error':
                this.emit('error', new Error(message.error));
                break;
            default:
                // 其他消息由具體的執行邏輯處理
                break;
        }
    }

    /**
     * 處理Worker錯誤
     * @private
     */
    _handleWorkerError(error) {
        console.error(`[Agent:${this.id}] Worker錯誤:`, error);
        this.emit('error', error);
    }

    /**
     * 處理Worker退出
     * @private
     */
    _handleWorkerExit(code) {
        console.warn(`[Agent:${this.id}] Worker退出，代碼: ${code}`);

        if (code !== 0 && this.status !== AGENT_STATUS.STOPPING) {
            this._updateStatus(AGENT_STATUS.ERROR);
            this.emit('error', new Error(`Worker異常退出，代碼: ${code}`));
        }
    }

    /**
     * 生成任務ID
     * @private
     */
    _generateTaskId() {
        return `task_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

/**
 * Agent管理器主類
 */
class AgentManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            maxAgents: 15,
            defaultAgentConfig: {
                maxConcurrentTasks: 3,
                heartbeatInterval: 5000,
                healthCheckInterval: 30000
            },
            loadBalancing: 'round_robin', // round_robin, least_busy, weighted
            enableFailover: true,
            healthCheckInterval: 10000,
            ...options
        };

        // Agent實例管理
        this.agents = new Map(); // agentId -> AgentInstance
        this.agentCounter = 0;

        // 負載均衡狀態
        this.lastAssignedAgentIndex = 0;
        this.agentLoadMetrics = new Map(); // agentId -> load metrics

        // 事件總線
        this.eventBus = new EventBus();

        // 統計信息
        this.stats = {
            totalAgents: 0,
            activeAgents: 0,
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            restartCount: 0
        };

        // 健康監控
        this.healthCheckTimer = null;

        this._initialize();
    }

    /**
     * 初始化管理器
     */
    async initialize() {
        try {
            console.log('[AgentManager] 初始化Agent管理器...');

            // 初始化事件總線
            await this.eventBus.initialize();

            // 開始健康監控
            this._startHealthMonitoring();

            // 設置事件處理
            this._setupEventHandlers();

            this.emit('initialized');
            console.log('[AgentManager] Agent管理器已初始化');

        } catch (error) {
            console.error('[AgentManager] 初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 創建Agent
     * @param {Object} config - Agent配置
     * @param {Object} options - 創建選項
     * @returns {string} - Agent ID
     */
    async createAgent(config = {}, options = {}) {
        if (this.agents.size >= this.options.maxAgents) {
            throw new Error(`已達到最大Agent數量限制: ${this.options.maxAgents}`);
        }

        const agentId = `agent_${++this.agentCounter}_${Date.now()}`;
        const mergedConfig = { ...this.options.defaultAgentConfig, ...config };

        try {
            const agent = new AgentInstance(agentId, mergedConfig, options);

            // 設置Agent事件處理
            this._setupAgentEventHandlers(agent);

            this.agents.set(agentId, agent);
            this.stats.totalAgents++;

            await agent.start();
            this.stats.activeAgents++;

            this.emit('agentCreated', agentId);
            console.log(`[AgentManager] 已創建Agent: ${agentId}`);

            return agentId;

        } catch (error) {
            console.error(`[AgentManager] 創建Agent失敗: ${agentId}`, error);
            this.agents.delete(agentId);
            throw error;
        }
    }

    /**
     * 停止Agent
     * @param {string} agentId - Agent ID
     * @param {boolean} force - 是否強制停止
     * @returns {boolean} - 是否成功停止
     */
    async stopAgent(agentId, force = false) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.warn(`[AgentManager] Agent不存在: ${agentId}`);
            return false;
        }

        try {
            await agent.stop(force);
            this.agents.delete(agentId);
            this.stats.activeAgents--;

            this.emit('agentStopped', agentId);
            console.log(`[AgentManager] 已停止Agent: ${agentId}`);

            return true;

        } catch (error) {
            console.error(`[AgentManager] 停止Agent失敗: ${agentId}`, error);
            return false;
        }
    }

    /**
     * 重啟Agent
     * @param {string} agentId - Agent ID
     * @returns {boolean} - 是否成功重啟
     */
    async restartAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.warn(`[AgentManager] Agent不存在: ${agentId}`);
            return false;
        }

        try {
            await agent.restart();
            this.stats.restartCount++;

            this.emit('agentRestarted', agentId);
            console.log(`[AgentManager] 已重啟Agent: ${agentId}`);

            return true;

        } catch (error) {
            console.error(`[AgentManager] 重啟Agent失敗: ${agentId}`, error);
            return false;
        }
    }

    /**
     * 分配任務給最合適的Agent
     * @param {Object} task - 任務對象
     * @param {Object} options - 分配選項
     * @returns {Promise<Object>} - 任務執行結果
     */
    async assignTask(task, options = {}) {
        const agent = this._selectAgent(task, options);

        if (!agent) {
            throw new Error('沒有可用的Agent來執行任務');
        }

        try {
            this.stats.totalTasks++;
            const result = await agent.executeTask(task);
            this.stats.completedTasks++;

            this.emit('taskAssigned', {
                taskId: task.id,
                agentId: agent.id,
                success: true
            });

            return result;

        } catch (error) {
            this.stats.failedTasks++;

            // 如果啟用故障轉移，嘗試分配給其他Agent
            if (this.options.enableFailover && options.allowFailover !== false) {
                console.log(`[AgentManager] Agent ${agent.id} 執行失敗，嘗試故障轉移...`);

                // 排除失敗的Agent
                const failoverAgent = this._selectAgent(task, {
                    ...options,
                    excludeAgents: [agent.id],
                    allowFailover: false // 防止無限遞歸
                });

                if (failoverAgent) {
                    return await failoverAgent.executeTask(task);
                }
            }

            this.emit('taskAssigned', {
                taskId: task.id,
                agentId: agent.id,
                success: false,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * 批量分配任務
     * @param {Array} tasks - 任務列表
     * @param {Object} options - 分配選項
     * @returns {Promise<Array>} - 任務執行結果列表
     */
    async assignTasks(tasks, options = {}) {
        const {
            parallel = true,
            stopOnError = false
        } = options;

        const results = [];

        if (parallel) {
            // 並行執行
            const promises = tasks.map(task =>
                this.assignTask(task, options).catch(error => ({
                    taskId: task.id,
                    error: error.message,
                    success: false
                }))
            );

            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (result.error && stopOnError) {
                    throw new Error(`任務 ${result.taskId} 失敗: ${result.error}`);
                }
                results.push(result);
            }
        } else {
            // 順序執行
            for (const task of tasks) {
                try {
                    const result = await this.assignTask(task, options);
                    results.push(result);
                } catch (error) {
                    const errorResult = {
                        taskId: task.id,
                        error: error.message,
                        success: false
                    };
                    results.push(errorResult);

                    if (stopOnError) {
                        throw error;
                    }
                }
            }
        }

        return results;
    }

    /**
     * 獲取所有Agent狀態
     */
    getAllAgentStatus() {
        const agentStatuses = {};

        for (const [agentId, agent] of this.agents) {
            agentStatuses[agentId] = agent.getStatus();
        }

        return {
            agents: agentStatuses,
            summary: {
                totalAgents: this.agents.size,
                activeAgents: Array.from(this.agents.values()).filter(
                    agent => agent.status === AGENT_STATUS.READY ||
                             agent.status === AGENT_STATUS.IDLE ||
                             agent.status === AGENT_STATUS.BUSY
                ).length,
                stats: { ...this.stats }
            }
        };
    }

    /**
     * 自動擴展Agent
     * @param {number} targetCount - 目標Agent數量
     */
    async autoScale(targetCount = null) {
        if (targetCount === null) {
            // 根據當前負載自動計算目標數量
            targetCount = this._calculateOptimalAgentCount();
        }

        const currentCount = this.agents.size;

        if (targetCount > currentCount) {
            // 擴展
            const createCount = Math.min(targetCount - currentCount, this.options.maxAgents - currentCount);

            console.log(`[AgentManager] 自動擴展 ${createCount} 個Agent...`);

            for (let i = 0; i < createCount; i++) {
                try {
                    await this.createAgent();
                } catch (error) {
                    console.error('[AgentManager] 自動擴展失敗:', error);
                    break;
                }
            }
        } else if (targetCount < currentCount) {
            // 縮減
            const removeCount = currentCount - targetCount;
            const idleAgents = Array.from(this.agents.values())
                .filter(agent => agent.status === AGENT_STATUS.IDLE)
                .slice(0, removeCount);

            console.log(`[AgentManager] 自動縮減 ${idleAgents.length} 個Agent...`);

            for (const agent of idleAgents) {
                try {
                    await this.stopAgent(agent.id);
                } catch (error) {
                    console.error('[AgentManager] 自動縮減失敗:', error);
                }
            }
        }

        this.emit('autoScaled', {
            previousCount: currentCount,
            targetCount,
            currentCount: this.agents.size
        });
    }

    /**
     * 關閉管理器
     */
    async shutdown() {
        console.log('[AgentManager] 正在關閉Agent管理器...');

        // 停止健康監控
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        // 停止所有Agent
        const stopPromises = Array.from(this.agents.keys()).map(agentId =>
            this.stopAgent(agentId, true)
        );

        await Promise.allSettled(stopPromises);

        // 關閉事件總線
        await this.eventBus.dispose();

        this.emit('shutdown');
        console.log('[AgentManager] Agent管理器已關閉');
    }

    // ========== 私有方法 ==========

    /**
     * 初始化
     * @private
     */
    _initialize() {
        // 設置錯誤處理
        this.on('error', (error) => {
            console.error('[AgentManager] 管理器錯誤:', error);
        });
    }

    /**
     * 選擇Agent
     * @private
     */
    _selectAgent(task, options = {}) {
        const availableAgents = Array.from(this.agents.values()).filter(agent => {
            // 排除指定的Agent
            if (options.excludeAgents && options.excludeAgents.includes(agent.id)) {
                return false;
            }

            // 只選擇健康的Agent
            return agent.status === AGENT_STATUS.READY ||
                   agent.status === AGENT_STATUS.IDLE ||
                   agent.status === AGENT_STATUS.BUSY;
        });

        if (availableAgents.length === 0) {
            return null;
        }

        // 根據負載均衡策略選擇Agent
        switch (this.options.loadBalancing) {
            case 'round_robin':
                return this._selectAgentRoundRobin(availableAgents);

            case 'least_busy':
                return this._selectAgentLeastBusy(availableAgents);

            case 'weighted':
                return this._selectAgentWeighted(availableAgents, task);

            default:
                return availableAgents[0];
        }
    }

    /**
     * 輪詢選擇Agent
     * @private
     */
    _selectAgentRoundRobin(agents) {
        const agent = agents[this.lastAssignedAgentIndex % agents.length];
        this.lastAssignedAgentIndex++;
        return agent;
    }

    /**
     * 選擇最閒的Agent
     * @private
     */
    _selectAgentLeastBusy(agents) {
        return agents.reduce((least, current) => {
            const leastLoad = least.activeTasks.size + least.taskQueue.length;
            const currentLoad = current.activeTasks.size + current.taskQueue.length;
            return currentLoad < leastLoad ? current : least;
        });
    }

    /**
     * 加權選擇Agent
     * @private
     */
    _selectAgentWeighted(agents, task) {
        // 根據Agent類型和任務類型匹配度選擇
        const scores = agents.map(agent => {
            let score = 100;

            // 類型匹配加分
            if (agent.type === task.type) {
                score += 50;
            }

            // 負載減分
            const load = agent.activeTasks.size + agent.taskQueue.length;
            score -= load * 10;

            // 健康狀態加分
            const health = agent.getHealthStatus();
            score += health.score * 0.5;

            return { agent, score };
        });

        // 選擇得分最高的Agent
        const best = scores.reduce((max, current) =>
            current.score > max.score ? current : max
        );

        return best.agent;
    }

    /**
     * 計算最優Agent數量
     * @private
     */
    _calculateOptimalAgentCount() {
        const currentLoad = Array.from(this.agents.values()).reduce((total, agent) => {
            return total + agent.activeTasks.size + agent.taskQueue.length;
        }, 0);

        const avgTasksPerAgent = this.options.defaultAgentConfig.maxConcurrentTasks;
        const optimalCount = Math.ceil(currentLoad / avgTasksPerAgent);

        return Math.min(Math.max(optimalCount, 1), this.options.maxAgents);
    }

    /**
     * 開始健康監控
     * @private
     */
    _startHealthMonitoring() {
        this.healthCheckTimer = setInterval(() => {
            this._performGlobalHealthCheck();
        }, this.options.healthCheckInterval);
    }

    /**
     * 執行全局健康檢查
     * @private
     */
    _performGlobalHealthCheck() {
        const unhealthyAgents = [];
        const healthyAgents = [];

        for (const [agentId, agent] of this.agents) {
            const health = agent.getHealthStatus();

            if (health.healthy) {
                healthyAgents.push(agentId);
            } else {
                unhealthyAgents.push({ agentId, health });
            }
        }

        if (unhealthyAgents.length > 0) {
            console.warn(`[AgentManager] 發現 ${unhealthyAgents.length} 個不健康的Agent`);
            this.emit('unhealthyAgentsDetected', unhealthyAgents);
        }

        this.emit('globalHealthCheck', {
            totalAgents: this.agents.size,
            healthyAgents: healthyAgents.length,
            unhealthyAgents: unhealthyAgents.length,
            details: { healthyAgents, unhealthyAgents }
        });
    }

    /**
     * 設置事件處理器
     * @private
     */
    _setupEventHandlers() {
        // 監聽事件總線事件
        this.eventBus.on('error', (error) => {
            console.error('[AgentManager] 事件總線錯誤:', error);
        });
    }

    /**
     * 設置Agent事件處理器
     * @private
     */
    _setupAgentEventHandlers(agent) {
        agent.on('statusChanged', (data) => {
            this.emit('agentStatusChanged', data);
        });

        agent.on('taskStarted', (taskId, task) => {
            this.emit('agentTaskStarted', {
                agentId: agent.id,
                taskId,
                task
            });
        });

        agent.on('taskCompleted', (taskId, result) => {
            this.emit('agentTaskCompleted', {
                agentId: agent.id,
                taskId,
                result
            });
        });

        agent.on('taskFailed', (taskId, error) => {
            this.emit('agentTaskFailed', {
                agentId: agent.id,
                taskId,
                error
            });
        });

        agent.on('error', (error) => {
            console.error(`[AgentManager] Agent ${agent.id} 錯誤:`, error);
            this.emit('agentError', {
                agentId: agent.id,
                error
            });
        });

        agent.on('crashed', () => {
            console.error(`[AgentManager] Agent ${agent.id} 已崩潰`);
            this.emit('agentCrashed', agent.id);

            // 從管理中移除崩潰的Agent
            this.agents.delete(agent.id);
            this.stats.activeAgents--;
        });

        agent.on('healthIssue', (health) => {
            this.emit('agentHealthIssue', {
                agentId: agent.id,
                health
            });
        });
    }
}

// 導出常數
AgentManager.AGENT_STATUS = AGENT_STATUS;
AgentManager.AGENT_TYPES = AGENT_TYPES;

module.exports = AgentManager;